export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { badRequest, requireOwner, requireUser, serverError } from '@/lib/session'
import { loadEngineContext } from '@/lib/engine-context'
import { runAbap } from '@/lib/abap'
import { generateQuerySource, type QueryFilter } from '@/lib/query-gen'

// GET /api/query — SQ01/SQ02: list infosets and queries; ?action=run&name=ZQ executes
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()

    const action = req.nextUrl.searchParams.get('action')
    if (action === 'run') {
      const name = (req.nextUrl.searchParams.get('name') ?? '').trim().toUpperCase()
      const query = await db.queryDef.findUnique({ where: { name } })
      if (!query) return NextResponse.json({ error: `Query ${name} not found` }, { status: 404 })
      const infoset = await db.queryInfoset.findUnique({ where: { name: query.infoset } })
      if (!infoset) return NextResponse.json({ error: `Infoset ${query.infoset} missing` }, { status: 404 })
      const { dbSnap, fms, includes, messageClasses, numberRanges, files } = await loadEngineContext({ user: auth.user, owner: false })
      let source: string
      try {
        source = generateQuerySource(infoset.baseTable, JSON.parse(query.fields || '[]'), JSON.parse(query.filters || '[]') as QueryFilter[], dbSnap).source
      } catch (e) {
        return badRequest((e as Error).message)
      }
      const result = runAbap({ source, repid: name, db: dbSnap, includes, functionModules: fms, messageClasses, numberRanges, files })
      return NextResponse.json({
        query: name,
        infoset: query.infoset,
        generatedSource: source,
        status: result.status,
        error: result.error ?? null,
        list: (result.list ?? []).slice(0, 500).map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join('')),
        messages: result.messages,
      })
    }
    const [infosets, queries] = await Promise.all([
      db.queryInfoset.findMany({ orderBy: { name: 'asc' } }),
      db.queryDef.findMany({ orderBy: { name: 'asc' } }),
    ])
    return NextResponse.json({
      infosets: infosets.map((i) => ({ name: i.name, baseTable: i.baseTable, description: i.description })),
      queries: queries.map((q) => ({ name: q.name, infoset: q.infoset, fields: JSON.parse(q.fields || '[]'), filters: JSON.parse(q.filters || '[]') })),
    })
  } catch (error) {
    return serverError('query/list', error)
  }
}

// POST /api/query — create an infoset (SQ02) or a query (SQ01); ?action=run executes inline (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return badRequest('Request body must be JSON')
    const kind = String((body as any).kind ?? '')
    const name = String((body as any).name ?? '').trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(name)) return badRequest('Name must be 2–20 letters, digits or underscore')

    if (kind === 'infoset') {
      const baseTable = String((body as any).baseTable ?? '').trim().toUpperCase()
      const table = await db.dbTable.findUnique({ where: { name: baseTable } })
      if (!table) return badRequest(`Base table ${baseTable} is not in the dictionary`)
      const description = String((body as any).description ?? '').slice(0, 120)
      await db.queryInfoset.upsert({ where: { name }, update: { baseTable, description }, create: { name, baseTable, description } })
      return NextResponse.json({ ok: true, name, baseTable }, { status: 201 })
    }

    if (kind === 'query') {
      const infoset = String((body as any).infoset ?? '').trim().toUpperCase()
      const info = await db.queryInfoset.findUnique({ where: { name: infoset } })
      if (!info) return badRequest(`Infoset ${infoset} does not exist`)
      const fields = (Array.isArray((body as any).fields) ? (body as any).fields : []).map((f: unknown) => String(f).toUpperCase()).slice(0, 40)
      const filters = (Array.isArray((body as any).filters) ? (body as any).filters : []).slice(0, 20)
      await db.queryDef.upsert({
        where: { name },
        update: { infoset, fields: JSON.stringify(fields), filters: JSON.stringify(filters) },
        create: { name, infoset, fields: JSON.stringify(fields), filters: JSON.stringify(filters) },
      })
      return NextResponse.json({ ok: true, name, infoset }, { status: 201 })
    }

    return badRequest('kind must be "infoset" or "query"')
  } catch (error) {
    return serverError('query/save', error)
  }
}

// DELETE /api/query?kind=infoset&name=N — owner only
export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  try {

      await ensureSeeded()
    const kind = req.nextUrl.searchParams.get('kind')
    const name = (req.nextUrl.searchParams.get('name') ?? '').trim().toUpperCase()
    if (!name || !['infoset', 'query'].includes(kind ?? '')) return badRequest('kind (infoset|query) and name are required')
    if (kind === 'infoset') {
      const used = await db.queryDef.findFirst({ where: { infoset: name } })
      if (used) return badRequest(`Infoset ${name} is used by query ${used.name}`)
      await db.queryInfoset.deleteMany({ where: { name } })
    } else {
      await db.queryDef.deleteMany({ where: { name } })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('query/delete', error)
  }
}
