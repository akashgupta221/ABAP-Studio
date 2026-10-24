export const dynamic = 'force-dynamic' // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canEditProgram, canViewProgram } from '@/lib/access'
import { isOwner, requireUser, sameOrigin, serverError } from '@/lib/session'

const ALLOWED_TYPES = ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP']
const ALLOWED_PARADIGMS = ['POP', 'OOP', 'BOTH']
const MAX_SOURCE_BYTES = 200_000

// GET /api/programs/[id] — program detail incl. source
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response

  try {
    const { id } = await ctx.params
    const program = await db.program.findUnique({
      where: { id },
      include: { topic: true, owner: { select: { username: true } } },
    })
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (!canViewProgram(auth.user, program, isOwner(auth.user))) {
      // 404 avoids confirming the existence of another user's private object.
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }
    return NextResponse.json({ program })
  } catch (error) {
    return serverError('programs/get', error)
  }
}

// PUT /api/programs/[id] — save program
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (!canEditProgram(auth.user, existing, isOwner(auth.user))) {
      return NextResponse.json(
        { error: existing.isExample ? 'Example programs are read-only' : 'Program not found' },
        { status: existing.isExample ? 403 : 404 },
      )
    }
    // The training runtime can only execute these program types. The real
    // Attributes dialog lists more (module pool, type pool, …); those are
    // shown disabled in the UI and rejected here.
    if (body.type !== undefined && (typeof body.type !== 'string' || !ALLOWED_TYPES.includes(body.type))) {
      return NextResponse.json(
        { error: `Type ${String(body.type)} is not supported by the training runtime` },
        { status: 400 },
      )
    }
    if (body.source !== undefined) {
      if (typeof body.source !== 'string') {
        return NextResponse.json({ error: 'source must be a string' }, { status: 400 })
      }
      if (Buffer.byteLength(body.source, 'utf8') > MAX_SOURCE_BYTES) {
        return NextResponse.json({ error: 'Program source is too large' }, { status: 413 })
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
    if (body.paradigm !== undefined && (typeof body.paradigm !== 'string' || !ALLOWED_PARADIGMS.includes(body.paradigm))) {
      return NextResponse.json({ error: 'paradigm must be POP | OOP | BOTH' }, { status: 400 })
    }
    if (body.tags !== undefined && (typeof body.tags !== 'string' || body.tags.length > 500)) {
      return NextResponse.json({ error: 'tags are too long' }, { status: 400 })
    }
    if (
      body.topicId !== undefined &&
      body.topicId !== null &&
      (typeof body.topicId !== 'number' || !Number.isInteger(body.topicId))
    ) {
      return NextResponse.json({ error: 'topicId must be an integer or null' }, { status: 400 })
    }

    const program = await db.program.update({
      where: { id },
      data: {
        source: (body.source as string | undefined) ?? existing.source,
        title: (body.title as string | undefined) ?? existing.title,
        description: (body.description as string | undefined) ?? existing.description,
        type: (body.type as string | undefined) ?? existing.type,
        paradigm: (body.paradigm as string | undefined) ?? existing.paradigm,
        topicId: body.topicId !== undefined ? (body.topicId as number | null) : existing.topicId,
        tags: (body.tags as string | undefined) ?? existing.tags,
        version: { increment: 1 },
      },
    })
    return NextResponse.json({ program })
  } catch (error) {
    return serverError('programs/update', error)
  }
}

// DELETE /api/programs/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    const { id } = await ctx.params
    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (existing.isExample) {
      return NextResponse.json({ error: 'Example programs cannot be deleted' }, { status: 403 })
    }
    if (!canEditProgram(auth.user, existing, isOwner(auth.user))) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }
    await db.$transaction([
      db.executionLog.updateMany({ where: { programId: id }, data: { programId: null } }),
      db.program.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError('programs/delete', error)
  }
}
