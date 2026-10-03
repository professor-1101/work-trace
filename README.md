# WORKTRACE v3.2.0

Engineering evidence → daily engineering report, driven by Cline Skills and a
deterministic Node.js workflow layer. Cross-platform (Linux + Windows).

## Architecture

Two strictly separated layers:

1. **Frozen semantic engine** — `.cline/skills/worktrace-daily-report/**`
   The validated reporting Skill: Git evidence → engineering meaning →
   Canonical Work Items → Persian report text. It is NOT modified by the
   workflow layer; its semantics live only here.
2. **Workflow/orchestration layer** — everything else:
   - `.cline/skills/worktrace-report/SKILL.md` — the `/report` orchestration
     Skill. Contains no semantic logic; it invokes the frozen Skill via
     Cline's `use_skill` mechanism and sequences deterministic tools.
   - `.clinerules/worktrace-workflow.md` — routing rule so `/report` loads
     the workflow Skill.
   - `tools/` — deterministic Node.js tools (no Bash/GNU-date dependency):
     - `tools/bin/collect.js` — repository discovery + same-day commit
       evidence collection → JSON.
     - `tools/bin/render.js` — Work Item contract validation, grouping
       (configurable 3×3) validation, plain-text rendering, output checking,
       and the persist validation gate.
     - `tools/lib/*` — shared modules (config, git, time, render, storage,
       workitems, yaml subset parser, version).
   - `config/worktrace.example.yaml` — configuration schema template.
   - `scripts/install.js` — idempotent cross-platform installer/updater.

Primary flow (`/report`):

```text
/report
 -> load configuration            (deterministic)
 -> resolve timezone/date         (deterministic, IANA tz via Intl)
 -> discover repositories         (deterministic)
 -> collect Git evidence          (deterministic JSON)
 -> invoke frozen semantic Skill  (LLM: Canonical Work Items {title, report})
 -> validate Work Items           (deterministic)
 -> ask «کار دیگه‌ای امروز نکردی؟» (manual work intake, BEFORE grouping)
 -> merge Manual Work Items       (deterministic merge; unified set)
 -> group Work Items into Tasks   (LLM judgment ONLY)
 -> validate grouping + 3x3       (deterministic, config-driven limits)
 -> ask Task hours AFTER final Tasks -> deterministic allocation (<= 7.5h)
 -> render final plain text       (deterministic; adds one Daily Report section)
 -> validate rendered document    (deterministic)
 -> persist atomically            (deterministic; final validation gate)
```

Deterministic steps are always run through the tools; the only LLM judgment
is grouping already-produced Canonical Work Items into meaningful Tasks.

## Prerequisites

- Cline with Skills support (project skills under `.cline/skills/`).
- Node.js ≥ 18 (no other runtime dependency; `git` must be on PATH).
- Works on Linux and Windows; all paths normalized by Node.

## Installation / update

```bash
node scripts/install.js [--target <dir> | --global]   # install
node scripts/install.js --check                        # report installed version
node scripts/install.js --update                       # upgrade installed Skills+tools
```

- Idempotent; installs BOTH Skills (`worktrace-daily-report`,
  `worktrace-report`), the `tools/` layer, and a `worktrace.yaml` template.
- Never overwrites an existing user `worktrace.yaml` (reports "kept existing").
- Writes a version marker at `<target>/.cline/worktrace/version` and a
  managed-file manifest at `<target>/.cline/worktrace/manifest.json`
  (SHA-256 of every installer-managed file — powers `--update`).

### Skill updates (`--update`)

`--update` compares the COMPLETE Skill directories (not only `SKILL.md`)
for both Skills, plus `tools/`:

| Situation                              | Behavior                                             |
|----------------------------------------|------------------------------------------------------|
| unchanged source file                  | untouched (no writes)                                 |
| changed source file                    | installed copy updated                                |
| locally modified installed file        | CONFLICT — never silently overwritten; exit code 3    |
| source file removed                    | deleted only if installer-managed AND unmodified      |
| removed-from-source but locally edited | kept untouched and reported                            |
| files never managed by the installer   | always left alone                                     |
| user `worktrace.yaml`                  | never touched by any mode                             |
| repeated `--update`                    | idempotent ("unchanged")                              |

Exit codes: 0 success · 3 conflicts detected (nothing overwritten).

## Configuration

`config/worktrace.example.yaml` is the authoritative schema (v1). Search
order for the active config: `--config` flag → `$WORKTRACE_CONFIG` →
`./worktrace.yaml` → `~/.cline/worktrace/worktrace.yaml`.

