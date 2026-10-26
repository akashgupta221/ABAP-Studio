# Publish ABAP-Studio for free (Vercel + Turso)

What this gives you:

- a public URL such as `https://abap-studio-rd9d.vercel.app`
- **automatic updates** on every `git push`
- a free Turso database with **per-user accounts, private programs, favorites and
  execution history**
- an owner-only administration dashboard

Everything is free: Vercel **Hobby** + Turso **free**. No credit card needed.

> **Current production status:** `https://abap-studio.akashgupta.is-a.dev` runs the merged
> `main` build. Authentication is Clerk-only (Email OTP + Google); the legacy scrypt/HMAC
> path is `off`. Production owner sign-in, Google linking, non-owner isolation,
> suspend/reactivate/force-logout/delete, owner program deletion, signed webhook delivery,
> audit logging and Standard ABAP fidelity are verified. **P0 and P1 are accepted.**
> Production has 1 owner and 50 programs. The original root `abap-studio.is-a.dev` was
> denied; the live path is the portfolio root `akashgupta.is-a.dev` plus the nested app.
> EU.org remains an unused backup. See
> [`docs/CLERK-SETUP.md`](CLERK-SETUP.md) for evidence and
> [`docs/MASTER-PROJECT-SPEC.md`](MASTER-PROJECT-SPEC.md) for the remaining P2/final
> acceptance work.

---

## Part 1 — Put the code on GitHub

1. Create an empty repository on github.com.
2. In this folder:

```bash
git remote add origin https://github.com/<you>/ABAP-Studio.git
git push -u origin main
```

Pushing to the production branch triggers a Vercel deployment. For future changes, push
to a feature branch first, verify locally, then merge/deploy during an announced
maintenance window.

## Part 2 — Create the free Turso database

1. Go to turso.tech → **Sign in with GitHub**.
2. **Create Database** → pick the region closest to you.
3. Open the database → **Connect** shows the `libsql://` URL.
4. **Create Token** and copy it. Store it in a password manager, never in Git.

```bash
# CLI alternative
turso db create abap-studio
turso db show abap-studio --url
turso db tokens create abap-studio
```

**Take a backup before any migration:**

```bash
turso db shell abap-studio ".dump" > abap-studio-backup-$(date +%Y%m%d).sql
```

## Part 3 — Deploy on Vercel

1. vercel.com → **Add New → Project → Import** the repository.
2. Framework preset is detected as **Next.js**; leave build settings alone.
3. Add environment variables:

   | Name | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://…` (Part 2) |
   | `TURSO_AUTH_TOKEN` | token from Part 2 |
   | `OWNER_EMAIL` | the verified owner email (authoritative) |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk production publishable key (`pk_live_…`) |
   | `CLERK_SECRET_KEY` | Clerk production secret key; server-only |
   | `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
   | `LEGACY_AUTH_MODE` | `off` |
   | `NEXT_PUBLIC_LEGACY_AUTH_MODE` | `off` |
   | `AUTH_SECRET` | dormant legacy signing secret; keep only while the legacy code remains |

   Owner recognition fails closed if `OWNER_EMAIL` is missing or does not match the
   verified email on the `OWNER` row. Never use development Clerk keys in production.
   Follow [`docs/FREE-DOMAIN-SETUP.md`](FREE-DOMAIN-SETUP.md),
   [`docs/GOOGLE-OAUTH-SETUP.md`](GOOGLE-OAUTH-SETUP.md) and
   [`docs/CLERK-SETUP.md`](CLERK-SETUP.md) for the domain, Google client and Clerk setup.

4. Click **Deploy**. The database is still empty; Part 4 fixes that.

## Part 4 — Create tables + seed shared content in Turso

From this folder (not the browser):

```bash
TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="eyJ..." \
bun run deploy:db
```

This applies the additive schema and **upserts** shared topics, examples, demo tables and
function modules. It does **not** delete users, private programs, favorites or execution
history. It then verifies every seeded example against the engine.

## Part 5 — Provision the owner and claim legacy data

The owner is the account with server-managed `role = OWNER`, identified by
`OWNER_EMAIL`. Legacy non-example programs (created before ownership existed) are assigned
to the owner; ordinary users must not see them. The owner signs in through Clerk with a
verified email or Google; production has no legacy password path.

### Option A — GitHub Actions (recommended; no secrets in chat)

1. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `TURSO_DATABASE_URL` — the `libsql://` URL.
   - `TURSO_AUTH_TOKEN` — a Turso token.
   - `OWNER_EMAIL` — the verified owner email (authoritative).
   No `OWNER_PASSWORD` is needed; Clerk verifies the owner.
   You can add them from a terminal instead (the values are prompted, not written to
   shell history):

   ```bash
   gh secret set TURSO_DATABASE_URL --repo akashgupta221/ABAP-Studio
   gh secret set TURSO_AUTH_TOKEN --repo akashgupta221/ABAP-Studio
   gh secret set OWNER_EMAIL --repo akashgupta221/ABAP-Studio
   ```

