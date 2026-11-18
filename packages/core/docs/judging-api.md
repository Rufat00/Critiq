# Judging backend V1

The source specification is [judging-specification.md](judging-specification.md).
Import supported operations from `@critiq/core/judging`. All operations accept a
trusted `AppContext` followed by validated input. The judge identity comes from
that context; only organizer operations can select another judge for a room move
or availability change. There is one hackathon per installation.

## Setup and policy

1. Configure projects, mutually exclusive tracks, challenge entries, rooms,
   qualifications, conflicts, and rubrics using the existing setup APIs.
2. Call `configureJudging` with `expectedRevision: 0`, every enabled competition,
   available minutes for every qualified judge, and an ISO UTC `endsAt`.
   Each competition supplies `minimumEvaluations`, `maximumEvaluations`, and
   `desiredEvaluations`. The response includes the frozen policy and estimated
   plan, feasible target vector, per-project quotas, judge workload/slack, room
   overrides and unmet minimums. No minimum is silently lowered.
3. Review `getJudgingPlan`. It returns the saved plan plus a fresh conservative
   projection using completed evidence, spent time, availability, and current
   room stays. `getJudgingCoverageSummary` distinguishes completed and reserved
   counts. A reservation is never evidence that minimum coverage was achieved.
4. Use the existing Ready/start operations. Starting now requires a current
   frozen policy and plan. Changes to setup invalidate the setup fingerprint.
   An estimated minimum shortfall requires `feasibilityOverrideReason` when
   starting; its reason is audited.

Default relative estimator is `COPELAND_V1`. Explicitly choose
`BRADLEY_TERRY_V1` and a positive `lambda` before starting to use regularized
Bradley–Terry officially. Both appear in relative diagnostics. Copeland readiness
requires a connected graph and equal observed opponent counts; no unobserved
pair is turned into a tie. Sparse or unequal comparisons remain provisional.

Rubric ranges default to 0 through the event's 5/10 score scale, or use explicit
per-criterion ranges in `configureJudging`. Weights, criterion labels and ranges
are frozen. Results recompute full-precision weighted 0–100 scores from raw
marks; the database's rounded `rubricTotal` is only a cache. Project aggregation
uses the judge mean, with median, sample standard deviation and count.

Rating Scale always has the five ordered choices exported as
`ordinalRatingOptions` from `@critiq/constants`. It does not use the event's
rubric scale. Official results use unsmoothed ordinal superiority, expose vote
histograms and pairwise superiority, and remain unscored if a competitor has no
votes. A sole competitor has no rival-based superiority score.

Calculations keep full precision. Display can round to two decimals. Shared
ranks use a `1e-9` numerical equality tolerance; IDs order display rows only and
never select an award winner. Ties remain explicitly unresolved.

After starting, scoring method, estimator, regularization, rubric and eligibility
cannot change. Pause and supply `amendmentReason` to amend coverage, time or room
policy with optimistic revision checking. Configuration revisions are retained
in the `judging.configure` audit, including the complete frozen policy and plan.

## Judge workflow

- `requestNextAssignment({ requestKey })` returns the judge's active reservation,
  a `TERMINAL` prior request result, or `NO_FEASIBLE_ASSIGNMENT`. Retry with the same key
  for the same request; use a new key after terminal visits. Hard eligibility,
  conflicts, availability, time and coverage limits run inside the transaction.
- `getJudgeCurrentAssignment` returns only the current judge's project, targeted
  categories, frozen rubric and room progress. It never reveals other judges'
  confidential scores. `getJudgeRelativeRanking` returns the judge's own order
  and its revision.
- Submit each targeted category through `submitRubricEvaluation` or
  `submitRatingVote`. Exact retries return the existing evaluation; a changed
  duplicate is a conflict. Rubric marks must cover every criterion exactly once.
- For relative judging, call `updateRelativeRanking` with the visit/assignment
  IDs, `expectedRevision`, and the complete order including the newly observed
  project. The observation and ranking commit together. Omit visit/assignment
  IDs when revising an existing complete order. Stale changed orders conflict.
- `renewJudgingVisit` extends an active reservation up to the judging deadline.
  `skipJudgingVisit` accepts an explanation for the whole visit or one unfinished
  category. `completeJudgingVisit` requires all targeted categories completed or
  explicitly skipped and at least one completed category. A physical project
  visit increments room progress once, regardless of form count.
