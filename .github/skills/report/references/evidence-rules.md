# Evidence & Inference Rules

Load this reference before writing any sentence that asserts a *why*, an *impact*,
a *prevention/guarantee*, or a *status*. It defines what may be inferred from
evidence and what must never be invented.

## 1. Context / Rationale — optional, evidence-driven

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

## 2. Greenfield rule

Absence of a previous system is itself a valid context. Do not fabricate a prior
deficiency to build a narrative.

- GOOD: *"To provide the ability to observe and manage X, the Y capability was designed
  and implemented."*
- BAD: *"Because the previous system could not display X, Y was redesigned."* (when no
  previous system exists in the evidence)

## 3. Evidence-grounded, not evidence-limited

Extract engineering *meaning* from evidence, but add no new facts.

- Allowed inference: from "`ts-prune` failure was treated as empty output" ->
  "tool failure was misinterpreted as an empty result." This is legitimate technical
  inference.
- Forbidden inference: from the same evidence -> "this increased team productivity."

## 4. Never construct without direct evidence

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

## 5. System significance vs business value

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

## 6. No unsupported evaluation

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

## 7. Verb-scope precision (evidence-level accuracy)

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

## 8. Test evidence — coverage is not a grander claim

Tests are part of the outcome when they actually are; report them precisely and
never inflate them.

- Bad: "quality was guaranteed."
- Good: "the new flow is covered by an integration test."
- Better: "new behavior is covered by model and UI tests; main interaction paths are
  validated."
- Forbidden: "20 tests were added, therefore the feature is fully assured." The
  evidence says only: 20 tests were added.

## 9. Status vocabulary

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

## 10. Risk / limitation / follow-up discipline

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

## 11. Technical detail policy

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
