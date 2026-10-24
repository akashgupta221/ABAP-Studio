# Publish ABAP-Studio for free (Vercel + Turso)

What this gives you:

- a public URL such as `https://abap-studio-rd9d.vercel.app`
- **automatic updates** on every `git push`
- a free Turso database with **per-user accounts, private programs, favorites and
  execution history**
- an owner-only administration dashboard

Everything is free: Vercel **Hobby** + Turso **free**. No credit card needed.

> **Current production status:** v0.3 is deployed and the anonymous API is closed. Owner
> provisioning has run: `AKASH` has `role = OWNER`, the 12 legacy programs are claimed,
> no legacy programs are unclaimed, and the Vercel owner gate is verified. The read-only
> **Verify production** and controlled **Verify production isolation** checks pass; the
> production legacy-favorites table is verified empty. See §1.6 and §4.2 of
> [`docs/MASTER-PROJECT-SPEC.md`](MASTER-PROJECT-SPEC.md). Remaining: browser/UI sign-off,
> UI/accessibility automation, and final acceptance.

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
   | `AUTH_SECRET` | long random value — `openssl rand -base64 32` |
   | `OWNER_EMAIL` | the verified owner email (authoritative when set) |
   | `OWNER_USERNAME` | interim fallback: the single owner account name (e.g. `AKASH`) |

   `AUTH_SECRET` is required in production: the app refuses to sign sessions with a
   public development fallback. Owner recognition fails closed if neither owner identity
   is configured. If both are set, `OWNER_EMAIL` wins and must match the email stored on
   the `OWNER` row.

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
`OWNER_EMAIL` (or `OWNER_USERNAME` until Clerk is integrated). Legacy non-example
programs (created before ownership existed) are assigned to the owner; ordinary users
must not see them.

### Option A — GitHub Actions (recommended; no secrets in chat)

1. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `TURSO_DATABASE_URL` — the `libsql://` URL.
   - `TURSO_AUTH_TOKEN` — a Turso token.
   - `OWNER_EMAIL` — the verified owner email (recommended; authoritative when set).
   - `OWNER_PASSWORD` — optional but recommended: a fresh owner password you have not
     used anywhere else. GitHub masks it in logs; delete the secret after the run.
   You can add them from a terminal instead (the values are prompted, not written to
   shell history):

   ```bash
   gh secret set TURSO_DATABASE_URL --repo akashgupta221/ABAP-Studio
   gh secret set TURSO_AUTH_TOKEN --repo akashgupta221/ABAP-Studio
   gh secret set OWNER_EMAIL --repo akashgupta221/ABAP-Studio
   gh secret set OWNER_PASSWORD --repo akashgupta221/ABAP-Studio
   ```

2. Open **Actions → Provision owner → Run workflow** and enter:
   - `confirm`: `PROVISION`
   - `owner_username`: `AKASH`

   The owner email comes from the `OWNER_EMAIL` secret so it is not echoed in the
   workflow-dispatch input or logs.

3. The workflow runs `owner:provision` and the read-only `owner:verify`. It fails unless
   exactly one owner exists and every legacy program is claimed. It never prints tokens
   or the password. Delete the temporary `OWNER_PASSWORD` secret afterward; if you omitted
   it, set the password locally with the command below.

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

Set the real owner password with hidden input (no shell history, no chat):

```bash
CONFIRM_OWNER_PASSWORD=YES OWNER_USERNAME=AKASH \
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." \
bun run owner:password
```

Finally verify the result read-only (same check the workflow runs):

```bash
OWNER_EMAIL="owner@example.com" TURSO_DATABASE_URL="libsql://..." \
TURSO_AUTH_TOKEN="eyJ..." bun run owner:verify
```

### Live owner acceptance

After setting the Vercel owner environment and redeploying, run **Actions → Verify
production**. It logs in with the `OWNER_PASSWORD` repository secret, checks
`/api/auth/me` (`owner=true`), `/api/admin/overview` (`200`) and `/admin` (`200`), and
prints only counts. It never prints the password, cookie or email. Then run **Actions →
Verify production isolation** with `confirm=ISOLATION`; it creates one temporary regular
user, checks owner/regular-user isolation, revocation, suspension and deletion, and
deletes that same user. Delete the temporary `OWNER_PASSWORD` secret after both checks
and the owner's browser review pass.

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

1. Sign out, then sign in once. Old cookies are intentionally invalid.
2. A regular user must see only shared examples, their own programs and their own
   `Z_MY_PRACTICE_<USERNAME>` sandbox.
3. The owner must see all users and all non-example programs in `/admin`.
4. Check `/api/health`: `dbTarget: turso`, `hasAuthSecret: true`, expected counts.
5. Run a syntax check, an execution, a save, a favorite and a logout/login cycle.
6. Confirm anonymous `/api/programs`, `/api/execute` and `/api/admin/overview` return `401`
   or `403`.

Do not announce completion until every check passes against the deployed build.

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
- Clerk Email OTP + Google is **not** integrated yet; the built-in user master is the
  interim authentication method. `OWNER_EMAIL` is already accepted by the owner gate so
  the Clerk migration can keep the same server-side owner check.

## Troubleshooting

- **`Set TURSO_DATABASE_URL...`** — the variables were not set in that terminal; include
  them on the same command line.
- **Site loads but lists are empty** — `deploy:db` was not run, or ran against a different
  database than Vercel is configured to use.
- **Owner cannot open `/admin`** — check the configured identity in Vercel (`OWNER_EMAIL`
  wins when set), the account has `role = OWNER`, the stored email matches exactly, and
  the session was created after provisioning. Run `bun run owner:verify` for a read-only
  diagnosis; re-login after changing the identity.
- **Everyone is logged out after deploy** — expected for v0.3: cookies now carry a
  database session version and old cookies lack it. Ask users to log on once.
- **Legacy programs disappeared for ordinary users** — intended: they are owner-only.
  Provisioning has already claimed 12 programs for the owner; run `owner:verify` to
  confirm exactly one owner and zero unclaimed legacy programs.
- **`AUTH_SECRET must be set in production`** — add the Vercel environment variable and
  redeploy.
