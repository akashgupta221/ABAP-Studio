export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, serverError } from '@/lib/session'

// GET /api/dumps — ABAP Dump Analysis (ST22): the caller's own runtime errors.
// Dumps are per-user: a user only ever sees the short dumps of their own runs.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    const sp = req.nextUrl.searchParams
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50')))
    const dumps = await db.executionLog.findMany({
      where: { userId: auth.user.id, status: 'ERROR' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        programName: true,
        status: true,
        durationMs: true,
        message: true,
        errorType: true,
        errorLine: true,
        listLines: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ dumps })
  } catch (error) {
    return serverError('dumps', error)
  }
}
