export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, serverError } from '@/lib/session'

// GET /api/recents — this user's recent executions (like SAP recent objects)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    const logs = await db.executionLog.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    // dedupe by program name, keep latest
    const seen = new Set<string>()
    const recents = logs
      .filter((l) => {
        if (seen.has(l.programName)) return false
        seen.add(l.programName)
        return true
      })
      .slice(0, 12)
    return NextResponse.json({ recents })
  } catch (error) {
    return serverError('recents/list', error)
  }
}
