// ── SE16 selection criteria (per-field options like the SAP data browser) ──
// Shared by /api/tables/[name] so the same semantics are unit-testable.

export type SelectionOp = 'EQ' | 'NE' | 'GT' | 'LT' | 'GE' | 'LE' | 'BT' | 'CP'

export interface SelectionCriterion {
  field: string
  op: SelectionOp
  low?: string
  high?: string
}

const OPS: Set<string> = new Set(['EQ', 'NE', 'GT', 'LT', 'GE', 'LE', 'BT', 'CP'])

/**
 * Parse and validate the JSON `filters` query parameter.
 * Returns undefined when the parameter is absent, null when it is malformed,
 * and the validated criteria array otherwise.
 */
export function parseSelectionFilters(raw: string | null): SelectionCriterion[] | null | undefined {
  if (raw === null || raw === '') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const out: SelectionCriterion[] = []
  for (const item of parsed.slice(0, 10)) {
    if (typeof item !== 'object' || item === null) return null
    const it = item as Record<string, unknown>
    const field = typeof it.field === 'string' ? it.field.toUpperCase().replace(/[^A-Z0-9_/]/g, '') : ''
    const op = typeof it.op === 'string' ? it.op.toUpperCase() : ''
    if (!field || !OPS.has(op)) return null
    const low = typeof it.low === 'string' ? it.low : ''
    const high = typeof it.high === 'string' ? it.high : ''
    if (op === 'BT' && (!low || !high)) return null
    if (op !== 'CP' && !low) return null
    out.push({ field, op: op as SelectionOp, low, high })
  }
  return out
}

function numeric(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function wildcardToRegExp(pattern: string): RegExp {
  // SAP CP wildcards: * = any sequence, + = any single character
  let re = ''
  for (const ch of pattern) {
    if (ch === '*') re += '.*'
    else if (ch === '+') re += '.'
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`, 'i')
}

function cmpCell(cell: string, value: string): number {
  const nc = numeric(cell)
  const nv = numeric(value)
  if (nc !== null && nv !== null) return nc - nv
  const sc = cell.trimEnd()
  const sv = value.trimEnd()
  return sc < sv ? -1 : sc > sv ? 1 : 0
}

/** True when the row satisfies one criterion (SAP sign ICLUDE semantics — include). */
export function rowMatchesCriterion(row: Record<string, string>, c: SelectionCriterion): boolean {
  const cell = String(row[c.field] ?? '')
  switch (c.op) {
    case 'EQ':
      return cmpCell(cell, c.low ?? '') === 0
    case 'NE':
      return cmpCell(cell, c.low ?? '') !== 0
    case 'GT':
      return cmpCell(cell, c.low ?? '') > 0
    case 'LT':
      return cmpCell(cell, c.low ?? '') < 0
    case 'GE':
      return cmpCell(cell, c.low ?? '') >= 0
    case 'LE':
      return cmpCell(cell, c.low ?? '') <= 0
    case 'BT':
      return cmpCell(cell, c.low ?? '') >= 0 && cmpCell(cell, c.high ?? '') <= 0
    case 'CP':
      return wildcardToRegExp(c.low ?? '').test(cell)
  }
}

/** Apply the criteria in order; a row must satisfy every criterion. */
export function applySelectionFilters(
  rows: Record<string, string>[],
  criteria: SelectionCriterion[],
): Record<string, string>[] {
  if (criteria.length === 0) return rows
  return rows.filter((r) => criteria.every((c) => rowMatchesCriterion(r, c)))
}
