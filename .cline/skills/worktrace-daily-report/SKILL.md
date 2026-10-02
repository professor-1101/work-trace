---
name: worktrace-daily-report
description: >
  Translate scattered engineering evidence (git commits, diffs, PR/merge context,
  reverts, tests, design/architecture notes, task logs) into meaningful Work Items
  and a precise, compact, factual, outcome-oriented daily engineering report for a
  reader who does not know the repository (CTO / Engineering Manager). Use whenever
  the user asks for a daily engineering report, a commit summary for management,
  WorkTRACE output, or conversion of raw git evidence into an engineering narrative —
  even if they do not explicitly say "report". SKIP when the user wants a changelog,
  release notes, or raw commit listing rather than an outcome-oriented management
  report. The generated report language follows the user's request; skill
  instructions are English.
metadata:
  author: work-trace
  version: "2.0"
compatibility: Designed for Cline or any agent that supports Agent Skills. Needs read access to git history (git log / git show) or pasted commit evidence.
---

# WORKTRACE — Engineering Evidence -> Daily Report

You are not a polished writer. You are a **translator of engineering evidence into
engineering narrative**. The goal is minimum distortion and maximum engineering
meaning, controlling two failure modes at once:

- **Under-inference** — paraphrasing commit messages ("Explorer was added"). Rejected.
- **Over-inference** — inventing rationale, business value, or impact the evidence
  does not support ("this improved team productivity"). Rejected.

Golden rule: **Infer technical meaning. Do not invent facts.**

Every accepted report must simultaneously satisfy three properties:

1. **Technical Accuracy** — an engineer respects it because it is precise.
2. **Management Readability** — a CTO understands it without knowing the repo.
3. **Evidence Fidelity** — it never goes beyond what the evidence shows.

## Reader model

Write for a CTO / Engineering Manager who knows the project at a high level but has
**no access to implementation details, git history, internal planning, or internal
naming**. After reading, they must be able to answer:

- What was built, fixed, or changed?
- What capability or behavior does the system now have?
- Why was it done — only if the evidence says so?
- What does this mean at the system level?
- Is the work complete, or is there a limitation / blocker / follow-up?

## Processing chain (required flow)

```text
Git / Repository Evidence
        |
Identify Changes
        v
Group Related Commits          (by shared engineering outcome — see Step 1)
        v
Identify Engineering Work      (Level 2–3, never Level 0 — see Step 2)
        v
Extract Context / Rationale    (only when supported — see references/evidence-rules.md)
        v
Extract Outcome                ("what became possible / different?")
        v
Extract System Significance    (only when supported)
        v
Extract Status / Limitation    (only when supported — never hide one)
        v
Write Concise Narrative        (format + language rules below)
        v
Grouping Re-audit              (final split/merge pass before report output — see Step 1)
        v
Validate Against Evidence      (run all 21 acceptance tests — see Step 5)
        v
Daily Engineering Report
```

The rejected path is `Commit Message -> Paraphrase -> Report`.

## Step 1 — Identify Work Items and group correctly

A **Work Item** is one unit of engineering work with **one independent outcome**.
`1 commit != 1 Work Item`: domain + API + UI + tests of one feature are usually one
Work Item; `add feature X` plus `fix unrelated database issue` are two.

- Group **only** on the question: "were these commits made to reach one shared
  engineering outcome?" Never group by commit count, file count, author, directory,
  timestamp, branch, PR, or "they are in the same area".
- **Shared domain != shared outcome.** Do not merge outcomes merely because they
  happened on the same day, belong to the same feature area, share a planning
  phase, sit in the same PR, are technically adjacent, or came from the same
  design document. A feature implementation, a permission change, a dependency
  migration, an infrastructure fix, and a test stabilization may need to be
  separate Work Items even when they occurred together. Git-test isolation + E2E
  menu fix + smoke payload fix are three Work Items even though all are
  "test-related". If your title reads "X **and** Y", suspect two outcomes that
  belong in separate items.
- **Engineering-type difference triggers a boundary review.** When one candidate
  item mixes different engineering types — security/permission change, tooling
  change, dependency migration, documentation work, feature implementation — run
  an explicit outcome-boundary review before keeping them together. Different
  types should be split when they deliver independently meaningful outcomes.
  Engineering type is a trigger for review, never an automatic boundary: do not
  require separation merely because two changes carry different labels or types,
  and do not merge them merely because the types match. The governing rule stays
  `1 Work Item = 1 independent, meaningful engineering outcome`; never group or
  split solely by commit, PR, domain, implementation layer, or engineering type.
  Cross-cutting changes (a dependency/library migration, a shared-module move)
  get the same outcome-independence test: keep them inside one item when they
  genuinely serve that outcome; split them into their own item when the change is
  itself an independently meaningful outcome for the reader — decide by outcome
  independence, never by implementation type alone.
