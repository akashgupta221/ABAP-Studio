export const dynamic = "force-dynamic" // always server-rendered (serverless-safe)

import { NextRequest, NextResponse } from 'next/server'
import { db, ensureSchema } from '@/lib/db'
import { requireOwner, sameOrigin, serverError } from '@/lib/session'

// POST /api/seed — (re)seed syllabus topics, SAP demo tables, examples, FMs.
// Owner-only: this endpoint can delete and reseed repository content.
// Body: { topics?: [...], tables?: [...], programs?: [...], functions?: [...], reset?: boolean }
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req)
  if (!auth.user) return auth.response
  const csrf = sameOrigin(req)
  if (csrf) return csrf

  try {
    await ensureSchema()
    const body = await req.json()
    const { topics = [], tables = [], programs = [], functions = [], reset = false } = body as {
      topics?: any[]
      tables?: any[]
      programs?: any[]
      functions?: any[]
      reset?: boolean
    }

    if (reset) {
      // Never delete user-owned programs. Only shared examples and syllabus
      // content are reset; execution history is retained with its program link
      // cleared (the dashboard keeps aggregate health metrics).
      const exampleIds = (
        await db.program.findMany({ where: { isExample: true }, select: { id: true } })
      ).map((p) => p.id)
      if (exampleIds.length) {
        await db.executionLog.updateMany({
          where: { programId: { in: exampleIds } },
          data: { programId: null },
        })
        await db.program.deleteMany({ where: { id: { in: exampleIds } } })
      }
      await db.dbRow.deleteMany()
      await db.dbTable.deleteMany()
      // Never delete private function modules or groups on a shared reset.
      await db.functionModule.deleteMany({ where: { isExample: true } })
      await db.functionGroup.deleteMany({ where: { isExample: true } })
      await db.topic.deleteMany()
    }

    // topics
    const topicIds = new Map<string, number>()
    for (const t of topics) {
      const created = await db.topic.upsert({
        where: { code: t.code },
        update: {
          srNo: t.srNo,
          title: t.title,
          summary: t.summary,
          details: t.details,
          paradigm: t.paradigm,
          category: t.category,
        },
        create: {
          code: t.code,
          srNo: t.srNo,
          title: t.title,
          summary: t.summary,
          details: t.details,
          paradigm: t.paradigm,
          category: t.category,
        },
      })
      topicIds.set(t.code, created.id)
    }

    // tables (with rows)
    for (const t of tables) {
      const fields = JSON.stringify(t.fields)
      let table = await db.dbTable.findUnique({ where: { name: t.name } })
      if (!table) {
        table = await db.dbTable.create({
          data: {
            name: t.name,
            description: t.description,
            isSap: t.isSap ?? true,
            fields,
            topicId: t.topicCode ? topicIds.get(t.topicCode) ?? null : null,
          },
        })
      } else {
        table = await db.dbTable.update({
          where: { name: t.name },
          data: { description: t.description, fields, topicId: t.topicCode ? topicIds.get(t.topicCode) ?? null : null },
        })
        await db.dbRow.deleteMany({ where: { tableId: table.id } })
      }
      let seq = 0
      for (const row of t.rows || []) {
        await db.dbRow.create({
          data: { tableId: table.id, data: JSON.stringify(row), seq: seq++ },
        })
      }
    }

    // programs (skip the reserved per-user sandbox name)
    for (const p of programs) {
      if (String(p.name).startsWith('Z_MY_PRACTICE')) continue
      await db.program.upsert({
        where: { name: p.name },
        update: {
          title: p.title,
          description: p.description,
          type: p.type,
          paradigm: p.paradigm,
          source: p.source,
          isExample: p.isExample ?? true,
          tags: p.tags ?? '',
          topicId: p.topicCode ? topicIds.get(p.topicCode) ?? null : null,
        },
        create: {
          name: p.name,
          title: p.title,
          description: p.description,
          type: p.type,
          paradigm: p.paradigm,
          source: p.source,
          isExample: p.isExample ?? true,
          tags: p.tags ?? '',
          topicId: p.topicCode ? topicIds.get(p.topicCode) ?? null : null,
        },
      })
    }

    // function modules
    for (const fm of functions) {
      // A private module is user data; never replace it with seed content.
      const existing = await db.functionModule.findUnique({ where: { name: fm.name } })
      if (existing && !existing.isExample) continue
      await db.functionModule.upsert({
        where: { name: fm.name },
        update: {
          groupName: fm.groupName,
          title: fm.title,
          importParams: JSON.stringify(fm.importParams || []),
          exportParams: JSON.stringify(fm.exportParams || []),
          changingParams: JSON.stringify(fm.changingParams || []),
          tablesParams: JSON.stringify(fm.tablesParams || []),
          exceptions: JSON.stringify(fm.exceptions || []),
          source: fm.source,
          isExample: fm.isExample ?? true,
          active: true,
          topicId: fm.topicCode ? topicIds.get(fm.topicCode) ?? null : null,
        },
        create: {
          name: fm.name,
          groupName: fm.groupName,
          title: fm.title,
          importParams: JSON.stringify(fm.importParams || []),
          exportParams: JSON.stringify(fm.exportParams || []),
          changingParams: JSON.stringify(fm.changingParams || []),
          tablesParams: JSON.stringify(fm.tablesParams || []),
          exceptions: JSON.stringify(fm.exceptions || []),
          source: fm.source,
          isExample: fm.isExample ?? true,
          active: true,
          topicId: fm.topicCode ? topicIds.get(fm.topicCode) ?? null : null,
        },
      })
    }

    const counts = {
      topics: await db.topic.count(),
      tables: await db.dbTable.count(),
      rows: await db.dbRow.count(),
      programs: await db.program.count(),
      functions: await db.functionModule.count(),
      functionGroups: await db.functionGroup.count(),
    }
    return NextResponse.json({ ok: true, counts })
  } catch (error) {
    return serverError('seed', error)
  }
}
