# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.3 (implementation status)
**Date:** 24.10.2026
**Owner specification:** v0.3 (restated 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Live site:** https://abap-studio-rd9d.vercel.app (still serving commit `11d2b1c`)
**Document status:** implementation audit — **not a final acceptance certificate**

This document records **verified facts** and explicitly separates completed work,
remaining blockers and unverified claims. Planned work is labelled as such.

---

## 1. Repository audit

### 1.1 Verified stack

| Area | Verified implementation |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 5 |
| Styling | Tailwind CSS 4 + SAP GUI-inspired CSS |
| Database | Prisma 6.19; SQLite locally; Turso/libSQL when `TURSO_DATABASE_URL` is set |
| ABAP engine | Custom tokenizer, parser and interpreter in `src/lib/abap/` |
| Authentication | Interim built-in user master: scrypt hashes + HMAC-signed, HTTP-only session cookie, **validated against the database on every protected request** |
| Authorization | Server-side `OWNER` / `USER` roles, per-program ownership, per-user favorites/sandbox |
| Administration | Owner-only `/admin` dashboard and `/api/admin/*` |
| Deployment | Vercel Hobby + Turso free; `git push` deploys; additive schema migration at runtime |

### 1.2 Verified Standard ABAP capabilities

- SAP Easy Access with Favorites, Recently Used, SAP Menu and the ABAP Training tree.
- SE38 initial screen, F4 program list, Create, Display/Change and classic toolbar.
- Source editor with syntax highlighting, line numbers, find, undo/redo, patterns and
  keyboard shortcuts.
- Syntax check and execution against the interpreter: selection screens, internal tables,
  ALV, classes, function modules and database tables.
- Program save/versioning, attributes, text elements, documentation, variants (listing),
  where-used list, favorites and recent executions.
- SE80 search, SE11 dictionary, SE16 data browser, SE24 class builder, SE37 function
  builder and syllabus views.
- Interpreter statement and wall-clock limits protect against endless loops.

### 1.3 Verified security, ownership and administration (new in v0.3)

- **All content and action APIs require a valid server-side session.** Anonymous calls
  return `401` before data access.
- **Sessions are database-validated** with a per-user `sessionVersion`. Logout,
  suspension and administrative revocation invalidate tokens server-side; replaying an
  old cookie fails.
- **Same-origin CSRF checks** run on every authenticated mutation.
- **Per-process rate limits** cover logon, registration, execution and admin actions.
- **Passwords** use scrypt with a random salt; plaintext is never stored or logged.
- **Roles are server-managed only.** Public registration always creates `USER` and
  ignores a client-supplied role. The owner gate requires both the stored `OWNER` role
  and the configured `OWNER_USERNAME`, and **fails closed** if the variable is unset.
- **Examples** are shared and read-only. **Private programs** are visible/editable only
  by their creator; the designated owner may inspect and edit every non-example program.
  **Unclaimed legacy programs** are owner-only.
- **Per-user sandbox:** each user receives a private practice program. Physical names use
  `Z_MY_PRACTICE_<USERNAME>` because `Program.name` is globally unique; the UI always
  shows `Z_MY_PRACTICE`. The owner keeps any legacy `Z_MY_PRACTICE` row.
- **Owner dashboard** provides counts, user search, all programs, recent activity,
  execution health/errors, audit log, suspend/reactivate, session revocation and
  confirmed permanent deletion. The UI is not trusted for authorization; every admin API
  independently calls the owner gate.
- **Account deletion** removes the user's private programs and favorites, unlinks their
  execution logs (aggregate metrics retained), and keeps audit entries immutable.
- **Seeding is non-destructive.** `run-seed`/`deploy:db` upsert shared examples and
  syllabus content without deleting users, private programs, favorites or histories.
  The old destructive “wipe + reseed” behaviour was removed.
- **Local databases are no longer committed** because they contain password hashes and
  personal programs. A fresh clone creates its schema and auto-seeds shared content.

### 1.4 Verified gaps and blockers (must not be marked complete)

| Gap | Evidence | Impact / next action |
|---|---|---|
| **Clerk not integrated** | No Clerk dependency or keys; interim built-in logon is active | Email OTP, Google sign-in, Clerk webhooks and Clerk account migration remain blocked on owner-created keys. |
| **Modern ABAP environment not implemented** | No environment switch, CDS/RAP/AMDP runtime or capability matrix | Specification §10 is not started. Scope needs owner approval. |
| **Production ownership migration not applied** | New code is **not deployed**; live site remains `11d2b1c`. Turso/Vercel credentials are not available locally. | The 12 production legacy programs must be claimed by the owner before or during deployment. |
| **Production owner password not set** | No production provisioning has run; the password supplied in chat must be treated as exposed | Set a fresh password securely with `owner:password` after provisioning. Never paste it in chat. |
| **Legacy production favorites not migrated** | Old global `Favorite` table has no user link; new code uses `UserFavorite` | Run the supplied `owner:favorites` script (dry-run then apply) after a backup; it copies entries to the owner without deleting the old table. |
| **`AUTH_SECRET` must be present in production** | Production signer now throws if it is missing rather than using the public development fallback | Set a long random value in Vercel **before** deploying. |
| **Rate limits are per process** | In-memory limiter | Serverless instances do not share counters; interpreter limits remain authoritative. A shared limiter is future hardening. |
| **Type-check debt remains** | `bunx tsc --noEmit` reports pre-existing interpreter/example typing errors; `next build` passes | Clean up without changing verified behaviour before final acceptance. |
| **Historical local database was committed** | Earlier commits tracked `prisma/db/app.db`, which contains scrypt hashes for local demo accounts (not the production Turso database) | The file is now untracked/ignored, but it remains in Git history. Treat any password reused from those local accounts as compromised. Rewriting public history requires owner approval. |
| **Admin UI browser verification is local only** | `/admin`, owner access, regular-user denial, sandbox and isolation tested on localhost | Re-verify against the deployed production build after migration. |

### 1.5 Architecture and data flow

```
Browser (React workbench)
  │  fetch /api/*  +  HTTP-only signed session cookie
  ▼
Next.js route handlers
  │  requireUser / requireOwner
  │  → parse token → DB sessionVersion check → suspension check
  │  → same-origin CSRF check on mutations → rate limit
  ▼
src/lib/access.ts (example / private / legacy / owner rules)
  │
  ▼
Prisma client ── TURSO_DATABASE_URL set ──► Turso/libSQL (production)
                └─ otherwise ─────────────► SQLite prisma/db/app.db (local)

/api/execute ─► tokenizer → parser → interpreter
                 ├── in-memory ABAP values / internal tables
                 ├── DDIC tables from Prisma
                 └── function modules from Prisma
```

Schema models: `Topic`, `Program`, `DbTable`, `DbRow`, `FunctionModule`,
`ExecutionLog`, `User`, `UserFavorite`, `AdminAuditLog`. The obsolete global
`Favorite` model is no longer used.

### 1.6 Verification performed on 24.10.2026

- `bun run lint` — passed.
- `bun test tests` — **19 tests passed** across auth, access rules, sandbox, interpreter
  and all seeded example programs.
- `bash tests/run-api-tests.sh` — **51 end-to-end API checks passed** against a
  disposable database and an isolated server. Covered: anonymous denial on every
  protected route, CSRF rejection, registration/role escalation attempts, owner logon,
  private-program isolation, owner override, sandbox separation, favorites/recents
  isolation, execution attribution, suspension, session revocation, deletion and
  reserved-name protection.
- `bun run build` — passed.
- Manual browser verification:
  - owner logon → `/admin` dashboard data;
  - owner “My Practice Program” opens the preserved legacy `Z_MY_PRACTICE`;
  - a newly registered user receives `Z_MY_PRACTICE_UIVERIFY`, cannot see the owner's
    legacy programs and receives `403` from `/api/admin/overview`;
  - no admin link is rendered for an ordinary user.
- The test user and its sandbox were deleted after verification; the local database
  backup was removed and the database was untracked.

---

## 2. Requirement-by-requirement status

Status legend: **Done** = implemented and verified; **Partial** = verified subset;
**Missing** = not implemented; **Blocked** = needs an owner action or decision.

| Owner spec § | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 6 | Owner questions and decisions | Ongoing | Clerk keys/migration, Modern ABAP scope, production timing and legacy-favorite policy are listed in §4. |
| 7 | Clerk: email OTP, Google, protected routes, provisioning, webhooks, migration | **Blocked** | Interim built-in logon is secure and server-validated. No Clerk keys exist. |
| 8 | Owner-only admin dashboard: metrics, search, suspend/reactivate, sessions, deletion, audit | **Done (code, local)** | `/admin` and `/api/admin/*` implemented and verified; production provisioning pending. |
| 9 | Preserve and test the Standard ABAP environment | **Done (current scope)** | Screenshot fidelity preserved; automated tests execute all seeded examples. |
| 10 | Separate Modern ABAP environment + honest capability matrix | **Missing** | Needs approved executable / validated-or-simulated / unsupported scope. |
| 11 | Professional developer GUI | **Partial** | Standard SAP GUI is complete. Modern environment GUI and a formal accessibility audit are pending. |
| 12 | Data ownership and isolation | **Done (code, local)** | Server-side ownership rules + private sandbox verified. Production legacy claim pending. |
| 13 | Security and reliability | **Done (application layer)** | Sessions, CSRF, rate limiting, per-user execution authorization and audit trail. Shared/distributed limiter remains future hardening. |
| 14 | Continuous testing and completion verification | **Partial** | 19 unit tests + 51 API checks + build/lint. UI automation and final acceptance report pending. |
| 15 | Phase 0 audit | **Done** | This document. |
| 15 | Phase 1 architecture/migration design | **Partial** | Architecture and legacy ownership plan documented; Clerk migration choice pending. |
| 15 | Phases 2–8 | **In progress / blocked** | Security/admin/ownership complete in code. Clerk and Modern ABAP not started. |

### Deliverables checklist

- [x] Repository audit report — this document.
- [x] Architecture and data-flow documentation — §1.5.
- [ ] Clerk account-migration plan — blocked on owner choice.
- [ ] Clerk authentication implementation — blocked.
- [x] Owner-only administration dashboard — code + local verification; production pending.
- [x] Standard ABAP automated regression tests — 19 unit tests pass.
- [ ] Modern ABAP capability matrix and tests — pending scope approval.
- [x] Improved Standard ABAP GUI fidelity — 24.10.2026.
- [x] Security and authorization test coverage — 51 API checks pass.
- [x] Environment and deployment documentation — README, DEPLOY, `.env.example`.
- [x] Non-destructive seed/deploy path — verified locally.
- [ ] Production migration and owner provisioning — needs credentials/authorization.
- [ ] Final acceptance-test report — pending.

---

## 3. Work completed 24.10.2026

### 3.1 Standard ABAP screenshot fidelity (preserved)

The owner supplied seven screenshots of a real SAP system (`MER`, client `105`, user
`UTIT-039`) and asked that the Standard environment be faithful to them:

1. **Easy Access tree** — exact folder order, Tools ▸ ABAP Workbench structure, real
   transaction labels and gear icons, real toolbar and system identity **MER (105)**.
2. **SE38 initial screen** — real toolbar, Program/F4/Create row, Subobjects order,
   Display/Change and Create Object Directory Entry.
3. **Program Attributes** — real modal title and fields, full type list, server-side
   whitelist, read-only examples/display mode.
4. **Editor** — full application toolbar, info line, Active/Inactive states, real More
   menu and read-only display mode.
5. **System identity** — status bar, logon pad, System Status/About and `sy-sysid`
   consistently `MER (105)` / `MERAPP01`.

### 3.2 Security, ownership and owner administration (v0.3)

- Extracted pure access rules into `src/lib/access.ts` and sandbox rules into
  `src/lib/sandbox.ts`.
- Added `User.role`, `User.suspended`, `User.sessionVersion`, `User.email`,
  `Program.ownerId`, `ExecutionLog.userId`, `UserFavorite` and `AdminAuditLog`.
- Added additive, idempotent `ensureSchema()` for production-safe schema evolution.
- Added `src/lib/session.ts`: DB-validated sessions, owner gate, CSRF helper, generic
  error responses and rate limiting.
- Secured every content/action API and added `/api/sandbox`.
- Added owner dashboard at `/admin`; commands `ADMIN` and a System menu link; hidden for
  ordinary users.
- Added `scripts/provision-owner.ts` (role assignment, legacy claim, optional random
  password) and hidden-input `scripts/set-owner-password.ts`.
- Added automated tests and `test`, `test:api`, `test:all` scripts.
- Removed destructive reseeding; deployment now preserves users and their work.
- Removed the local database from version control and ignored backups/test databases.

### 3.3 Local data state

- Local database: 2 users (`AKASH` owner, `DEVELOPER`), 37 shared learning programs
  (36 examples + 1 INCLUDE) and 7 owner-claimed legacy programs.
- Production database: 49 programs (37 shared examples + 12 legacy non-example) and no
  owner assignment yet. It is unchanged until the migration is authorized.

---

## 4. Owner actions required

### 4.1 Clerk integration (blocking spec §7)

1. Create a Clerk application and enable **Email OTP** and **Google**.
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and
   `CLERK_WEBHOOK_SECRET` in Vercel. Never paste secrets into chat.
3. Choose the migration policy:
   - recommended: map verified Clerk email to the existing `User` row and retain the
     SAP username; or
   - replace the built-in logon and require re-registration.
4. Approve adding Clerk middleware and protected-route matchers so server-side route
   protection is consistent with Clerk sessions.

### 4.2 Production migration and deployment (blocking release)

The new code is **not deployed** because deployment changes ownership visibility and
invalidates old cookies. The live app must remain available until the migration is ready.
Required order:

1. Take a verified Turso backup.
2. Set `OWNER_USERNAME=AKASH` and a fresh long `AUTH_SECRET` in Vercel.
3. Deploy the new code (or run `deploy:db` + provisioning against Turso first).
4. Run:
   ```bash
   CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=AKASH \
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run owner:provision
   ```
   This assigns the owner role and claims all ownerless non-example programs.
5. Set the owner password securely, without shell history or chat:
   ```bash
   CONFIRM_OWNER_PASSWORD=YES OWNER_USERNAME=AKASH \
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" bun run owner:password
   ```
6. Migrate legacy global favorites with `owner:favorites` (dry-run first), or explicitly
   decide to discard them.
7. Re-verify: all users must log on once (old cookies intentionally invalid), then see
   only shared examples, their own programs and their own sandbox. The owner must see all
   users/programs and the audit dashboard.
8. Do not announce completion until these checks pass against production.

### 4.3 Modern ABAP scope (blocking spec §10)

Approve or adjust the honest capability matrix:

- **Executable:** ABAP 7.40 constructor expressions, inline declarations, string
  templates, and a tested `FOR` / `REDUCE` / `COND` / `SWITCH` subset.
- **Validated or simulated:** OOP declarations, CDS view definitions, RAP behavior
  definitions, AMDP signatures.
- **Unsupported:** real SAP database pushdown, real RAP runtime, real AMDP execution,
  SAP GUI dynpro generation.

### 4.4 GUI direction for Modern ABAP

Recommended: keep the SAP-style shell and add a clearly labelled Standard/Modern
environment switch with a capability banner, rather than creating a separate product.
Explicit owner approval is required before implementation.

---

## 5. Next implementation order

1. Complete production owner provisioning and legacy-favorite migration.
2. Re-run the full test suite and production-build verification against the deployed app.
3. Integrate Clerk Email OTP + Google and migrate/retire built-in accounts per owner
   decision.
4. Implement the approved Modern ABAP environment and capability matrix.
5. Add UI-level automated acceptance tests and a formal accessibility review.
6. Replace in-memory rate limiting with a shared limiter if the hosting tier requires it.
7. Publish the final acceptance report — only after every production check passes.

## 6. Commands

```bash
bun install
bun run db:push              # create/update the local schema
bun run dev                  # http://localhost:3000 (auto-seeds shared content)
bun run lint
bun test tests               # unit tests
bun run test:api             # disposable end-to-end API suite (port 3100)
bun run test:all             # lint + unit + API
bun run build
bun run seed                 # non-destructive local content upsert + engine check
bun run deploy:db            # remote schema/content upsert (requires TURSO_*)
bun run owner:provision      # assign owner + claim legacy programs
bun run owner:password       # hidden-input password reset
bun run owner:favorites      # dry-run legacy favorite migration (APPLY=YES to copy)
```

## 7. Explicit non-claims

- Clerk authentication is **not** implemented.
- The Modern ABAP environment is **not** implemented.
- The new security/ownership/admin code is **not** deployed to production.
- The 12 production legacy programs are **not** yet assigned to the owner.
- The password previously supplied in chat was **not** reused, stored or verified, and
  must be considered exposed.
- The live site is still the earlier `11d2b1c` build.
