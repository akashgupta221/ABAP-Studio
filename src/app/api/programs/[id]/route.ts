import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/programs/[id] — program detail incl. source
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const program = await db.program.findUnique({
      where: { id },
      include: { topic: true },
    })
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    return NextResponse.json({ program })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/programs/[id] — save program
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    const program = await db.program.update({
      where: { id },
      data: {
        source: body.source ?? existing.source,
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        paradigm: body.paradigm ?? existing.paradigm,
        topicId: body.topicId ?? existing.topicId,
        tags: body.tags ?? existing.tags,
        version: { increment: 1 },
      },
    })
    return NextResponse.json({ program })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/programs/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const existing = await db.program.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    if (existing.isExample) {
      return NextResponse.json({ error: 'Example programs cannot be deleted' }, { status: 403 })
    }
    await db.program.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
