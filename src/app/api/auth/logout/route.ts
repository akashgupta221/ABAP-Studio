export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { sameOrigin } from '@/lib/session'

// POST /api/auth/logout — revoke the session server-side and clear the cookie.
// Bumping sessionVersion invalidates the token even if the browser retained a copy.
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? parseSessionToken(token) : null

  if (session) {
    try {
      await db.user.update({
        where: { id: session.uid },
        data: { sessionVersion: { increment: 1 } },
      })
    } catch {
      // User may already be deleted; clearing the cookie is still correct.
    }
  }

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
