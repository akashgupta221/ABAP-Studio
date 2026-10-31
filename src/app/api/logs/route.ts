export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, serverError } from '@/lib/session'

// GET /api/logs — SLG1: application logs written by ABAP (BAL_LOG_CREATE / BAL_LOG_MSG_ADD / BAL_DB_SAVE)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const logs = await db.applicationLog.findMany({ orderBy: { id: 'desc' }, take: 200 })
    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        object: l.object,
        externalNumber: l.externalNumber,
        messages: JSON.parse(l.messages || '[]') as { msgType: string; text: string }[],
        createdBy: l.createdBy,
        createdAt: l.createdAt,
      })),
    })
  } catch (error) {
    return serverError('logs/list', error)
  }
}
