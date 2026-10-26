# ABAP-Studio — Master Project Specification & Audit

**Version:** 0.6 (technical acceptance complete; owner sign-off pending)
**Date:** 26.10.2026
**Owner specification:** v0.3 (restated 24.10.2026)
**Repository:** https://github.com/akashgupta221/ABAP-Studio
**Live site:** https://abap-studio.akashgupta.is-a.dev
**Document status:** implementation audit; final acceptance certificate pending owner sign-off

This document records verified implementation facts, explicit boundaries and the remaining
acceptance gates. Historical Task IDs and deployment evidence are kept in
[`worklog.md`](../worklog.md) and [`CLERK-SETUP.md`](CLERK-SETUP.md).

---

## 1. Status summary

| Area | Status |
|---|---|
| P0 — security, ownership, admin, audit | **Complete and accepted** |
| P1 — Clerk Email OTP + Google, migration, webhook, legacy retirement | **Complete and accepted** |
| Legacy password authentication removal | **Complete** — code and UI deleted; permanent endpoint stubs |
| P2 — approved Modern ABAP environment | **Implemented, deployed and production-verified**; owner visual acceptance pending |
| UI/accessibility automation | **Complete** — 12 Playwright tests with axe serious/critical threshold |
| Documentation/worklog/CI | **Updated for the final release** |
| Final acceptance report | **Published** with technical evidence; owner visual sign-off pending |

This release is deployed at commit `37b10fe` as `dpl_7vnuYjYkAZhK4bWi6VL4yTEpLDNX` and
passed the public production smoke. Live user/program counts are reported by
`/api/health`; do not treat an illustrative count in documentation as an acceptance
invariant.

## 2. Verified stack and architecture

| Area | Implementation |
|---|---|
| Framework | Next.js 16 App Router + React 19 + TypeScript 5 |
| UI | Tailwind CSS 4, Radix UI, Lucide; SAP GUI-inspired Standard shell |
| Database | Prisma 6 + libSQL adapter; SQLite locally, Turso in production |
| ABAP runtime | Custom tokenizer → parser → tree-walking interpreter in `src/lib/abap/` |
| Authentication | Clerk Email OTP + Google, verified-email linking, DB-authoritative authorization |
| Authorization | Server-side `OWNER`/`USER`, per-program ownership, per-user favorites/sandbox |
| Deployment | Vercel Hobby + Turso free; additive schema migration; non-destructive seeding |

```
Browser (React Standard / Modern workbench)
  │  Clerk session (Email OTP / Google)
  ▼
proxy.ts → Clerk middleware (admin page protection; test-broker bypass only outside cloud)
  ▼
Route handler
  │  requireUser / requireOwner
  │  → Clerk auth() → DB link by clerkId or verified email
  │  → DB role / suspension check (production email owner gate fails closed)
  │  → same-origin CSRF on mutations → rate limit
  ▼
access.ts (example / private / owner rules)
  ▼
Prisma → Turso/libSQL or local SQLite
  │
  └─ /api/execute → tokenizer → parser → interpreter
```

Prisma models: `Topic`, `Program`, `DbTable`, `DbRow`, `FunctionModule`,
`ExecutionLog`, `User`, `UserFavorite`, `AdminAuditLog`. `Program` now also has additive
`environment` (`STANDARD`/`MODERN`) and `modernKind` (`ABAP`/`CDS`/`RAP`/`AMDP`).

## 3. Standard ABAP environment — preserved

The Standard environment remains faithful to the owner-supplied SAP system `MER`, client
`105`:

- SAP Easy Access tree, favorites, recently used, SAP Menu and ABAP Training.
- Logon pad/system identity, menu bar, standard toolbar, command field, tab strip, status
  bar.
- SE38 initial screen, create/display/change, F4 program list, attributes, editor, syntax
  check and execution.
- SE80 search, SE11 dictionary, SE16 data browser, SE24 class builder, SE37 function
  builder, syllabus, search and favorites.
- Interpreter support for classical ABAP, internal tables, selection screens, Open SQL,
  function modules, classes, ALV and string/date built-ins.
