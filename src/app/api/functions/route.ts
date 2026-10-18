export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/functions — Function Builder (SE37) list
export async function GET() {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
