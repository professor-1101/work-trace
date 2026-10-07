'use strict';
// Deterministic plain-text renderer + validators for the final report.
// The LLM produces a tasks document (grouping of canonical Work Items);
// this module renders it to genuine .txt and enforces format invariants:
//   - `{Project} - {Task Title}` task headings (project name ONLY there)
//   - subtask lines = Work Item titles verbatim; report text VERBATIM
//   - 3x3 rule, prohibited labels, no Markdown, `---` as only separator

const { MAX_TASKS_PER_REPO, MAX_SUBTASKS_PER_TASK } = require('./workitems');
const hoursLib = require('./hours');

// v3.2.0: deterministic final render order shared by EVERY consumer (the
// renderer, `allocate-hours`, the persist gate and the Daily Report) so hour
// allocations can never misalign with Tasks. Projects sorted by code-unit
// comparison (locale-independent — byte-identical across platforms/ICU),
// tasks/subtasks by title within their parent.
function cmpStr(a, b) {
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
function sortProjects(projects) {
  return [...(projects || [])].sort((a, b) => cmpStr(a.project, b.project));
}
function sortTasks(tasks) {
  return [...(tasks || [])].sort((a, b) => cmpStr(a.title, b.title));
}
function sortSubtasks(subtasks) {
  return [...(subtasks || [])].sort((a, b) => cmpStr(a.title, b.title));
}
// Flat list of FINAL Tasks in exact render order (what hour arrays align to).
function flattenFinalTasks(doc) {
  const out = [];
  for (const p of sortProjects(doc.projects)) {
    for (const t of sortTasks(p.tasks)) out.push({ project: p.project, task: t });
  }
  return out;
}

// v3.2.0: the daily report section label is a legitimate Persian structural
// heading inside the single daily file. It must pass the plain-text invariants
// (no Markdown, no prohibited labels) while everything else stays forbidden.
const DAILY_REPORT_LABEL = 'گزارش روزانه';

// Grouping limits are configuration-driven (limits.maxTasksPerRepository /
// limits.maxSubtasksPerTask). These helpers resolve effective values from a
// config object while falling back to the documented 3×3 defaults.
function effectiveLimits(cfg) {
  const lim = (cfg && cfg.limits) || {};
  return {
    maxTasksPerRepo: Number.isInteger(lim.maxTasksPerRepository) && lim.maxTasksPerRepository > 0 ? lim.maxTasksPerRepository : MAX_TASKS_PER_REPO,
    maxSubtasksPerTask: Number.isInteger(lim.maxSubtasksPerTask) && lim.maxSubtasksPerTask > 0 ? lim.maxSubtasksPerTask : MAX_SUBTASKS_PER_TASK,
  };
}

const PROHIBITED_LABELS = [
  'Task 1', 'Task 2', 'Task 3',
  'Main Task', 'Subtask 1', 'Subtask 2', 'Subtask 3',
  'Subtask', 'Repository', 'Project', 'Report', 'Work Item',
];

// Prohibited label check is line-anchored against structural labels only:
// a standalone label line or a line beginning with one of these words
// followed by a colon/number pattern that indicates a structural label.
// Body prose containing e.g. "report" inside a sentence is NOT flagged —
// only exact label lines are prohibited.
// Case-insensitive, and tolerant of Persian/ZWNJ variants for the English
// label words (تسک/تسک‌ها etc. are not English labels; only Latin-script
// structural labels matter).
const PROHIBITED_LABELS_CI = [
  'task', // covers "Task", "Task 1", "Task:", "Main Task" tail
  'main task',
  'subtask', // covers "Subtask", "Subtask 1", "Subtask:"
  'repository',
  'project',
  'report',
  'work item',
];

function prohibitedLabelHits(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    for (const label of PROHIBITED_LABELS_CI) {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // exact label line ("Subtask"), label + number ("Task 2"), label as
      // structural prefix ("Subtask: title", "Work Item - x").
      // Also tolerate a `{Project} - ` heading prefix so a prohibited label
      // cannot hide behind the project-name prefix on a task heading line.
      const pre = '(?:[^\\n]*?-\\s+)?';
      const reExact = new RegExp('^' + pre + esc + '(\\s*[:：]?\\s*(\\d+)?\\s*)$', 'i');
      const rePrefix = new RegExp('^' + pre + esc + '\\s*[:：-]', 'i');
      const reNumbered = new RegExp('^' + pre + esc + '\\s+\\d+\\b', 'i');
      if (reExact.test(t) || rePrefix.test(t) || reNumbered.test(t)) {
        hits.push({ line: i + 1, text: t, label });
        break;
      }
    }
  });
  return hits;
}

