// Auto-seed guard — ensures the pre-stored content (10 syllabus topics,
// 11 SAP demo tables + rows, 36 example programs, FMs) always exists.
//
// Why: the SQLite file can be missing/empty after a fresh clone, a redeploy,
// or an environment reset. Instead of requiring a manual `bun run seed`,
// the first API request will detect the empty repository and seed it once
// per server process (cached promise, non-destructive: never wipes data).
import { db } from '@/lib/db'

let seedPromise: Promise<boolean> | null = null

async function seedIfEmpty(): Promise<boolean> {
  // Fast pre-check: any topic row means the repository is already seeded.
  const topicCount = await db.topic.count().catch(() => -1)

  // -1 => the table itself is missing (schema never pushed). In a sandbox /
  // deploy where we can't run migrations, bail out gracefully — API routes
  // will surface a clear error instead of crashing the server.
  if (topicCount === -1) return false
  if (topicCount > 0) return true

  // Empty repository → import seed payloads (pure data modules) and fill it.
  console.log('[ensure-seed] Repository empty — seeding pre-stored content…')
  const [{ topics, tables }, { programsPart1 }, { programsPart2, functions, includeProgram }] =
    await Promise.all([
      import('../../scripts/seed-content'),
      import('../../scripts/seed-programs-1'),
      import('../../scripts/seed-programs-2'),
    ])

  // topics
  const topicIds = new Map<string, number>()
  for (const t of topics as any[]) {
    const created = await db.topic.create({
      data: {
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

  // tables + rows
  for (const t of tables as any[]) {
    const created = await db.dbTable.create({
      data: {
        name: t.name,
        description: t.description,
        isSap: t.isSap ?? true,
        fields: JSON.stringify(t.fields),
        topicId: t.topicCode ? topicIds.get(t.topicCode) ?? null : null,
      },
    })
    let seq = 0
    for (const row of t.rows || []) {
      await db.dbRow.create({ data: { tableId: created.id, data: JSON.stringify(row), seq: seq++ } })
    }
  }

  // programs (part1 + part2 + include)
  const programs = [...(programsPart1 as any[]), ...(programsPart2 as any[]), includeProgram as any]
  for (const p of programs) {
    await db.program.create({
      data: {
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
  for (const fm of functions as any[]) {
    await db.functionModule.create({
      data: {
        name: fm.name,
        groupName: fm.groupName,
        title: fm.title,
        importParams: JSON.stringify(fm.importParams || []),
        exportParams: JSON.stringify(fm.exportParams || []),
        changingParams: JSON.stringify(fm.changingParams || []),
        tablesParams: JSON.stringify(fm.tablesParams || []),
        source: fm.source,
        isExample: fm.isExample ?? true,
        topicId: fm.topicCode ? topicIds.get(fm.topicCode) ?? null : null,
      },
    })
  }

  console.log(
    `[ensure-seed] Done: ${topics.length} topics, ${tables.length} tables, ${programs.length} programs, ${functions.length} FMs`
  )
  return true
}

/**
 * Call at the top of read-heavy API routes (topics/programs/tables/functions/
 * search/execute). Runs at most once per server process; resolves immediately
 * once the repository is known to be populated.
 */
export function ensureSeeded(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = seedIfEmpty().catch((e) => {
      // Reset so a later request can retry after a transient failure.
      seedPromise = null
      console.error('[ensure-seed] failed:', e?.message ?? e)
      return false
    }) as Promise<boolean>
  }
  return seedPromise
}
