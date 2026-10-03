'use strict';
// Timezone-aware calendar date helpers. Uses Intl (built into Node) — no GNU
// `date`, no moment, no OS assumptions. All functions are pure and
// deterministic for a given (instant, timeZone).

const TZ_UTC = 'UTC';

// Returns { year, month, day, hour, minute, second } for an instant in a zone.
function parts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10);
  }
  // Intl may return hour 24 for midnight with hour12:false on some engines.
  if (p.hour === 24) p.hour = 0;
  return p;
}

function ymd(date, timeZone) {
  const p = parts(date, timeZone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// Convert a calendar Y/M/D at 00:00 local time in `timeZone` to a UTC epoch ms.
// Iterative correction is robust across DST boundaries.
function zonedDayStartMs(year, month, day, timeZone) {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  let ts = naive;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(ts), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const delta = naive - asUtc;
    if (delta === 0) break;
    ts += delta;
  }
  return ts;
}

// [startMs, endMs) UTC epoch bounds covering one local calendar day in tz.
function dayBounds(dateStr, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Bad date string: ${dateStr}`);
  const start = zonedDayStartMs(Number(m[1]), Number(m[2]), Number(m[3]), timeZone);
  const end = zonedDayStartMs(Number(m[1]), Number(m[2]), Number(m[3]) + 1, timeZone);
  // normalize overflow via Date arithmetic above handles month rollover
  return { startMs: start, endMs: end };
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Resolve the report target date ("today" or offset) for now-in-tz.
function resolveTargetDate(now, timeZone, behavior) {
  const today = ymd(now, timeZone);
  if (!behavior || behavior === 'today') return today;
  const m = /^offset:(-?\d+)$/.exec(behavior);
  if (!m) throw new Error(`Unsupported date behavior: ${behavior}`);
  return addDays(today, parseInt(m[1], 10));
}

module.exports = { parts, ymd, zonedDayStartMs, dayBounds, addDays, resolveTargetDate, TZ_UTC };
