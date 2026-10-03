'use strict';
// Canonical Work Item contract between the existing WORKTRACE Skill and the
// new workflow. The Skill produces Work Items: { title, report } per project.
// Grouping (Tasks) happens ONLY on top of these; reports are reused VERBATIM.

const MAX_TASKS_PER_REPO = 3;   // 3x3 rule
const MAX_SUBTASKS_PER_TASK = 3;

// Input shape produced by the LLM step (Skill invocation):
// {
//   "projects": [
//     {
//       "project": "<must match a collected repository project name>",
//       "workItems": [ { "title": "...", "report": "..." }, ... ]
//     }, ...
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
    if (typeof p.project !== 'string' || !p.project.trim()) {
      errors.push(`projects[${pi}].project must be a non-empty string.`);
    } else if (seenProjects.has(p.project)) {
      errors.push(`Duplicate project entry: "${p.project}".`);
    } else {
      seenProjects.add(p.project);
      if (collectedNames && !collectedNames.has(p.project)) {
        errors.push(`Project "${p.project}" was not among collected repositories (${[...collectedNames].join(', ') || 'none'}).`);
      }
    }
    if (!Array.isArray(p.workItems)) {
      errors.push(`projects[${pi}].workItems must be an array (possibly empty).`);
      return;
    }
    p.workItems.forEach((w, wi) => {
      if (!w || typeof w !== 'object') {
        errors.push(`projects[${pi}].workItems[${wi}] is not an object.`);
        return;
      }
      for (const k of ['title', 'report']) {
        if (typeof w[k] !== 'string' || !w[k].trim()) {
          errors.push(`projects[${pi}].workItems[${wi}].${k} must be a non-empty string.`);
        }
      }
      if (typeof w.title === 'string' && /\n/.test(w.title)) {
        errors.push(`projects[${pi}].workItems[${wi}].title must be single-line.`);
      }
    });
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { validateWorkItems, MAX_TASKS_PER_REPO, MAX_SUBTASKS_PER_TASK };
