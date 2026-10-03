'use strict';
// Canonical Work Item contract between the existing WORKTRACE Skill and the
// new workflow. The Skill produces Work Items: { title, report } per project.
// Grouping (Tasks) happens ONLY on top of these; reports are reused VERBATIM.
//
// v3.2.0 additive: Manual Work Items. After the frozen Skill has produced the
// Canonical Git Work Items — and BEFORE grouping — the workflow asks the user
// exactly «کار دیگه‌ای امروز نکردی؟». Each meaningful activity the user
// actually mentions becomes a Manual Work Item:
//   { title, report, source: "manual" }
// Manual items carry NO invented details (only what the user said) and join
// the unified Work Items set that feeds the EXISTING grouping flow. Git
// collection itself stays Git-only and unchanged.

const MAX_TASKS_PER_REPO = 3;   // 3x3 rule
const MAX_SUBTASKS_PER_TASK = 3;

const WORK_ITEM_SOURCES = ['git', 'manual'];

// Validate one work item shape. `source` is optional for backward
// compatibility with v3.1 documents (absent => treated as git-sourced).
function checkWorkItem(w, where, errors) {
  if (!w || typeof w !== 'object') {
    errors.push(`${where} is not an object.`);
    return;
  }
  for (const k of ['title', 'report']) {
    if (typeof w[k] !== 'string' || !w[k].trim()) {
      errors.push(`${where}.${k} must be a non-empty string.`);
    }
  }
  if (typeof w.title === 'string' && /\n/.test(w.title)) {
    errors.push(`${where}.title must be single-line.`);
  }
  if (w.source !== undefined && w.source !== null && !WORK_ITEM_SOURCES.includes(w.source)) {
    errors.push(`${where}.source must be one of ${WORK_ITEM_SOURCES.join(' / ')} (got ${JSON.stringify(w.source)}).`);
  }
}

// Input shape produced by the LLM step (Skill invocation):
// {
//   "projects": [
//     {
//       "project": "<must match a collected repository project name>",
//       "workItems": [ { "title": "...", "report": "...", "source"?: "git"|"manual" }, ... ]
//     }, ...,
//     // v3.2.0: manual-only entries use `manual: true` and are NOT required
//     // to match a collected repository; `project: ""` means genuinely
//     // unscoped work — it renders as a bare Task heading (no fake
//     // repository name is ever invented).
//     { "project": "", "manual": true, "workItems": [ { ..., "source": "manual" } ] }
//   ]
// }
function validateWorkItems(doc, collected) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    errors.push('work-items document must be a JSON object.');
    return { ok: false, errors };
  }
  if (!Array.isArray(doc.projects)) {
    errors.push('`projects` must be an array.');
    return { ok: false, errors };
  }
  const collectedNames = collected ? new Set(collected.repositories.map((r) => r.project)) : null;
  const seenProjects = new Set();
  doc.projects.forEach((p, pi) => {
    if (!p || typeof p !== 'object') {
      errors.push(`projects[${pi}] is not an object.`);
      return;
    }
    const isManualEntry = p.manual === true;
    const name = typeof p.project === 'string' ? p.project.trim() : '';
    if (isManualEntry && (p.project === '' || !name)) {
      // valid: unscoped manual entry (empty label)
    } else if (typeof p.project !== 'string' || !name) {
      errors.push(`projects[${pi}].project must be a non-empty string (manual entries may use "").`);
    } else if (seenProjects.has(p.project)) {
      errors.push(`Duplicate project entry: "${p.project}".`);
    } else {
      seenProjects.add(p.project);
      // Manual-only entries are user-declared scopes, not repositories:
      // they are exempt from the collected-repositories check.
      if (!isManualEntry && collectedNames && !collectedNames.has(p.project)) {
        errors.push(`Project "${p.project}" was not among collected repositories (${[...collectedNames].join(', ') || 'none'}).`);
      }
    }
    if (!Array.isArray(p.workItems)) {
      errors.push(`projects[${pi}].workItems must be an array (possibly empty).`);
      return;
    }
    p.workItems.forEach((w, wi) => {
      checkWorkItem(w, `projects[${pi}].workItems[${wi}]`, errors);
      if (isManualEntry && w && typeof w === 'object' && w.source !== 'manual') {
        errors.push(`projects[${pi}].workItems[${wi}]: items inside a manual-only entry must have source "manual".`);
      }
    });
  });
  return { ok: errors.length === 0, errors };
}

// v3.2.0: append validated Manual Work Items to the canonical Git Work Items
// document, producing the UNIFIED set that feeds the existing grouping flow.
// - No manual items (user answered «نه») => returns the git document unchanged
//   (same content, new object; no empty manual entry is fabricated).
// - Manual activities may group with each other under a shared label; a
//   genuinely unscoped activity keeps its own honest label (never a fake repo).
// manualItems: [{ title, report, source: 'manual', project? }]
function mergeManualWorkItems(gitDoc, manualItems) {
  const doc = JSON.parse(JSON.stringify(gitDoc || { projects: [] }));
  const items = Array.isArray(manualItems) ? manualItems.filter((m) => m && String(m.title || '').trim() && String(m.report || '').trim()) : [];
  if (items.length === 0) return doc;
  const byProject = new Map();
  for (const p of doc.projects) byProject.set(p.project, p);
  // Group the user's activities by their OWN explicit labels only (the order
  // in which the user mentioned them is preserved). Nothing here infers a
  // shared scope from repo/domain/technology/date/team/topic similarity —
  // two activities land under one label ONLY because the user said so.
  const groups = new Map(); // label -> [items]
  for (const m of items) {
    const label = String(m.project || '').trim();
    const item = { title: String(m.title).trim(), report: String(m.report).trim(), source: 'manual' };
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  for (const [label, groupItems] of groups) {
    // A manual item may attach to an existing git project ONLY when the
    // user explicitly named that relationship (`project` equals a collected
    // repository name). No inference, ever.
    const target = label ? byProject.get(label) : undefined;
    if (target) {
      target.workItems.push(...groupItems);
    } else {
      // Genuinely unscoped manual work: keep the user's own words as the
      // entry label (or "" => bare section at render time). NEVER invent a
      // fake repository name.
      const entry = { project: label, manual: true, workItems: groupItems };
      doc.projects.push(entry);
      byProject.set(label, entry);
    }
  }
  return doc;
}

module.exports = { validateWorkItems, mergeManualWorkItems, checkWorkItem, WORK_ITEM_SOURCES, MAX_TASKS_PER_REPO, MAX_SUBTASKS_PER_TASK };
