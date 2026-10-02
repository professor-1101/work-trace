# Reader Model & Terminology Rules

The report is written for the **reader**, not for the repository (**RULE-02** —
Reader-Centered Abstraction, canonical specification in approved-rules.md). Load
this reference while drafting titles and narratives, and again before finalizing.
Retain or translate internal terminology when it provides necessary context; do
not treat it as universally forbidden.

## 1. Internal references are not context

Any reference that only carries meaning inside the project must not appear as
narrative context: `Phase 2.5`, `U2/U3/U4`, `P5-812`, `PR #143`, ticket IDs, branch
names, internal codenames, planning labels, milestone names the reader was never
told about, AI-agent-specific terminology. Keep such a reference only when it is
genuinely necessary and meaningful to the intended reader; otherwise translate its
meaning into system-level language or omit it. These may live in metadata/audit
trails — not in the story.

Rule — for any phrase that requires repo knowledge to understand, do exactly one of:

1. delete it;
2. translate it into system-level meaning;
3. keep it only if self-explanatory to the reader.

BAD: "Traceability matrix and graph were implemented based on Phase 2.5."
GOOD: "Graph and matrix views were implemented for observing and managing
Requirement–Test Case relationships."

Vague internal pointers count too: **"based on the new design"** carries no
information (new relative to what?) and belongs in the same bin as `Phase 2.5`.

## 2. Terminology classes

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

## 3. Independent outcome rule

Do not merge two Work Items merely because they share a day, a planning phase, a
feature area, or adjacent commits. Example of genuinely independent outcomes that
must stay separate: *Design Coverage* (observing requirement coverage status) vs
*Specification Explorer* (managing Capability/Feature/Requirement hierarchy).

Multiple views of one capability may be combined **only** when the narrative states
the distinction: "two complementary views of traceability — the Graph for browsing
relationship structure, the Matrix for reviewing and managing Requirement–Test Case
links."

## 4. Titles

Outcome-oriented, short, independent of commit messages, no dates/times/file lists.

GOOD: "Hierarchical artifact management implemented" · "Stored-state reads split from
creation validation" · "Git execution in tests isolated from the main repository"
BAD: "Changes related to Explorer" · "Work on the API" · "Several fixes in guards" ·
"40 files changed"

## 5. Result-first ordering

Open each item with what was built and what it enables; history (revert, prior
attempt) comes after the result, never as the opening clause. Worked example:
patterns.md P10.

## 6. Implementation-detail budget

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

## 7. Weak system outcome check

If a sentence reports an action with no answerable "so what?", either attach the
evidence-backed rationale/outcome or drop the detail. BAD: "Icon library migrated to
Tabler 3.31.0; lucide-react removed." GOOD: + "…so navigation icons share one design
system set" (only if evidence supports the intent).

## 8. Reader Independence Test

Cover the title + text of each Work Item and ask: would a CTO who knows nothing of
internal phases, tickets, or planning labels understand what this work added or
fixed in the system? If not -> rewrite until yes.
