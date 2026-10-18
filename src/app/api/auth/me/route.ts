export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { parseSessionToken, SESSION_COOKIE } from '@/lib/auth'

// GET /api/auth/me — current session user (null when not logged on)
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = token ? parseSessionToken(token) : null
  return NextResponse.json({ user: session ? { username: session.user } : null })
}
