export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, requireUser, badRequest, serverError } from '@/lib/session'
import { deleteTable, updateTable, validateFields, validateTableName } from '@/lib/ddic'
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
      table: { name: table.name, description: table.description, isSap: table.isSap },
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

// PUT /api/tables/[name] — SE11: maintain a customer table (fields + description)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const { name: raw } = await ctx.params
    const nameCheck = validateTableName(raw)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const fieldsCheck = validateFields((body as any).fields)
    if (!fieldsCheck.ok) return badRequest(fieldsCheck.error)
    const result = await updateTable(
      nameCheck.value,
      (body as any).description !== undefined ? String((body as any).description) : undefined,
      fieldsCheck.value,
    )
    if (result === null) return NextResponse.json({ error: `Table ${nameCheck.value} not found` }, { status: 404 })
    if (result === 'SAP_EXAMPLE') {
      return NextResponse.json({ error: 'SAP example tables are shared training content and cannot be changed' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, table: { name: nameCheck.value } })
  } catch (error) {
    return serverError('tables/update', error)
  }
}

// DELETE /api/tables/[name] — SE11: delete a customer table (owner only)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const { name: raw } = await ctx.params
    const nameCheck = validateTableName(raw)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const result = await deleteTable(nameCheck.value)
    if (result === null) return NextResponse.json({ error: `Table ${nameCheck.value} not found` }, { status: 404 })
    if (result === 'SAP_EXAMPLE') {
      return NextResponse.json({ error: 'SAP example tables are shared training content and cannot be deleted' }, { status: 403 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('tables/delete', error)
  }
}
