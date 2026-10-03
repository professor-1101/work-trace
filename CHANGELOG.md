# Changelog

All notable changes to the WORKTRACE package are documented here.
The version format follows [Semantic Versioning](https://semver.org/).
The single authoritative version source is `tools/lib/version.js`;
`VERSION`, `tools/package.json`, the workflow skill metadata and the
installed marker (`.cline/worktrace/version`) must always match it
(enforced by `tools/tests/config-install.test.js`).

## 3.2.0

Additive release on top of 3.1.0. The frozen semantic Skill
(`worktrace-daily-report`) remains byte-for-byte unchanged, and the single
daily output file contract is preserved (one `{root}/YYYY/MM/DD/report.txt`,
no second report flow).

### Added

- **Skill update mode in the existing installer** (`node scripts/install.js
  --update`): no separate updater. Both Skills (`worktrace-daily-report`,
  `worktrace-report`) and `tools/` are compared as COMPLETE directories
  (SHA-256 manifest at `<target>/.cline/worktrace/manifest.json`). Unchanged
  source → no-op; changed source → installed copy updated; locally modified
  installed files → CONFLICT reported and never silently overwritten (exit
  3); removed source files → deleted only when installer-managed AND
  unmodified; user `worktrace.yaml` → never touched; repeated `--update` is
  idempotent. Plain install/check behavior is preserved.
- **Manual Work Items**: after Canonical Git Work Items validation and
  BEFORE grouping, the orchestration Skill asks exactly
  «کار دیگه‌ای امروز نکردی؟». Activities the user actually mentions become
  Manual Work Items `{title, report, source: "manual"}` — no invented
  details, no structured input required. Deterministic merge via
  `render.js merge-manual` produces the unified set feeding the EXISTING
  grouping flow. Git collector stays Git-only. Grouping with a Git Work
  Item requires user-stated evidence; genuinely unscoped work keeps an
  honest label (never a fake repository).
- **Deterministic Task hours** (`tools/lib/hours.js`, `render.js
  allocate-hours`), collected ONLY after final Tasks are fixed. Three
  modes: all specified (values preserved exactly, unused time not filled);
  partial + balance (`remaining = 7.5 − explicitTotal` split equally);
  none specified (full 7.5h split equally). Hard rules: finite numbers ≥ 0,
  total ≤ 7.5h, explicit total > 7.5 rejected (no silent clipping or
  reduction), deterministic hundredth rounding, hour collection skipped
  when there are no final Tasks. Hours never influence grouping.
- **Daily Report section** inside the SAME daily file: exactly one trailing
  `گزارش روزانه` section with one short entry per Final Task
  (`{Task title} - {H}h`, grounded label + exact stored hours), generated
  from Final Tasks only. No extra `---` separator (repository separator
  semantics unchanged). Validated by `check` and the persist gate.
- Persist gate extensions: stored Task hours validation (finite, ≥ 0,
  total ≤ hard 7.5 ceiling) and Daily Report completeness (one section,
  one entry per Final Task, hours match stored values) before any atomic
  write; invalid output never replaces the existing file.
- Test coverage for installer update/conflict/idempotence/config
  preservation (both Skills), manual-work merging, all three hour modes,
  > 7.5 rejection, invalid inputs, deterministic rounding, Daily Report
  invariants, and the extended persist gate.

### Hard invariant

- The 7.5h daily total is an absolute product constant owned by
  `tools/lib/hours.js` (`DAILY_TOTAL_HOURS`). It is NOT configurable:
  `limits.dailyTotalHours` is rejected at config load, and `--daily-total`
  may only lower the budget (e.g. half-day), never raise it above 7.5.

## 3.1.0

Additive workflow hardening on top of 3.0.0. The frozen semantic Skill
(`worktrace-daily-report`) remains byte-for-byte unchanged.

### Added

- Configuration-driven grouping limits: `limits.maxTasksPerRepository` and
  `limits.maxSubtasksPerTask` (defaults 3 and 3). Positive-integer validated;
  the grouping validator and the persist gate consume the configured values —
  no hard-coded caps remain in the validation path.
- Persist validation gate: `node tools/bin/render.js persist` now re-validates
  the grouping contract, Work Item verbatim preservation, configured 3×3
  limits, and rendered plain-text invariants BEFORE writing. Invalid grouped
  output can never reach storage.
- Renderer/validator enforcement that `---` appears ONLY between repository
  sections: for N repositories exactly N−1 separator lines, zero separators
  between Tasks inside one repository section.
- Test coverage for configurable/invalid/overflow limits, DST-sensitive day
  windows, revert evidence, the real CLI workflow (collect → validate →
  render → check → persist), deterministic reruns, the persist gate, version
  consistency, and legacy-file removal.

### Removed

- Legacy single-file generator: `WORKTRACE-ALL-IN-ONE.md` and
  `scripts/build-all-in-one.sh` are deleted. No live dependency remains;
  documentation is read directly from its source files.

## 3.0.0

Additive reporting workflow layer around the existing WORKTRACE Skill
(`worktrace-daily-report`), which remains the unchanged, authoritative
reporting engine (Git evidence → engineering meaning → canonical Work
Items → Persian report text).

### Added

- `/report` workflow skill at `.cline/skills/worktrace-report/`
  (orchestration only; invokes the existing Skill via Cline's `use_skill`
  mechanism — no semantic logic duplicated).
- Deterministic cross-platform Node tools in `tools/`:
  - `bin/collect.js` — recursive git repository discovery (.git dir/file,
    worktrees, nested/duplicate detection) and same-day commit evidence
    collection (full messages, hashes, author/committer dates, stat/diff,
    merge/bot flags) with explicit IANA timezone day boundaries; structured
    JSON output; non-zero exit on real failures.
  - `bin/render.js` — canonical Work Item contract validation, grouping
    (3×3 rule) validation with byte-for-byte verbatim-preservation checks,
    plain-text rendering, output-format checking, and atomic date-based
    persistence (`{root}/YYYY/MM/DD/report.txt`).
- Portable YAML configuration schema (`config/worktrace.example.yaml`).
- Cross-platform idempotent installer/updater `scripts/install.js`
  (preserves user `worktrace.yaml`; no curl-pipe-to-shell).
- Routing rule `.clinerules/worktrace-workflow.md`.
- Behavioral test suite (`tools/tests/`, `node --test`).

### Unchanged

- The entire existing Skill: `.cline/skills/worktrace-daily-report/**`
  (SKILL.md, references, assets, evals), `WORKTRACE-ALL-IN-ONE.md`
  generator scope, and `scripts/build-all-in-one.sh`.
