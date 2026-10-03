'use strict';
// Deterministic hour allocation for final Tasks (v3.2.0). NO LLM judgment:
// the collector logic here is pure arithmetic and runs behind the persist
// gate. Three supported modes:
//
//   A. ALL SPECIFIED     every final Task carries an explicit hours value;
//                        user values are preserved EXACTLY (no fill, no clip).
//   B. PARTIAL + BALANCE some Tasks explicit; `remaining = dailyTotal -
//                        explicitTotal` is split EQUALLY among the
//                        unspecified Tasks (deterministic cent-precision
//                        distribution; last share absorbs rounding remainder).
//   C. NONE SPECIFIED    the full daily total (default 7.5h) is split equally
//                        across all final Tasks.
//
// Hard rules (all enforced here, enforced again at the persist gate):
//   - hours must be finite numbers >= 0
//   - total allocated hours <= daily total (7.5 by default)
//   - explicit total > daily total  -> REJECT (never silently clipped)
//   - fixed + remainder > daily total -> REJECT
//   - if there are no final Tasks, hour collection is skipped entirely
//   - deterministic rounding: values rounded to hundredths; equal splits use
//     a running cumulative sum so per-task shares never drift between reruns.

// HARD PRODUCT INVARIANT: the daily hour ceiling is ABSOLUTE — total hours
// across final Tasks may never exceed 7.5h. It is NOT configurable and NOT
// overridable: no config key, CLI flag, or runtime option may RAISE OR LOWER
// it. There is exactly ONE value of 7.5 in the hours logic (this constant).
// (v3.2.0 audit decision: `limits.dailyTotalHours` was removed from the
// config schema entirely; the `--daily-total` override seam was also removed
// because the invariant must not be adjustable in either direction.)
const DAILY_TOTAL_HOURS = 7.5;

