'use strict';
// Deterministic plain-text renderer + validators for the final report.
// The LLM produces a tasks document (grouping of canonical Work Items);
// this module renders it to genuine .txt and enforces format invariants:
//   - `{Project} - {Task Title}` task headings (project name ONLY there)
//   - subtask lines = Work Item titles verbatim; report text VERBATIM
//   - 3x3 rule, prohibited labels, no Markdown, `---` as only separator

const { MAX_TASKS_PER_REPO, MAX_SUBTASKS_PER_TASK } = require('./workitems');

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
//       "tasks": [ { "title": "...", "subtasks": [ { "title": "...", "report": "..." } ] } ] }
//   ]
// }
// `expected`: optional map project -> array of {title, report} (the validated
// work-items doc) used to prove grouping did not rewrite anything.
// `limits`: optional resolved limits from effectiveLimits(cfg); defaults 3×3.
function validateTasksDoc(doc, expected, limits) {
  const caps = Object.assign({ maxTasksPerRepo: MAX_TASKS_PER_REPO, maxSubtasksPerTask: MAX_SUBTASKS_PER_TASK }, limits || {});
  const errors = [];
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.projects)) {
    errors.push('tasks document must contain a `projects` array.');
    return { ok: false, errors };
  }
  for (const p of doc.projects) {
    const proj = String(p.project || '').trim();
    if (!proj) {
      errors.push('every project entry needs a non-empty `project` name.');
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
function renderTasks(doc) {
  const sections = [];
  const orderedProjects = [...(doc.projects || [])].sort((a, b) =>
    String(a.project).localeCompare(String(b.project))
  );
  for (const p of orderedProjects) {
    const tasks = [...(p.tasks || [])].sort((a, b) =>
      String(a.title).localeCompare(String(b.title))
    );
    const blocks = [];
    for (const t of tasks) {
      const head = `${p.project} - ${normalizeText(t.title)}`;
      const taskBlocks = [head];
      const subtasks = [...(t.subtasks || [])].sort((a, b) =>
        String(a.title).localeCompare(String(b.title))
      );
      for (const s of subtasks) {
        taskBlocks.push(`${normalizeText(s.title)}\n${normalizeText(s.report)}`);
      }
      blocks.push(taskBlocks.join('\n\n'));
    }
    if (blocks.length) sections.push(blocks.join('\n\n'));
  }
  if (sections.length === 0) return '';
  return sections.join('\n\n---\n\n') + '\n';
}

// Validate rendered text (structural pass over the artifact itself).
// v3.1.0 contract: ONE repository section per project; `---` appears ONLY
// between repository sections (exactly N-1 for N non-empty projects) and
// NEVER between two Tasks of the same repository. Headings must be exactly
// `{Project} - {Task Title}` in the deterministic render order; every task
// block's first line after a heading must be a Work Item title line (no
// fabricated or missing blocks).
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
    const orderedProjects = [...(doc.projects || [])].sort((a, b) => String(a.project).localeCompare(String(b.project)));
    const nonEmptyProjects = orderedProjects.filter((p) => (p.tasks || []).length > 0);
    // Deterministic expected blocks, mirroring renderTasks exactly.
    const wantSections = []; // one entry per non-empty project
    for (const p of orderedProjects) {
      const tasks = [...(p.tasks || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
      if (!tasks.length) continue;
      const sec = [];
      for (const t of tasks) {
        sec.push(`${p.project} - ${normalizeText(t.title)}`);
        const subtasks = [...(t.subtasks || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)));
        for (const s of subtasks) sec.push(`${normalizeText(s.title)}\n${normalizeText(s.report)}`);
      }
      wantSections.push(sec);
    }
    // Split the artifact into repository sections on standalone `---` lines.
    const rawSections = [];
    let cur = [];
    for (const l of lines) {
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
  }
  const md = markdownHits(text);
  for (const h of md) errors.push(`Markdown/format violation at line ${h.line}: ${h.reason}`);
  const labels = prohibitedLabelHits(text);
  for (const h of labels) errors.push(`Prohibited structural label at line ${h.line}: "${h.text}"`);
  return { ok: errors.length === 0, errors };
}

module.exports = { renderTasks, validateTasksDoc, validateRendered, prohibitedLabelHits, markdownHits, normalizeText, effectiveLimits, PROHIBITED_LABELS };
