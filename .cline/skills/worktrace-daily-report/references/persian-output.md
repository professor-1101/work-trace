# Persian Output: Natural Engineering Prose, Not Translation

Load this reference ONLY when the requested report language is Persian (or another
language with heavy English-terminology mixing). It governs how the report *reads*.
It never changes what the report *says*: engineering claims, scope qualifiers, and
status are fixed by the evidence rules; naturalness must never justify changing,
weakening, or inventing an underlying claim.

Reference practice: natural Persian technical writing as collected in
`github.com/ali2000hos/persian-writing`; terminology-protection and loanword
judgment principles adapted from `github.com/Mojtaba-Alehosseini/persian-skill`
and `github.com/pooooooriya/salsi` (provenance and licensing: see
references/ATTRIBUTION.md). The principles below are general; they work across
arbitrary stacks, domains, and repositories. No glossary is provided on purpose
— see "Reasoning procedure".

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

The single decision test: **a Persian equivalent is worth using only when it is
at least as clear to this reader as the term it replaces.** Purity is never
worth clarity. Ask what the software-engineering field itself writes, not what
a dictionary offers. For every term, decide by role, usage, and audience — not
by lookup:

- **Established loanwords stay.** If Persian-speaking engineers overwhelmingly use
  the borrowed word (with or without Persian morphology — تست، دیپلوی، ریفکتور،
  هاردن، گیت، برنچ), use it. Never force a literary, dictionary-derived, or
  purist coinage just because one exists; forced Persianization reads worse than
  the loanword.
- **Field-standard Persian equivalents are also correct.** Some Persian terms are
  themselves the practitioner form (پایگاه داده for database، بارگیری for
  download). Using them is not Persianization enforcement — it is what the field
  writes. The test is always domain usage, never purity in either direction.
- **Never invent a term.** If you have not seen a rendering used by real Iranian
  engineering teams, do not introduce it in a report. When uncertain between an
  unfamiliar Persian equivalent and a well-established technical term, keep the
  established term; do not be the first reader's dictionary entry.
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

When unsure about a term's rendering, answer five questions in order:

1. What semantic role does this word play in this sentence — identifier, capability,
   action, property? (Sense decides the rendering; spelling never does. A token
   that is an English loanword in a systems document may be ordinary Persian with
   the same letters — resolve by meaning, and when genuinely ambiguous, keep the
   source term.)
2. Would a Persian-speaking engineer in this domain say the loanword, the common
   Persian equivalent, or keep the English here?
3. Does the reader need the exact string to locate or verify it? If yes -> Latin
   verbatim.
4. Is the chosen rendering consistent with earlier occurrences of the same concept?
5. When answers 2-4 leave real uncertainty: choose the form you have actually seen
   used by engineering teams, not the theoretically correct coinage. Uncertainty
   resolves toward the established technical term, never toward invention.

The answer is a language decision informed by context, not a substitution table.
Do not build or rely on long prohibited-word lists; apply these five questions.

## 4. Sentence-level naturalness (translationese tells)

Remove at sentence level; keep the meaning, lose the tell ("keep every fact,
change the shape" — never add a fact, number, name, or qualification that the
engineering evidence did not contain):

- Bureaucratic Persian (زبان اداری) — the strongest AI fingerprint: می‌باشد/می‌گردد،
  «مورد بررسی قرار گرفت» -> «بررسی شد»، «دارای X است» -> «X دارد»، agent-bearing
  passive with «توسط» -> active, copula avoiders («به شمار می‌رود»، «محسوب می‌شود»).
- Calqued function words: indefinite «یک» where Persian marks indefiniteness with
  ending «ی» («معلم خوبی است», not «یک معلم خوب است»); «این امر / این موضوع» as a
  floating subject — name the thing instead; «به عنوان» for "as" where Persian
  drops or recasts it; «اطمینان حاصل کنید» -> «مطمئن شوید».
- English syntax carried into Persian: fronted participles («با استفاده از …، X
  انجام شد»), chains of که-clauses, repeated «را» after every object, passive
  calques where an active or impersonal Persian construction is natural, «انجام
  شد / به عمل آمد» stapled to every noun instead of a real verb.
- AI-style clusters (a single occurrence is normal Persian; clusters are the tell):
  piled connectors (همچنین / علاوه بر این / از سوی دیگر opening consecutive
  sentences), «نه تنها … بلکه …» recurring, rule-of-three adjective lists, uniform
  sentence length, closing-summary paragraphs, announcement fillers (لازم به ذکر
  است، شایان ذکر است، در نهایت).
- Excessive nominalization: stacking ezafe chains where a verb would move
  («انجام فرآیند مهاجرت تنظیمات» -> «تنظیمات migrate شد»).
- Literal collocations that exist only as shadows of English idioms.
- Empty evaluative adjectives (قدرتمند، چشمگیر، اساسی، باکیفیت) — already banned as
  unsupported claims; they are also style tells.
- One idea per sentence; short sentences. Mixed sentence lengths are fine —
  uniform 15–20-word sentences read as machine output.

### Mechanics vs judgment (two layers, never mixed)

Orthographic mechanics are deterministic checks applied verbatim, independent of
any wording decision: نیم‌فاصله in می‌شود/کتاب‌ها/بی‌دقت، Persian ک و ی (never
Arabic ي ك)، Persian punctuation «،» «؛» «؟» and guillemets «…» adjacent to Persian
text only, Persian digits in prose but Latin digits inside identifiers, versions,
paths, and code. No linter ships with this skill, so the editorial pass below
verifies these mechanically — check them as fixed rules, not taste.

Terminology, register, and phrasing are judgment decisions governed by sections
1-5. Never let a mechanical normalization reword prose (fixing «كتاب» to «کتاب»
is mechanics; turning «بررسی شد» into «مورد بررسی قرار گرفت» is a violation), and
never let a judgment rewrite touch protected spans: code fences, inline code,
URLs, file paths, commands, identifiers, quoted evidence strings, numbers, units,
and version strings stay byte-identical.

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
decisions here, and never alter an engineering claim during this pass. Run three
independent checks, then mechanics last:

1. **Terminology.** Is any established technical loanword translated unnecessarily?
   Was any term rendered by dictionary mapping instead of its sense in context? Are
   identifiers, commands, and error codes still byte-identical and recognizable? Has
   the same concept received multiple names? Resolve each finding with section 3.
2. **Naturalness.** Does every sentence sound originally written in Persian? Check
   for English-shaped syntax, calqued function words, bureaucratic verbs, AI-style
   clusters, and uniform rhythm from section 4. The test question: would a senior
   Iranian engineer sign this sentence?
3. **Fidelity.** Re-read each sentence against its engineering claim: did wording
   changes strengthen, weaken, generalize, or scope-shift anything? Did the pass add
   a fact absent from the Git evidence? Wording is free to change; claims are frozen.
4. **Mechanics.** Verify the deterministic list in section 4 (letters, ZWNJ,
   punctuation adjacency, digit policy) as fixed rules — no taste involved.

Behavior evaluations for this layer live in `evals/persian-language-evals.json`;
run them when the language policy itself changes.

Deliver only when both passes — engineering validation and this language pass —
are clean.
