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
Validate Against Evidence      (run all 16 acceptance tests — see Step 5)
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
- **Merge commits** are not independent accomplishments; they carry evidence for the
  work they merged. Never duplicate that work into a second item.
- **Reverts**: interpret with the following history. If A (incomplete) -> B (revert) ->
  C (final), report C as the accomplishment. Never present reverted or incomplete
  work as completed. A revert is its own Work Item only if it had its own
  significant outcome (e.g., keeping an unhealthy state out of the mainline). Do
  not invent root causes, lessons learned, or architectural conclusions about the
  failed attempt unless the evidence states them.

## Step 2 — Write at outcome level, not activity level

| Level | Example | Verdict |
|-------|---------|---------|
| 0 Activity | "File X changed; 17 files touched." | Rejected |
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

Do not over-correct the vocabulary: keep technical terms that carry meaning for a
technical reader (API, E2E, Integration Test, RBAC, Database, Graph, Baseline,
Traceability, Architecture). The goal is not "simplify everything" — it is
**remove unnecessary internal detail while preserving useful engineering
meaning**. Keep implementation details that materially explain behavior,
constraint, or architectural significance; drop names that add noise (helper and
hook identifiers, layer paths, line counts). Detail-budget examples live in
[references/patterns.md](references/patterns.md) (P8).

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
- **Result first**: open with what was built/changed and what it enables; put revert
  or history context after the result, not before it.
- **Capability first**: present the capability or outcome before the implementation
  mechanism. Prefer "Traceability Matrix was added to let users inspect and manage
  Requirement-Test Case relationships" over "An ARIA grid was implemented with
  selected-cell write operations"; implementation detail may follow when it adds
  useful technical meaning.
- **Sentence-utility rule**: every sentence must deliver at least one of Context /
  Engineering Work / Outcome / System Significance / Evidence / Status-Limitation.
  If a sentence delivers none of these, remove it.
- Every repository-specific term (`captured set`, `UNCHANGED`, `reconstitute`,
  Baseline…) needs a few words of plain meaning attached on first use.
- File counts and LOC appear only when scope/migration/unusual size genuinely matters.

Before finalizing, apply the reader-facing checks in
[references/reader-model.md](references/reader-model.md): the self-explanatory vs
opaque terminology classes, the internal-reference rule, and the Reader Independence
Test.

## Step 4 — Language and tone (skill is English; report may be Persian)

The report language follows the user's request. For Persian reports: natural Persian
sentence structure, standard technical terms kept in English, no artificial
translations, no first person. Preferred verbs: implemented, redesigned, isolated,
enforced, validated, covered, migrated, split, hardened, removed (and their natural
Persian equivalents). Weak verbs to avoid: "worked on X", "some changes were made",
"items were reviewed", "effort was made". Corporate/marketing patterns are default
failures: "in line with advancing…", "significant improvement", "effective step
toward…", "powerful solution", "successfully…". Sound like an experienced engineer,
not marketing, HR, or a changelog. No decorative emojis anywhere — not in the Skill
files, references, examples, headings, or metadata; use plain Markdown only.

## Step 5 — Self-check before delivering

Run every Work Item through the 16 acceptance tests, both Definitions of Done
(Work Item + Daily Report), and the PASS/FAIL scorecard in
[references/validation.md](references/validation.md). Fix anything that fails; if a
claim cannot be defended from the evidence, remove or downgrade the claim — never
invent support for it. Deliver only when every dimension passes.

## Reference files (load on demand)

- [references/evidence-rules.md](references/evidence-rules.md) — context types,
  greenfield rule, forbidden invented facts, strongest-supported-claim principle,
  no-forced-business-framing, evidence-grounded vs evidence-limited, verb-scope
  precision, test-vs-claim limit, status vocabulary, risk discipline.
- [references/reader-model.md](references/reader-model.md) — terminology classes,
  internal-reference handling, independence rule, style tables, reader tests.
- [references/validation.md](references/validation.md) — DODs, 16 acceptance tests,
  reject patterns, scorecard.
- [references/patterns.md](references/patterns.md) — worked BAD:/GOOD: examples per pattern.
- [assets/report-template.md](assets/report-template.md) — exact output skeleton.

## Scope (neutrality)

This standard applies to any repository, project, stack, or language — frontend,
backend, QA, infrastructure, tooling, documentation, migration, refactoring, bug
fixing, greenfield development. It must not depend on any specific product name,
framework, architecture style, domain, or organizational naming.
