// Function Builder (SE37) helpers shared by the API routes.
// Parameter JSON is intentionally validated here rather than trusting the
// browser: names/types are upper-cased, scalar values are bounded, and any
// executable source is handled by the normal ABAP engine.

export const FM_NAME_RE = /^[ZY][A-Z0-9_]{0,29}$/
export const FUNCTION_GROUP_NAME_RE = /^[ZY][A-Z0-9_]{0,25}$/
export const MAX_FM_SOURCE_BYTES = 200_000

export interface FmParam {
  name: string
  type?: string
  default?: string
  optional?: boolean
  length?: number
  decimals?: number
  [key: string]: unknown
}

export interface FmParams {
  import: FmParam[]
  export: FmParam[]
  changing: FmParam[]
  tables: FmParam[]
  exceptions: string[]
}

export interface FunctionModuleLike {
  name: string
  groupName: string
  title: string
  importParams: string
  exportParams: string
  changingParams: string
  tablesParams: string
  exceptions?: string
  source: string
  isExample: boolean
  active?: boolean
  ownerId?: string | null
  createdBy?: string
  changedBy?: string
  changedOn?: string
}

export function emptyFmParams(): FmParams {
  return { import: [], export: [], changing: [], tables: [], exceptions: [] }
}

function paramArray(raw: unknown): FmParam[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const p = (item ?? {}) as Record<string, unknown>
      const name = String(p.name ?? '').trim().toUpperCase()
      if (!/^[A-Z0-9_]{1,30}$/.test(name)) return null
      const out: FmParam = {
        name,
        type: String(p.type ?? '').trim().toUpperCase().slice(0, 64),
        optional: Boolean(p.optional),
        default: String(p.default ?? '').slice(0, 200),
      }
      const length = Number(p.length)
      if (Number.isFinite(length) && length > 0) out.length = Math.min(Math.floor(length), 500)
      const decimals = Number(p.decimals)
      if (Number.isFinite(decimals) && decimals > 0) out.decimals = Math.min(Math.floor(decimals), 16)
      return out
    })
    .filter((p): p is FmParam => p !== null)
}

function exceptionArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => String(item ?? '').trim().toUpperCase())
    .filter((name) => /^[A-Z0-9_]{1,30}$/.test(name))
}

/** Parse the five JSON columns and always return a usable shape. */
export function parseFmParams(row: Partial<FunctionModuleLike>): FmParams {
  const parse = (json: string | undefined): unknown => {
    try {
      return JSON.parse(json || '[]')
    } catch {
      return []
    }
  }
  return {
    import: paramArray(parse(row.importParams)),
    export: paramArray(parse(row.exportParams)),
    changing: paramArray(parse(row.changingParams)),
    tables: paramArray(parse(row.tablesParams)),
    exceptions: exceptionArray(parse(row.exceptions)),
  }
}

/** Canonicalise a browser-supplied params object. */
export function sanitizeFmParams(raw: unknown): FmParams {
  if (!raw || typeof raw !== 'object') return emptyFmParams()
  const p = raw as Record<string, unknown>
  return {
    import: paramArray(p.import),
    export: paramArray(p.export),
    changing: paramArray(p.changing),
    tables: paramArray(p.tables),
    exceptions: exceptionArray(p.exceptions),
  }
}

export function serializeFmParams(params: FmParams): {
  importParams: string
  exportParams: string
  changingParams: string
  tablesParams: string
  exceptions: string
} {
  return {
    importParams: JSON.stringify(params.import),
    exportParams: JSON.stringify(params.export),
    changingParams: JSON.stringify(params.changing),
    tablesParams: JSON.stringify(params.tables),
    exceptions: JSON.stringify(params.exceptions),
  }
}

export function defaultFmSource(name: string, title: string): string {
  return `FUNCTION ${name.toLowerCase()}.
*"----------------------------------------------------------------------
*"*" Local Interface:
*"  (maintain parameters on the Import / Export / Changing / Tables /
*"   Exceptions tabs of the Function Builder)
*"----------------------------------------------------------------------

* ${title || `TODO: implement ${name.toLowerCase()}`}

ENDFUNCTION.
`
}

export function changedOnNow(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Escape a value for an ABAP character literal. */
function abapLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
}

