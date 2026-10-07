# Task Grouping Rules (post-Work-Item layer)

Grouping happens ONLY after Canonical Work Items exist and passed
`validate-workitems` — and, since v3.2.0, AFTER the manual-work question
(«کار دیگه‌ای امروز نکردی؟») has been asked and the unified set
(Git Work Items + Manual Work Items) has been produced by `merge-manual`.
Input: `[{title, report}, ...]` per project. Output: at
most 3 Tasks per project, each with at most 3 Subtasks (defaults; the caps are
configuration-driven — see §3×3 rule). The grouping decision is
LLM judgment; the limits and verbatim preservation are machine-enforced by
`tools/bin/render.js validate-tasks`.

## Manual Work Items (v3.2.0)

Manual items enter the SAME unified document as Git items and follow every
existing rule above. Additional constraints specific to manual work:

- A Manual Work Item may group with a Git Work Item ONLY when the user's own
  description or evidence supports the relationship. It NEVER groups merely
  because of a shared repository, domain, technology, date, team or topic —
  that is already prohibited for Git items and applies with extra force here,
  because manual context is what the user SAID, not what the repo shows.
- Genuinely unscoped manual work keeps its own honest section/Task label (the
  user's words). Do NOT invent a fake repository name for it.
- Meeting / discussion / review / investigation / documentation / planning /
  coordination activities become Manual Work Items using ONLY details the user
  actually provided. No invented participants, durations, decisions or outcomes.
- Existing Git Work Item reports are untouched by merging or grouping.

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

### Task-title value rule (explicit — enforced by the split/merge re-audit)

Every generated **Task title** MUST communicate the engineering **outcome/value**
it delivers — not merely the activity performed or the chore done. The title is
answer to the CTO question "what is now possible or different in the system?".
A Task title that only names an activity (packaging, moving, cleaning up,
"doing X") is REJECTED and must be rewritten to state the value of the work.
When the work is a from-scratch implementation, its title MUST describe the
capability that now exists; it MUST NOT be labeled a refactor/rework merely
because it replaced an older implementation (new build != redesign).

Good (outcome/value in the title):
- `توسعه Skill تبدیل طراحی Figma به سناریوهای تست QA`
- `افزودن اجرای قابل نصب برای تولید گزارش روزانه`
- `ایجاد جریان یکپارچه تولید و ثبت گزارش کاری`

Bad (activity/chore-only, rejected):
- `بسته‌بندی Skill` (packaging chore; the value is "daily report is installable/runnable")
- `بازطراحی معماری` (implies rework; if it was built from scratch, name the capability)
- `انجام تغییرات` / `رفع مشکلات` / `Refactor ...` (no outcome stated)

This rule is checked during the final split/merge re-audit: any Task whose
title fails it is retitled before the document is validated and rendered.
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
