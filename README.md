<div align="center">

# ABAP-STUDIO

**A browser-based SAP NetWeaver®-style ABAP training workbench.**
Faithful SAP GUI feel, a from-scratch ABAP interpreter, private user workspaces and a
100% free cloud deployment.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)
![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20Turso%20%28libSQL%29-4FF8D2)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)

[**▶ Live demo**](https://abap-studio-rd9d.vercel.app) · [Deployment guide](DEPLOY.md) · [Master specification](docs/MASTER-PROJECT-SPEC.md) · [Report an issue](https://github.com/akashgupta221/ABAP-Studio/issues)

</div>

---

## What is ABAP-Studio?

ABAP-Studio recreates the day-to-day feel of working in an SAP NetWeaver system — the
logon pad, menu tree, SE38-style editors, DDIC dictionary views and ALV grids — and runs
**actual ABAP code** through a purpose-built interpreter written in TypeScript.

It ships with a complete self-study curriculum (10 topics, 36 examples + a shared
INCLUDE, 11 demo tables with 113 rows and function modules). Every user gets a **private
practice sandbox**; training examples are shared and read-only.

> **Live demo:** https://abap-studio-rd9d.vercel.app — open it, click **Register**, and
> you are inside the secure v0.3 build. Production owner provisioning and the Vercel
> owner gate are verified: the owner can open `/admin`, and the 12 legacy programs are
> assigned to the owner. A controlled production isolation run also passed. See
> `docs/MASTER-PROJECT-SPEC.md` §1.6 for the evidence.

## Features

### 🖥️ Authentic SAP GUI experience
- SAP-style **logon pad** with system entry, client and language fields
- Full **workbench shell**: menu bar, standard toolbar, command field, status bar, tab strip
- **Easy Access** tree and command palette for transactions (SE38, SE11, SE16N, SE37, SE24, …)
- Real SAP button sets, field help, dirty-state awareness and keyboard shortcuts

### ⚙️ A real ABAP engine — from scratch
- Hand-written **tokenizer → parser → tree-walking interpreter** (`src/lib/abap/`)
- Classical ABAP subset: `REPORT`, `WRITE`, `DATA`/`TYPES`, internal tables, control flow,
  `FORM`/`PERFORM`, string/date built-ins and `CALL FUNCTION`
- **Selection screens** (`PARAMETERS`, `SELECT-OPTIONS`) and classic ABAP SQL
- **ALV-style grid** and classic list output with runtime duration
- **Syntax check** (Ctrl+F2) with SAP-style messages and line positions
- Interpreter statement and wall-clock limits

### 📚 A ready-made learning path
- 10 syllabus topics following a classical ABAP course progression
- 36 verified example programs + 1 shared INCLUDE
- **Private per-user sandbox** opened as “My Practice Program”
- Save your own programs, keep favorites and see recent activity

### 🔐 Secure accounts and private workspaces
- **Server-side sessions** validated against the database on every protected request
- Passwords hashed with **scrypt**; HTTP-only, HMAC-signed session cookies
- **Same-origin CSRF checks**, rate limiting and session revocation
- Training examples are shared/read-only; your programs and sandbox are private
- The designated owner can inspect all users and non-example programs
- **Owner-only admin dashboard** (`/admin`): metrics, activity, users, programs, audit
  log, suspend/reactivate, revoke sessions and confirmed deletion
- Built-in logon is **interim**; Clerk Email OTP + Google sign-in is planned but not yet
  implemented. The owner setup/cutover guide is [`docs/CLERK-SETUP.md`](docs/CLERK-SETUP.md).

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

The database file is **not committed** (it contains password hashes and personal
programs). On the first request the app auto-seeds the shared syllabus, examples, demo
tables and function modules. Click **Register** on the logon pad to create a user.

To make a local account the owner:

```bash
# Register the account in the UI first, then:
OWNER_USERNAME=AKASH OWNER_EMAIL="owner@example.com" bun run owner:provision
OWNER_USERNAME=AKASH bun run owner:password   # hidden input; no shell history
bun run owner:verify                          # read-only: role, email match, legacy claim
```

Add `OWNER_USERNAME="AKASH"` **or** `OWNER_EMAIL="owner@example.com"` to `.env` so the
admin gate recognizes the account. `OWNER_EMAIL` is authoritative when both are set and
must match the email stored on the owner row. Use the
command field `ADMIN` or the System menu to open the dashboard.

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
| `AUTH_SECRET` | Vercel | Long random session-signing secret — **required in production**; generate with `openssl rand -base64 32` |
| `OWNER_USERNAME` | Vercel + local | Interim single-owner account name; fallback when `OWNER_EMAIL` is unset |
| `OWNER_EMAIL` | Vercel + provisioning | Authoritative owner identity when set; must match the verified email on the `OWNER` row |

Never commit real values; `.env` is git-ignored. Do not paste secrets into chat or issues.

## Testing

```bash
bun run lint          # ESLint
bun test tests        # auth, access, sandbox and ABAP regression tests
bun run test:api      # disposable live API/security suite (port 3100)
bun run test:all      # lint + unit + API
bun run build         # production build
```

The API suite creates a throwaway database and server; it never touches local user data
or production. Stop any dev server sharing `.next` before running it.

## Deploy for free (Vercel + Turso)

Every `git push` rebuilds and redeploys the live app. The v0.3 build is live;
**database provisioning and the Vercel owner gate are verified**, and a controlled
production isolation run passed, and the owner has reviewed `/admin`. **P0 is accepted**;
the next phase is Clerk Email OTP + Google sign-in. Read
[`docs/MASTER-PROJECT-SPEC.md`](docs/MASTER-PROJECT-SPEC.md) §4.2 for the P1 cutover.
The ownership migration changes who can see legacy programs and invalidates old sessions;
the production legacy-favorites table is verified empty.

1. **GitHub** — push this repository.
2. **Turso** — create a free database, copy its `libsql://` URL and create a token.
3. **Vercel** — import the repo and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `AUTH_SECRET`, and the owner identity (`OWNER_EMAIL`, or `OWNER_USERNAME` as the
   interim fallback). If both are set, `OWNER_EMAIL` is authoritative.
4. **Seed the cloud database** — from your machine:

```bash
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run deploy:db
```

`deploy:db` applies additive schema changes and upserts shared content **without deleting
users, private programs, favorites or execution history**.

5. **Provision the owner and claim legacy programs** (after a verified backup). The
   recommended path uses the manual **Provision owner** GitHub Actions workflow: store
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and the verified `OWNER_EMAIL` as repository
   secrets, optionally set `OWNER_PASSWORD` to a fresh strong value, then run the workflow
   with `confirm=PROVISION` and `owner_username=AKASH`. It runs `owner:provision` and the
   read-only `owner:verify` without printing secrets. Delete the temporary
   `OWNER_PASSWORD` secret after the run.

   The local equivalent (set `TURSO_*` in your shell, never in Git) is:

```bash
CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=AKASH OWNER_EMAIL="owner@example.com" \
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run owner:provision

CONFIRM_OWNER_PASSWORD=YES OWNER_USERNAME=AKASH \
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run owner:password
bun run owner:verify
```

6. **Verify live owner access** — after setting `OWNER_EMAIL` (or the
   `OWNER_USERNAME` fallback) in Vercel and redeploying, run **Actions → Verify
   production**. It logs in with the temporary owner secret, checks the owner flag,
   `/api/admin/overview` and `/admin`, and prints only statuses/counts. For a controlled
   regular-user isolation test, run **Actions → Verify production isolation** with
   `confirm=ISOLATION`; it creates and deletes its own temporary user. Delete the
   temporary `OWNER_PASSWORD` secret after both checks pass.

See **[DEPLOY.md](DEPLOY.md)** for the full walkthrough.

**Deployment diagnostics:** `GET /api/health` returns database configuration and
reachability without exposing secrets:

```json
{ "ok": true, "dbTarget": "turso", "hasTursoToken": true, "hasAuthSecret": true, "users": 0, "programs": 37 }
```

## npm scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Serve the production build |
| `bun run seed` | Non-destructive content upsert + engine verification |
| `bun run deploy:db` | Apply schema + upsert content on Turso |
| `bun run owner:provision` | Assign the owner role and claim legacy programs |
| `bun run owner:password` | Hidden-input owner password reset |
| `bun run owner:verify` | Read-only check: exactly one owner, email match, no unclaimed legacy programs |
| `bun run owner:favorites` | Dry-run/apply migration of legacy global favorites to the owner |
| `bun run test` / `test:api` / `test:all` | Unit / live API / full test suites |
| `bun run db:push` | Sync the Prisma schema to the local database |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run lint` | ESLint |

## Project structure

```
prisma/
  schema.prisma          Topic, Program, DbTable, DbRow, FunctionModule,
                         ExecutionLog, User, UserFavorite, AdminAuditLog
scripts/
  seed-content.ts        Syllabus topics + demo DDIC tables
  seed-programs-1/2.ts   36 examples, shared INCLUDE, function modules
  run-seed.ts            Non-destructive content upsert + engine verification
  deploy-db.ts           Remote schema + content upsert
  provision-owner.ts     Owner role + legacy program claim
  verify-owner.ts        Read-only owner/email/legacy consistency check
  set-owner-password.ts  Hidden-input password reset
.github/workflows/
  provision-owner.yml      Manual, secret-safe owner provisioning
  verify-production.yml    Read-only live owner/admin acceptance check
  verify-isolation.yml     Controlled temp-user production isolation check
  legacy-favorites.yml     Guarded legacy-favorite dry-run/apply
src/
  app/admin/             Owner-only dashboard page
  app/api/               REST endpoints (auth, programs, admin, sandbox, execute, …)
  components/workbench/  SAP GUI: logon pad, shell, SE38/SE11/SE16N/SE37 views
  components/admin/      Owner dashboard UI
  lib/abap/              ABAP engine: tokenizer, parser, interpreter, natives
  lib/auth.ts            scrypt hashing + signed session tokens
  lib/session.ts         DB-validated sessions, owner gate, CSRF, rate limits
  lib/access.ts          Example/private/legacy visibility and edit rules
  lib/sandbox.ts         Per-user practice sandbox template
  lib/db.ts              Prisma client + additive production schema migration
tests/                   Unit tests + disposable API/security suite
```

### API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` · `login` · `logout`, `GET /api/auth/me` | User master and sessions |
| `POST /api/check` | ABAP syntax check |
| `POST /api/execute` | Run an ABAP program (authenticated) |
| `GET /api/topics` · `programs` · `tables` · `functions` · `search` | Repository and DDIC content |
| `GET/POST /api/favorites` · `GET /api/recents` | Per-user workbench state |
| `POST /api/sandbox` | Get or create the current user's private sandbox |
| `GET /api/admin/overview`, `PATCH/DELETE /api/admin/users/[id]` | Owner-only administration |
| `GET /api/health` | Deployment diagnostics (no secrets) |

## Roadmap

- Clerk Email OTP + Google sign-in and legacy account migration (blocked on owner keys)
- Separate Modern ABAP environment with an honest executable / simulated / unsupported matrix
- Distributed rate limiting for multi-instance deployments
- Broader ABAP OO coverage, RAP/AMDP constructs and UI acceptance automation

## Credits

Built by [@akashgupta221](https://github.com/akashgupta221). SAP, ABAP and NetWeaver
are trademarks of SAP SE — this project is an independent educational simulation and is
not affiliated with or endorsed by SAP.
