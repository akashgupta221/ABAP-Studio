export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { testAuthEnabled, testSecretMatches } from '@/lib/test-auth'
import { normalizeUsername, validateUsername } from '@/lib/username'

function hidden(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// POST /api/test/users — create a disposable ordinary user for local/CI tests.
// The client can never choose a role; every test user is a USER.
export async function POST(req: NextRequest) {
  if (!testAuthEnabled()) return hidden()
  if (!testSecretMatches(req.headers.get('x-e2e-secret'))) return hidden()

  const body = (await req.json().catch(() => ({}))) as { username?: unknown }
  if (typeof body.username !== 'string') {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }
  const username = normalizeUsername(body.username)
  const nameError = validateUsername(username)
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })

  await ensureSchema()
  const existing = await db.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: 'Test user already exists' }, { status: 409 })

  const user = await db.user.create({
    data: {
      username,
      // The legacy password column is retained for schema compatibility only.
      passwordHash: '',
      displayName: username,
      role: 'USER',
    },
    select: { id: true, username: true, role: true },
  })
  return NextResponse.json({ user }, { status: 201 })
}