Key fields: `projectsRoot`, `reportRoot`, `timezone` (IANA),
`date.behavior` (`today` or `offset:<N>`), `discovery.*` (maxDepth,
followSymlinks, skipDirs, include/exclude/ignore, nameOverrides),
`limits.*` (collection caps AND grouping caps), `output.layout`.

Grouping limits (configuration-driven; defaults 3×3):

```yaml
limits:
  maxTasksPerRepository: 3   # positive integer
  maxSubtasksPerTask: 3      # positive integer
```

Invalid values (zero, negative, non-integer) are rejected at config load.
The validator and the persist gate consume the configured values. If truly
independent outcomes exceed the cap and cannot be coherently grouped, the run
FAILS LOUDLY naming the affected project — Work Items are never silently
dropped and outcomes are never fabricated to fit the cap.

Daily hours (v3.2.0): the total-hours ceiling of **7.5h** is a HARD product
invariant owned by `tools/lib/hours.js` (`DAILY_TOTAL_HOURS`). It is NOT a
configuration key — setting `limits.dailyTotalHours` in `worktrace.yaml` is
rejected at config load, and no CLI flag can raise it above 7.5h.

## Repository discovery & date behavior

- `collect.js` walks `projectsRoot` up to `discovery.maxDepth`, recognizing
  `.git` directories and `.git` files (worktrees/submodules), skipping
  configured dirs, honoring include/exclude/ignore, deduplicating by realpath,
  supporting detached HEAD, empty/broken/inaccessible repos, and applying
  `limits.maxRepos` etc.
- "Today" is the configured IANA calendar day; commits are matched by
  **committer date** inside the exact half-open range `[dayStart, dayNextStart)`
  computed with `Intl` (DST-correct, no GNU `date`).
- Evidence preserved per commit: full message, hash, author/committer dates,
  stat/diff (within configured byte/file budgets, truncation flagged),
  merge/revert/bot flags. One line per commit is never the contract.

## Canonical Work Items & grouping

The frozen Skill emits `[{title, report}, ...]` per project — each item one
independent engineering outcome. Grouping (Tasks) happens only afterwards and
only by reader-centered LLM judgment (CTO/EM/Tech Lead who doesn't know the
repos). Shared repository/domain/layer/PR/commit/files/library/date alone
never justify a merge.

Preservation rule: after grouping, the Work Item title becomes the Subtask
title and the report is reused VERBATIM (byte-for-byte). The validator detects
rewritten reports, dropped items, duplicated items, and altered titles.

### Manual Work Items (v3.2.0)

After the Canonical Git Work Items are validated — and BEFORE grouping — the
orchestration Skill asks the user exactly:

`کار دیگه‌ای امروز نکردی؟`

- The Git collector stays Git-only; manual work never touches it.
- "No" → no Manual Work Items; the git document proceeds unchanged.
- "Yes" → every meaningful activity the user actually mentions (meeting,
  discussion, review, investigation, documentation, planning, coordination,
  …) becomes one Manual Work Item `{ title, report, source: "manual" }`.
  No structured/JSON input is required from the user; nothing is invented.
- Merge is deterministic (`render.js merge-manual`): Git + Manual items form
  the unified set feeding the EXISTING grouping flow. A Manual Work Item may
  group with a Git Work Item ONLY when the user's own description supports
  the relationship — shared repo/domain/technology/date/team/topic is never
  sufficient grounds. Genuinely unscoped manual work keeps an honest label
  (or an empty scope rendered as a bare Task heading); no fake repository is
  ever invented. Existing Git Work Item reports are never changed.

### Hours (v3.2.0)

Task hours are collected ONLY after final Tasks are determined, in three
modes (deterministic arithmetic in `tools/lib/hours.js`, never LLM judgment):

- **A. All specified** (`A=2h B=3h C=1.5h`) — exact user values preserved;
  unused time is NOT filled.
- **B. Partial + balance** — `remaining = 7.5 − explicitTotal` split equally
  and deterministically among unspecified Tasks.
- **C. None specified** — the full 7.5h split equally across all final Tasks.

Hard rules: total ≤ 7.5h (absolute product invariant — not configurable),
hours ≥ 0 finite numbers only, explicit values preserved, no silent clipping
or reduction, explicit total > 7.5 → rejected, deterministic rounding, no
final Tasks → hour collection skipped. Hours never influence grouping.

