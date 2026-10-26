# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.5 (P1 accepted; owner specification remains v0.3)
**Date:** 26.10.2026
**Owner specification:** v0.3 (restated 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Live site:** https://abap-studio.akashgupta.is-a.dev (P1 accepted; merged `main` deployed)
**Document status:** implementation audit — P0/P1 accepted; **not a final project acceptance certificate**

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
| Authentication | **Clerk Email OTP + Google**, live in production with verified-email account linking and database-authoritative roles. The legacy scrypt/HMAC path is retired (`LEGACY_AUTH_MODE=off`). |
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
- **Clerk** provides Email OTP and Google identity; the legacy scrypt/HMAC code is retired
  in production. No password is stored or logged by the live authentication path.
- **Roles are server-managed only.** Public registration always creates `USER` and
  ignores a client-supplied role. The owner gate requires both the stored `OWNER` role
  and a configured identity: `OWNER_EMAIL` is authoritative in production; the legacy
  `OWNER_USERNAME` path exists only for local/legacy code. It **fails closed** if neither
  is set.
- **Examples** are shared and read-only. **Private programs** are visible/editable only
  by their creator; the designated owner may inspect and edit every non-example program.
  **Unclaimed legacy programs** are owner-only.
- **Per-user sandbox:** each user receives a private practice program. Physical names use
  `Z_MY_PRACTICE_<USERNAME>` because `Program.name` is globally unique; the UI always
  shows `Z_MY_PRACTICE`. The owner keeps any legacy `Z_MY_PRACTICE` row.
- **Owner dashboard** provides counts, a 7-day execution/error chart, user search, all
  programs, recent activity, execution health/errors, audit log, suspend/reactivate,
  session revocation, confirmed user deletion and confirmed deletion of any non-example
  program. The UI is not trusted for authorization; every admin API independently calls
  the owner gate.
- **Account deletion** removes the user's private programs and favorites, unlinks their
  execution logs (aggregate metrics retained), and keeps audit entries immutable.
- **Seeding is non-destructive.** `run-seed`/`deploy:db` upsert shared examples and
  syllabus content without deleting users, private programs, favorites or histories.
  The old destructive “wipe + reseed” behaviour was removed.
- **Local databases are no longer committed** because they contain password hashes and
  personal programs. A fresh clone creates its schema and auto-seeds shared content.
- **Clerk identity layer (live):** a verified Clerk email maps to the existing `User` row
  (preserving SAP username, role, programs and history), while a new verified account gets
  an ordinary `USER` row. A Clerk session that cannot be mapped fails closed. Role and
  suspension are always read from the database, never from Clerk metadata. Linking
  invalidates older sessions. Production has no legacy cookie fallback.

### 1.4 Verified production cutover and remaining gaps

| Gap | Evidence | Impact / next action |
|---|---|---|
| **P1 Clerk production cutover — accepted** | Production runs the merged `main` build (`e3df40c`, code deployment `dpl_H827WkruszuKqUBCeV58DRER4LyU`). Email OTP and Google sign-in are verified for the owner; non-owner `/admin`/API isolation, private-program GET/PUT/DELETE isolation, suspend/reactivate, force-logout, deletion, owner program deletion, signed webhook delivery and audit entries all passed. `/api/health` reports Clerk configured, `legacyAuthMode: "off"`, 1 user and 50 programs. | No remaining P1 blocker. Future authentication changes must repeat the production regression checklist in `docs/CLERK-SETUP.md`. |
| **Modern ABAP environment not implemented** | No environment switch, CDS/RAP/AMDP runtime or capability matrix | Specification §10 is not started. Scope needs owner approval. |
| **Legacy production favorites: verified empty** | Dry-run run `40111257243` found the old global `Favorite` table empty. | No migration is needed. The guarded workflow is retained for future databases; no data was copied or deleted. |
| **Dormant legacy code and `AUTH_SECRET` remain** | Production health reports `hasAuthSecret: true`; the legacy path is `off` | No live session uses it. Remove the scrypt/HMAC code and `AUTH_SECRET` dependency in a later cleanup; do not re-enable fallback. |
| **Rate limits are per process** | In-memory limiter | Serverless instances do not share counters; interpreter limits remain authoritative. A shared limiter is future hardening. |
| **Type-check gate restored** | `bun run typecheck` (`tsc --noEmit`) passes; `next build` now runs TypeScript validation (the temporary `ignoreBuildErrors` bypass was removed). `examples/` is excluded from the application type-check, and Bun test types are declared. | The type-check blocker is closed. `typecheck` is part of `bun run test:all`; keep it green. Engine fixes uncovered by this work are covered by regression tests. |
| **Historical local database was committed** | Earlier commits tracked `prisma/db/app.db`, which contains scrypt hashes for local demo accounts (not the production Turso database) | The file is now untracked/ignored, but it remains in Git history. Treat any password reused from those local accounts as compromised. Rewriting public history requires owner approval. |
| **Final UI/accessibility automation pending** | The owner visually reviewed `/admin` on 24.10.2026; production owner and isolation checks pass. | Add automated UI checks and an accessibility audit before final acceptance. |

### 1.5 Architecture and data flow

```
Browser (React workbench)
  │  Clerk session (Email OTP / Google)
  ▼
proxy.ts → Clerk middleware (session protection + legacy-cookie cleanup)
  ▼
Next.js route handlers / admin page
  │  requireUser / requireOwner
  │  → Clerk auth() → DB link by clerkId or verified email
  │  → DB role/suspension check (no legacy fallback in production)
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
`ExecutionLog`, `User` (including `clerkId`), `UserFavorite`, `AdminAuditLog`. The
obsolete global `Favorite` model is no longer used.

### 1.6 Verification performed on 24–25.10.2026

**P0 verification (before the P1 Clerk code):**

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
    the P0-era metrics returned to `users=4`, `programs=49`.
- The controlled production test user and its sandbox were deleted after P0 verification;
  the P0-era metrics returned to `users=4`, `programs=49`.
- Final local gate on 24.10.2026: `bun run lint` clean, `bun test` **19/19**,
  `bun run test:api` **52/52**, and `bun run build` completed successfully.
- The test user and its sandbox were deleted after verification; the local database
  backup was removed and the database was untracked.

**P1 Clerk verification and production acceptance (24–26.10.2026):**

- Local gates: `bun run lint` clean, **26 unit tests** (69 assertions), **59 API checks**
  and `bun run build` pass. The API suite runs with `LEGACY_AUTH_MODE=full` against a
  disposable database.
- A disposable SQLite integration check exercised `syncClerkIdentity` directly: owner
  email preserved `AKASH`/`OWNER`, a new account became `USER`, mixed-case legacy email
  mapped to the existing row, repeat sign-in was idempotent, linking incremented
  `sessionVersion`, and a second Clerk account could not take over a linked row.
- Development Email OTP linked disposable `+clerk_test` users, non-owner mapping returned
  `403` for admin APIs, admin actions wrote audit entries, and client sign-out cleared the
  browser session. All disposable development users were removed.
- **Production Email OTP:** delivered to the owner; the owner row became
  `AKASH`/`OWNER`; `/api/auth/me` returned `owner: true`; `/admin` loaded.
- **Production Google OAuth:** the owner Google account completed sign-in and linked to the
  same Clerk identity as `oauth_google`; the owner session remained `AKASH`/`OWNER`.
- **Production secret fix:** the first Vercel `CLERK_SECRET_KEY` did not validate sessions
  against the live instance. The production key was pulled, validated, replaced and
  redeployed; owner sign-in then passed. No key value was printed.
- **Non-owner production isolation:** disposable users were redirected from `/admin`,
  received `403` from `/api/admin/overview`, could not see another user’s private program,
  and received `404` for direct GET/PUT/DELETE on it.
- **Suspend/reactivate:** database suspension immediately blocked `/api/auth/me` and
  `/api/programs`; reactivation and a fresh Clerk session restored access.
- **Force logout:** an independent fresh Clerk session became `revoked`; token refresh
  returned `authentication_invalid`; the suspended target stayed denied. Clerk’s free plan
  rejects native bans (`app:ban_user`), so DB suspension plus session revocation is the
  authoritative implementation.
- **Delete:** the Clerk identity and DB row were removed; owned program data was deleted
  and audit history retained. The owner confirmed the audit entries in `/admin`.
- **Owner program deletion:** a disposable private program was removed from **All
  programs**; the count returned to 50 and a `PROGRAM_DELETE` audit entry was written.
- **Webhook:** a real signed `user.created` delivery created the local row and moved
  `/api/health` from 4 to 5 users without a browser sign-in. The test identity and row were
  removed; unsigned POST returns `400 Invalid webhook signature`.
- **Owner overview:** 4 users / 50 programs and the 7-day chart were confirmed before the
  owner approved removal of the three non-owner accounts and their data. Production now
  has 1 user and 50 programs.
- **Legacy retirement:** `LEGACY_AUTH_MODE=off` and `NEXT_PUBLIC_LEGACY_AUTH_MODE=off`;
  `/api/auth/login` returns `403`, `/api/auth/register` returns `410`, and the legacy UI is
  hidden.
- **Standard ABAP fidelity:** the owner confirmed the `MER / 105` screen is unchanged
  after P1.
- **Merge/deploy:** `clerk-migration` merged into `main` as `e3df40c` and deployed as
  `dpl_H827WkruszuKqUBCeV58DRER4LyU`. `/api/health` reports Clerk configured,
  `legacyAuthMode: "off"`, Turso, 1 user and 50 programs. **P1 accepted.**

**Post-P1 quality gate (26.10.2026):**

- `bun run typecheck` passes with zero errors. `next build` now runs TypeScript
  validation; the temporary `ignoreBuildErrors` bypass was removed. `examples/` is
  excluded from the application type-check and Bun test types are declared.
- Type-checking and the new regression tests uncovered and fixed real engine defects:
  numeric `REDUCE` returned its initial value instead of accumulating; `REDUCE ... FOR ...
  IN` returned a scope entry instead of the accumulated value; elementary `VALUE i( ( … ) )`
  rows were built as empty structures; caught exception `get_text( )` was blank because the
  message was passed as a length; and `CATCH ... BEFORE UNWIND` referenced a missing cursor
  method and consumed its terminating dot.
- Current local gates: `bun run lint`, `bun run typecheck`, **30 unit tests** (77
  assertions), **59 API checks** and `bun run build` all pass. The seeded `Z_COND_REDUCE`
  example now prints `5050` and `720` for its sum and factorial.
- **Deploy:** merged to `main` as `ef19593` and deployed as
  `dpl_D4F1xdQYECvr6aRZd68LVEUU5PRV`; the custom domain alias points to that deployment.
  Production smoke checks pass: `/`, `/sign-in` and `/sign-up` return `200`; anonymous
  `/api/auth/me` returns `{"user":null}`; `/api/admin/overview` and `/api/programs` return
  `401`; legacy login returns `403`; registration returns `410`; an unsigned Clerk webhook
  returns `400`; `/api/health` reports Turso, Clerk configured,
  `legacyAuthMode: "off"`, 1 user and 50 programs.

---

## 2. Requirement-by-requirement status

Status legend: **Done** = implemented and verified; **Partial** = verified subset;
**Missing** = not implemented; **Blocked** = needs an owner action or decision.

| Owner spec § | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 6 | Owner questions and decisions | Ongoing | P0/P1 decisions are complete. Remaining decisions: Modern ABAP scope and whether to authorize the final cleanup of dormant legacy auth code. |
| 7 | Clerk: email OTP, Google, protected routes, provisioning, webhooks, migration | **Done (production-verified and accepted)** | Clerk Email OTP + Google, verified-email linking, owner gate, admin actions, signed webhook, legacy retirement and session revocation are live on `main`. Owner sign-in, Google linking, non-owner isolation, suspend/reactivate/force-logout/delete, owner program deletion, webhook delivery and audit entries passed in production. `/api/auth/login` returns `403`, registration `410`, and `/api/health` reports `legacyAuthMode: "off"`. P1 accepted on 26.10.2026. |
| 8 | Owner-only admin dashboard: metrics, search, suspend/reactivate, sessions, deletion, audit | **Done (deployed and production-verified)** | `/admin` and `/api/admin/*` pass in production (`owner=true`, admin API/page `200`); controlled suspend, session revocation, reactivation, user deletion and non-example program deletion checks passed; audit entries confirmed. |
| 9 | Preserve and test the Standard ABAP environment | **Done (current scope)** | Screenshot fidelity preserved; automated tests execute all seeded examples. |
| 10 | Separate Modern ABAP environment + honest capability matrix | **Missing** | Needs approved executable / validated-or-simulated / unsupported scope. |
| 11 | Professional developer GUI | **Partial** | Standard SAP GUI is complete. Modern environment GUI and a formal accessibility audit are pending. |
| 12 | Data ownership and isolation | **Done (deployed and production-verified)** | Server-side ownership rules and private sandboxes verified. Disposable production users could not see or mutate another user’s private program; owner access, session revocation, suspension and deletion passed. Production currently has one owner and 50 programs. |
| 13 | Security and reliability | **Done (application layer, deployed)** | Sessions, CSRF, rate limiting, per-user execution authorization and audit trail; production anonymous APIs verified closed. Shared/distributed limiter remains future hardening. |
| 14 | Continuous testing and completion verification | **Partial** | Lint, **type-check**, **30 unit tests**, **59 API checks** and production build pass; P0 and P1 production acceptance checks pass. Formal UI automation, accessibility audit and the final project acceptance report remain. |
| 15 | Phase 0 audit | **Done** | This document. |
| 15 | Phase 1 architecture/migration design | **Done** | Owner approved verified-email mapping and phased cutover; the code and owner guide implement it. |
| 15 | Phases 2–8 | **In progress** | P0 security/admin/ownership and P1 Clerk cutover are deployed and accepted. Modern ABAP remains paused pending owner scope approval; final project acceptance still requires the remaining quality work. |

### Deliverables checklist

- [x] Repository audit report — this document.
- [x] Architecture and data-flow documentation — §1.5.
- [x] Clerk account-migration plan — owner approved verified-email mapping; the cutover is complete and the legacy path is retired.
- [x] Clerk authentication implementation — Email OTP + Google, verified-email linking, owner gate and signed webhook live on `main`.
- [x] Owner-only administration dashboard — deployed; production owner gate, isolation checks, user/program deletion and owner browser sign-off pass.
- [x] Standard ABAP automated regression tests — 30 unit tests pass (including Clerk mapping, REDUCE, exception text and CATCH BEFORE UNWIND regressions).
- [ ] Modern ABAP capability matrix and tests — pending scope approval.
- [x] Improved Standard ABAP GUI fidelity — 24.10.2026; rechecked after P1.
- [x] Security and authorization test coverage — **59 API checks** pass.
- [x] Environment and deployment documentation — README, DEPLOY, `.env.example`.
- [x] Non-destructive seed/deploy path — verified locally.
- [x] P0 production migration and owner provisioning — owner role/legacy claim, live owner gate, controlled isolation and owner `/admin` sign-off verified; legacy favorites verified empty.
- [x] P1 production migration — Clerk Email OTP + Google, domain/keys/webhook, owner and non-owner verification, admin actions, legacy retirement and signed webhook all pass.
- [ ] Final acceptance-test report — pending UI automation, accessibility review and the approved Modern ABAP/P2 scope.

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
- Production database at the P0 final 16:18Z check: 4 users and 49 programs (37 shared
  examples + 12 owner-claimed legacy non-example). The v0.3 schema migration, owner
  provisioning and Vercel owner gate are applied and verified: `AKASH` has
  `role = OWNER`, the stored email matches `OWNER_EMAIL`, no legacy programs are
  unclaimed, and `/admin` returns `200` for the owner. The 12 legacy programs remain
  hidden from ordinary users. A controlled production isolation run created, exercised
  and deleted a temporary user; its sandbox was removed and the P0-era counts returned to
  `users=4`, `programs=49`. P1 later removed the non-owner accounts; current production is
  **1 user / 50 programs**.

### 3.4 P1 Clerk implementation (production; accepted)

- Added `@clerk/nextjs`, `ClerkProvider` in the root layout, SAP-styled `/sign-in` and
  `/sign-up` pages, and `proxy.ts` Clerk middleware with server-side admin checks.
- Added `User.clerkId` plus an additive `ensureSchema()` column/index migration that is
  safe for existing SQLite and Turso data.
- `src/lib/session.ts` resolves Clerk first. A Clerk session that cannot be mapped or is
  suspended fails closed; production has no legacy identity fallback.
- `src/lib/clerk-user.ts` links by verified email (case-insensitive, ambiguous matches
  fail closed), preserves the existing SAP username/role/programs/history, creates new
  accounts as `USER`, and invalidates older sessions when linking.
- The owner gate still requires database `role = OWNER` plus matching `OWNER_EMAIL`;
  Clerk metadata never grants administration.
- `src/lib/auth-mode.ts` implements `off` / `fallback` / `full` cutover modes. Production
  is `off`; `full` is used only by the disposable local/API suite. A missing Clerk key
  cannot silently reopen password registration.
- Added signed `POST /api/webhooks/clerk` handling for `user.created`, `user.updated` and
  `user.deleted`, including Clerk’s snake_case JSON shape and idempotent sync.
- Admin suspend/reactivate/force-logout/delete update the Clerk identity where linked.
  Clerk’s free plan rejects native bans (`app:ban_user`), so suspension is the
  database-authoritative flag plus Clerk session revocation.
- Logging out revokes the Clerk session and refuses to claim success if revocation fails.
- Added `ClerkSessionNotice` for an active-but-unmapped Clerk session and
  `scripts/set-user-email.ts` (`bun run user:email`) for the historical verified-email
  mapping path.
- The middleware deletes the legacy cookie whenever a Clerk session exists.

**Production verified (26.10.2026):** owner Email OTP and Google, non-owner isolation,
private-program isolation, suspend/reactivate, force logout, user/program deletion,
signed webhook delivery, audit entries, legacy retirement and Standard ABAP fidelity all
passed. P1 was merged as `e3df40c` and accepted. The detailed evidence is in
[`docs/CLERK-SETUP.md`](CLERK-SETUP.md).

---

## 4. Owner actions required

### 4.1 Clerk integration (P1; accepted 26.10.2026)

**No P1 owner action remains.** Production runs the merged `main` build at
`https://abap-studio.akashgupta.is-a.dev` with Clerk Email OTP + Google only. The selected
application `app_3Ks7MMboysX2gIBJhfURlf16Pwq` and production instance
`ins_3LAf6uu766aoTCwlI8nX5faMFQA` are bound to the verified domain. Production
`CLERK_SECRET_KEY` was corrected after the initial value failed server-side validation;
Google OAuth is configured and was completed by the owner; the signed webhook delivered a
real `user.created` event; and the legacy password path is retired (`off`). All non-owner
production accounts were removed with owner approval, leaving one owner and 50 programs.

The full setup, evidence and regression checklist are in
[`docs/CLERK-SETUP.md`](CLERK-SETUP.md). Google-specific history is in
[`docs/GOOGLE-OAUTH-SETUP.md`](GOOGLE-OAUTH-SETUP.md); domain/DNS history is in
[`docs/FREE-DOMAIN-SETUP.md`](FREE-DOMAIN-SETUP.md).

Optional later cleanup: remove the dormant scrypt/HMAC code and the `AUTH_SECRET`
dependency, and drop the unused EU.org alternative. Do not re-enable `fallback` without a
new owner decision and migration plan.

### 4.2 P0 production owner provisioning (accepted)

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
`users=4 programs=49 examples=37 private=12 unclaimed_legacy=0` at P0 acceptance.

**Production isolation: verified.** `.github/workflows/verify-isolation.yml` run
`40110813415` passed all owner/regular-user checks: shared examples are read-only,
owner/private programs are hidden from regular users, each user gets a distinct private
sandbox, the owner can open user sandboxes, revoked sessions are rejected, suspended users
cannot log in, reactivation works, and confirmed deletion removes the temporary user. The
workflow deleted its unique temporary user and sandbox; P0-era metrics returned to
`users=4 programs=49`. Current P1 production is `1 user / 50 programs`.

**P0 owner acceptance: complete (24.10.2026).** The owner reviewed `/admin` in the
browser. The temporary `OWNER_PASSWORD` GitHub secret was deleted after acceptance; the
database owner password remains owner-held. The legacy-favorites dry-run (`40111257243`)
found the old global `Favorite` table empty, so no migration is required.

P1 is now accepted. The type-check debt is closed and `next build` enforces TypeScript
again. Final project acceptance is still not claimed: UI/accessibility automation, final
cleanup of dormant legacy code and the unapproved Modern ABAP/P2 scope remain open.

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

1. Remove the dormant scrypt/HMAC code and the `AUTH_SECRET` dependency after a final
   regression run; keep `LEGACY_AUTH_MODE=off`.
2. Obtain owner approval for the Modern ABAP/P2 scope, then implement the honest
   capability matrix.
3. Add UI-level automated acceptance tests and a formal accessibility review.
4. Replace in-memory rate limiting with a shared limiter if the hosting tier requires it.
5. Publish the final project acceptance report — only after the remaining quality work
   and approved phases pass.

## 6. Commands

```bash
bun install
bun run db:push              # create/update the local schema
bun run dev                  # http://localhost:3000 (auto-seeds shared content)
bun run lint
bun run typecheck            # tsc --noEmit
bun test tests               # 30 unit tests
bun run test:api             # disposable end-to-end API suite (59 checks, port 3100)
bun run test:all             # lint + typecheck + unit + API
bun run build
bun run seed                 # non-destructive local content upsert + engine check
bun run deploy:db            # remote schema/content upsert (requires TURSO_*)
bun run owner:provision      # assign owner + claim legacy programs
bun run owner:password       # hidden-input password reset
bun run owner:verify         # read-only owner/legacy/email consistency check
bun run user:email           # owner-verified legacy account → verified email mapping
bun run owner:favorites      # dry-run legacy favorite migration (APPLY=YES to copy)
```

## 7. Explicit non-claims

- Clerk Email OTP + Google is **live and P1 is accepted**. Production owner sign-in,
  Google linking, non-owner isolation, suspend/reactivate/force-logout, user/program
  deletion, signed webhook delivery, audit entries and legacy retirement were verified.
  Production has 1 owner and 50 programs; `/api/health` reports `legacyAuthMode: "off"`.
- The Modern ABAP environment is **not** implemented.
- P0 remains deployed and accepted: production owner provisioning, the server-side owner
  gate, ownership isolation and the admin dashboard are verified.
- The password previously supplied in chat was **not** reused, stored or verified, and
  must be considered exposed. The temporary GitHub `OWNER_PASSWORD` secret was deleted
  after the owner's admin review.
- Final project acceptance is **not complete**: UI/accessibility automation, dormant
  legacy-code cleanup, Modern ABAP/P2 scope and the final acceptance report remain open.
  The type-check gate is green and enforced by `next build`. The legacy-favorites dry-run
  found the old table empty.
- The live site is the merged `main` P1 build, not the earlier `11d2b1c` build.
