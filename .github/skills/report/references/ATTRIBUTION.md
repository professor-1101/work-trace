# Attribution and licensing — Persian language layer

The terminology, naturalness, and protection principles in
`references/persian-output.md` were developed after studying three open-source
projects. No text, lexicon data, code, or example lists were copied from any of
them; the rules are original WORKTRACE wording adapted to engineering-report
output. Sources are cited for provenance only.

## Sources studied

1. **persian-skill** — https://github.com/Mojtaba-Alehosseini/persian-skill
   (MIT License, Copyright (c) 2026 Mojtaba Alehosseini). Principles adapted:
   the craft/mechanics split (judgment rules vs deterministic typography),
   bureaucratic-Persian ("زبان اداری") and calque tells as named anti-patterns,
   register control, review-lens priority with fidelity on top, and the
   behavior-based evaluation style used by `evals/persian-language-evals.json`.
2. **salsi** — https://github.com/pooooooriya/salsi (MIT License, Copyright (c)
   2026 salsi contributors). Principles adapted: clarity-over-purity as the
   single decision test, "ask what the field itself writes", protected regions
   vs protected vocabulary as two independent defenses, sense-based
   disambiguation over spelling-keyed mapping, never-invent-a-term, consistency
   discipline, and the conservative default posture. salsi's own word data
   derives from Pasban (https://pasbans.ir); WORKTRACE imports none of it.
3. **persian-writing** — https://github.com/ali2000hos/persian-writing. Earlier
   reference for register selection and translationese tells.

## Why no data was imported

Both MIT-licensed projects allow reuse with attribution, but their core asset
is a general-purpose EN->FA lexicon. WORKTRACE deliberately rejects a
dictionary-driven design (see persian-output.md section 3): its terminology
decisions come from domain usage reasoning, not lookups. Importing word lists
would contradict the skill's central rule and add context weight without
behavior gain. If a future version ever bundles third-party lexical data, this
file must record the dataset, its license, and preserve upstream attribution
notices.
