export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, serverError } from '@/lib/session'

// GET /api/functions — Function Builder (SE37) list
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const fms = await db.functionModule.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({
      functions: fms.map((fm) => ({
        id: fm.id,
        name: fm.name,
        groupName: fm.groupName,
        title: fm.title,
        isExample: fm.isExample,
        importParams: JSON.parse(fm.importParams || '[]'),
        exportParams: JSON.parse(fm.exportParams || '[]'),
        changingParams: JSON.parse(fm.changingParams || '[]'),
        tablesParams: JSON.parse(fm.tablesParams || '[]'),
        source: fm.source,
      })),
    })
  } catch (error) {
    return serverError('functions', error)
  }
}
