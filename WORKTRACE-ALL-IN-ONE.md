# WORKTRACE - All-In-One Document

> Generated file. Do not edit directly; edit the source files and regenerate via `scripts/build-all-in-one.sh`.

Source layout:

```text
README.md
.cline/skills/worktrace-daily-report/SKILL.md
.cline/skills/worktrace-daily-report/references/ATTRIBUTION.md
.cline/skills/worktrace-daily-report/references/approved-rules.md
.cline/skills/worktrace-daily-report/references/evidence-rules.md
.cline/skills/worktrace-daily-report/references/patterns.md
.cline/skills/worktrace-daily-report/references/persian-output.md
.cline/skills/worktrace-daily-report/references/reader-model.md
.cline/skills/worktrace-daily-report/references/validation.md
.cline/skills/worktrace-daily-report/assets/report-template.md
```

---

## README.md

## WORKTRACE

Engineering evidence -> daily engineering report, as a Cline/Agent Skill.

- `.cline/skills/worktrace-daily-report/` — the skill (project-skill location per Cline docs; commit this directory so the team shares it).
- `SKILL.md` is the entry point; detailed rules load on demand from `references/`, output skeleton in `assets/`.
- The skill defines the standard; a runtime model produces the report (language follows the user request).

### Reading copy

`WORKTRACE-ALL-IN-ONE.md` is a generated single-file concatenation of all docs for convenient reading. Regenerate it before every push:

```bash
./scripts/build-all-in-one.sh
```

---

## .cline/skills/worktrace-daily-report/SKILL.md

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

## WORKTRACE — Engineering Evidence -> Daily Report

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

### Reader model

Write for a CTO / Engineering Manager who knows the project at a high level but has
**no access to implementation details, git history, internal planning, or internal
naming**. After reading, they must be able to answer:

- What was built, fixed, or changed?
- What capability or behavior does the system now have?
- Why was it done — only if the evidence says so?
- What does this mean at the system level?
- Is the work complete, or is there a limitation / blocker / follow-up?

### Processing chain (required flow)

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

### Step 1 — Identify Work Items and group correctly

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

### Approved rule set (canonical source of truth)

Four approved reporting rules are defined verbatim in
[references/approved-rules.md](references/approved-rules.md): **RULE-01 Outcome
over Activity**, **RULE-02 Reader-Centered Abstraction**, **RULE-03 System-Level
Meaning**, **RULE-04 Relevant Technical Detail**. They apply to every Work Item.
The operational guidance in Steps 1–4 and the reference files restates them for
execution flow; where wording differs, `approved-rules.md` is canonical, including
its application conditions and exceptions (e.g., RULE-01/RULE-02 do not apply to
line-by-line diff audits or developer-to-developer review contexts).

### Step 2 — Write at outcome level, not activity level (RULE-01, RULE-03)

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

### Step 3 — Output format

