export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/admin'
import { requireOwner, sameOrigin, serverError } from '@/lib/session'

// DELETE /api/admin/programs/[id] — owner-only permanent deletion.
// Private programs can be removed regardless of owner. Examples are shared
// training material and stay immutable. Execution history is detached, never
// deleted, so aggregate metrics remain accurate.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { confirmName?: string }
    const program = await db.program.findUnique({
      where: { id },
      include: { owner: { select: { username: true } } },
    })
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (program.isExample) {
      return NextResponse.json({ error: 'Example programs cannot be deleted' }, { status: 403 })
    }
    if (body.confirmName !== program.name) {
      return NextResponse.json(
        { error: 'Type the exact program name to confirm permanent deletion' },
        { status: 400 },
      )
    }

    await writeAudit(
      auth.user,
      'PROGRAM_DELETE',
      'PROGRAM',
      program.id,
      `${program.name}${program.owner?.username ? ` (owner ${program.owner.username})` : ' (legacy/unowned)'}`,
    )
    await db.$transaction([
      db.executionLog.updateMany({ where: { programId: id }, data: { programId: null } }),
      db.program.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('admin/programs/delete', error)
  }
}
