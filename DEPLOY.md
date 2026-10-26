# Publish ABAP-Studio for free (Vercel + Turso)

This guide deploys the current ABAP-Studio build to a free Vercel Hobby project with a
free Turso database. It covers production authentication, database seeding, owner
provisioning, the Modern ABAP workspace and the verification gates.

> **Current status:** P0 (security/ownership/admin) and P1 (Clerk authentication) are
> deployed and accepted. The P2 Modern ABAP workspace, automated UI/axe checks and
> permanent legacy-auth removal are implemented. Final project acceptance is the last
> gate: deploy this build, run the production checks, publish the acceptance report and
> obtain owner visual sign-off of the Modern workspace. Live counts are reported by
> `/api/health`; do not hard-code a program total in deployment notes.

Production URL: **https://abap-studio.akashgupta.is-a.dev**

- Standard SAP GUI fidelity is preserved for system `MER`, client `105`.
- Clerk Email OTP + Google is the only identity path. No password auth is available.
- Examples are shared/read-only; private programs and Modern objects are creator-only.
- The owner is a database `OWNER` with a matching verified `OWNER_EMAIL`.

---

## 1. Prerequisites

- A GitHub account and this repository.
- A Vercel account on the **Hobby** plan.
- A Turso account on the **free** plan.
- A Clerk application with **Email OTP** and **Google** enabled.
- Bun ≥ 1.2 locally.

Everything below is free. No credit card is required by Vercel Hobby or Turso free.

## 2. Local release gates

Run these from the repository root before deploying:

```bash
bun install
bun run lint
bun run typecheck
bun test tests/*.test.ts       # 35 unit tests, 118 assertions
bun run test:api               # 87 disposable API/security checks
bun run test:ui                # 12 Playwright + axe checks
bun run seed                   # verifies 41 seeded objects
bun run build                  # production build with TypeScript enforced
```

Run the API and UI suites sequentially; both use the Next.js `.next` directory. They
create disposable databases and never touch production. The UI suite fails on serious or
critical WCAG findings.

The GitHub **CI** workflow runs the same gates with no repository secrets. It is safe for
pull requests and `main` pushes.

## 3. Database backup

Before a schema/content deploy, take a Turso backup:

```bash
turso db shell <database> ".dump" > "abap-studio-backup-$(date +%Y%m%d-%H%M%S).sql"
```

Keep the backup outside the repository. Never commit a database dump; it contains user
identities and private programs.

## 4. Vercel environment

In **Vercel → Project → Settings → Environment Variables**, set the following for the
production environment (and preview if desired). Do not print or commit values.

| Name | Required | Purpose |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | `libsql://…` production database URL |
| `TURSO_AUTH_TOKEN` | yes | Turso token; server-only |
| `OWNER_EMAIL` | yes | Verified owner email; must match the `OWNER` database row |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Production Clerk browser key (`pk_live_…`) |
| `CLERK_SECRET_KEY` | yes | Production Clerk server key (`sk_live_…`) |
| `CLERK_WEBHOOK_SECRET` | yes | Signing secret for `/api/webhooks/clerk` |
| `DATABASE_URL` | no | Only needed for local/build tooling; production uses Turso |

**Remove obsolete variables.** The application no longer reads `AUTH_SECRET`,
`LEGACY_AUTH_MODE` or `NEXT_PUBLIC_LEGACY_AUTH_MODE`. Delete them from Vercel after the new
build is live. They are not needed for rollback because the legacy modules have been
deleted.

Clerk configuration:

- Allowed production origin: `https://abap-studio.akashgupta.is-a.dev`.
- Sign-in/sign-up paths: `/sign-in`, `/sign-up`.
- Email OTP and Google enabled; password, phone and username methods disabled.
- Verified email required for linking.
- Production keys only. Never use `pk_test_`/`sk_test_` in production.
- Never paste a secret into chat, an issue or a screenshot.

Detailed Clerk setup and the production evidence are in
[`docs/CLERK-SETUP.md`](CLERK-SETUP.md). Domain/DNS history is in
[`docs/FREE-DOMAIN-SETUP.md`](FREE-DOMAIN-SETUP.md); Google in
[`docs/GOOGLE-OAUTH-SETUP.md`](GOOGLE-OAUTH-SETUP.md).

