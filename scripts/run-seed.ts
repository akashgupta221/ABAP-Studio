// Seed the database and verify every example program against the engine.
// Run: bun run scripts/run-seed.ts  (or `bun run deploy:db` for Turso)
//
// NON-DESTRUCTIVE: examples and syllabus content are upserted, never wiped.
// User accounts, private programs, favorites, and execution history survive
// every run. The old shared Z_MY_PRACTICE row is no longer seeded — each user
// gets a private sandbox through /api/sandbox.
import { db, ensureSchema } from '../src/lib/db'
import { topics, tables } from './seed-content'
import { programsPart1 } from './seed-programs-1'
import { programsPart2, functions, includeProgram } from './seed-programs-2'
import { modernPrograms } from './seed-modern'
import { runAbap, DbSnapshot, type FmEntry, type DbTableDef } from '../src/lib/abap/index'
import { validateModernSource } from '../src/lib/modern'
import { parseAbap } from '../src/lib/abap/parser'
import type { AbapProgram } from '../src/lib/abap/ast-types'

const programs = [...programsPart1, ...programsPart2, includeProgram, ...modernPrograms].filter(
  (p) => p.name !== 'Z_MY_PRACTICE',
)

async function seed() {
  console.log('── Seeding database (preserving user data) ──')
  await ensureSchema()

  await db.$transaction(
    async (tx) => {
      // topics
      const topicIds = new Map<string, number>()
      for (const t of topics) {
        const data = {
          srNo: t.srNo, title: t.title, summary: t.summary, details: t.details,
          paradigm: t.paradigm, category: t.category,
        }
        const saved = await tx.topic.upsert({
          where: { code: t.code },
          update: data,
          create: { code: t.code, ...data },
        })
        topicIds.set(t.code, saved.id)
      }
      console.log(`  topics: ${topics.length}`)

      // tables + rows
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
      console.log(`  tables: ${tables.length}, rows: ${tables.reduce((a, t) => a + (t as any).rows.length, 0)}`)

      // example programs (upsert by unique name; ownership/executions preserved)
      for (const p of programs as any[]) {
        const data = {
          title: p.title, description: p.description,
          type: p.type, paradigm: p.paradigm, source: p.source,
          environment: p.environment ?? 'STANDARD',
          modernKind: p.modernKind ?? 'ABAP',
          isExample: p.isExample ?? true, tags: p.tags ?? '',
          topicId: p.topicCode ? topicIds.get(p.topicCode) ?? null : null,
        }
        await tx.program.upsert({
          where: { name: p.name },
          update: data,
          create: { name: p.name, ...data },
        })
      }
      console.log(`  example programs: ${programs.length}`)

      // function modules
      for (const fm of functions as any[]) {
        const data = {
          groupName: fm.groupName, title: fm.title,
          importParams: JSON.stringify(fm.importParams || []),
          exportParams: JSON.stringify(fm.exportParams || []),
          changingParams: JSON.stringify(fm.changingParams || []),
          tablesParams: JSON.stringify(fm.tablesParams || []),
          exceptions: JSON.stringify(fm.exceptions || []),
          source: fm.source,
          isExample: fm.isExample ?? true,
          active: true,
          topicId: fm.topicCode ? topicIds.get(fm.topicCode) ?? null : null,
        }
        await tx.functionModule.upsert({
          where: { name: fm.name },
          update: data,
          create: { name: fm.name, ...data },
        })
      }
      console.log(`  function modules: ${functions.length}`)
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
}

async function buildContext() {
  // DB snapshot
  const snap = new DbSnapshot()
  const dbTables = await db.dbTable.findMany({ include: { rows: true } })
  for (const t of dbTables) {
    const fields = JSON.parse(t.fields || '[]') as any[]
    const def: DbTableDef = {
      name: t.name.toUpperCase(),
      description: t.description,
      fields: fields.map((f) => ({
        name: String(f.name).toUpperCase(), type: String(f.type || 'CHAR').toUpperCase(),
        length: f.length, decimals: f.decimals, key: !!f.key, text: f.text,
      })),
      rows: t.rows.sort((a, b) => a.seq - b.seq).map((r) => {
        const data = JSON.parse(r.data || '{}')
        const row: Record<string, string> = {}
        for (const k of Object.keys(data)) row[k.toUpperCase()] = String(data[k])
        return row
      }),
    }
    snap.tables.set(def.name, def)
  }
  // FMs
  const fms = new Map<string, FmEntry>()
  const fmRows = await db.functionModule.findMany()
  for (const fm of fmRows) {
    try {
      const prog: AbapProgram = parseAbap(fm.source || '')
      fms.set(fm.name.toUpperCase(), {
        name: fm.name.toUpperCase(),
        importing: JSON.parse(fm.importParams || '[]'),
        exporting: JSON.parse(fm.exportParams || '[]'),
        changing: JSON.parse(fm.changingParams || '[]'),
        tables: JSON.parse(fm.tablesParams || '[]'),
        prog,
      })
    } catch (e: any) {
      console.log(`  FM ${fm.name}: PARSE ERROR — ${e.message}`)
    }
  }
  // includes
  const includes = new Map<string, string>()
  const incRows = await db.program.findMany({ where: { type: 'INCLUDE' } })
  for (const inc of incRows) includes.set(inc.name.toUpperCase(), inc.source || '')
  return { snap, fms, includes }
}

async function verify() {
  console.log('\n── Verifying example programs against the engine ──')
  const { snap, fms, includes } = await buildContext()
  let pass = 0
  let fail = 0
  for (const p of programs as any[]) {
    if (p.environment === 'MODERN' && p.modernKind !== 'ABAP') {
      const validation = validateModernSource(p.modernKind, p.source)
      if (validation.status === 'VALID') {
        console.log(`✓ ${p.name} (${p.modernKind} validated — no runtime)`)
        pass++
      } else {
        console.log(`✗ ${p.name} — ${p.modernKind} validation failed`)
        for (const issue of validation.issues.filter((i) => i.severity === 'E')) {
          console.log(`    line ${issue.line}: ${issue.message}`)
        }
        fail++
      }
      continue
    }
    if (p.type === 'INCLUDE') {
      // includes are verified transitively via Z_INCLUDE_DEMO; just parse-check
      try {
        parseAbap(p.source)
        console.log(`✓ ${p.name} (parse ok — INCLUDE)`)
        pass++
      } catch (e: any) {
        console.log(`✗ ${p.name} — PARSE: ${e.message}`)
        fail++
      }
      continue
    }
    let result = runAbap({
      source: p.source, repid: p.name, db: snap,
      includes, functionModules: fms, persistLog: false,
    } as any)
    // handle selection screens by re-running with defaults
    if (result.status === 'REQUIRES_INPUT' && result.selectionScreen) {
      const params: Record<string, string | string[]> = {}
      for (const item of result.selectionScreen) {
        if (item.kind === 'param') params[item.name] = item.defaultValue || ''
        else params[item.name] = [item.defaultValue || '', item.defaultValueHigh || '']
      }
      result = runAbap({
        source: p.source, repid: p.name, db: snap,
        includes, functionModules: fms, parameters: params,
      } as any)
    }
    if (result.status === 'SUCCESS') {
      const outLine = result.list[0]?.segments.map((s) => s.text).join('') ?? ''
      console.log(`✓ ${p.name} (${result.durationMs}ms, ${result.list.length} lines${result.alv ? ', ALV' : ''}) "${outLine.slice(0, 50)}"`)
      pass++
    } else {
      console.log(`✗ ${p.name} — ${result.error?.kind}: ${result.error?.message} (line ${result.error?.line})`)
      fail++
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`)
  return { pass, fail }
}

async function main() {
  await seed()
  const { fail } = await verify()
  if (fail > 0) {
    console.log('\nSEED INCOMPLETE — fix failing programs')
    process.exit(1)
  }
  console.log('\nSEED COMPLETE ✓')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
