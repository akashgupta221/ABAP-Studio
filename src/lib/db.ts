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
  await addColumn('ExecutionLog', 'errorType', 'TEXT')
  await addColumn('FunctionModule', 'ownerId', 'TEXT')
  await addColumn('FunctionModule', 'active', 'BOOLEAN NOT NULL DEFAULT true')
  await addColumn('FunctionModule', 'createdBy', "TEXT NOT NULL DEFAULT 'SAP'")
  await addColumn('FunctionModule', 'changedBy', "TEXT NOT NULL DEFAULT ''")
  await addColumn('FunctionModule', 'changedOn', "TEXT NOT NULL DEFAULT ''")
  await addColumn('FunctionModule', 'exceptions', "TEXT NOT NULL DEFAULT '[]'")

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FunctionGroup" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "shortText" TEXT NOT NULL DEFAULT '',
      "isExample" BOOLEAN NOT NULL DEFAULT false,
      "ownerId" TEXT,
      "createdBy" TEXT NOT NULL DEFAULT 'SAP',
      "changedOn" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
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

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MessageClass" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "messages" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TransactionCode" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "code" TEXT NOT NULL,
      "program" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NumberRange" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "object" TEXT NOT NULL,
      "shortText" TEXT NOT NULL DEFAULT '',
      "fromNumber" INTEGER NOT NULL,
      "toNumber" INTEGER NOT NULL,
      "currentNumber" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppServerFile" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "path" TEXT NOT NULL,
      "content" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RfcDestination" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "target" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApplicationLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "object" TEXT NOT NULL,
      "externalNumber" TEXT NOT NULL DEFAULT '',
      "messages" TEXT NOT NULL DEFAULT '[]',
      "createdBy" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SystemLog" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "type" TEXT NOT NULL DEFAULT 'INFO',
      "text" TEXT NOT NULL,
      "userName" TEXT NOT NULL DEFAULT '',
      "program" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BackgroundJob" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "report" TEXT NOT NULL,
      "parameters" TEXT NOT NULL DEFAULT '{}',
      "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "scheduledAt" DATETIME NOT NULL,
      "startedAt" DATETIME,
      "finishedAt" DATETIME,
      "resultStatus" TEXT NOT NULL DEFAULT '',
      "resultLog" TEXT NOT NULL DEFAULT '[]',
      "resultError" TEXT NOT NULL DEFAULT '',
      "createdBy" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QueryInfoset" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "baseTable" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QueryDef" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "infoset" TEXT NOT NULL,
      "fields" TEXT NOT NULL DEFAULT '[]',
      "filters" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TransportRequest" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "reqId" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "type" TEXT NOT NULL DEFAULT 'WORKBENCH',
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "entries" TEXT NOT NULL DEFAULT '[]',
      "createdBy" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "releasedAt" DATETIME,
      "importedAt" DATETIME
    )
  `)
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "MessageClass_name_key" ON "MessageClass"("name")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "TransactionCode_code_key" ON "TransactionCode"("code")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NumberRange_object_key" ON "NumberRange"("object")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "AppServerFile_path_key" ON "AppServerFile"("path")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "RfcDestination_name_key" ON "RfcDestination"("name")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "QueryInfoset_name_key" ON "QueryInfoset"("name")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "QueryDef_name_key" ON "QueryDef"("name")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "TransportRequest_reqId_key" ON "TransportRequest"("reqId")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "TransactionCode_code_key" ON "TransactionCode"("code")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NumberRange_object_key" ON "NumberRange"("object")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "AppServerFile_path_key" ON "AppServerFile"("path")')
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "RfcDestination_name_key" ON "RfcDestination"("name")')

  const statements = [
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkId_key" ON "User"("clerkId")',
    'CREATE INDEX IF NOT EXISTS "Program_ownerId_idx" ON "Program"("ownerId")',
    'CREATE INDEX IF NOT EXISTS "ExecutionLog_userId_idx" ON "ExecutionLog"("userId")',
    'CREATE UNIQUE INDEX IF NOT EXISTS "FunctionGroup_name_key" ON "FunctionGroup"("name")',
    'CREATE INDEX IF NOT EXISTS "FunctionGroup_ownerId_idx" ON "FunctionGroup"("ownerId")',
    'CREATE INDEX IF NOT EXISTS "FunctionModule_ownerId_idx" ON "FunctionModule"("ownerId")',
    'CREATE INDEX IF NOT EXISTS "FunctionModule_groupName_idx" ON "FunctionModule"("groupName")',
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
