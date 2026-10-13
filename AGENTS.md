# Critiq Development Instructions for Agents

Critiq is hackathon judging software. It is **UX-first**: every feature should
feel clear, safe, responsive, and polished. Make sure the user understands what
is happening at every step, especially when saving scores or finalizing results.

These instructions are adapted from Appliance-CRM's `INSTRUCTIONS.md`.
They describe the target development principles, not already implemented APIs.

## Current Stage and Package Restrictions

- Web has a minimal Next.js shell, Better Auth route, and React auth client.
  The auth package owns the server configuration; provisioning and sign-in UI
  remain future work. The DB package contains the approved single-installation
  hackathon schema, client, migrations, and setup seed.
  Do not build application features unless asked.
- pnpm is the package manager. Use workspace dependencies and commit lockfile
  changes alongside manifest changes.
- Do not add, install, or reintroduce new packages without approval. Prefer
  existing workspace packages and primitives. Explain a missing dependency's
  purpose when approval is needed. Installing the already declared dependencies
  is routine setup.
- Prisma is installed in `packages/db`; Better Auth is in `packages/auth` and
  web, and Next.js/React, Tailwind v4, and shadcn primitives are in web.
  TanStack Form and direct Zod usage remain intended conventions for future work.
- Keep the scaffold minimal. Add directories and public exports only when they
  have an implementation; do not create empty domains for symmetry.

## Project Structure

- `apps/web`: Next.js App Router application, UI, authentication boundaries,
  route adapters, and request context creation.
- `packages/auth`: Better Auth server configuration, identity/session helpers,
  and authentication database access. Browser auth client and routes live in web.
- `packages/core`: all server-side business logic, runtime validation,
  authorization, business database access, and workflow orchestration.
- `packages/db`: Prisma schema, migrations, generated client configuration,
  and shared database client. No judging rules here.
- `packages/constants`: shared browser-safe static values. No secrets, Prisma,
  server-only imports, or side effects.
- Shared web primitives belong in `apps/web/src/components` and `src/lib`.
- Route-specific components, actions, queries, and helpers belong beside their
  route or route group. Keep actions and queries thin adapters to core.

Example once a workflow exists:

```text
apps/web/src/app/(dashboard)/events/[eventId]/submissions/
  page.tsx
  loading.tsx
  error.tsx
  actions.ts
  queries.ts
  components/
    submission-list.tsx
  lib/
    format-submission-status.ts
```

Use domain route names such as `events`, `submissions`, `judges`, `rubrics`,
`assignments`, `scores`, `results`, and `settings`. Avoid vague names like
`data`, `management`, `screens`, or `modules`.

## Pre-Production Breaking Changes

Critiq is not in production and has no supported legacy consumers.

- Make clean breaking changes directly. Avoid compatibility shims, fallback
  reads, dual writes, deprecated aliases, or transitional adapters.
- Update schema, migrations, callers, tests, seeds, and fixtures together so
  the repository has one current implementation.
- Do not add backfills solely to preserve disposable development data. Update
  fixtures and use a development reset when appropriate; do not reset shared
  or production data without explicit authorization.
- Delete superseded code after replacements are in place.
- Assume no legacy support is required unless the user identifies production
  data, a released client, or an external API contract that must be preserved.

## Naming Conventions

Names should be boring, searchable, and obvious.

- Files/folders: kebab-case, such as `submission-list.tsx`, `create-event-schema.ts`.
- React components: PascalCase, such as `SubmissionList`, `ScoreStatusBadge`.
- Server actions: verb-first with `Action`, such as `submitScoreAction`.
- Queries: `getSubmissionById`, `findJudgeByEmail`, `listEventSubmissions`.
- Business operations: domain verbs, such as `assignJudge`, `submitScore`,
  `publishResults`.
- Schemas: camelCase with `Schema`; files use `*-schema.ts`. Infer input/output
  types beside their schemas.
- Input/output types: scoped PascalCase, such as `SubmitScoreInput`.
- Prisma models: singular PascalCase; table maps: plural snake case.
- Database fields: camelCase. Enums: PascalCase names and SCREAMING_SNAKE_CASE values.
- Stable operation/permission names: dot-based strings, such as `scores.submit`.
- Use `At` for timestamps and `Date` for calendar dates.

Avoid vague names like `handleThing`, `processData`, `Data`, `Payload`, or
`Result` unless clearly scoped, such as `PublishResultsResult`.

## Core Development