## 5. Deploy the code

Push to the production branch; Vercel redeploys automatically. Or deploy the current
checkout with the Vercel CLI after verifying the same revision:

```bash
git status
git push origin main
```

The build must pass TypeScript and the Next.js production build. Do not bypass type
errors or commit `.env`.

## 6. Apply schema and seed content

### Option A — GitHub Actions (recommended)

Run **Actions → Deploy database → Run workflow** from `main` with `confirm=DEPLOY`. It
uses the repository secrets `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `OWNER_EMAIL`, so
the token never appears in a terminal or in this conversation. The log prints only the
shared example verification and the owner/example counts; it does not print private
program names or credentials.

### Option B — local shell

Use the production Turso credentials in your shell (never in Git):

```bash
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run deploy:db
```

`deploy:db`:

1. generates additive `CREATE TABLE IF NOT EXISTS`/index DDL;
2. calls the application's `ensureSchema()` additive migration, which adds newer columns
   such as `Program.environment` and `Program.modernKind` to existing tables;
3. upserts the 10 topics, 11 demo tables/113 rows, function modules, 36 Standard
   examples, the shared INCLUDE and the 4 Modern examples;
4. verifies every seeded ABAP/Modern object against the engine or validator.

It never deletes users, private programs, favorites, execution history or examples. Run it
again after any seed change.

Expected seed verification tail:

```text
41 passed, 0 failed
SEED COMPLETE ✓
```

## 7. Provision the owner

### Option A — GitHub Actions (recommended)

1. Add repository secrets:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `OWNER_EMAIL`
2. Open **Actions → Provision owner → Run workflow**:
   - `confirm`: `PROVISION`
   - `owner_username`: the existing SAP username, e.g. `AKASH`
3. The workflow runs `owner:provision` and the read-only `owner:verify`. It fails if
   `OWNER_EMAIL` is missing or the owner/legacy state is inconsistent. It never prints
   tokens or the email and stores no password.

There is no `OWNER_PASSWORD` secret. If an old one exists, delete it.

### Option B — local shell

```bash
CONFIRM_OWNER_PROVISION=YES \
OWNER_USERNAME=AKASH \
OWNER_EMAIL="owner@example.com" \
TURSO_DATABASE_URL="libsql://…" \
TURSO_AUTH_TOKEN="…" \
bun run owner:provision
```

The script is idempotent: it creates/updates the owner, claims ownerless non-example
programs, preserves examples and invalidates old owner sessions. It never creates or
stores a password. Production owner access fails closed if `OWNER_EMAIL` is absent or does
not match the database row.

If the owner account does not exist yet, sign in once through Clerk so the verified email
creates an ordinary row, then run provisioning.

## 8. Production verification

### Automated public smoke

Run **Actions → Production smoke → Run workflow** with the production URL. It uses no
secrets and checks:

- `/api/health`: `ok`, Turso, Clerk configured, `authProvider: clerk`,
  `passwordLogon: retired`, at least one user and at least 41 programs;
- `/`, `/sign-in`, `/sign-up`: `200`;
- anonymous `/api/programs`, `/api/modern`, `/api/admin/overview`, `POST /api/execute`:
  `401`;
- legacy login `403`, legacy registration `410`, unsigned Clerk webhook `400`.

The workflow also runs weekly on a schedule.

### Owner browser checklist

1. Sign in with Clerk Email OTP and Google; confirm both map to the same owner identity.
2. `/api/auth/me` → `username`, `role: OWNER`, `owner: true`.
3. `/admin` loads; overview, users, programs, audit and 7-day chart render.
4. Open **ABAP Training → Modern ABAP Workspace** or enter command `MODERN`.
5. Open `Z_MD_CONSTRUCTORS`, click **Validate**, then **Execute**. Confirm output contains
   the 7.40 constructor, `REDUCE 1..5 = 15`, `FOR ... WHERE` selection and the table
   expression result.
6. Open `ZI_MD_FLIGHT`, `Z_MD_RAP_BEHAVIOR` and `ZCL_MD_AMDP`. Confirm **Execute** is
   disabled and **Validate** returns `VALID` with the structural-only explanation.
7. Create a private Modern ABAP object, save, execute and delete it. Confirm it is private
   to the owner and appears in `/admin` as a non-example program.
8. Verify the Standard SAP GUI is unchanged: `MER / 105`, Easy Access, SE38 and status
   bar.
9. Verify a disposable ordinary user cannot see the owner's private objects, cannot open
   `/admin`, and gets `404` for direct private Modern GET/PUT/DELETE.
10. Confirm no `AUTH_SECRET`/legacy environment variables remain and `/api/health` reports
    `passwordLogon: "retired"`.

### Legacy endpoint checks

```text
POST /api/auth/login      → 403 (permanent retirement stub)
POST /api/auth/register   → 410 (permanent retirement stub)
POST /api/webhooks/clerk  → 400 without a valid signature
```

## 9. Final acceptance

Publish `docs/FINAL-ACCEPTANCE-REPORT.md` only after:

- every local and CI gate passes on the deployed revision;
- `deploy:db` seeded the Modern objects;
- production public/owner checks pass;
- the owner has visually accepted the Modern workspace;
- any unexplained production data changes have been reviewed and explained.

Do not claim final acceptance from local tests alone.

## Updating the published app later

| Change | Action |
|---|---|
| UI/code | commit + push → Vercel redeploys; CI runs |
| Seed content | `bun run deploy:db` again |
| New schema columns/tables | app's additive `ensureSchema()` runs on first request; `deploy:db` also applies it |
| Clerk/domain config | follow `docs/CLERK-SETUP.md`; repeat the owner/ordinary-user checks |
| Authentication code | repeat the full production Clerk regression checklist before merging |

`deploy:db` never drops or rewrites user-owned tables. If a future change requires a
destructive schema operation, add a reviewed migration and a verified backup step instead
of weakening this guarantee.

## Troubleshooting

- **Site loads but lists are empty** — `deploy:db` was not run, or it ran against a
  different database than Vercel uses. Check `/api/health` `tursoHost`.
- **Owner cannot open `/admin`** — verify `OWNER_EMAIL` in Vercel, the stored email on the
  `OWNER` row and the account's role. Production fails closed when the email is missing.
  Re-login after changing the identity; run `bun run owner:verify`.
- **Clerk sign-in shows no form** — confirm production keys are set in the environment that
  built the deployment, wait for hydration and reload. Password/phone/username are
  intentionally disabled.
- **Email OTP not delivered** — check Clerk domain/DNS/mail status and spam.
- **Google `redirect_uri_mismatch`** — the authorized redirect must match
  `https://clerk.abap-studio.akashgupta.is-a.dev/v1/oauth_callback`.
