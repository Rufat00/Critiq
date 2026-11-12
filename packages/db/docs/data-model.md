# Critiq data model — first implementation draft

`schema.prisma` targets PostgreSQL, Prisma, and Better Auth. `JudgingCategory` owns each competition's judging method, rubric, judge access, and results. Categories of kind `OVERALL` or `TRACK` each have exactly one `Track` record, which owns project membership, room access, and per-room capacity. Overall is created automatically and protected against deletion or conversion. Every project belongs to exactly one explicit track; projects in specialized tracks do not enter Overall. Challenges use opt-in project entries and explicit `ChallengeTrack` eligibility links, including for Overall. Future tracks are never enrolled automatically.

## Important application/database invariants

- Only one owner: add a PostgreSQL partial unique index on `"user" (role)` filtered to `role = 'OWNER'` (adjust table mapping/casing if using `@@map`), and serialize owner bootstrap in a transaction.
- One installation row (`id = 1`), one hackathon per deployment, and exactly one Overall category; enforce with a seed/transaction and SQL constraints where appropriate.
- Category `kind` must match subtype: OVERALL and TRACK each have one Track row; CHALLENGE has one Challenge row. Deferred SQL triggers enforce subtype completeness and same-hackathon ownership at commit.
- Track, project, challenge and room must all belong to the same hackathon; cross-table multi-hop invariants require service validation or composite foreign keys.
- `TrackRoom.capacity` is a nonnegative number of spots reserved for one track in one room.
- Automatic placement fills active room capacities in database `registrationOrder`. Project numbers use one global contiguous sequence across tracks and rooms; track capacity overflow remains unassigned. Deferred uniqueness enforces global project numbers at commit.
- Every project has a non-null `trackId`. Eligibility for a track, including Overall, compares that ID directly. Tracks with projects cannot be deleted; move the projects first.
- Challenge eligibility and `ProjectChallenge` opt-in must be checked when selecting projects.
- `scoreScale` is 5 or 10; criterion scores are within [0, scoreScale]; weights nonnegative; freeze rubric definitions after judging starts.
- Ranking positions are 1-based and unique for each (category, judge); reorder with a transaction (temporary positions or deferrable uniqueness).
- `Evaluation` denormalizes category/judge/project from its `JudgingAssignment`; enforce exact match and category method constraints in your service or SQL triggers.
- A completed assignment must have one evaluation; an incomplete assignment must not count toward coverage; no duplicate simultaneously active assignments for the same judge/category.
- For fair allocation, fetch and reserve the next project in one transaction; prioritize lowest completed-evaluation counts and respect room availability, conflicts, hidden projects, opt-in, and current category membership.
- `Hackathon.roomSwitchPercent` applies to every track in 5% steps from 0 to 100; 0 disables automatic rotation. The room rotation percentage uses _eligible projects in the judge's current room_ and distinct completed project coverage, not raw evaluation count, unless you deliberately select another definition.
- Don't delete completed evaluations if a project is hidden/disqualified; preserve auditable history.
- Invitation token is random, only hashed in DB. Redemption checks expiry/status/email/use count in one transaction. `InvitationRedemption` provides proper audit for multi-use QR invitations.
- `Invitation.redeemedById` is optional convenience for single-use links; multi-use redemptions live in `InvitationRedemption`.
- Initial bootstrap uses an env password, and an atomically persisted `Installation.claimedAt`. Do not reopen bootstrap after owner deletion.
- With SMTP configured, only email OTP should be exposed. Without SMTP, enable password sign-in. Never switch to passwords just because SMTP temporarily fails.

## Better Auth caveat

The stock Better Auth Prisma schema has a required `email`. The username plugin still expects email when signing up, so this schema intentionally keeps `email String @unique`. If truly email-less accounts are mandatory, choose a fully implemented custom auth adapter/provisioning flow instead of inserting fake placeholder addresses. Generate/compare Better Auth tables via `npx auth@latest generate` before production deployment, particularly after upgrading Better Auth.

## Operational schema choices

- `JudgeCategory` makes category assignments independent; a judge can judge multiple categories.
- Tracks and Overall allow Relational (`RELATIVE`, default) or Rubric. Challenges allow Rating Scale (`RATING_SCALE`, default) or Rubric; category-method SQL constraints enforce this distinction.
- `RelativeRanking` retains each judge's ordered list per category; pairwise Copeland aggregation is derived from these ranks.
- `EvaluationScore` stores original rubric criterion scores; `rubricTotal` is only a cache.
- `ProjectFlag` can cover absences and conflicts; `JudgeConflict` explicitly blocks assignments.
- For results at scale, add derived ranking caches, scoring version records and snapshots after v1 algorithm is stable.
- The category status supports independent pauses. Hackathon status supports overall lifecycle.

## Suggested setup

1. Put the Prisma schema in `prisma/schema.prisma`.
2. Install Prisma and Better Auth and configure `DATABASE_URL`.
3. Compare Better Auth generated tables with the included auth models.
4. Create a migration with `npx prisma migrate dev --name init`.
5. Add production SQL constraints and seed the installation + Overall category through a transaction.

Additional constraints are available in `post-migration.sql` (apply as a _subsequent_ Prisma migration after table creation).