/**
 * Build a small generated report that calls an FM and prints its outputs.
 * The normal engine executes it, so a test uses exactly the same database
 * snapshot, CALL FUNCTION binding and runtime limits as a program run.
 */
export function buildFmTestSource(
  fm: FunctionModuleLike,
  inputs: Record<string, string>,
  knownStructures: Record<string, string[]> = {},
): { source: string; outputs: string[]; notes: string[] } {
  const params = parseFmParams(fm)
  const notes: string[] = []
  const lines: string[] = ['REPORT ZFM_TEST.', '']
  const outputNames: string[] = []
  const declared = new Set<string>()

  const typeFor = (param: FmParam): string => {
    const t = String(param.type ?? '').trim().toUpperCase()
    if (t && knownStructures[t]) return t
    return 'STRING'
  }

  const declare = (param: FmParam) => {
    const varName = `gv_${param.name}`
    if (declared.has(varName)) return
    declared.add(varName)
    const typ = typeFor(param)
    const decimals = typ === 'P' && param.decimals ? ` DECIMALS ${param.decimals}` : ''
    lines.push(`DATA ${varName} TYPE ${typ}${decimals}.`)
  }

  const assignInputs = params.import.filter((p) => !knownStructures[String(p.type ?? '').toUpperCase()])
  for (const p of params.import) declare(p)
  for (const p of params.changing) declare(p)
  for (const p of params.export) {
    declare(p)
    outputNames.push(p.name)
  }
  for (const p of params.changing) outputNames.push(p.name)

  if (params.tables.length) {
    notes.push('Table parameters are listed but are not populated by the test console.')
  }

  for (const p of assignInputs) {
    const value = inputs[p.name] ?? inputs[p.name.toUpperCase()] ?? ''
    if (value !== '') lines.push(`gv_${p.name} = ${abapLiteral(value)}.`)
  }
  for (const p of params.changing) {
    const value = inputs[p.name] ?? inputs[p.name.toUpperCase()] ?? ''
    if (value !== '') lines.push(`gv_${p.name} = ${abapLiteral(value)}.`)
  }

  lines.push('')
  lines.push(`CALL FUNCTION ${abapLiteral(fm.name.toUpperCase())}`)
  const addSection = (label: string, list: FmParam[], useVariables: boolean) => {
    if (!list.length) return
    lines.push(`  ${label}`)
    for (const p of list) {
      lines.push(`    ${p.name} = ${useVariables ? `gv_${p.name}` : 'gv_undefined'}`)
    }
  }
  addSection('EXPORTING', params.import, true)
  addSection('IMPORTING', params.export, true)
  addSection('CHANGING', params.changing, true)
  lines.push('  EXCEPTIONS')
  lines.push('    OTHERS = 1.')
  lines.push('')
  lines.push("WRITE: / 'FM_SUBRC|', sy-subrc.")
  for (const p of [...params.export, ...params.changing]) {
    const typ = String(p.type ?? '').toUpperCase()
    const fields = knownStructures[typ]
    if (fields && fields.length) {
      const pieces = fields.slice(0, 12).map((field) => `gv_${p.name}-${field}`)
      lines.push(`WRITE: / 'FM_OUT|${p.name}|', ${pieces.join(", '|', ")}.`)
    } else {
      lines.push(`WRITE: / 'FM_OUT|${p.name}|', gv_${p.name}.`)
    }
  }
  lines.push('')

  return { source: lines.join('\n'), outputs: outputNames, notes }
}

export function listLinesToText(
  lines: Array<{ segments: Array<{ text: string }> }>,
): string[] {
  return lines.map((line) => line.segments.map((segment) => segment.text).join('').trimEnd())
}

export function toFunctionDto(
  row: FunctionModuleLike & { id?: string; ownerId?: string | null },
  ownerUsername?: string | null,
) {
  const params = parseFmParams(row)
  return {
    id: row.id,
    name: row.name,
    groupName: row.groupName,
    title: row.title,
    isExample: row.isExample,
    active: row.active ?? true,
    ownerId: row.ownerId ?? null,
    ownerUsername: ownerUsername ?? null,
    createdBy: row.createdBy ?? 'SAP',
    changedBy: row.changedBy ?? '',
    changedOn: row.changedOn ?? '',
    importParams: params.import,
    exportParams: params.export,
    changingParams: params.changing,
    tablesParams: params.tables,
    exceptions: params.exceptions,
    source: row.source,
  }
}
