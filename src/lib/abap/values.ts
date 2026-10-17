// ── ABAP Engine: Runtime values, conversions, formatting ───────────────
import type { AbapTypeDef, ElemType, StructTypeDef, TableTypeDef, ElemTypeDef, ListSegment } from './ast-types'

export class RtElem {
  kind: 'elem' = 'elem'
  type: ElemType
  value: string | number | null
  length?: number
  decimals?: number
  readOnly?: boolean
  constructor(type: ElemType, value: string | number | null = null, length?: number, decimals?: number) {
    this.type = type
    this.value = value
    this.length = length
    this.decimals = decimals
  }
}

export class RtStruct {
  kind: 'struct' = 'struct'
  fields = new Map<string, RtValue>()
  typeName?: string // link to TYPES name or DDIC table
  constructor(typeName?: string) {
    this.typeName = typeName
  }
}

export class RtTable {
  kind: 'table' = 'table'
  lineType: AbapTypeDef
  rows: RtValue[] = []
  tableKind: 'STANDARD' | 'SORTED' | 'HASHED' = 'STANDARD'
  keyFields?: string[]
  headerLine?: RtValue
  constructor(lineType: AbapTypeDef, tableKind: 'STANDARD' | 'SORTED' | 'HASHED' = 'STANDARD', keyFields?: string[]) {
    this.lineType = lineType
    this.tableKind = tableKind
    this.keyFields = keyFields
  }
}

export class RtOref {
  kind: 'oref' = 'oref'
  clsName: string
  refType?: string // declared REF TO type (for CREATE OBJECT without TYPE)
  attrs = new Map<string, RtValue>()
  native?: NativeObject
  constructor(clsName: string, refType?: string) {
    this.clsName = clsName
    this.refType = refType
  }
}

export class RtDref {
  kind: 'dref' = 'dref'
  target: RtValue | null = null
}

export interface NativeObject {
  nativeKind: string
  data: Record<string, any>
}

export type RtValue = RtElem | RtStruct | RtTable | RtOref | RtDref

// ── initial values ─────────────────────────────────────────────────────
export function initialElem(type: ElemType, length?: number, decimals?: number): RtElem {
  const e = new RtElem(type, null, length, decimals)
  switch (type) {
    case 'I': case 'INT8': case 'B': case 'S': e.value = 0; break
    case 'F': e.value = 0; break
    case 'P': e.value = 0; break
    case 'C': e.value = ' '.repeat(length ?? 1); break
    case 'N': e.value = '0'.repeat(length ?? 1); break
    case 'D': e.value = '00000000'; break
    case 'T': e.value = '000000'; break
    case 'X': e.value = '00'.repeat(length ?? 1); break
    case 'STRING': case 'XSTRING': e.value = ''; break
  }
  return e
}

export function initialFromDef(def: AbapTypeDef): RtValue {
  switch (def.kind) {
    case 'elem': return initialElem(def.type, def.length, def.decimals)
    case 'struct': {
      const s = new RtStruct()
      for (const f of def.fields) s.fields.set(f.name, initialFromDef(f.type))
      return s
    }
    case 'table': return new RtTable(def.lineType, def.tableKind, def.keyFields)
    case 'oref': return new RtOref('', def.className)
    case 'dref': return new RtDref()
    case 'void': return initialElem('STRING')
  }
}

// ── conversions ────────────────────────────────────────────────────────
export function toNumber(v: RtValue): number {
  if (v.kind === 'elem') {
    if (v.value == null) return 0
    if (typeof v.value === 'number') return v.value
    const t = v.value.trim()
    if (t === '') return 0
    const n = parseFloat(t)
    return isNaN(n) ? 0 : n
  }
  if (v.kind === 'struct' || v.kind === 'table') return 0
  return 0
}

export function isNumericType(t: ElemType): boolean {
  return t === 'I' || t === 'INT8' || t === 'F' || t === 'P' || t === 'B' || t === 'S'
}