- `moveJudge` enforces a frozen reachable-project denominator for each entry
  epoch. Movement becomes eligible at the configured ceiling quota; meeting it
  never forces a move. No-local-project moves have a named audited exception.
  Organizers can select `judgeId` and supply a named override and explanation.
- `setJudgeJudgingAvailability` starts/ends a break. A break releases unfinished
  reservations and closes the room epoch. `declareJudgeConflict` cancels the
  judge's current visit to that project and excludes their existing evidence
  with an audit; completed publications require an organizer reopen first.

Judge and project availability changes retain already submitted observations.
An organizer can explicitly exclude invalid observations. Expired/canceled
reservations stop consuming pending coverage; an already submitted observation
continues to count unless explicitly excluded. All returned marks use ordinary
numbers, suitable for Server Actions.

## Organizer workflow and results

`transitionJudging` supports pause, resume and deliberation. Closing requires
active visits to be resolved. `cancelJudgingVisit` releases unfinished targets
with a reason. `setProjectJudgingAvailability` marks temporary unavailability,
releases active visits, and resolves the flag when the project returns.

`getCompetitionResults` exposes observations, scoring revision, diagnostics,
coverage, provisional readiness, unresolved ties, unfinished targets, and any
current publication. Request `includeUncertainty: true` to run the more expensive diagnostics.
Judge-cluster bootstrap uses a recorded seed and reports
insufficient evidence for tiny samples. Its selection frequencies are conditional
on the observed panel and assignment design, not probabilities of a true winner.
Judge severity is diagnostic only; no automatic z-score correction is applied.

`finalizeCompetitionResults` requires paused/closed judging, the expected scoring
revision and `expectedEvidenceFingerprint` returned by the reviewed results,
resolved reservations, and valid evidence. Changed evidence conflicts until reviewed again. Coverage/structural exceptions
require `exceptionReason`; a leading tie requires `acknowledgeTies` and remains a
shared rank. Publication snapshots contain the exact evidence and frozen policy.
Retries return the existing publication. `reopenCompetition` supersedes the old
publication without deleting it. `excludeEvaluation` preserves raw marks and
updates rankings/revisions, so reads recompute deterministically from remaining
valid evidence. Complete the event through `transitionJudging` only after every
enabled competition has been finalized.

Mutations and audits share one database transaction. Judging writes serialize on
the event row, also used by setup/stage operations. Partial unique indexes protect
one active physical visit per judge and project, one current room epoch, and the
schema prevents duplicate final judge/project/category observations. Queries use
consistent read transactions. This deliberately favors correctness for one event;
large deployments may need narrower locks after profiling.

Thin Server Actions are in `apps/web/src/app/judging/actions.ts` and
`apps/web/src/app/admin/judging/actions.ts`, using the existing authentication and
safe-error adapter. Judging UI is not implemented by this change.

## Verification and limits

- `pnpm test:judging`: deterministic math, eligibility and seeded simulation tests.
- `pnpm test:judging:integration`: creates a uniquely named disposable PostgreSQL
  database, applies every migration, seeds installation data, tests real core
  workflows/concurrency/rollback, then drops only that test database. Requires
  database create permission using the configured connection.
- `pnpm typecheck`, `pnpm db:validate`: workspace and schema checks.

The planner uses scarcity-first joint visits, shared form timing, frozen room
stays, conservative reserve, target increments and bounded deterministic restart
repair. It reports estimates, not a proof of optimality. The max-flow function
is a separate capacity relaxation. Live dispatch protects exclusive minimums,
prioritizes coverage and comparison bridges before travel, and records seeded
assignment tie ordering. Room safety overrides prevent impossible stays.

Seeded tests cover 0/25/50/100% stay policies, conflicts, workload, joint visits,
determinism and clear-winner scoring. They are smoke/property simulations,
not the broad statistical benchmarking study in specification section 14.5.
Ordinal mixed-effects models, official rubric bias corrections, optimizer-based
scheduling and algebraic-connectivity diagnostics remain the explicitly optional
future extensions described in the specification. Bradley–Terry is configurable,
not silently promoted over Copeland based on these smoke simulations.
