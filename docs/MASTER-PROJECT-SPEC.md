# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.3 (implementation status)
**Date:** 24.10.2026
**Owner specification:** v0.2 (supplied 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Production:** https://abap-studio-rd9d.vercel.app

This document is the requirement-by-requirement audit demanded by Phase 0 of the
owner specification. It records **verified facts only**; planned work is labelled
as such. The source of truth is the repository at the commit shown by
`git log -1` when this file was last updated.

---

## 1. Repository audit (Phase 0)

### 1.1 Stack verified in the repository

| Area | Verified implementation |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS + SAP GUI-inspired CSS in `src/app/globals.css` |
| Database | Prisma 6.19.x; local SQLite (`prisma/db/app.db`); Turso/libSQL adapter when `TURSO_DATABASE_URL` is set (`src/lib/db.ts`) |
| Runtime | Custom ABAP tokenizer, parser and interpreter in `src/lib/abap/` |
| Authentication | Built-in user master: scrypt password hashes + HMAC-signed HTTP-only session cookie (`src/lib/auth.ts`) — **not Clerk** |
| Deployment | Vercel Hobby; `bun run deploy:db` pushes schema/seed to Turso; `git push` triggers a production deployment |
| Health | `GET /api/health` reports DB target, token presence, row counts and raw DB errors |

### 1.2 Verified capabilities (Standard ABAP environment)

- SAP Easy Access with Favorites, Recently Used, SAP Menu, ABAP Training tree.
- SE38 initial screen with F4 program list, Create, Display/Change and the classic
  application toolbar.
- Source editor with ABAP syntax highlighting, line numbers, find (Ctrl+F), undo/redo,
  statement patterns and keyboard shortcuts.
- Syntax check and execution against a custom interpreter (selection screens, internal
  tables, ALV, classes, function modules, database tables).
- Program save, version increment, attributes, text elements, documentation, variants
  (read-only listing), where-used list, favorites and recent executions.
- SE80-style search, SE11 dictionary, SE16 data browser, SE24 class builder,
  SE37 function builder, training syllabus.
- Interpreter protection against endless loops:
  statement limit and wall-clock time limit (`src/lib/abap/interpreter.ts`).

### 1.3 Verified gaps (must not be marked complete)

| Gap | Evidence | Impact |
|---|---|---|
| **No server-side authentication on APIs** | No `src/middleware.ts`; no session check in `/api/programs`, `/api/favorites`, `/api/recents`, `/api/execute`, etc. | Anyone who knows the URL can read/write repository data. Client-side logon only. |
| **No per-user data isolation** | `Program` has no owner field; `Favorite` has no `userId`; `/api/favorites` returns all rows | All users share programs and favorites. Contradicts specification §12. |
| **No administration dashboard** | No admin route, no role flag, no audit log model | Specification §8 not started. |
| **Clerk not integrated** | No Clerk dependency or keys; built-in logon is the only auth | Specification §7 blocked on owner-provided Clerk project. |
| **No Modern ABAP environment** | No environment switch, CDS/RAP/AMDP support, or capability matrix | Specification §10 not started. |
| **No automated test suite** | No `test` script, no `*.test.ts`/`*.spec.ts`; `scripts/run-seed.ts` verifies 38 example programs against the engine | Regression coverage is manual only. |
| **No rate limiting / CSRF protection** | No middleware or limiter | Security hardening pending. |
| **Deployed database has no users from local dev** | Turso holds seeded programs only; users must register | Expected; see README. |

### 1.4 Architecture and data flow (current)

```
Browser (React workbench, Zustand store)
  │  fetch /api/*
  ▼
Next.js Route Handlers (src/app/api/*)
  │  Prisma client
  ▼
src/lib/db.ts ── TURSO_DATABASE_URL set ──► Turso/libSQL (production)
              └─ otherwise ───────────────► SQLite prisma/db/app.db (local)

/api/execute ─► tokenizer → parser → interpreter (src/lib/abap)
                 ├── in-memory ABAP values / internal tables
                 ├── DDIC tables from Prisma (DbTable/DbRow)
                 └── function modules from Prisma (FunctionModule)
```

Schema models: `Topic`, `Program`, `DbTable`, `DbRow`, `FunctionModule`,
`ExecutionLog`, `User`, `Favorite`.

### 1.5 Verification performed on 24.10.2026

- `bun run lint` — passed.
- `bun run build` — passed (Next.js production build, all routes generated).
- Manual browser test at `http://localhost:3000`:
  - Built-in logon with local `DEVELOPER` account.
  - Easy Access tree shows the screenshot order (Financial Services Network
    Connector → … → Tools → ABAP Workbench → Development → … → WebClient UI
    Framework).
  - SE38 initial screen shows the real toolbar set (Check, Activate, Execute,
    Where-Used List, Environment Analysis, Online Help, Delete…, Copy…, Rename…,
    Debugging, With Variant, Variants, More).
  - Program Attributes dialog opens with real fields and the full type list
    (unsupported types disabled and rejected by the API).
  - Attributes save persisted the new title and returned the status message
    “Attributes for program … saved”.
  - Create → Create Object Directory Entry → Local Object created a program and
    opened it in the editor.
  - Editor toolbar (Display<>Change, Active<>Inactive, …, More) and
    Include/Report + Active/Inactive status line verified.
- Test data created during verification (`Z_FIDELITY_TEST`) was deleted and the
  local SQLite file restored; no test data is committed.

---

## 2. Requirement-by-requirement status

Status legend: **Done** = implemented and verified; **Partial** = some verified
functionality, remaining work listed; **Missing** = not implemented;
**Blocked** = requires an owner action/credential or an explicit decision.

| Spec § | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 6 | Owner questions and decisions | Ongoing | Clerk, owner identity and Modern ABAP scope questions are listed in §4 below. |
| 7 | Clerk: email OTP, Google, protected routes, provisioning, webhooks, migration | **Blocked** | No Clerk project/keys. Built-in SAP-style logon works. Needs owner to create the Clerk app and set keys in Vercel. Account migration policy also needs a decision. |
| 8 | Owner-only administration dashboard (metrics, user search, suspend/reactivate, sessions, deletion, audit log) | **Missing** | No admin model/routes/UI. Requires schema additions (`role`, `suspended`, `AdminAuditLog`, session versioning). |
| 9 | Preserve/test Standard ABAP environment | **Partial** | Environment works; screenshots fidelity upgraded 24.10.2026. Automated regression suite still missing. |
| 10 | Separate Modern ABAP environment + capability matrix + tested claims | **Missing** | Not started. Recommended scope: executable 7.40 subset, validated/simulated CDS/RAP/AMDP, honest unsupported list. |
| 11 | Professional developer GUI | **Partial** | SAP GUI workbench, editor, navigation, states and keyboard shortcuts exist. Standard screens now mirror the supplied screenshots. Modern environment GUI not built; accessibility audit pending. |
| 12 | Data ownership and isolation | **Missing** | Global `Program`/`Favorite` data. Server-side ownership checks absent. |
| 13 | Security and reliability | **Partial** | scrypt + HMAC cookie, HTTP-only session, interpreter step/time limits. Missing: API authentication, rate limiting, CSRF strategy, per-user execution authorization, admin audit log. |
| 14 | Continuous testing and completion verification | **Partial** | Lint, production build, seed verification (38 programs) and manual browser flows pass. Automated unit/API/security tests missing. |
| 15 | Phase 0 audit | **Done** | This document. |
| 15 | Phase 1 architecture/migration design | **Partial** | Current architecture documented above; account/ownership migration plan pending Clerk decision. |
| 15 | Phases 2–8 | **Not started / in progress** | Clerk (blocked), admin (missing), Modern ABAP (missing), regression tests (missing), release verification (build passes). |

### Deliverables checklist

- [x] Repository audit report — this document.
- [x] Architecture and data-flow documentation — §1.4.
- [ ] Schema and account-migration plan — pending Clerk decision.
- [ ] Clerk authentication implementation — blocked.
- [ ] Owner-only administration dashboard — pending.
- [ ] Standard ABAP automated regression tests — pending.
- [ ] Modern ABAP capability matrix and tests — pending.
- [x] Improved Standard ABAP GUI fidelity — 24.10.2026 (see §3).
- [ ] Security and authorization test coverage — pending.
- [x] Environment and deployment documentation — `README.md`, `DEPLOY.md`, `.env.example`.
- [x] Updated README and work log — README is current; `worklog.md` updated 24.10.2026.
- [ ] Final acceptance-test report — pending.

---

## 3. Work completed 24.10.2026 (Standard ABAP fidelity)

The owner supplied seven screenshots of a real SAP system (`MER`, client `105`,
user `UTIT-039`) and asked that the **Standard ABAP environment** be made faithful
to them. Implemented and verified:

1. **Easy Access tree** (`src/components/workbench/easy-access.tsx`)
   - Exact standard folder order: Financial Services Network Connector, Global
     Bike Transactions, Office, Cross-Application Components, Logistics,
     Accounting, Human Resources, Patient Accounting, Information Systems, Tools,
     WebClient UI Framework.
   - Tools → ABAP Workbench → Overview / Development / Programming Environment /
     Enhancement Framework / Switch Framework; Development contains ABAP
     Dictionary, Data Modeler, User Interface, ABAP Editor, Function Builder,
     Class Builder, Shared Objects Area Administration, Shared Objects Monitor.
   - Business Object Builder (SWO1) under Tools; gear icons for transactions.
   - Real toolbar labels (SAP menu, SAP Business Workplace, Add to Favorite, More,
     search/print/exit) with the remaining functions preserved in the More menu.
   - System identity shown as **MER (105)**.

2. **SE38 initial screen** (`src/components/workbench/se38-initial.tsx`)
   - Real toolbar set and order, text buttons, exact labels.
   - Program + F4 + Create row; Subobjects heading with rule and radio list in the
     real order (Source code, Variants, Attributes, Text elements, Documentation);
     Display/Change buttons.
   - Create now opens **Create Object Directory Entry** (R3TR PROG, package $TMP,
     person responsible, original system MER, language EN, created date,
     Local Object / Lock Overview / X).

3. **Program Attributes dialog**
   - Modal with title `ABAP: Program Attributes <name> Change|Display`.
   - Title, Original Language, Created, Last Changed, Status, Type (full real list),
     Status (Unclassified/System/Test), Authorization Group, Application,
     Editor lock.
   - Save persists title/type through `PUT /api/programs/[id]`; unsupported real
     SAP types are disabled in the UI and rejected server-side.
   - Examples and display mode are read-only.

4. **Editor** (`src/components/workbench/editor-view.tsx`)
   - Application toolbar: Display<>Change, Active<>Inactive, Other Object...,
     Enhance, Check, Activate, Direct Processing, Where-Used List, Display Object
     List, Display Navigation Window, More.
   - Info line shows Report/Include/Class/Function group, program name and
     `Inactive (Revised)` / `Inactive` / `Active`.
   - Display mode makes the editor read-only; More menu contains Save, Save As,
     Attributes, Where-Used and Delete.

5. **System identity consistency**
   - Status bar, logon pad, System Status/About dialogs and runtime `sy-sysid`
     updated to MER (105) / MERAPP01.

6. **API**
   - `GET /api/programs` now returns `createdAt` (used by the attributes dialog).
   - `PUT /api/programs/[id]` accepts a whitelisted `type`.

---

## 4. Owner actions required (blockers and decisions)

1. **Clerk (spec §7) — blocking.**
   Create a Clerk application, enable **Email OTP** and **Google** sign-in, then set
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and
   `CLERK_WEBHOOK_SECRET` in Vercel (never paste secrets in chat). Decide how the
   existing built-in accounts should migrate:
   - recommended: map Clerk email to the existing `User` row and keep old
     usernames as a `legacyUsername` field; or
   - replace the built-in logon completely and require users to register again.

2. **Owner identity for the administration dashboard (spec §8).**
   Decide which account is the single owner. Recommended: set `OWNER_EMAIL` in
   Vercel and enforce it server-side; do not rely on a hidden UI button.

3. **Modern ABAP scope (spec §10).**
   Recommended capability matrix:
   - Executable: ABAP 7.40 constructor expressions, inline declarations,
     string templates, `FOR`/`REDUCE`/`COND`/`SWITCH` subset.
   - Validated/simulated: OOP declarations, CDS view definitions, RAP behavior
     definitions, AMDP signatures.
   - Unsupported: real SAP database pushdown, real RAP runtime, real AMDP
     execution, SAP GUI dynpro generation.
   Confirm or adjust this scope before implementation.

4. **GUI direction for Modern ABAP (spec §11).**
   Recommended: keep the SAP-style shell and add a clearly labelled
   Standard/Modern environment switch, rather than a separate visual product.

---

## 5. Next implementation order

1. Server-side authentication and per-user ownership (prerequisite for admin and
   security; does not require Clerk).
2. Automated test harness (`bun test`) covering interpreter, APIs, auth and UI
   logic; add regression cases for the screenshots fidelity work.
3. Owner-only admin dashboard with audit log (after owner identity is set).
4. Clerk integration and account migration (after owner creates the Clerk app).
5. Modern ABAP environment + capability matrix.
6. Rate limiting, CSRF review and security-boundary tests.
7. Final release verification and acceptance report.

## 6. Commands

```bash
bun install
bun run dev                 # http://localhost:3000
bun run lint
bun run build
bun run seed                # local wipe + reseed + engine verification
bun run deploy:db           # remote Turso DDL + seed (requires TURSO_* env)
```
