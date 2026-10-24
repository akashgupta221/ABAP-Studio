# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.3 (implementation status)
**Date:** 24.10.2026
**Owner specification:** v0.3 (restated 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Live site:** https://abap-studio-rd9d.vercel.app (v0.3 security; owner gate and production isolation verified 24.10.2026)
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
  and a configured identity: `OWNER_EMAIL` is authoritative when set; `OWNER_USERNAME`
  remains the interim built-in-auth fallback. It **fails closed** if neither is set.
- **Examples** are shared and read-only. **Private programs** are visible/editable only
  by their creator; the designated owner may inspect and edit every non-example program.
  **Unclaimed legacy programs** are owner-only.
- **Per-user sandbox:** each user receives a private practice program. Physical names use
  `Z_MY_PRACTICE_<USERNAME>` because `Program.name` is globally unique; the UI always
  shows `Z_MY_PRACTICE`. The owner keeps any legacy `Z_MY_PRACTICE` row.
- **Owner dashboard** provides counts, a 7-day execution/error chart, user search, all
  programs, recent activity, execution health/errors, audit log, suspend/reactivate,
  session revocation and confirmed permanent deletion. The UI is not trusted for
  authorization; every admin API independently calls the owner gate.
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
| **Legacy production favorites: verified empty** | Dry-run run `40111257243` found the old global `Favorite` table empty. | No migration is needed. The guarded workflow is retained for future databases; no data was copied or deleted. |
| **`AUTH_SECRET` rotation optional** | Production health reports `hasAuthSecret: true`; the signer fails closed if it is missing | The existing secret is working. Rotation is optional and invalidates all sessions (expected). |
| **Rate limits are per process** | In-memory limiter | Serverless instances do not share counters; interpreter limits remain authoritative. A shared limiter is future hardening. |
| **Type-check debt remains** | `bunx tsc --noEmit` reports pre-existing interpreter/example typing errors; `next build` passes | Clean up without changing verified behaviour before final acceptance. |
| **Historical local database was committed** | Earlier commits tracked `prisma/db/app.db`, which contains scrypt hashes for local demo accounts (not the production Turso database) | The file is now untracked/ignored, but it remains in Git history. Treat any password reused from those local accounts as compromised. Rewriting public history requires owner approval. |
| **Final UI/accessibility automation pending** | The owner visually reviewed `/admin` on 24.10.2026; production owner and isolation checks pass. | Add automated UI checks and an accessibility audit before final acceptance. |

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
- `bash tests/run-api-tests.sh` — **52 end-to-end API checks passed** against a
  disposable database and an isolated server. Covered: anonymous denial on every
  protected route, CSRF rejection, registration/role escalation attempts, owner logon,
  private-program isolation, owner override, sandbox separation, favorites/recents
  isolation, execution attribution, suspension, session revocation, deletion,
  reserved-name protection and the owner 7-day execution series.
- `bun run build` — passed.
- Manual browser verification:
  - owner logon → `/admin` dashboard data;
  - owner “My Practice Program” opens the preserved legacy `Z_MY_PRACTICE`;
  - a newly registered user receives `Z_MY_PRACTICE_UIVERIFY`, cannot see the owner's
    legacy programs and receives `403` from `/api/admin/overview`;
  - no admin link is rendered for an ordinary user.
- Production deployment check after pushing `46f89e5`:
  - anonymous GET `/api/programs`, `/api/topics`, `/api/tables`, `/api/functions`,
    `/api/favorites`, `/api/recents`, `/api/search` and `/api/admin/overview` return
    `401`; anonymous POST `/api/execute`, `/api/seed` and `/api/programs` also return
    `401` (the GET-only 405s are method guards, not authentication);
  - cross-origin logon is rejected with `403`, invalid credentials with `401`, and
    `/api/auth/me` remains public (`200`);
  - `/admin` and `/api/health` load (`200`); health reports 4 users and 49 programs;
  - Vercel reports both project deployments as successful;
  - the secret-safe **Provision owner** workflow ran successfully (run
    `40106253543`, rerun `40107647554`): owner `AKASH` created/updated, email stored and
    matching the `OWNER_EMAIL` secret, **12 legacy programs claimed**, 0 unclaimed, 37
    shared examples;
  - the read-only **Verify production** workflow passed after the Vercel environment was
    corrected (run `40110886829`): login `200`, `role=OWNER owner=true`,
    `/api/admin/overview` `200`, `/admin` `200`; metrics `users=4`, `programs=49`,
    `examples=37`, `private=12`, `unclaimed_legacy=0`.
  - the controlled **Verify production isolation** workflow passed (run `40110813415`):
    owner access, regular-user denial, private-program isolation, read-only examples,
    distinct private sandboxes, session revocation, suspension/reactivation and confirmed
    deletion all behaved correctly. Its unique temporary user and sandbox were deleted;
    final metrics returned to `users=4`, `programs=49`.
- The controlled production test user and its sandbox were deleted after verification;
  final production metrics returned to `users=4`, `programs=49`.
- Final local gate on 24.10.2026: `bun run lint` clean, `bun test` **19/19**,
  `bun run test:api` **52/52**, and `bun run build` completed successfully.
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
| 8 | Owner-only admin dashboard: metrics, search, suspend/reactivate, sessions, deletion, audit | **Done (deployed and live gate verified)** | `/admin` and `/api/admin/*` pass in production (`owner=true`, admin API/page `200`); controlled suspend, session revocation, reactivation and deletion checks passed. |
| 9 | Preserve and test the Standard ABAP environment | **Done (current scope)** | Screenshot fidelity preserved; automated tests execute all seeded examples. |
| 10 | Separate Modern ABAP environment + honest capability matrix | **Missing** | Needs approved executable / validated-or-simulated / unsupported scope. |
| 11 | Professional developer GUI | **Partial** | Standard SAP GUI is complete. Modern environment GUI and a formal accessibility audit are pending. |
| 12 | Data ownership and isolation | **Done (deployed and production-verified)** | Server-side ownership rules + private sandbox verified. Production legacy claim applied (12 programs, 0 unclaimed); controlled regular-user isolation, owner access, session revocation, suspension and deletion passed. |
| 13 | Security and reliability | **Done (application layer, deployed)** | Sessions, CSRF, rate limiting, per-user execution authorization and audit trail; production anonymous APIs verified closed. Shared/distributed limiter remains future hardening. |
| 14 | Continuous testing and completion verification | **Partial** | Lint clean, 19 unit tests, 52 API checks and production build pass; production owner/isolation workflows pass. UI automation, accessibility audit and final acceptance report pending. |
| 15 | Phase 0 audit | **Done** | This document. |
| 15 | Phase 1 architecture/migration design | **Partial** | Architecture and legacy ownership plan documented; Clerk migration choice pending. |
| 15 | Phases 2–8 | **In progress / blocked** | Security/admin/ownership complete in code. Clerk and Modern ABAP not started. |

### Deliverables checklist

- [x] Repository audit report — this document.
- [x] Architecture and data-flow documentation — §1.5.
- [ ] Clerk account-migration plan — blocked on owner choice.
- [ ] Clerk authentication implementation — blocked.
- [x] Owner-only administration dashboard — deployed; production owner gate and controlled isolation checks pass; browser sign-off pending.
- [x] Standard ABAP automated regression tests — 19 unit tests pass.
- [ ] Modern ABAP capability matrix and tests — pending scope approval.
- [x] Improved Standard ABAP GUI fidelity — 24.10.2026.
- [x] Security and authorization test coverage — 52 API checks pass.
- [x] Environment and deployment documentation — README, DEPLOY, `.env.example`.
- [x] Non-destructive seed/deploy path — verified locally.
- [ ] Production migration and owner provisioning — owner role/legacy claim, live owner gate and production isolation verified; legacy favorites verified empty; final browser/UI sign-off remains.
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

### 3.3 Data state

- Local database: 2 users (`AKASH` owner, `DEVELOPER`), 37 shared learning programs
  (36 examples + 1 INCLUDE) and 7 owner-claimed legacy programs.
- Production database at the final 16:18Z check: 4 users and 49 programs (37 shared
  examples + 12 owner-claimed legacy non-example). The v0.3 schema migration, owner
  provisioning and Vercel owner gate are applied and verified: `AKASH` has
  `role = OWNER`, the stored email matches `OWNER_EMAIL`, no legacy programs are
  unclaimed, and `/admin` returns `200` for the owner. The 12 legacy programs remain
  hidden from ordinary users. A controlled production isolation run created, exercised
  and deleted a temporary user; its sandbox was removed and the counts returned to
  `users=4`, `programs=49`.

---

## 4. Owner actions required

### 4.1 Clerk integration (blocking spec §7)

Full owner walkthrough: [`docs/CLERK-SETUP.md`](CLERK-SETUP.md).

1. Create a Clerk application and enable **Email OTP** and **Google**.
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` and
   `CLERK_WEBHOOK_SECRET` in Vercel. Never paste secrets into chat.
3. Choose the migration policy:
   - recommended: map verified Clerk email to the existing `User` row and retain the
     SAP username; or
   - replace the built-in logon and require re-registration.
4. Approve adding Clerk middleware and protected-route matchers so server-side route
   protection is consistent with Clerk sessions.

### 4.2 Production owner provisioning (blocking release)

The v0.3 build with the owner-email gate and secret-safe provisioning workflow is
**deployed**. The additive schema migration ran against Turso and the anonymous API is
closed: protected endpoints return `401` (including POST execute/seed), cross-origin
mutations return `403`, and `/api/health` reports 4 users and 49 programs. Old session
cookies are intentionally invalid.

**Provisioning status:** applied on 24.10.2026 by the manual
`.github/workflows/provision-owner.yml` workflow. The first run (`40106253543`) created
`AKASH`, stored the owner email, and claimed the 12 legacy programs. The confirming rerun
(`40107647554`) reported 0 unclaimed legacy programs and 37 shared examples. No production
data was exposed to chat and no secret was printed.

**Live owner gate: verified.** After the Vercel environment was corrected and redeployed,
`.github/workflows/verify-production.yml` run `40110886829` passed: owner login `200`,
`role=OWNER owner=true`, `/api/admin/overview` `200`, `/admin` `200`; metrics
`users=4 programs=49 examples=37 private=12 unclaimed_legacy=0`.

**Production isolation: verified.** `.github/workflows/verify-isolation.yml` run
`40110813415` passed all owner/regular-user checks: shared examples are read-only,
owner/private programs are hidden from regular users, each user gets a distinct private
sandbox, the owner can open user sandboxes, revoked sessions are rejected, suspended users
cannot log in, reactivation works, and confirmed deletion removes the temporary user. The
workflow deleted its unique temporary user and sandbox; final metrics returned to
`users=4 programs=49`.

**P0 owner acceptance: complete (24.10.2026).** The owner reviewed `/admin` in the
browser. The temporary `OWNER_PASSWORD` GitHub secret was deleted after acceptance; the
database owner password remains owner-held. The legacy-favorites dry-run (`40111257243`)
found the old global `Favorite` table empty, so no migration is required.

Final acceptance is still not claimed: UI/accessibility automation, the remaining
type-check debt and the P1/P2 work are open.

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

1. Complete Clerk Email OTP + Google and migrate/retire the built-in accounts per owner
   decision.
2. Re-run the full test suite and production-build verification after the Clerk cutover.
3. Implement the approved Modern ABAP environment and capability matrix.
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
bun run owner:verify         # read-only owner/legacy/email consistency check
bun run owner:favorites      # dry-run legacy favorite migration (APPLY=YES to copy)
```

## 7. Explicit non-claims

- Clerk authentication is **not** implemented.
- The Modern ABAP environment is **not** implemented.
- The v0.3 security code **is** deployed, and production owner provisioning and the live
  Vercel owner gate **are verified**: `AKASH` has `role = OWNER`, the owner email is
  stored, the 12 legacy programs are assigned, and `/admin` returns `200` for the owner.
- A controlled production isolation run passed; its temporary user and sandbox were
  deleted. Final counts are `users=4`, `programs=49` (37 examples, 12 owner/private,
  zero unclaimed legacy).
- The password previously supplied in chat was **not** reused, stored or verified, and
  must be considered exposed. The temporary GitHub `OWNER_PASSWORD` secret was deleted
  after the owner's admin review; the database password remains owner-held.
- Final acceptance is **not complete**: UI/accessibility automation and the remaining
  type-check debt are still open. The legacy-favorites dry-run found the old table empty.
  Clerk and Modern ABAP are not implemented.
- The live site is the v0.3 build, not the earlier `11d2b1c` build.