2. Open **Actions → Provision owner → Run workflow** and enter:
   - `confirm`: `PROVISION`
   - `owner_username`: `AKASH`

   The owner email comes from the `OWNER_EMAIL` secret so it is not echoed in the
   workflow-dispatch input or logs.

3. The workflow runs `owner:provision` and the read-only `owner:verify`. It fails unless
   exactly one owner exists and every legacy program is claimed. It never prints tokens
   or the owner email.

### Option B — local shell

After a verified backup, run against Turso:

```bash
CONFIRM_OWNER_PROVISION=YES OWNER_USERNAME=AKASH OWNER_EMAIL="owner@example.com" \
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." \
bun run owner:provision
```

The script is idempotent: it creates or updates the owner, claims ownerless non-example
programs, preserves examples as shared/read-only, and invalidates old owner sessions.
If no password is supplied it generates a random one that is never displayed.

The owner signs in through Clerk; no local password is created. Finally verify the result
read-only (same check the workflow runs):

```bash
OWNER_EMAIL="owner@example.com" TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="eyJ..." bun run owner:verify
```

### Live owner acceptance

The P0 and P1 acceptance checks have passed in production. The owner signs in through
Clerk (Email OTP or Google); `/api/auth/me` returns `owner=true`, `/api/admin/overview`
returns `200` and `/admin` loads. Non-owner isolation, suspend/reactivate,
force-logout, deletion, owner program deletion, signed webhook delivery and audit entries
were verified with disposable accounts, then cleaned up. The old
`OWNER_PASSWORD`-based CI checks are historical; **do not re-add that secret**. Use the
Clerk browser checklist in [`docs/CLERK-SETUP.md`](CLERK-SETUP.md).

### Legacy favorites

The old global `Favorite` table was not tied to a user. The new code uses per-user
`UserFavorite` rows and ignores the old table. A production dry-run (run `40111257243`)
found the table empty, so no migration is needed. The guarded workflow and local command
remain available for other databases. Inspect/copy entries to the owner after a backup:

```bash
# dry run
OWNER_USERNAME=AKASH TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." \
bun run owner:favorites

# apply
CONFIRM_LEGACY_FAVORITES=YES APPLY=YES OWNER_USERNAME=AKASH \
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." \
bun run owner:favorites
```

The old table is left intact and the copy is idempotent. Do not assign legacy favorites
to every user — they were never tied to an identity.

## Part 6 — Verify production

1. Sign out, then sign in with Clerk Email OTP or Google.
2. A regular user must see only shared examples, their own programs and their own
   `Z_MY_PRACTICE_<USERNAME>` sandbox.
3. The owner must see all users and all non-example programs in `/admin`, and can delete a
   non-example program after typing its exact name.
