// ── ABAP Engine: Native SAP classes (cl_salv_table, cl_demo_output, cx_*) ──
import { RtOref, RtElem, RtValue, RtTable, RtStruct, toStringValue, formatElem } from './values'
import type { CallArg } from './ast-types'
import { RtDump } from './interpreter'

type Interp = any // Interpreter (loose to avoid circular imports)

function findArg(args: CallArg[], ...names: string[]): CallArg | undefined {
  return args.find((a) => names.includes((a.name ?? '').toUpperCase()))
}

function nativeOref(cls: string, nativeKind: string, data: Record<string, any>): RtOref {
  const o = new RtOref(cls)
  o.native = { nativeKind, data }
  return o
}

// ── static dispatch ────────────────────────────────────────────────────
export function callNativeStatic(interp: Interp, cls: string, method: string, args: CallArg[], scope: any): RtValue {
  const U = method.toUpperCase()
  if (cls === 'CL_SALV_TABLE') {
    if (U === 'FACTORY') {
      const rArg = findArg(args, 'R_SALV_TABLE')
      const tArg = findArg(args, 'T_TABLE')
      if (!tArg) throw new RtDump('CL_SALV_TABLE=>FACTORY: CHANGING t_table is required', 'CALL_FUNCTION_PARM_UNKNOWN')
      const tableBox = interp.resolveBox(tArg.value, scope)
      const oref = nativeOref('CL_SALV_TABLE', 'cl_salv_table', {
        tableBox,
        title: '',
        columnOverrides: new Map<string, { label?: string; visible?: boolean }>(),
      })
      if (rArg) interp.resolveBox(rArg.value, scope).set(oref)
      return new RtElem('I', 0)
    }
    throw new RtDump(`Static method ${method} not supported on ${cls}`, 'METHOD_UNKNOWN')
  }
  if (cls === 'CL_DEMO_OUTPUT') {
    if (U === 'NEW') return newDemoInstance(interp)
    if (U === 'WRITE') {
      demoWrite(interp, args, scope)
      return newDemoInstance(interp)
    }
    if (U === 'WRITE_TEXT') {
      demoWriteText(interp, args, scope)
      return newDemoInstance(interp)
    }
    if (U === 'DISPLAY') {
      demoWrite(interp, args, scope)
      demoDisplay(interp)
      return newDemoInstance(interp)
    }
    if (U === 'LINE' || U === 'NEXT_LINE') {
      getDemoBuf(interp).push({ type: 'blank' })
      return newDemoInstance(interp)
    }
    if (U === 'BEGIN_SECTION' || U === 'END_SECTION' || U === 'BEGIN_BLOCK' || U === 'END_BLOCK') {
      return newDemoInstance(interp)
    }
    throw new RtDump(`Static method ${method} not supported on CL_DEMO_OUTPUT`, 'METHOD_UNKNOWN')
  }
  if (cls.startsWith('IF_SALV') || cls.startsWith('IF_')) {
    // constants
    return new RtElem('I', 1)
  }
  if (U === '__CONSTRUCT') {
    return makeNative(cls)
  }
  throw new RtDump(`Class ${cls} is not supported in this simulation`, 'CLASS_UNKNOWN')
}

function makeNative(cls: string): RtOref {
  const kind = cls.toUpperCase()
  if (kind.startsWith('CL_SALV_TABLE')) return nativeOref(cls, 'cl_salv_table', { tableBox: null, title: '', columnOverrides: new Map() })
  if (kind.startsWith('CL_DEMO_OUTPUT')) return newDemoInstance(null)
  if (kind.startsWith('CX_')) return nativeOref(cls, 'cx', { message: '' })
  throw new RtDump(`Class ${cls} cannot be instantiated in this simulation`, 'CREATE_OBJ_TYPE_NOT_FOUND')
}

// ── cl_demo_output buffer ─────────────────────────────────────────────
type DemoBufItem = { type: 'text'; text: string } | { type: 'table'; table: RtTable } | { type: 'blank' } | { type: 'struct'; struct: RtStruct }

function getDemoBuf(interp: Interp): DemoBufItem[] {
  if (!interp.__demoBuf) interp.__demoBuf = []
  return interp.__demoBuf
}

function newDemoInstance(interp: Interp): RtOref {
  return nativeOref('CL_DEMO_OUTPUT', 'cl_demo_output', {})
}

function demoWrite(interp: Interp, args: CallArg[], scope: any) {
  const a = findArg(args, 'DATA') ?? args[0]
  if (!a) return
  const v = interp.evalExpr(a.value, scope)
  const buf = getDemoBuf(interp)
  if (v.kind === 'table') buf.push({ type: 'table', table: v })
  else if (v.kind === 'struct') buf.push({ type: 'struct', struct: v })
  else buf.push({ type: 'text', text: toStringValue(v) })
}

