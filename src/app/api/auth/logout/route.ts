export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

// POST /api/auth/logout — end the session (clear the cookie)
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