`@critiq/core` is the authoritative server-side business layer. Implement
infrastructure as real workflows need it, without copying unused CRM APIs.

### Ownership and Boundaries

- Core owns Zod schemas, runtime validation, authorization, permissions,
  business rules, Prisma queries/mutations, filtering, sorting, pagination,
  search, business errors, audits, and business helpers.
- Transports authenticate, gather trusted request context, call core, and
  translate safe results/errors for their clients.
- Core must not import `next/*`, React, browser code, headers/cookies, request
  objects, or authentication-provider request APIs. Core never retrieves sessions.
- Authentication establishes identity; core decides what that identity may do.
- Business Prisma access belongs in core. DB internals and authentication
  infrastructure may access Prisma for their own responsibilities.
- Use Prisma directly; do not introduce generic repository classes or an
  access-policy framework without a concrete need.

### Trusted Context and Authorization

- Use an `AppContext` for the database client, trusted actor, hackathon/category
  scope as required by the schema, and named request metadata.
- Resolve membership, assignments, and permissions from trusted server data.
  Never accept client-supplied identity or permissions as authoritative.
- Request metadata may include request ID, IP address, user agent, and source.
  Source is diagnostic metadata, never an authorization substitute.
- Keep user, platform, and trusted system actors distinct if those actors are
  introduced. Do not fabricate user sessions for background work.
- Scope queries directly to the authorized event/organization wherever possible.
  An event ID in a URL or request input alone does not grant access.
- Verify related submission, team, judge, rubric, criterion, assignment, and
  score IDs belong to the intended scope and are valid for the operation.
- Judges may access and score only authorized assignments. Privileged organizer
  operations require their own permissions. UI visibility is never authorization.

### Operations and Validation

- Keep reads in `queries/`, writes in `mutations/`, schemas in `schemas/`, and
  domain helpers near their domain. Never use `actions/` inside core.
- One public operation per file and one primary schema per `*-schema.ts` file.
- Use `getX` for record-or-not-found, `findX` for record-or-null, and `listX`,
  `countX`, or `getXSummary` for their respective intent.
- Validate in core even when the UI or transport already validated. Handlers
  receive parsed input and callers receive inferred input/output types.
- Schemas validate formats, enums, lengths, limits, and parsing. Handlers
  validate ownership, assignments, availability, and state transitions.
- Validate score ranges against the actual rubric, judging window, submission
  status, and judge assignment. Enforce duplicate/conflicting writes using
  database constraints and appropriate transactions when implemented.
- Use shared operation wrappers for validation, authorization, safe errors,
  and transaction/audit behavior once repeated workflows justify them.
- Keep reusable infrastructure in `context/` and `shared/`. Avoid generic
  `utils.ts` or `helpers.ts` catchalls.
- Expose existing public subpaths such as `@critiq/core/scores`; never deep-import
  `@critiq/core/src/...`. Keep implementation helpers private by default.

### Transactions and Auditing

- Database-only changes and their required audits should commit in the same
  transaction. A failure must roll back both.
- Never hold a database transaction open during external network calls. Separate
  explicit database phases from provider work; use an outbox when warranted.
- Core owns transactions and audits; transport layers do not orchestrate them.
- Audit sensitive operations such as score submission/changes, assignment
  changes, judging closure, and result publication when these are implemented.
- Audit actor and scope from trusted context. Record useful before/after
  snapshots without secrets, credentials, or unsafe full request payloads.
- Retries must not duplicate score submissions or result publication effects.
- Result calculation rules, weights, rounding, and tie handling belong in core
  and must be deterministic and tested against the agreed judging rules.

### Errors and Diagnostics

- Use shared `AppError`, `AppErrorCode`, and field-error concepts when the error
  infrastructure is introduced. Expected errors should distinguish validation,
  unauthenticated, forbidden, not-found, conflict, and invalid-state failures.
- Preserve expected business errors and provide field errors where appropriate.
- Never leak raw Zod/Prisma/provider errors, SQL, stacks, or database details.
- Log unexpected exceptions server-side with useful structured operation,
  actor, scope, and request context. Return a safe retry message to clients.
- Do not log passwords, secret keys, auth tokens, credentials, or unsafe payloads.
- Use a shared logger adapter when introduced; do not assume a logger package
  already exists.

### Lists, Filtering, Sorting, and Search

- Use consistent list input: `{ pagination, filters?, search?, sort? }`.
- Normal tables use numbered pagination: page starts at 1, page size defaults
  to 25, allowed sizes are `10 | 25 | 50 | 100`.
