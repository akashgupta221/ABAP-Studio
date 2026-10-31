export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, serverError } from '@/lib/session'
import { isOwner } from '@/lib/session'

// GET /api/executions?limit=20 — SM50 work-process snapshot: recent executions
// (own executions for users; the owner sees the whole system)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const limit = Math.min(50, Math.max(5, Math.trunc(Number(req.nextUrl.searchParams.get('limit') ?? 20))))
    const owner = isOwner(auth.user)
    const entries = await db.executionLog.findMany({
      where: owner ? undefined : { userId: auth.user.id },
      orderBy: { id: 'desc' },
      take: limit,
      select: { id: true, programName: true, status: true, durationMs: true, createdAt: true },
    })
    return NextResponse.json({
      executions: entries.map((e) => ({
        programName: e.programName,
        status: e.status,
        durationMs: e.durationMs,
        createdAt: e.createdAt,
      })),
    })
  } catch (error) {
    return serverError('executions/list', error)
  }
}
