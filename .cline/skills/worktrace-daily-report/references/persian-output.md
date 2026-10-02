# Persian Output: Natural Engineering Prose, Not Translation

Load this reference ONLY when the requested report language is Persian (or another
language with heavy English-terminology mixing). It governs how the report *reads*.
It never changes what the report *says*: engineering claims, scope qualifiers, and
status are fixed by the evidence rules; naturalness must never justify changing,
weakening, or inventing an underlying claim.

Reference practice: natural Persian technical writing as collected in
`github.com/ali2000hos/persian-writing` (register selection, translationese tells,
orthography). The principles below are general; they work across arbitrary stacks,
domains, and repositories. No glossary is provided on purpose — see "Reasoning
procedure".

## 1. Core stance

Translate meaning and sentence structure, never words. Draft each sentence from
the engineering fact you want to convey, as a Persian-speaking software engineer
would say it to an Engineering Manager — not from the English phrasing of the
evidence or of an internal mental draft. If a sentence is only correct because its
English source sentence was correct, rewrite the sentence, not the words.

Target register: **formal-but-human** — full written forms (می‌شود، است، شد), no
colloquial contractions (میشه، رو، –ه), direct and concrete, zero bureaucratic
ceremony. This is a professional artifact for CTO/EM readers; warmth comes from
precision and short sentences, not from formality padding.

## 2. Terminology selection is a contextual decision

For every term, decide by role, usage, and audience — not by dictionary lookup:

- **Established loanwords stay.** If Persian-speaking engineers overwhelmingly use
  the borrowed word (with or without Persian morphology — تست، دیپلوی، ریفکتور،
  هاردن، گیت، برنچ), use it. Never force a literary, dictionary-derived, or
  purist coinage just because one exists; forced Persianization reads worse than
  the loanword.
- **Exact technical strings remain recognizable verbatim in Latin script:** code
  identifiers, API names, commands, flags, error codes (`INVALID_CHANGE_SET_ARTIFACT_STATE`),
  versions, file paths, product/library names, capability constants. Never
  transliterate an identifier that a reader may need to grep.
- **English terms may stand inside Persian grammar** when that is natural for the
  audience (validation, coverage, baseline, smoke test…). Persian grammar +
  Persianized loans + Latin terms + acronyms in one sentence is normal, correct
  technical Persian — do not fight it.
- **No one-to-one lexical mapping.** The same English word takes different Persian
  renderings by semantic role: *support* = پشتیبانی برای یک feature، نگه‌داشتن برای
  یک value، تأیید برای یک type/test; *handle* = مدیریت کردن برای UI behavior،
  پردازش برای data، رسیدگی برای یک task. Choose per occurrence, by what the word
  means in that clause.
- **Consistency without elegant variation.** Render the same concept with the same
  term throughout the report; but never swap in a synonym merely to avoid
  repetition (وب‌سایت/سایت/پلتفرم cycling is a machine tell).

## 3. Reasoning procedure (instead of a glossary)

When unsure about a term's rendering, answer four questions in order:

1. What semantic role does this word play in this sentence — identifier, capability,
   action, property?
2. Would a Persian-speaking engineer in this domain say the loanword, the common
   Persian equivalent, or keep the English here?
3. Does the reader need the exact string to locate or verify it? If yes -> Latin
   verbatim.
4. Is the chosen rendering consistent with earlier occurrences of the same concept?

The answer is a language decision informed by context, not a substitution table.
Do not build or rely on long prohibited-word lists; apply these four questions.

## 4. Sentence-level naturalness (translationese tells)

Remove at sentence level; keep the meaning, lose the tell:

- English syntax carried into Persian: fronted participles («با استفاده از …، X
  انجام شد»), chains of که-clauses, repeated «را» after every object, passive
  calques where an active or impersonal Persian construction is natural, «انجام
  شد / به عمل آمد» stapled to every noun instead of a real verb.
- Bureaucratic constructions: می‌باشد، گردید، ارائه می‌گردد، مورد … قرار گرفت
  (e.g., «مورد بررسی قرار گرفت» -> «بررسی شد»), لازم به ذکر است، در راستای،
  به منظورِ نیل به.
- Excessive nominalization: stacking ezafe chains where a verb would move
  («انجام فرآیند مهاجرت تنظیمات» -> «تنظیمات migrate شد»).
- Literal collocations that exist only as shadows of English idioms.
- Empty evaluative adjectives (قدرتمند، چشمگیر، اساسی، باکیفیت) — already banned as
  unsupported claims; they are also style tells.
- One idea per sentence; short sentences. Mixed sentence lengths are fine —
  uniform 15–20-word sentences read as machine output.
- Orthographic mechanics expected by professional Persian readers: نیم‌فاصله in
  می‌شود/کتاب‌ها/بی‌دقت، Persian ک و ی (never Arabic ي ك)، Persian digits in prose,
  Latin digits inside identifiers/versions/paths، «؛» over em-dash rhythm.

## 5. Precision guardrails

Naturalness is bounded by fidelity:

- Keep every scope qualifier exactly (در سطح UI، در زمان creation) even when a
  shorter phrasing would flow better. A smoother sentence that widens a claim is
  a failed sentence.
- Do not convert behavior descriptions into evaluations while smoothing them
  («مسدود می‌کند» must not become «امن می‌کند»).
- Technical accuracy outranks elegance: a capability check is access-control, not
  احراز هویت; choose the precise term even if the imprecise one is more common.
- If naturalizing would require asserting something the evidence does not support,
  keep the plainer wording.

## 6. Final editorial pass (Persian output only)

After the engineering self-check (references/validation.md) passes, run one
separate language-only pass over the finished Persian text. Judge it as a Persian
editor reading only the report — do not re-open grouping, status, or claim
decisions here, and never alter an engineering claim during this pass:

1. Read-aloud test: would a senior Iranian engineer write this sentence this way?
2. Any term forced into uncommon/literary Persian where the field uses a loan? Fix
   by applying section 3.
3. Any identifier, command, or error code altered or transliterated? Restore verbatim.
4. Any tell from section 4 left? Rewrite the sentence.
5. Same concept rendered inconsistently across items? Unify.
6. Register drift (colloquial forms, ceremonial fillers, first person)? Normalize
   to formal-but-human.

Deliver only when both passes — engineering validation and this language pass —
are clean.
