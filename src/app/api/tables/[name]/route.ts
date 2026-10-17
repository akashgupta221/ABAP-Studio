import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tables/[name]?page=&pageSize=&q= — Data Browser (SE16): fields + rows
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await ctx.params
    const table = await db.dbTable.findUnique({
      where: { name: name.toUpperCase() },
      include: { rows: true },
    })
    if (!table) return NextResponse.json({ error: `Table ${name} not found` }, { status: 404 })
    const fields = JSON.parse(table.fields || '[]') as any[]
    const sp = req.nextUrl.searchParams
    const q = (sp.get('q') || '').toLowerCase()
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(200, Math.max(10, parseInt(sp.get('pageSize') || '50')))

    let rows = table.rows.sort((a, b) => a.seq - b.seq).map((r) => JSON.parse(r.data || '{}'))
    if (q) {
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    }
    const total = rows.length
    const start = (page - 1) * pageSize
    const pageRows = rows.slice(start, start + pageSize)

    return NextResponse.json({
      table: { name: table.name, description: table.description },
      fields: fields.map((f) => ({
        name: f.name,
        type: f.type,
        length: f.length,
        decimals: f.decimals,
        key: !!f.key,
        text: f.text,
      })),
      rows: pageRows,
      total,
      page,
      pageSize,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
