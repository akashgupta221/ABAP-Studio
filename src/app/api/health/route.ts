export const dynamic = 'force-dynamic' // never cached — reflects the current deployment's config

import { NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { clerkServerConfigured, legacyAuthMode } from '@/lib/auth-mode'

// GET /api/health — deployment diagnostics. Reports which database this deployment
// targets, whether the credentials/tables are present, and the raw connection
// error if unreachable. Contains no secret values (only booleans + host name).
export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? ''

  const info = {
    dbTarget: tursoUrl ? 'turso' : 'local-sqlite',
    tursoHost: tursoUrl ? safeHost(tursoUrl) : null,
    hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
    hasDatasourceUrl: Boolean(process.env.DATABASE_URL),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
    hasClerkPublishableKey: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    hasClerkWebhookSecret: Boolean(
      process.env.CLERK_WEBHOOK_SECRET ?? process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    ),
    clerkConfigured: clerkServerConfigured(),
    legacyAuthMode: legacyAuthMode(),
  }

  try {
    await ensureSchema()
    const [users, programs] = await Promise.all([db.user.count(), db.program.count()])
    return NextResponse.json({ ok: true, ...info, users, programs })
  } catch (err) {
    console.error('[health]', err)
    return NextResponse.json(
      { ok: false, ...info, error: 'Database unreachable or schema upgrade failed' },
      { status: 500 },
    )
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url.replace(/^libsql:/, 'https:')).host
  } catch {
    return 'unparseable'
  }
}
