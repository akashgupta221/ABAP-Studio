// Shared loaders: build engine inputs (DB snapshot, FMs, includes) from Prisma data
import { db, ensureSchema } from '@/lib/db'
import { ensureSeeded } from '@/lib/ensure-seed'
import { DbSnapshot, type FmEntry, type DbTableDef } from '@/lib/abap'
import { parseAbap } from '@/lib/abap/parser'
import { functionListWhere, programListWhere, type AccessUser } from '@/lib/access'

export async function loadDbSnapshot(): Promise<DbSnapshot> {
  // executions need the full demo model — seed on first use (idempotent)
  await ensureSeeded()
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

export interface EngineViewer {
  user: AccessUser
  owner: boolean
}

/**
 * Load only the function modules the viewer is allowed to call. Examples are
 * shared; private modules are scoped to their creator (the owner may load all).
 * This is critical: a user's ABAP must never be able to invoke another user's
 * private function module by guessing its name.
 */
export async function loadFunctionModules(
  viewer: EngineViewer,
  activeOnly = true,
): Promise<Map<string, FmEntry>> {
  const out = new Map<string, FmEntry>()
  const access = functionListWhere(viewer.user, viewer.owner)
  const where = activeOnly ? { ...access, active: true } : access
  const fms = await db.functionModule.findMany({ where })
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

export async function loadIncludes(viewer: EngineViewer): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  // Includes follow the same privacy contract as programs. Otherwise a user
  // could INCLUDE another user's private source by guessing its name.
  const includes = await db.program.findMany({
    where: { type: 'INCLUDE', ...programListWhere(viewer.user, viewer.owner) },
  })
  for (const inc of includes) out.set(inc.name.toUpperCase(), inc.source || '')
  return out
}

export async function loadEngineContext(viewer: EngineViewer) {
  // Execution may be the first request after a deploy, before the Function
  // Builder screen has run its additive migration. Wait for it here so a
  // program run never queries columns that do not exist yet.
  await ensureSchema()
  const [dbSnap, fms, includes, messageClasses, numberRanges, files] = await Promise.all([
    loadDbSnapshot(),
    loadFunctionModules(viewer),
    loadIncludes(viewer),
    loadMessageClasses(),
    loadNumberRanges(),
    loadAppServerFiles(),
  ])
  return { dbSnap, fms, includes, messageClasses, numberRanges, files }
}

// ── SE91 message classes: class → number → text ───────────────────────
export async function loadMessageClasses(): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>()
  const classes = await db.messageClass.findMany()
  for (const mc of classes) {
    const msgs: { number: string; text: string }[] = JSON.parse(mc.messages || '[]')
    out.set(mc.name.toUpperCase(), Object.fromEntries(msgs.map((m) => [String(m.number).padStart(3, '0'), m.text])))
  }
  return out
}

// ── SNRO number ranges: object → interval state ───────────────────────
export async function loadNumberRanges(): Promise<Map<string, { from: number; to: number; current: number }>> {
  const out = new Map<string, { from: number; to: number; current: number }>()
  const ranges = await db.numberRange.findMany()
  for (const r of ranges) out.set(r.object.toUpperCase(), { from: r.fromNumber, to: r.toNumber, current: r.currentNumber })
  return out
}

// ── AL11 application server files: path → content ─────────────────────
export async function loadAppServerFiles(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const list = await db.appServerFile.findMany()
  for (const f of list) out.set(f.path, f.content)
  return out
}
