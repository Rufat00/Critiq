# Critiq

Hackathon judging software. This repository starts with the workspace structure
and development principles used by Appliance-CRM, adapted to Critiq.

```text
apps/
  web/              Next.js App Router application
    src/app/        Placeholder home page and auth API route
packages/
  auth/             Better Auth server, Prisma adapter, and session helper
  core/             Server-side business logic
    src/
  db/               Prisma schema, migrations, and shared database client
    prisma/         Schema, migrations, and setup seed
    src/            Shared client and public Prisma exports
  constants/           Browser-safe shared constants
    src/
AGENTS.md           Development instructions
compose.dev.yaml    Local PostgreSQL and Mailpit
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

`pnpm db:up` starts PostgreSQL and Mailpit. `pnpm db:down` stops both development
services and keeps the database volume.
`pnpm db:logs` follows database logs. Change `DB_PORT` and `DATABASE_URL`
together if port 5432 is already in use.

For SMTP testing, send mail to `127.0.0.1:1025` without authentication or TLS.
Open the Mailpit inbox at <http://localhost:8025>. The example environment
includes SMTP settings; application email sending is not wired up yet.
An app running inside the Compose network should use `mailpit:1025`.
Change `SMTP_PORT` or `MAILPIT_UI_PORT` if the host ports are already in use.

## Current scope

Web has a minimal Next.js shell, a Better Auth API route, and a React auth client.
`@critiq/auth` owns server configuration and session lookup using the existing
Prisma auth models. The DB package retains its schema, migrations, and setup seed.
Account provisioning, owner bootstrap, sign-in screens, and judging workflows
are not implemented yet.

Run `pnpm db:generate` after installation before type checking or importing
`@critiq/db`. Read [packages/db/README.md](packages/db/README.md) for DB commands,
SQL constraints, environment loading, and remaining application invariants.
The supplied design notes are preserved in
[packages/db/docs/data-model.md](packages/db/docs/data-model.md).

Run `pnpm dev` to start web at <http://localhost:3000>, `pnpm build` for a
production build, and `pnpm start` to serve it. The web scripts load root `.env`
before starting Next.js; explicit environment variables take precedence. Other
runtime consumers must supply `DATABASE_URL` before importing `@critiq/db`.

## Authentication

Set `APP_URL` to the app origin and `AUTH_SECRET` to a unique
secret of at least 32 characters (generate one with `openssl rand -base64 32`).

The server selects the sign-in method at startup from deployment configuration:
nonempty `SMTP_HOST` enables email OTP; without it, email/password and
username/password sign-in are enabled. Delivery failures never change this mode.
The existing example SMTP configuration therefore selects OTP. OTP delivery is
a temporary **console-only stub**: email, code, and purpose appear in the server
terminal. No SMTP connection or mailing service is used. Replace the stub before
using this deployment for real users. Codes expire after 10 minutes, allow five
attempts, and are stored hashed. Public sign-up and OTP auto-registration are
disabled, so accounts must already be provisioned. The DB seed creates no users.

Import `auth`, `authMode`, or `getAuthSession(headers)` from `@critiq/auth` on
the server. Use the session helper when creating trusted request context; it
checks that the user remains active. New sessions also reject inactive users.
Core still owns business permissions and assignment checks.

The browser client is `apps/web/src/lib/auth/auth-client.ts`. It exposes
`authClient.useSession()`, `signIn.emailOtp`, `emailOtp.sendVerificationOtp`,
`signIn.email`, `signIn.username`, and `signOut`, with the server enforcing which
method is enabled. The client uses same-origin `/api/auth` and imports server
types only; auth secrets and Prisma stay on the server.

The Next.js route forwards GET/POST requests to Better Auth. Cookie-changing
auth calls currently go through that route; no Server Action auth flow is added.

## Web theme and components

Web uses Tailwind CSS v4 and local shadcn New York/Radix component source.
`apps/web/components.json` enables CSS variables and maps the class helper to
`@/lib/cn`. The supplied Base-inspired palette lives in
`apps/web/src/app/globals.css`, imported once by the root layout. Geist is
self-hosted through the `geist` package, so builds do not fetch Google Fonts.
Light mode is the default; dark tokens are available without a theme toggle.

The web primitives are installed through the official shadcn CLI. The `new-york`
configuration uses one `radix-ui` package for interactions. Components cover
buttons, form fields, dialogs and sheets, menus and search, tabs, tables,
sidebar navigation, badges, and score/status controls. Their source is owned by
this repository and adapted to the theme; CLI regeneration may overwrite those
style changes. Button variants are `default`, `secondary`, `soft`, `ghost`, and
`destructive`. `LoadingButton` keeps its width while pending. The combobox
combines shadcn's Command and Popover and has a persistent label.

`AppPage` supplies spacing and either a 760px standard column or a 1120px wide
column. SummaryPanel, ActionTile, SettingsGroup/SettingsRow, EmptyState,
ResultRow, CoverageIndicator, and ScoreField are small compositions of the
installed primitives. Forms and judging workflows will use these when built.

## Package boundaries

- Web authenticates requests, creates trusted context, calls core, and renders UI.
- Auth owns identity, credentials, auth sessions, and the Better Auth adapter.
- Core owns validation, authorization, business rules, queries, and mutations.
- DB owns the Prisma schema, migrations, and database client.
- Constants contains shared static values with no server or database dependencies.

Use `@critiq/*` workspace imports. Keep business database access inside core;
web should consume core operations rather than query Prisma directly.

Core operations use `createQuery({ name, schema })` or
`createMutation({ name, schema })`. Zod schemas validate raw input and infer
the parsed handler input. The wrapper also infers `ctx: AppContext` and returns
`(ctx, input) => Promise<Result>` for pages or safe actions:

```ts
import { z } from 'zod';
import { requireHackathonId } from '@critiq/core/context';
import { createQuery } from '@critiq/core/operations';

const getHackathonName = createQuery({
  name: 'hackathons.getName',
  schema: z.void(),
})(async ({ ctx }) => {
  const id = requireHackathonId(ctx);
  return ctx.db.hackathon.findUniqueOrThrow({
    where: { id },
    select: { name: true },
  });
});
```

Use `roles: [UserRole.OWNER, UserRole.ADMIN]` to restrict an operation. For a
mutation, pass an `audit` option beside the handler to write an audit row in the
same transaction. Its callbacks select the entity ID and safe before/after
snapshots; never pass raw form input or secrets to the audit record. Handlers
still validate business state and related-record ownership. The wrappers
preserve expected `AppError`s, normalize common Prisma conflicts, and hide
unexpected errors from callers. Web's `createSafeAction` returns those same
core error codes without another mapping layer.

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

## Email package

[`@critiq/mail`](packages/mail/README.md) provides standalone `sendInvite` and
`sendOTP` delivery through Gmail SMTP, AWS SES SMTP, regular SMTP, or SendGrid,
selected by environment variables. It includes styled HTML/plain-text templates
and explicit `NO_EMAIL_LOWER_SECURITY_MODE` delivery opt-out. It is not yet wired
to registration or the existing Better Auth OTP stub. See the package README for
provider configuration, system-email requirements, tests, and local previews.
