export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSessionToken,
  normalizeUsername,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyPassword,
} from '@/lib/auth'

// POST /api/auth/login — check user name + password against the user master
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string }
    const username = normalizeUsername(String(body.username ?? ''))
    const password = String(body.password ?? '')

    if (!username || !password) {
      return NextResponse.json({ error: 'Enter user name and password' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { username } })
    const ok = user ? await verifyPassword(password, user.passwordHash) : false
    if (!user || !ok) {
      return NextResponse.json({ error: 'User name or password is incorrect' }, { status: 401 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const res = NextResponse.json({ user: { username: user.username } })
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.username), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Logon failed — is the database reachable?' }, { status: 500 })
  }
}
