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
- Valid room rotation percentage, room capacities, project numbers, and assignment attempts.
- Rankings are 1-based; schema uniqueness prevents duplicate ranking positions.
- At most one active assignment per judge/category.
- Valid invitation maximum/use counts.

Constraints enforce _at most one_ singleton; provisioning creates the required
records. Overall has a required Track and is protected against deletion and conversion. Deferred triggers enforce category/subtype completeness and ownership. Project track membership is required, and the foreign key restricts deleting occupied tracks.

Core must still enforce the supplied cross-record rules: common hackathon
ownership for projects, room links and challenge links, eligibility and conflicts, current-room
validity, room capacity, rubric locking and score
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

The admin home shows counts for tracks (including Overall) and challenges, active
projects, active judges, and active rooms. Marking Ready requires successful
server-side readiness validation and acknowledgment of any warnings; there are
no manual section completions. Marking Ready does not start judging.

Readiness validates category configuration, project eligibility, and active room
capacity. Every active, non-disqualified project must have an assigned room and
table number; missing locations block Ready and cannot be acknowledged away.
Judge accounts, category access, and conflicts do not affect readiness. Judges
can still be added in Ready; judge availability checks belong to the future
start-judging workflow.

Draft/Ready transitions serialize on the hackathon row and commit with audits.
Configuration mutations use the same hackathon lock and require Draft status.
Judge management remains available in both Draft and Ready. Organizers can return
to Draft before judging starts to unlock the other settings.

## Category configuration

The admin categories page lists Overall as the default, protected track with
its own `Track` record. Optional descriptions live on
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

The matrix shows challenge eligibility across tracks using explicit `ChallengeTrack` links,
including Overall;
challenge judging remains independent of track awards. Project counts show all
registered projects or challenge entries, including inactive entries. Overall counts projects assigned to its Track ID.

Category deletion requires an organizer, Draft status, no judging activity, and
an audit committed in the same transaction. A track with projects cannot be deleted;
move those projects first. Deletion removes the category's dependent configuration. Create controls open guarded forms; edit remains a placeholder. New rubric categories require named criteria with weights in 10% increments totaling exactly 100%. Each added item starts at 20%. Category, subtype, rubric criteria, and audit save in one transaction. The staged creation form selects Overall by default for challenges. Specialized tracks are selected individually. New tracks select existing challenges explicitly; future tracks never inherit challenges automatically. Related IDs are checked against the current hackathon, and membership links save with the category and audit.

Every project has a required `trackId`, including Overall projects. Track judging
eligibility compares `Project.trackId` with the category's Track ID. Specialized
tracks remain excluded from Overall. Challenges select eligible track IDs through
`ChallengeTrack`; there is no separate Overall eligibility flag.

The `20261019000000_explicit_overall_track` migration is a clean pre-production
change and refuses populated databases before making changes. For an existing
disposable development database, an explicitly approved development reset is
required; deploy migrations before running the setup seed. Do not reset shared
or production data. No automatic data conversion or compatibility path is provided.

The category action menus expose nested checkbox menus for challenge/track
membership, including Overall. Changes save immediately in Draft, serialize on
the hackathon lock, and commit with a before/after audit. Removing a membership
with existing project challenge entries is rejected so those entries remain
eligible. Repeating a request does not duplicate membership rows. Both lists and
the matrix reflect the saved membership after revalidation.

## Automatic project locations

Rooms store a nonnegative `TrackRoom.capacity` for each track, including Overall.
The create/edit form shows a single slider per track. New capacities start at zero;
edits load saved counts. Each slider is capped at the track's unassigned projects
plus those already in the edited room. The server rechecks availability under the
Draft lock, so stale submissions fail without partial room or placement writes.

Projects fill active track/room capacities in `Project.registrationOrder`.
Rooms follow `sortOrder`, room creation time, room ID, then link ID. After placement, each room receives a consecutive block from the global number
sequence, and its projects are numbered in registration order across tracks.
Room order follows the first occurrence in the configured placement order; empty
rooms consume no numbers. With enough capacity for each track, 101 projects receive numbers 1–101.
Projects beyond their track's capacity keep both location fields null; placed
projects never have numbering gaps. `Project.tableNumber` stores this global
project number. A deferred unique constraint on `(hackathonId, tableNumber)`
allows atomic renumbering while enforcing uniqueness at commit.

Creation, imports, project updates/deletion, spot edits, and every room edit
recalculate placement inside the initiating transaction. Changes and their audits
commit together. Unchanged placements do not create duplicate placement audits.
Projects with judging activity cannot be moved or renumbered. The edit form warns
that saving may reassign existing project numbers and locations. Room rows expand
to show track capacity usage and actual project numbers colored by track; project names are
available through hover, keyboard focus, or tap.

The `20261112000000_room_capacities` migration replaces table ranges directly.
It refuses databases containing ranges or existing project locations, so it never
silently discards an existing room configuration. A configured disposable development
database requires an explicitly approved reset before migration. Do not reset a
shared or production database. Apply migrations with `pnpm db:deploy`; regenerate
the client with `pnpm db:generate`.

Room deletion is available beside Edit inside an expanded room and requires
confirmation. An organizer may delete rooms only in Draft. Core first deactivates
the room and recalculates project locations, then deletes the room and track
capacities. Projects are retained; overflow becomes unassigned and numbering is
compacted globally. Projects with judging activity block changes to their locations.
Deletion and placement audits commit together, preserving original room IDs in
placement snapshots; any failure rolls back the entire operation.
