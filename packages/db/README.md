# @critiq/db

PostgreSQL schema, Prisma client, migrations, and installation setup for Critiq.
The supplied models are preserved; generator/configuration are adapted to Prisma 7.
Original application design notes are kept in [docs/data-model.md](docs/data-model.md).

## Local setup

From the repository root:

```bash
pnpm install
cp .env.example .env # Only when .env does not already exist.
pnpm db:up
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
`Installation.claimedAt`, and uses `HACKATHON_NAME` only for initial creation.
It creates no users, passwords, or sessions. Owner bootstrap and Better Auth
configuration belong to the later authentication workflow.

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
records. They do not guarantee these records cannot subsequently be deleted.

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
