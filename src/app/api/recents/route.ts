export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/recents — recent executions (like SAP recent objects)
export async function GET() {
  try {
    const logs = await db.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
