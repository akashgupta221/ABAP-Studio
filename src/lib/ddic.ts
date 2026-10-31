// ── DDIC maintenance (SE11): validation + service for user-created tables ──
// SAP example tables (isSap=true) are shared training content and stay
// read-only. Only the owner creates/maintains Z* tables; every signed-in user
// can USE all tables in ABAP (loadDbSnapshot feeds the engine automatically).
import { db } from '@/lib/db'

export const DDIC_FIELD_TYPES = [
  'CHAR', 'NUMC', 'DEC', 'QUAN', 'CURR', 'INT4', 'INT2', 'INT1', 'DATS', 'TIMS', 'STR', 'RAW',
] as const
export type DdicFieldType = (typeof DDIC_FIELD_TYPES)[number]

// types whose length is fixed by the engine
const FIXED_LENGTH: Partial<Record<DdicFieldType, number>> = { INT4: 4, INT2: 2, INT1: 1, DATS: 8, TIMS: 6 }
const VARIABLE_LENGTH: DdicFieldType[] = ['STR']
const LENGTH_TYPES: DdicFieldType[] = ['CHAR', 'NUMC', 'DEC', 'QUAN', 'CURR', 'RAW']

export interface DdicFieldInput {
  name?: unknown
  type?: unknown
  length?: unknown
  decimals?: unknown
  key?: unknown
  text?: unknown
}

export type Valid<T> = { ok: true; value: T }
export type Invalid = { ok: false; error: string }
type Result<T> = Valid<T> | Invalid

const fail = (error: string): Invalid => ({ ok: false, error })

/** Table name: Z or Y prefix (SAP customer namespace), 3–30 chars, upper-case letters/digits/underscore. */
export function validateTableName(input: unknown): Result<string> {
  if (typeof input !== 'string') return fail('Table name is required')
  const name = input.trim().toUpperCase()
  if (!/^[ZY][A-Z0-9_]{2,29}$/.test(name)) {
    return fail('Table name must start with Z or Y, then 2–29 letters, digits or underscore (customer namespace)')
  }
  return { ok: true, value: name }
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Field catalog: 1–60 fields, unique names, valid types, at least one key field. */
export function validateFields(input: unknown): Result<{ name: string; type: DdicFieldType; length: number | null; decimals: number | null; key: boolean; text: string }[]> {
  if (!Array.isArray(input)) return fail('Field catalog is required')
  if (input.length === 0) return fail('At least one field is required')
  if (input.length > 60) return fail('A table may have at most 60 fields')
  const seen = new Set<string>()
  const out: { name: string; type: DdicFieldType; length: number | null; decimals: number | null; key: boolean; text: string }[] = []
  for (const [i, raw] of input.entries()) {
    const f = raw as DdicFieldInput
    if (typeof f.name !== 'string' || !/^[A-Z][A-Z0-9_]{0,29}$/.test(f.name.trim().toUpperCase())) {
      return fail(`Field ${i + 1}: name must be 1–30 characters, starting with a letter`)
    }
    const name = f.name.trim().toUpperCase()
    if (seen.has(name)) return fail(`Field ${i + 1}: duplicate field name "${name}"`)
    seen.add(name)
    const type = String(f.type ?? 'CHAR').trim().toUpperCase() as DdicFieldType
    if (!DDIC_FIELD_TYPES.includes(type)) return fail(`Field ${name}: unknown data type "${type}"`)
    let length = toInt(f.length)
    let decimals = toInt(f.decimals)
    if (FIXED_LENGTH[type] !== undefined) {
      length = FIXED_LENGTH[type] // INT1/2/4, DATS, TIMS — fixed by the engine
      decimals = null
    } else if (VARIABLE_LENGTH.includes(type)) {
      length = null // STRING/XSTRING — variable
      decimals = null
    } else {
      if (length === null) length = type === 'CHAR' || type === 'NUMC' ? 10 : 11
      if (length < 1 || length > 500) return fail(`Field ${name}: length must be 1–500 for ${type}`)
      if (LENGTH_TYPES.includes(type) && LENGTH_TYPES.slice(0, 6).includes(type) && length > 16 && type !== 'CHAR' && type !== 'NUMC' && type !== 'RAW') {
        return fail(`Field ${name}: ${type} length must be 1–16`)
      }
      if (decimals !== null) {
        if (decimals < 0 || decimals > 14) return fail(`Field ${name}: decimals must be 0–14`)
        if (!['DEC', 'QUAN', 'CURR'].includes(type)) decimals = null
        else if (decimals >= length) return fail(`Field ${name}: decimals must be smaller than length`)
      } else if (['DEC', 'QUAN', 'CURR'].includes(type)) {
        decimals = 0
      }
    }
    const text = typeof f.text === 'string' && f.text.trim() ? f.text.trim().slice(0, 60) : name
    out.push({ name, type, length, decimals, key: f.key === true || f.key === 'X', text })
  }
  if (!out.some((f) => f.key)) return fail('A dictionary table needs at least one key field')
  return { ok: true, value: out }
}

/** Coerce one row of user input into normalized {FIELD: value} strings. */
export function normalizeRowData(fields: { name: string }[], data: unknown): Record<string, string> {
  const row: Record<string, string> = {}
  const src = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const upper: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(src)) upper[k.toUpperCase()] = v
  for (const f of fields) row[f.name] = String(upper[f.name] ?? '').slice(0, 500)
  return row
}