function markdownHits(text) {
  const hits = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const t = line;
    if (/^\s*#/.test(t)) hits.push({ line: i + 1, reason: 'markdown heading (#)' });
    else if (/\*\*/.test(t)) hits.push({ line: i + 1, reason: 'bold markers (**)' });
    else if (t.includes('`')) hits.push({ line: i + 1, reason: 'backticks' });
    else if (/^\s*[-*]\s+/.test(t)) hits.push({ line: i + 1, reason: 'bullet list' });
    else if (/^\s*\d+\.\s+/.test(t)) hits.push({ line: i + 1, reason: 'numbered list' });
    else if (/\|--/.test(t) || /^\s*\|.*\|\s*$/.test(t)) hits.push({ line: i + 1, reason: 'table' });
    else if (/^\s*>/.test(t)) hits.push({ line: i + 1, reason: 'blockquote' });
  });
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(text)) hits.push({ line: 0, reason: 'emoji' });
  return hits;
}

// Validate the LLM-produced tasks document BEFORE rendering.
// doc shape:
// {
//   "projects": [
//     { "project": "alpha",
//       "tasks": [ { "title": "...", "hours": 2, "subtasks": [ { "title": "...", "report": "..." } ] } ] }
//   ]
// }
// `expected`: optional map project -> array of {title, report} (the validated
// work-items doc) used to prove grouping did not rewrite anything.
// `limits`: optional resolved limits from effectiveLimits(cfg); defaults 3×3.
// v3.2.0 additive: optional per-Task `hours` (final, user-provided or
// deterministically allocated AFTER final Tasks are fixed). When any Task
// carries hours, they must all be finite numbers >= 0 and the total must not
// exceed the HARD daily ceiling (7.5h — a product invariant owned by
// tools/lib/hours.js; NOT configurable and NOT overridable in either
// direction). No silent clipping/reduction — violations reject the run.
function validateTasksDoc(doc, expected, limits) {
  const caps = Object.assign({ maxTasksPerRepo: MAX_TASKS_PER_REPO, maxSubtasksPerTask: MAX_SUBTASKS_PER_TASK }, limits || {});
  // HARD ceiling: total hours can never exceed 7.5h — a product invariant
  // owned by tools/lib/hours.js; nothing (config, opts, flags) influences it.
  const dailyTotal = hoursLib.DAILY_TOTAL_HOURS;
  const errors = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.projects)) {
    errors.push('tasks document must contain a `projects` array.');
    return { ok: false, errors };
  }
  // v3.2.0: manual-only project entries may use the empty scope "" (genuinely
  // unscoped work). They still need at least one task with a non-empty title;
  // no fake repository name is ever invented for them.
  for (const p of doc.projects) {
    const proj = String(p.project === undefined || p.project === null ? '' : p.project).trim();
    const isManualEntry = p.manual === true;
    if (!proj && !isManualEntry) {
      errors.push('every project entry needs a non-empty `project` name (manual entries may use "").');
      continue;
    }
    if (!Array.isArray(p.tasks)) {
      errors.push(`project "${proj}": \`tasks\` must be an array.`);
      continue;
    }
    if (p.tasks.length > caps.maxTasksPerRepo) {
      errors.push(
        `project "${proj}": ${p.tasks.length} tasks exceeds the configured limit limits.maxTasksPerRepository=${caps.maxTasksPerRepo}. ` +
          'Do NOT drop or fabricate merges to satisfy it: regroup only when outcomes genuinely share one objective, otherwise the run must fail loudly.'
      );
    }
    p.tasks.forEach((t, ti) => {
      if (!t || typeof t.title !== 'string' || !t.title.trim()) errors.push(`project "${proj}" task[${ti}]: missing title.`);
      if (typeof t.title === 'string' && /\n/.test(t.title)) errors.push(`project "${proj}" task[${ti}]: title must be single-line.`);
      if (!Array.isArray(t.subtasks)) {
        errors.push(`project "${proj}" task[${ti}]: \`subtasks\` must be an array.`);
        return;
      }
      if (t.subtasks.length === 0) errors.push(`project "${proj}" task[${ti}]: empty task would produce an empty section.`);
      if (t.subtasks.length > caps.maxSubtasksPerTask) {
        errors.push(
          `project "${proj}" task[${ti}]: ${t.subtasks.length} subtasks exceeds the configured limit limits.maxSubtasksPerTask=${caps.maxSubtasksPerTask}. Independent outcomes must not be destroyed to fit the cap.`
        );
      }
      t.subtasks.forEach((s, si) => {
        if (!s || typeof s.title !== 'string' || !s.title.trim()) errors.push(`project "${proj}" task[${ti}] subtask[${si}]: missing title.`);
        if (!s || typeof s.report !== 'string' || !s.report.trim()) errors.push(`project "${proj}" task[${ti}] subtask[${si}]: missing report text.`);
        if (s && typeof s.title === 'string' && /\n/.test(s.title)) errors.push(`project "${proj}" task[${ti}] subtask[${si}]: title must be single-line.`);
      });
    });
  }

  // v3.2.0 hours validation: only when the document carries hour data.
  // Mixed presence (some Tasks with hours, some without) is rejected —
  // balancing of unspecified Tasks happens in `allocateHours` BEFORE the
  // document reaches this final shape; here every Task must have a value.
  const allTasks = [];
  for (const p of doc.projects || []) {
    for (const t of p.tasks || []) allTasks.push({ project: p.project, task: t });
  }
  const withHours = allTasks.filter(({ task }) => task.hours !== undefined && task.hours !== null);
  if (withHours.length > 0) {
    if (withHours.length !== allTasks.length) {
      errors.push('Hours are partially present on the tasks document: every final Task must carry an hours value (run allocate/normalize first); no silent redistribution happens at validation time.');
    }
    let total = 0;
    for (const { project, task } of withHours) {
      const v = task.hours;
      if (typeof v === 'boolean' || (typeof v === 'string' && !Number.isFinite(Number(v))) || !Number.isFinite(Number(v))) {
        errors.push(`project "${project}" task "${String(task.title).slice(0, 60)}": hours must be a finite number (got ${JSON.stringify(v)}).`);
        continue;
      }
      const n = Number(v);
      if (n < 0) errors.push(`project "${project}" task "${String(task.title).slice(0, 60)}": hours must be >= 0 (got ${n}).`);
      total += n;
    }
    total = hoursLib.roundCents(total);
    if (withHours.length === allTasks.length && total > dailyTotal + 1e-9) {
      errors.push(`Total task hours ${total}h exceeds the daily limit ${dailyTotal}h. Rejecting — explicit values are never silently clipped or reduced.`);
    }
  }

  if (expected) {
    // Verbatim preservation: every subtask must exactly match one expected
    // Work Item ({title, report}); every expected Work Item must appear
    // exactly once. This makes rewriting/shortening/merging detectable.
    const expByProj = new Map();
    for (const p of expected.projects || []) {
      expByProj.set(p.project, (p.workItems || []).map((w) => ({ ...w, used: 0 })));
    }
    for (const p of doc.projects) {
      const list = expByProj.get(p.project);
      if (!list) {
        errors.push(`project "${p.project}" is not present in the validated Work Items.`);
        continue;
      }
      const seenPair = new Set();
      for (const t of p.tasks || []) {
        for (const s of t.subtasks || []) {
          const key = JSON.stringify([s.title, s.report]);
          if (seenPair.has(key)) errors.push(`project "${p.project}": Work Item "${s.title}" appears more than once.`);
          seenPair.add(key);
          const match = list.find((w) => w.title === s.title && w.report === s.report);
          if (!match) errors.push(`project "${p.project}": subtask "${String(s.title).slice(0, 60)}" does not match any canonical Work Item VERBATIM (titles become subtask titles; reports must be reused unchanged).`);
          else match.used++;
        }
      }
      for (const w of list) {
        if (w.used === 0) errors.push(`project "${p.project}": canonical Work Item "${w.title}" is missing from the grouped output (dropped outcome).`);
        if (w.used > 1) errors.push(`project "${p.project}": canonical Work Item "${w.title}" duplicated in output.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function normalizeText(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

// Render the tasks document into the final plain text.
// v3.1.0 contract: ONE repository section per project. `---` appears ONLY
// between repository sections — for N projects exactly N-1 separator lines,
// and NEVER between two Tasks inside the same repository section. Ordering is
// deterministic (project name, then task title, then subtask title).
//
// v3.2.0 additive contract: when the tasks document carries hour allocations
// (`tasks[i].hours`, set by the deterministic hours module AFTER final Tasks
// are fixed), a single trailing Daily Report section is appended to the SAME
// file:
//
//   گزارش روزانه
//   {Task title} - {H}h
//
// Exactly one line per Final Task, in deterministic render order (same order
// as the rendered headings). NO `---` separator is added for this section —
// `---` remains exclusively the between-repositories separator. The Daily
// Report is generated from Final Tasks only; it never re-runs analysis and
// never rewrites Work Item reports.
function formatHours(n) {
  // Deterministic hour formatting: drop a trailing `.0`, keep hundredths.
  const r = hoursLib.roundCents(Number(n));
  return Number.isInteger(r) ? String(r) : String(r);
}

// v3.2.0 Daily Report contract: EVERY non-empty successful daily report —
// including Git-only days with no manual work and no explicit hour answers —
// carries exactly ONE `گزارش روزانه` section in the same report.txt. When no
// Task carries stored hours, they are auto-distributed across Final Tasks by
// the SAME deterministic mode-C arithmetic as tools/lib/hours.js (equal split
// of the hard 7.5h budget, cumulative hundredth rounding). This is a pure
// display-time projection of the product invariant: it never mutates the
// tasks document, never influences grouping, and never rewrites Work Item
// reports. A day with zero Final Tasks skips hour collection entirely and
// produces no Daily Report (empty-day file stays empty).
function dailyReportLines(doc) {
  // Final Tasks in exact render order (shared helper — identical sequence to
  // the rendered headings; code-unit sort, locale-independent).
  const flat = flattenFinalTasks(doc);
  if (flat.length === 0) return null; // no Final Tasks -> hour collection skipped
  const hasHours = flat.some(({ task }) => task.hours !== undefined && task.hours !== null);
  if (!hasHours) {
    // No explicit hour answers -> deterministic equal split of 7.5h.
    const alloc = hoursLib.allocateHours(flat.map(({ task }) => task), []);
    if (!alloc.ok) return null; // defensive: gate surfaces real errors via validateRendered
    return flat.map(({ task }, i) => `${normalizeText(task.title)} - ${formatHours(alloc.allocated[i])}h`);
  }
  // Stored final Task hours are used EXACTLY as persisted (no re-allocation,
  // no silent redistribution at render time).
  return flat.map(({ task }) => {
    const h = task.hours === undefined || task.hours === null ? 0 : Number(task.hours);
    return `${normalizeText(task.title)} - ${formatHours(h)}h`;
  });
}

function renderTasks(doc) {
  const sections = [];
  for (const p of sortProjects(doc.projects)) {
    const tasks = sortTasks(p.tasks);
    const blocks = [];
    for (const t of tasks) {
      // Manual-only entries with the empty scope render a bare Task heading
      // (no fake `{Project} - ` prefix is invented for unscoped work).
      const head = p.project ? `${p.project} - ${normalizeText(t.title)}` : normalizeText(t.title);
      const taskBlocks = [head];
      const subtasks = sortSubtasks(t.subtasks);
      for (const s of subtasks) {
        taskBlocks.push(`${normalizeText(s.title)}\n${normalizeText(s.report)}`);
      }
      blocks.push(taskBlocks.join('\n\n'));
    }
    if (blocks.length) sections.push(blocks.join('\n\n'));
  }
  // v3.2.0 Daily Report: appended to the SAME file, after all repository
  // sections, with NO `---` separator of its own. Generated purely from the
  // Final Tasks (title + exact final hours) — never re-analyzes anything.
  const daily = dailyReportLines(doc);
  const tail = daily ? `\n\n${DAILY_REPORT_LABEL}\n${daily.join('\n')}\n` : '\n';
  if (sections.length === 0) return daily ? `${DAILY_REPORT_LABEL}\n${daily.join('\n')}\n` : '';
  return sections.join('\n\n---\n\n') + tail;
}

// Validate rendered text (structural pass over the artifact itself).
// v3.1.0 contract: ONE repository section per project; `---` appears ONLY
// between repository sections (exactly N-1 for N non-empty projects) and
// NEVER between two Tasks of the same repository. Headings must be exactly
// `{Project} - {Task Title}` in the deterministic render order; every task
// block's first line after a heading must be a Work Item title line (no
// fabricated or missing blocks).
// v3.2.0 additive: an optional trailing Daily Report section
// (`گزارش روزانه` + one `{Task title} - {H}h` line per Final Task, no `---`)
// is allowed at the very end of the file, and validated against the tasks
// document when supplied.
function validateRendered(text, doc) {
  const errors = [];
  if (text === '') return { ok: true, errors, empty: true };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '---' && lines[i] !== '---') errors.push(`Separator line ${i + 1} must be exactly "---".`);
  }
  // Structural checks run whenever a tasks document is supplied.
  if (doc) {
    // Detect the trailing Daily Report section (if any) and strip it from
    // the body before running repository-section checks on the remainder.
    let bodyText = text;
    let dailyLines = null;
    const labelIdx = lines.findIndex((l) => l.trim() === DAILY_REPORT_LABEL);
    if (labelIdx >= 0) {
      // Must be the ONLY occurrence, and everything after it is the section.
      const secondIdx = lines.findIndex((l, i) => i > labelIdx && l.trim() === DAILY_REPORT_LABEL);
      if (secondIdx >= 0) errors.push('More than one "گزارش روزانه" section in the daily file (exactly one is allowed).');
      dailyLines = lines.slice(labelIdx + 1).filter((l) => l.trim() !== '');
      bodyText = lines.slice(0, labelIdx).join('\n').replace(/\n\n$/, '\n');
    }
    const dailyCount = lines.filter((l) => l.trim() === DAILY_REPORT_LABEL).length;
    const hasDaily = dailyCount > 0;

    const orderedProjects = sortProjects(doc.projects);
    const nonEmptyProjects = orderedProjects.filter((p) => (p.tasks || []).length > 0);
    // Deterministic expected blocks, mirroring renderTasks exactly.
    const wantSections = []; // one entry per non-empty project
    for (const p of orderedProjects) {
      const tasks = sortTasks(p.tasks);
      if (!tasks.length) continue;
      const sec = [];
      for (const t of tasks) {
        sec.push(p.project ? `${p.project} - ${normalizeText(t.title)}` : normalizeText(t.title));
        const subtasks = sortSubtasks(t.subtasks);
        for (const s of subtasks) sec.push(`${normalizeText(s.title)}\n${normalizeText(s.report)}`);
      }
      wantSections.push(sec);
    }
    // Split the artifact into repository sections on standalone `---` lines.
    const rawSections = [];
    let cur = [];
    for (const l of bodyText.split('\n')) {
      if (l === '---') { rawSections.push(cur); cur = []; }
      else cur.push(l);
    }
    rawSections.push(cur);
    // Drop leading/trailing blank lines per section.
    const trimmedSections = rawSections.map((s) => {
      const a = [...s];
      while (a.length && a[0].trim() === '') a.shift();
      while (a.length && a[a.length - 1].trim() === '') a.pop();
      return a;
    });
    // v3.2.0: when the only project entry is the empty manual scope, the file
    // has no `{Project} - ` prefix on its headings and the Daily Report tail
    // sits directly after the last block — treat that whole remainder as one
    // manual section instead of misclassifying the tail as a second section.
    if (nonEmptyProjects.length === 1 && !nonEmptyProjects[0].project && trimmedSections.length > 1) {
      const merged = [trimmedSections.reduce((acc, sec) => acc.concat(acc.length ? ['', ...sec] : sec), [])];
      trimmedSections.length = 0;
      trimmedSections.push(merged[0]);
    }
    const sepCount = lines.filter((l) => l.trim() === '---').length;
    if (sepCount !== Math.max(nonEmptyProjects.length - 1, 0)) {
      errors.push(`Expected exactly ${Math.max(nonEmptyProjects.length - 1, 0)} "---" separator line(s) for ${nonEmptyProjects.length} repository section(s), found ${sepCount}.`);
    }
    if (trimmedSections.length !== nonEmptyProjects.length) {
      errors.push(`Expected ${nonEmptyProjects.length} repository section(s), found ${trimmedSections.length}; "---" may only appear BETWEEN repository sections.`);
    } else {
      // Per-section verification: heading set + exact block sequence. This
      // detects in-section separators (an extra section), dropped/duplicated
      // tasks, altered headings, and reordered content.
      trimmedSections.forEach((secLines, si) => {
        const want = wantSections[si];
        if (!want) return;
        const proj = nonEmptyProjects[si].project;
        // Artifact blocks are separated by blank lines, mirroring the
        // renderer: heading block, then one block per Work Item.
        const gotBlocks = secLines.join('\n').split(/\n[ \t]*\n/);
        const wantBlocks = want.join('\n\n').split(/\n[ \t]*\n/);
        // Headings present in this section vs expected for this project.
        const wantHeads = wantBlocks.map((b) => b.split('\n')[0]);
        const gotHeads = gotBlocks.map((b) => b.split('\n')[0]);
        if (gotHeads.length !== wantHeads.length || gotHeads.some((h, i) => h !== wantHeads[i])) {
          errors.push(`Repository section "${proj}": task headings do not match the expected \`{Project} - {Task Title}\` set/order.`);
        }
        if (gotBlocks.join('\n\u0000') !== wantBlocks.join('\n\u0000')) {
          errors.push(`Repository section "${proj}": rendered content does not match the tasks document byte-for-byte (Work Item titles/reports must be verbatim; no separator allowed inside a repository section).`);
        }
      });
    }

    // ---- v3.2.0 Daily Report invariants (validated against the artifact) ----
    // Final Tasks in the SAME shared render order used by the renderer and
    // `allocate-hours` — expected daily entries = one per Task.
    const finalTasks = flattenFinalTasks(doc);
    const docHasHours = finalTasks.some(({ task }) => task.hours !== undefined && task.hours !== null);
    if (dailyCount > 1) {
      errors.push(`Expected exactly one "گزارش روزانه" section, found ${dailyCount}.`);
    }
    // Contract: every non-empty successful daily report carries EXACTLY ONE
    // Daily Report section — including Git-only days with no stored hours
    // (hours are then auto-projected via the deterministic equal split).
    if (finalTasks.length > 0 && !hasDaily) {
      errors.push('Rendered file is missing the required single "گزارش روزانه" section.');
    }
    if (finalTasks.length === 0 && hasDaily) {
      errors.push('Rendered file contains a "گزارش روزانه" section but there are no Final Tasks.');
    }
    if (docHasHours && !hasDaily) {
      errors.push('Tasks document carries hour allocations but the rendered file has no "گزارش روزانه" section.');
    }
    if (hasDaily) {
      // The section must be trailing: nothing except blank lines after it.
      const entry = dailyLines || [];
      let wantEntries;
      if (docHasHours) {
        wantEntries = finalTasks.map(({ task }) => {
          const h = task.hours === undefined || task.hours === null ? 0 : Number(task.hours);
          return `${normalizeText(task.title)} - ${formatHours(h)}h`;
        });
      } else {
        // No stored hours -> expected entries use the same deterministic
        // mode-C projection as the renderer (equal split of the hard 7.5h).
        const proj = hoursLib.allocateHours(finalTasks.map(({ task }) => task), []);
        wantEntries = proj.ok
          ? finalTasks.map(({ task }, i) => `${normalizeText(task.title)} - ${formatHours(proj.allocated[i])}h`)
          : null;
        if (!proj.ok) errors.push(...proj.errors);
      }
      if (wantEntries) {
        if (entry.length !== wantEntries.length) {
          errors.push(`Daily Report: expected ${wantEntries.length} entr(y/ies) (one per Final Task), found ${entry.length}.`);
        } else {
          for (let i = 0; i < wantEntries.length; i++) {
            if (entry[i] !== wantEntries[i]) {
              errors.push(`Daily Report line ${i + 1} "${entry[i]}" does not match the stored final Task/hours (${wantEntries[i]}).`);
            }
          }
        }
      }
    }
  }
  const md = markdownHits(text);
  for (const h of md) errors.push(`Markdown/format violation at line ${h.line}: ${h.reason}`);
  const labels = prohibitedLabelHits(text);
  for (const h of labels) errors.push(`Prohibited structural label at line ${h.line}: "${h.text}"`);
  return { ok: errors.length === 0, errors };
}

module.exports = { renderTasks, validateTasksDoc, validateRendered, prohibitedLabelHits, markdownHits, normalizeText, effectiveLimits, PROHIBITED_LABELS, DAILY_REPORT_LABEL, dailyReportLines, sortProjects, sortTasks, sortSubtasks, flattenFinalTasks, cmpStr };