```markdown
#### [Outcome-oriented title]

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

### Step 4 — Language and tone (skill is English; report may be Persian)

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

### Step 5 — Self-check before delivering

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

### Reference files (load on demand)

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

### Scope (neutrality)

This standard applies to any repository, project, stack, or language — frontend,
backend, QA, infrastructure, tooling, documentation, migration, refactoring, bug
fixing, greenfield development. It must not depend on any specific product name,
framework, architecture style, domain, or organizational naming.

---

## .cline/skills/worktrace-daily-report/references/ATTRIBUTION.md

## Attribution and licensing — Persian language layer

The terminology, naturalness, and protection principles in
`references/persian-output.md` were developed after studying three open-source
projects. No text, lexicon data, code, or example lists were copied from any of
them; the rules are original WORKTRACE wording adapted to engineering-report
output. Sources are cited for provenance only.

### Sources studied

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

### Why no data was imported

Both MIT-licensed projects allow reuse with attribution, but their core asset
is a general-purpose EN->FA lexicon. WORKTRACE deliberately rejects a
dictionary-driven design (see persian-output.md section 3): its terminology
decisions come from domain usage reasoning, not lookups. Importing word lists
would contradict the skill's central rule and add context weight without
behavior gain. If a future version ever bundles third-party lexical data, this
file must record the dataset, its license, and preserve upstream attribution
notices.

---

## .cline/skills/worktrace-daily-report/references/approved-rules.md

## Approved WORKTRACE Reporting Rules (RULE-01..RULE-04)

Source-of-truth rule specifications for the reporting behavior. Load during
drafting and again during the self-check pass. Where an operational restatement
of the same requirement exists elsewhere in this Skill, it refers here; these
four specifications remain canonical and are not reinterpreted.

---

#### RULE-01 — Outcome over Activity

* **Rule ID**: `RULE-01`
* **Rule Name**: `Outcome over Activity`
* **Normative Rule**: Report meaningful engineering outcomes, capabilities, behavioral changes, resolved problems, validated findings, or relevant engineering improvements rather than raw activity such as hours, commit counts, file counts, or line churn.
* **Rationale**: Research in software engineering and management demonstrates that activity metrics (such as hours logged, commits pushed, file counts, or lines modified) measure effort or busyness rather than delivered value. High line churn or commit volume frequently indicates unstable refactoring, scope creep, or inadequate architectural planning, whereas small code changes can resolve major defects or deliver critical capabilities. Reporting activity volume without outcome context creates misleading signals regarding actual progress.
* **Application Conditions**: Applies to daily status updates, progress summaries, release notes, and engineering reports intended for engineering managers, CTOs, and cross-functional stakeholders.
* **Exceptions / Non-Application Conditions**: Does not apply to granular peer code reviews, line-by-line diff audits, or version control system log analysis where explicit file modification counts or line changes are directly required for technical verification.
* **Decision Guidance**: When available evidence contains both activity descriptions and technical outcome information, prioritize the outcome and reframe or omit the activity details. When outcome evidence is limited or incomplete, report the verified technical state change (e.g., "Deployed endpoint", "Added regression test") rather than speculating on unverified broader impacts or resorting to counting input volume (hours, commits).
* **Good Examples**:
  1. "Resolved an intermittent session timeout bug, preventing unexpected user disconnections during active sessions."
  2. "Added integration tests for edge-case failure modes in payment processing to verify handler behavior."
  3. "Migrated core lookup queries to use a composite index, reducing request processing latency."
* **Bad Examples / Anti-patterns**:
  1. "Spent 8 hours coding, pushed 14 commits, and modified 450 lines of code across 6 files."
  2. "Logged 40 hours this week attending team syncs and working through tickets."
  3. "Updated 12 CSS files and modified 3 backend helper classes."
* **Source Evidence**: *Evidence-Based Daily Engineering Reporting: Technical Foundations, Executive Communication, and Automated Synthesis Patterns*; *14 Productivity Metrics That Track Output, Not Activity - Toggl*; *Digital Transformation ROI: Getting Beyond Vanity Metrics*.
* **Evidence Strength**: Strong
* **Provenance**:
  * **Directly supported by sources**: Distinguishing output and outcomes from input and activity metrics; recognizing that activity volume (hours, lines, commits) does not correlate with value delivered.
  * **Reasonable operational inference**: Structuring daily status reporting to reframe raw version control input logs into technical state changes.
  * **WORKTRACE-specific operationalization**: Standardizing `RULE-01` as a mandatory evaluation filter within the reporting Skill.

---

#### RULE-02 — Reader-Centered Abstraction

* **Rule ID**: `RULE-02`
* **Rule Name**: `Reader-Centered Abstraction`
* **Normative Rule**: Write for the intended reader rather than for the repository. Translate or omit internal issue keys, class/method names, local terminology, planning labels, and repository-specific jargon when they do not contribute meaningful information to the reader.
* **Rationale**: Internal repository nomenclature (such as ticket keys, local class names, or internal feature flag constants) introduces cognitive friction for readers who manage multiple projects or lack low-level codebase familiarity. Abstracting technical changes into plain-language domain context allows readers to evaluate functional state changes and system progress without needing to decode repository internals.
* **Application Conditions**: Applies when summarizing engineering progress for readers outside the immediate implementation squad, including Engineering Managers, CTOs, VPEs, and cross-functional leaders.
* **Exceptions / Non-Application Conditions**: Does not apply to developer-to-developer code review discussions, internal issue tracker threads, or technical debugging logs where exact issue identifiers, method signatures, and class names are required for precise code traceability.
* **Decision Guidance**: Identify internal identifiers (such as ticket keys, internal method signatures, or capability flags). If an identifier can be translated into its domain purpose (e.g., `AuthTokenManager.refreshToken()` -> "authentication token refresh mechanism"), replace it with the plain-language domain description. If an internal term or flag does not provide useful meaning to the intended reader, omit it. Do not treat internal terminology as universally forbidden; retain or translate it when it provides necessary context.
* **Good Examples**:
  1. "Fixed an authentication token refresh failure that caused active web sessions to expire unexpectedly."
  2. "Restricted administrative project settings access to authorized user roles."
  3. "Reorganized navigation menu items into standard functional categories."
* **Bad Examples / Anti-patterns**:
  1. "Resolved race condition in `AuthTokenManager.refreshToken()` for ticket PROJ-1042."
  2. "Gated access to Settings tab using the `MANAGE_PROJECT` capability flag."
  3. "Refactored `entities/trace` mapper module and updated `useTable` hooks."
* **Source Evidence**: *Evidence-Based Daily Engineering Reporting: Technical Foundations, Executive Communication, and Automated Synthesis Patterns*; *The ACE of Soft Skills: Attitude, Communication and Etiquette for Success*; *Githru: Visual Analytics for Understanding Software Development History Through Git Metadata Analysis*.
* **Evidence Strength**: Strong
* **Provenance**:
  * **Directly supported by sources**: Literature on technical communication and software history visualization establishing that repository-level jargon and ticket keys increase cognitive friction for managerial and executive readers.
  * **Reasonable operational inference**: Replacing internal class names and feature flags with plain-language domain equivalents in daily updates.
  * **WORKTRACE-specific operationalization**: Defining `RULE-02` as an explicit translation gate in the WORKTRACE Skill.

---

#### RULE-03 — System-Level Meaning

* **Rule ID**: `RULE-03`
* **Rule Name**: `System-Level Meaning`
* **Normative Rule**: Do not stop at describing what changed technically. Explain what became possible, different, observable, controllable, enforceable, testable, or otherwise meaningful at the system level, when the available evidence supports such a statement.
* **Rationale**: Localized code modifications (such as AST edits, function parameter updates, or file reorganizations) describe implementation mechanics but obscure overall software progress. Synthesizing code changes into system-level functional capabilities or behavioral state changes enables readers to understand how software behavior, reliability, or control mechanisms have evolved.
* **Application Conditions**: Applies when summarizing non-trivial code modifications, refactorings, security updates, or feature additions where available evidence indicates a system-level or behavioral consequence.
* **Exceptions / Non-Application Conditions**: Does not apply to routine maintenance patches, minor formatting edits, or localized code updates where no meaningful system-level consequence can be supported by the available evidence. Do not force a system-level significance statement when none exists.
* **Decision Guidance**: Evaluate the technical change set and determine whether available evidence supports a statement of broader system-level capability, observability, security, or constraint enforcement. If supported, articulate the system-level state change clearly. If evidence only supports a localized technical outcome, state the technical outcome concisely without forcing or fabricating unsupported system-level claims.
* **Good Examples**:
  1. "Added a matrix-based requirement-to-test mapping view, enabling verification of test coverage across active system requirements."
  2. "Established automated database connection pooling, preventing connection exhaustion during high concurrent request bursts."
  3. "Implemented role-based permission checks on export endpoints, enforcing data access governance across user roles."
* **Bad Examples / Anti-patterns**:
  1. "Added `TraceabilityGrid.tsx`, updated database query parameters, and imported grid icons."
  2. "Created `ConnectionPool.java` and modified the connection configuration file."
  3. "Modified 4 files in the export controller directory."
* **Source Evidence**: *Evidence-Based Daily Engineering Reporting: Technical Foundations, Executive Communication, and Automated Synthesis Patterns*; *ReleaseEval: A Benchmark for Evaluating Language Models in Automated Release Note Generation*; *Automatic Generation of Pull Request Descriptions*.
* **Evidence Strength**: Strong
* **Provenance**:
  * **Directly supported by sources**: Empirical findings in neural code summarization and PR description generation showing that synthesizing changes into functional units (`tree2sum`/`commit2sum`) provides significantly higher comprehension than describing raw diffs (`diff2sum`).
  * **Reasonable operational inference**: Framing technical deltas in terms of what became observable, controllable, or enforceable at the system level.
  * **WORKTRACE-specific operationalization**: Formulating `RULE-03` as a normative rule for contextual synthesis in WORKTRACE.

---

#### RULE-04 — Relevant Technical Detail

* **Rule ID**: `RULE-04`
* **Rule Name**: `Relevant Technical Detail`
* **Normative Rule**: Retain technical details when they materially explain behavior, constraints, architecture, security boundaries, performance characteristics, public contracts, or validation, while filtering out low-level implementation noise, routine syntax edits, and internal refactoring clutter.
* **Rationale**: Omitting all technical context reduces reports to vague generalities that lack substance and auditability. Retaining key technical mechanisms, architectural boundaries, or public contract changes provides necessary clarity for evaluating technical risk and system stability. However, excessive implementation clutter (such as line-by-line diff steps, minor styling tweaks, or routine dependency sub-version bumps) creates noise that obscures essential information.
* **Application Conditions**: Applies when reporting architectural decisions, non-obvious bug remediations, breaking contract changes, performance optimizations, security boundaries, or structural infrastructure updates.
* **Exceptions / Non-Application Conditions**: Does not apply to routine maintenance chores, minor styling tweaks, or trivial bug fixes where detailed implementation mechanics do not add explanatory value.
* **Decision Guidance**: Evaluate technical details against whether they materially explain system behavior, constraints, security boundaries, performance characteristics, public API contracts, or validation mechanisms. If they do, retain them in concise form. If they describe routine syntax edits, minor UI layout rules, or internal refactoring clutter that does not alter public contracts or system constraints, omit them. Do not treat all technical details as noise.
* **Good Examples**:
  1. "Resolved a memory leak in thread execution by enforcing explicit resource cleanup in worker processes, preventing process restarts during high concurrency."
  2. "Updated public API endpoints to require v2 authorization headers, establishing a migration path for legacy clients."
  3. "Decoupled the billing module into an isolated service interface, removing circular dependencies between core modules."
* **Bad Examples / Anti-patterns**:
  1. "Fixed a bug by changing `if (x == null)` to `if (x === null)` on line 42 of `Utils.js`."
  2. "Updated dependency package `icon-library` from 3.30.1 to 3.31.0 and adjusted grid width breakpoint to 640px."
  3. "Fixed various backend bugs in the server code."
* **Source Evidence**: *Evidence-Based Daily Engineering Reporting: Technical Foundations, Executive Communication, and Automated Synthesis Patterns*; *ReleaseEval: A Benchmark for Evaluating Language Models in Automated Release Note Generation*; *Detecting Multiple Semantic Concerns in Tangled Code Commits*; *Explainable Software Bot Contributions: Case Study of Automated Bug Fixes*.
* **Evidence Strength**: Strong
* **Provenance**:
  * **Directly supported by sources**: Literature on commit summarization, release note benchmarking, and explainable software contributions establishing that retaining key technical rationale and behavioral differences improves understanding while filtering low-value noise.
  * **Reasonable operational inference**: Establishing explicit criteria for what technical details add material value (architecture, contracts, security, validation) vs. what constitutes noise.
  * **WORKTRACE-specific operationalization**: Formalizing `RULE-04` as a balanced detail-filtering specification for the WORKTRACE Skill.

---

## .cline/skills/worktrace-daily-report/references/evidence-rules.md

## Evidence & Inference Rules

Load this reference before writing any sentence that asserts a *why*, an *impact*,
a *prevention/guarantee*, or a *status*. It defines what may be inferred from
evidence and what must never be invented.

### 1. Context / Rationale — optional, evidence-driven

Context is required only when the evidence supplies it. Never force a "why" onto a
Work Item. If evidence is insufficient, start directly from the engineering work.

Accepted context types:

- **Problem-driven** — an incorrect behavior or limitation existed.
  *"State saved earlier was incompatible with the new validation and still had to
  remain readable."*
- **Feature-driven** — a new product capability was being added.
  *"To make relationships between artifacts observable, a new view was designed."*
- **Greenfield / product-driven** — no previous system existed; context comes from
  design, specification, domain model, architecture, or product model.
- **Engineering-driven** — reliability, maintainability, testability, architecture,
  security, tooling, performance, correctness.
- **Investigation-driven** — a failure or behavior was first investigated.
  *"E2E runs stopped before the control reached the viewport in some executions."*

Acceptable without extra context:
*"Validation logic for X was redesigned to enforce Y."*
Unacceptable unless documented:
*"To increase team productivity and improve user experience, validation logic for X
was redesigned."*

### 2. Greenfield rule

Absence of a previous system is itself a valid context. Do not fabricate a prior
deficiency to build a narrative.

- GOOD: *"To provide the ability to observe and manage X, the Y capability was designed
  and implemented."*
- BAD: *"Because the previous system could not display X, Y was redesigned."* (when no
  previous system exists in the evidence)

### 3. Evidence-grounded, not evidence-limited

Extract engineering *meaning* from evidence, but add no new facts.

- Allowed inference: from "`ts-prune` failure was treated as empty output" ->
  "tool failure was misinterpreted as an empty result." This is legitimate technical
  inference.
- Forbidden inference: from the same evidence -> "this increased team productivity."

### 4. Never construct without direct evidence

Do not invent: user complaints, customer demand, Product Owner or stakeholder
requests, business requirements, business value, ROI, productivity or customer
impact, a previous system / implementation / limitation, severity, urgency,
importance, adoption, success, performance / reliability / security improvement,
completeness claims, user satisfaction. If the evidence is absent, drop the claim.

**Strongest-supported-claim principle**: use exactly the strongest claim the
evidence supports — no stronger. "UI blocks invalid relationship selection" must
not become "the system prevents invalid relationships"; "tests cover the flow"
must not become "quality is guaranteed".

**Claimed bases and sources are evidence-bound too.** If the report states that an
implementation was based on, rebuilt from, or aligned with a design document,
specification, approved decision, RFC, or similar source artifact, repository
evidence must actually establish that relationship (the artifact exists in the
evidence and demonstrably drives the change). Never invent or infer the authority,
basis, or source of an implementation. When no evidenced basis exists, describe
what the code does and what state the repository ended in — drop the claimed
source entirely. This applies equally to revert narratives: "rewritten from the
approved design" is forbidden unless the approved design is in the evidence.

**No forced business framing**: do not push every Work Item into Quality / Speed /
Cost / Risk-Reduction categories, do not require a KPI or metric for a refactor,
and do not quantify impact when no quantified evidence exists.

### 5. System significance vs business value

Per **RULE-03** (see approved-rules.md): do not stop at what changed technically;
when evidence supports it, explain what became possible, different, observable,
controllable, enforceable, or testable at the system level. Do not force a
significance statement when no system-level consequence is supported — state the
localized technical outcome concisely instead. System significance explains what
the change means at the system level — it is not business value.

- GOOD: Technical significance: "a stored state remains readable even after creation
  validation was tightened"; "running Git inside specs no longer inherits the main
  repository's environment."
- GOOD: Observable capability: "coverage can now be observed directly inside the
  system."
- BAD: Unsupported commercial claim: "this increased team productivity."

### 6. No unsupported evaluation

Without evidence, never write: reliable, secure, stable, significant, substantial,
important, optimized, performant, successful, complete, "guaranteed quality",
"markedly improved". Claim strength must never exceed the evidence: guarantee and
completeness verbs ("guarantees", "ensures that ... without problems", "fully
stable") require evidence that actually demonstrates the guarantee — tests,
verified behavior, or enforced constraints in the diff. Otherwise report the
mechanism and its evidenced effect: BAD: "this guarantees historical data reads
without problems" -> GOOD: "stored states remain readable because the read path
bypasses the new creation validation" (behavior, no absolute claim). Report
behavior or evidence instead.

- BAD: "System security improved."
- GOOD: "Access to Settings is gated by the `MANAGE_PROJECT` capability, and the guard
  covers the no-capability case."

### 7. Verb-scope precision (evidence-level accuracy)

Verbs like *prevents*, *guarantees*, *ensures*, *improves*, *avoids* may only carry
the scope the evidence supports.

- **Scope qualifier**: if the constraint lives in the form layer, say
  "blocks invalid relationship creation **in the UI**" — not "prevents invalid
  links" (API/domain may hold the real constraint).
- **Factual over interpretive**: "shared logic moved to one layer so tree and matrix
  read coverage from a single place" (fact) rather than "prevents code duplication"
  (interpretation).
- **No fabricated causality**: a layout engine does not "enforce domain rules";
  rendering rules are applied *through* it. Prefer "display rules for link
  direction, legacy style, and retired links are applied in rendering."
- **Terminology accuracy**: a capability/permission check is authorization, not
  authentication. BAD: "removed when authentication is missing" -> GOOD: "hidden when the
  capability is absent."

### 8. Test evidence — coverage is not a grander claim

Tests are part of the outcome when they actually are; report them precisely and
never inflate them.

- Bad: "quality was guaranteed."
- Good: "the new flow is covered by an integration test."
- Better: "new behavior is covered by model and UI tests; main interaction paths are
  validated."
- Forbidden: "20 tests were added, therefore the feature is fully assured." The
  evidence says only: 20 tests were added.

### 9. Status vocabulary

Reflect status when history supports it — Complete / Partial / Blocked / Reverted /
Limitation. If evidence gives no status signal, invent none.

Example (Partial + Limitation): "smoke payloads now match the API schema, but full
execution against a fresh database reaches `404 USER_NOT_FOUND` because the created
identities have no accounts; continuing this flow requires creating matching
accounts."

Keep that example's shape in every limitation you report: the observed error code
and failed check stay in the sentence verbatim. Do not weaken evidence-rich
limitations into vague wording ("some issues remain", "the flow is not fully
stable"), and do not let the smoothing pass drop the concrete signal — the claim
must not exceed the evidence, and it must not fall below it either.

Never represent incomplete work as completed delivery. When ongoing work is
materially relevant, anchor its status to concrete technical evidence — completed
schema or migration work, implemented API behavior, passing relevant tests,
completed integration pieces, verified repository state — not to unsupported
percentage-complete claims ("70% done", "mostly finished").

### 10. Risk / limitation / follow-up discipline

- Do not hide a material limitation just to make the text look positive.
- Do not manufacture risk: complexity alone is not risk; few tests alone are not
  high risk. Only evidence-driven statements about risk are allowed.
- **Evidence boundary for reverts, failures, limitations, validation results, and
  status**: the strength of the claim must not exceed the available repository
  evidence. Do not infer root cause, failure mechanism, risk reduction, production
  readiness, stability, or completeness unless the evidence supports the claim.
  Preserve the actual scope of the evidence: if evidence only shows that a UI
  interaction blocks an invalid relationship, do not generalize that into a
  system-wide or database-level integrity guarantee.
- **Preserve concrete observed evidence**: error codes (`404 USER_NOT_FOUND`,
  `INVALID_CHANGE_SET_ARTIFACT_STATE`), failed checks, exit codes, and rejected
  inputs captured in the evidence are part of the limitation's content — keep them
  verbatim (Latin script, protected spans) instead of smoothing them into vague
  wording ("some issues remain", "the flow does not fully work"). A limitation
  stated with its observed signal is both more accurate and more actionable;
  naturalization never justifies diluting it. The bound runs one way only: keep the
  evidence as strong as it is, and no stronger — never extend a recorded error code
  into an unobserved cause, severity, or system-wide conclusion.
- Abandoned prototypes/spikes are reported as what was attempted, what finding or
  limitation was established, and the final repository state — not automatically
  as "risk reduction" unless the evidence genuinely supports that framing.

### 11. Technical detail policy

Per **RULE-04** (see approved-rules.md): retain technical details that materially
explain behavior, constraints, architecture, security boundaries, performance
characteristics, public contracts, or validation; filter out low-level
implementation noise, routine syntax edits, and internal refactoring clutter. Do
not treat all technical details as noise.

- Valuable when shape of outcome depends on it: "ELK layered layout with orthogonal
  routing."
- Report-valueless: "`GraphLayout.ts` changed from line 42 to 187."
- Default: file counts and LOC are not part of the narrative — except when scope,
  migration, unusual volume, or breadth of a refactor genuinely requires them.

---

## .cline/skills/worktrace-daily-report/references/patterns.md

## Worked Patterns (Rejected vs. Accepted)

Concrete before/after examples — the single source of truth for pattern examples;
rule files reference these instead of repeating them. Use them as style anchors
when drafting; the narrative language of a real report follows the user's request
(Persian examples are rendered in English here — keep Persian natural and technical
terms in English at runtime).

### P1 — Bug fix / flaky E2E (investigation-driven)

Evidence: `e2e fails because account menu is below viewport` · `wait for aria-busy` ·
`require viewport before click`.

- BAD: "The E2E test was fixed."
- GOOD: "Opening the account menu in E2E now waits for page loading to finish, and the
  menu's presence in the viewport is checked before clicking."
- BEST: "In some E2E runs the account menu was clicked outside the viewport before
  loading completed. The task now waits until `aria-busy` clears and verifies the
  menu is accessible in the viewport before clicking."

### P2 — Refactor with compatibility constraint

Evidence: `mapper uses create()` · `create() now rejects old state` ·
`replace mapper with reconstitute()`.

- BAD: "The mapper was refactored."
- GOOD: "Rebuilding stored states moved from `create` to `reconstitute`, so the new
  creation validation no longer blocks reading older states."
- Preferred full shape: "Stored states had to remain readable after creation
  validation tightened. The mapper was moved into `reconstitute`; `create` now
  returns a specific error for an `UNCHANGED` state carrying two different
  snapshots; round-trip and domain tests cover read and write behavior."

### P3 — Greenfield feature (model + API + UI + tests = one Work Item)

Evidence: new page, new API, new model, new tests.

- BAD: "The previous system could not display X." (no prior system exists)
- GOOD: "To provide viewing and management of X, its model, API, and view were
  implemented; main flows are covered by the related tests."

### P4 — Infrastructure / test hardening

Evidence: `GIT_DIR leaks into tests` · `temporary git init touches real repo` ·
`remove Git env vars`.

- BAD: "Git tests were updated."
- GOOD: "Git execution in the affected specs was isolated from the main repository's
  environment so a temporary `git init` cannot act on the repository being pushed."
- BEST: "Specs that run Git themselves were cleared of `GIT_DIR`, `GIT_WORK_TREE`,
  and `GIT_INDEX_FILE` so the main repository's environment no longer leaks into
  temporary Git operations."

### P5 — Limitation must stay visible

Evidence: invite API passes schema · fresh DB returns 404 USER_NOT_FOUND · IDs are
not accounts.

- BAD: "The invitation problem was fully solved."
- GOOD: "Smoke payloads now match the API schema, but full execution against a fresh
  database reaches `404 USER_NOT_FOUND` because the created identities have no
  valid accounts; continuing this flow requires creating matching accounts."

### P6 — Capability gating (terminology accuracy)

- BAD: "Settings is hidden when required authentication is missing." (capability is authorization, not authentication)
- GOOD: "Access to Settings is gated by the `MANAGE_PROJECT` capability; without it the
  section is not shown."

### P7 — Layout engine causality (verb-scope)

- BAD: "ELK layout was implemented to enforce visual rules." (the engine applies, not
  enforces domain rules)
- GOOD: "Graph layout was implemented with ELK and orthogonal routing; link-direction,
  legacy-style, and retired-link display rules are applied in rendering."
- Scope qualifier example: "the add-link form offers only relationship triples
  allowed by the rules and blocks invalid links **in the UI**" — final constraints
  may live in API/domain.

### P8 — Shared logic move (factual over interpretive)

- CAUTION: "…moved to a shared layer to prevent code duplication." (interpretive claim)
- GOOD: "Coverage reads now come from a single shared layer used by both the tree and
  the matrix." (observable fact; helper names omitted — detail budget)

### P9 — Migrate with rationale/outcome (weak-outcome check)

- BAD: "Icon library migrated to Tabler 3.31.0; lucide-react removed." (no so-what)
- GOOD: "The project's icon library was migrated to Tabler 3.31.0 and the `lucide-react`
  dependency was removed so navigation icons share one consistent set." (keep only
  if evidence supports the intent)

### P10 — Result-first with revert context

- BAD: "After reverting an incomplete implementation, Specification Explorer was
  rebuilt from scratch…"
- GOOD: "Specification Explorer was implemented for managing hierarchical
  specifications (Capability/Feature/Requirement). The final version follows removal
  of an earlier incomplete attempt from the branch; the tree renders via `DECOMPOSES`
  links in the model and supports node moves (dialog, drag/drop, keyboard),
  detachment, and per-node coverage status."

### P11 — Two complementary views (grouping distinction)

- If Graph and Matrix ship together as one traceability capability, say so:
  "Two complementary traceability views were implemented: the Graph for browsing
  relationship structure, and the Matrix for reviewing active Requirements against
  Test Cases and linking/retiring relationships directly from a selected cell."
- Without such evidence of a single outcome, they remain separate Work Items.

### P12 — Domain term gloss (term meaningfulness)

- BAD: "`Baseline.publish` now takes `relations` as a required parameter to capture the
  captured set."
- GOOD: "On Baseline publish, the relations frozen into that published version are now
  always recorded — the publish call takes the relation set as a required argument."

### P13 - Capability first (mechanism after)

- BAD: "An ARIA grid was implemented with selected-cell write operations."
- GOOD: "A Traceability Matrix was added so users can inspect active Requirements
  against Test Cases and link or retire relationships directly from a selected
  cell; the grid follows the ARIA grid pattern for accessibility." (mechanism kept
  only because accessibility is part of the outcome)
- The rule generalizes to any mechanism (`ELK`, a rendering strategy, a state
  machine): outcome/capability first, relevant technical detail after; the
  mechanism may lead only when it materially *is* the outcome's meaning.

### P14 - Outcome framing without formulas

- BAD: "The Design Coverage capability was implemented." («قابلیت Design Coverage
  پیاده‌سازی شد» — announces implementation, adds nothing beyond the title)
- GOOD: "Coverage status now appears per Requirement inside the tree, computed from
  linked Test Cases." (states what works now)
- No fixed template replaces the formula: plain direct wording ("a new view was
  built") stays fine when that is exactly what the evidence shows.

### P15 - Varied rhythm across parallel sentences

- BAD: three adjacent items each opening "X was fixed…", "Y was fixed…", "Z was
  fixed…" with identical clause shape for similar fixes.
- GOOD: reshape according to what each sentence actually says — one names the
  failing check, the next leads with the behavior restored, another is short.
- Variation comes from content, not synonym cycling; claims stay byte-faithful in
  meaning while their sentences change shape.

---

## .cline/skills/worktrace-daily-report/references/persian-output.md

## Persian Output: Natural Engineering Prose, Not Translation

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

### 1. Core stance

Translate meaning and sentence structure, never words. Draft each sentence from
the engineering fact you want to convey, as a Persian-speaking software engineer
would say it to an Engineering Manager — not from the English phrasing of the
evidence or of an internal mental draft. If a sentence is only correct because its
English source sentence was correct, rewrite the sentence, not the words.

Target register: **formal-but-human** — full written forms (می‌شود، است، شد), no
colloquial contractions (میشه، رو، –ه), direct and concrete, zero bureaucratic
ceremony. This is a professional artifact for CTO/EM readers; warmth comes from
precision and short sentences, not from formality padding.

### 2. Terminology selection is a contextual decision

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

### 3. Reasoning procedure (instead of a glossary)

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

**Meaning before translation for abstract verbs and concepts.** For terms like
retire, frozen, captured, archive, publish: never map the English token to a fixed
Persian word. First determine what operation or state the software actually means
in this context — resolve the term's real domain meaning from the code's behavior
before rendering it (a link retired = deactivating an active relationship; a set
captured at publish = recorded/persisted into the baseline) — then express that
meaning with established practitioner terminology or a natural functional
description. Resolve ambiguity by evidence, never by picking a favorite Persian
word: if retire/delete/archive/deactivate cannot be told apart from the evidence,
keep the source term rather than guessing a rendering. The same English concept may
legitimately render differently across domains (graph relationships vs release
baselines vs document lifecycle). This
procedure replaces any word-level mapping rule; no `retire -> X` or
`frozen -> Y` table exists in this skill, and none should be inferred from
examples. **Lifecycle operations stay semantically distinct.** retire, delete,
archive, deactivate, restore, soft-remove, and hard-remove are different domain
operations; do not flatten them into one Persian verb, and do not present a
lifecycle transition (retire) as its opposite or as plain removal (link/unlink).
Determine which operation the code actually performs first, then express it —
the distinction is part of the engineering claim and survives naturalization.
Naturalization must never alter the technical semantics of the claim.

### 4. Sentence-level naturalness (translationese tells)

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
  است، شایان ذکر است، در نهایت). Treat these as recurring pattern-level signals —
  one ordinary «همچنین» is not a violation; the tell is repetition and clustering.
  Do not compile them into word-level blacklists: remove the construction's grip on
  the paragraph, not a specific word from the language.
- Formulaic outcome announcements in Persian reports — «قابلیت X پیاده‌سازی شد» style
  openings that declare implementation without saying what now works or became
  possible. They duplicate the heading and read as machine output; open with the
  natural result instead. This is a framing reflex to catch, not a banned phrase
  and not a replacement sentence template.
- Repetitive adjacent-sentence shape: several nearby sentences describing similar
  changes all starting the same way («… اضافه شد», «… اصلاح شد»), mirroring one
  clause structure, or running to identical length. Reshape so parallel content
  reads with varied rhythm; vary because the sentences genuinely differ, never by
  inserting synonyms for mere variety (see section 2 on consistency) and never
  while touching the claim itself.
- Excessive nominalization: stacking ezafe chains where a verb would move
  («انجام فرآیند مهاجرت تنظیمات» -> «تنظیمات migrate شد»).
- Literal collocations that exist only as shadows of English idioms.
- **English-shaped passive and relative-clause constructions.** Persian technical
  prose tolerates passive voice when it is natural; the tell is a clause shaped by
  English syntax — «… که از طریق X بازیابی می‌شود» calquing "which is retrieved
  via X", stacked trailing relative clauses, or an agentless passive chosen where
  a plain impersonal or active Persian construction is what an engineer would
  write. Recast the clause shape; do not apply a blanket active-voice rule, and do
  not alter the claim while recasting.
- **Literal dictionary translation of abstract technical concepts.** Translating a
  term by its general-language dictionary sense instead of its software meaning:
  rendering link/relationship retirement with the human-retirement verb, "frozen"
  state with the literal ice word, or similar formal equivalents that no engineer
  in the field actually uses for that operation. The fix is procedural (section
  3), never a fixed mapping table: determine the actual technical operation first,
  then express that meaning with established practitioner terminology or a natural
  functional description.
- **Unnecessary Persian/English hybrids** — redundant pairing of a translated
  form with the loanword it duplicates («از طریق انشعاب (fork)» style doubles)
  where one of the two carries all the meaning; keep the one a practitioner would
  use alone.
- **English-shaped "names/calls/considers" calques on state or object
    descriptions** — constructions like «stateای که دو snapshot متفاوت را نام
    می‌برد» (calquing "a state that names two different snapshots"), where an
    English verb of naming maps onto a Persian state description. Recast to what
    the state actually is: describe the stored relationship («وضعیتی که دو
    snapshot متفاوت را به‌عنوان پایه و فعلی نگه می‌دارد» style) instead of
    translating the English verb literally. The rewrite must sound natural while
    preserving the technical meaning exactly.
- Empty evaluative adjectives (قدرتمند، چشمگیر، اساسی، باکیفیت) — already banned as
  unsupported claims; they are also style tells.
- One idea per sentence; short sentences. Mixed sentence lengths are fine —
  uniform 15–20-word sentences read as machine output.

#### Mechanics vs judgment (two layers, never mixed)

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

### 5. Precision guardrails

Naturalness is bounded by fidelity:

- Keep every scope qualifier exactly (در سطح UI، در زمان creation) even when a
  shorter phrasing would flow better. A smoother sentence that widens a claim is
  a failed sentence.
- **Preserve concrete observed evidence.** Error codes, failed checks, and rejected
  inputs captured in the repository evidence (`404 USER_NOT_FOUND`, exit codes) are
  part of the limitation's content: keep them verbatim in Latin script instead of
  smoothing them into vague wording («مشکلاتی باقی است»). Naturalness never justifies
  weakening an evidence-rich limitation; it also never licenses extending the
  recorded signal into an unobserved cause or a broader conclusion.
- Do not convert behavior descriptions into evaluations while smoothing them
  («مسدود می‌کند» must not become «امن می‌کند»).
- Technical accuracy outranks elegance: a capability check is access-control, not
  احراز هویت; choose the precise term even if the imprecise one is more common.
- If naturalizing would require asserting something the evidence does not support,
  keep the plainer wording.

### 6. Final editorial pass (Persian output only)

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
   for English-shaped syntax, English-shaped passive/relative-clause calques,
   literal dictionary translations of abstract technical concepts, flattened
   lifecycle distinctions, English-shaped names/calls calques, redundant
   Persian/English hybrid doubles, calqued function words, bureaucratic verbs,
   AI-style clusters, formulaic «قابلیت X پیاده‌سازی شد» openings, and uniform rhythm
   or repetitive adjacent-sentence shape from section 4. Judge these as recurring
   pattern-level signals, not word-level blacklists: a single ordinary occurrence is
   fine, the tell is repetition and clustering. The test question: would a senior
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

---

## .cline/skills/worktrace-daily-report/references/reader-model.md

## Reader Model & Terminology Rules

The report is written for the **reader**, not for the repository (**RULE-02** —
Reader-Centered Abstraction, canonical specification in approved-rules.md). Load
this reference while drafting titles and narratives, and again before finalizing.
Retain or translate internal terminology when it provides necessary context; do
not treat it as universally forbidden.

### 1. Internal references are not context

Any reference that only carries meaning inside the project must not appear as
narrative context: `Phase 2.5`, `U2/U3/U4`, `P5-812`, `PR #143`, ticket IDs, branch
names, internal codenames, planning labels, milestone names the reader was never
told about, AI-agent-specific terminology. Keep such a reference only when it is
genuinely necessary and meaningful to the intended reader; otherwise translate its
meaning into system-level language or omit it. These may live in metadata/audit
trails — not in the story.

