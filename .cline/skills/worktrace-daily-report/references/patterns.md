# Worked Patterns (Rejected vs. Accepted)

Concrete before/after examples for the recurring report shapes. Use them as style
anchors when drafting; the narrative language of a real report follows the user's
request (Persian examples are rendered in English here — keep Persian natural and
technical terms in English at runtime).

## P1 — Bug fix / flaky E2E (investigation-driven)

Evidence: `e2e fails because account menu is below viewport` · `wait for aria-busy` ·
`require viewport before click`.

- BAD: "The E2E test was fixed."
- GOOD: "Opening the account menu in E2E now waits for page loading to finish, and the
  menu's presence in the viewport is checked before clicking."
- BEST: "In some E2E runs the account menu was clicked outside the viewport before
  loading completed. The task now waits until `aria-busy` clears and verifies the
  menu is accessible in the viewport before clicking."

## P2 — Refactor with compatibility constraint

Evidence: `mapper uses create()` · `create() now rejects old state` ·
`replace mapper with reconstitute()`.

- BAD: "The mapper was refactored."
- GOOD: "Rebuilding stored states moved from `create` to `reconstitute`, so the new
  creation validation no longer blocks reading older states."
- Preferred full shape: "Stored states had to remain readable after creation
  validation tightened. The mapper was moved into `reconstitute`; `create` now
  returns a specific error for an `UNCHANGED` state carrying two different
  snapshots; round-trip and domain tests cover read and write behavior."

## P3 — Greenfield feature (model + API + UI + tests = one Work Item)

Evidence: new page, new API, new model, new tests.

- BAD: "The previous system could not display X." (no prior system exists)
- GOOD: "To provide viewing and management of X, its model, API, and view were
  implemented; main flows are covered by the related tests."

## P4 — Infrastructure / test hardening

Evidence: `GIT_DIR leaks into tests` · `temporary git init touches real repo` ·
`remove Git env vars`.

- BAD: "Git tests were updated."
- GOOD: "Git execution in the affected specs was isolated from the main repository's
  environment so a temporary `git init` cannot act on the repository being pushed."
- BEST: "Specs that run Git themselves were cleared of `GIT_DIR`, `GIT_WORK_TREE`,
  and `GIT_INDEX_FILE` so the main repository's environment no longer leaks into
  temporary Git operations."

## P5 — Limitation must stay visible

Evidence: invite API passes schema · fresh DB returns 404 USER_NOT_FOUND · IDs are
not accounts.

- BAD: "The invitation problem was fully solved."
- GOOD: "Smoke payloads now match the API schema, but full execution against a fresh
  database reaches `404 USER_NOT_FOUND` because the created identities have no
  valid accounts; continuing this flow requires creating matching accounts."

## P6 — Capability gating (terminology accuracy)

- BAD: "Settings is hidden when required authentication is missing." (capability is authorization, not authentication)
- GOOD: "Access to Settings is gated by the `MANAGE_PROJECT` capability; without it the
  section is not shown."

## P7 — Layout engine causality (verb-scope)

- BAD: "ELK layout was implemented to enforce visual rules." (the engine applies, not
  enforces domain rules)
- GOOD: "Graph layout was implemented with ELK and orthogonal routing; link-direction,
  legacy-style, and retired-link display rules are applied in rendering."
- Scope qualifier example: "the add-link form offers only relationship triples
  allowed by the rules and blocks invalid links **in the UI**" — final constraints
  may live in API/domain.

## P8 — Shared logic move (factual over interpretive)

- CAUTION: "…moved to a shared layer to prevent code duplication." (interpretive claim)
- GOOD: "Coverage reads now come from a single shared layer used by both the tree and
  the matrix." (observable fact; helper names omitted — detail budget)

## P9 — Migrate with rationale/outcome (weak-outcome check)

- BAD: "Icon library migrated to Tabler 3.31.0; lucide-react removed." (no so-what)
- GOOD: "The project's icon library was migrated to Tabler 3.31.0 and the `lucide-react`
  dependency was removed so navigation icons share one consistent set." (keep only
  if evidence supports the intent)

## P10 — Result-first with revert context

- BAD: "After reverting an incomplete implementation, Specification Explorer was
  rebuilt from scratch…"
- GOOD: "Specification Explorer was implemented for managing hierarchical
  specifications (Capability/Feature/Requirement). The final version follows removal
  of an earlier incomplete attempt from the branch; the tree renders via `DECOMPOSES`
  links in the model and supports node moves (dialog, drag/drop, keyboard),
  detachment, and per-node coverage status."

## P11 — Two complementary views (grouping distinction)

- If Graph and Matrix ship together as one traceability capability, say so:
  "Two complementary traceability views were implemented: the Graph for browsing
  relationship structure, and the Matrix for reviewing active Requirements against
  Test Cases and linking/retiring relationships directly from a selected cell."
- Without such evidence of a single outcome, they remain separate Work Items.

## P12 — Domain term gloss (term meaningfulness)

- BAD: "`Baseline.publish` now takes `relations` as a required parameter to capture the
  captured set."
- GOOD: "On Baseline publish, the relations frozen into that published version are now
  always recorded — the publish call takes the relation set as a required argument."

## P13 - Capability first (mechanism after)

- BAD: "An ARIA grid was implemented with selected-cell write operations."
- GOOD: "A Traceability Matrix was added so users can inspect active Requirements
  against Test Cases and link or retire relationships directly from a selected
  cell; the grid follows the ARIA grid pattern for accessibility." (mechanism kept
  only because accessibility is part of the outcome)
