export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, serverError } from '@/lib/session'

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function startOfUtcDay(daysAgo: number): Date {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date
}

// GET /api/admin/overview — owner dashboard data in one round trip
export async function GET(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response

  try {
    const active7 = since(7)
    const active30 = since(30)

    const [
      totalUsers,
      active7d,
      active30d,
      suspendedUsers,
      totalPrograms,
      examplePrograms,
      legacyPrograms,
      totalExecutions,
      executions7d,
      errors7d,
      avgDuration,
      users,
      programs,
      audit,
      recent,
      executionSeriesRows,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { lastLoginAt: { gte: active7 } } }),
      db.user.count({ where: { lastLoginAt: { gte: active30 } } }),
      db.user.count({ where: { suspended: true } }),
      db.program.count(),
      db.program.count({ where: { isExample: true } }),
      db.program.count({ where: { isExample: false, ownerId: null } }),
      db.executionLog.count(),
      db.executionLog.count({ where: { createdAt: { gte: active7 } } }),
      db.executionLog.count({ where: { status: 'ERROR', createdAt: { gte: active7 } } }),
      db.executionLog.aggregate({
        where: { createdAt: { gte: active7 } },
        _avg: { durationMs: true },
      }),
      db.user.findMany({
        orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          suspended: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { programs: true, logs: true, favorites: true } },
        },
      }),
      db.program.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          title: true,
          type: true,
          isExample: true,
          executions: true,
          createdAt: true,
          updatedAt: true,
          ownerId: true,
          owner: { select: { username: true } },
        },
      }),
      db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      db.executionLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          programName: true,
          status: true,
          durationMs: true,
          errorLine: true,
          createdAt: true,
          user: { select: { username: true } },
        },
      }),
      db.executionLog.findMany({
        where: { createdAt: { gte: startOfUtcDay(6) } },
        select: { createdAt: true, status: true },
      }),
    ])

    const executionSeries = Array.from({ length: 7 }, (_, index) => {
      const day = startOfUtcDay(6 - index)
      const key = day.toISOString().slice(0, 10)
      const rows = executionSeriesRows.filter(
        (row) => row.createdAt.toISOString().slice(0, 10) === key,
      )
      return {
        date: key,
        label: day.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
        executions: rows.length,
        errors: rows.filter((row) => row.status === 'ERROR').length,
      }
    })

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalUsers,
        active7d,
        active30d,
        suspendedUsers,
        totalPrograms,
        examplePrograms,
        privatePrograms: totalPrograms - examplePrograms - legacyPrograms,
        legacyPrograms,
        totalExecutions,
        executions7d,
        errors7d,
        avgDurationMs7d: Math.round(avgDuration._avg.durationMs ?? 0),
      },
      users: users.map((u) => ({
        ...u,
        programCount: u._count.programs,
        executionCount: u._count.logs,
        favoriteCount: u._count.favorites,
        _count: undefined,
      })),
      programs: programs.map((p) => ({ ...p, ownerUsername: p.owner?.username ?? null, owner: undefined })),
      audit,
      recentActivity: recent.map((r) => ({ ...r, username: r.user?.username ?? null, user: undefined })),
      executionSeries,
    })
  } catch (error) {
    return serverError('admin/overview', error)
  }
}