Rule — filter by **Reader Value and Technical Materiality**, not by blanket
translation or blanket omission. For every internal identifier or technical
detail, ask: does it help the target reader understand the engineering outcome;
does it materially explain system behavior, an important architecture or
integration point, a security/authorization boundary, data integrity, backward
compatibility, a public contract, or validation/operational status? If yes,
preserve the useful technical meaning and retain the identifier itself when
necessary for precision or recognition. If no, abstract or omit it. Technical
does not mean noise, and an internal identifier is not automatically useless.

For any phrase that requires repo knowledge to understand, do exactly one of:

1. delete it;
2. translate it into system-level meaning;
3. keep it (identifier included) when it carries reader value or technical
   materiality — e.g., self-explanatory to the reader, or necessary for
   precision/recognition.

Do not translate or preserve identifiers mechanically; decide per case. Example:
an internal method such as `ChangeSetArtifactState.create` may be omitted while
the underlying engineering rule is retained if the rule is meaningful to the
reader; a capability such as `MANAGE_PROJECT` may be translated into its
functional meaning when the security boundary matters, rather than exposing the
internal flag name.

BAD: "Traceability matrix and graph were implemented based on Phase 2.5."
GOOD: "Graph and matrix views were implemented for observing and managing
Requirement–Test Case relationships."

