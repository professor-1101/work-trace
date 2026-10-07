# Changelog

This repository follows semantic versioning for the WORKTRACE package
(`@worktrace/tools` + the unified `report` Skill). The single authoritative
version source is `tools/lib/version.js`; `VERSION`, `package.json`, this file
and the Skill's version metadata must stay in sync (enforced by tests).

## 3.3.0

- Unified-Skill architecture: the two skills `worktrace-report` (orchestration)
  and `worktrace-daily-report` (semantics) are merged into ONE Copilot Skill,
  `.github/skills/report/`, invoked as `/report`.
- The semantic layer (work-item rules, RULE-01..04, Persian language layer,
  attribution) is now `references/work-items.md` + sibling references inside the
  unified Skill; no sibling skill, no `use_skill` during a run.
- Explicit Task-title value rule (outcome/value, not activity/chore) in
  `references/grouping.md`, enforced by the split/merge re-audit.
- Tool-call mechanics section in `SKILL.md` (array-shaped `commands`, exact
  `old_text` for existing files, small edits, path-based CLI).
- Collector: dangling `.git` gitdir worktrees (stale worktrees) are discovered,
  skipped and reported under `discovery.warnings` instead of failing the day
  (exit stays 0); a genuinely broken repo still fails loudly.
- Installer rewritten for the unified Skill (`scripts/install.js`); old
  `.cline/skills/worktrace-*` sources removed.

## 3.2.0

- Manual Work Items ("کار دیگه‌ای امروز نکردی؟" intake before grouping).
- Deterministic hour allocation (three modes, hard 7.5h invariant).
- Single-file Daily Report section with persist-gate enforcement.
- Skill update flow (installer `--update` with conflict detection).

## 3.1.0

- Persist gate as final validation; day-window committer-date determinism.

## 3.0.0

- Initial version of the WORKTRACE collector/validator/renderer toolset.
