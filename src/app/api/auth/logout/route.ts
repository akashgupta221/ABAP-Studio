export const dynamic = 'force-dynamic'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clerkServerConfigured } from '@/lib/auth-config'
import { sameOrigin } from '@/lib/session'
import {
  parseTestSessionToken,
  testAuthEnabled,
  TEST_SESSION_COOKIE,
} from '@/lib/test-auth'

// POST /api/auth/logout — revoke the Clerk session, or invalidate the
// disposable test session when the local test broker is explicitly active.
export async function POST(req: NextRequest) {
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  if (testAuthEnabled()) {
    const token = req.cookies.get(TEST_SESSION_COOKIE)?.value
    const session = parseTestSessionToken(token)
    if (session) {
      try {
        await db.user.update({
          where: { id: session.uid },
          data: { sessionVersion: { increment: 1 } },
        })
      } catch {
        // The test user may already be deleted; clearing the cookie is enough.
      }
    }
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

  const hasClerkCookie = req.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith('__session') ||
        cookie.name.startsWith('__client_uat') ||
        cookie.name.startsWith('__clerk'),
    )
  if (clerkServerConfigured() && hasClerkCookie) {
    try {
      const { userId, sessionId } = await auth()
      if (userId && sessionId) {
        const client = await clerkClient()
        await client.sessions.revokeSession(sessionId)
      }
    } catch (error) {
      console.error(
        '[auth/logout] Clerk revocation failed:',
        error instanceof Error ? error.message : error,
      )
      return NextResponse.json(
        { error: 'Could not end the secure session — retry or use the Clerk account menu' },
        { status: 502 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
