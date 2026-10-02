# Validation: DODs, Acceptance Tests, Reject Patterns, Scorecard

Load this reference during the self-check pass, before delivering the report.

## Minimum acceptable report

An item passes minimum bar when it: (1) states a concrete engineering change;
(2) rises above vague activity; (3) shows the outcome as far as evidence allows;
(4) hallucinates nothing.
Example: "Validation for `UNCHANGED` change-set states was fixed so a state that
pairs two different snapshots is rejected at creation time."

## Work Item Definition of Done (DOD-1..14)

1. Distinguishable independent outcome.
2. Outcome-oriented title.
3. Text goes beyond activity.
4. Context/rationale used when it exists.
5. No fabricated rationale when context is absent.
6. Engineering work stated precisely.
7. At least one clear outcome or behavioral change.
8. Important evidence mentioned when present.
9. Limitation / blocker / follow-up not hidden.
10. Zero unsupported claims.
11. Merge/duplicate work removed.
12. Reverted/incomplete work interpreted correctly.
13. Understandable to a reader unfamiliar with the repo.
14. Language natural, technical, concise.

## Daily Report Definition of Done (DOD-D1..14)

1. All relevant commits of the day inspected.
2. Commits converted into meaningful Work Items.
3. Each Work Item = one independent outcome.
4. Related commits grouped correctly.
5. Merge commits produced no duplicates.
6. Reverts interpreted against following history.
7. No fabricated rationale or impact anywhere.
8. Report is not a commit summary.
9. Reader learns what was added/fixed in the system.
10. Reader learns why — when evidence allows.
11. Reader learns what became possible — when evidence allows.
12. Material limitations visible.
13. Abstraction level = engineering outcome, not file log.
14. Readable without repo knowledge.

## Final acceptance tests (18; run per Work Item)

