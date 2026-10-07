# Approved WORKTRACE Reporting Rules (RULE-01..RULE-04)

Source-of-truth rule specifications for the reporting behavior. Load during
drafting and again during the self-check pass. Where an operational restatement
of the same requirement exists elsewhere in this Skill, it refers here; these
four specifications remain canonical and are not reinterpreted.

---

### RULE-01 — Outcome over Activity

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

### RULE-02 — Reader-Centered Abstraction

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

### RULE-03 — System-Level Meaning

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

### RULE-04 — Relevant Technical Detail

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