Vague internal pointers count too: **"based on the new design"** carries no
information (new relative to what?) and belongs in the same bin as `Phase 2.5`.

### 2. Terminology classes

Classify every term you are about to write:

- **A. Self-explanatory** — fine as-is: API, Database, E2E test, Integration test,
  Requirement, Test Case, Repository, CI, Migration.
- **B. Internally meaningful but externally opaque** — never in narrative unless
  explicitly translated: Phase numbers, U-codes, ticket IDs, PR numbers.
- **C. Essential proper nouns** — real capability/subsystem names stay: Traceability
  Matrix, Specification Explorer, Design Coverage.

Domain terms from the codebase (`captured set`, `UNCHANGED`, `reconstitute`,
`Baseline`) sit between B and C: keep the term **with a few words of plain meaning
on first use**. GOOD: "On Baseline publish, the full set of relations frozen into that
version is recorded…" instead of bare "captured set".

How these classes render in a Persian-language report (loanword vs Persian
equivalent vs Latin-script identifier) is a language decision governed by
[persian-output.md](persian-output.md), not by this file.
This section decides *whether* a term belongs in the narrative; that file decides
*how it reads* in the target language.

### 3. Independent outcome rule

Do not merge two Work Items merely because they share a day, a planning phase, a
feature area, or adjacent commits. Example of genuinely independent outcomes that
must stay separate: *Design Coverage* (observing requirement coverage status) vs
*Specification Explorer* (managing Capability/Feature/Requirement hierarchy).

