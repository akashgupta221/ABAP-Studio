export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { isOwner } from '@/lib/session'
import {
  createTestSessionToken,
  testAuthEnabled,
  testSecretMatches,
  TEST_SESSION_COOKIE,
  TEST_SESSION_TTL_MS,
} from '@/lib/test-auth'
import { normalizeUsername } from '@/lib/username'

function hidden(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// POST /api/test/session — mint a disposable test cookie. Never available on
// Vercel/Turso or without the per-run test secret.
export async function POST(req: NextRequest) {
  if (!testAuthEnabled()) return hidden()
  if (!testSecretMatches(req.headers.get('x-e2e-secret'))) return hidden()

  const body = (await req.json().catch(() => ({}))) as {
    username?: unknown
    userId?: unknown
  }
  const userId = typeof body.userId === 'string' ? body.userId : null
  const username = typeof body.username === 'string' ? normalizeUsername(body.username) : null
  if (!userId && !username) {
    return NextResponse.json({ error: 'username or userId is required' }, { status: 400 })
  }

  await ensureSchema()
  const user = await db.user.findUnique({
    where: userId ? { id: userId } : { username: username ?? '' },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      suspended: true,
      sessionVersion: true,
    },
  })
  if (!user) return NextResponse.json({ error: 'Test user not found' }, { status: 404 })
  if (user.suspended) return NextResponse.json({ error: 'Test user is suspended' }, { status: 403 })

  const token = createTestSessionToken(user.id, user.sessionVersion)
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      owner: isOwner(user),
    },
  })
  res.cookies.set(TEST_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: Math.floor(TEST_SESSION_TTL_MS / 1000),
  })
  return res
}

// DELETE /api/test/session — clear the test cookie (does not revoke server-side).
export async function DELETE() {
  if (!testAuthEnabled()) return hidden()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(TEST_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  })
  return res
}