export function toStringValue(v: RtValue, forWrite = false): string {
  if (v.kind === 'elem') return formatElem(v, forWrite)
  if (v.kind === 'struct') {
    // dump fields
    let s = ''
    for (const f of v.fields.values()) s += toStringValue(f, forWrite)
    return s
  }
  if (v.kind === 'table') return ''
  return ''
}

export function formatElem(v: RtElem, forWrite = false): string {
  if (v.value == null) return ''
  switch (v.type) {
    case 'I': case 'INT8': case 'B': case 'S': {
      const n = typeof v.value === 'number' ? v.value : parseInt(v.value) || 0
      return String(Math.trunc(n))
    }
    case 'F': {
      const n = typeof v.value === 'number' ? v.value : parseFloat(v.value) || 0
      return String(parseFloat(n.toPrecision(15)))
    }
    case 'P': {
      const n = typeof v.value === 'number' ? v.value : parseFloat(v.value) || 0
      const dec = v.decimals ?? 0
      return n.toFixed(dec)
    }
    case 'C': {
      let s = typeof v.value === 'string' ? v.value : String(v.value)
      if (forWrite) return s.replace(/\s+$/, '') === '' ? s : s // keep trailing blanks (ABAP semantics)
      return s.replace(/\s+$/, '')
    }
    case 'N': {
      const s = typeof v.value === 'string' ? v.value : String(v.value)
      return s
    }
    case 'D': {
      const s = typeof v.value === 'string' ? v.value : ''
      if (forWrite && /^\d{8}$/.test(s)) {
        return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`
      }
      return s
    }
    case 'T': {
      const s = typeof v.value === 'string' ? v.value : ''
      if (forWrite && /^\d{6}$/.test(s)) {
        return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`
      }
      return s
    }
    case 'X': {
      const s = typeof v.value === 'string' ? v.value : ''
      return s
    }
    default:
      return typeof v.value === 'string' ? v.value : String(v.value)
  }
}

// assign source value INTO target elem with type adaptation
export function assignElem(target: RtElem, src: RtValue): void {
  if (target.readOnly) throw new Error('Attempt to change a constant')
  if (src.kind === 'oref' || src.kind === 'dref') {
    // assign oref to char? not allowed — ignore
    target.value = target.type === 'STRING' ? '' : initialElem(target.type, target.length, target.decimals).value
    return
  }
  if (src.kind === 'struct' || src.kind === 'table') {
    target.value = initialElem(target.type, target.length, target.decimals).value
    return
  }
  const s = src
  if (isNumericType(target.type) && (isNumericType(s.type) || s.type === 'N')) {
    const n = toNumber(s)
    if (target.type === 'I' || target.type === 'INT8' || target.type === 'B' || target.type === 'S') target.value = Math.trunc(n)
    else if (target.type === 'P') {
      const dec = target.decimals ?? 0
      target.value = parseFloat(n.toFixed(dec))
    } else target.value = n
    return
  }
  if (target.type === 'D') {
    let str = s.type === 'D' ? String(s.value ?? '') : ''
    if (s.type === 'STRING' || s.type === 'C') {
      // accept DD.MM.YYYY or YYYYMMDD
      const raw = String(s.value ?? '').trim()
      const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      if (m) str = `${m[3]}${m[2]}${m[1]}`
      else if (/^\d{8}$/.test(raw)) str = raw
      else str = '00000000'
    }
    target.value = str
    return
  }
  if (target.type === 'T') {
    let str = s.type === 'T' ? String(s.value ?? '') : ''
    if (s.type === 'STRING' || s.type === 'C') {
      const raw = String(s.value ?? '').replace(/:/g, '').trim()
      if (/^\d{6}$/.test(raw)) str = raw
      else str = '000000'
    }
    target.value = str
    return
  }
  if (target.type === 'N') {
    let str = isNumericType(s.type) ? String(Math.trunc(toNumber(s))) : String(s.value ?? '').trim()
    const len = target.length ?? 1
    str = str.replace(/[^0-9]/g, '')
    if (str.length < len) str = str.padStart(len, '0')
    target.value = str.slice(0, len)
    return
  }
  if (target.type === 'C') {
    let str: string
    if (isNumericType(s.type)) {
      str = formatElem(s)
    } else if (s.type === 'D') {
      str = String(s.value ?? '')
    } else if (s.type === 'T') {
      str = String(s.value ?? '')
    } else {
      str = String(s.value ?? '')
    }
    const len = target.length ?? 1
    if (str.length > len) str = str.slice(0, len)
    target.value = str
    return
  }
  // STRING / XSTRING
  if (isNumericType(s.type)) target.value = formatElem(s)
  else if (s.type === 'D') target.value = String(s.value ?? '')
  else if (s.type === 'T') target.value = String(s.value ?? '')
  else target.value = String(s.value ?? '')
}