- **Webhook returns 503** — set `CLERK_WEBHOOK_SECRET` and redeploy. `400` means the
  signature is missing or invalid.
- **Owner suspension fails with `app:ban_user`** — expected on Clerk's free plan. The app
  uses database suspension plus Clerk session revocation; native bans are not required.
- **Modern Execute is disabled** — expected for CDS/RAP/AMDP. Only ABAP is executable; the
  other kinds are structurally validated/simulated and explicitly labelled.
- **Modern `deploy:db` fails verifying a definition** — fix the seed source/validator,
  rerun locally with `bun run seed`, then redeploy. Do not skip verification.
- **Tests fail with Playwright in Bun** — use `bun run test` (unit glob) and
  `bun run test:ui` separately; do not run `bun test tests` over Playwright `.spec.ts`
  files.
- **Everyone is logged out after an auth deploy** — expected when sessions are revoked or
  signing configuration changes. Ask users to sign in once.

## Notes

- Turso free tier and Vercel Hobby are sufficient for this learning project.
- Local development uses `prisma/db/app.db` when `TURSO_*` is unset. The file is ignored
  by Git and created with `bun run db:push`.
- The old global `Favorite` table is unused; the guarded `legacy-favorites` workflow remains
  available only for other databases. Production was verified empty, so no migration is
  needed.
- Custom domain: Vercel → Project → Settings → Domains.
