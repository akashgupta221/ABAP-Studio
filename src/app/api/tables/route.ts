import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tables — Data Dictionary (SE11) table list
export async function GET() {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