- Interpreter statement/wall-clock limits protect against endless loops.
- The Modern workspace is a separate view. It does not replace or restyle the Standard
  screenshot-fidelity screens.
- List output now resets to column 1 on every `WRITE /` line. A regression test covers
  the previous column drift, which affected Standard and Modern list pages; the fix
  restores correct SAP-style output alignment.

The 36 Standard examples and one shared INCLUDE are executed/parsed by the seed verifier;
unit tests also execute every seed example and additional regression programs.

## 4. Modern ABAP environment — approved scope

Open from **ABAP Training → Modern ABAP Workspace**, command `MODERN`, or the Modern
workspace's Standard-return button. The UI always shows the capability level; it never
implies a real SAP runtime.

| Capability | Level | Implementation |
|---|---|---|
| ABAP 7.40 inline declarations, string templates, `VALUE`, `FOR`, `REDUCE`, `COND`, `SWITCH` | **Executable** | Local interpreter; verified with `Z_MD_CONSTRUCTORS` and unit regressions |
| CDS view entity definitions | **Validated** | Structural DDL simulator; no SQL execution |
| RAP behavior definitions | **Validated** | Structural header/body/relationship checks; no RAP/OData runtime |
| AMDP class signatures + SQLScript bodies | **Simulated** | Signature and SQLScript structure checks; body not executed |
| Real HANA pushdown, RAP runtime, AMDP execution, dynpro | **Unsupported** | Explicitly labelled; Execute disabled for non-ABAP artefacts |

Verified Modern seed objects:

| Object | Kind | Verification |
|---|---|---|
| `Z_MD_CONSTRUCTORS` | ABAP | Executes; prints constructor/REDUCE/FOR-WHERE/table-expression results |
| `ZI_MD_FLIGHT` | CDS | `VALID` structural validation |
| `Z_MD_RAP_BEHAVIOR` | RAP | `VALID` structural validation |
| `ZCL_MD_AMDP` | AMDP | `VALID` simulated validation |

The workspace supports:

- shared Modern examples (read-only);
- private user-created ABAP/CDS/RAP/AMDP objects with starter templates;
- server-side `POST /api/modern/validate` validation;
- ABAP execution through `/api/execute` (with execution logging);
- save/delete for editable private objects, owner override for non-examples, and example
  protection;
- `GET/POST /api/modern` and `GET/PUT/DELETE /api/modern/[id]`;
- capability matrix and explicit unsupported-boundary text.

The engine regression `FOR ... WHERE ( iterator-field = ... )` was fixed: the loop
iterator is now in scope during the `WHERE` predicate, matching ABAP semantics.

## 5. Authentication, authorization and administration

- **Clerk is the only identity provider.** Email OTP and Google are enabled; password,
  phone and username sign-in are disabled.
- **Verified-email linking** maps a Clerk identity to an existing database row without
  losing the SAP username, role, private programs or history. Ambiguous/unverified
  mappings fail closed.
- **The database is authoritative** for role, suspension and ownership. Clerk metadata is
  never used for authorization.
- **Owner gate:** DB `role = OWNER` plus matching `OWNER_EMAIL` in production. If
  `OWNER_EMAIL` is missing or mismatched, owner access fails closed. The
  `OWNER_USERNAME` fallback is non-production local/unit-test only and is rejected on
  Vercel or `NODE_ENV=production`.
- **Sessions:** server-side validation plus `sessionVersion`; logout, suspension,
  privilege changes and administrative revocation invalidate replay.
- **CSRF:** authenticated mutations reject mismatched/malformed Origin.
- **Rate limits:** per-process (best effort); interpreter limits remain authoritative.
  Shared/distributed limiting is future hardening.
- **Examples:** shared, read-only.
- **Private programs/Modern objects:** creator-only. Direct GET/PUT/DELETE by another
  ordinary user returns `404`.
- **Owner:** can inspect all non-example programs, delete them after exact-name
  confirmation, suspend/reactivate, revoke sessions and delete users. Deletion detaches
  execution logs, retains aggregate/audit history and never deletes examples.
- **Audit:** immutable owner actions include user/program deletion, suspension,
  reactivation, session revocation and owner assignment.
