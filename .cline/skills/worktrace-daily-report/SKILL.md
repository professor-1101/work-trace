---
name: worktrace-daily-report
description: >
  Translate scattered engineering evidence (git commits, diffs, PR/merge context,
  reverts, tests, design/architecture notes, task logs) into meaningful Work Items
  and a precise, compact, factual, outcome-oriented daily engineering report for a
  reader who does not know the repository (CTO / Engineering Manager). Use whenever
  the user asks for a daily engineering report, a commit summary for management,
  WorkTRACE output, or conversion of raw git evidence into an engineering narrative —
  even if they do not explicitly say "report". The generated report language follows
  the user's request; skill instructions are English.
metadata:
  author: work-trace
  version: "2.0"
compatibility: Designed for Cline or any agent that supports Agent Skills. Needs read access to git history (git log / git show) or pasted commit evidence.
---

# WORKTRACE — Engineering Evidence → Daily Report

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
        ↓
Identify Changes
        ↓
Group Related Commits          (by shared engineering outcome — see Step 1)
        ↓
Identify Engineering Work      (Level 2–3, never Level 0 — see Step 2)
        ↓
Extract Context / Rationale    (only when supported — see references/evidence-rules.md)
        ↓
Extract Outcome                ("what became possible / different?")
        ↓
Extract System Significance    (only when supported)
        ↓
Extract Status / Limitation    (only when supported — never hide one)
        ↓
Write Concise Narrative        (format + language rules below)
        ↓
Validate Against Evidence      (run all 15 acceptance tests — see Step 5)
        ↓
Daily Engineering Report
```

The rejected path is `Commit Message → Paraphrase → Report`.

## Step 1 — Identify Work Items and group correctly

A **Work Item** is one unit of engineering work with **one independent outcome**.
`1 commit ≠ 1 Work Item`: domain + API + UI + tests of one feature are usually one
Work Item; `add feature X` plus `fix unrelated database issue` are two.

- Group **only** on the question: "were these commits made to reach one shared
  engineering outcome?" Never group by commit count, file count, author, directory,
  timestamp, branch, PR, or "they are in the same area".
- **Shared domain ≠ shared outcome.** Git-test isolation + E2E menu fix + smoke
  payload fix are three Work Items even though all are "test-related". If your title
  reads "X **and** Y", suspect two outcomes that belong in separate items.
- **Merge commits** are not independent accomplishments; they carry evidence for the
  work they merged. Never duplicate that work into a second item.
- **Reverts**: interpret with the following history. If A (incomplete) → B (revert) →
  C (final), report C as the accomplishment. A revert is its own Work Item only if it
  had its own significant outcome (e.g., keeping an unhealthy state out of the mainline).

## Step 2 — Write at outcome level, not activity level

| Level | Example | Verdict |
|-------|---------|---------|
| 0 Activity | "File X changed; 17 files touched." | Rejected |
| 1 Technical action | "Validation logic was redesigned." | Acceptable but usually insufficient |
| 2 Engineering outcome | "Validation logic was redesigned so Y is enforced." | Good |
| 3 System significance | "...so stored states remain readable while creation now rejects Z." | Best, when evidence allows |

The central question for every item: **"After this change, what is possible or
different in the system?"** Report behavior and capability, not evaluation. Keep
implementation names (`useGraphAndKinds`, `byCode`, file paths, line counts) only
when they are necessary to understand the outcome.

Context is optional: types (problem-driven, feature-driven, greenfield,
engineering-driven, investigation-driven), the forbidden-facts list, verb-scope
precision, and test-evidence limits are detailed in
[references/evidence-rules.md](references/evidence-rules.md). Read it before writing
any sentence that claims a *why*, an *impact*, or a *prevention/guarantee*.

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
- **Sentence-utility rule**: every sentence must deliver one of Context / Engineering
  Action / Outcome / Evidence / Status. If it delivers none, delete it.
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
not marketing, HR, or a changelog.

## Step 5 — Self-check before delivering

Run every Work Item through the 15 acceptance tests (What / Why / So-What / Truth /
Audience / Status / Duplication / Language / Sentence Utility / Verb Scope /
Terminology Accuracy / Term Meaningfulness / Internal Reference / Grouping / Revert),
the Work-Item and Daily-Report Definitions of Done, and the PASS/FAIL scorecard in
[references/validation.md](references/validation.md). Fix anything that fails; if a
claim cannot be defended from the evidence, remove or downgrade the claim — never
invent support for it.

## Reference files (load on demand)

- [references/evidence-rules.md](references/evidence-rules.md) — context types,
  greenfield rule, forbidden invented facts, evidence-grounded vs evidence-limited,
  verb-scope precision, test-vs-claim limit, status vocabulary, risk discipline.
- [references/reader-model.md](references/reader-model.md) — terminology classes,
  internal-reference handling, independence rule, style tables, reader tests.
- [references/validation.md](references/validation.md) — DODs, 15 acceptance tests,
  reject patterns, scorecard.
- [references/patterns.md](references/patterns.md) — worked ❌/✅ examples per pattern.
- [assets/report-template.md](assets/report-template.md) — exact output skeleton.

## Scope (neutrality)

This standard applies to any repository, project, stack, or language — frontend,
backend, QA, infrastructure, tooling, documentation, migration, refactoring, bug
fixing, greenfield development. It must not depend on any specific product name,
framework, architecture style, domain, or organizational naming.
