# Clerk setup and cutover record

**P1 is complete and accepted (26.10.2026).** Production authentication is Clerk-only:
Email OTP and Google, with verified-email account linking. The legacy scrypt/HMAC logon
and registration endpoints are retired. Clerk proves identity; the ABAP-Studio database
remains authoritative for roles, suspension, ownership and audit history.

Do not paste publishable/secret keys into chat, screenshots, issues or Git. Set secrets
directly in Vercel (and locally in the git-ignored `.env`). Production secret values are
never printed by the commands in this guide.

## Current status

| Item | Status |
|---|---|
| Clerk application | **ABAP Studio**, id `app_3Ks7MMboysX2gIBJhfURlf16Pwq` |
| Production instance | `ins_3LAf6uu766aoTCwlI8nX5faMFQA`, bound to `https://abap-studio.akashgupta.is-a.dev` as a **Secondary application** |
| Clerk Frontend API | `https://clerk.abap-studio.akashgupta.is-a.dev` — live with a valid TLS certificate |
| Sign-in methods | **Email OTP + Google only**; password, phone, username, Facebook and GitHub disabled |
| P1 code | Merged into `main` as `e3df40c`; production code deployment `dpl_H827WkruszuKqUBCeV58DRER4LyU` |
| P2 final release | `main` at `37b10fe`; deployment `dpl_7vnuYjYkAZhK4bWi6VL4yTEpLDNX` on the custom domain; CI run `40307337224`, production smoke `40307911138` |
| Final database | Turso schema applied; `41 passed, 0 failed`; 41 shared examples + 14 owner-owned private programs = 55 total |
| Final env cleanup | `AUTH_SECRET`, `LEGACY_AUTH_MODE`, `NEXT_PUBLIC_LEGACY_AUTH_MODE` and `OWNER_USERNAME` removed from Vercel; Clerk/Turso/`OWNER_EMAIL` remain |
| Hidden test broker | `/api/test/session` and `/api/test/users` return `404` on the live site; production smoke verifies this |
| Local gates | `lint`, type-check, **35 unit tests**, **87 API checks**, **12 UI/axe tests** and production `build` pass |
| Owner sign-in | Verified production Email OTP and Google; both linked to the same Clerk identity; `/api/auth/me` returns `AKASH` / `OWNER` / `owner: true` |
| Non-owner isolation | Verified in production with disposable users: `/admin` redirects to `/`; `/api/admin/*` returns `403`; another user’s private program is invisible and direct GET/PUT/DELETE returns `404` |
| Owner administration | Verified counts, users, programs, 7-day chart, recent activity, suspend/reactivate, force logout, delete and audit log. Owner-only program deletion is available in **All programs** and is audited as `PROGRAM_DELETE` |
| Webhook | Real signed `user.created` delivery verified in production; the DB count increased from 4 to 5 before the test identity was removed. Unsigned POST returns `400 Invalid webhook signature` |
| Google OAuth | Production Google Cloud client installed in Clerk; real owner Google sign-in completed and linked to the existing Clerk identity |
| Clerk mail DNS | **Complete** — [PR #58415](https://github.com/is-a-dev/register/pull/58415) merged; all five Clerk CNAMEs verified; domain/DNS/mail/SSL all `complete` |
| Free-plan limitation | Clerk’s free plan rejects native user bans (`app:ban_user`). Suspension is enforced by DB `suspended=true` plus Clerk session revocation; see below |
| Legacy authentication | **Permanently removed.** The scrypt/HMAC modules, legacy UI flags and password-reset script are deleted; `/api/auth/login` returns `403`, `/api/auth/register` returns `410` |
| Production accounts | One linked owner and private data only. The owner approved removal of the three remaining non-owner accounts; live user/program counts are reported by `/api/health` |
| Free domain | `https://abap-studio.akashgupta.is-a.dev` is the verified production domain. EU.org is not required and remains an unused backup path |

Do not replace the selected Clerk application. Do not create a second production
instance unless the owner explicitly decides to move domains.

## What Clerk provides

- Email one-time passcode (passwordless) sign-in.
- Google sign-in.
- Clerk-managed browser sessions.

Clerk proves **identity only**. The ABAP-Studio database remains authoritative for:

- `role` (`OWNER` / `USER`) and suspension;
- ownership of private programs and sandboxes;
- favorites and execution history;
- the admin audit log.

Clerk metadata, client-supplied roles and public metadata are never used for
authorization. Owner access requires **both** the database `role = OWNER` and the
configured `OWNER_EMAIL`; it fails closed if the email is missing or mismatched.

## How identity resolution works

1. The browser signs in through Clerk (`/sign-in` or `/sign-up`).
2. `getSessionUser()` resolves the Clerk session and calls `resolveClerkUser()`.
3. The server looks up the `User` row by `clerkId`. If none exists, it reads the
   **primary verified email** from Clerk and looks for an existing `User` row with that
   email (case-insensitive; ambiguous matches fail closed).
4. A matching row keeps its SAP username, role, private programs, favorites and history;
   the server records the Clerk id and invalidates old sessions.
5. A new verified Clerk account creates an ordinary `USER` row with a generated SAP
   username and `passwordHash = 'clerk-only'`. It can never choose `OWNER`.
6. A Clerk session that cannot be mapped, or maps to a suspended row, fails closed.
7. The signed webhook at `POST /api/webhooks/clerk` is the consistency path for
   `user.created`, `user.updated` and `user.deleted`. Session resolution also links on first
   sign-in, so the webhook is not the only path. Deletion in Clerk clears the link and
   suspends the database row; application data is retained until the owner deletes the row.

## Legacy authentication removal

The built-in scrypt/HMAC implementation is gone. There is no environment flag that can
re-open it:

- `src/lib/auth.ts`, `src/lib/auth-mode.ts` and `scripts/set-owner-password.ts` are deleted.
- `/api/auth/login` is a permanent `403` retirement stub.
- `/api/auth/register` is a permanent `410` retirement stub.
- The logon UI has no password/registration form.
- `scripts/provision-owner.ts` never creates or stores a password.
- API/UI tests use `src/lib/test-auth.ts`, a separate HMAC-signed **test-only** session
  broker. It requires `E2E_TEST_MODE=1`, a secret of at least 16 characters and the
  absence of `VERCEL`/`TURSO_DATABASE_URL`, so production fails closed.

Do not re-add a password path as a fallback. Clerk is the only identity provider.

## Production configuration

### Domain and DNS

The application and Clerk Frontend API use the verified is-a.dev path:

| Hostname | Purpose |
|---|---|
| `abap-studio.akashgupta.is-a.dev` | Application origin |
| `clerk.abap-studio.akashgupta.is-a.dev` | Clerk Frontend API |
| `accounts.abap-studio.akashgupta.is-a.dev` | Clerk account portal |

The Clerk mail/DKIM records are:

| Hostname | Target |
|---|---|
| `clkmail.abap-studio.akashgupta.is-a.dev` | `mail.nefqx6afwufx.clerk.services` |
| `clk._domainkey.abap-studio.akashgupta.is-a.dev` | `dkim1.nefqx6afwufx.clerk.services` |
| `clk2._domainkey.abap-studio.akashgupta.is-a.dev` | `dkim2.nefqx6afwufx.clerk.services` |

The owner submitted the three-file DNS change manually as
[PR #58415](https://github.com/is-a-dev/register/pull/58415); it merged on 25.10.2026 at
20:07 UTC (`54aa4bdea27f61843e8012832ab3a2790efe8f13`). Clerk reports
`status: complete`, `dns: complete`, `mail: complete` and `ssl: complete`.

The original `abap-studio.is-a.dev` root was denied and its appeal is closed. The live
path is the portfolio root `akashgupta.is-a.dev` (redirects to
<https://akashgupta221.github.io/>) plus the nested app/Clerk records. Full domain history
is in `docs/FREE-DOMAIN-SETUP.md`.

### Vercel production variables

| Name | Current value / purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production publishable key (`pk_live_…`); browser-visible by design |
| `CLERK_SECRET_KEY` | Production secret key; server-only |
| `CLERK_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/clerk` |
| `OWNER_EMAIL` | Verified owner email; must match the `AKASH` row |
| `TURSO_DATABASE_URL` | Production libSQL URL |
| `TURSO_AUTH_TOKEN` | Production Turso token |

Clerk paths are `/sign-in`, `/sign-up`, `/` after sign-in/sign-up and `/` after sign-out.
The production origin is allowed; do not use wildcard production origins.

### Production key incident (fixed)

The first production deployment had a `CLERK_SECRET_KEY` that did not validate sessions
against the live Clerk instance. Email OTP reached the browser, but server-side session
resolution failed. The production key was pulled with
`bunx clerk@latest env pull --app … --instance prod`, validated against the production
owner user, replaced in Vercel, and the app was redeployed. Production owner sign-in then
passed. Never use development keys in production and never print the key.

### Deploy record

The P1 branch was merged into `main` with merge commit `e3df40c` and deployed as
`dpl_H827WkruszuKqUBCeV58DRER4LyU`. Earlier production deployments during the cutover were
`dpl_ByZUX2BiqBcNr1gmRgBLmqKBMfqL` (secret/suspension fix) and
`dpl_7yLpXYtHe4aVhfb9hsrP7ZapDFWs` (legacy off). `/api/health` reports
`clerkConfigured: true`, `passwordLogon: "retired"`, Turso, one owner and the current live object count.

## Webhook

The production endpoint is:

`https://abap-studio.akashgupta.is-a.dev/api/webhooks/clerk`

Events: `user.created`, `user.updated`, `user.deleted`. The signing secret is set in
Vercel. The endpoint verifies the signature before any database write; it returns `400`
for an unsigned/invalid request and never accepts a role or ownership from the payload.

**Production verification:** a disposable Clerk user was created with a verified email.
The real signed `user.created` event created the local row and `/api/health` moved from 4
to 5 users without a browser sign-in. The Clerk identity was then deleted and the owner
removed the local test row. This proves live delivery, signature verification and database
sync. The webhook remains a secondary consistency path because first sign-in also links.

## Google OAuth

The production Google Cloud OAuth client is installed in Clerk. The owner’s Google account
completed sign-in and was linked to the existing Clerk user as `oauth_google`. The owner
session still returns `AKASH` / `OWNER` and the same private workspace. Exact setup values
and troubleshooting are in `docs/GOOGLE-OAUTH-SETUP.md`.

## Accounts and legacy mapping

The production owner row has a verified email and is linked to Clerk. The owner reviewed
the three remaining non-owner database accounts and explicitly approved permanent removal,
including their private data. They were deleted through `/admin`; audit entries were
written and only the linked owner remains. There are no unmapped legacy accounts.

This path is historical and should not be used to reintroduce the fallback after P1:
`bun run user:email` can attach an owner-verified address to an existing row before a
cutover. Never import scrypt hashes into Clerk and never send passwords through chat.

## Production verification evidence

| Check | Result |
|---|---|
| Owner Email OTP | Delivered; verified email; Clerk session created |
| Owner Google OAuth | Completed; linked to the same Clerk identity; `oauth_google` external account present |
| Owner authorization | `/api/auth/me` → `AKASH` / `OWNER` / `owner: true`; `/admin` loads |
| Owner overview | The 4-user/50-program overview and 7-day execution chart were confirmed before the three non-owner accounts were removed; current counts are live in `/api/health` |
| Non-owner `/admin` | Redirected to `/` |
| Non-owner admin API | `/api/admin/overview` → `403` |
| Private-program isolation | Another user’s program was absent from lists; direct GET/PUT/DELETE → `404` |
| Suspend | DB suspension immediately blocked `/api/auth/me` and `/api/programs` for the target |
| Reactivate | Fresh Clerk sign-in restored access |
| Force logout | Independent fresh session became `revoked`; token refresh returned `authentication_invalid`; suspended target stayed denied |
| Delete | Clerk identity and database row removed; owned program data removed; audit retained |
| Audit log | `USER_SUSPEND`, `USER_REACTIVATE`, `USER_SESSION_REVOKE`, `USER_DELETE` and the later `PROGRAM_DELETE` verified by the owner |
| Owner program deletion | A disposable private program was deleted from **All programs**; count returned to 50; `PROGRAM_DELETE` recorded |
| Webhook | Real signed `user.created` delivered; unsigned POST → `400` |
| Legacy retirement | `/api/auth/login` → `403`; `/api/auth/register` → `410`; legacy modules/UI deleted |
| Standard ABAP fidelity | Owner confirmed the `MER / 105` Standard ABAP screen is unchanged after P1 |

**Free-plan suspension behaviour.** Clerk’s free plan rejects native user bans with
`unsupported_subscription_plan_features` / `app:ban_user`. ABAP-Studio therefore treats
the database `suspended` flag as authoritative and revokes Clerk sessions for the linked
identity. The user cannot obtain a usable app session while suspended. Native Clerk bans
and the Clerk dashboard “banned” state are not required for application security.

## Security notes

- Never commit `.env` or print secret values.
- Clerk’s role/metadata is not authorization; only the database role is.
- The owner gate requires a matching `OWNER_EMAIL`; it fails closed.
- A Clerk identity can link only by its **verified** email; conflicts or ambiguity are
  rejected.
- The webhook signature is verified before any database write.
- Examples are shared/read-only. Private programs are creator-only; the owner can inspect
  and delete any non-example program. Deletion requires an exact typed name and is audited.
- The legacy authentication code and environment flags are deleted. Do not reintroduce a
  password fallback; use Clerk only.

## Local testing

Local `.env` may contain development Clerk keys. The required gates are:

```bash
bun run lint
bun run typecheck
bun run test
bun run test:api
bun run test:ui
bun run build
```

The API/UI suites use the disposable test-session broker against throwaway databases; they
never touch production and do not exercise real Clerk sessions, webhooks or Google.
Production browser verification is recorded above.

Current local results: **lint and type-check clean, 35 unit tests, 87 API checks, 12 UI/axe
tests, build successful.**

## Troubleshooting

- **Clerk form missing or no Google button** — verify the production publishable key on the
  deployment, wait for Clerk hydration and reload. Password, phone and username are
  intentionally disabled.
- **Email OTP not delivered** — check Clerk domain/DNS/mail status and spam; production DNS
  is currently complete.
- **Clerk session active but no SAP user** — the verified email does not map to an active
  row, or the row is suspended. Check `/admin`; do not re-enable the legacy fallback.
- **`redirect_uri_mismatch`** — the Google authorized redirect must exactly match
  `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`.
- **Webhook returns 400** — unsigned/invalid signature; create the event in Clerk or use a
  signed test. A missing secret returns `503`.
- **Webhook returns 503** — set `CLERK_WEBHOOK_SECRET` in Vercel and redeploy.
- **Native ban fails** — expected on the free plan; use app suspension, which also revokes
  Clerk sessions.

## If a key is exposed

Revoke/rotate it immediately in Clerk and Vercel. Deleting the chat message is not
sufficient. Do not commit a replacement key; set it in Vercel and redeploy.
