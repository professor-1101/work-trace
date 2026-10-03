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
```

Concrete shape rules enforced by the renderer/validator:

- Task heading line = `{Project} - {Task Title}`; the project name appears ONLY
  on this line, never on subtask titles.
- Subtask block = title line, blank line, report paragraph(s) — report text is
  byte-identical to the canonical Work Item report.
- Blocks inside a Task separated by one blank line; Tasks separated by a line
  containing only `---` with blank lines around it.
- Projects and tasks ordered deterministically (alphabetical by project name,
  then task title; subtasks alphabetical by title) so repeated `/report` runs
  produce identical bytes for identical inputs.
- File ends with a single trailing newline. Empty day => empty file (0 bytes),
  which is valid and documented.
