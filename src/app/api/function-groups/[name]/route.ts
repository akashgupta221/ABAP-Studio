export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { ensureExampleFunctionGroups } from '@/lib/function-groups'
import { canEditFunctionGroup } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError } from '@/lib/session'

// DELETE /api/function-groups/[name]?force=true
// Without force a non-empty group is protected (SAP-style two-step delete).
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    await ensureSchema()
    await ensureSeeded()
    await ensureExampleFunctionGroups()
    const { name } = await ctx.params
    const key = name.trim().toUpperCase()
    const group = await db.functionGroup.findUnique({ where: { name: key } })
    if (!group) {
      return NextResponse.json({ error: `Function group ${key} does not exist` }, { status: 404 })
    }
    if (!canEditFunctionGroup(auth.user, group, isOwner(auth.user))) {
      return NextResponse.json(
        { error: `Function group ${key} is a shared example or belongs to another user and cannot be deleted.` },
        { status: 403 },
      )
    }

    const moduleCount = await db.functionModule.count({ where: { groupName: key } })
    const force = req.nextUrl.searchParams.get('force') === 'true'
    if (moduleCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `Function group ${key} still contains ${moduleCount} function module(s). Delete those first or confirm deletion of the group with all its modules.`,
        },
        { status: 409 },
      )
    }

    await db.$transaction([
      db.functionModule.deleteMany({ where: { groupName: key } }),
      db.functionGroup.delete({ where: { name: key } }),
    ])
    return NextResponse.json({ ok: true, deletedModules: moduleCount })
  } catch (error) {
    return serverError('function-groups/delete', error)
  }
}