- **Merge commits** are not independent accomplishments; they carry evidence for the
  work they merged. Never duplicate that work into a second item.
- **Reverts**: do not require every revert to appear in the report, and never make
  an item open with its revert history by default — the result leads, revert
  context follows only when it earns its place. Mention a
  revert only when it materially explains the final outcome, the current state, a
  meaningful limitation, or why the resulting implementation differs from an
  earlier attempt; a revert existing in Git history is not by itself report-worthy.
  When mentioned, interpret it with the following history: if A (incomplete) -> B
  (revert) -> C (final), report C as the accomplishment and never present reverted
  or incomplete work as completed. A revert is its own Work Item only if it had
  its own significant outcome (e.g., keeping an unhealthy state out of the
  mainline). Never invent the operational failure mechanism, regression, root
  cause, or reason for a revert when repository evidence does not establish it —
  if the repository only proves that something was reverted, report only that
  supported fact.
- **Work in progress / incomplete work**: never represent incomplete work as
  completed delivery. When ongoing work is materially relevant, anchor its status
  to concrete technical evidence (completed schema or migration work, implemented
  API behavior, passing relevant tests, completed integration pieces, verified
  repository state). Do not use unsupported percentage-complete claims.
- **Abandoned prototypes / spikes**: do not automatically frame abandoned,
  reverted, or failed prototypes as "risk reduction". Report the actual
  evidence-supported result: what was attempted, what limitation or finding was
  established, what state the repository ended in. Describe the work as risk
  reduction only when the evidence genuinely supports that interpretation; do not
  fabricate a tested hypothesis, architectural direction, or risk outcome merely
  because a prototype was discarded.
- **No empty or truncated output**: the final report must never contain empty
  headings, empty Work Items, dangling sections, obviously truncated fragments, or
  unsupported placeholder content. If an extracted Work Item has no defensible
  engineering outcome or sufficient evidence, omit it entirely. This is an output
  quality requirement, not a mandate for any specific validator technology.
- **Final split/merge re-audit before report output**: after drafting the narrative
  and before delivering the report, re-audit every Work Item boundary once more —
  the grouping decision from earlier steps is not final until this pass clears it.
  For each item ask: does it still contain exactly one independent, meaningful
  outcome (nothing that should be split out), and is there any other item whose
  outcome is actually the same outcome reported twice (nothing that should be
  merged)? Shared purpose, domain, or context alone never justifies merging;
  multiple implementation steps of one outcome alone never justify splitting.
  Re-auditing may retitle headings to match re-scoped items. Fix every boundary
  that fails, then run the acceptance tests on the corrected items.

## Approved rule set (canonical source of truth)

Four approved reporting rules are defined verbatim in
[references/approved-rules.md](references/approved-rules.md): **RULE-01 Outcome
over Activity**, **RULE-02 Reader-Centered Abstraction**, **RULE-03 System-Level
Meaning**, **RULE-04 Relevant Technical Detail**. They apply to every Work Item.
The operational guidance in Steps 1–4 and the reference files restates them for
execution flow; where wording differs, `approved-rules.md` is canonical, including
its application conditions and exceptions (e.g., RULE-01/RULE-02 do not apply to
line-by-line diff audits or developer-to-developer review contexts).

## Step 2 — Write at outcome level, not activity level (RULE-01, RULE-03)

| Level | Example | Verdict |
|-------|---------|---------|
| 0 Activity | "File X changed; 17 files touched." (also hours logged, commit counts, line churn — RULE-01) | Rejected |
| 1 Technical action | "Validation logic was redesigned." | Acceptable but usually insufficient |
| 2 Engineering outcome | "Validation logic was redesigned so Y is enforced." | Good |
| 3 System significance | "...so stored states remain readable while creation now rejects Z." | Best, when evidence allows |

Prefer the highest level the evidence supports. The central question for every
item: **"After this change, what is possible or different in the system?"** For
each item ask specifically: what became *possible, different, enforceable,
observable, testable, or readable* — and translate that into concise system-level
language.

Do not confuse: implementation mechanism with capability; UI-level behavior with
system-wide enforcement; test coverage with correctness; a refactor with a
business outcome; a design/planning reference with system context.

