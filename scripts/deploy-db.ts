// Push the Prisma schema + seed content to a remote Turso (libSQL) database.
//
// Usage:
//   TURSO_DATABASE_URL="libsql://your-db-yourname.turso.io" \
//   TURSO_AUTH_TOKEN="..." \
//   bun run deploy:db
//
// What it does:
//   1. generates CREATE TABLE DDL from prisma/schema.prisma (offline)
//   2. applies additive schema changes to the remote database (idempotent),
//      including new columns on tables that already exist in an older shape
//   3. seeds/upserts example content without deleting users or their programs
import { execSync } from 'node:child_process'
import { createClient, type Client } from '@libsql/client/web'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

function safeHost(value: string): string {
  try {
    return new URL(value.replace('libsql://', 'https://')).host
  } catch {
    return 'configured-remote'
  }
}

// Never print the full database URL: it can contain a database name and is
// copied into public workflow logs. The host alone is already exposed by the
// public /api/health endpoint.

// 1) DDL from the Prisma schema (no DB connection needed), rewritten to
//    IF NOT EXISTS so repeat runs only create what is missing.
export function buildIdempotentDdl(): string {
  const ddl = execSync(
    'bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8' },
  )
  return ddl
    .replace(/CREATE TABLE "([^"]+)"/g, 'CREATE TABLE IF NOT EXISTS "$1"')
    .replace(/CREATE UNIQUE INDEX "([^"]+)"/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "$1"')
    .replace(/CREATE INDEX "([^"]+)"/g, 'CREATE INDEX IF NOT EXISTS "$1"')
}

export type ColumnPatch = { table: string; column: string; def: string }

// Parse every column definition out of the DDL so existing tables can be
// brought to the same shape with ALTER TABLE. CREATE TABLE IF NOT EXISTS never
// touches a table that already exists, so without this step any new index on a
// new column fails with "no such column" against a database deployed from an
// older schema.
export function parseColumnsFromDdl(script: string): ColumnPatch[] {
  const patches: ColumnPatch[] = []
  for (const [, table, body] of script.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)" \(([\s\S]*?)\n\);/g,
  )) {
    // Table-constraint FOREIGN KEY clauses re-attach to their column on ALTER
    // so ON DELETE cascades also protect rows written to the added column.
    const references = new Map<string, string>()
    for (const [, column, ref] of body.matchAll(/FOREIGN KEY \("([^"]+)"\) (REFERENCES [^,\n]+)/g)) {
      references.set(column, ` ${ref.trim()}`)
    }
    for (const line of body.split('\n')) {
      const match = line.match(/^\s*"([^"]+)"\s+(.+?)\s*,?\s*$/)
      if (!match) continue
      const [, column, raw] = match
      if (/PRIMARY KEY\b/.test(raw)) continue
      let def = raw
      if (/DEFAULT\s+(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)\b/i.test(def) || /DEFAULT\s*\(/.test(def)) {
        // SQLite refuses non-constant defaults on ADD COLUMN; the Prisma
        // client supplies these values itself, so the DB-level default is
        // optional. NOT NULL must go with it: it needs a constant default.
        def = def
          .replace(/\s*DEFAULT\s+(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)\b/i, '')
          .replace(/\s*DEFAULT\s*\([^)]*\)/, '')
          .replace(/\s*NOT NULL\b/, '')
      } else if (/NOT NULL\b/.test(def) && !/\bDEFAULT\b/.test(def)) {
        // NOT NULL without any default cannot be added to a populated table.
        def = def.replace(/\s*NOT NULL\b/, '')
      }
      patches.push({ table, column, def: `"${column}" ${def}${references.get(column) ?? ''}` })
    }
  }
  return patches
}

// Ensure every table named in the DDL has every column the schema expects.
// Tables that do not exist yet are skipped — the DDL creates them complete.
// Returns how many columns were added.
export async function syncColumns(client: Client, ddl: string): Promise<number> {
  const byTable = new Map<string, ColumnPatch[]>()
  for (const patch of parseColumnsFromDdl(ddl)) {
    const list = byTable.get(patch.table) ?? []
    list.push(patch)
    byTable.set(patch.table, list)
  }
  let added = 0
  for (const [table, list] of byTable) {
    const info = await client.execute({
      sql: 'SELECT name FROM pragma_table_info(?)',
      args: [table],
    })
    const columns = new Set(info.rows.map((row) => String(row.name)))
    if (columns.size === 0) continue
    for (const { column, def } of list) {
      if (columns.has(column)) continue
      await client.execute({ sql: `ALTER TABLE "${table}" ADD COLUMN ${def}`, args: [] })
      columns.add(column)
      added += 1
      console.log(`  added ${table}.${column}`)
    }
  }
  return added
}

async function main() {
  if (!url || !url.startsWith('libsql://')) {
    console.error('Set TURSO_DATABASE_URL="libsql://..." (and TURSO_AUTH_TOKEN) first — see DEPLOY.md.')
    process.exit(1)
  }

  console.log(`Target database: ${safeHost(url)} (Turso/libSQL)`)

  // 1) DDL from the Prisma schema (no DB connection needed)
  const idempotent = buildIdempotentDdl()

  const client = createClient({ url, authToken })
  try {
    // 2) bring existing tables up to the current column set, then apply the
    //    idempotent DDL (tables/indexes ensured)
    const addedColumns = await syncColumns(client, idempotent)
    console.log(
      addedColumns
        ? `Column sync complete (${addedColumns} column(s) added to existing tables).`
        : 'Existing tables already have all schema columns.',
    )
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
}

if (import.meta.main) {
  await main()
}
