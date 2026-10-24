export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, isOwner } from '@/lib/session'

// GET /api/auth/me — current session user (null when not logged on)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  return NextResponse.json({
    user: user
      ? { username: user.username, role: user.role, owner: isOwner(user) }
      : null,
  })
}