Detail selection follows **RULE-04**: retain technical detail that materially
explains behavior, constraints, architecture, security boundaries, performance
characteristics, public contracts, or validation; filter out low-level noise,
routine syntax edits, and refactoring clutter. Order inside an item stays
outcome/capability -> relevant technical detail: a mechanism such as `ARIA grid` or
`ELK` never leads or dominates the item unless it is materially important to the
outcome. Do not over-correct the
vocabulary: keep technical terms that carry meaning for a technical reader (API,
E2E, Integration Test, RBAC, Database, Graph, Baseline, Traceability,
Architecture). The goal is not "simplify everything" — it is **remove
unnecessary internal detail while preserving useful engineering meaning**. Drop
names that add noise (helper and hook identifiers, layer paths, line counts).
Detail-budget examples live in [references/patterns.md](references/patterns.md)
(P8).

Context is optional: never force a "why". Types (problem-driven, feature-driven,
greenfield, engineering-driven, architectural-constraint, investigation-driven),
the forbidden-invented-facts list, the no-forced-business-value / no-forced-KPI
rules, verb-scope precision, and test-evidence limits are detailed in
[references/evidence-rules.md](references/evidence-rules.md). Read it before
writing any sentence that claims a *why*, an *impact*, or a
*prevention/guarantee*.

## Step 3 — Output format

```markdown
### [Outcome-oriented title]

[Integrated narrative, preferably 2–5 sentences]
```

- Title: short, outcome-oriented, no dates/times/file counts, independent of the
  commit message. Vague internal pointers such as "based on the new design" or
  "Phase 2.5" are banned from titles.
- **Heading scope proportionality**: each Work Item heading must accurately
  reflect the scope supported by its evidence and must not imply a broader
  system-level change than the underlying evidence supports. Localized
  test-script fixes do not earn a heading implying broad "test infrastructure
  stabilization"; four isolated script/tool fixes get a title scoped to those
  fixes. If the heading claims more than the item's sentences prove, narrow the
  heading (or split the item). A heading that enumerates multiple independent
  outcomes ("X and Y and Z") signals bundled items: split the item so each heading
  matches its own evidence.
- **Result first**: open with what was built/changed and what it enables; put revert
  or history context after the result, not before it.
- **Capability first**: present the capability or outcome before the implementation
  mechanism. Prefer "Traceability Matrix was added to let users inspect and manage
  Requirement-Test Case relationships" over "An ARIA grid was implemented with
  selected-cell write operations"; implementation detail may follow when it adds
  useful technical meaning. This is an ordering preference, not a rigid sentence
  template: lead with the mechanism only when the mechanism itself is the
  outcome's meaning (e.g., isolation, layout shape, a contract change). An
  implementation mechanism (`ARIA grid`, `ELK`, a rendering strategy) must not
  lead or dominate an item — title, opening sentence, and bulk of the narrative —
  unless it is materially important to understanding the outcome; when material,
  it still comes after the outcome statement, not before it.
- **Outcome framing without formulas**: open items with the natural result of the
  work — what exists, works, or became possible now — phrased the way an engineer
  would state it. Do not fall back on formulaic openings such as «قابلیت X پیاده‌سازی
  شد» ("the X capability was implemented") that announce implementation without
  adding information beyond the title; say what the capability does or what changed
  instead. This bans the reflex, not a word: there is no mandatory sentence
  template, and when plain delivery wording genuinely carries the evidence (a new
  view really was built), ordinary direct phrasing is fine.
- **Sentence rhythm**: when adjacent sentences describe similar changes (parallel
  fixes, repeated feature constructions), vary their structure and length so the
  report does not read as one template refilled — avoid consecutive sentences with
  identical openings, mirrored clause shapes, or uniform cadence. Vary naturally,
  driven by what each sentence actually says; never swap in synonyms or restructure
  merely for variety, and never alter a claim while reshaping its sentence.
- **Sentence-utility rule**: every sentence must deliver at least one of Context /
  Engineering Work / Outcome / System Significance / Evidence / Status-Limitation.
  If a sentence delivers none of these, remove it.
- Every repository-specific term (`captured set`, `UNCHANGED`, `reconstitute`,
  Baseline…) needs a few words of plain meaning attached on first use.
- File counts and LOC appear only when scope/migration/unusual size genuinely matters.

Before finalizing, apply the reader-facing checks in
[references/reader-model.md](references/reader-model.md) (operational form of
**RULE-02**): the self-explanatory vs opaque terminology classes, the
internal-reference rule, and the Reader Independence Test.

## Step 4 — Language and tone (skill is English; report may be Persian)

