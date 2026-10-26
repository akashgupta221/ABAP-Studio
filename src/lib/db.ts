import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql/web'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Cloud deploy (Vercel + Turso): when TURSO_DATABASE_URL is set, Prisma talks to the
// hosted libSQL database over HTTP. Local dev leaves it unset and keeps using
// prisma/db/app.db exactly as before.
const tursoUrl = process.env.TURSO_DATABASE_URL

function createClient(): PrismaClient {
  // Verbose query logging is a dev-only aid; keep production (Vercel etc.) quiet.
  const log: ('query' | 'error')[] =
    process.env.NODE_ENV === 'production' ? ['error'] : ['query']

  if (tursoUrl) {
    // Prisma still validates env("DATABASE_URL") from the schema when a driver
    // adapter is used — point it at the same database to keep schema checks happy.
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = tursoUrl
    return new PrismaClient({
      adapter: new PrismaLibSQL({
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
      log,
    })
  }

  return new PrismaClient({ log })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ── Additive, idempotent schema migration ──────────────────────────────
// The free deployment cannot run `prisma migrate deploy` during a Vercel
// build, and production credentials are owner-controlled. This upgrade path
// only ADDS columns/tables/indexes; it never drops or rewrites user data.
// It is cached per process, and safe to race across serverless instances.
let schemaPromise: Promise<void> | null = null

async function columnsOf(table: string): Promise<Set<string>> {
  const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`)
  return new Set(rows.map((r) => r.name))
}

async function addColumn(table: string, column: string, definition: string): Promise<void> {
  const columns = await columnsOf(table)
  if (columns.has(column)) return
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`)
  } catch (error) {
    // Another cold-start instance may have won the race.
    const message = error instanceof Error ? error.message : String(error)
    if (!/duplicate column name|already exists/i.test(message)) throw error
  }
}

async function migrateSchema(): Promise<void> {
  if (process.env.SKIP_AUTO_MIGRATE === '1') return

  await addColumn('User', 'email', 'TEXT')
  await addColumn('User', 'clerkId', 'TEXT')
  await addColumn('User', 'role', "TEXT NOT NULL DEFAULT 'USER'")
  await addColumn('User', 'suspended', 'BOOLEAN NOT NULL DEFAULT false')
  await addColumn('User', 'sessionVersion', 'INTEGER NOT NULL DEFAULT 1')
  await addColumn('Program', 'ownerId', 'TEXT')
  await addColumn('Program', 'environment', "TEXT NOT NULL DEFAULT 'STANDARD'")
  await addColumn('Program', 'modernKind', "TEXT NOT NULL DEFAULT 'ABAP'")
  await addColumn('ExecutionLog', 'userId', 'TEXT')

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserFavorite" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "userId" TEXT NOT NULL,
      "objectType" TEXT NOT NULL,
      "objectName" TEXT NOT NULL,
      "label" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "actorId" TEXT NOT NULL,
      "actorName" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetType" TEXT NOT NULL DEFAULT '',
      "targetId" TEXT NOT NULL DEFAULT '',
      "detail" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const statements = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId")',
    'CREATE INDEX IF NOT EXISTS "Program_ownerId_idx" ON "Program"("ownerId")',
    'CREATE INDEX IF NOT EXISTS "ExecutionLog_userId_idx" ON "ExecutionLog"("userId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_objectType_objectName_key" ON "UserFavorite"("userId", "objectType", "objectName")',
    'CREATE INDEX IF NOT EXISTS "UserFavorite_userId_idx" ON "UserFavorite"("userId")',
    'CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_idx" ON "AdminAuditLog"("action")',
  ]
  for (const sql of statements) {
    await db.$executeRawUnsafe(sql).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!/already exists/i.test(message)) throw error
    })
  }
}

/** Wait for the additive schema upgrade. Safe and cheap after the first call. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = migrateSchema().catch((error) => {
      schemaPromise = null
      console.error('[schema] additive migration failed:', error instanceof Error ? error.message : error)
      throw error
    })
  }
  return schemaPromise
}
