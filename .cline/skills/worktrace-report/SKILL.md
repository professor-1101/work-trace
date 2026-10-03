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
  version: "3.1.0"
compatibility: Requires Cline (Skills + terminal), Node.js >= 18, git on PATH, and a worktrace.yaml configuration. Cross-platform (Linux/Windows).
---

# WORKTRACE /report — Orchestration Workflow

Pipeline (fixed order — never skip or reorder a validation step):

```text
/report
 -> load/validate config            (tools/bin/collect.js does this)
 -> resolve today + timezone        (deterministic, from config)
 -> discover repositories           (deterministic)
 -> collect today's evidence        (deterministic JSON)
 -> INVOKE worktrace-daily-report SKILL on the evidence   <-- semantic engine
 -> obtain Canonical Work Items     ({title, report} per project, JSON)
 -> validate Work Items             (tools/bin/render.js validate-workitems)
 -> group Work Items into Tasks     (LLM judgment, rules in docs/grouping.md)
 -> validate grouping + 3x3         (tools/bin/render.js validate-tasks)
 -> render plain text               (tools/bin/render.js render)
 -> validate output                 (tools/bin/render.js check)
 -> persist report                  (tools/bin/render.js persist)
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

### 3. Group into Tasks (LLM judgment, post-Work-Item only)

Read [docs/grouping.md](docs/grouping.md). Group each project's Work Items into
at most 3 Tasks (each Task at most 3 Subtasks). Write `.worktrace/tasks.json`:

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

### 5. Render + check plain text (deterministic)

```bash
node tools/bin/render.js render --tasks .worktrace/tasks.json --out .worktrace/report.txt
node tools/bin/render.js check --file .worktrace/report.txt --tasks .worktrace/tasks.json
```

`check` rejects Markdown, prohibited structural labels, wrong separators and
headings not shaped `{Project} - {Task Title}`. Fix `tasks.json` (never the
rendered file) until OK.

### 6. Persist (deterministic, atomic, final validation gate)

```bash
node tools/bin/render.js persist --tasks .worktrace/tasks.json --work-items .worktrace/work-items.json
```

`persist` is the final gate: it re-validates the grouping contract, verbatim
Work Item preservation, the configured 3×3 limits, renders, validates the
rendered document invariants, and only then writes. Invalid grouped output can
never reach storage.

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
