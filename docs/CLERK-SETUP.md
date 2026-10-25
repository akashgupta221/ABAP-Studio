# Clerk setup and cutover guide

This is the owner-action guide for the P1 Clerk migration. The P1 code is implemented
on the `clerk-migration` branch, deployed to the production hostname, and passes the local
gates. **Production interactive verification and P1 acceptance are still pending.** Do not
paste publishable/secret keys into chat, screenshots, issues or Git. Set them directly in
Vercel (and locally in the git-ignored `.env`).

## Current status

| Item | Status |
|---|---|
| Clerk application | Owner-selected **ABAP Studio** app, id `app_3Ks7MMboysX2gIBJhfURlf16Pwq` |
| Development instance | Configured; local `.env` has development keys |
| Production instance | **Moved** — `ins_3LAf6uu766aoTCwlI8nX5faMFQA` now targets `https://abap-studio.akashgupta.is-a.dev` as a **Secondary application**. The Frontend API is live at `https://clerk.abap-studio.akashgupta.is-a.dev` and returns HTTP `200` with Email OTP + Google only. The account portal has a valid TLS certificate and returns a Cloudflare browser challenge to curl. The Vercel hostname is verified (`configured-correctly`) and the P1 build is deployed (`dpl_GLQLQvazo3cYfWdBV5KmjM6U4ujb`); `/sign-in` and `/sign-up` return `200`. The EU.org request is still awaiting approval. |
| Sign-in methods | Email OTP + Google enabled; password, phone, username, Facebook and GitHub disabled |
| P1 code | Implemented on `clerk-migration`; deployed to production from that branch; **not merged into `main` yet** |
| Local gates | `lint`, 26 unit tests, 52 API checks and `build` pass |
| Interactive Clerk sign-in | **Development verified** with disposable test users; production not verified |
| Local Clerk integration | Owner mapping, non-owner isolation, ban/unban, force logout, deletion, audit and client sign-out verified on a throwaway DB; test users removed |
| Google OAuth | Production config has Google enabled with empty production credentials; real Google sign-in is **pending** |
| Webhook | Route and signature verification deployed; signing secret is set in Vercel; a real Clerk test event is still pending |
| Clerk mail DNS | **Blocked** — the production domain reports the old `vedhnrhsrdju` mail/DKIM CNAMEs as invalid and `mail.status: not_started`; Email OTP cannot be delivered until [PR #58415](https://github.com/is-a-dev/register/pull/58415) is merged |
| Production keys | Publishable key and secret key are set in Vercel production; values were not printed |
| Free domain path | `docs/FREE-DOMAIN-SETUP.md` — original is-a.dev root denied; appeal #58258 closed; root `akashgupta.is-a.dev` merged and live; nested PR #58363 merged and DNS live; Vercel domain/SSL verified; Clerk domain moved; P1 deployed; production sign-in pending; EU.org awaiting approval |

The selected Clerk application must not be replaced. Production setup resumes the same
application.

## What Clerk provides

- Email one-time passcode (passwordless) sign-in.
- Google sign-in.
- Clerk-managed sessions.

The development instance is deliberately limited to those two methods: application
passwords, phone sign-in and username sign-in are disabled. Sign-up collects only a
verified email address; the SAP username is generated and stored by ABAP-Studio, not
chosen in Clerk.

Clerk proves **identity only**. The ABAP-Studio database remains authoritative for:

- `role` (`OWNER` / `USER`) and suspension;
- ownership of private programs and sandboxes;
- favorites and execution history;
- the admin audit log.

Clerk metadata, client-supplied roles and public metadata are never used for
authorization. Owner access still requires **both** the database `role = OWNER` and the
configured `OWNER_EMAIL`; it fails closed if `OWNER_EMAIL` is missing or mismatched.

## How the migration works

1. The browser signs in through Clerk (`/sign-in` or `/sign-up`).
2. `getSessionUser()` resolves the Clerk session first and calls
   `resolveClerkUser()`.
3. The server looks up the `User` row by `clerkId`. If none exists, it reads the
   **primary verified email** from Clerk and looks for an existing `User` row with that
   email (case-insensitive, with ambiguous matches failing closed).
4. A matching row keeps its SAP username, role, private programs, favorites and history;
   the server records the Clerk id and invalidates old legacy sessions.
5. A new verified Clerk account creates an ordinary `USER` row with a generated SAP
   username and `passwordHash = 'clerk-only'`. It can never choose `OWNER`.
6. A Clerk session that cannot be mapped, or maps to a suspended row, fails closed. It
   does **not** fall through to the legacy cookie.

The signed webhook at `POST /api/webhooks/clerk` is a consistency path for
`user.created`, `user.updated` and `user.deleted`. Session resolution also links on first
sign-in, so the webhook is not the only path. Deletion in Clerk clears the link and
suspends the database row; application data is retained for the owner’s review.

## Cutover modes

`LEGACY_AUTH_MODE` controls the temporary built-in scrypt/HMAC path:

| Mode | Behaviour | Use |
|---|---|---|
| `full` | Legacy logon **and** registration | Disposable local/API tests only |
| `fallback` | Legacy logon for existing accounts; registration is blocked | Default in production during the migration |
| `off` | Legacy endpoints are retired | Only after every account is linked and production is verified |

`NEXT_PUBLIC_LEGACY_AUTH_MODE=off` hides the legacy form in the UI. Set both server and
public values consistently. Production defaults to `fallback` even if Clerk keys are
temporarily missing, so a missing key cannot silently reopen public password
registration.

## 1. Finish the production Clerk domain

Production Clerk needs a domain whose DNS records you control. A bare
`*.vercel.app` address cannot be used for the production Clerk domain. The app itself can
remain on its Vercel hostname; the DNS-controlled domain is for Clerk's production
Frontend API, commonly a subdomain such as `clerk.example.com`.

A production instance has already been created for `abap-studio.is-a.dev` and cloned from
the development instance, so Email OTP is the only email strategy and Google is enabled.
That domain was **denied**, so the instance is not usable as-is. The current free-domain
path is:

- **is-a.dev (current):** the portfolio root `akashgupta.is-a.dev` is merged and live,
  redirecting to <https://akashgupta221.github.io/>. The nested application
  `abap-studio.akashgupta.is-a.dev` and its Clerk subdomains were merged in is-a.dev
  PR #58363 on 25.10.2026 at 17:52 UTC. All six hostnames resolve through DNS; Vercel and
  Clerk TLS are provisioned and verified.
- **EU.org:** `abap-studio.eu.org` is awaiting human approval; no nameserver delegation is
  live yet.

The exact registration JSON, PR text, DNS layout and current status are in
`docs/FREE-DOMAIN-SETUP.md`. The original root PR #58254 was denied as not dev-related
because the preview showed only the SAP-style logon screen. Appeal issue #58258 is now
**closed**; do not submit another `abap-studio.is-a.dev` root PR. Do not automate the
is-a.dev submissions; its terms prohibit AI-created pull requests. EU.org requires a
non-Gmail contact address and may take days to months.

The current blocker is **Clerk mail/DKIM DNS**, not Vercel. The Vercel domain, app
certificate, Clerk Frontend API and account portal are all live. Clerk's production domain
status reports `mail` and both DKIM records as invalid because DNS still points at the old
`vedhnrhsrdju` mail tenant. The required records are:

| Hostname | Required target |
|---|---|
| `clkmail.abap-studio.akashgupta.is-a.dev` | `mail.nefqx6afwufx.clerk.services` |
| `clk._domainkey.abap-studio.akashgupta.is-a.dev` | `dkim1.nefqx6afwufx.clerk.services` |
| `clk2._domainkey.abap-studio.akashgupta.is-a.dev` | `dkim2.nefqx6afwufx.clerk.services` |

The owner submitted the three-file change as
[PR #58415](https://github.com/is-a-dev/register/pull/58415). It changes exactly those three
files, and the `Filter out AI-generated PRs`, `Label`, `Template` and `Tests` checks pass.
It is `MERGEABLE` but blocked on code-owner review. Do not comment or ping maintainers. After
it merges, re-run the DNS check and `bunx clerk deploy status --wait` until Clerk reports
mail/DKIM verified. Until then, Email OTP delivery will not work.

Before deploying, confirm the production instance uses **only Email OTP and Google**.
Phone sign-up/sign-in and username sign-up/sign-in were disabled in the development
instance on 25.10.2026 after they unexpectedly appeared as required sign-up fields. The
production config was checked and has the same restrictions; do not let a copied legacy
phone/username field reappear.

Once the domain change is saved and DNS is live, run:

```bash
bunx clerk deploy status --wait
```

The Google connection still needs a production OAuth client. Follow
`docs/GOOGLE-OAUTH-SETUP.md`; do not reuse development credentials in production. The
redirect URI must match the final domain:

- Path A: `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`
- Path B: `https://clerk.abap-studio.eu.org/v1/oauth_callback`

## 2. Set production environment variables

In the Clerk application settings, set the paths for the instance you are testing:

- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in: `/`
- After sign-up: `/`
- After sign-out: `/`

Add the production origin and `http://localhost:3000` to the allowed origins/redirect
URLs. Do not use wildcard production origins.

After the production instance exists, pull the production keys locally (do not print
them):

```bash
npx clerk@latest env pull --instance prod
```

Add these in **Vercel → Project → Settings → Environment Variables → Production**:

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production publishable key (`pk_live_…`) |
| `CLERK_SECRET_KEY` | Production secret key (`sk_live_…`); server-only |
| `CLERK_WEBHOOK_SECRET` | Signing secret created in step 3 |
| `OWNER_EMAIL` | Must match the verified email stored on the `AKASH` owner row |
| `AUTH_SECRET` | Keep the existing value until the legacy path is removed |
| `LEGACY_AUTH_MODE` | `fallback` for the first production cutover |
| `NEXT_PUBLIC_LEGACY_AUTH_MODE` | `fallback` for the first production cutover |

Do not use development keys in production. Do not rotate `AUTH_SECRET` during the
cutover unless you deliberately want to invalidate every legacy session.

### Deploy the P1 build

The P1 build was deployed from `clerk-migration` on 25.10.2026 as
`dpl_GLQLQvazo3cYfWdBV5KmjM6U4ujb` and aliased to the verified custom domain.
`/sign-in` and `/sign-up` return `200`; `/api/health` reports the Clerk keys as
configured and `legacyAuthMode: "fallback"`. The webhook route returns `400` for
an unsigned request, proving signature verification is active. If a later
deployment fails, redeploy the last known-good production deployment from the
Vercel dashboard; the legacy fallback and database are unchanged. Do not merge
`clerk-migration` into `main` until the production browser checks pass.

## 3. Create the webhook

In the Clerk dashboard for the production instance, create an endpoint:

- Path A URL: `https://abap-studio.akashgupta.is-a.dev/api/webhooks/clerk`
- Path B URL: `https://abap-studio.eu.org/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`

Copy the signing secret into Vercel as `CLERK_WEBHOOK_SECRET` and redeploy. The endpoint
returns `503` when the secret is missing and `400` when a signature is invalid. It never
accepts a role or ownership from the payload.

## 4. Map the existing accounts

The owner row already matches `OWNER_EMAIL`. For each non-owner account that does not yet
have a verified email on file, attach the address the owner has verified out-of-band:

```bash
CONFIRM_SET_USER_EMAIL=YES \
OWNER_USERNAME=AKASH \
TARGET_USERNAME=USER1 \
TARGET_EMAIL="user1@example.com" \
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run user:email
```

The command refuses an email already attached to another account, normalizes the address,
writes an audit entry and does not set a Clerk id or password. The next Clerk sign-in with
that verified address links the existing SAP username and its private work.

Accounts without an owner-verified mapping remain on legacy fallback. Do not import scrypt
hashes into Clerk and do not send passwords through chat.

## 5. Verify interactively

Before switching production traffic, complete these checks in a browser:

1. Email OTP sign-in delivers a code and creates a Clerk session.
2. Google sign-in completes.
3. The owner lands on `/` with `role=OWNER`; `/api/auth/me` reports `owner=true`; `/admin`
   loads and the owner’s private programs are visible.
4. A non-owner is mapped to their existing username and programs, gets `403` from
   `/api/admin/*`, sees shared examples and their own sandbox only.
5. New sign-up receives `USER`, a private sandbox and no admin link.
6. Suspend, reactivate and force-logout operate on both the Clerk identity and the
   database row.
7. Confirm deletion removes the Clerk identity and the database row after the typed
   username check.
8. Sign out through Clerk and confirm the old legacy cookie cannot resurface.

**Development verification (25.10.2026).** A throwaway SQLite database and two disposable
Clerk test users (`+clerk_test` addresses, test OTP, no email/SMS sent) exercised the
signed-in paths:

- Email OTP sign-in linked the owner test email to `AKASH`; `/api/auth/me` returned
  `owner=true`, `role=OWNER`; `/api/admin/overview` returned `200`; `/admin` rendered.
- A second test user received `USER`; `/api/admin/overview` returned `403`; `/admin`
  redirected to `/`.
- Suspend set Clerk `banned=true` and the database `suspended=true`; the banned test user
  could request a code but received **“You have been banned”** after verification and no
  session was created. Reactivate cleared both flags.
- Force-logout incremented `sessionVersion` and revoked the linked Clerk sessions. The
  target was signed out at that moment, so immediate revocation of an active second
  browser was not exercised.
- Admin deletion removed the Clerk user and the database row after the typed-username
  confirmation. Audit entries `USER_SUSPEND`, `USER_REACTIVATE`, `USER_SESSION_REVOKE`
  and `USER_DELETE` were written.
- Logoff now calls Clerk's client `signOut()` after server revocation; `/api/auth/me`
  returned `null` and the SAP logon pad returned without a stale `AKASH` session.
- The disposable Clerk users and throwaway database were deleted. The local Clerk config
  was then reduced to Email OTP + Google only; `/sign-in` and `/sign-up` show no password,
  phone or username fields.

**Still unverified:** real Google OAuth, webhook delivery/signature against Clerk, the
production Clerk instance/domain/keys, a mapped non-owner production account, and an
active-session force-logout. Complete the production checks above before accepting P1.

## 6. Retire the fallback

Only after every account is linked and the signed-in production checks pass:

1. Set `LEGACY_AUTH_MODE=off` and `NEXT_PUBLIC_LEGACY_AUTH_MODE=off` in Vercel.
2. Redeploy and confirm `/api/auth/login` and `/api/auth/register` are closed and the
   legacy form is hidden.
3. In a later cleanup, remove the scrypt/HMAC fallback code and the `AUTH_SECRET`
   requirement.

Until then, the legacy path remains a deliberately temporary fallback.

## Local testing

Local `.env` currently has development Clerk keys. The local gates are:

```bash
bun run lint
bun run test
bun run test:api
bun run build
```

The API suite intentionally runs with `LEGACY_AUTH_MODE=full` and a disposable database.
It does not exercise real Clerk sessions, webhooks or Google. The separate development
integration run described in section 5 did exercise Email OTP, owner/non-owner identity,
admin ban/unban/revoke/delete, audit and client sign-out against a throwaway database.

The local `/sign-in` page shows only **Continue with Google** and **Email address**; the
password, phone and username fields are absent. If the form appears blank immediately
after a config change, wait for Clerk hydration and reload before diagnosing a code fault.

## Security notes

- Never commit `.env` or print secret values.
- Clerk’s `role`/metadata is not authorization; only the database role is.
- The owner gate requires a matching `OWNER_EMAIL`; it fails closed.
- A Clerk identity can link only by its **verified** email, and a conflicting or
  ambiguous mapping is rejected.
- Once a Clerk session exists, the middleware clears the legacy cookie so signing out of
  Clerk cannot expose an older legacy session.
- The webhook signature is verified before any database write.

## If a key is exposed

Revoke/rotate it immediately in Clerk and Vercel. Deleting the chat message is not
sufficient. Do not commit a replacement key; set it in Vercel and redeploy.
