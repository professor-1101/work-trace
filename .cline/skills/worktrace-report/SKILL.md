---
name: worktrace-report
description: >
  Orchestration workflow that produces the daily WORKTRACE report file. Use when
  the user invokes /report, asks for "the daily report", "گزارش روز", a WORKTRACE
  run, or an automated engineering-day report across all configured repositories.
  This skill does NOT define reporting semantics: it collects git evidence with
  deterministic tools, then MUST invoke the existing `worktrace-daily-report`
  Skill (the validated reporting engine) to produce Canonical Work Items, groups
  those Work Items into Tasks, validates the 3x3 rule and plain-text format with
  deterministic scripts, and persists the report to the configured date path.
  SKIP for ad-hoc commit questions (answer directly or use worktrace-daily-report
  alone). Instructions are English; report language follows configuration/user.
metadata:
  author: work-trace
  version: "3.2.0"
compatibility: Requires Cline (Skills + terminal), Node.js >= 18, git on PATH, and a worktrace.yaml configuration. Cross-platform (Linux/Windows).
---

# WORKTRACE /report — Orchestration Workflow

Pipeline (fixed order — never skip or reorder a validation step):

```text
/report
 -> load/validate config            (tools/bin/collect.js does this)
 -> resolve today + timezone        (deterministic, from config)
 -> discover repositories           (deterministic)
 -> collect today's evidence        (deterministic JSON, Git-only)
 -> INVOKE worktrace-daily-report SKILL on the evidence   <-- semantic engine
 -> obtain Canonical Git Work Items ({title, report} per project, JSON)
 -> validate Work Items             (tools/bin/render.js validate-workitems)
 -> ASK USER «کار دیگه‌ای امروز نکردی؟»   (manual work intake — BEFORE grouping)
 -> merge Manual Work Items         (tools/bin/render.js merge-manual)
 -> group unified Work Items into Tasks (LLM judgment, rules in docs/grouping.md)
 -> validate grouping + 3x3         (tools/bin/render.js validate-tasks)
 -> ASK Task hours AFTER final Tasks (three modes; deterministic allocation)
 -> allocate hours                 (tools/bin/render.js allocate-hours)
 -> render plain text               (tools/bin/render.js render)
 -> validate output                 (tools/bin/render.js check)
 -> persist report                  (tools/bin/render.js persist — final gate)
```

## Hard invariants

1. The `worktrace-daily-report` Skill is the ONLY source of Work Item meaning
   and report prose. Do not paraphrase commits yourself, do not reuse its
   rules inline, do not "simplify" its output. Load it via the Skills mechanism
   (`use_skill`) exactly as any other skill.
2. Grouping operates ONLY on finished Canonical Work Items. Task titles are new
   short labels; subtask title = Work Item title VERBATIM; subtask body =
   Work Item report VERBATIM (byte-for-byte, including line breaks inside the
   paragraph). Never rewrite, shorten, merge or translate a Work Item report
   during or after grouping.
3. All formatting/storage decisions below are enforced by deterministic scripts;
   if a script says FAIL, fix your document — never edit the scripts' verdict
   and never hand-write the final file bypassing `render` + `check`.
4. Final artifact is genuine plain text (no Markdown, no labels, only `---`
   separators). See docs/output-format.md.

## Step-by-step procedure

### 1. Collect evidence (deterministic)

Run from the workspace root (the directory containing `worktrace.yaml`; if the
user keeps global config, pass `--config` or rely on `$WORKTRACE_CONFIG`):

```bash
node tools/bin/collect.js --out .worktrace/evidence.json
```

- Non-zero exit => show the stderr reason to the user and STOP. Do not invent
  evidence.
- Zero commits everywhere => write an EMPTY report file for the day via
  `persist` with an empty tasks document (see step 6) and tell the user the
  file contains nothing because there were no commits today. That is a valid,
  deterministic outcome.
- Inspect `discovery.nested` / `discovery.ignored` in the JSON: mention nested
  repositories to the user once per run so double-counted outcomes can be
  reviewed.

### 2. Produce Canonical Work Items (LLM — the existing Skill)

