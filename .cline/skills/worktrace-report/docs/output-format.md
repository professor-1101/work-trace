# Plain-Text Output Contract

The final artifact is a genuine `.txt` file. It is produced ONLY by
`node tools/bin/render.js render` and verified by `... check`. Never hand-edit
it; edit `tasks.json` and re-render.

## Allowed characters/structures

- UTF-8 text (Persian prose allowed).
- Lines of prose. Blank lines between blocks.
- The ONLY separator line is exactly three hyphens: `---`

## Forbidden

- Markdown: `#` headings, `**bold**`, backticks, `-`/`*` bullets, numbered
  lists (`1.`), tables (`|`, `--`), blockquotes (`>`).
- Emojis and decorative symbols.
- Structural labels anywhere: `Task 1`, `Task 2`, `Main Task`, `Subtask 1`,
  `Subtask`, `Repository`, `Project`, `Report`, `Work Item` (as standalone or
  label-prefixed lines). Ordinary words inside report sentences are fine — only
  label-position usage is rejected.

## Structure

```text
{Project Name} - {Task Title}
Subtask Title
[canonical Work Item report, verbatim]

Subtask Title
[canonical Work Item report, verbatim]

---
{Project Name} - {Task Title}
Subtask Title
[canonical Work Item report, verbatim]

گزارش روزانه
{Task Title} - {hours}h
{Task Title} - {hours}h
```

Concrete shape rules enforced by the renderer/validator:

- Task heading line = `{Project} - {Task Title}`; the project name appears ONLY
  on this line, never on subtask titles. Manual-only unscoped entries render a
  bare Task heading (no fake project prefix is ever invented).
- Subtask block = title line, blank line, report paragraph(s) — report text is
  byte-identical to the canonical Work Item report (Git or Manual).
- Blocks inside a Task separated by one blank line; repository sections
  separated by a line containing only `---` with blank lines around it.
  `---` NEVER appears anywhere else — in particular NOT before/after the
  Daily Report section.
- Projects and tasks ordered deterministically (alphabetical by project name,
  then task title; subtasks alphabetical by title) so repeated `/report` runs
  produce identical bytes for identical inputs.
- File ends with a single trailing newline. Empty day => empty file (0 bytes),
  which is valid and documented.

## Daily Report section (v3.2.0)

Exactly ONE daily output file exists: `{root}/YYYY/MM/DD/report.txt`. The
Daily Report lives INSIDE that same file — there is no second report file and
no second flow.

- Heading line: exactly `گزارش روزانه`, appearing at most once per file, as
  the trailing section after all repository sections.
- One short line per FINAL Task, in the same deterministic order as the
  rendered headings: `{Task Title} - {hours}h`.
- Hours are the exact final stored Task hours (from the deterministic
  allocation step); the Daily Report never re-runs analysis, never rewrites
  Work Item reports, and never invents business impact, urgency, metrics,
  ROI, stakeholder requests or unsupported outcomes.
- No `---` separator belongs to this section.