The report language follows the user's request. Tone rules apply in any language:
sound like an experienced engineer, not marketing, HR, or a changelog. Preferred
verbs: implemented, redesigned, isolated, enforced, validated, covered, migrated,
split, hardened, removed. Weak verbs to avoid: "worked on X", "some changes were
made", "items were reviewed", "effort was made". Corporate/marketing patterns are
default failures: "in line with advancing…", "significant improvement", "effective
step toward…", "powerful solution", "successfully…". No first person. No decorative
emojis anywhere — not in the Skill files, references, examples, headings, or
metadata; use plain Markdown only.

**For Persian reports**, load [references/persian-output.md](references/persian-output.md)
before drafting prose and again before delivering. Core stance: write as a
Persian-speaking software engineer would — translate meaning and sentence
structure, never words; select terminology contextually by asking what the
engineering field itself writes (a Persian equivalent is used only when it is at
least as clear to the reader as the term it replaces — established engineering
loanwords are preferred over forced literary or dictionary-derived Persian, and
never invent a rendering you have not seen practitioners use); resolve an
ambiguous technical term's actual domain meaning from the code's behavior before
rendering it, keeping lifecycle distinctions (retire, delete, archive, deactivate)
semantically separate; English terms,
acronyms, identifiers, commands, error codes, and version strings stay verbatim
in Latin script inside protected spans — including observed error codes inside a
limitation, which must not be smoothed into vague wording; keep consistency without synonym-cycling
for variety; strip translationese at sentence level (bureaucratic verbs, calqued
function words, English-shaped syntax, AI-style clusters, formulaic «قابلیت X
پیاده‌سازی شد» openings, uniform cadence across adjacent sentences — all judged as
recurring pattern-level signals, never word-level blacklists); keep deterministic
orthographic mechanics separate from judgment decisions. Naturalness never changes
an engineering claim: scope qualifiers and precision outrank fluency. After the
engineering self-check passes, run the separate language-only editorial pass
defined there (terminology / naturalness / fidelity / mechanics).

## Step 5 — Self-check before delivering

Run every Work Item through the 21 acceptance tests, both Definitions of Done
(Work Item + Daily Report), and the PASS/FAIL scorecard in
[references/validation.md](references/validation.md); test 17 checks each Work
Item against RULE-01..RULE-04 as specified in
[references/approved-rules.md](references/approved-rules.md), test 19 checks
each heading for scope proportionality against its evidence, test 20 checks
that claimed bases/sources of an implementation are evidenced artifacts, and
test 21 runs the final split/merge grouping re-audit across all items before
report output. Fix anything that
fails; if a claim cannot be defended from the evidence, remove or downgrade the
claim — never invent support for it. **For Persian output, then run the separate
language-only editorial pass in
[references/persian-output.md](references/persian-output.md)** (terminology and
translation naturalness, independent of engineering content; it must not alter any
engineering claim). Deliver only when every dimension passes.

## Reference files (load on demand)

- [references/approved-rules.md](references/approved-rules.md) — canonical
  RULE-01..RULE-04 specifications (normative rules, application conditions,
  exceptions, decision guidance, good/bad examples).
- [references/evidence-rules.md](references/evidence-rules.md) — context types,
  greenfield rule, forbidden invented facts, strongest-supported-claim principle,
  no-forced-business-framing, evidence-grounded vs evidence-limited, verb-scope
  precision, test-vs-claim limit, status vocabulary, risk discipline.
- [references/reader-model.md](references/reader-model.md) — terminology classes,
  internal-reference handling, independence rule, style tables, reader tests.
- [references/validation.md](references/validation.md) — DODs, 21 acceptance tests,
  reject patterns, scorecard.
- [references/patterns.md](references/patterns.md) — worked BAD:/GOOD: examples per pattern.
- [references/persian-output.md](references/persian-output.md) — Persian report
  language policy: contextual terminology decisions, translationese removal,
  precision guardrails, final language-only editorial pass. Load only for Persian
  output.
- [references/ATTRIBUTION.md](references/ATTRIBUTION.md) — provenance and
  licensing notes for the principles behind the Persian language layer. Read only
  when redistributing the skill package.
- [assets/report-template.md](assets/report-template.md) — exact output skeleton.
- `evals/persian-language-evals.json` — behavior evaluations for the Persian
  language layer; run when the language policy changes. Not loaded during normal
  report generation.
- `evals/work-item-grouping-evals.json` — behavior evaluations for Work Item
  decomposition and heading scope proportionality; run when grouping rules
  change. Not loaded during normal report generation.

## Scope (neutrality)

This standard applies to any repository, project, stack, or language — frontend,
backend, QA, infrastructure, tooling, documentation, migration, refactoring, bug
fixing, greenfield development. It must not depend on any specific product name,
framework, architecture style, domain, or organizational naming.