4. Check `/api/health`: `dbTarget: turso`, `clerkConfigured: true`,
   `legacyAuthMode: "off"`, expected counts (currently 1 user / 50 programs).
5. Run a syntax check, an execution, a save, a favorite and a logout/login cycle.
6. Confirm anonymous `/api/programs`, `/api/execute` and `/api/admin/overview` return `401`
   or `403`, and legacy `/api/auth/login` / `/api/auth/register` return `403` / `410`.
7. For a Clerk regression, verify Email OTP and Google, owner mapping to `AKASH`, a
   disposable non-owner, suspension (DB suspension + session revocation), force-logout,
   deletion, and signed webhook delivery. See
   [`docs/CLERK-SETUP.md`](CLERK-SETUP.md).

Do not announce new completion until every changed check passes against the deployed build.

---

## Updating the published app later

| What changed | What to run |
| --- | --- |
| UI / code (`src/**`, `scripts/**`) | commit + push → Vercel redeploys |
| Seed content (programs/topics/tables in `scripts/seed-*.ts`) | `bun run deploy:db` again |
| Anything users do in the app | nothing — stored in Turso automatically |
| New schema columns/tables | app's additive `ensureSchema()` runs on first request; `deploy:db` also applies missing tables |

`deploy:db` intentionally never drops or rewrites user-owned data. If a future change
requires a destructive schema operation, add a reviewed migration script and a backup
step instead of changing this guarantee.

## Notes

- Turso free tier: 5 GB storage, 500M row reads + 10M writes/month. Vercel Hobby is for
  personal/non-commercial projects; a learning project qualifies.
- Local development uses `prisma/db/app.db` when `TURSO_*` is unset. The file is ignored
  by Git and created with `bun run db:push`.
- Custom domain: Vercel → Project → Settings → Domains.
- Clerk Email OTP + Google is **live and accepted**. Production owner sign-in, Google
  linking, non-owner isolation, suspend/reactivate/force-logout/delete, owner program
  deletion, signed webhook delivery and audit entries are verified. Password, phone and
  username sign-in are disabled. The legacy scrypt/HMAC path is `off`; the production
  database has one owner and no unmapped accounts. `OWNER_EMAIL` remains authoritative and
  the owner gate is enforced server-side.

## Troubleshooting

- **`Set TURSO_DATABASE_URL...`** — the variables were not set in that terminal; include
  them on the same command line.
- **Site loads but lists are empty** — `deploy:db` was not run, or ran against a different
  database than Vercel is configured to use.
- **Owner cannot open `/admin`** — check the configured identity in Vercel (`OWNER_EMAIL`
  wins when set), the account has `role = OWNER`, the stored email matches exactly, and
  the session was created after provisioning. Run `bun run owner:verify` for a read-only
  diagnosis; re-login after changing the identity.
- **Everyone is logged out after an auth deploy** — expected when sessions are revoked or
  the signing configuration changes. Ask users to sign in once.
- **Legacy programs disappeared for ordinary users** — intended: they are owner-only.
  Run `owner:verify` to confirm exactly one owner and zero unclaimed legacy programs.
- **`AUTH_SECRET must be set in production`** — the dormant legacy code still reads it;
  add the Vercel environment variable and redeploy, or remove the legacy code and the
  requirement together.
- **Clerk sign-in shows no form or no Google button** — confirm the production Clerk keys
  are set in the environment that built the deployment, wait for hydration and reload.
  Password, phone and username sign-in are intentionally disabled; only Email OTP and
  Google should be offered.
- **Clerk session active but no SAP user** — the verified email does not map to an active
  `User` row, or the row is suspended. Check `/admin`; do not re-enable the legacy
  fallback.
- **Owner suspension fails with `app:ban_user`** — expected on Clerk's free plan. The app
  uses database suspension plus Clerk session revocation; native bans are not required.
- **Webhook returns 503** — set `CLERK_WEBHOOK_SECRET` in Vercel and redeploy.
