export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { checkSyntax } from '@/lib/abap'
import { db, ensureSchema } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { ensureExampleFunctionGroups } from '@/lib/function-groups'
import {
  MAX_FM_SOURCE_BYTES,
  changedOnNow,
  sanitizeFmParams,
  serializeFmParams,
  toFunctionDto,
} from '@/lib/function-module'
import { canEditFunction, canEditFunctionGroup, canViewFunction, canViewFunctionGroup } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError } from '@/lib/session'

async function loadVisible(name: string, user: { id: string; username: string; role: string }) {
  await ensureSchema()
  await ensureSeeded()
  await ensureExampleFunctionGroups()
  const fm = await db.functionModule.findUnique({
    where: { name },
    include: { owner: { select: { username: true } } },
  })
  if (!fm || !canViewFunction(user, fm, isOwner(user))) return null
  return fm
}

// GET /api/functions/[name] — full function module record.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    const { name } = await ctx.params
    const key = name.trim().toUpperCase()
    const fm = await loadVisible(key, auth.user)
    if (!fm) return NextResponse.json({ error: `Function module ${key} does not exist` }, { status: 404 })
    return NextResponse.json({ function: toFunctionDto(fm, fm.owner?.username) })
  } catch (error) {
    return serverError('functions/get', error)
  }
}

// PUT /api/functions/[name] — save attributes/source/parameters, activate or deactivate.
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { name } = await ctx.params
    const key = name.trim().toUpperCase()
    const fm = await loadVisible(key, auth.user)
    if (!fm) return NextResponse.json({ error: `Function module ${key} does not exist` }, { status: 404 })
    if (!canEditFunction(auth.user, fm, isOwner(auth.user))) {
      return NextResponse.json(
        { error: `Function module ${key} is a shared example or belongs to another user and cannot be changed.` },
        { status: 403 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown
      source?: unknown
      groupName?: unknown
      group?: unknown
      params?: unknown
      activate?: unknown
      deactivate?: unknown
    }

    const data: Record<string, unknown> = {
      changedBy: auth.user.username,
      changedOn: changedOnNow(),
    }
    let sourceChanged = false
    let paramsChanged = false
    let groupChanged = false

    if (typeof body.title === 'string') {
      data.title = body.title.trim().slice(0, 120)
    }
    if (typeof body.source === 'string') {
      if (Buffer.byteLength(body.source, 'utf8') > MAX_FM_SOURCE_BYTES) {
        return NextResponse.json({ error: 'Function module source is too large' }, { status: 413 })
      }
      data.source = body.source
      sourceChanged = body.source !== fm.source
    }
    if (body.params !== undefined) {
      const serialized = serializeFmParams(sanitizeFmParams(body.params))
      data.importParams = serialized.importParams
      data.exportParams = serialized.exportParams
      data.changingParams = serialized.changingParams
      data.tablesParams = serialized.tablesParams
      data.exceptions = serialized.exceptions
      paramsChanged =
        serialized.importParams !== fm.importParams ||
        serialized.exportParams !== fm.exportParams ||
        serialized.changingParams !== fm.changingParams ||
        serialized.tablesParams !== fm.tablesParams ||
        serialized.exceptions !== (fm.exceptions ?? '[]')
    }
    const targetGroup = String(body.groupName ?? body.group ?? '').trim().toUpperCase()
    if (targetGroup && targetGroup !== fm.groupName) {
      const group = await db.functionGroup.findUnique({ where: { name: targetGroup } })
      if (!group || !canViewFunctionGroup(auth.user, group, isOwner(auth.user))) {
        return NextResponse.json({ error: `Function group ${targetGroup} does not exist` }, { status: 400 })
      }
      if (!canEditFunctionGroup(auth.user, group, isOwner(auth.user))) {
        return NextResponse.json(
          { error: `Function group ${targetGroup} is a shared example and cannot receive private modules.` },
          { status: 403 },
        )
      }
      data.groupName = targetGroup
      groupChanged = true
    }

    const shouldActivate = body.activate === true
    const shouldDeactivate = body.deactivate === true
    const sourceForCheck = typeof data.source === 'string' ? data.source : fm.source

    if (shouldActivate) {
      if (!sourceForCheck.trim()) {
        return NextResponse.json({ error: 'The function module has no source code' }, { status: 400 })
      }
      const issues = checkSyntax(sourceForCheck)
      const errors = issues.filter((issue) => issue.kind === 'E')
      if (errors.length > 0) {
        return NextResponse.json(
          { error: 'Syntax check failed — the function module was not activated', issues },
          { status: 422 },
        )
      }
      data.active = true
    } else if (shouldDeactivate) {
      data.active = false
    } else if (sourceChanged || paramsChanged || groupChanged) {
      // SAP-style revised object: changed code becomes inactive until activated.
      data.active = false
    }

    const updated = await db.functionModule.update({
      where: { name: key },
      data,
      include: { owner: { select: { username: true } } },
    })
    return NextResponse.json({ function: toFunctionDto(updated, updated.owner?.username) })
  } catch (error) {
    return serverError('functions/update', error)
  }
}

// DELETE /api/functions/[name] — remove a private function module.
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { name } = await ctx.params
    const key = name.trim().toUpperCase()
    const fm = await loadVisible(key, auth.user)
    if (!fm) return NextResponse.json({ error: `Function module ${key} does not exist` }, { status: 404 })
    if (!canEditFunction(auth.user, fm, isOwner(auth.user))) {
      return NextResponse.json(
        { error: `Function module ${key} is a shared example or belongs to another user and cannot be deleted.` },
        { status: 403 },
      )
    }
    await db.functionModule.delete({ where: { name: key } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('functions/delete', error)
  }
}
