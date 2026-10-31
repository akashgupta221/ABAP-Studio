export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, requireUser, badRequest, serverError } from '@/lib/session'
import { addRow, deleteRow, listRows, validateTableName } from '@/lib/ddic'

// GET /api/tables/[name]/rows — SE11 maintenance: all entries with seq numbers
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    const { name: raw } = await ctx.params
    const nameCheck = validateTableName(raw)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const rows = await listRows(nameCheck.value)
    if (rows === null) return NextResponse.json({ error: `Table ${nameCheck.value} not found` }, { status: 404 })
    return NextResponse.json({ rows })
  } catch (error) {
    return serverError('tables/rows/list', error)
  }
}

// POST /api/tables/[name]/rows — SE11: add one entry (owner only)
export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const { name: raw } = await ctx.params
    const nameCheck = validateTableName(raw)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const result = await addRow(nameCheck.value, (body as any).data ?? body)
    if (result === null) return NextResponse.json({ error: `Table ${nameCheck.value} not found` }, { status: 404 })
    if (result === 'SAP_EXAMPLE') {
      return NextResponse.json({ error: 'SAP example tables are shared training content and cannot be changed' }, { status: 403 })
    }
    if ('ok' in (result as any) && (result as any).ok === false) return badRequest((result as any).error)
    return NextResponse.json({ ok: true, row: result }, { status: 201 })
  } catch (error) {
    return serverError('tables/rows/add', error)
  }
}

// DELETE /api/tables/[name]/rows?seq=n — SE11: remove one entry (owner only)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {
    const { name: raw } = await ctx.params
    const nameCheck = validateTableName(raw)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const seq = Number(req.nextUrl.searchParams.get('seq'))
    if (!Number.isInteger(seq) || seq < 0) return badRequest('seq query parameter must be a non-negative integer')
    const result = await deleteRow(nameCheck.value, seq)
    if (result === null) return NextResponse.json({ error: `Table ${nameCheck.value} not found` }, { status: 404 })
    if (result === 'SAP_EXAMPLE') {
      return NextResponse.json({ error: 'SAP example tables are shared training content and cannot be changed' }, { status: 403 })
    }
    return NextResponse.json({ ok: true, deleted: result.count })
  } catch (error) {
    return serverError('tables/rows/delete', error)
  }
}