## Output format

Final artifact is plain `.txt` — no Markdown, bullets, numbering, tables,
emojis, or structural labels ("Task 1", "Subtask", "Repository", "Project",
"Report" as labels are rejected).

- Task heading: `{Project Name} - {Task Title}` (project name appears ONLY
  in task headings, never on subtasks).
- One section per repository; `---` separator ONLY between repository
  sections — for N repositories exactly N−1 separators, none inside a
  section.
- Empty day → empty file. Ordering deterministic (project, then task, then
  subtask title).

### Daily Report (v3.2.0)

There is exactly ONE daily output file (`{root}/YYYY/MM/DD/report.txt`). When
the tasks document carries hour allocations, the SAME file gains exactly one
trailing section:

```text
گزارش روزانه
{Task title} - {exact final hours}h
```

- Exactly one short entry per FINAL Task (grounded task label + exact stored
  hours), generated from Final Tasks only — it never re-runs Git analysis and
  never rewrites Work Item reports.
- No `---` separator is added for this section; `---` remains exclusively the
  between-repository separator.
- No second report file, no `daily-report.txt`, no second daily-report flow.

## Storage

`{reportRoot}/YYYY/MM/DD/report.txt` (config-driven `output.layout`). Missing
directories are created; writes are atomic (temp file + rename); reruns
overwrite cleanly (last run wins, no duplicate daily files).

**Persist gate:** `persist` re-validates grouping contract, verbatim Work
Item preservation (Git AND Manual), configured 3×3 limits, stored Task hours
(finite, ≥ 0, total ≤ hard 7.5h ceiling), and rendered invariants — including
exactly one Daily Report section with one entry per Final Task whose hours
match the stored Task hours — before any write. Invalid grouped output can
never reach storage; the existing day's file stays untouched.

## Versioning

Single authoritative source: `tools/lib/version.js`. Derived locations kept
in sync (enforced by tests): `VERSION`, `tools/package.json`,
the `worktrace-report` Skill metadata, the
installer marker, and the current `CHANGELOG.md` entry. Historical changelog
entries remain historical. Current release: **3.2.0**.

## Legacy removal

The former single-file reading copy (`WORKTRACE-ALL-IN-ONE.md`) and its
generator (`scripts/build-all-in-one.sh`) were removed in 3.1.0. They must not
be recreated; read the documentation from its source files. Only historical
CHANGELOG entries reference them.

## CLI quick reference

```bash
node tools/bin/collect.js --config worktrace.yaml > evidence.json
node tools/bin/render.js validate-workitems --evidence evidence.json --work-items work-items.json
node tools/bin/render.js merge-manual --evidence evidence.json --work-items work-items.json --manual manual.json --out work-items.json
node tools/bin/render.js task-order --tasks tasks.json
node tools/bin/render.js validate-tasks --work-items work-items.json --tasks tasks.json [--config worktrace.yaml]
node tools/bin/render.js allocate-hours --tasks tasks.json --alloc '[2,3,null]' --out tasks.json
node tools/bin/render.js render --tasks tasks.json --out report.txt
node tools/bin/render.js check --file report.txt --tasks tasks.json
node tools/bin/render.js persist --tasks tasks.json --config worktrace.yaml [--date YYYY-MM-DD] [--work-items work-items.json]
```

Exit codes: 0 ok · 1 validation failure · 2 usage/config error.
The daily hour ceiling is a hard product invariant (total hours <= 7.5h):
it is not configurable and no CLI flag may raise or lower it.

## Development / testing

```bash
cd tools && npm install && npm test   # node --test, no network needed
```

Tests cover discovery, nested/symlinked repos, include/exclude, date/DST
boundaries, merges/reverts, verbatim preservation (rewrite/drop/duplicate),
configurable limits + overflow, output invariants + separator semantics,
storage/idempotence, installer/update, version consistency, E2E CLI workflow,
and the persist gate.

## Troubleshooting

- "No worktrace.yaml found" → create one from `config/worktrace.example.yaml`
  or set `$WORKTRACE_CONFIG`.
- Collection reports broken/inaccessible repos → fix repo access or add to
  `discovery.ignore`.
- Persist fails with "exceeds the configured limit" → regroup honestly; if
  outcomes are genuinely independent, raise `limits.*` deliberately.
- Report missing for a day → confirm timezone/`date.behavior`; commits are
  bucketed by committer date in the configured zone.
- Windows: use forward slashes or native paths in YAML; Node normalizes both.
