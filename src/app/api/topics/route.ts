export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'

// GET /api/topics — syllabus topics with example counts
export async function GET() {
  try {
    await ensureSeeded()
    const topics = await db.topic.findMany({
      orderBy: { srNo: 'asc' },
      include: {
        programs: { select: { id: true, name: true, title: true, type: true, paradigm: true, isExample: true } },
      },
    })
    return NextResponse.json({
      topics: topics.map((t) => ({
        id: t.id,
        srNo: t.srNo,
        code: t.code,
        title: t.title,
        summary: t.summary,
        details: t.details,
        paradigm: t.paradigm,
        category: t.category,
        examples: t.programs,
        exampleCount: t.programs.length,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
