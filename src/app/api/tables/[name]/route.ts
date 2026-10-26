export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, serverError } from '@/lib/session'
import { applySelectionFilters, parseSelectionFilters } from '@/lib/table-filters'

// GET /api/tables/[name]?page=&pageSize=&q=&filters= — Data Browser (SE16):
// fields + rows, with optional per-field selection criteria (SE16N-style)
// passed as a JSON array [{field, op, low, high}].
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
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
    const criteria = parseSelectionFilters(sp.get('filters'))
    if (criteria === null) {
      return NextResponse.json({ error: 'Invalid selection criteria' }, { status: 400 })
    }

    let rows = table.rows.sort((a, b) => a.seq - b.seq).map((r) => JSON.parse(r.data || '{}'))
    if (criteria && criteria.length > 0) {
      rows = applySelectionFilters(rows, criteria)
    }
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
  } catch (error) {
    return serverError('tables/detail', error)
  }
}
