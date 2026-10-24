export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { programListWhere } from '@/lib/access'
import { isOwner, requireUser, serverError } from '@/lib/session'

// GET /api/topics — syllabus topics with the caller-visible example counts.
// Private programs must never appear here, even though they may carry a topicId.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (!auth.user) return auth.response
  try {
    await ensureSeeded()
    const topics = await db.topic.findMany({
      orderBy: { srNo: 'asc' },
      include: {
        programs: {
          where: programListWhere(auth.user, isOwner(auth.user)),
          select: { id: true, name: true, title: true, type: true, paradigm: true, isExample: true },
        },
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
  } catch (error) {
    return serverError('topics', error)
  }
}
