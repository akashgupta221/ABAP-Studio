export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import {
  createSessionToken,
  normalizeUsername,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyPassword,
} from '@/lib/auth'
import { clientKey, isOwner, rateLimit, sameOrigin, serverError } from '@/lib/session'
import { legacyLoginEnabled } from '@/lib/auth-mode'

// POST /api/auth/login — temporary legacy fallback during the Clerk cutover
export async function POST(req: NextRequest) {
  if (!legacyLoginEnabled()) {
    return NextResponse.json(
      { error: 'Legacy logon is disabled — use the secure Clerk sign-in' },
      { status: 403 },
    )
  }

  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const limited = rateLimit(clientKey(req, 'login'), 8, 60_000)
    if (limited) return limited

    const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string }
    const username = normalizeUsername(String(body.username ?? ''))
    const password = String(body.password ?? '')

    if (!username || !password) {
      return NextResponse.json({ error: 'Enter user name and password' }, { status: 400 })
    }
    if (username.length > 20 || password.length > 200) {
      return NextResponse.json({ error: 'User name or password is incorrect' }, { status: 401 })
    }

    await ensureSchema()
    const user = await db.user.findUnique({ where: { username } })
    const ok = user ? await verifyPassword(password, user.passwordHash) : false
    if (!user || !ok) {
      return NextResponse.json({ error: 'User name or password is incorrect' }, { status: 401 })
    }
    if (user.suspended) {
      return NextResponse.json(
        { error: 'This user master record is locked — contact the system administrator' },
        { status: 403 },
      )
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const res = NextResponse.json({
      user: { username: user.username, role: user.role, owner: isOwner(user) },
    })
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.username, user.sessionVersion), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
    return res
  } catch (error) {
    return serverError('auth/login', error)
  }
}
