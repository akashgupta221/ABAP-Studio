<div align="center">

# ABAP-Studio

**A browser-based SAP NetWeaver®-style ABAP training workbench.**
Faithful Standard SAP GUI, a from-scratch ABAP interpreter, a dedicated Modern ABAP
workspace, private user workspaces and a 100% free cloud deployment.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)
![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20Turso%20%28libSQL%29-4FF8D2)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)

[**▶ Live demo**](https://abap-studio.akashgupta.is-a.dev) · [Deployment guide](DEPLOY.md) · [Master specification](docs/MASTER-PROJECT-SPEC.md) · [Final acceptance report](docs/FINAL-ACCEPTANCE-REPORT.md) · [Report an issue](https://github.com/akashgupta221/ABAP-Studio/issues)

</div>

---

## What is ABAP-Studio?

ABAP-Studio recreates the day-to-day feel of working in an SAP NetWeaver system — the
logon pad, menu tree, SE38 editors, DDIC dictionary views and ALV grids — and runs
**actual ABAP code** through a purpose-built interpreter written in TypeScript. A separate
**Modern ABAP workspace** adds executable 7.40 constructor expressions plus validated CDS,
RAP and AMDP artefacts, with an explicit capability matrix instead of pretending to be a
real HANA/RAP runtime.

The shared curriculum contains 10 topics, **41 preloaded objects** (36 Standard examples,
1 shared INCLUDE and 4 Modern examples), 11 demo tables with 113 rows and function
modules. Everyone can read the examples; private programs and sandboxes are isolated per
user.

> **Project status:** P0 security/ownership and P1 Clerk cutover are deployed and accepted.
> The P2 Modern ABAP scope, UI/accessibility automation and permanent legacy-auth removal
> are deployed and production-smoke-verified. Technical acceptance evidence is in the
> [final acceptance report](docs/FINAL-ACCEPTANCE-REPORT.md); the only remaining gate is
> the owner's visual sign-off of the modernised Standard/Modern workspace. Live counts are
> always available at `/api/health`.

## Features

### 🖥️ Authentic Standard SAP GUI
- SAP-style **logon pad** and the real `MER` / client `105` system identity
- Full workbench shell: menu bar, standard toolbar, command field, status bar and tabs
- **Easy Access** tree, command palette and transactions (SE38, SE11, SE16N, SE37, SE24, …)
- Real SAP button sets, field help, dirty-state awareness and keyboard shortcuts
- The Standard screenshot-fidelity work is preserved; the Modern workspace is a separate
  view opened from **ABAP Training → Modern ABAP Workspace** or command `MODERN`

### ⚙️ A real ABAP engine — from scratch
- Hand-written **tokenizer → parser → tree-walking interpreter** (`src/lib/abap/`)
- Classical ABAP subset: `REPORT`, `WRITE`, `DATA`/`TYPES`, internal tables, control flow,
  `FORM`/`PERFORM`, string/date built-ins and `CALL FUNCTION`
- **Selection screens** (`PARAMETERS`, `SELECT-OPTIONS`) and classic ABAP SQL
- **ALV-style grid** and classic list output with runtime duration
- **Syntax check** (Ctrl+F2) with SAP-style messages and line positions
- Interpreter statement and wall-clock limits

### 🧪 Modern ABAP workspace
| Capability | Level | What happens |
|---|---|---|
| ABAP 7.40 inline declarations, string templates, `VALUE`, `FOR`, `REDUCE`, `COND`, `SWITCH` | **Executable** | Runs in the local interpreter, including the verified `Z_MD_CONSTRUCTORS` example |
| CDS view entities | **Validated** | Structural DDIC simulator; no SQL is executed |
| RAP behavior definitions | **Validated** | Structural syntax/relationship checks; no RAP or OData runtime |
| AMDP classes and SQLScript bodies | **Simulated** | Signature and SQLScript structure checks; the database procedure is not executed |
| Real HANA pushdown, RAP/OData runtime, AMDP execution, dynpro generation | **Unsupported** | Clearly labelled in the workspace; never implied by the UI |

The workspace includes shared examples, a starter template for private ABAP/CDS/RAP/AMDP
objects, server-side validation, ABAP execution, save/delete for owner-created private
objects and an always-visible capability matrix.

### 📚 A ready-made learning path
- 10 syllabus topics following a classical ABAP course progression
- 36 Standard examples, 1 shared INCLUDE and 4 Modern examples
- **Private per-user sandbox** opened as “My Practice Program”
- Save your own programs, keep favorites and see recent activity

### 🔐 Secure accounts and private workspaces
- **Clerk Email OTP + Google** with verified-email account linking; password, phone and
  username sign-in are disabled
- Clerk proves identity only; the database remains authoritative for roles, suspension,
  program ownership and audit history
- **Server-side sessions**, same-origin CSRF checks, rate limiting and session revocation
- Training examples are shared/read-only; private programs and Modern objects are
  creator-only, and the owner can inspect all non-example programs
- **Owner-only admin dashboard** (`/admin`): metrics, 7-day chart, activity, users,
  programs, audit log, suspend/reactivate, revoke sessions, confirmed deletion and
  program deletion
- The owner gate requires database `role = OWNER` **and** a matching `OWNER_EMAIL`;
  production fails closed if the email is missing or mismatched
- **Legacy password authentication is permanently retired.** `/api/auth/login` is a
  `403` stub, `/api/auth/register` is a `410` stub, no password is stored for the live
  path, and the old scrypt/HMAC modules and password-reset script have been deleted.
  Automated tests use a separate test-only session broker that refuses Vercel/Turso.

Guides: [`docs/CLERK-SETUP.md`](docs/CLERK-SETUP.md),
[`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md) and
[`docs/FREE-DOMAIN-SETUP.md`](docs/FREE-DOMAIN-SETUP.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, serverless routes) + React 19 |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, Radix UI, Framer Motion, Lucide icons |
| State / data | Zustand, TanStack Query |
| Database | Prisma 6 + libSQL driver adapter — SQLite locally, [Turso](https://turso.tech) in the cloud |
| ABAP engine | Custom tokenizer / parser / interpreter (`src/lib/abap/`) |
| Deployment | Vercel **Hobby** + Turso **free** plan |

## Getting started (local)

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.2 · Git

```bash
# 1) Clone
git clone https://github.com/akashgupta221/ABAP-Studio.git
cd ABAP-Studio

# 2) Install dependencies (also runs prisma generate)
bun install

# 3) Configure the environment
cp .env.example .env

# 4) Create the local database schema
bun run db:push

# 5) Run
bun run dev                   # → http://localhost:3000
```

The database file is **not committed** (it contains identities and personal programs). On
the first request the app auto-seeds the shared syllabus, examples, demo tables and
function modules.

Manual browser sign-in requires Clerk development keys in `.env`. Without Clerk, the
workbench stays visually available but there is no manual logon path; use the automated
suites below, which run against a disposable database with a test-only session broker.
The production build cannot use the broker because it refuses Vercel and
`TURSO_DATABASE_URL` environments.

To make a Clerk account the owner:

```bash
# Sign in once so the Clerk identity creates/links its database row, then:
OWNER_EMAIL="owner@example.com" OWNER_USERNAME=AKASH bun run owner:provision
bun run owner:verify
```

The provisioning script never creates or stores a password. `OWNER_EMAIL` is required for
production access; `OWNER_USERNAME` is a non-production fallback only and is ignored on
Vercel or when `NODE_ENV=production`.

Production build locally:

```bash
bun run build && bun run start
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local | SQLite file path — `file:./db/app.db` (relative to `prisma/`) |
| `TURSO_DATABASE_URL` | Vercel + shell | libSQL URL of the Turso database (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | Vercel + shell | Turso access token |
| `OWNER_EMAIL` | Vercel + provisioning | Authoritative owner identity; must match the verified email on the `OWNER` row. Required in production |
| `OWNER_USERNAME` | local only | Non-production/unit-test fallback; rejected on Vercel and in production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel + local | Clerk browser key (`pk_live_…` in production) |
| `CLERK_SECRET_KEY` | Vercel + local | Clerk server key (`sk_live_…`); never expose |
| `CLERK_WEBHOOK_SECRET` | Vercel | Clerk webhook signing secret for `/api/webhooks/clerk` |
| `E2E_TEST_MODE` / `E2E_TEST_SECRET` | test runners only | Disposable test-session broker; never set in Vercel or against real data |

Never commit real values; `.env` is git-ignored. Do not paste secrets into chat or issues.
`AUTH_SECRET`, `LEGACY_AUTH_MODE` and `NEXT_PUBLIC_LEGACY_AUTH_MODE` are no longer read by
the application and should be removed from existing deployments.

## Testing

```bash
bun run lint          # ESLint
bun run typecheck     # TypeScript (tsc --noEmit)
bun run test          # 35 unit tests (118 assertions)
bun run test:api      # 87 disposable live API/security checks (port 3100)
bun run test:ui       # 12 Playwright UI + axe accessibility tests (port 3101)
bun run test:all      # lint + typecheck + unit + API + UI
bun run build         # production build (TypeScript enforced)
```

The API and UI suites create throwaway databases and isolated servers; they never touch
local user data or production. Run them sequentially because both use the Next.js `.next`
build directory. The UI suite fails on serious or critical WCAG 2.x axe findings and
covers the public logon, secure auth pages, keyboard navigation, mobile overflow, owner
workbench, SE38, admin tabs and the Modern workspace.

## Deploy for free (Vercel + Turso)

Every `git push` to `main` rebuilds and redeploys the live app. Production is
`https://abap-studio.akashgupta.is-a.dev`, running Clerk-only authentication. P0/P1 are
accepted; the P2 release is deployed and production-verified, with final owner visual
sign-off still pending.

The domain path is documented in [`docs/FREE-DOMAIN-SETUP.md`](docs/FREE-DOMAIN-SETUP.md).
The app origin and Clerk Frontend API are live on is-a.dev.

1. **GitHub** — push this repository. The `CI` workflow runs lint, type-check, unit,
   API, UI/axe and the production build with no secrets.
2. **Turso** — create a free database, copy its `libsql://` URL and create a token.
3. **Vercel** — import the repo and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `OWNER_EMAIL`, the Clerk production publishable/secret keys and
   `CLERK_WEBHOOK_SECRET`. Do **not** set any legacy-auth variables. Follow
   [`docs/FREE-DOMAIN-SETUP.md`](docs/FREE-DOMAIN-SETUP.md),
   [`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md) and
   [`docs/CLERK-SETUP.md`](docs/CLERK-SETUP.md).
4. **Seed the cloud database** — from your machine:

```bash
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run deploy:db
```

`deploy:db` applies additive schema changes (including the Modern environment columns) and
upserts shared content **without deleting users, private programs, favorites or execution
history**. It verifies all 41 seeded objects, including executable Modern ABAP and the
validated CDS/RAP/AMDP examples.

5. **Provision the owner** (after a verified backup). The recommended path uses the manual
   **Provision owner** GitHub Actions workflow: store `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, and the verified `OWNER_EMAIL` as repository secrets, then run the
   workflow with `confirm=PROVISION` and `owner_username=AKASH`. It runs
   `owner:provision` and the read-only `owner:verify` without printing secrets.

   The local equivalent (set `TURSO_*` in your shell, never in Git) is:

```bash
CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=AKASH OWNER_EMAIL="owner@example.com" \
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run owner:provision
bun run owner:verify
```

6. **Verify live access** — sign in with Email OTP or Google. Check `/api/auth/me`
   (`role=OWNER`, `owner=true`), `/api/admin/overview` (`200`) and `/admin`. Run the manual
   **Production smoke** workflow for read-only public checks. Do not create a password
   account.

See **[DEPLOY.md](DEPLOY.md)** for the full walkthrough.

**Deployment diagnostics:** `GET /api/health` returns database configuration and
reachability without exposing secrets:

```json
{ "ok": true, "dbTarget": "turso", "clerkConfigured": true, "authProvider": "clerk", "passwordLogon": "retired", "users": 1, "programs": 55 }
```

`programs` includes shared examples and private objects; use the admin dashboard for the
current breakdown. The `55` above is illustrative after the four Modern examples are
seeded, not a frozen acceptance count.

## npm scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Serve the production build |
| `bun run seed` | Non-destructive content upsert + engine/validator verification |
| `bun run deploy:db` | Apply additive schema + upsert content on Turso |
| `bun run owner:provision` | Assign the owner role and claim legacy programs |
| `bun run owner:verify` | Read-only check: exactly one owner, email match, no unclaimed legacy programs |
| `bun run owner:favorites` | Dry-run/apply migration of legacy global favorites to the owner |
| `bun run test` / `test:api` / `test:ui` / `test:all` | Unit / live API / UI+axe / full suites |
| `bun run db:push` | Sync the Prisma schema to the local database |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript check (`tsc --noEmit`) |

## Project structure

```
prisma/
  schema.prisma          Topic, Program, DbTable, DbRow, FunctionModule,
                         ExecutionLog, User, UserFavorite, AdminAuditLog
scripts/
  seed-content.ts        Syllabus topics + demo DDIC tables
  seed-programs-1/2.ts   Standard examples, shared INCLUDE, function modules
  seed-modern.ts         Four Modern ABAP/CDS/RAP/AMDP examples
  run-seed.ts            Non-destructive content upsert + engine/validator verification
  deploy-db.ts           Remote schema + content upsert
  provision-owner.ts     Owner role + legacy program claim (never a password)
  verify-owner.ts        Read-only owner/email/legacy consistency check
.github/workflows/
  ci.yml                   Lint, type-check, unit, API, UI/axe and build (no secrets)
  production-smoke.yml     Public read-only production checks
  deploy-database.yml      Manual production schema/content update (secret-safe)
  provision-owner.yml      Manual, secret-safe owner provisioning
  legacy-favorites.yml     Guarded legacy-favorite dry-run/apply
src/
  app/admin/             Owner-only dashboard page
  app/api/               REST endpoints (auth, modern, programs, admin, sandbox, execute, …)
  components/workbench/  SAP GUI shell + Standard and Modern workspaces
  components/admin/      Owner dashboard UI
  lib/abap/              ABAP engine: tokenizer, parser, interpreter, natives
  lib/modern.ts          Capability matrix, templates and CDS/RAP/AMDP validators
  lib/test-auth.ts       Test-only session broker (production fails closed)
  lib/session.ts         DB-validated sessions, owner gate, CSRF, rate limits
  lib/access.ts          Example/private/legacy visibility and edit rules
  lib/sandbox.ts         Per-user practice sandbox template
  lib/db.ts              Prisma client + additive production schema migration
tests/                   Unit tests, disposable API suite, Playwright UI/axe suite
```

### API overview

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/me`, `POST /api/auth/logout` | Clerk session identity and revocation; legacy login/register are retired (`403`/`410`) |
| `POST /api/webhooks/clerk` | Signed Clerk user sync (created/updated/deleted) |
| `/sign-in`, `/sign-up` | Clerk Email OTP + Google authentication pages |
| `POST /api/check` | ABAP syntax check |
| `POST /api/execute` | Run an ABAP program (authenticated) |
| `GET/POST /api/modern`, `GET/PUT/DELETE /api/modern/[id]` | List/detail/create/update/delete Modern objects |
| `POST /api/modern/validate` | Validate ABAP or CDS/RAP/AMDP source |
| `GET /api/topics` · `programs` · `tables` · `functions` · `search` | Repository and DDIC content (Standard list only) |
| `GET/POST /api/favorites` · `GET /api/recents` | Per-user workbench state |
| `POST /api/sandbox` | Get or create the current user's private sandbox |
| `GET /api/admin/overview`, `PATCH/DELETE /api/admin/users/[id]`, `DELETE /api/admin/programs/[id]` | Owner-only administration |
| `GET /api/health` | Deployment diagnostics (no secrets) |

## Roadmap and explicit boundaries

- **P2 Modern ABAP:** implemented, deployed and production-verified. Final owner visual
  sign-off is the only remaining acceptance gate; technical evidence is in the
  [final acceptance report](docs/FINAL-ACCEPTANCE-REPORT.md).
- **Accessibility:** automated axe checks pass for the current serious/critical threshold;
  broader manual screen-reader review is future work.
- **Rate limiting:** per process. A shared distributed limiter is future hardening.
- **Modern runtime:** real HANA pushdown, RAP/OData runtime, AMDP execution and dynpro
  remain deliberately unsupported and are labelled as such.
- **Broader ABAP:** additional OO/RAP/AMDP constructs can be added with tests; the current
  subset is verified, not a full SAP kernel.

## Credits

Built by [@akashgupta221](https://github.com/akashgupta221). SAP, ABAP and NetWeaver are
trademarks of SAP SE — this project is an independent educational simulation and is not
affiliated with or endorsed by SAP.
