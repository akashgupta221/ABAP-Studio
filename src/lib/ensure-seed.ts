// Auto-seed guard — ensures the pre-stored content (10 syllabus topics,
// 11 SAP demo tables + rows, 36 example programs, FMs) always exists.
//
// Why: the SQLite file can be missing/empty after a fresh clone, a redeploy,
// or an environment reset. Instead of requiring a manual `bun run seed`,
// the first API request will detect the empty repository and seed it once
// per server process (cached promise).
//
// Deploy-safe: fully idempotent (upserts on unique keys, rows replaced per
// table), so concurrent cold-start instances on serverless platforms
// (Vercel/Netlify) can never create duplicates or partial state.
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

  // Atomic: on serverless platforms multiple cold-start instances can race —
  // the transaction + upserts guarantee a consistent final state every time.
  const programs = [...(programsPart1 as any[]), ...(programsPart2 as any[]), includeProgram as any]
  await db.$transaction(
    async (tx) => {
      // topics (idempotent on unique `code`)
      const topicIds = new Map<string, number>()
      for (const t of topics as any[]) {
        const data = {
          srNo: t.srNo,
          title: t.title,
          summary: t.summary,
          details: t.details,
          paradigm: t.paradigm,
          category: t.category,
        }
        const saved = await tx.topic.upsert({
          where: { code: t.code },
          update: data,
          create: { code: t.code, ...data },
        })
        topicIds.set(t.code, saved.id)
      }

      // tables + rows (idempotent on unique `name`; rows replaced)
      for (const t of tables as any[]) {
        const fields = JSON.stringify(t.fields)
        const data = {
          description: t.description,
          isSap: t.isSap ?? true,
          fields,
          topicId: t.topicCode ? topicIds.get(t.topicCode) ?? null : null,
        }
        const saved = await tx.dbTable.upsert({
          where: { name: t.name },
          update: data,
          create: { name: t.name, ...data },
        })
        await tx.dbRow.deleteMany({ where: { tableId: saved.id } })
        let seq = 0
        for (const row of t.rows || []) {
          await tx.dbRow.create({ data: { tableId: saved.id, data: JSON.stringify(row), seq: seq++ } })
        }
      }

      // programs (idempotent on unique `name`) — part1 + part2 + include
      for (const p of programs) {
        const data = {
          title: p.title,
          description: p.description,
          type: p.type,
          paradigm: p.paradigm,
          source: p.source,
          isExample: p.isExample ?? true,
          tags: p.tags ?? '',
          topicId: p.topicCode ? topicIds.get(p.topicCode) ?? null : null,
        }
        await tx.program.upsert({
          where: { name: p.name },
          update: data,
          create: { name: p.name, ...data },
        })
      }

      // function modules (idempotent on unique `name`)
      for (const fm of functions as any[]) {
        const data = {
          groupName: fm.groupName,
          title: fm.title,
          importParams: JSON.stringify(fm.importParams || []),
          exportParams: JSON.stringify(fm.exportParams || []),
          changingParams: JSON.stringify(fm.changingParams || []),
          tablesParams: JSON.stringify(fm.tablesParams || []),
          source: fm.source,
          isExample: fm.isExample ?? true,
          topicId: fm.topicCode ? topicIds.get(fm.topicCode) ?? null : null,
        }
        await tx.functionModule.upsert({
          where: { name: fm.name },
          update: data,
          create: { name: fm.name, ...data },
        })
      }
    },
    { timeout: 120_000, maxWait: 30_000 }
  )

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
      // Reset so a later request can retry after a transient failure
      // (e.g. a concurrent instance already seeded — next request sees data).
      seedPromise = null
      console.error('[ensure-seed] failed:', e?.message ?? e)
      return false
    }) as Promise<boolean>
  }
  return seedPromise
}
