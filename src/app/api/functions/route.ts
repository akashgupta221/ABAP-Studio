export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { ensureExampleFunctionGroups } from '@/lib/function-groups'
import {
  FM_NAME_RE,
  MAX_FM_SOURCE_BYTES,
  changedOnNow,
  defaultFmSource,
  sanitizeFmParams,
  serializeFmParams,
  toFunctionDto,
} from '@/lib/function-module'
import { canEditFunctionGroup, canViewFunctionGroup, functionListWhere } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError } from '@/lib/session'

// GET /api/functions — Function Builder (SE37) overview.
// Examples are shared; private modules are only visible to their creator
// (the designated owner may inspect all modules for administration).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()

    const rows = await db.functionModule.findMany({
      where: functionListWhere(auth.user, isOwner(auth.user)),
      include: { owner: { select: { username: true } } },
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      functions: rows.map((fm) => toFunctionDto(fm, fm.owner?.username)),
    })
  } catch (error) {
    return serverError('functions', error)
  }
}

// POST /api/functions — create a private function module.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()

    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown
      groupName?: unknown
      group?: unknown
      title?: unknown
      source?: unknown
      params?: unknown
    }
    const name = String(body.name ?? '').trim().toUpperCase()
    const groupName = String(body.groupName ?? body.group ?? '').trim().toUpperCase()

    if (!name) {
      return NextResponse.json({ error: 'Make an entry in field FUNCTION MODULE' }, { status: 400 })
    }
    if (!FM_NAME_RE.test(name)) {
      return NextResponse.json(
        { error: 'Function module name must start with Z or Y and contain only letters, digits and underscores (max 30).' },
        { status: 400 },
      )
    }
    if (!groupName) {
      return NextResponse.json({ error: 'Make an entry in field FUNCTION GROUP' }, { status: 400 })
    }

    const group = await db.functionGroup.findUnique({ where: { name: groupName } })
    if (!group || !canViewFunctionGroup(auth.user, group, isOwner(auth.user))) {
      return NextResponse.json({ error: `Function group ${groupName} does not exist` }, { status: 400 })
    }
    if (!canEditFunctionGroup(auth.user, group, isOwner(auth.user))) {
      return NextResponse.json(
        { error: `Function group ${groupName} is a shared example — create your own function group first.` },
        { status: 403 },
      )
    }

    const existing = await db.functionModule.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: `Function module ${name} already exists` }, { status: 409 })
    }

    const title = String(body.title ?? '').trim().slice(0, 120)
    const params = sanitizeFmParams(body.params)
    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source
      : defaultFmSource(name, title)
    if (Buffer.byteLength(source, 'utf8') > MAX_FM_SOURCE_BYTES) {
      return NextResponse.json({ error: 'Function module source is too large' }, { status: 413 })
    }

    const created = await db.functionModule.create({
      data: {
        name,
        groupName,
        title,
        source,
        ...serializeFmParams(params),
        isExample: false,
        active: false,
        ownerId: auth.user.id,
        createdBy: auth.user.username,
        changedBy: auth.user.username,
        changedOn: changedOnNow(),
      },
      include: { owner: { select: { username: true } } },
    })

    return NextResponse.json(
      { function: toFunctionDto(created, created.owner?.username) },
      { status: 201 },
    )
  } catch (error) {
    return serverError('functions/create', error)
  }
}
