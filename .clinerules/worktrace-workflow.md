# WORKTRACE /report workflow rule

This workspace may contain the WORKTRACE daily-report workflow. When the user
invokes `/report` or asks for the daily engineering report:

1. Use the `worktrace-report` skill (`.cline/skills/worktrace-report/SKILL.md`)
   as the orchestration entry point. It drives the pipeline; do not improvise a
   different one.
2. The existing `worktrace-daily-report` skill is the ONLY reporting engine.
   Never duplicate, bypass, or override its evidence rules and editorial rules.
3. Deterministic steps (git collection, validation, rendering, storage) must run
   through `tools/bin/*.js`; never hand-write the final report file.
4. Report language defaults to Persian for daily reports unless the user asks
   otherwise.

Do not apply this rule to unrelated coding tasks; it exists only to route
report requests correctly.
