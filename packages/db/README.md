# @critiq/db

PostgreSQL schema, Prisma client, migrations, and installation setup for Critiq.
The supplied models are preserved; generator/configuration are adapted to Prisma 7.
Original application design notes are kept in [docs/data-model.md](docs/data-model.md).

## Local setup

From the repository root:

```bash
pnpm install
cp .env.example .env # Only when .env does not already exist.
docker compose -f compose.dev.yaml up -d
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm db:check
```

The CLI explicitly loads the root `.env` without overwriting process environment
values. Seed/check commands also load root `.env`. Runtime consumers must load
their environment before importing this package; the runtime client does not
load files or use a fallback URL. Missing `DATABASE_URL` throws
`DATABASE_URL is not set`.

```ts
import { db, Prisma, UserRole } from '@critiq/db';
import type { User, PrismaClient } from '@critiq/db';
```

`db` is the shared client, cached on `globalThis` outside production to survive
development reloads. `createPrismaClient()` creates a separate client for an
explicit lifecycle; callers must disconnect clients they own. Long-running apps
should reuse `db`, not disconnect after every request. Keep business queries in
`packages/core`; this package owns database infrastructure.

## Commands

- `pnpm db:validate`: validate the Prisma schema.
- `pnpm db:generate`: generate ignored client code and types after install/schema changes.
- `pnpm db:migrate --name <change>`: create/apply development migrations.
- `pnpm db:deploy`: apply committed migrations, including custom SQL, in any environment.
- `pnpm db:status`: inspect migration status.
- `pnpm db:studio`: open Prisma Studio.
- `pnpm db:seed`: idempotently create Installation, Hackathon, and Overall category.
- `pnpm db:check`: check connectivity and expected tables through the shared client.

The seed serializes concurrent setup, preserves existing configuration and
`Installation.claimedAt`. New hackathons have no name until the owner sets one
during setup; no hackathon-name environment variable is required.
It creates no users, passwords, or sessions. The app’s passcode-protected
registration flow owns the one-time owner claim.

Generation/validation work without a live database. Other commands need a valid
`DATABASE_URL`. After a fresh install run `db:generate` before type checking or
importing the package. Prisma 7 migrations do not automatically run the seed.

## Database constraints and core responsibilities

The initial migration creates all supplied models, foreign keys, indexes, and
unique constraints. A subsequent migration enforces:

- At most one owner, hackathon, and Overall category per hackathon.
- Installation ID must be 1; the seed creates the singleton and Overall category.
- Score scale is 5 or 10; weights and scores are nonnegative.
- Positive judging timers/minimum coverage; optional target is at least the minimum.
- Valid room rotation percentage, table ranges, table numbers, and assignment attempts.
- Rankings are 1-based; schema uniqueness prevents duplicate ranking positions.
- At most one active assignment per judge/category.
- Valid invitation maximum/use counts.

Constraints enforce _at most one_ singleton; provisioning creates the required
records. The Overall category is protected against deletion and conversion by database triggers.

Core must still enforce the supplied cross-record rules: category/subtype
agreement, common hackathon ownership, eligibility and conflicts, current-room
validity, non-overlapping table ranges where required, rubric locking and score
upper bounds for the hackathon's scale, exact assignment/evaluation identity,
completed-assignment evaluation existence, method compatibility, invitation
redemption authorization, atomic allocation, and permanent bootstrap claims.
Ranking reorders must use a transaction with positive temporary positions to
respect immediate uniqueness and the positive-position constraint.

The supplied notes reference `post-migration.sql`, which was not provided.
The committed constraints migration implements the local SQL safeguards listed
above; it does not claim to implement all future service invariants or auth.

## Deployment

Supply `DATABASE_URL` using deployment environment variables, generate the client
as part of the application build, and run `pnpm db:deploy` before starting the
app. Run `db:seed` explicitly for initial provisioning. Never run development
migrations against production or use `db push` to bypass custom SQL history.

When the app runs in Compose, use `postgres:5432` as the database hostname;
host development uses the configured localhost port. PostgreSQL does not create
application tables automatically: migrations remain a required setup step.

## Draft setup and readiness

Apply committed migrations with `pnpm db:deploy` before opening the admin home.
Category participation (`JudgingCategory.isEnabled`) is separate from `isVisible`;
hiding a category does not remove its readiness requirements.

`SetupCompletion` stores a section fingerprint, trusted organizer, and completion
time. The checklist covers event details, custom categories, projects, judges,
and rooms. Overall is excluded from displayed category counts. Event creation
completes automatically when the hackathon is named. Organizers can mark the
other configured sections as done and undo their completion. Relevant
configuration changes invalidate completion. Marking Ready requires a complete
checklist as well as successful server-side readiness validation.

Completion writes and Draft/Ready transitions serialize on the hackathon row
and commit with audits. Future configuration mutations must use the same
hackathon lock and enforce Draft status before changing competition setup.

Checklist setup links open dedicated pages; there is no checklist setup drawer.
The destination pages show saved configuration; entity editors/imports and the
live judging/results workflows remain separate work.

## Category configuration

The admin categories page lists Overall as the default, protected track without
creating a specialized `Track` row. Optional descriptions live on
`JudgingCategory`. Specialized tracks allow Relational (`RELATIVE`, the default)
or Rubric judging. Challenges allow Rating Scale (`RATING_SCALE`, the default)
or Rubric judging. Database checks enforce these method combinations; an insert
trigger supplies the method when omitted, based on category kind. Prisma uses a
database-generated default because the choice depends on `kind`.

Apply both category-method migrations before using the page. Existing challenge
rows must already use a supported method before the compatibility constraint can
be applied; disposable development data may be reset explicitly by its owner.
Rating Scale uses the hackathon's configured 5- or 10-point scale; score entry
and result calculation remain future workflows.

The matrix shows challenge eligibility across tracks, using explicit `ChallengeTrack` links and
`Challenge.includesOverall`. Overall is selected independently;
challenge judging remains independent of track awards. Project counts show all
registered projects or challenge entries, including inactive entries. Overall counts only projects without a specialized track.

Category deletion requires an organizer, Draft status, no judging activity, and
an audit committed in the same transaction. It keeps projects and removes the
category's dependent configuration. Create controls open guarded forms; edit remains a placeholder. New rubric categories require named criteria with weights in 10% increments totaling exactly 100%. Each added item starts at 20%. Category, subtype, rubric criteria, and audit save in one transaction. The staged creation form selects Overall by default for challenges. Specialized tracks are selected individually. New tracks select existing challenges explicitly; future tracks never inherit challenges automatically. Related IDs are checked against the current hackathon, and membership links save with the category and audit.

Specialized tracks are always excluded from Overall judging and awards. The
track exclusion migration sets `disqualifiesFromOverall` to true on existing
tracks, changes its default to true, and rejects false values on inserts and
updates. Overall eligibility requires `Project.trackId` to be null; allowing
specialized tracks into Overall is not currently supported.

The category action menus expose nested checkbox menus for challenge/track
membership, including Overall. Changes save immediately in Draft, serialize on
the hackathon lock, and commit with a before/after audit. Removing a membership
with existing project challenge entries is rejected so those entries remain
eligible. Repeating a request does not duplicate membership rows. Both lists and
the matrix reflect the saved membership after revalidation.
