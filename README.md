# Critiq

Hackathon judging software. This repository starts with the workspace structure
and development principles used by Appliance-CRM, adapted to Critiq.

```text
apps/
  web/              Reserved for the Next.js App Router application
    src/app/        Empty route directory
packages/
  core/             Server-side business logic
    src/
  db/               Prisma schema, migrations, and shared database client
    prisma/         Schema, migrations, and setup seed
    src/            Shared client and public Prisma exports
  constants/           Browser-safe shared constants
    src/
AGENTS.md           Development instructions
compose.dev.yaml    Local PostgreSQL with a localhost port
compose.yaml        Production PostgreSQL foundation without a public port
.env.example        Example local database configuration
```

## Development setup

Use Node.js 22.12 or newer, pnpm 10.30.0 (pinned in `package.json`), and Docker
with Compose. If Corepack is available, `corepack enable` enables pnpm.

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm db:check
pnpm typecheck
pnpm format:check
```

`pnpm db:down` stops the development database and keeps its data volume.
`pnpm db:logs` follows database logs. Change `DB_PORT` and `DATABASE_URL`
together if port 5432 is already in use.

## Current scope

Web remains an empty Next.js workspace placeholder. The DB package is operational
with your supplied schema, Prisma 7/PostgreSQL adapter, shared client, initial
and constraints migrations, setup seed, and CLI commands. Authentication and
judging workflows are not implemented yet.

Run `pnpm db:generate` after installation before type checking or importing
`@critiq/db`. Read [packages/db/README.md](packages/db/README.md) for DB commands,
SQL constraints, environment loading, and remaining application invariants.
The supplied design notes are preserved in
[packages/db/docs/data-model.md](packages/db/docs/data-model.md).

When web development starts, initialize Next.js in `apps/web` and add its
dev/build/start scripts. Prisma CLI commands load root `.env`; runtime consumers
must supply `DATABASE_URL` before importing the database package. Next.js does
not automatically inherit the workspace root `.env`.

## Package boundaries

- Web authenticates requests, creates trusted context, calls core, and renders UI.
- Core owns validation, authorization, business rules, queries, and mutations.
- DB owns the Prisma schema, migrations, and database client.
- Constants contains shared static values with no server or database dependencies.

Use `@critiq/*` workspace imports. Keep business database access inside core;
web should consume core operations rather than query Prisma directly.

## Production foundation

`compose.yaml` provisions only PostgreSQL. Supply production credentials using
the deployment environment or a separate environment file:

```bash
docker compose --env-file /path/to/production.env -f compose.yaml up -d
```

The development and production files are independent and use separate volumes.
Do not combine them as overrides. Production requires explicit database
credentials and publishes no host database port. Add the web image/service,
app environment and deployment configuration once the app exists. Run
`pnpm db:deploy` to apply migrations and `pnpm db:seed` for initial provisioning.
