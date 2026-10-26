export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  validateUsername,
} from '@/lib/auth'
import { clientKey, rateLimit, sameOrigin, serverError } from '@/lib/session'
import { legacyRegistrationEnabled } from '@/lib/auth-mode'

// POST /api/auth/register — local/test fallback only. Public registration is
// handled by Clerk after the cutover; role is never read from input.
export async function POST(req: NextRequest) {
  if (!legacyRegistrationEnabled()) {
    return NextResponse.json(
      { error: 'New accounts use Clerk secure sign-up — open /sign-up' },
      { status: 410 },
    )
  }

  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const limited = rateLimit(clientKey(req, 'register'), 5, 60_000)
    if (limited) return limited

    const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string }
    const username = normalizeUsername(String(body.username ?? ''))
    const password = String(body.password ?? '')

    const nameError = validateUsername(username)
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: 'Password must have 8–200 characters' }, { status: 400 })
    }

    await ensureSchema()
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json(
        { error: `User ${username} already exists — log on instead` },
        { status: 409 },
      )
    }

    const created = await db.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        lastLoginAt: new Date(),
        role: 'USER',
      },
    })

    const res = NextResponse.json({ user: { username: created.username, role: created.role } })
    res.cookies.set(SESSION_COOKIE, createSessionToken(created.id, created.username, created.sessionVersion), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
    return res
  } catch (error) {
    return serverError('auth/register', error)
  }
}
