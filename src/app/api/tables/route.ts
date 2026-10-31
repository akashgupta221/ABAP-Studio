export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { requireUser, requireOwner, badRequest, serverError } from '@/lib/session'
import { createTable, validateFields, validateTableName } from '@/lib/ddic'

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

// POST /api/tables — SE11: create a customer table (Z*/Y* namespace, owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const nameCheck = validateTableName((body as any).name)
    if (!nameCheck.ok) return badRequest(nameCheck.error)
    const fieldsCheck = validateFields((body as any).fields)
    if (!fieldsCheck.ok) return badRequest(fieldsCheck.error)
    const existing = await db.dbTable.findUnique({ where: { name: nameCheck.value } })
    if (existing) return badRequest(`Table ${nameCheck.value} already exists`)
    const created = await createTable(nameCheck.value, String((body as any).description ?? ''), fieldsCheck.value)
    return NextResponse.json({ table: { name: created.name, description: created.description, isSap: created.isSap, fieldCount: fieldsCheck.value.length, rowCount: 0 } }, { status: 201 })
  } catch (error) {
    return serverError('tables/create', error)
  }
}
