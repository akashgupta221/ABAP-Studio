<div align="center">

# ABAP-STUDIO

**A browser-based SAP NetWeaver®-style ABAP training workbench.**
Faithful SAP GUI feel, a from-scratch ABAP interpreter, and a 100% free cloud deployment.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)
![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20Turso%20%28libSQL%29-4FF8D2)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)

[**▶ Live demo**](https://abap-studio-rd9d.vercel.app) · [Deployment guide](DEPLOY.md) · [Report an issue](https://github.com/akashgupta221/ABAP-Studio/issues)

</div>

---

## What is ABAPForge?

ABAPForge recreates the day-to-day feel of working in an SAP NetWeaver system — the
logon pad, the menu tree, SE38-style editors, DDIC dictionary views, ALV grids — and
runs **actual ABAP code** through a purpose-built interpreter written in TypeScript.

It ships with a complete self-study curriculum (10 topics, 38 programs, 11 demo tables
with 113 rows, function modules) so you can log on and start writing, checking and
running classical ABAP within seconds — no SAP installation, no license, no cost.

> **Live demo:** https://abap-studio-rd9d.vercel.app — open it, click **Register**,
> and you are inside the system.

## Features

### 🖥️ Authentic SAP GUI experience
- SAP-style **logon pad** with system entry, client and language fields
- Full **workbench shell**: menu bar, standard toolbar, command field, status bar, tab strip
- **Easy Access** menu tree and a command palette for transactions (SE38, SE11, SE16N, SE37, SE24, …)
- Real SAP button sets, field help, dirty-state awareness on Save, and keyboard shortcuts

### ⚙️ A real ABAP engine — from scratch
- Hand-written **tokenizer → parser → tree-walking interpreter** (`src/lib/abap/`)
- Classical ABAP subset: `REPORT`, `WRITE` lists, `DATA`/`TYPES`, internal tables with `READ TABLE` / `LOOP AT` / `APPEND` / `SORT` / `DELETE`, `IF`/`CASE`/`DO`/`WHILE`, `FORM`/`PERFORM`, string and date built-ins, `CALL FUNCTION`
- **Selection screens** — `PARAMETERS` and `SELECT-OPTIONS` with defaults
- **Classic ABAP SQL** against the demo DDIC tables (`SELECT … INTO TABLE`, aggregates, joins)
- **ALV-style grid output** and classic list output, with runtime/duration shown per run
- **Syntax check** (Ctrl+F2) with SAP-style error messages and line positions

### 📚 A ready-made learning path
- 10 syllabus topics following a classical ABAP course progression
- 37 example programs + shared include — every one verified against the engine
- Editable sandbox program **`Z_MY_PRACTICE`** for your own experiments
- Save your own programs, keep favorites, and see recent activity

### 🔐 Built-in user master
- SAP-style **Register / Log on / Log off** — no third parties
- Passwords hashed with **scrypt**; sessions are **HMAC-signed, HTTP-only cookies** (7-day TTL)
- Per-user favorites and activity, persisted in the database

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, serverless routes) + React 19 |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4, Radix UI, Framer Motion, Lucide icons |
| State / data | Zustand, TanStack Query |
| Database | Prisma 6 + libSQL driver adapter — SQLite locally, [Turso](https://turso.tech) in the cloud |
| ABAP engine | Custom tokenizer / parser / interpreter (`src/lib/abap/`) |
| Deployment | Vercel **Hobby** + Turso **free** plan (no credit card) |

## Getting started (local)

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.2 · Git

```bash
# 1) Clone
git clone https://github.com/akashgupta221/ABAP-Studio.git
cd ABAP-Studio

# 2) Install dependencies (also runs prisma generate)
bun install

# 3) Configure the environment
cp .env.example .env          # defaults to the bundled SQLite database

# 4) Run
bun run dev                   # → http://localhost:3000
```

The repository ships with a **pre-seeded local database** (`prisma/db/app.db`), so you
can log on immediately. Click **Register** on the logon pad to create your own user,
or rebuild the content at any time:

```bash
bun run db:push   # sync the Prisma schema to the local database
bun run seed      # wipe + reseed all content and verify every example program
```

Production build locally:

```bash
bun run build && bun run start
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local | SQLite file path — `file:./db/app.db` (relative to `prisma/`) |
| `TURSO_DATABASE_URL` | Vercel + shell | libSQL URL of your Turso database (`libsql://…`) — when set, the app talks to Turso |
| `TURSO_AUTH_TOKEN` | Vercel + shell | Turso access token (create one per database) |
| `AUTH_SECRET` | Vercel | Random string used to sign session cookies — generate with `openssl rand -base64 32` |

Never commit real values; `.env` is git-ignored.

## Deploy for free (Vercel + Turso)

Every `git push` rebuilds and redeploys the live app automatically. In short:

1. **GitHub** — push this repository.
2. **Turso** — create a free database, copy its `libsql://` URL and create a token.
3. **Vercel** — import the repo and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`.
4. **Seed the cloud database** — from your machine:

```bash
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run deploy:db
```

`deploy:db` applies the schema (idempotent) and seeds all content to the remote
database. See **[DEPLOY.md](DEPLOY.md)** for the complete step-by-step walkthrough.

**Deployment diagnostics:** `GET /api/health` on any running instance returns
database configuration and reachability — without exposing any secrets:

```json
{ "ok": true, "dbTarget": "turso", "hasTursoToken": true, "users": 0, "programs": 38 }
```

## npm scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Serve the production build |
| `bun run seed` | Wipe + reseed content and verify all example programs |
| `bun run deploy:db` | Push schema + seed to the remote Turso database |
| `bun run db:push` | Sync the Prisma schema to the local database |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run lint` | ESLint |

## Project structure

```
prisma/
  schema.prisma          Prisma models (Topic, Program, DbTable, DbRow,
                         FunctionModule, ExecutionLog, User, Favorite)
  db/app.db              Pre-seeded local SQLite database
scripts/
  seed-content.ts        Syllabus topics + demo DDIC tables
  seed-programs-1/2.ts   37 example programs, include, sandbox, function modules
  run-seed.ts            Seed + engine verification for every program
  deploy-db.ts           Remote schema + seed (used by `deploy:db`)
src/
  app/api/               REST endpoints (auth, programs, tables, execute, health, …)
  components/workbench/  SAP GUI: logon pad, shell, SE38/SE11/SE16N/SE37 views,
                         ALV grid, selection screens, class & function builders
  lib/abap/              The ABAP engine: tokenizer, parser, interpreter, natives
  lib/auth.ts            scrypt hashing + signed session cookies
  lib/db.ts              Prisma client (SQLite locally, libSQL adapter for Turso)
```

### API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` · `login` · `logout`, `GET /api/auth/me` | User master & sessions |
| `POST /api/check` | ABAP syntax check |
| `POST /api/execute` | Run an ABAP program on the engine |
| `GET /api/topics` · `programs` · `tables` · `functions` · `search` | Repository & DDIC content |
| `GET/POST /api/favorites` · `GET /api/recents` | Per-user workbench state |
| `GET /api/health` | Deployment diagnostics (no secrets) |

## Roadmap

- Broader ABAP OO coverage (class builder foundations are in place)
- RAP / AMDP constructs beyond the current classical subset
- More syllabus topics and additional demo applications

## Credits

Built by [@akashgupta221](https://github.com/akashgupta221). SAP, ABAP and NetWeaver
are trademarks of SAP SE — this project is an independent educational simulation and
is not affiliated with or endorsed by SAP.
