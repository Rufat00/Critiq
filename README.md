# Critiq

Hackathon judging software. This repository starts with the workspace structure
and development principles used by Appliance-CRM, adapted to Critiq.

```text
apps/
  web/              Next.js App Router application
    src/app/        Login, registration, setup, and auth API routes
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
docker compose -f compose.dev.yaml up -d
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm db:check
pnpm typecheck
pnpm format:check
```

`docker compose -f compose.dev.yaml up -d` starts PostgreSQL and Mailpit. `docker compose -f compose.dev.yaml down` stops both development
services and keeps the database volume.
`docker compose -f compose.dev.yaml logs -f postgres` follows database logs. Change `DB_PORT` and `DATABASE_URL`
together if port 5432 is already in use.

For SMTP testing, send mail to `127.0.0.1:1025` without authentication or TLS.
Open the Mailpit inbox at <http://localhost:8025>. The example environment
includes SMTP settings; authentication uses the existing mail package to send codes.
An app running inside the Compose network should use `mailpit:1025`.
Change `SMTP_PORT` or `MAILPIT_UI_PORT` if the host ports are already in use.

## Current scope

Web includes email-first login at `/`, registration directly on invitation links
at `/invite`, and one-time owner registration within the setup welcome flow.
There is no standalone registration route. Owners configure the hackathon at
`/setup`; organizers manage setup sections under `/admin`.

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

Set `SETUP_PASSCODE` to a unique value of at least 12 characters. On an unclaimed
installation, `/` shows the setup welcome screen. A correct passcode grants
20 minutes to register the owner on the same page. The database claim, account, and audit commit
atomically; removing the owner never reopens setup. The seed creates no users.

Normal authentication uses six-digit email codes through `@critiq/mail`. Configure
`EMAIL_HOST` for SMTP or `SENDGRID_API_KEY`; local Mailpit uses the example settings.
Set `NO_EMAIL_LOWER_SECURITY_MODE=true` explicitly to use email/password sign-in
instead. Delivery failures do not change modes. Codes expire after 10 minutes,
allow five attempts, and are hashed at rest. Registration codes have a one-minute
resend cooldown. OTPs and credentials are never logged.

Registration validates a full name of at least two words, email, a password of
8–128 characters without whitespace or invisible characters, and two agreements.
Email mode verifies ownership
before creating the account and discards the password. Password mode stores only
a Better Auth password hash. Registration requires a valid invitation after the owner has claimed setup. An
invitation at `/invite#token=...` can grant an admin role or judge categories.
Invitation-bound email is locked in the UI and enforced by core. Invitation scope,
expiry, use limits, and category ownership are checked in the registration
transaction. The Judges section supports track-specific invitations, search,
pagination, moving judges, and removing track access while in draft. Pending
invitations can be revoked. Email invites are bound to the recipient and expire
after 24 hours; unbound QR invitations expire after 20 minutes, allow up to 100
judge registrations, and rotate the previous link for that track. Both store only a
SHA-256 token hash. QR codes are rendered locally with `qrcode`; invitation
tokens are never sent to an external QR service. Invitation URLs carry the token in a fragment; the landing
page automatically validates it, clears it from browser history, transfers it to
an HttpOnly cookie, and displays the registration form in place. Reloads resume
using that cookie. The server reads the invitation from the cookie and revalidates
it before sending a code and inside the account-creation transaction. Email delivery runs outside database transactions, and
failed deliveries revoke their invitations. Use HTTPS for production APP_URL.

Successful login routes owners/admins to `/admin` and judges to `/judging`.
Registration signs in automatically and sends the first owner to `/setup`.
If account creation succeeds but session creation fails, the login page confirms
that the account is ready and lets the user sign in without registering again.

The browser auth client calls same-origin `/api/auth`. Public Better Auth sign-up
and OTP auto-registration remain disabled; registration goes through the core
workflow. Role and activity are checked against trusted database data whenever
web creates authentication context.

Run `pnpm test:registration` and `pnpm test:auth` for focused registration, setup,
and verification-code tests. They use a
transactional test double to check validation, permission failures, invitation
scope/use limits, email proofs, owner claim conflicts, and audit rollback. Live
PostgreSQL concurrency and browser/email integration should also be checked in
a configured development installation.

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
installed primitives. All client forms use TanStack Form, with shadcn Field
composition and labels backed by the shared Label primitive. Inputs, textareas,
and verification-code inputs disable autocomplete dropdowns by default, while
leaving spellcheck, capitalization, and autocorrect at normal browser defaults.

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
