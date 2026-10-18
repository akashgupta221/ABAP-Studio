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
