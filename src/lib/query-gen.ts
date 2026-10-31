// ── ABAP Query (SQ01/SQ02): generate real ABAP from a query definition ──
import type { DbSnapshot } from '@/lib/abap'

export interface QueryFilter {
  field: string
  op: 'EQ' | 'NE' | 'GT' | 'LT' | 'GE' | 'LE' | 'BT' | 'CP'
  low: string
  high?: string
}

const OPS: Record<QueryFilter['op'], string> = {
  EQ: '=', NE: '<>', GT: '>', LT: '<', GE: '>=', LE: '<=', BT: 'BETWEEN', CP: 'LIKE',
}

function sqlLiteral(v: string): string {
  const clean = v.replace(/'/g, "''")
  return `'${clean}'`
}

/** Generate the ABAP source for a query. Throws when the definition is invalid. */
export function generateQuerySource(
  baseTable: string,
  fields: string[],
  filters: QueryFilter[],
  db: DbSnapshot,
): { source: string; outputFields: string[] } {
  const table = db.get(baseTable)
  if (!table) throw new Error(`Infoset base table ${baseTable} is not in the dictionary`)
  const tableFields = table.fields.map((f) => f.name.toUpperCase())

  let outputFields = fields.map((f) => f.toUpperCase()).filter((f) => tableFields.includes(f))
  if (outputFields.length === 0) outputFields = tableFields

  const whereParts: string[] = []
  for (const flt of filters) {
    const field = flt.field.toUpperCase()
    if (!tableFields.includes(field)) throw new Error(`Filter field ${field} is not a field of ${baseTable}`)
    const op = OPS[flt.op] ?? '='
    if (flt.op === 'BT') {
      whereParts.push(`${field} BETWEEN ${sqlLiteral(flt.low)} AND ${sqlLiteral(flt.high ?? '')}`)
    } else {
      whereParts.push(`${field} ${op} ${sqlLiteral(flt.low)}`)
    }
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''
  const source = `REPORT ZQUERY_GENERATED.

DATA it TYPE STANDARD TABLE OF ${baseTable} WITH DEFAULT KEY.
DATA wa TYPE ${baseTable}.

SELECT * FROM ${baseTable} INTO TABLE it ${where}.
WRITE: / 'Entries found:', lines( it ).
ULINE.
LOOP AT it INTO wa.
  WRITE: / ${outputFields.map((f) => `wa-${f}`).join(', ')}.
ENDLOOP.
`
  return { source, outputFields }
}
