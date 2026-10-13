# Critiq data model — first implementation draft

`schema.prisma` is designed for PostgreSQL, Prisma and Better Auth (standard Prisma adapter). The shared `JudgingCategory` models independent competitions. Overall is created automatically as a category of kind `OVERALL`, not as a specialized `Track` row. Every project can be judged in Overall, but projects in tracks with `disqualifiesFromOverall=true` cannot win Overall. Challenges are independent judging categories and use opt-in membership, restricted by eligible tracks.

## Important application/database invariants

- Only one owner: add a PostgreSQL partial unique index on `"user" (role)` filtered to `role = 'OWNER'` (adjust table mapping/casing if using `@@map`), and serialize owner bootstrap in a transaction.
- One installation row (`id = 1`), one hackathon per deployment, and exactly one Overall category; enforce with a seed/transaction and SQL constraints where appropriate.
- Category `kind` must match subtype: TRACK has one Track row; CHALLENGE has one Challenge row; OVERALL has neither.
- Track, project, challenge and room must all belong to the same hackathon; cross-table multi-hop invariants require service validation or composite foreign keys.
- TrackRoomTableRange bounds must be nonnegative and `fromNumber <= toNumber`; validate no overlap across different tracks sharing the same room when necessary.
- Overall eligibility is separate from Overall evaluation eligibility: filter winners based on `Project.track.disqualifiesFromOverall`, while preserving Overall evaluations.
- Challenge eligibility and `ProjectChallenge` opt-in must be checked when selecting projects.
- `scoreScale` is 5 or 10; criterion scores are within [0, scoreScale]; weights nonnegative; freeze rubric definitions after judging starts.
- Ranking positions are 1-based and unique for each (category, judge); reorder with a transaction (temporary positions or deferrable uniqueness).
- `Evaluation` denormalizes category/judge/project from its `JudgingAssignment`; enforce exact match and category method constraints in your service or SQL triggers.
- A completed assignment must have one evaluation; an incomplete assignment must not count toward coverage; no duplicate simultaneously active assignments for the same judge/category.
- For fair allocation, fetch and reserve the next project in one transaction; prioritize lowest completed-evaluation counts and respect room availability, conflicts, hidden projects, opt-in, and current category membership.
- The room rotation percentage uses _eligible projects in the judge's current room_ and distinct completed project coverage, not raw evaluation count, unless you deliberately select another definition.
- Don't delete completed evaluations if a project is hidden/disqualified; preserve auditable history.
- Invitation token is random, only hashed in DB. Redemption checks expiry/status/email/use count in one transaction. `InvitationRedemption` provides proper audit for multi-use QR invitations.
- `Invitation.redeemedById` is optional convenience for single-use links; multi-use redemptions live in `InvitationRedemption`.
- Initial bootstrap uses an env password, and an atomically persisted `Installation.claimedAt`. Do not reopen bootstrap after owner deletion.
- With SMTP configured, only email OTP should be exposed. Without SMTP, enable password sign-in. Never switch to passwords just because SMTP temporarily fails.

## Better Auth caveat

The stock Better Auth Prisma schema has a required `email`. The username plugin still expects email when signing up, so this schema intentionally keeps `email String @unique`. If truly email-less accounts are mandatory, choose a fully implemented custom auth adapter/provisioning flow instead of inserting fake placeholder addresses. Generate/compare Better Auth tables via `npx auth@latest generate` before production deployment, particularly after upgrading Better Auth.

## Operational schema choices

- `JudgeCategory` makes category assignments independent; a judge can judge multiple categories.
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
