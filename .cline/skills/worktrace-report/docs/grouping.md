# Task Grouping Rules (post-Work-Item layer)

Grouping happens ONLY after Canonical Work Items exist and passed
`validate-workitems`. Input: `[{title, report}, ...]` per project. Output: at
most 3 Tasks per project, each with at most 3 Subtasks (defaults; the caps are
configuration-driven — see §3×3 rule). The grouping decision is
LLM judgment; the limits and verbatim preservation are machine-enforced by
`tools/bin/render.js validate-tasks`.

## What a Task is

A Task is one coherent engineering objective that several Work Items jointly
tell. Group Work Items when they share:

- a common engineering outcome ("the release pipeline became dependable"), or
- one coherent engineering objective ("checkout rewritten to reduce lock
  contention" — parser change + index change + tests), or
- a meaningful reader-level relationship: a CTO reading the Task title can
  predict why these outcomes belong together, or
- one coherent story arc (feature + its hardening + its docs, when the docs
  exist only because of that feature).

## What never justifies grouping

Never group merely because items share:

- the repository (that is what projects already are);
- a domain or feature area ("all UI things");
- a layer (frontend / backend / test / docs);
- a PR, branch, commit or file set;
- a library or dependency;
- the date.

Shared context ≠ shared outcome. If two Work Items deliver independently
meaningful outcomes, they stay separate subtasks even inside one Task; if their
relationship cannot be stated as one objective without the word "and" doing
heavy lifting, prefer separate Tasks.

## Titles

- Existing Work Item titles become Subtask titles VERBATIM. Do not retitle,
  shorten or translate them.
- Existing Work Item report text is reused VERBATIM (byte-for-byte). Grouping
  must never rewrite, shorten, merge, paraphrase or semantically alter it.
- Task titles are new, short, outcome-level labels WITHOUT the project name
  (the renderer prepends `{Project} - ` deterministically). No dates, no counts,
  no planning labels.

## 3×3 rule

- Maximum 3 Tasks per repository/project (`limits.maxTasksPerRepository`).
- Maximum 3 Subtasks per Task (`limits.maxSubtasksPerTask`).
- Both caps are configuration-driven; defaults are 3 and 3. Valid overrides
  must be positive integers (rejected at config load otherwise), and the
  validator + persist gate consume the configured values — never a
  hard-coded constant.
- Never destroy independent outcomes to satisfy the limit (no dropping, no
  fabricating "shared objectives", no merging reports into one paragraph).

### Overflow (>9 genuinely independent outcomes that cannot be coherently grouped)

The validator FAILS the run (`validate-tasks` exits non-zero with an explicit
message naming the project and count). Documented behavior:

1. First legitimate fix: re-examine whether some items truly share one outcome
   (the Skill's split/merge re-audit may have left over-splits) — regroup only
   on genuine outcome identity, never on domain/layer/PR similarity.
2. If all outcomes remain independent: STOP. Report to the user: project name,
   number of Work Items, the list of titles, and that the daily file was NOT
   written for this project. Do not silently truncate, do not write a partial
   report, do not edit the scripts' limits ad hoc.
3. The failure is detectable in three places: the non-zero exit code, the
   `.worktrace/tasks.json` that failed validation (kept on disk), and the
   console message quoted back to the user.

## Ordering

Subtask order inside a Task is decided by the workflow author, but the renderer
sorts Tasks and Subtasks alphabetically by title to keep repeated `/report`
runs deterministic regardless of LLM output ordering.
