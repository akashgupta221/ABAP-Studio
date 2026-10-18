export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/programs?type=&topic=&q= — list programs (repository browser)
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const type = sp.get('type')
    const topicId = sp.get('topicId')
    const q = sp.get('q')
    const where: any = {}
    if (type) where.type = type
    if (topicId) where.topicId = parseInt(topicId)
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
      ]
    }
    const programs = await db.program.findMany({
      where,
      include: { topic: true },
      orderBy: [{ isExample: 'desc' }, { name: 'asc' }],
    })
    return NextResponse.json({
      programs: programs.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        description: p.description,
        type: p.type,
        paradigm: p.paradigm,
        isExample: p.isExample,
        tags: p.tags,
        executions: p.executions,
        topicId: p.topicId,
        topicTitle: p.topic?.title ?? null,
        updatedAt: p.updatedAt,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/programs — create a new repository object
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, title, description, type = 'REPORT', paradigm = 'BOTH', topicId, source = '', tags = '' } = body
    if (!name || !/^[A-Za-z_\/][A-Za-z0-9_\/%$#]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid object name (use Z-name, letters/digits/underscore)' }, { status: 400 })
    }
    const upperName = name.toUpperCase()
    const existing = await db.program.findUnique({ where: { name: upperName } })
    if (existing) {
      return NextResponse.json({ error: `Object ${upperName} already exists` }, { status: 409 })
    }
    const allowedTypes = ['REPORT', 'CLASS', 'INCLUDE', 'FUNCTION_GROUP']
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'type must be REPORT | CLASS | INCLUDE | FUNCTION_GROUP' }, { status: 400 })
    }
    const program = await db.program.create({
      data: {
        name: upperName,
        title: title ?? '',
        description: description ?? '',
        type,
        paradigm,
        topicId: topicId ?? null,
        source,
        tags,
      },
    })
    return NextResponse.json({ program }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