/** Key fields must be filled — the simulated database identifies rows by key. */
export function validateRowData(fields: { name: string; key: boolean }[], data: unknown): Result<Record<string, string>> {
  const row = normalizeRowData(fields, data)
  for (const f of fields) {
    if (f.key && row[f.name].trim() === '') return fail(`Key field ${f.name} must not be empty`)
  }
  return { ok: true, value: row }
}

// ── service (prisma) ────────────────────────────────────────────────────

export async function createTable(name: string, description: string, fields: ReturnType<typeof validateFields> extends Result<infer T> ? T : never) {
  return db.dbTable.create({
    data: {
      name,
      description: description.slice(0, 120),
      isSap: false,
      fields: JSON.stringify(fields),
    },
  })
}

export async function updateTable(name: string, description: string | undefined, fields: ReturnType<typeof validateFields> extends Result<infer T> ? T : never) {
  const existing = await db.dbTable.findUnique({ where: { name }, include: { rows: true } })
  if (!existing) return null
  if (existing.isSap) return 'SAP_EXAMPLE'
  const result = await db.dbTable.update({
    where: { name },
    data: {
      ...(description !== undefined ? { description: description.slice(0, 120) } : {}),
      fields: JSON.stringify(fields),
    },
  })
  // normalize existing rows to the new field catalog (fill missing, drop removed)
  const valid = new Set(fields.map((f: { name: string }) => f.name))
  for (const r of existing.rows) {
    const data = JSON.parse(r.data || '{}') as Record<string, unknown>
    const next: Record<string, string> = {}
    for (const f of fields as { name: string }[]) next[f.name] = String(data[f.name] ?? '').slice(0, 500)
    const changed = Object.keys(next).length !== Object.keys(data).filter((k) => valid.has(k)).length
      || (fields as { name: string }[]).some((f) => next[f.name] !== String(data[f.name] ?? ''))
    if (changed) {
      await db.dbRow.update({ where: { id: r.id }, data: { data: JSON.stringify(next) } })
    }
  }
  return result
}

export async function deleteTable(name: string) {
  const existing = await db.dbTable.findUnique({ where: { name } })
  if (!existing) return null
  if (existing.isSap) return 'SAP_EXAMPLE'
  await db.dbRow.deleteMany({ where: { tableId: existing.id } })
  await db.dbTable.delete({ where: { name } })
  return existing
}

export async function listRows(name: string) {
  const table = await db.dbTable.findUnique({ where: { name }, include: { rows: true } })
  if (!table) return null
  return table.rows
    .sort((a, b) => a.seq - b.seq)
    .map((r) => ({ seq: r.seq, data: JSON.parse(r.data || '{}') as Record<string, string> }))
}

export async function addRow(name: string, data: unknown) {
  const table = await db.dbTable.findUnique({ where: { name }, include: { rows: true } })
  if (!table) return null
  if (table.isSap) return 'SAP_EXAMPLE'
  const fields = JSON.parse(table.fields || '[]') as { name: string; key: boolean }[]
  const check = validateRowData(fields, data)
  if (!check.ok) return check
  const seq = table.rows.reduce((m, r) => Math.max(m, r.seq), 0) + 1
  return db.dbRow.create({ data: { tableId: table.id, data: JSON.stringify(check.value), seq } })
}

export async function deleteRow(name: string, seq: number) {
  const table = await db.dbTable.findUnique({ where: { name } })
  if (!table) return null
  if (table.isSap) return 'SAP_EXAMPLE'
  return db.dbRow.deleteMany({ where: { tableId: table.id, seq } })
}