- **Clerk free plan:** native bans are unavailable; suspension is DB-authoritative plus
  Clerk session revocation.

Production P1 evidence: owner Email OTP and Google sign-in, non-owner isolation, direct
private-object denial, suspend/reactivate, force logout, user/program deletion, signed
webhook delivery and audit entries. See [`CLERK-SETUP.md`](CLERK-SETUP.md).

## 6. Legacy authentication removal

The retirement is permanent and cannot be re-enabled by an environment variable:

- `src/lib/auth.ts`, `src/lib/auth-mode.ts` and `scripts/set-owner-password.ts` deleted.
- Legacy logon UI and flags removed.
- `POST /api/auth/login` returns `403` with a retirement message.
- `POST /api/auth/register` returns `410` with a retirement message.
- `provision-owner.ts` never creates or stores a password.
- The old shared password variables are no longer read.

Automated tests use `src/lib/test-auth.ts` instead. The broker:

- requires `E2E_TEST_MODE=1` and `E2E_TEST_SECRET` ≥ 16 characters;
- refuses `VERCEL` and `TURSO_DATABASE_URL` environments;
- signs short-lived, version-stamped test cookies;
- is unavailable to production/browser users without the test secret.

## 7. UI and accessibility automation

Playwright + `@axe-core/playwright` cover:

- public logon and secure Clerk sign-in/sign-up pages;
- keyboard navigation to secure logon;
- mobile overflow at 390 px;
- owner workbench, SE38 execution and admin dashboard;
- Modern ABAP overview, execution, CDS validation, private create/save/execute/delete and
  mobile layout;
- axe WCAG 2.0/2.1/2.2 A/AA scans, failing on **serious** or **critical** findings.

Accessibility fixes made during this work: visible/accessible headings, correct admin
landmark, menu roles, stronger contrast, ≥24 px compact hit areas, decorative titlebar
controls, keyboard-focusable scrollable list output, and separate tab/close buttons
instead of nested interactive elements.

## 8. Verification evidence (current local tree)

| Gate | Result |
|---|---|
| `bun run lint` | pass |
| `bun run typecheck` | pass |
| `bun test tests/*.test.ts` | **35 pass, 0 fail, 118 assertions** |
| `bun run test:api` | **87 checks pass** on disposable DB |
| `bun run test:ui` | **12 pass** (Playwright + axe) |
| `bun run seed` | **41 passed, 0 failed** |
| `bun run build` | pass with TypeScript enforced |
| CI | `.github/workflows/ci.yml` runs the same gates with no secrets |

Production verification for this release:

| Check | Result |
|---|---|
| Code / deployment | `37b10fe` / `dpl_7vnuYjYkAZhK4bWi6VL4yTEpLDNX` on the custom domain |
| Database | Turso; schema applied; `41 passed, 0 failed`; 41 examples |
| Owner | `AKASH`, email stored, one owner, 14 owner-owned private programs, 0 unclaimed |
| Health | `clerkConfigured: true`, `authProvider: clerk`, `passwordLogon: retired`, 1 user, 55 programs |
| Public pages | `/`, `/sign-in`, `/sign-up` → `200` |
| Anonymous APIs | `/api/programs`, `/api/modern`, `/api/admin/overview`, `POST /api/execute` → `401` |
| Retired auth | login `403`, register `410`, unsigned webhook `400` |
| Hidden test broker | `/api/test/session`, `/api/test/users` → `404` |
| CI | run `40307337224` passed all local-equivalent gates |
| Production smoke | run `40307911138` passed |
| Obsolete env | `AUTH_SECRET`, legacy flags and `OWNER_USERNAME` removed from Vercel |

The earlier 51-program count is reconciled as 37 shared Standard objects plus 14
owner-owned private programs. The prior baseline was 50 (13 private), so the one-object
change was owner activity, not a seed; owner confirmation of the specific private program
is requested in the final report. Modern seeding took the total to 55 (41 shared + 14
private).

## 9. Requirement status

