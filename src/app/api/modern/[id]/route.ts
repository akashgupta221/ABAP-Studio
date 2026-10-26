export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canEditProgram, canViewProgram } from '@/lib/access'
import {
  clientKey,
  isOwner,
  rateLimit,
  requireUser,
  sameOrigin,
  serverError,
} from '@/lib/session'

const MAX_SOURCE_BYTES = 200_000

async function findModern(id: string) {
  const program = await db.program.findUnique({
    where: { id },
    include: { owner: { select: { username: true } } },
  })
  if (!program || program.environment !== 'MODERN') return null
  return program
}

// GET /api/modern/[id] — detail, including source.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    const { id } = await ctx.params
    const program = await findModern(id)
    if (!program || !canViewProgram(auth.user, program, isOwner(auth.user))) {
      return NextResponse.json({ error: 'Modern object not found' }, { status: 404 })
    }
    return NextResponse.json({ program })
  } catch (error) {
    return serverError('modern/get', error)
  }
}

// PUT /api/modern/[id] — save source/metadata. Examples stay immutable.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf
  const limited = rateLimit(clientKey(req, `modern-save:${auth.user.id}`), 60, 60_000)
  if (limited) return limited

  try {
    const { id } = await ctx.params
    const existing = await findModern(id)
    if (!existing) return NextResponse.json({ error: 'Modern object not found' }, { status: 404 })
    if (!canEditProgram(auth.user, existing, isOwner(auth.user))) {
      return NextResponse.json(
        { error: existing.isExample ? 'Modern examples are read-only' : 'Modern object not found' },
        { status: existing.isExample ? 403 : 404 },
      )
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.source !== undefined) {
      if (typeof body.source !== 'string') {
        return NextResponse.json({ error: 'source must be a string' }, { status: 400 })
      }
      if (Buffer.byteLength(body.source, 'utf8') > MAX_SOURCE_BYTES) {
        return NextResponse.json({ error: 'Source is too large' }, { status: 413 })
      }
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > 300)) {
      return NextResponse.json({ error: 'title must be a string of at most 300 characters' }, { status: 400 })
    }
    if (
      body.description !== undefined &&
      (typeof body.description !== 'string' || body.description.length > 2_000)
    ) {
      return NextResponse.json({ error: 'description is too long' }, { status: 400 })
    }
    if (body.modernKind !== undefined && body.modernKind !== existing.modernKind) {
      return NextResponse.json({ error: 'The Modern object kind cannot be changed' }, { status: 400 })
    }

    const program = await db.program.update({
      where: { id },
      data: {
        source: (body.source as string | undefined) ?? existing.source,
        title: (body.title as string | undefined) ?? existing.title,
        description: (body.description as string | undefined) ?? existing.description,
        version: { increment: 1 },
      },
    })
    return NextResponse.json({ program })
  } catch (error) {
    return serverError('modern/update', error)
  }
}

// DELETE /api/modern/[id] — delete a private Modern object.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf
  const limited = rateLimit(clientKey(req, `modern-delete:${auth.user.id}`), 30, 60_000)
  if (limited) return limited

  try {
    const { id } = await ctx.params
    const existing = await findModern(id)
    if (!existing) return NextResponse.json({ error: 'Modern object not found' }, { status: 404 })
    if (existing.isExample) {
      return NextResponse.json({ error: 'Modern examples cannot be deleted' }, { status: 403 })
    }
    if (!canEditProgram(auth.user, existing, isOwner(auth.user))) {
      return NextResponse.json({ error: 'Modern object not found' }, { status: 404 })
    }
    await db.$transaction([
      db.executionLog.updateMany({ where: { programId: id }, data: { programId: null } }),
      db.program.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('modern/delete', error)
  }
}