function demoWriteText(interp: Interp, args: CallArg[], scope: any) {
  const a = findArg(args, 'TEXT') ?? args[0]
  if (!a) return
  const v = interp.evalExpr(a.value, scope)
  getDemoBuf(interp).push({ type: 'text', text: toStringValue(v) })
}

function demoDisplay(interp: Interp) {
  const buf = getDemoBuf(interp)
  for (const item of buf) {
    if (item.type === 'blank') {
      interp.newline()
      interp.lineOpen = true
      continue
    }
    if (item.type === 'text') {
      for (const line of item.text.split('\n')) {
        interp.pushSegment(line, interp.curCol, {})
        interp.newline()
      }
      continue
    }
    if (item.type === 'struct') {
      // render as label: value pairs
      for (const [k, v] of item.struct.fields) {
        const label = pad(interp.db.labelFor(k), 28)
        const val = v.kind === 'elem' ? formatElem(v, true) : ''
        interp.pushSegment(label, 1, {})
        interp.pushSegment(val, 30, { kind: v.kind === 'elem' && ['I', 'F', 'P', 'INT8', 'B', 'S'].includes(v.type) ? 'number' : 'text' })
        interp.newline()
      }
      continue
    }
    if (item.type === 'table') {
      const lines = renderTableText(interp, item.table)
      for (const line of lines) {
        interp.pushSegment(line, 1, {})
        interp.newline()
      }
    }
  }
  interp.__demoBuf = []
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function padNum(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s
}

function renderTableText(interp: Interp, table: RtTable): string[] {
  const cols: { name: string; label: string; isNum: boolean; width: number }[] = []
  const sample = table.rows.find((r) => r.kind === 'struct') as RtStruct | undefined
  const src = sample ?? (table.rows[0]?.kind === 'struct' ? (table.rows[0] as RtStruct) : undefined)
  if (src) {
    for (const [k, v] of src.fields) {
      const isNum = v.kind === 'elem' && ['I', 'F', 'P', 'INT8', 'B', 'S'].includes(v.type)
      const label = interp.db.labelFor(k)
      cols.push({ name: k, label, isNum, width: Math.max(label.length, 8) })
    }
  }
  // compute widths
  for (const r of table.rows) {
    if (r.kind !== 'struct') continue
    for (const c of cols) {
      const v = r.fields.get(c.name)
      const t = v && v.kind === 'elem' ? formatElem(v, true) : ''
      c.width = Math.min(30, Math.max(c.width, t.length))
    }
  }
  const out: string[] = []
  out.push(cols.map((c) => pad(c.label, c.width)).join('  '))
  out.push(cols.map((c) => '-'.repeat(c.width)).join('  '))
  for (const r of table.rows) {
    if (r.kind !== 'struct') continue
    out.push(
      cols
        .map((c) => {
          const v = r.fields.get(c.name)
          const t = v && v.kind === 'elem' ? formatElem(v, true) : ''
          return c.isNum ? padNum(t, c.width) : pad(t, c.width)
        })
        .join('  ')
    )
  }
  return out
}

// ── instance dispatch ──────────────────────────────────────────────────
export function callNativeMethod(interp: Interp, oref: RtOref, method: string, args: CallArg[], scope: any): RtValue {
  const U = method.toUpperCase()
  const kind = oref.native?.nativeKind
  const data = oref.native?.data ?? {}

  if (kind === 'cl_salv_table') {
    if (U === 'DISPLAY') {
      const table = data.tableBox ? data.tableBox.get() : null
      if (!table || table.kind !== 'table') throw new RtDump('CL_SALV_TABLE: no table bound (call FACTORY first)', 'OBJECTS_OBJREF_NOT_SET')
      interp.emitAlv(table, data.title ?? '', data.columnOverrides)
      return new RtElem('I', 0)
    }
    if (U === 'GET_COLUMNS') {
      return nativeOref('CL_SALV_COLUMNS_TABLE', 'cl_salv_columns', { tableOref: oref })
    }
    if (U === 'GET_DISPLAY_SETTINGS') {
      return nativeOref('CL_SALV_DISPLAY_SETTINGS', 'cl_salv_display_settings', { tableOref: oref })
    }
    if (U === 'GET_FUNCTIONS') {
      return nativeOref('CL_SALV_FUNCTIONS_LIST', 'cl_salv_functions', {})
    }
    if (U === 'SET_SCREEN_POPDOWN' || U === 'REFRESH' || U === 'SET_METADATA' || U === 'SET_TOP_OF_LIST' || U === 'SET_END_OF_LIST' || U === 'SET_SELECTION_COLUMN') {
      return new RtElem('I', 0) // no-op
    }
    // silent no-op for other setters
    return new RtElem('I', 0)
  }
  if (kind === 'cl_salv_columns') {
    if (U === 'SET_OPTIMIZE' || U === 'SET_KEY_FIXING' || U === 'SET_COLOR' || U === 'SET_HYPERLINK_ENTRY_COLUMN') return new RtElem('I', 0)
    if (U === 'GET_COLUMN') {
      const a = findArg(args, 'COLUMNNAME') ?? args[0]
      if (!a) throw new RtDump('get_column: parameter missing', 'CALL_FUNCTION_PARM_UNKNOWN')
      const name = toStringValue(interp.evalExpr(a.value, scope)).trim().toUpperCase()
      return nativeOref('CL_SALV_COLUMN', 'cl_salv_column', { name, tableOref: data.tableOref })
    }
    if (U === 'GET_ALL' || U === 'SET_COLUMN_POSITION') return new RtElem('I', 0)
    return new RtElem('I', 0)
  }
  if (kind === 'cl_salv_column') {
    const tableOref: RtOref | undefined = data.tableOref
    const overrides: Map<string, { label?: string; visible?: boolean }> | undefined = tableOref?.native?.data?.columnOverrides
    const textVal = () => {
      const a = findArg(args, 'VALUE') ?? args[0]
      return a ? toStringValue(interp.evalExpr(a.value, scope)) : ''
    }
    if (U === 'SET_SHORT_TEXT' || U === 'SET_MEDIUM_TEXT' || U === 'SET_LONG_TEXT') {
      const t = textVal()
      if (overrides && t) {
        const cur = overrides.get(data.name) ?? {}
        cur.label = t
        overrides.set(data.name, cur)
      }
      return new RtElem('I', 0)
    }
    if (U === 'SET_VISIBLE') {
      const t = textVal().trim().toUpperCase()
      if (overrides) {
        const cur = overrides.get(data.name) ?? {}
        cur.visible = t !== ' ' && t !== '' && t !== 'ABAP_FALSE'
        overrides.set(data.name, cur)
      }
      return new RtElem('I', 0)
    }
    if (U === 'SET_TECHNICAL') {
      const t = textVal().trim().toUpperCase()
      if (overrides && (t === 'X' || t === 'ABAP_TRUE' || t === '')) {
        const cur = overrides.get(data.name) ?? {}
        cur.visible = !(t === 'X' || t === 'ABAP_TRUE')
        overrides.set(data.name, cur)
      }
      return new RtElem('I', 0)
    }
    return new RtElem('I', 0) // set_output_length, set_key, set_alignment, ...
  }
  if (kind === 'cl_salv_display_settings') {
    if (U === 'SET_LIST_HEADER' || U === 'SET_LIST_HEADER_SIZE') {
      const a = findArg(args, 'VALUE') ?? args[0]
      if (a && data.tableOref) {
        data.tableOref.native.data.title = toStringValue(interp.evalExpr(a.value, scope))
      }
      return new RtElem('I', 0)
    }
    if (U === 'SET_STRIPED_PATTERN') return new RtElem('I', 0)
    return new RtElem('I', 0)
  }
  if (kind === 'cl_salv_functions') {
    return new RtElem('I', 0) // set_all, set_... — no-ops
  }
  if (kind === 'cl_demo_output') {
    if (U === 'WRITE') { demoWrite(interp, args, scope); return oref }
    if (U === 'WRITE_TEXT') { demoWriteText(interp, args, scope); return oref }
    if (U === 'DISPLAY') { demoWrite(interp, args, scope); demoDisplay(interp); return oref }
    if (U === 'LINE' || U === 'NEXT_LINE') { getDemoBuf(interp).push({ type: 'blank' }); return oref }
    if (U === 'BEGIN_SECTION' || U === 'END_SECTION') return oref
    return oref
  }
  if (kind === 'cx') {
    if (U === 'GET_TEXT') return new RtElem('STRING', String(data.message ?? ''))
    if (U === 'GET_LONGTEXT') return new RtElem('STRING', String(data.message ?? ''))
    return new RtElem('STRING', '')
  }
  throw new RtDump(`Method ${method} not supported on native class ${oref.clsName}`, 'METHOD_UNKNOWN')
}

// ── attributes ─────────────────────────────────────────────────────────
export function getNativeAttr(interp: Interp, cls: string, name: string, oref?: RtOref): RtValue {
  const n = name.toUpperCase()
  if (n === 'VERSION' || n === 'C_') return new RtElem('STRING', '')
  if (/^(IF_|CL_)/.test(cls.toUpperCase()) && n.length > 2) {
    // constants like IF_SALV_C_SELECTION_MODE=>RECTANGLE
    return new RtElem('I', 1)
  }
  return new RtElem('STRING', '')
}

export function setNativeAttr(interp: Interp, oref: RtOref, name: string, value: RtValue) {
  // native objects: attributes are managed internally — ignore
}

export function nativeInstanceOf(oref: RtOref, clsName: string): boolean {
  return true // lenient
}
