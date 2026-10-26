export const dynamic = 'force-dynamic'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { clerkServerConfigured } from '@/lib/auth-mode'
import { sameOrigin } from '@/lib/session'

// POST /api/auth/logout — revoke the Clerk session when present, bump the
// legacy session version, and clear the legacy cookie.
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  const hasClerkCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('__session') || cookie.name.startsWith('__client_uat') || cookie.name.startsWith('__clerk'))
  if (clerkServerConfigured() && hasClerkCookie) {
    try {
      const { userId, sessionId } = await auth()
      if (userId && sessionId) {
        const client = await clerkClient()
        await client.sessions.revokeSession(sessionId)
      }
    } catch (error) {
      console.error('[auth/logout] Clerk revocation failed:', error instanceof Error ? error.message : error)
      return NextResponse.json(
        { error: 'Could not end the secure session — retry or use the Clerk account menu' },
        { status: 502 },
      )
    }
  }

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