- Return items and pagination metadata: page, pageSize, totalItems, totalPages,
  hasNextPage, and hasPreviousPage. Centralize pagination math.
- Empty results retain the requested page with zero totals and false navigation
  flags. Item and count queries must use the same scoped `where` conditions.
- Whitelist filter and sort fields. Never expose arbitrary Prisma inputs or
  client-controlled nested boolean query trees.
- Keep search separate from filters; trim/collapse whitespace, cap its length,
  and normalize empty input. Domains own their relevant search fields.
- Limit client sort fields, specify defaults, and add deterministic ID
  tiebreakers and explicit nullable ordering where needed.
- Introduce query builders when lists become substantial. Add indexes for actual
  scope/filter/sort/search patterns, rather than every column.
- Future exports should reuse filtering/search and export all matches rather
  than only the visible table page.

### Transport Adapters

- Server Actions own authentication, trusted scope selection, request metadata,
  context creation, core calls, and centralized safe result/error translation.
- Actions do not own business schemas, permissions, audits, business validation,
  or business Prisma queries. FormData conversion may stay in the transport.
- Page/layout gates improve navigation; every core operation still authorizes.
- Add other transports only when requested; they must reuse the same core rules.

## Next.js Pages and Feedback

Every route that loads data should provide loading, error, and empty states
with clear retry actions. Never leave a blank screen, broken layout, or raw error.

- Inline field errors for validation.
- Toasts for quick non-blocking success/failure feedback.
- Callouts for important page warnings or errors.
- Small nearby feedback for copy actions.
- Confirm dialogs for destructive or serious actions, such as publishing results.
- Unsaved-change guards where navigation could discard form edits or scores.
- Blocking overlays only when the user truly cannot continue.
- Loading buttons and appropriate disabled states during asynchronous actions.

## Components, Mobile Design, and Layout

- Check `apps/web/src/components/ui` before creating UI, once that directory
  exists. Reuse fitting primitives and create new ones only when necessary.
- Build proper mobile layouts. Use cards/lists instead of compressed desktop
  tables, show primary details first, and put secondary details in expansion,
  menus, or sheets. Use drawers for dialogs where appropriate on phones.
- All forms, filters, dialogs, navigation, and judging controls must work on phones.
- Put shared app/section UI and gates in layouts to avoid repetition.
- Admin page headers contain the title and relevant actions. Card headers
  contain the title, actions, and useful record metadata. Avoid eyebrows and
  generic descriptions unless requested.

## Forms

- Support page forms and button-triggered dialog forms; use drawers on phones
  when appropriate.
- Use TanStack Form for interactive client forms and Zod for validation once
  these dependencies are approved and installed.
- Map field validation failures to the shared field-error component.
- Show a submit button loader and disable duplicate submission while pending.
- Preserve input on recoverable failures and communicate whether a score is
  saved, pending, or submitted according to the implemented workflow.
- Use clear English copy. Internationalization is not part of the scaffold.

## Required Quality and Security

- Include loading/error/empty states, success/failure feedback, mobile layouts,
  disabled pending states, serious-action confirmations, and unsaved guards
  where relevant.
- Review authorization, event/organization isolation, related-ID ownership,
  server validation, secret exposure, query injection, XSS, and sensitive audits.
- Keep secrets out of constants, client bundles, logs, and committed files.
- Validate file ownership, MIME type, size, and visibility if uploads are added.
- Test implemented business behavior: permissions, scope isolation, rubric
  bounds, assignments, state conflicts, concurrent/duplicate writes, transaction
  rollback, result calculation/ties, and safe error translation as applicable.
- Colocate focused operation tests. Deliver coherent, usable workflows with
  schemas, operations, adapters, UI states, and relevant checks together.
- Do not create tests that merely mirror scaffold files or empty implementations.

## Database Model

- The approved model is single-installation and one hackathon per deployment;
  do not add organization tenancy without a new requirement.
- See `packages/db/docs/data-model.md` for the supplied design notes and
  `packages/db/README.md` for enforced SQL constraints and remaining core rules.
- Preserve the Better Auth models; auth provisioning/bootstrap is future work.
  OTP delivery currently logs to the server console without using SMTP.
- Use migrations for schema changes. Do not use `db push` to bypass custom SQL
  constraints. Generate the Prisma client after installing dependencies or
  changing the schema. Production uses `db:deploy`, never `db:migrate`.