function roundCents(x) {
  // Deterministic half-up at hundredth precision, immune to repeated
  // floating-point accumulation (used with cumulative sums only).
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// tasks: flat array of final Task objects ({ title, ... }).
// allocations: map taskIndex -> number|null|undefined (null/undefined = unspecified).
// Returns { ok, errors, mode, total, explicitTotal, allocated: number[] }.
function allocateHours(tasks, allocations) {
  // HARD ceiling: the constant alone — nothing else influences it.
  const dailyTotal = DAILY_TOTAL_HOURS;
  const errors = [];
  const list = Array.isArray(tasks) ? tasks : [];
  // No final Tasks -> hour collection is skipped (not an error).
  if (list.length === 0) {
    return { ok: true, mode: 'none', total: 0, explicitTotal: 0, allocated: [], errors: [] };
  }

  const raw = list.map((_, i) => (allocations && allocations[i] !== undefined ? allocations[i] : null));
  const explicitIdx = [];
  const unspecifiedIdx = [];
  raw.forEach((v, i) => {
    if (v === null || v === undefined) unspecifiedIdx.push(i);
    else explicitIdx.push(i);
  });

  // Validate explicit values: finite numbers >= 0 only. Booleans, NaN,
  // Infinity and negatives are rejected — never coerced silently. Numeric
  // strings (e.g. "2h" answers normalized to "2" by the orchestration layer)
  // are accepted as finite numbers; empty/whitespace strings are NOT.
  let explicitTotal = 0;
  for (const i of explicitIdx) {
    const v = Number(raw[i]);
    if (typeof raw[i] === 'boolean' || typeof raw[i] === 'object' || (typeof raw[i] === 'string' && raw[i].trim() === '') || !Number.isFinite(v)) {
      errors.push(`Task[${i}] ("${String(list[i].title || '').slice(0, 60)}"): hours must be a finite number (got ${JSON.stringify(raw[i])}).`);
      continue;
    }
    if (v < 0) errors.push(`Task[${i}]: hours must be >= 0 (got ${v}).`);
    explicitTotal += v;
  }
  explicitTotal = roundCents(explicitTotal);
  if (errors.length) return { ok: false, errors, allocated: [] };

  // Explicit total above the daily budget -> REJECT loudly. No silent
  // clipping, no silent reduction.
  if (explicitTotal > dailyTotal + 1e-9) {
    return {
      ok: false,
      errors: [
        `Explicit hours total ${explicitTotal}h exceeds the daily limit ${dailyTotal}h. Rejecting: explicit values are never silently clipped or reduced. Fix the input and re-run.`,
      ],
      allocated: [],
      explicitTotal,
      dailyTotal,
    };
  }

  let mode;
  let allocated = new Array(list.length).fill(0);
  if (unspecifiedIdx.length === 0) {
    // Mode A — all specified: preserve exact user values; unused time stays
    // unfilled (total may be < dailyTotal; that is valid).
    mode = 'all-specified';
    for (const i of explicitIdx) allocated[i] = roundCents(Number(raw[i]));
  } else if (explicitIdx.length === 0) {
    // Mode C — none specified: split the FULL daily total equally.
    mode = 'equal-split';
    const n = unspecifiedIdx.length;
    let cum = 0;
    unspecifiedIdx.forEach((idx, k) => {
      const nextCum = roundCents(((k + 1) * dailyTotal) / n);
      allocated[idx] = roundCents(nextCum - cum);
      cum = nextCum;
    });
  } else {
    // Mode B — partial + balance: remaining = dailyTotal - explicitTotal,
    // split equally and deterministically among unspecified Tasks.
    mode = 'partial-balance';
    const remaining = roundCents(dailyTotal - explicitTotal);
    if (remaining < 0) {
      return { ok: false, errors: [`fixed hours (${explicitTotal}h) plus remainder would exceed ${dailyTotal}h; rejecting.`], allocated: [] };
    }
    for (const i of explicitIdx) allocated[i] = roundCents(Number(raw[i]));
    const n = unspecifiedIdx.length;
    let cum = 0;
    unspecifiedIdx.forEach((idx, k) => {
      const nextCum = roundCents(((k + 1) * remaining) / n);
      allocated[idx] = roundCents(nextCum - cum);
      cum = nextCum;
    });
  }

  const total = roundCents(allocated.reduce((a, b) => a + b, 0));
  if (total > dailyTotal + 1e-9) {
    return { ok: false, errors: [`Allocated total ${total}h exceeds the daily limit ${dailyTotal}h (fixed + remainder check).`], allocated: [] };
  }
  return { ok: true, mode, total, explicitTotal, dailyTotal, allocated, errors: [] };
}

// Validate already-stored per-Task hours (persist gate path): shape/range
// validation only — this NEVER redistributes anything.
function validateStoredHours(taskHours) {
  // HARD ceiling: the constant alone — nothing else influences it.
  const dailyTotal = DAILY_TOTAL_HOURS;
  const errors = [];
  const entries = Object.entries(taskHours || {});
  let total = 0;
  for (const [label, v] of entries) {
    // Finite numeric values only: booleans, non-numeric strings, NaN and
    // Infinity are rejected — never coerced silently.
    if (typeof v === 'boolean' || (typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v))) || !Number.isFinite(Number(v)) || v === null || v === undefined) {
      errors.push(`Task "${label}": hours must be a finite number (got ${JSON.stringify(v)}).`);
      continue;
    }
    const n = Number(v);
    if (n < 0) errors.push(`Task "${label}": hours must be >= 0 (got ${n}).`);
    total += n;
  }
  total = roundCents(total);
  if (!errors.length && total > dailyTotal + 1e-9) {
    errors.push(`Total stored hours ${total}h exceeds the daily limit ${dailyTotal}h.`);
  }
  return { ok: errors.length === 0, errors, total };
}

module.exports = { allocateHours, validateStoredHours, roundCents, DAILY_TOTAL_HOURS };
