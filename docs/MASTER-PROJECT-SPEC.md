# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.4 (P1 implementation status; owner specification remains v0.3)
**Date:** 24.10.2026
**Owner specification:** v0.3 (restated 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Live site:** https://abap-studio-rd9d.vercel.app (P0 v0.3 security deployed; P1 Clerk code is **not** deployed)
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
| Authentication | **P1 Clerk code** (Email OTP + Google) with verified-email account linking and database-authoritative roles; production Clerk is **not configured**. Legacy scrypt/HMAC fallback remains during cutover. |
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
- **P1 Clerk identity layer (branch code, not production):** Clerk is tried before the
  legacy cookie; a verified Clerk email maps to the existing `User` row (preserving SAP
  username, role, programs and history), while a new verified account gets an ordinary
  `USER` row. A Clerk session that cannot be mapped fails closed. Role and suspension are
  always read from the database, never from Clerk metadata. The legacy cookie is cleared
  as soon as a Clerk session exists, and linking invalidates old legacy sessions.

### 1.4 Verified gaps and blockers (must not be marked complete)

| Gap | Evidence | Impact / next action |
|---|---|---|
| **Clerk production cutover not complete** | P1 code is implemented on `clerk-migration`; local lint/26 unit/52 API/build gates pass. The selected “ABAP Studio” app has Email OTP + Google enabled and password/phone/username/Facebook/GitHub disabled. Email OTP, owner/non-owner mapping, admin ban/unban/revoke/delete, audit and client sign-out were verified with disposable development test users on a throwaway database. `clerk deploy status` reports `not_started`; there is no production instance/domain, production keys are not in Vercel, `CLERK_WEBHOOK_SECRET` is absent, and Google OAuth, webhook delivery and a production Clerk session remain unexercised. | Owner must run the interactive `clerk deploy` with a DNS-controlled domain, set production keys and webhook secret, map the non-owner accounts, and complete the browser checks in `docs/CLERK-SETUP.md`. P1 is **not accepted**. |
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
  │  Clerk session (primary)  +  temporary legacy HMAC cookie
  ▼
proxy.ts → Clerk middleware (session + legacy-cookie hygiene)
  ▼
Next.js route handlers / admin page
  │  requireUser / requireOwner
  │  → Clerk auth() first → DB link by clerkId or verified email
  │  → DB role/suspension check; legacy fallback only while the cutover allows
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
    final metrics returned to `users=4`, `programs=49`.
- The controlled production test user and its sandbox were deleted after verification;
  final production metrics returned to `users=4`, `programs=49`.
- Final local gate on 24.10.2026: `bun run lint` clean, `bun test` **19/19**,
  `bun run test:api` **52/52**, and `bun run build` completed successfully.
- The test user and its sandbox were deleted after verification; the local database
  backup was removed and the database was untracked.

**P1 Clerk local verification (24–25.10.2026; production not verified):**

- `bun run lint` — passed.
- `bun test tests` — **26 tests passed** (69 assertions), including verified-email
  selection, webhook snake_case normalization, username generation and legacy access.
- `bash tests/run-api-tests.sh` — **52 API checks passed** against a disposable
  database/server.
- `bun run build` — passed.
- A disposable SQLite integration check exercised `syncClerkIdentity` directly:
  owner email → preserved `AKASH`/`OWNER`, new account → `USER`, mixed-case legacy email →
  existing row, repeat sign-in idempotent, linking increments `sessionVersion`, and a
  second Clerk account cannot take over an already linked row.
- The first `user:email` mapping was applied to the disposable database, audited as
  `USER_EMAIL_MAP`, normalized the address, and rejected a collision with another user.
- Real Email OTP sign-in was exercised in the development instance with disposable
  `+clerk_test` users. The verified test email linked to the existing `AKASH` row;
  `/api/auth/me` returned `owner=true`, `role=OWNER`, and `/api/admin/overview` plus
  `/admin` returned `200`.
- A second disposable test user was created as `USER`; `/api/admin/overview` returned
  `403` and `/admin` redirected to `/`.
- Admin suspend set Clerk `banned=true` and database `suspended=true`; the banned test
  user received “You have been banned” after OTP verification and no session was created.
  Reactivate cleared both states. Force-logout bumped `sessionVersion` and revoked linked
  Clerk sessions. Admin delete removed the Clerk user and database row after typed-name
  confirmation. Audit entries `USER_SUSPEND`, `USER_REACTIVATE`, `USER_SESSION_REVOKE`
  and `USER_DELETE` were written.
- Server logout previously left a valid Clerk browser JWT until expiry, so `/` could still
  render the old user. Logoff now calls Clerk client `signOut()` after server revocation;
  repeat verification returned `/api/auth/me` with `user=null` and the SAP logon pad.
- The development Clerk config was corrected to **Email OTP + Google only**: password,
  phone and username fields/strategies are disabled. `/sign-in` and `/sign-up` render no
  password, phone or username field.
- All disposable Clerk test users and the throwaway database were deleted after testing.
- Clerk config still reports Google enabled/authenticatable, but a real Google sign-in has
  not been exercised. Webhook delivery, production Clerk instance/domain/keys and a
  production Clerk session remain unverified. `clerk deploy status` remains `not_started`.

---

## 2. Requirement-by-requirement status

Status legend: **Done** = implemented and verified; **Partial** = verified subset;
**Missing** = not implemented; **Blocked** = needs an owner action or decision.

| Owner spec § | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 6 | Owner questions and decisions | Ongoing | Clerk production domain/keys, Modern ABAP scope, production timing and legacy-favorite policy are listed in §4. |
| 7 | Clerk: email OTP, Google, protected routes, provisioning, webhooks, migration | **Partial (development verified; production blocked)** | Clerk pages, provider, session resolution, verified-email linking, owner gate integration, admin ban/unban/revoke/delete, signed webhook and legacy cutover modes are implemented on `clerk-migration`. Local lint/26 unit/52 API/build gates pass. Development Email OTP, owner/non-owner mapping, admin actions, audit and client sign-out were verified with disposable test users, then removed. Google OAuth, webhook delivery, production instance/domain/keys and production interactive sign-in are still missing; legacy fallback remains active. **P1 not accepted.** |
| 8 | Owner-only admin dashboard: metrics, search, suspend/reactivate, sessions, deletion, audit | **Done (deployed and live gate verified)** | `/admin` and `/api/admin/*` pass in production (`owner=true`, admin API/page `200`); controlled suspend, session revocation, reactivation and deletion checks passed. |
| 9 | Preserve and test the Standard ABAP environment | **Done (current scope)** | Screenshot fidelity preserved; automated tests execute all seeded examples. |
| 10 | Separate Modern ABAP environment + honest capability matrix | **Missing** | Needs approved executable / validated-or-simulated / unsupported scope. |
| 11 | Professional developer GUI | **Partial** | Standard SAP GUI is complete. Modern environment GUI and a formal accessibility audit are pending. |
| 12 | Data ownership and isolation | **Done (deployed and production-verified)** | Server-side ownership rules + private sandbox verified. Production legacy claim applied (12 programs, 0 unclaimed); controlled regular-user isolation, owner access, session revocation, suspension and deletion passed. |
| 13 | Security and reliability | **Done (application layer, deployed)** | Sessions, CSRF, rate limiting, per-user execution authorization and audit trail; production anonymous APIs verified closed. Shared/distributed limiter remains future hardening. |
| 14 | Continuous testing and completion verification | **Partial** | Lint clean, 26 unit tests, 52 API checks and production build pass; P0 production owner/isolation workflows pass. P1 Email OTP and admin interactions are development-verified; production Clerk, Google, webhook, UI automation, accessibility audit and final acceptance report pending. |
| 15 | Phase 0 audit | **Done** | This document. |
| 15 | Phase 1 architecture/migration design | **Done** | Owner approved verified-email mapping and phased cutover; the code and owner guide implement it. |
| 15 | Phases 2–8 | **In progress / blocked** | P0 security/admin/ownership is deployed and accepted. P1 Clerk code is complete locally but production cutover is blocked on the Clerk domain/production instance. Modern ABAP has not started. |

### Deliverables checklist

- [x] Repository audit report — this document.
- [x] Architecture and data-flow documentation — §1.5.
- [x] Clerk account-migration plan — owner approved verified-email mapping; `user:email` and legacy fallback documented.
- [ ] Clerk authentication implementation — code complete on `clerk-migration`; production cutover and interactive verification pending.
- [x] Owner-only administration dashboard — deployed; production owner gate, controlled isolation checks and owner browser sign-off pass.
- [x] Standard ABAP automated regression tests — 26 unit tests pass (including Clerk mapping).
- [ ] Modern ABAP capability matrix and tests — pending scope approval.
- [x] Improved Standard ABAP GUI fidelity — 24.10.2026.
- [x] Security and authorization test coverage — 52 API checks pass.
- [x] Environment and deployment documentation — README, DEPLOY, `.env.example`.
- [x] Non-destructive seed/deploy path — verified locally.
- [x] P0 production migration and owner provisioning — owner role/legacy claim, live owner gate, controlled isolation and owner `/admin` sign-off verified; legacy favorites verified empty.
- [ ] P1 production migration — production Clerk instance/domain/keys/webhook, account mapping and interactive verification pending.
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

### 3.4 P1 Clerk implementation (branch; production cutover pending)

- Added `@clerk/nextjs`, `ClerkProvider` in the root layout, SAP-styled `/sign-in` and
  `/sign-up` pages, and `proxy.ts` Clerk middleware with server-side admin checks.
- Added `User.clerkId` plus an additive `ensureSchema()` column/index migration that is
  safe for existing SQLite and Turso data.
- `src/lib/session.ts` resolves Clerk first, then the legacy signed cookie only while
  `LEGACY_AUTH_MODE` allows it. A Clerk session that cannot be mapped or is suspended
  fails closed and never falls through to the legacy identity.
- `src/lib/clerk-user.ts` links by verified email (case-insensitive, ambiguous matches
  fail closed), preserves the existing SAP username/role/programs/history, creates new
  accounts as `USER`, and invalidates old legacy sessions when linking.
- The owner gate still requires database `role = OWNER` plus matching `OWNER_EMAIL`;
  Clerk metadata never grants administration.
- `src/lib/auth-mode.ts` implements `off` / `fallback` / `full` cutover modes. Production
  defaults to `fallback` even if Clerk keys are missing, so public password registration
  cannot silently reopen.
- Added signed `POST /api/webhooks/clerk` handling for `user.created`, `user.updated` and
  `user.deleted`, including Clerk’s snake_case JSON shape and idempotent sync.
- Admin suspend/reactivate/force-logout/delete now also bans/unbans/revokes/deletes the
  Clerk identity where linked. Clerk 404s do not block database cleanup.
- Logging out revokes the Clerk session, clears/bumps the legacy session, and refuses to
  claim success if Clerk revocation fails.
- Added `ClerkSessionNotice` for an active-but-unmapped Clerk session and `scripts/set-user-email.ts`
  (`bun run user:email`) for owner-verified legacy-account mapping.
- The middleware deletes the legacy cookie whenever a Clerk session exists, preventing an
  older legacy session from resurfacing after a Clerk sign-out.

**Verified in development:** Email OTP sign-in, owner mapping to `AKASH`, non-owner
isolation, admin ban/unban/revoke/delete and audit, and client-side sign-out using
disposable test users and a throwaway database (all test users removed).

**Not yet verified:** Google OAuth, webhook delivery, production Clerk
instance/domain/keys, production account mapping/isolation, and immediate revocation of a
second active browser session.

---

## 4. Owner actions required

### 4.1 Clerk integration (P1; production cutover blocking)

Full owner walkthrough: [`docs/CLERK-SETUP.md`](CLERK-SETUP.md).

The owner selected the **ABAP Studio** Clerk application
(`app_3Ks7MMboysX2gIBJhfURlf16Pwq`) and approved verified-email mapping with a phased
cutover. The development instance has Email OTP and Google enabled; password, phone,
username, Facebook and GitHub are disabled. P1 code is on `clerk-migration` and passes
the local gates, but none of the following production steps is complete:

1. **Production domain + Clerk instance.** Production Clerk requires a domain whose DNS
   records the owner controls; the current `*.vercel.app` address is not sufficient.
   Run `npx clerk@latest deploy` in a normal interactive terminal, add the displayed DNS
   records, configure production Google OAuth credentials, and resume until
   `clerk deploy status` reports the production instance/domain ready. This step cannot be
   completed by the agent because it needs a human terminal and DNS access.
2. **Vercel production environment.** Add the production
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`,
   `OWNER_EMAIL`, and the existing `AUTH_SECRET`; set `LEGACY_AUTH_MODE=fallback` and
   `NEXT_PUBLIC_LEGACY_AUTH_MODE=fallback` for the first cutover. Never use development
   keys in production.
3. **Webhook.** Create `https://<production-domain>/api/webhooks/clerk` for
   `user.created`, `user.updated` and `user.deleted`, then copy the signing secret into
   Vercel and redeploy. Until then `/api/webhooks/clerk` returns `503`.
4. **Account mapping.** The owner row already matches `OWNER_EMAIL`. For each non-owner
   account without a verified email on file, attach the owner-verified address with
   `bun run user:email` (see the guide). Do not import scrypt hashes or send passwords.
   Unmapped accounts remain on legacy fallback.
5. **Interactive verification.** Complete Email OTP and Google sign-in against production;
   verify owner `/admin`, a mapped non-owner, a new `USER`, suspension/ban, force logout,
   deletion and webhook sync. Email OTP, owner/non-owner mapping, admin actions and client
   sign-out were exercised in development with disposable test users, but Google,
   webhook delivery, production accounts and an active second-browser force logout remain
   untested.
6. **Retire the fallback.** After every account is mapped and production passes, set
   `LEGACY_AUTH_MODE=off` and `NEXT_PUBLIC_LEGACY_AUTH_MODE=off`; remove the scrypt/HMAC
   code and `AUTH_SECRET` dependency in a later cleanup.

P1 is **not accepted** until steps 1–5 pass against production.

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

1. Complete the P1 Clerk production cutover: interactive `clerk deploy` on a
   DNS-controlled domain, production keys, webhook, account mapping and signed-in
   verification.
2. Re-run the full test suite and production-build verification after the Clerk cutover;
   then set `LEGACY_AUTH_MODE=off` and remove the fallback code.
3. Implement the approved Modern ABAP environment and capability matrix.
4. Add UI-level automated acceptance tests and a formal accessibility review.
5. Replace in-memory rate limiting with a shared limiter if the hosting tier requires it.
6. Publish the final acceptance report — only after every production check passes.

## 6. Commands

```bash
bun install
bun run db:push              # create/update the local schema
bun run dev                  # http://localhost:3000 (auto-seeds shared content)
bun run lint
bun test tests               # 26 unit tests
bun run test:api             # disposable end-to-end API suite (port 3100)
bun run test:all             # lint + unit + API
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

- Clerk authentication **code is implemented** on `clerk-migration`; development Email
  OTP, owner/non-owner mapping, admin ban/unban/revoke/delete, audit and client sign-out
  were verified with disposable test users. Production Clerk is **not configured**, and
  Google OAuth, webhook delivery and P1 production isolation remain unverified. P1 is
  **not accepted**.
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
- Final acceptance is **not complete**: P1 production Clerk verification, UI/accessibility
  automation and the remaining type-check debt are still open. The legacy-favorites
  dry-run found the old table empty. Modern ABAP is not implemented.
- The live site is the v0.3 build, not the earlier `11d2b1c` build.
