# WORKTRACE

Engineering evidence -> daily engineering report, as a Cline/Agent Skill.

- `.cline/skills/worktrace-daily-report/` — the skill (project-skill location per Cline docs; commit this directory so the team shares it).
- `SKILL.md` is the entry point; detailed rules load on demand from `references/`, output skeleton in `assets/`.
- The skill defines the standard; a runtime model produces the report (language follows the user request).

## Reading copy

`WORKTRACE-ALL-IN-ONE.md` is a generated single-file concatenation of all docs for convenient reading. Regenerate it before every push:

```bash
./scripts/build-all-in-one.sh
```
