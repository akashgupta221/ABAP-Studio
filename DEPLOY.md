# Publish ABAPForge for free (Vercel + Turso)

What this gives you:

- a public URL like `https://abapforge.vercel.app`
- **automatic updates**: every `git push` rebuilds and redeploys the live app
- a free cloud database (Turso) shared by all visitors — programs you save, favorites
  and execution logs persist there

Everything is free: Vercel **Hobby** plan + Turso **free** plan. No credit card needed.

---

## Part 1 — Put the code on GitHub

1. Create an empty repository on github.com (name: `abapforge`, private is fine).
2. In this folder, run:

```bash
git remote add origin https://github.com/<you>/abapforge.git
git push -u origin main
```

## Part 2 — Create the free Turso database

1. Go to turso.tech → **Sign in with GitHub**.
2. **Create Database** → name `abapforge` → pick the region closest to you.
3. Open the database → **Connect** tab shows the URL (`libsql://...`).
4. Click **Create Token** and copy it.

Keep the URL and the token — you need both in Parts 3 and 4.

<!-- CLI alternative:
turso db create abapforge
turso db show abapforge --url
turso db tokens create abapforge
-->

## Part 3 — Deploy on Vercel

1. Go to vercel.com → **Sign up with GitHub**.
2. **Add New → Project → Import** the `abapforge` repository.
3. Framework preset is detected automatically (**Next.js**) — leave build settings alone.
4. Under **Environment Variables**, add all three:

   | Name                 | Value                |
   | -------------------- | -------------------- |
   | `TURSO_DATABASE_URL` | `libsql://...` (Part 2) |
   | `TURSO_AUTH_TOKEN`   | the token (Part 2)   |
   | `AUTH_SECRET`        | any long random string — generate with `openssl rand -base64 32`. Used to sign logon sessions (user master). |

5. Click **Deploy**. The site opens — but the database is still empty. Part 4 fixes that.

## Part 4 — Create tables + seed content in Turso (one command)

From this folder (not the browser):

```bash
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." bun run deploy:db
```

This creates the schema, seeds all programs / topics / demo tables, and verifies every
example program against the engine. Reload the deployed site — done.

---

## Updating the published app later

| What changed | What to run |
| --- | --- |
| UI / code (`src/**`, `scripts/**`) | `git add -A && git commit -m "..." && git push` → Vercel redeploys automatically (1–2 min) |
| Seed content (programs, topics, tables in `scripts/seed-*.ts`) | `bun run deploy:db` again (with the env vars) → refresh the site |
| Anything users do in the app (saved programs, favorites, logs) | nothing — stored in Turso automatically |

## Notes

- Free limits: Turso free = 5 GB storage, 500M row reads + 10M writes per month, no cold
  starts. Vercel Hobby is for personal / non-commercial projects — a learning project
  qualifies.
- Custom domain: Vercel → Project → Settings → Domains (subdomains are free on
  `*.vercel.app`; a custom domain costs ~$10/year unless you have GitHub Student Pack).
- Local development is unchanged: without `TURSO_*` variables the app uses
  `prisma/db/app.db`.

## Troubleshooting

- `Set TURSO_DATABASE_URL...` → the variables were not set in that terminal; paste them
  in the same command line as in Part 4.
- Site loads but lists are empty → `deploy:db` was not run yet, or ran against a
  different database than the one configured in Vercel.
- Schema changes later: edit `prisma/schema.prisma`, re-run `deploy:db` (new tables are
  created). New **columns** on existing tables need a manual `ALTER TABLE` via Turso's
  dashboard / shell — the script never drops or alters existing tables on purpose.
