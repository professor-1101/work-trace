# WORKTRACE v3.1.0

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
 -> group Work Items into Tasks   (LLM judgment ONLY)
 -> validate grouping + 3x3       (deterministic, config-driven limits)
 -> render final plain text       (deterministic)
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
node scripts/install.js [--target <dir> | --global] [--check]
```

- Idempotent; installs BOTH Skills, the `tools/` layer, and a
  `worktrace.yaml` template.
- Never overwrites an existing user `worktrace.yaml` (reports "kept existing").
- Writes a version marker at `<target>/.cline/worktrace/version`.
- `--check` prints the installed version without changing anything.
- No curl-pipe-to-shell; plain `node` + file copy.

## Configuration

`config/worktrace.example.yaml` is the authoritative schema (v1). Search
order for the active config: `--config` flag → `$WORKTRACE_CONFIG` →
`./worktrace.yaml` → `~/.cline/worktrace/worktrace.yaml`.

Key fields: `projectsRoot`, `reportRoot`, `timezone` (IANA),
`date.behavior` (`today` or `offset:<N>`), `discovery.*` (maxDepth,
followSymlinks, skipDirs, include/exclude/ignore, nameOverrides),
`limits.*` (collection caps AND grouping caps), `output.layout`.

Grouping limits (v3.1.0, configuration-driven; defaults 3×3):

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

## Storage

`{reportRoot}/YYYY/MM/DD/report.txt` (config-driven `output.layout`). Missing
directories are created; writes are atomic (temp file + rename); reruns
overwrite cleanly (last run wins, no duplicate daily files).

**Persist gate:** `persist` re-validates grouping contract, verbatim Work
Item preservation, configured 3×3 limits, and rendered invariants before any
write. Invalid grouped output can never reach storage.

## Versioning

Single authoritative source: `tools/lib/version.js`. Derived locations kept
in sync (enforced by tests): `VERSION`, `tools/package.json`,
the `worktrace-report` Skill metadata, the
installer marker, and the current `CHANGELOG.md` entry. Historical changelog
entries remain historical. Current release: **3.1.0**.

## Legacy removal

The former single-file reading copy (`WORKTRACE-ALL-IN-ONE.md`) and its
generator (`scripts/build-all-in-one.sh`) were removed in 3.1.0. They must not
be recreated; read the documentation from its source files. Only historical
CHANGELOG entries reference them.

## CLI quick reference

```bash
node tools/bin/collect.js --config worktrace.yaml > evidence.json
node tools/bin/render.js validate-workitems --evidence evidence.json --work-items work-items.json
node tools/bin/render.js validate-tasks --work-items work-items.json --tasks tasks.json [--config worktrace.yaml]
node tools/bin/render.js render --tasks tasks.json --out report.txt
node tools/bin/render.js check --file report.txt --tasks tasks.json
node tools/bin/render.js persist --tasks tasks.json --config worktrace.yaml [--date YYYY-MM-DD] [--work-items work-items.json]
```

Exit codes: 0 ok · 1 validation failure · 2 usage/config error.

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
