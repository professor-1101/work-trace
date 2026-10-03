# Changelog

All notable changes to the WORKTRACE package are documented here.
The version format follows [Semantic Versioning](https://semver.org/).
The single authoritative version source is `tools/lib/version.js`;
`VERSION`, `tools/package.json`, the workflow skill metadata and the
installed marker (`.cline/worktrace/version`) must always match it
(enforced by `tools/tests/config-install.test.js`).

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
