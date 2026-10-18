export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  validateUsername,
} from '@/lib/auth'

// POST /api/auth/register — create a user master record and log on
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string }
    const username = normalizeUsername(String(body.username ?? ''))
    const password = String(body.password ?? '')

    const nameError = validateUsername(username)
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 })
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must have at least 6 characters' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json(
        { error: `User ${username} already exists — log on instead` },
        { status: 409 },
      )
    }

    const created = await db.user.create({
      data: { username, passwordHash: await hashPassword(password), lastLoginAt: new Date() },
    })

    const res = NextResponse.json({ user: { username: created.username } })
    res.cookies.set(SESSION_COOKIE, createSessionToken(created.id, created.username), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Registration failed — is the database reachable?' }, { status: 500 })
  }
}
