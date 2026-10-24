// Push the Prisma schema + seed content to a remote Turso (libSQL) database.
//
// Usage:
//   TURSO_DATABASE_URL="libsql://your-db-yourname.turso.io" \
//   TURSO_AUTH_TOKEN="..." \
//   bun run deploy:db
//
// What it does:
//   1. generates CREATE TABLE DDL from prisma/schema.prisma (offline)
//   2. applies additive schema changes to the remote database (idempotent)
//   3. seeds/upserts example content without deleting users or their programs
import { execSync } from 'node:child_process'
import { createClient } from '@libsql/client/web'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('Set TURSO_DATABASE_URL="libsql://..." (and TURSO_AUTH_TOKEN) first — see DEPLOY.md.')
  process.exit(1)
}

console.log(`Target database: ${url}`)

// 1) DDL from the Prisma schema (no DB connection needed)
const ddl = execSync(
  'bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { encoding: 'utf8' },
)

// 2) apply to Turso — rewritten to IF NOT EXISTS so repeat runs only create what is missing
const idempotent = ddl
  .replace(/CREATE TABLE "([^"]+)"/g, 'CREATE TABLE IF NOT EXISTS "$1"')
  .replace(/CREATE UNIQUE INDEX "([^"]+)"/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "$1"')
  .replace(/CREATE INDEX "([^"]+)"/g, 'CREATE INDEX IF NOT EXISTS "$1"')

const client = createClient({ url, authToken })
try {
  await client.executeMultiple(idempotent)
  console.log('Schema applied (tables/indexes ensured).')

  // 3) seed + verify — the seed script picks up TURSO_* from the environment and
  //    writes to the remote database instead of the local file. DATABASE_URL is
  //    pinned to the remote too so no .env value can ever redirect the writes.
  execSync('bun run scripts/run-seed.ts', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken },
  })

  console.log('\nDone. The deployed app now reads this database.')
} finally {
  client.close()
}
