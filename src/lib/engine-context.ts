// Shared loaders: build engine inputs (DB snapshot, FMs, includes) from Prisma data
import { db } from '@/lib/db'
import { DbSnapshot, type FmEntry, type DbTableDef } from '@/lib/abap'
import { parseAbap } from '@/lib/abap/parser'

export async function loadDbSnapshot(): Promise<DbSnapshot> {
  const snap = new DbSnapshot()
  const tables = await db.dbTable.findMany({
    include: { rows: true },
    orderBy: { name: 'asc' },
  })
  for (const t of tables) {
    const fields = JSON.parse(t.fields || '[]') as any[]
    const def: DbTableDef = {
      name: t.name.toUpperCase(),
      description: t.description,
      fields: fields.map((f) => ({
        name: String(f.name).toUpperCase(),
        type: String(f.type || 'CHAR').toUpperCase(),
        length: f.length,
        decimals: f.decimals,
        key: !!f.key,
        text: f.text,
      })),
      rows: t.rows
        .sort((a, b) => a.seq - b.seq)
        .map((r) => {
          const data = JSON.parse(r.data || '{}')
          const row: Record<string, string> = {}
          for (const k of Object.keys(data)) row[k.toUpperCase()] = String(data[k])
          return row
        }),
    }
    snap.tables.set(def.name, def)
  }
  return snap
}

export async function loadFunctionModules(): Promise<Map<string, FmEntry>> {
  const out = new Map<string, FmEntry>()
  const fms = await db.functionModule.findMany()
  for (const fm of fms) {
    try {
      const prog = parseAbap(fm.source || '')
      out.set(fm.name.toUpperCase(), {
        name: fm.name.toUpperCase(),
        importing: JSON.parse(fm.importParams || '[]'),
        exporting: JSON.parse(fm.exportParams || '[]'),
        changing: JSON.parse(fm.changingParams || '[]'),
        tables: JSON.parse(fm.tablesParams || '[]'),
        prog,
      })
    } catch {
      // skip unparsable FM
    }
  }
  return out
}

export async function loadIncludes(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const includes = await db.program.findMany({ where: { type: 'INCLUDE' } })
  for (const inc of includes) out.set(inc.name.toUpperCase(), inc.source || '')
  return out
}

export async function loadEngineContext() {
  const [dbSnap, fms, includes] = await Promise.all([
    loadDbSnapshot(),
    loadFunctionModules(),
    loadIncludes(),
  ])
  return { dbSnap, fms, includes }
}
