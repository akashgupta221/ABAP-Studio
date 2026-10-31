# Running ABAP Atelier — setup, environment & deployment notes

> Private operational notes for the ABAP Atelier repository. The public README is a
> showcase; this file keeps the practical "run it yourself" instructions.

## Quick start (local)

```bash
# 1) Clone
git clone https://github.com/akashgupta221/ABAP-Studio.git
cd ABAP-Studio

# 2) Install dependencies (also runs prisma generate)
bun install

# 3) Configure the environment
cp .env.example .env.local        # then fill in the values (table below)

# 4) Create the local database schema
bunx prisma db push

# 5) Run
bun run dev                       # → http://localhost:3000
```

The shared curriculum seeds itself automatically on the first request — demo tables,
examples and FMs are already there. Sign in once so your Clerk identity links to a
database row.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local | SQLite file path — `file:./db/app.db` (relative to `prisma/`) |
| `TURSO_DATABASE_URL` | Vercel + shell | libSQL URL of the production Turso database (`libsql://…`) |
| `TURSO_AUTH_TOKEN` | Vercel + shell | Turso access token |
| `OWNER_EMAIL` | Vercel + provisioning | Authoritative owner identity; must match the verified email on the `OWNER` row. Required in production |
| `OWNER_USERNAME` | local only | Non-production/unit-test fallback; rejected on Vercel and in production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel + local | Clerk browser key (`pk_live_…` in production) |
| `CLERK_SECRET_KEY` | Vercel + local | Clerk server key (`sk_live_…`); never expose |
| `CLERK_WEBHOOK_SECRET` | Vercel | Signing secret for `/api/webhooks/clerk` |
| `E2E_TEST_MODE` / `E2E_TEST_SECRET` | test runners only | Disposable test-session broker; never set in Vercel or against real data |

Never commit real values — `.env*` is git-ignored. `AUTH_SECRET` and the legacy
`NEXT_PUBLIC_LEGACY_AUTH_MODE` flag are no longer read and can be removed from old
deployments.

## Testing

| Suite | Command | What it covers |
| --- | --- | --- |
| Unit | `bun run test` | Engine, parser, filters, provisioning logic |
| API security | `bun run test:api` | Live server on :3100 — authentication, CSRF, tenant isolation, rate limits, session revocation |
| UI + a11y | `bun run test:ui` | Playwright on :3101 — public pages, SE38/SE37 flows, debugger, dashboard, **axe scans failing on serious/critical** |

```bash
bun run test:all   # lint + typecheck + unit + api + ui
```

## Deploy free (Vercel + Turso)

1. Push the repo to GitHub and import it in **Vercel** (the Hobby plan works)
2. Create a free **Turso** database and set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Vercel
3. Configure the **Clerk** instance and keys, plus `OWNER_EMAIL`
4. Apply the schema — additive and idempotent, safe to re-run:
   ```bash
   bun run deploy:db          # from a shell with the Turso env set
   ```
   The repo also ships a **"Deploy database"** GitHub workflow that applies schema
   changes after each release.
5. Every push to `main` auto-deploys to production

Full walkthrough: [DEPLOY.md](DEPLOY.md).

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Dev server on port 3000 |
| `bun run build` / `start` | Production build (standalone) / serve it |
| `bun run seed` | Non-destructive content upsert + engine verification |
| `bun run deploy:db` | Apply additive schema + upsert content on Turso |
| `bun run owner:provision` / `owner:verify` | Assign & audit the owner account |
| `bun run test` / `test:api` / `test:ui` / `test:all` | Test suites |
| `bun run lint` / `typecheck` | ESLint / `tsc --noEmit` |

## Issues

Found a problem? [Open an issue](https://github.com/akashgupta221/ABAP-Studio/issues).

---

© 2026 Akash Gupta. **All rights reserved.** ABAP Atelier is an independent training
simulator — not affiliated with or endorsed by SAP SE.
