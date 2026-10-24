export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/admin'
import { requireOwner, sameOrigin, serverError } from '@/lib/session'

// PATCH /api/admin/users/[id] — suspend, reactivate, or revoke sessions
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { action?: string }
    const action = body.action
    if (!['suspend', 'reactivate', 'revoke_sessions'].includes(String(action))) {
      return NextResponse.json({ error: 'action must be suspend | reactivate | revoke_sessions' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.id === auth.user.id) {
      return NextResponse.json({ error: 'You cannot suspend or revoke your own owner account' }, { status: 400 })
    }
    if (target.role === 'OWNER') {
      return NextResponse.json({ error: 'The designated owner account cannot be modified here' }, { status: 403 })
    }

    const data =
      action === 'suspend'
        ? { suspended: true, sessionVersion: { increment: 1 } }
        : action === 'reactivate'
          ? { suspended: false, sessionVersion: { increment: 1 } }
          : { sessionVersion: { increment: 1 } }

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, suspended: true, sessionVersion: true },
    })

    await writeAudit(
      auth.user,
      action === 'suspend'
        ? 'USER_SUSPEND'
        : action === 'reactivate'
          ? 'USER_REACTIVATE'
          : 'USER_SESSION_REVOKE',
      'USER',
      target.id,
      target.username,
    )

    return NextResponse.json({ user: updated })
  } catch (error) {
    return serverError('admin/users/patch', error)
  }
}

// DELETE /api/admin/users/[id] — permanent deletion with explicit confirmation.
// Programs and favorites are removed; execution logs are retained without a
// user/program link for aggregate metrics. Audit records are immutable.
// Cleanup is explicit so it also works where additive migration could not add
// SQL foreign keys (Turso).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { confirmUsername?: string }
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.id === auth.user.id || target.role === 'OWNER') {
      return NextResponse.json({ error: 'The designated owner account cannot be deleted' }, { status: 403 })
    }
    if (body.confirmUsername !== target.username) {
      return NextResponse.json(
        { error: 'Type the exact user name to confirm permanent deletion' },
        { status: 400 },
      )
    }

    await writeAudit(auth.user, 'USER_DELETE', 'USER', target.id, target.username)
    const ownedPrograms = await db.program.findMany({
      where: { ownerId: target.id },
      select: { id: true },
    })
    const programIds = ownedPrograms.map((p) => p.id)
    await db.$transaction([
      db.executionLog.updateMany({
        where: {
          OR: [
            { userId: target.id },
            ...(programIds.length ? [{ programId: { in: programIds } }] : []),
          ],
        },
        data: { userId: null, programId: null },
      }),
      db.userFavorite.deleteMany({ where: { userId: target.id } }),
      db.program.deleteMany({ where: { ownerId: target.id } }),
      db.user.delete({ where: { id: target.id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('admin/users/delete', error)
  }
}