// deep copy a runtime value
export function deepCopyValue(v: RtValue): RtValue {
  if (v.kind === 'elem') {
    const e = new RtElem(v.type, v.value, v.length, v.decimals)
    e.readOnly = v.readOnly
    return e
  }
  if (v.kind === 'struct') {
    const s = new RtStruct(v.typeName)
    for (const [k, f] of v.fields) s.fields.set(k, deepCopyValue(f))
    return s
  }
  if (v.kind === 'table') {
    const t = new RtTable(v.lineType, v.tableKind, v.keyFields)
    t.rows = v.rows.map((r) => deepCopyValue(r))
    return t
  }
  if (v.kind === 'oref') return v // references shared
  if (v.kind === 'dref') return v
  return v
}

export function isInitial(v: RtValue): boolean {
  if (v.kind === 'elem') {
    if (v.value == null) return true
    if (typeof v.value === 'number') return v.value === 0
    const s = v.value
    if (isNumericType(v.type)) return parseFloat(s) === 0 || s.trim() === ''
    return s.trim() === '' || /^0+$/.test(s) || s === '00000000' || s === '000000'
  }
  if (v.kind === 'struct') {
    for (const f of v.fields.values()) if (!isInitial(f)) return false
    return true
  }
  if (v.kind === 'table') return v.rows.length === 0
  if (v.kind === 'oref') return v.clsName === ''
  if (v.kind === 'dref') return v.target === null
  return true
}

// value equality ABAP-style
export function valuesEqual(a: RtValue, b: RtValue): boolean {
  if (a.kind === 'elem' && b.kind === 'elem') {
    if (isNumericType(a.type) || isNumericType(b.type)) {
      // numeric comparison if either numeric
      if (isNumericType(a.type) || isNumericType(b.type) || a.type === 'N' || b.type === 'N') {
        const na = toNumber(a)
        const nb = toNumber(b)
        return numEq(na, nb)
      }
    }
    if (a.type === 'D' && b.type === 'D') return String(a.value) === String(b.value)
    return String(a.value ?? '').trimEnd() === String(b.value ?? '').trimEnd()
  }
  if (a.kind === 'struct' && b.kind === 'struct') {
    for (const [k, f] of a.fields) {
      const g = b.fields.get(k)
      if (!g || !valuesEqual(f, g)) return false
    }
    return true
  }
  if (a.kind === 'table' && b.kind === 'table') {
    if (a.rows.length !== b.rows.length) return false
    for (let i = 0; i < a.rows.length; i++) if (!valuesEqual(a.rows[i], b.rows[i])) return false
    return true
  }
  if (a.kind === 'oref' && b.kind === 'oref') return a === b
  return false
}

function numEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