| # | Test | FAIL condition |
|---|------|----------------|
| 1 | What | Engineering work unclear |
| 2 | Why | Evidence-backed rationale omitted, OR rationale invented without evidence |
| 3 | So-What | Derivable outcome missing (pass if evidence can't support it) |
| 4 | Truth | Any claim unsupported by evidence |
| 5 | Audience | Unfamiliar CTO/EM can't tell what changed at system level |
| 6 | Status | Incomplete work presented as complete |
| 7 | Duplication | Merge/revert/duplicate created repeated reporting |
| 8 | Language | Vague, promotional, corporate wording |
| 9 | Sentence Utility | A sentence delivers none of Context/Work/Outcome/Significance/Evidence/Status |
| 10 | Verb Scope | prevents/guarantees/ensures/improves exceed evidence scope |
| 11 | Terminology Accuracy | Wrong concept word (e.g., capability check called authentication) |
| 12 | Term Meaningfulness | Repo-specific term used with no plain gloss |
| 13 | Internal Reference | Phase/ticket/PR/planning label in narrative |
| 14 | Grouping | Two independent outcomes merged |
| 15 | Revert | Reverted implementation reported as final accomplishment |
| 16 | Capability First | Mechanism leads the item where the capability alone would inform the reader better |
| 17 | Approved Rules | Item violates RULE-01..RULE-04 as specified in approved-rules.md (activity metrics, untranslated internal identifiers, missing evidence-supported system meaning, or detail-noise misselection), including their exceptions |
| 18 | Persian Naturalness (Persian output only) | Report reads as translated English: forced literary/purist Persian where engineers use the loanword, transliterated or altered identifiers/commands/error codes, calqued English syntax, bureaucratic constructions (می‌باشد، گردید، مورد … قرار گرفت)، or inconsistent rendering of one concept. Run the language-only editorial pass in persian-output.md; this test must never alter an engineering claim |

## Reject patterns (distilled)

1. Paraphrasing a commit ("Explorer was added").
2. Reporting activity only ("17 files changed").
3. Fabricated rationale ("to improve team productivity…").
4. Fabricated previous system ("the old system couldn't…").
5. Fabricated business impact ("development time dropped").
6. No stated result ("UI redesigned" — redesigned how?).
7. Excess implementation detail (hook moved from file Y to Z…).
8. Hidden limitation (blocked work reported as done).
9. Reverted work as accomplishment.
10. Merge commit double-reported.
11. Buzzword padding.
12. Planning terminology inside narrative; vague pointers like "new design".

## Anti-pattern catalog (AP-1..16, recurring failure shapes)

- **AP-1 Activity-only item** — counts/diffs instead of meaning. Fix: Level 2+.
- **AP-2 Invented why** — motivation without evidence. Fix: start from work itself.
- **AP-3 Ghost predecessor** — fake legacy system in greenfield. Fix: product/design
  context.
- **AP-4 Evaluation inflation** — reliable/secure/seamless/robust adjectives.
  Fix: behavior + evidence.
- **AP-5 Scope creep verb** — "prevents invalid links" for a UI-only guard.
  Fix: scope qualifier.
- **AP-6 Domain merge** — bundling unrelated outcomes ("Git isolation and E2E and
  smoke"). Fix: split by outcome.
- **AP-7 Internal shorthand** — Phase/ticket/PR/codename in text. Fix: translate or
  move to metadata.
- **AP-8 Changelog residue** — helper/hook/path name-dropping. Fix: cut unless
  outcome-relevant.
- **AP-9 Buried limitation** — positive tone hides blocker. Fix: explicit status line.
- **AP-10 Revert amnesia** — final report praises reverted attempt. Fix: report C.
- **AP-11 History-first opener** — revert/phase talk before the result. Fix:
  result-first.
- **AP-12 Bare jargon** — `captured set`, `reconstitute` unexplained. Fix: gloss on
  first use.
- **AP-13 Mechanism-first narrative** — ARIA grid / selected-cell ops lead instead of
  the capability. Fix: capability first, mechanism after if it adds meaning.
- **AP-14 Forced "why"** — every item gets a manufactured motivation. Fix: start
  from the engineering work when no rationale is evidenced.
- **AP-15 Forced business framing / metric** — Quality/Speed/Cost/Risk bucket or KPI
  attached without evidence. Fix: report observable capability; no quantification
  unless the evidence quantifies.
- **AP-16 False completion** — partial/blocked work asserted as done. Fix: explicit
  status line; never claim completeness the evidence does not support.
- **AP-17 Activity-metric reporting** (RULE-01) — hours logged, commit counts, file
  counts, or line churn presented without outcome context. Fix: report the verified
  technical state change; reframe or omit activity volume.
- **AP-18 Untranslated internal identifiers** (RULE-02) — ticket keys, class/method
  names, or capability flags left raw where they add no reader meaning. Fix:
  translate to domain purpose or omit; retain only when genuinely informative.
- **AP-19 Diff-mechanics-only item** (RULE-03) — file/function-level changes with no
  system-level meaning stated even though evidence supports one. Fix: answer what
  became possible/observable/enforceable/testable; if unsupported, keep the
  localized technical outcome concise without forcing significance.
- **AP-20 Detail misselection** (RULE-04) — contract/security/validation-relevant
  detail dropped, or routine syntax edits, minor styling tweaks, and sub-version
  bumps reported as substance. Fix: keep material detail in concise form; cut noise.

## PASS/FAIL scorecard (final gate)

Evaluate each dimension PASS/FAIL — no numeric scores:

commit-summary-free · outcome-oriented · reader-oriented · planning-jargon-free ·
evidence-fidelity · greenfield-handling · revert-handling · limitation-visibility ·
technical-accuracy · grouping-quality · no-business-hallucination · no-corporate-fluff ·
conciseness · system-significance · sentence-utility · verb-scope · terminology-accuracy ·
term-meaningfulness · capability-first · no-decorative-emoji · approved-rules-compliance
(RULE-01..RULE-04 incl. exceptions) · persian-naturalness (Persian output only;
language-only pass per persian-output.md).

Any single FAIL -> fix the item and re-run affected tests. Deliver only when all PASS.
For Persian reports, the engineering checks above run first; the language-only
editorial pass in persian-output.md runs after them and must not alter any
engineering claim.