Multiple views of one capability may be combined **only** when the narrative states
the distinction: "two complementary views of traceability — the Graph for browsing
relationship structure, the Matrix for reviewing and managing Requirement–Test Case
links."

### 4. Titles

Outcome-oriented, short, independent of commit messages, no dates/times/file lists.

GOOD: "Hierarchical artifact management implemented" · "Stored-state reads split from
creation validation" · "Git execution in tests isolated from the main repository"
BAD: "Changes related to Explorer" · "Work on the API" · "Several fixes in guards" ·
"40 files changed"

### 5. Result-first ordering

Open each item with what was built and what it enables; history (revert, prior
attempt) comes after the result, never as the opening clause. Never lead an item
with revert history by default: mention a revert only when it materially explains
the outcome, the current state, or a limitation — otherwise leave it out of the
narrative entirely. Worked example: patterns.md P10.

### 6. Implementation-detail budget

Each implementation name survives only if it improves understanding of the outcome.
Accessibility patterns (`ARIA grid`) stay when accessibility is part of the outcome;
helper names (`byCode`, `present`), hook names, and layer paths (`entities/trace`,
`shared/lib`) usually add nothing for a CTO — describe the shared-read path effect
instead ("coverage reads now come from one shared layer used by both tree and
matrix").

Do not over-correct: this budget removes noise, not meaningful technical concepts.
API, E2E, Integration Test, RBAC, Database, Graph, Baseline, Traceability, and
Architecture stay whenever they carry information for the reader. The objective is
removing unnecessary internal detail while preserving useful engineering meaning.

### 7. Weak system outcome check

If a sentence reports an action with no answerable "so what?", either attach the
evidence-backed rationale/outcome or drop the detail. BAD: "Icon library migrated to
Tabler 3.31.0; lucide-react removed." GOOD: + "…so navigation icons share one design
system set" (only if evidence supports the intent).

### 8. Reader Independence Test

Cover the title + text of each Work Item and ask: would a CTO who knows nothing of
internal phases, tickets, or planning labels understand what this work added or
fixed in the system? If not -> rewrite until yes.

---

## .cline/skills/worktrace-daily-report/references/validation.md

## Validation: DODs, Acceptance Tests, Reject Patterns, Scorecard

Load this reference during the self-check pass, before delivering the report.

### Minimum acceptable report

An item passes minimum bar when it: (1) states a concrete engineering change;
(2) rises above vague activity; (3) shows the outcome as far as evidence allows;
(4) hallucinates nothing.
Example: "Validation for `UNCHANGED` change-set states was fixed so a state that
pairs two different snapshots is rejected at creation time."

### Work Item Definition of Done (DOD-1..14)

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

### Daily Report Definition of Done (DOD-D1..14)

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

### Final acceptance tests (21; run per Work Item)

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
| 18 | Persian Naturalness (Persian output only) | Report reads as translated English: forced literary/purist Persian where engineers use the loanword, an invented coinage no field uses, transliterated or altered identifiers/commands/error codes inside protected spans, calqued English syntax, bureaucratic constructions (می‌باشد، گردید، مورد … قرار گرفت)، AI-style clusters, or inconsistent rendering of one concept. Run the four-check language-only editorial pass (terminology / naturalness / fidelity / mechanics) in persian-output.md; this test must never alter an engineering claim |
| 19 | Heading Scope Proportionality | Work Item heading implies a broader system-level change than its evidence supports (e.g., localized test-script fixes titled as broad "test infrastructure stabilization"), OR the heading bundles multiple independent outcomes under one title ("X and Y and Z"). Fix: narrow the heading to the evidenced scope, or split the item so each heading matches its own evidence |
| 20 | Evidenced Basis | Report claims an implementation was based on / rebuilt from / aligned with a design, specification, approved decision, or similar source artifact that repository evidence does not establish. Fix: drop the claimed basis and describe what the code does and the final repository state |
| 21 | Grouping Re-audit | Final split/merge pass before report output (SKILL.md Step 1): any item still bundling independently meaningful outcomes, any item split along commit/PR/domain/type/layer lines rather than outcomes, or two items reporting one outcome twice. Shared purpose, domain, or context alone never justifies merging; multiple implementation steps of one outcome alone never justify splitting. Fix boundaries, retitle affected headings, then re-run tests 14 and 19 on the corrected items |

### Reject patterns (distilled)

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

### Anti-pattern catalog (AP-1..30, recurring failure shapes)

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
- **AP-18 Blanket identifier handling** (RULE-02) — either leaking ticket keys,
  class/method names, and planning labels into narrative, or mechanically
  translating/omitting every internal identifier regardless of reader value. Fix:
  filter by Reader Value and Technical Materiality; retain the identifier when it
  is necessary for precision or recognition, translate to functional meaning when
  the underlying rule matters, omit otherwise.
- **AP-19 Diff-mechanics-only item** (RULE-03) — file/function-level changes with no
  system-level meaning stated even though evidence supports one. Fix: answer what
  became possible/observable/enforceable/testable; if unsupported, keep the
  localized technical outcome concise without forcing significance.
- **AP-20 Detail misselection** (RULE-04) — contract/security/validation-relevant
  detail dropped, or routine syntax edits, minor styling tweaks, and sub-version
  bumps reported as substance. Fix: keep material detail in concise form; cut noise.
- **AP-21 Invented revert mechanism** — stating a root cause, regression, failure
  mechanism, or reason for a revert/spike abandonment that repository evidence does
  not establish. Fix: report only the supported fact (e.g., "the earlier
  implementation was reverted"), or omit the revert when it does not materially
  explain outcome, state, limitation, or divergence.
- **AP-22 Unsupported progress claim** — percentage-complete statements ("70% done")
  or framing discarded prototypes as "risk reduction" without evidence. Fix: anchor
  status to concrete technical evidence (schema/migration completed, API behavior
  implemented, tests passing, integration pieces done, verified repo state).
- **AP-23 Empty/truncated output** — empty headings, empty Work Items, dangling
  sections, truncated fragments, or placeholder content in the final report. Fix:
  delete the artifact or omit the unevidenced Work Item entirely.
- **AP-24 Engineering-type bundling** — merging security/permission changes,
  tooling changes, dependency migrations, documentation work, or feature
  implementation into one item because they share a day, PR, phase, or domain.
  Fix: engineering-type difference triggers an outcome-boundary review; split
  when outcomes are independently meaningful, keep together only when they truly
  deliver one outcome. Type labels never force either direction.
- **AP-25 Over-broad heading** — a Work Item heading claiming system-wide scope
  ("test infrastructure stabilization", "architecture overhaul") that the item's
  evidence does not support, or a heading bundling several independent outcomes
  under one title. Fix: retitle to the evidenced scope or split the item
  (see acceptance test 19).
- **AP-26 Invented basis/source** — attributing an implementation to an approved
  design, specification, decision, or authority artifact that repository evidence
  does not establish ("rebuilt from the approved design"). Fix: report only the
  evidenced facts — what the code does, what changed, the final repository state
  (see acceptance test 20).
- **AP-27 Formulaic outcome opener** — starting items with a canned delivery
  formula such as «قابلیت X پیاده‌سازی شد» ("the X capability was implemented") that
  restates the title and adds no information. Fix: open with the natural result —
  what exists, works, or became possible — without adopting any fixed sentence
  template; plain direct delivery wording stays fine when it carries the evidence.
- **AP-28 Mechanism-dominant item** — an implementation mechanism (`ARIA grid`,
  `ELK`, a rendering strategy) leads the title/opening or fills most of the
  narrative although the reader mainly needs the outcome. Fix: outcome/capability
  first, relevant technical detail after; keep the mechanism leading only when it
  materially is the outcome's meaning (see acceptance test 16, patterns.md P13).
- **AP-29 Uniform cadence** — adjacent sentences describing similar changes repeat
  the same opening, clause shape, or length, so the report reads as one template
  refilled. Fix: vary structure and length naturally where content parallels; never
  force synonym substitution merely for variety and never alter a claim while
  reshaping its sentence.
- **AP-30 Skipped grouping re-audit** — delivering the report straight after
  drafting without the final split/merge boundary pass, letting bundled or
  over-split items survive to output. Fix: run acceptance test 21 before report
  output; correct boundaries, retitle headings, re-run tests 14 and 19.

### PASS/FAIL scorecard (final gate)

Evaluate each dimension PASS/FAIL — no numeric scores:

commit-summary-free · outcome-oriented · reader-oriented · planning-jargon-free ·
evidence-fidelity · greenfield-handling · revert-handling · limitation-visibility ·
technical-accuracy · grouping-quality · grouping-re-audit (final split/merge pass, test 21) ·
no-business-hallucination · no-corporate-fluff ·
conciseness · system-significance · sentence-utility · verb-scope · terminology-accuracy ·
term-meaningfulness · capability-first · outcome-framing-natural (no formulaic openings) ·
sentence-rhythm · no-decorative-emoji · approved-rules-compliance
(RULE-01..RULE-04 incl. exceptions) · output-integrity (no empty/truncated artifacts) ·
heading-scope-proportionality · evidenced-basis · persian-naturalness (Persian output only; language-only
pass per persian-output.md).

Any single FAIL -> fix the item and re-run affected tests. Deliver only when all PASS.
For Persian reports, the engineering checks above run first; the language-only
editorial pass in persian-output.md runs after them and must not alter any
engineering claim.

---

## .cline/skills/worktrace-daily-report/assets/report-template.md

## Daily Engineering Report — {date}

<!--
Output skeleton. Fill Work Items only; remove all HTML comments before delivery.
Language of the report follows the user's request (e.g., Persian).
No meta-introduction ("based on the available evidence…"), no change-explanation
section, no commit list, no file log. Deliver Work Items directly.
-->

#### {Outcome-oriented title — past-tense verb, no dates, no counts, no planning labels}

{Integrated narrative, preferably 2–5 sentences. Order: result first -> what became
possible/different -> evidence-backed context if any -> status/limitation if any.
Every sentence must deliver Context, Engineering Work, Outcome, System
Significance, Evidence, or Status/Limitation.}

#### {Next independent outcome — split anything whose title would need "and"}

{...}

<!--
Optional audit metadata (only if the user asks for traceability): keep internal
references (commit hashes, PR numbers, phases) OUT of the narrative above and place
them here as a plain list per Work Item.
-->