export function compareValues(a: RtValue, b: RtValue): number {
  if (a.kind === 'elem' && b.kind === 'elem') {
    if (isNumericType(a.type) || isNumericType(b.type) || a.type === 'N' || b.type === 'N') {
      return toNumber(a) - toNumber(b)
    }
    const sa = String(a.value ?? '')
    const sb = String(b.value ?? '')
    return sa < sb ? -1 : sa > sb ? 1 : 0
  }
  const sa = toStringValue(a)
  const sb = toStringValue(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

// ── type helpers ───────────────────────────────────────────────────────
export function elemDefOf(type: ElemType, length?: number, decimals?: number): ElemTypeDef {
  return { kind: 'elem', type, length, decimals }
}
export function structDefOf(fields: { name: string; type: AbapTypeDef }[]): StructTypeDef {
  return { kind: 'struct', fields }
}
export function tableDefOf(lineType: AbapTypeDef, tableKind: 'STANDARD' | 'SORTED' | 'HASHED' = 'STANDARD'): TableTypeDef {
  return { kind: 'table', lineType, tableKind }
}

// WRITE output length per type (approximation of ABAP output length)
export function outputLength(v: RtValue): number {
  if (v.kind !== 'elem') return 0
  switch (v.type) {
    case 'I': return 11
    case 'INT8': return 20
    case 'F': return 16
    case 'P': {
      const len = v.length ?? 8
      const dec = v.decimals ?? 0
      return len + (dec > 0 ? dec + 1 : 1)
    }
    case 'C': return v.length ?? 1
    case 'N': return v.length ?? 1
    case 'D': return 10
    case 'T': return 8
    case 'X': return (v.length ?? 1) * 2
    case 'STRING': return String(v.value ?? '').length
    case 'XSTRING': return String(v.value ?? '').length
    default: return 10
  }
}

// format a value for WRITE output (with type-specific justification handled by caller)
export function writeText(v: RtValue, opts?: { noSign?: boolean; noZero?: boolean }): { text: string; kind: 'text' | 'number' | 'date' | 'time'; outLen: number } {
  if (v.kind === 'elem') {
    let text = formatElem(v, true)
    let kind: 'text' | 'number' | 'date' | 'time' = 'text'
    switch (v.type) {
      case 'I': case 'INT8': case 'F': case 'P': case 'B': case 'S': kind = 'number'; break
      case 'D': kind = 'date'; break
      case 'T': kind = 'time'; break
      default: kind = 'text'
    }
    if (opts?.noSign && text.startsWith('-')) text = text.slice(1)
    if (opts?.noZero && isInitial(v)) text = ''
    return { text, kind, outLen: outputLength(v) }
  }
  if (v.kind === 'struct') {
    let s = ''
    for (const f of v.fields.values()) s += writeText(f).text
    return { text: s, kind: 'text', outLen: s.length }
  }
  if (v.kind === 'table') return { text: `<TABLE[${v.rows.length}]>`, kind: 'text', outLen: 12 }
  if (v.kind === 'oref') return { text: `<OBJECT:${v.clsName || '?'}>`, kind: 'text', outLen: 15 }
  if (v.kind === 'dref') return { text: `<REF>`, kind: 'text', outLen: 5 }
  return { text: '', kind: 'text', outLen: 0 }
}

// serialize any RtValue into plain JSON for transport (ALV rows etc.)
export function serializeForClient(v: RtValue): any {
  if (v.kind === 'elem') {
    const disp = formatElem(v, true)
    return disp
  }
  if (v.kind === 'struct') {
    const o: Record<string, any> = {}
    for (const [k, f] of v.fields) o[k] = serializeForClient(f)
    return o
  }
  if (v.kind === 'table') {
    return v.rows.map((r) => serializeForClient(r))
  }
  return null
}

export function makeSegment(text: string, x: number, extra?: Partial<ListSegment>): ListSegment {
  return { text, x, len: text.length, ...extra }
}

// today / now helpers
export function todayYYYYMMDD(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
export function nowHHMMSS(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
}
