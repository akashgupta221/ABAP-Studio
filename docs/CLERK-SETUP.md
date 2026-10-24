# Clerk setup and cutover guide

This is the owner-action guide for the P1 Clerk migration. It does **not** claim that
Clerk is implemented yet. Do not paste publishable/secret keys into chat, screenshots,
issues or Git. Set them directly in Vercel (and optionally your local `.env`).

## What Clerk will provide

- Email one-time passcode (passwordless) sign-in.
- Google sign-in.
- Clerk-managed sessions, with the ABAP-Studio database remaining the authorization
  source of truth for roles, suspension, ownership and audit history.

The existing built-in scrypt logon is interim and will be retired after the cutover.
Owner authorization will continue to require **both** the database `role = OWNER` and the
configured `OWNER_EMAIL`.

## 1. Create the Clerk application

1. Sign in at <https://dashboard.clerk.com> with the owner's account.
2. **Create application** → name it `ABAP-Studio`.
3. Choose the sign-in methods:
   - **Email** with **verification code** (Email OTP).
   - **Google** (social connection).
4. In the Google connection settings, follow Clerk's current instructions to create or
   connect a Google OAuth client. Add the exact authorized redirect URI Clerk displays.
   If Clerk offers shared Google credentials, using them is acceptable for this learning
   project; an owner-owned Google Cloud client is also fine.
5. Disable any sign-in method you do not want public. Do not enable password sign-in if
   the goal is passwordless-only.

## 2. Configure URLs and origins

Use the production URL `https://abap-studio-rd9d.vercel.app` and, for local testing,
`http://localhost:3000`.

In Clerk's application settings, set the paths the app will expose after the code
cutover:

- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in: `/`
- After sign-up: `/`

Add both origins to the allowed origins/redirect URLs. If Vercel preview URLs are used,
add the exact preview origin for that test deployment; do not use a wildcard for
production secrets.

## 3. Set environment variables in Vercel

Vercel → Project → Settings → Environment Variables. Add these for **Production** (and
Preview/Development if you want to test there):

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` or `pk_live_…` | Safe to expose to the browser by design |
| `CLERK_SECRET_KEY` | `sk_test_…` or `sk_live_…` | Server-only; never expose |
| `CLERK_WEBHOOK_SECRET` | `whsec_…` | Only needed if webhooks are enabled |
| `OWNER_EMAIL` | the verified owner email | Must match the email stored on the `OWNER` row |
| `AUTH_SECRET` | existing long random value | Keep it until the built-in auth is fully retired |

Do not replace or rotate `AUTH_SECRET` during the Clerk cutover unless you deliberately
want to invalidate all legacy sessions. Clerk sessions are separate from the interim
cookie.

For local development, put the same keys in `.env` (git-ignored). Never commit `.env`.

## 4. Choose the account-migration policy

Existing production accounts were created before verified email was available. Their
password hashes cannot be mapped to Clerk automatically. Choose one policy before the
cutover:

### Recommended: map by verified email

For each existing account, map its SAP username to the email the person will verify in
Clerk. Keep the existing `User` row, SAP username, private programs, favorites and
execution history. On first Clerk sign-in, the server matches the verified email to the
existing row and records the Clerk user id.

- The owner must supply the mapping privately (for example, a temporary owner-only list
  of `username → email`). Do not send passwords.
- The owner's row must use `OWNER_EMAIL` and have `role = OWNER`.
- Accounts without a verified email mapping cannot be linked; use the fallback below.

### Fallback: re-register and reassign

New Clerk users receive fresh `User` rows with `USER` role. The owner can reassign
private programs through the admin dashboard. The old built-in accounts are then
disabled/retired. This is simpler but loses the username/program continuity unless the
owner reassigns everything manually.

**Recommendation:** map by verified email. There are only three production users, so the
mapping is small and preserves their work.

## 5. Cutover checklist (after the code is implemented)

1. Keys are set in Vercel; `OWNER_EMAIL` matches the provisioned owner row.
2. `bun run lint`, `bun test tests`, `bun run test:api` and `bun run build` pass locally
   with Clerk test keys.
3. Email OTP sign-in works locally.
4. Google sign-in works locally.
5. Owner sign-in opens `/admin`; a non-owner gets `403` from `/api/admin/*` and no admin
   link.
6. A new account receives `role = USER`, a private `Z_MY_PRACTICE_<USERNAME>` sandbox, and
   cannot see another user's programs or favorites.
7. Anonymous `/api/programs`, `/api/execute` and `/api/admin/overview` remain `401`/`403`.
8. Deploy, repeat the checks against production, and verify old sessions are invalid.
9. Only then retire the built-in scrypt logon routes and document the date.

## If a key is exposed

Revoke/rotate it immediately in Clerk and Vercel. Deleting the chat message is not
sufficient. Do not commit a replacement key; set it in Vercel and redeploy.