Activate the `worktrace-daily-report` skill and feed it the FULL evidence JSON
(read `.worktrace/evidence.json`). Follow every rule of that skill (evidence
rules, Persian editorial rules when the configured report language is Persian,
acceptance tests, final split/merge re-audit). Then emit, per project that has
commits, the canonical list:

```json
{
  "projects": [
    {
      "project": "<exact value of repositories[i].project from evidence>",
      "workItems": [
        { "title": "<outcome-oriented Work Item title>", "report": "<final report text>" }
      ]
    }
  ]
}
```

Save it as `.worktrace/work-items.json`. Rules:
- `report` is the deliverable narrative paragraph(s) only — no headings, no
  Markdown, no commit hashes, no bullet lists.
- One entry per independent engineering outcome, exactly as the Skill decided.
  Do not pre-group here.

Validate:

```bash
node tools/bin/render.js validate-workitems --evidence .worktrace/evidence.json --work-items .worktrace/work-items.json
```

Fix and re-run until OK.

### 2b. Manual work intake (BEFORE grouping) — exact question

After the Canonical Git Work Items are validated, ask the user EXACTLY this
single question (verbatim, in Persian):

`کار دیگه‌ای امروز نکردی؟`

- The Git collector stays Git-only; nothing about manual work touches it.
- If the user says no (نه / no / nothing): skip merging entirely — there are
  NO Manual Work Items and the git document proceeds to grouping unchanged.
- If the user says yes: convert each MEANINGFUL activity the user actually
  mentions into one Manual Work Item. Meetings, discussions, code reviews,
  investigations, documentation, planning, coordination and similar activities
  qualify. Do NOT invent details: title and report come ONLY from what the
  user said. Do NOT require structured or JSON input from the user — you
  transcribe their own words into the internal shape:

  ```json
  [
    { "title": "<short label of the activity as described>",
      "report": "<what the user actually said about it>",
      "project": "<OPTIONAL: only if the user explicitly tied it to a repository>" }
  ]
  ```

  Save as `.worktrace/manual.json` (a bare array, or `{ "items": [...] }`).

- Merge (unified set = Git Work Items + Manual Work Items). This MUST happen
  before grouping:

```bash
node tools/bin/render.js merge-manual --evidence .worktrace/evidence.json --work-items .worktrace/work-items.json --manual .worktrace/manual.json --out .worktrace/work-items.json
```

Grouping rules for manual work:
- A Manual Work Item may group with a Git Work Item ONLY when the user's own
  description/evidence supports the relationship. Shared repository name,
  domain, technology, date, team or topic is NEVER sufficient grounds to
  group. When in doubt, keep them separate.
- Genuinely unscoped manual work keeps an honest label (the user's own words,
  or `""` for a bare section). Never invent a fake repository for it.
- Existing Git Work Item reports are never changed by merging.

### 3. Group into Tasks (LLM judgment, post-Work-Item only)

Read [docs/grouping.md](docs/grouping.md). Group each project's Work Items
(Git AND Manual, from the unified document) into at most 3 Tasks (each Task
at most 3 Subtasks). Write `.worktrace/tasks.json`:

```json
{
  "projects": [
    {
      "project": "alpha",
      "tasks": [
        { "title": "<short task label WITHOUT the project name>",
          "subtasks": [ { "title": "<WI title verbatim>", "report": "<WI report verbatim>" } ] }
      ]
    }
  ]
}
```

### 4. Validate grouping + 3x3 (deterministic)

```bash
node tools/bin/render.js validate-tasks --work-items .worktrace/work-items.json --tasks .worktrace/tasks.json --evidence .worktrace/evidence.json --config worktrace.yaml
```

This proves every Work Item appears exactly once with byte-identical title and
report, and enforces the configured grouping caps (`limits.maxTasksPerRepository`
/ `limits.maxSubtasksPerTask`, defaults 3 Tasks / 3 Subtasks). If a project
genuinely has more independent outcomes than the configured capacity allows and
they cannot be coherently grouped, DO NOT drop or fabricate merges to force the
cap — stop, report the failure to the user naming the project and the offending
Work Items, and leave the previous day's file untouched (documented behavior,
see docs/grouping.md §Overflow).

### 4b. Task hours (AFTER final Tasks are determined)

