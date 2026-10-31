export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, serverError } from '@/lib/session'

// GET /api/system-log?limit=200 — SM21: system log entries (newest first)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const limit = Math.min(500, Math.max(10, Math.trunc(Number(req.nextUrl.searchParams.get('limit') ?? 200))))
    const entries = await db.systemLog.findMany({ orderBy: { id: 'desc' }, take: limit })
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        text: e.text,
        userName: e.userName,
        program: e.program,
        createdAt: e.createdAt,
      })),
    })
  } catch (error) {
    return serverError('system-log/list', error)
  }
}