| Owner spec § | Requirement | Status | Evidence / remaining |
|---|---|---|---|
| 6 | Owner questions/decisions | Ongoing | Modern scope approved; final visual sign-off pending |
| 7 | Clerk auth, Google, protected routes, provisioning, webhooks, migration | **Done, production-verified** | P1 accepted; legacy path removed |
| 8 | Owner-only admin dashboard | **Done, production-verified** | Metrics, users, programs, audit, suspend, revoke, delete |
| 9 | Preserve/test Standard ABAP | **Done** | `MER / 105` fidelity preserved; seed/engine tests pass |
| 10 | Modern ABAP environment + honest matrix | **Done, deployed** | Executable/validated/simulated/unsupported tiers; owner visual sign-off pending |
| 11 | Professional GUI | **Done (current scope)** | Standard + Modern GUIs; automated accessibility checks pass |
| 12 | Data ownership/isolation | **Done** | Server-side rules; API/UI isolation tests; production P1 evidence |
| 13 | Security/reliability | **Done (app layer)** | Sessions, CSRF, rate limits, audit; shared limiter future |
| 14 | Continuous testing/completion verification | **Done, production-verified** | Lint/typecheck/unit/API/UI/axe/build/CI + production smoke; owner sign-off pending |
| 15 | Phase 0 audit | **Done** | This document |
| 15 | Phase 1 architecture/migration | **Done** | Clerk cutover accepted |
| 15 | Phases 2–8 | **P2 implemented and deployed** | Owner visual sign-off is the final gate |

### Deliverables checklist

- [x] Repository audit and architecture documentation.
- [x] Clerk authentication with Email OTP, Google, verified-email linking and owner gate.
- [x] Owner-only administration dashboard and audit history.
- [x] Standard ABAP regression coverage and screenshot fidelity.
- [x] Permanent legacy-auth removal and test-only broker.
- [x] Modern ABAP capability matrix, API, UI and seed examples.
- [x] UI/accessibility automation with axe serious/critical threshold.
- [x] CI workflow and read-only production smoke workflow.
- [x] Non-destructive seed/deploy path with Modern schema backfill.
- [x] Final production deployment/smoke for this release.
- [x] Final acceptance report with technical evidence and program-count reconciliation.
- [ ] Owner visual sign-off of the Modern workspace and confirmation of the extra private program.

## 10. Remaining owner actions / final gate

1. Confirm the extra owner-owned private program (14 private programs; prior baseline 13)
   is expected, or authorize its removal. Do not delete it before confirmation.
2. Review the deployed Modern workspace visually (desktop and mobile) and confirm the
   Standard GUI is unchanged.
3. Confirm [`FINAL-ACCEPTANCE-REPORT.md`](FINAL-ACCEPTANCE-REPORT.md) so the report can be
   marked as the final acceptance certificate.

## 11. Commands

```bash
bun install
bun run db:push
bun run dev
bun run lint
bun run typecheck
bun run test                  # unit tests (tests/*.test.ts)
bun run test:api              # disposable API/security suite
bun run test:ui               # Playwright + axe
bun run test:all              # all local gates
bun run build
bun run seed                  # local non-destructive content + engine/validator check
bun run deploy:db             # remote additive schema + content upsert
bun run owner:provision       # owner role/claim; no password
bun run owner:verify          # read-only owner/email/legacy check
bun run user:email            # historical verified-email mapping helper
bun run owner:favorites       # dry-run legacy favorite migration; APPLY=YES to copy
```

## 12. Explicit non-claims

- Final project acceptance is **not yet claimed**; technical deployment and production
  smoke are complete, but the owner's Modern visual sign-off is pending.
- The Modern workspace is a simulator. It does not execute CDS SQL on HANA, run RAP/OData
  services, execute AMDP database procedures or generate dynpro screens.
- The ABAP engine is a verified educational subset, not a complete SAP kernel.
- Rate limiting is per process, not globally distributed.
- Production counts are live data. The 50 → 51 increase is reconciled structurally as an
  owner-owned private program; the owner still needs to confirm the exact object.
- `AUTH_SECRET`, `LEGACY_AUTH_MODE` and `NEXT_PUBLIC_LEGACY_AUTH_MODE` are obsolete and
  must not be reintroduced.