Only after grouping is VALIDATED and the final Task set is fixed, ask the
user for per-Task hours. Present the final Task list and ask once. Three
supported answer modes:

- A. ALL SPECIFIED — the user gives a value for every Task
  (`A=2h B=3h C=1.5h`). Preserve the exact user values; do NOT fill unused
  time (a total below the daily budget is valid).
- B. PARTIAL + BALANCE — the user gives values for some Tasks; the rest get
  an equal share of `remaining = dailyTotal - explicitTotal` (dailyTotal is
  the HARD product invariant 7.5h — NOT configurable by worktrace.yaml).
- C. NONE SPECIFIED — split the full daily total equally across all final
  Tasks.

Hard rules (enforced deterministically by `allocate-hours`, never by you):
explicit values are preserved exactly; no silent clipping or reduction;
explicit total > daily limit => REJECT and tell the user; hours must be
finite numbers >= 0; rounding is deterministic. If there are no final Tasks,
hour collection is skipped entirely.

Transcribe the user's answers into a JSON array aligned with the FINAL task
order printed below, using `null` for unspecified Tasks:

```bash
# Print the deterministic final-task order (projects alphabetical, tasks
# alphabetical within project) so the allocation array aligns correctly:
node tools/bin/render.js task-order --tasks .worktrace/tasks.json
# Allocate (writes hours into tasks.json; rejects invalid input loudly):
node tools/bin/render.js allocate-hours --tasks .worktrace/tasks.json --alloc '[2,3,null]' --config worktrace.yaml --out .worktrace/tasks.json
```

Never hand-edit hour values in `tasks.json`; never redistribute hours
yourself. The script is the single source of hour arithmetic.

### 5. Render + check plain text (deterministic)

```bash
node tools/bin/render.js render --tasks .worktrace/tasks.json --out .worktrace/report.txt
node tools/bin/render.js check --file .worktrace/report.txt --tasks .worktrace/tasks.json
```

`check` rejects Markdown, prohibited structural labels, wrong separators and
headings not shaped `{Project} - {Task Title}`. Fix `tasks.json` (never the
rendered file) until OK.

When the tasks document carries hour allocations, the SAME rendered file also
contains exactly ONE trailing Daily Report section:

```text
گزارش روزانه
{Task title} - {exact final hours}h
```

- Exactly one short line per FINAL Task (grounded task label + exact stored
  hours), generated from Final Tasks only — it never re-runs Git analysis and
  never rewrites Work Item reports.
- No `---` separator is added for this section; `---` remains exclusively the
  between-repository separator.
- There is exactly ONE daily output file (`{root}/YYYY/MM/DD/report.txt`).
  Never create a second report file or a second daily-report flow.

### 6. Persist (deterministic, atomic, final validation gate)

```bash
node tools/bin/render.js persist --tasks .worktrace/tasks.json --work-items .worktrace/work-items.json
```

`persist` is the final gate: it re-validates the grouping contract, verbatim
Work Item preservation (Git AND Manual), the configured 3×3 limits, stored
Task hours (finite, >= 0, total <= daily limit), renders, validates the
rendered document invariants INCLUDING exactly one Daily Report section with
one entry per Final Task whose hours match the stored Task hours, and only
then writes atomically. Invalid grouped output can never reach storage — the
existing day's file stays untouched.

Writes to the configured layout `{root}/YYYY/MM/DD/report.txt` under
`reportRoot`, auto-creating directories; re-running atomically replaces the
day's file (last run wins; no accumulation). Print the absolute path to the
user.

For the zero-commit case:

```bash
echo '{"projects":[]}' > .worktrace/tasks.json
node tools/bin/render.js persist --tasks .worktrace/tasks.json
```

## Failure policy

- Any script exiting non-zero aborts the run with the script's message shown
  verbatim. Never hand-craft the final report to bypass a failing validator.
- Broken repositories reported by the collector are real failures: surface them
  (path + reason) and let the user fix discovery config or the repo.
- Intermediate artifacts live under `.worktrace/` (git-ignored by convention);
  they are overwritten on every run, keeping reruns deterministic.

## Reference files

- [docs/grouping.md](docs/grouping.md) — Task grouping rules, 3x3, overflow behavior.
- [docs/output-format.md](docs/output-format.md) — exact plain-text contract.
