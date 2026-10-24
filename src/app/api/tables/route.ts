export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, serverError } from '@/lib/session'

// GET /api/tables — Data Dictionary (SE11) table list
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const tables = await db.dbTable.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { rows: true } } },
    })
    return NextResponse.json({
      tables: tables.map((t) => {
        const fields = JSON.parse(t.fields || '[]') as any[]
        return {
          name: t.name,
          description: t.description,
          isSap: t.isSap,
          fieldCount: fields.length,
          rowCount: t._count.rows,
          topicId: t.topicId,
        }
      }),
    })
  } catch (error) {
    return serverError('tables', error)
  }
}
