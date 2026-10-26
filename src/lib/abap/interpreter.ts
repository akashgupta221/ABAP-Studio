// ── ABAP Engine: Tree-walking Interpreter ──────────────────────────────
import type {
  AbapProgram, Stmt, Expr, CallArg, TypeSpecAST, VarDeclStmt, MethodDecl, MethParam,
  FormParam, ClassDefStmt, ClassImplStmt, RunResult, ListLine, ListSegment, MessageItem,
  SelectionScreenItem, ParamSpec, SelectOptionSpec, AbapTypeDef, ElemType, FormStmt,
  ReduceExpr,
} from './ast-types'
import { AbapSyntaxError } from './tokenizer'
import {
  RtElem, RtStruct, RtTable, RtOref, RtDref, RtValue, NativeObject,
  initialElem, initialFromDef, toNumber, isNumericType, toStringValue, formatElem,
  assignElem, deepCopyValue, isInitial, valuesEqual, compareValues, writeText,
  serializeForClient, todayYYYYMMDD, nowHHMMSS,
} from './values'
import { callNativeStatic, callNativeMethod, getNativeAttr, setNativeAttr, nativeInstanceOf } from './natives'

// ── simulated SAP database ─────────────────────────────────────────────
export interface DbField {
  name: string
  type: string // DDIC: CHAR NUMC DEC CURR QUAN INT4 INT2 DATS TIMS RAW STR
  length?: number
  decimals?: number
  key?: boolean
  text?: string
}
export interface DbTableDef {
  name: string
  description?: string
  fields: DbField[]
  rows: Record<string, string>[]
}
export class DbSnapshot {
  tables = new Map<string, DbTableDef>()
  get(name: string): DbTableDef | undefined {
    return this.tables.get(name.toUpperCase())
  }
  labelFor(field: string): string {
    for (const t of this.tables.values()) {
      const f = t.fields.find((x) => x.name.toUpperCase() === field.toUpperCase())
      if (f?.text) return f.text
    }
    return field
  }
  static fieldToElemType(f: DbField): { type: ElemType; length?: number; decimals?: number } {
    switch (f.type.toUpperCase()) {
      case 'CHAR': return { type: 'C', length: f.length ?? 30 }
      case 'NUMC': return { type: 'N', length: f.length ?? 10 }
      case 'DEC': case 'QUAN': return { type: 'P', length: f.length ?? 13, decimals: f.decimals ?? 2 }
      case 'CURR': return { type: 'P', length: f.length ?? 13, decimals: f.decimals ?? 2 }
      case 'INT4': return { type: 'I' }
      case 'INT2': return { type: 'S' }
      case 'INT1': return { type: 'B' }
      case 'DATS': case 'DATE': return { type: 'D' }
      case 'TIMS': case 'TIME': return { type: 'T' }
      case 'RAW': return { type: 'X', length: f.length ?? 10 }
      case 'STR': case 'STRING': return { type: 'STRING' }
      default: return { type: 'C', length: f.length ?? 30 }
    }
  }
  structDefFor(table: string): AbapTypeDef {
    const t = this.get(table)
    if (!t) throw new RtDump(`Table ${table} is unknown`, 'DBTABLE_UNKNOWN')
    return {
      kind: 'struct',
      fields: t.fields.map((f) => {
        const et = DbSnapshot.fieldToElemType(f)
        return { name: f.name.toUpperCase(), type: { kind: 'elem', type: et.type, length: et.length, decimals: et.decimals } as AbapTypeDef }
      }),
    }
  }
  rowToStruct(table: string, row: Record<string, string>): RtStruct {
    const t = this.get(table)!
    const s = new RtStruct(table.toUpperCase())
    for (const f of t.fields) {
      const et = DbSnapshot.fieldToElemType(f)
      const e = initialElem(et.type, et.length, et.decimals)
      const raw = row[f.name.toUpperCase()] ?? row[f.name]
      if (raw !== undefined) {
        if (isNumericType(et.type)) e.value = et.type === 'I' || et.type === 'S' || et.type === 'B' ? parseInt(raw) || 0 : parseFloat(raw) || 0
        else e.value = raw
      }
      s.fields.set(f.name.toUpperCase(), e)
    }
    return s
  }
  structToRow(table: string, s: RtStruct): Record<string, string> {
    const t = this.get(table)!
    const row: Record<string, string> = {}
    for (const f of t.fields) {
      const v = s.fields.get(f.name.toUpperCase())
      row[f.name.toUpperCase()] = v ? toStringValue(v) : ''
    }
    return row
  }
  keyOf(table: string, row: Record<string, string>): string {
    const t = this.get(table)!
    const keys = t.fields.filter((f) => f.key).map((f) => f.name.toUpperCase())
    if (keys.length === 0) return JSON.stringify(row)
    return keys.map((k) => String(row[k] ?? '')).join('|')
  }
}

// ── errors & signals ───────────────────────────────────────────────────
export class RtException extends Error {
  className: string
  obj: RtOref | null
  constructor(className: string, message: string, obj: RtOref | null = null) {
    super(message)
    this.className = className
    this.obj = obj
  }
}
export class RtDump extends Error {
  abapType: string
  constructor(message: string, abapType = 'RUNTIME_ERROR') {
    super(message)
    this.abapType = abapType
  }
}
export class RtFatal extends Error {
  msgType: string
  constructor(message: string, msgType: string) {
    super(message)
    this.msgType = msgType
  }
}
type Signal = { type: 'none' } | { type: 'continue' } | { type: 'exit' } | { type: 'exitForm' } | { type: 'leaveProgram' }
const SIG_NONE: Signal = { type: 'none' }

// ── scope ──────────────────────────────────────────────────────────────
export interface ScopeEntry {
  value: RtValue
  isFs?: boolean
  fsBox?: Box | null
  decl?: VarDeclStmt
}
export interface Box {
  get(): RtValue
  set(v: RtValue): void
}
class Scope {
  vars = new Map<string, ScopeEntry>()
  typeDefs = new Map<string, AbapTypeDef>()
  constructor(public kind: 'global' | 'form' | 'method' | 'function', public parent?: Scope) {}
  lookup(name: string): ScopeEntry | undefined {
    if (this.vars.has(name)) return this.vars.get(name)
    return this.parent?.lookup(name)
  }
  lookupType(name: string): AbapTypeDef | undefined {
    if (this.typeDefs.has(name)) return this.typeDefs.get(name)
    return this.parent?.lookupType(name)
  }
  declare(name: string, value: RtValue, decl?: VarDeclStmt): ScopeEntry {
    const e: ScopeEntry = { value, decl }
    this.vars.set(name, e)
    return e
  }
}

// ── event handlers ─────────────────────────────────────────────────────
interface EventHandler {
  clsName: string
  methodName: string
  isStatic: boolean
  targetOref?: RtOref // FOR instance
  box?: Box // for instance method handlers: box holding the instance
}

// ── function module registry entry ────────────────────────────────────
export interface FmEntry {
  name: string
  importing: { name: string; type: string; length?: number; optional?: boolean }[]
  exporting: { name: string; type: string; length?: number; optional?: boolean }[]
  changing: { name: string; type: string; length?: number; optional?: boolean }[]
  tables: { name: string; type?: string; optional?: boolean }[]
  prog: AbapProgram
}

export interface RunOptions {
  source: string
  repid: string
  db: DbSnapshot
  includes?: Map<string, string>
  functionModules?: Map<string, FmEntry>
  parameters?: Record<string, string | string[]>
  stepLimit?: number
  timeLimitMs?: number
}

const BUILTIN_EXC_HIER: Record<string, string[]> = {
  CX_ROOT: [],
  CX_STATIC_CHECK: ['CX_ROOT'],
  CX_DYNAMIC_CHECK: ['CX_ROOT'],
  CX_NO_CHECK: ['CX_ROOT'],
  CX_SY_ARITHMETIC_ERROR: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_ZERODIVIDE: ['CX_SY_ARITHMETIC_ERROR', 'CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_DATA_CONVERSION_ERROR: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_ITAB_LINE_NOT_FOUND: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_ITAB_DUPLICATE_KEY: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_REF_IS_INITIAL: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_SUBRC_UNKNOWN: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
  CX_SY_MOVE_CAST_ERROR: ['CX_DYNAMIC_CHECK', 'CX_ROOT'],
}

// ── the interpreter ────────────────────────────────────────────────────
export class Interpreter {
  prog: AbapProgram
  opts: RunOptions
  db: DbSnapshot
  globalScope = new Scope('global')
  classes = new Map<string, ClassDefStmt>()
  interfaces = new Map<string, ClassDefStmt>()
  impls = new Map<string, ClassImplStmt>()
  fms: Map<string, FmEntry>
  classStatics = new Map<string, Map<string, RtValue>>()
  classStaticDone = new Set<string>()
  ctorDone = new WeakMap<RtOref, Set<string>>()
  eventHandlers: EventHandler[] = []
  // list output
  // list cursor state
  lines: ListLine[] = []
  curSegments: ListSegment[] = []
  curLine = 1
  curCol = 1
  lineOpen = false
  listWidth = 120
  formatState = { color: '', intensified: true, inverse: false, hotspot: false }
  topOfPageDone = false
  noStdHeading = false
  // result
  messages: MessageItem[] = []
  alvEmitted = false
  alvTitle = ''
  alvColumns: { name: string; label: string; type: string; length: number; visible: boolean }[] | null = null
  alvRows: Record<string, string>[] | null = null
  // guards
  steps = 0
  stepLimit: number
  timeLimitMs: number
  startTime = Date.now()
  linesWritten = 0
  selects = 0
  dbReads = 0
  aborted = false
  abortedMsg: MessageItem | null = null
  // current context
  currentClassName: string | null = null
  currentSelf: RtOref | null = null
  currentFormScope: Scope | null = null

  constructor(prog: AbapProgram, opts: RunOptions) {
    this.prog = prog
    this.opts = opts
    this.db = opts.db
    this.fms = opts.functionModules ?? new Map()
    this.stepLimit = opts.stepLimit ?? 8_000_000
    this.timeLimitMs = opts.timeLimitMs ?? 12_000
    this.classes = prog.classes
    this.interfaces = prog.interfaces
    this.impls = prog.impls
    // merge program-local functions
    for (const [k, v] of prog.functions) {
      this.fms.set(k, {
        name: k, importing: [], exporting: [], changing: [], tables: [],
        prog: { ...prog, defaultEvent: [v as any], events: new Map() } as AbapProgram,
      })
    }
  }

  // ── main entry ──────────────────────────────────────────────────────
  run(): RunResult {
    const result: RunResult = {
      status: 'SUCCESS', list: [], messages: [], durationMs: 0,
      stats: { steps: 0, linesWritten: 0, selects: 0, dbReads: 0 },
    }
    const t0 = Date.now()
    try {
      this.initGlobalScope()
      this.runEventIfExists('LOAD-OF-PROGRAM')
      this.runEventIfExists('INITIALIZATION')
      // selection screen
      const hasParams = this.collectSelectionScreen().length > 0
      const provided = this.opts.parameters !== undefined
      if (hasParams && !provided) {
        result.status = 'REQUIRES_INPUT'
        result.selectionScreen = this.collectSelectionScreen()
        return this.finish(result, t0)
      }
      this.applyParameterValues(this.opts.parameters ?? {})
      this.runEventIfExists('AT-SELECTION-SCREEN')
      // START-OF-SELECTION: explicit event or default statements
      if (this.prog.events.has('START-OF-SELECTION')) {
        this.execStmts(this.prog.events.get('START-OF-SELECTION')!, this.globalScope)
      } else {
        this.execStmts(this.prog.defaultEvent, this.globalScope)
      }
      this.runEventIfExists('END-OF-SELECTION')
      result.status = this.aborted ? 'ERROR' : 'SUCCESS'
    } catch (e: any) {
      if (e instanceof AbapSyntaxError) {
        result.status = 'ERROR'
        result.error = { kind: 'SYNTAX', message: e.message, line: e.line, statement: e.statement }
      } else if (e instanceof RtFatal) {
        result.status = 'ERROR'
        if (this.abortedMsg) this.messages.push(this.abortedMsg)
        result.error = { kind: 'RUNTIME', message: e.message, abapType: `MESSAGE_${e.msgType}` }
      } else if (e instanceof RtException) {
        result.status = 'ERROR'
        result.error = {
          kind: 'RUNTIME', message: `Unhandled exception ${e.className}: ${e.message}`,
          abapType: e.className,
        }
      } else if (e instanceof RtDump) {
        result.status = 'ERROR'
        result.error = { kind: 'RUNTIME', message: e.message, abapType: e.abapType }
      } else {
        result.status = 'ERROR'
        result.error = { kind: 'RUNTIME', message: e.message || String(e), abapType: 'INTERNAL' }
      }
    }
    return this.finish(result, t0)
  }

  private finish(result: RunResult, t0: number): RunResult {
    this.flushLine()
    result.list = this.lines
    result.messages = this.messages
    result.durationMs = Date.now() - t0
    result.stats = { steps: this.steps, linesWritten: this.linesWritten, selects: this.selects, dbReads: this.dbReads }
    if (this.alvRows && this.alvColumns) {
      result.alv = {
        title: this.alvTitle,
        columns: this.alvColumns,
        rows: this.alvRows,
        totalRows: this.alvRows.length,
      }
    }
    return result
  }

  private runEventIfExists(name: string) {
    const body = this.prog.events.get(name)
    if (body) this.execStmts(body, this.globalScope)
  }

  // ── global scope init ───────────────────────────────────────────────
  initGlobalScope() {
    // system fields
    const sy = new RtStruct('SY')
    const sysFields: [string, ElemType, any, number?][] = [
      ['SUBRC', 'I', 0], ['INDEX', 'I', 0], ['TABIX', 'I', 0], ['DBCNT', 'I', 0],
      ['TFILL', 'I', 0], ['FDPOS', 'I', 0], ['PAGNO', 'I', 1], ['LINNO', 'I', 1],
      ['COLNO', 'I', 1], ['LSIND', 'I', 0], ['SCOLS', 'I', 255], ['SROWS', 'I', 65],
      ['UNAME', 'C', 'DEVELOPER', 12], ['MANDT', 'C', '100', 3], ['LANGU', 'C', 'E', 1],
      ['SYSID', 'C', 'MER', 8], ['HOST', 'C', 'MERAPP01', 32], ['TCODE', 'C', 'SE38', 20],
      ['CPROG', 'C', this.prog.repid || this.opts.repid, 40], ['REPID', 'C', this.prog.repid || this.opts.repid, 40],
      ['SAPRL', 'C', '750', 4], ['MSGTY', 'C', ' ', 1], ['MSGID', 'C', '', 20], ['MSGNO', 'C', '000', 3],
      ['MSGV1', 'C', '', 50], ['MSGV2', 'C', '', 50], ['MSGV3', 'C', '', 50], ['MSGV4', 'C', '', 50],
      ['TITLE', 'C', '', 70], ['UCOMM', 'C', '', 70], ['VLINE', 'I', 0], ['BATCH', 'C', ' ', 1],
    ]
    for (const [name, type, val, len] of sysFields) {
      const e = initialElem(type, len)
      if (type === 'I') e.value = val as number
      else e.value = String(val).padEnd(len ?? 1).slice(0, len ?? 1)
      sy.fields.set(name, e)
    }
    const datum = initialElem('D')
    datum.value = todayYYYYMMDD()
    sy.fields.set('DATUM', datum)
    const uzeit = initialElem('T')
    uzeit.value = nowHHMMSS()
    sy.fields.set('UZEIT', uzeit)
    this.globalScope.declare('SY', sy)
    // top-level declarations
    for (const st of this.prog.stmts) {
      if (st.t === 'vardecl') this.execDeclaration(st, this.globalScope)
    }
  }

  setSys(name: string, value: number | string) {
    const sy = this.globalScope.lookup('SY')?.value as RtStruct
    if (!sy) return
    const f = sy.fields.get(name)
    if (!f || f.kind !== 'elem') return
    if (typeof value === 'number') f.value = value
    else f.value = value
  }
  sysVal(name: string): RtValue {
    const sy = this.globalScope.lookup('SY')?.value as RtStruct
    return sy.fields.get(name) ?? initialElem('I', undefined, 0)
  }

  // ── selection screen ────────────────────────────────────────────────
  collectSelectionScreen(): SelectionScreenItem[] {
    const items: SelectionScreenItem[] = []
    for (const st of this.prog.stmts) {
      if (st.t !== 'vardecl') continue
      if (st.kind === 'PARAMETERS') {
        const v = this.globalScope.lookup(st.name)?.value
        const type = v && v.kind === 'elem' ? v.type : 'C'
        const len = v && v.kind === 'elem' ? v.length : undefined
        const dec = v && v.kind === 'elem' ? v.decimals : undefined
        const spec: ParamSpec = {
          name: st.name, label: this.prettyLabel(st.name), type, length: len, decimals: dec,
          defaultValue: v ? this.displayValue(v) : '',
          obligatory: st.obligatory, lowerCase: st.lowerCase,
          asCheckbox: st.paramKind === 'checkbox', radioGroup: st.radioGroup, kind: 'param',
        }
        items.push(spec)
      } else if (st.kind === 'SELECT-OPTIONS') {
        const spec: SelectOptionSpec = {
          name: st.name, label: this.prettyLabel(st.name),
          ddicTable: st.forField?.table, ddicField: st.forField?.field,
          defaultValue: '', defaultValueHigh: '', kind: 'selopt',
        }
        items.push(spec)
      }
    }
    return items
  }

  private displayValue(v: RtValue): string {
    return v.kind === 'elem' ? formatElem(v) : ''
  }

  private prettyLabel(name: string): string {
    let s = name.replace(/^(P_|S_|PA_|SO_)/i, '')
    s = s.replace(/_/g, ' ').toLowerCase()
    return s.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  applyParameterValues(values: Record<string, string | string[]>) {
    for (const st of this.prog.stmts) {
      if (st.t !== 'vardecl') continue
      const input = values[st.name] ?? values[st.name.toLowerCase()]
      if (st.kind === 'PARAMETERS') {
        const entry = this.globalScope.lookup(st.name)
        if (!entry) continue
        if (entry.value.kind === 'elem' && entry.value.type === 'C' && st.paramKind === 'checkbox') {
          entry.value.value = input === 'X' ? 'X' : ' '
          continue
        }
        if (input !== undefined) {
          const val = Array.isArray(input) ? input[0] : input
          if (entry.value.kind === 'elem') {
            assignElem(entry.value, new RtElem('STRING', st.lowerCase ? val : val.toUpperCase()))
          }
        }
      } else if (st.kind === 'SELECT-OPTIONS') {
        const entry = this.globalScope.lookup(st.name)
        if (!entry || entry.value.kind !== 'table') continue
        const rangeTable = entry.value
        rangeTable.rows = []
        const addRange = (low: string, high: string, sign: string, opt: string) => {
          const line = new RtStruct()
          const sgn = initialElem('C', 1)
          sgn.value = sign
          const op = initialElem('C', 2)
          op.value = opt
          const lo = initialElem('C', 40)
          lo.value = low.toUpperCase()
          const hi = initialElem('C', 40)
          hi.value = high.toUpperCase()
          line.fields.set('SIGN', sgn)
          line.fields.set('OPTION', op)
          line.fields.set('LOW', lo)
          line.fields.set('HIGH', hi)
          rangeTable.rows.push(line)
        }
        if (input !== undefined) {
          if (Array.isArray(input)) {
            if (input.length === 2 && (input[1] ?? '') !== '') addRange(input[0] ?? '', input[1], 'I', 'BT')
            else if (input.length >= 1 && (input[0] ?? '') !== '') addRange(input[0], '', 'I', 'EQ')
          } else if (input !== '') {
            addRange(input, '', 'I', 'EQ')
          }
        } else if (st.defaultVal) {
          // default handled by VALUE clause at declaration time
        }
      }
    }
  }

  // ── declarations ────────────────────────────────────────────────────
  execDeclaration(st: VarDeclStmt, scope: Scope) {
    this.tick()
    if (st.kind === 'TYPES') {
      // type declaration — store type def
      if (st.typeSpec) {
        const def = this.resolveTypeSpec(st.typeSpec, scope)
        scope.typeDefs.set(st.name, def)
        if (scope === this.globalScope && st.typeSpec.kind === 'struct') {
          // allow ddic-style usage
        }
      }
      return
    }
    if (st.kind === 'FIELD-SYMBOLS') {
      if (!scope.vars.has(st.name)) {
        scope.declare(st.name, initialElem('C', 1), st)
        scope.vars.get(st.name)!.isFs = true
        scope.vars.get(st.name)!.fsBox = null
      }
      return
    }
    if (st.kind === 'TABLES') {
      const def = this.db.structDefFor(st.name)
      scope.declare(st.name, initialFromDef(def), st)
      return
    }
    if (st.kind === 'SELECT-OPTIONS') {
      // range table: SIGN OPTION LOW HIGH
      const rangeLine: AbapTypeDef = {
        kind: 'struct',
        fields: [
          { name: 'SIGN', type: { kind: 'elem', type: 'C', length: 1 } },
          { name: 'OPTION', type: { kind: 'elem', type: 'C', length: 2 } },
          { name: 'LOW', type: { kind: 'elem', type: 'C', length: 40 } },
          { name: 'HIGH', type: { kind: 'elem', type: 'C', length: 40 } },
        ],
      }
      const tab = new RtTable(rangeLine, 'STANDARD')
      // default value from VALUE clause: e.g. VALUE 'AA'
      if (st.value) {
        try {
          const v = this.evalExpr(st.value, scope)
          const s = toStringValue(v)
          if (s !== '') {
            const line = new RtStruct()
            const sgn = initialElem('C', 1)
            sgn.value = 'I'
            const op = initialElem('C', 2)
            op.value = 'EQ'
            const lo = initialElem('C', 40)
            lo.value = s
            line.fields.set('SIGN', sgn)
            line.fields.set('OPTION', op)
            line.fields.set('LOW', lo)
            line.fields.set('HIGH', initialElem('C', 40))
            tab.rows.push(line)
          }
        } catch { /* ignore */ }
      }
      scope.declare(st.name, tab, st)
      return
    }
    if (st.kind === 'PARAMETERS') {
      let def: AbapTypeDef
      if (st.typeSpec) def = this.resolveTypeSpec(st.typeSpec, scope)
      else def = { kind: 'elem', type: 'C', length: 40 } as AbapTypeDef
      if (def.kind === 'elem') {
        if (st.length) def.length = this.exprNum(st.length, scope)
        if (st.decimals) def.decimals = this.exprNum(st.decimals, scope)
        if (!def.length && def.type === 'C') def.length = 40
      }
      let value = initialFromDef(def)
      if (st.paramKind === 'checkbox') value = initialElem('C', 1)
      if (st.defaultVal || st.value) {
        try {
          const v = this.evalExpr((st.defaultVal ?? st.value)!, scope)
          if (value.kind === 'elem') assignElem(value, v)
          else value = v
        } catch { /* ignore */ }
      }
      if (value.kind === 'elem' && value.type === 'C' && !st.lowerCase && value.value) {
        value.value = String(value.value).toUpperCase()
      }
      scope.declare(st.name, value, st)
      return
    }
    // DATA / CONSTANTS / STATICS / CLASS-DATA
    let def: AbapTypeDef
    if (st.typeSpec) def = this.resolveTypeSpec(st.typeSpec, scope)
    else {
      // no TYPE: use length or C 1
      if (st.length) {
        const t: ElemType = st.kind === 'CONSTANTS' ? 'C' : 'C'
        def = { kind: 'elem', type: t, length: this.exprNum(st.length, scope) }
      } else def = { kind: 'elem', type: 'C', length: 1 }
    }
    // apply LENGTH/DECIMALS overrides
    if (def.kind === 'elem') {
      if (st.length) def.length = this.exprNum(st.length, scope)
      if (st.decimals) def.decimals = this.exprNum(st.decimals, scope)
    }
    let value = initialFromDef(def)
    if (st.value) {
      try {
        const v = this.evalExpr(st.value, scope)
        if (st.kind === 'CONSTANTS') {
          // constants take type of value if not typed
          if (!st.typeSpec) value = deepCopyValue(v)
          else {
            if (value.kind === 'elem' && v.kind === 'elem') assignElem(value, v)
            else value = deepCopyValue(v)
          }
        } else {
          if (value.kind === 'elem') {
            if (v.kind === 'elem') assignElem(value, v)
            else value = deepCopyValue(v)
          } else value = deepCopyValue(v)
        }
      } catch { /* ignore default eval errors */ }
    }
    if (st.kind === 'CONSTANTS' && value.kind === 'elem') value.readOnly = true
    const entry = scope.declare(st.name, value, st)
    return entry
  }

  private exprNum(e: Expr, scope: Scope): number {
    const v = this.evalExpr(e, scope)
    return Math.trunc(toNumber(v))
  }

  // ── type resolution ─────────────────────────────────────────────────
  resolveTypeSpec(spec: TypeSpecAST, scope: Scope): AbapTypeDef {
    switch (spec.kind) {
      case 'elem': return { kind: 'elem', type: spec.elem ?? 'C', length: spec.length ? this.exprNumIf(spec.length, scope) : undefined, decimals: spec.decimals ? this.exprNumIf(spec.decimals, scope) : undefined }
      case 'struct': {
        if (spec.typeName && this.db.get(spec.typeName)) {
          return this.db.structDefFor(spec.typeName)
        }
        return {
          kind: 'struct',
          fields: (spec.fields ?? []).map((f) => {
            const t = this.resolveTypeSpec(f.type, scope)
            if (t.kind === 'elem') {
              if (f.length !== undefined) {
                try { t.length = this.exprNum(f.length, scope) } catch { /* keep */ }
              }
              if (f.decimals !== undefined) {
                try { t.decimals = this.exprNum(f.decimals, scope) } catch { /* keep */ }
              }
            }
            return { name: f.name, type: t }
          }),
        }
      }
      case 'table': {
        const lineType: AbapTypeDef = spec.lineType
          ? this.resolveTypeSpec(spec.lineType, scope)
          : { kind: 'elem', type: 'C', length: 1 }
        return { kind: 'table', lineType, tableKind: spec.tableKind ?? 'STANDARD', keyFields: spec.keyFields, unique: spec.unique, withHeaderLine: spec.headerLine }
      }
      case 'oref': return { kind: 'oref', className: spec.typeName ?? '' }
      case 'dref': return { kind: 'dref' }
      case 'void': return { kind: 'elem', type: 'STRING' }
      case 'ddic': {
        if (spec.ddicField) {
          const t = this.db.get(spec.ddicField.table)
          if (t) {
            const f = t.fields.find((x) => x.name.toUpperCase() === spec.ddicField!.field.toUpperCase())
            if (f) {
              const et = DbSnapshot.fieldToElemType(f)
              return { kind: 'elem', type: et.type, length: et.length, decimals: et.decimals, ddic: `${t.name}-${f.name}` }
            }
          }
          throw new AbapSyntaxError(`Field ${spec.ddicField.table}-${spec.ddicField.field} is unknown`, 0)
        }
        if (spec.typeName) {
          const t = this.db.get(spec.typeName)
          if (t) return this.db.structDefFor(t.name)
          throw new AbapSyntaxError(`Table ${spec.typeName} is unknown`, 0)
        }
        return { kind: 'elem', type: 'C', length: 1 }
      }
      case 'like': {
        const target = spec.likeTarget ?? ''
        const entry = scope.lookup(target)
        if (entry) return this.defOfValue(entry.value)
        // maybe it's a structure TYPE name used with LIKE? or db field
        throw new AbapSyntaxError(`LIKE target ${target} is unknown`, 0)
      }
      case 'likeLine': {
        const entry = scope.lookup(spec.likeTarget ?? '')
        if (entry && entry.value.kind === 'table') return entry.value.lineType
        if (entry && entry.value.kind === 'table') return entry.value.lineType
        throw new AbapSyntaxError(`LIKE LINE OF ${spec.likeTarget}: target is not a table`, 0)
      }
      case 'named': {
        const name = spec.typeName ?? ''
        // class type? cls=>ty_x
        if (name.includes('=>')) {
          const [cls, ty] = name.split('=>')
          const cd = this.classes.get(cls) || this.interfaces.get(cls)
          if (cd) {
            for (const sec of cd.sections) {
              for (const m of sec.members) {
                if (m.kind === 'var' && m.decl.kind === 'TYPES' && m.decl.name === ty) {
                  // resolve in class context scope
                  return this.resolveTypeSpec(m.decl.typeSpec!, this.globalScope)
                }
              }
            }
          }
        }
        const local = scope.lookupType(name)
        if (local) return local
        // DDIC table?
        if (this.db.get(name)) return this.db.structDefFor(name)
        // LIKE fallback: variable with runtime value
        const varEntry = scope.lookup(name)
        if (varEntry) return this.defOfValue(varEntry.value)
        throw new AbapSyntaxError(`Type ${name} is unknown`, 0)
      }
      default:
        return { kind: 'elem', type: 'C', length: 1 }
    }
  }

  private exprNumIf(e: Expr | undefined, scope: Scope): number | undefined {
    if (!e) return undefined
    try {
      return this.exprNum(e, scope)
    } catch {
      return undefined
    }
  }

  defOfValue(v: RtValue): AbapTypeDef {
    if (v.kind === 'elem') return { kind: 'elem', type: v.type, length: v.length, decimals: v.decimals }
    if (v.kind === 'struct') {
      return { kind: 'struct', fields: [...v.fields.entries()].map(([name, f]) => ({ name, type: this.defOfValue(f) })) }
    }
    if (v.kind === 'table') return { kind: 'table', lineType: v.lineType, tableKind: v.tableKind, keyFields: v.keyFields }
    if (v.kind === 'oref') return { kind: 'oref', className: v.clsName }
    if (v.kind === 'dref') return { kind: 'dref' }
    return { kind: 'elem', type: 'C' }
  }

  // ── statement execution ─────────────────────────────────────────────
  execStmts(stmts: Stmt[], scope: Scope): Signal {
    for (const st of stmts) {
      const sig = this.execStmt(st, scope)
      if (sig.type !== 'none') return sig
    }
    return SIG_NONE
  }

  tick() {
    this.steps++
    if ((this.steps & 0x3fff) === 0) {
      if (Date.now() - this.startTime > this.timeLimitMs) {
        throw new RtDump('Program exceeded time limit (possible endless loop)', 'TIME_LIMIT_EXCEEDED')
      }
    }
    if (this.steps > this.stepLimit) {
      throw new RtDump('Program exceeded statement limit (possible endless loop)', 'STEP_LIMIT_EXCEEDED')
    }
  }

  execStmt(st: Stmt, scope: Scope): Signal {
    this.tick()
    switch (st.t) {
      case 'report': {
        if (st.lineSize) this.listWidth = Math.min(500, this.exprNum(st.lineSize, scope))
        this.noStdHeading = !!st.noStdHeading
        return SIG_NONE
      }
      case 'vardecl': {
        if (scope === this.globalScope && this.globalScope.vars.has(st.name)) {
          // already declared during initGlobalScope
          return SIG_NONE
        }
        this.execDeclaration(st, scope)
        return SIG_NONE
      }
      case 'include':
        return SIG_NONE // already inlined at parse-time
      case 'write': return this.execWrite(st, scope)
      case 'uline': {
        const from = st.pos?.col ? this.exprNum(st.pos.col, scope) : this.curCol
        const len = st.pos?.len ? this.exprNum(st.pos.len, scope) : Math.max(1, this.listWidth - from + 1)
        this.pushSegment('-'.repeat(Math.max(1, len)), from, {})
        return SIG_NONE
      }
      case 'skip': {
        const n = st.n ? this.exprNum(st.n, scope) : 1
        this.flushLine()
        for (let i = 0; i < n; i++) {
          this.lines.push({ segments: [] })
          this.linesWritten++
          this.checkLineLimit()
        }
        this.curLine += n
        this.curCol = 1
        return SIG_NONE
      }
      case 'newline': {
        this.newline()
        return SIG_NONE
      }
      case 'format': {
        if (st.reset) this.formatState = { color: '', intensified: true, inverse: false, hotspot: false }
        if (st.color !== undefined) {
          this.formatState.color = this.mapColor(st.color, st.colorOn !== false)
        }
        if (st.intensified) this.formatState.intensified = st.intensified === 'on'
        if (st.inverse) this.formatState.inverse = st.inverse === 'on'
        return SIG_NONE
      }
      case 'if': {
        for (const br of st.branches) {
          if (this.truthy(this.evalExpr(br.cond, scope))) {
            return this.execStmts(br.body, scope)
          }
        }
        return this.execStmts(st.elseBody, scope)
      }
      case 'case': {
        const subject = this.evalExpr(st.subject, scope)
        for (const w of st.whens) {
          for (const v of w.values) {
            const val = this.evalExpr(v, scope)
            if (valuesEqual(subject, val)) return this.execStmts(w.body, scope)
          }
        }
        if (st.others) return this.execStmts(st.others, scope)
        return SIG_NONE
      }
      case 'do': {
        const times = st.times ? this.exprNum(st.times, scope) : Infinity
        let i = 0
        for (;;) {
          if (i >= times) break
          this.tick()
          i++
          this.setSys('INDEX', i)
          const sig = this.execStmts(st.body, scope)
          if (sig.type === 'continue') { continue }
          if (sig.type === 'exit') break
          if (sig.type !== 'none') return sig
        }
        return SIG_NONE
      }
      case 'while': {
        let guard = 0
        while (this.truthy(this.evalExpr(st.cond, scope))) {
          this.tick()
          if (++guard > 2_000_000) throw new RtDump('Endless WHILE loop', 'STEP_LIMIT_EXCEEDED')
          const sig = this.execStmts(st.body, scope)
          if (sig.type === 'continue') continue
          if (sig.type === 'exit') break
          if (sig.type !== 'none') return sig
        }
        return SIG_NONE
      }
      case 'loop': return this.execLoop(st, scope)
      case 'continue': return { type: 'continue' }
      case 'exit': return { type: 'exit' }
      case 'return': return { type: 'exitForm' }
      case 'check': {
        if (!this.truthy(this.evalExpr(st.cond, scope))) {
          // CHECK at loop level = continue; top level = exit form
          return { type: 'continue' }
        }
        return SIG_NONE
      }
      case 'append': return this.execAppend(st, scope)
      case 'insert': return this.execInsert(st, scope)
      case 'readtable': return this.execReadTable(st, scope)
      case 'modifyitab': return this.execModifyItab(st, scope)
      case 'deleteitab': return this.execDeleteItab(st, scope)
      case 'sort': return this.execSort(st, scope)
      case 'clear': {
        for (const tgt of st.targets) {
          const box = this.resolveBox(tgt, scope)
          const cur = box.get()
          if (cur.kind === 'elem') {
            const init = initialElem(cur.type, cur.length, cur.decimals)
            box.set(init)
          } else if (cur.kind === 'struct') {
            for (const [k, f] of cur.fields) {
              if (f.kind === 'elem') cur.fields.set(k, initialElem(f.type, f.length, f.decimals))
              else if (f.kind === 'struct') cur.fields.set(k, initialFromDef(this.defOfValue(f)))
              else if (f.kind === 'table') f.rows = []
            }
          } else if (cur.kind === 'table') {
            cur.rows = []
          } else if (cur.kind === 'oref') {
            box.set(new RtOref(''))
          }
        }
        return SIG_NONE
      }
      case 'refresh': {
        const v = this.evalExpr(st.table, scope)
        if (v.kind === 'table') v.rows = []
        return SIG_NONE
      }
      case 'free': {
        const box = this.resolveBox(st.target, scope)
        const cur = box.get()
        if (cur.kind === 'table') cur.rows = []
        else box.set(initialElem('C', 1))
        return SIG_NONE
      }
      case 'describe': {
        const v = this.evalExpr(st.table, scope)
        if (v.kind === 'table') {
          this.setSys('TFILL', v.rows.length)
          if (st.linesInto) this.assignTo(st.linesInto, new RtElem('I', v.rows.length), scope)
          if (st.kindInto) {
            const kindMap: Record<string, string> = { STANDARD: 'T', SORTED: 'S', HASHED: 'H' }
            this.assignTo(st.kindInto, new RtElem('C', kindMap[v.tableKind] ?? 'T', 1), scope)
          }
          if (st.occursInto) this.assignTo(st.occursInto, new RtElem('I', v.rows.length), scope)
        }
        return SIG_NONE
      }
      case 'assign': {
        // ASSIGN src TO <fs> [CASTING TYPE t]
        const box = this.resolveBox(st.src, scope)
        const fsBox = this.resolveBox(st.fs, scope)
        this.setSys('SUBRC', 0)
        // store target box into fs entry
        const fsName = this.fsNameOf(st.fs)
        if (fsName) {
          const entry = scope.lookup(fsName) ?? this.globalScope.lookup(fsName)
          if (entry) {
            entry.isFs = true
            entry.fsBox = box
            return SIG_NONE
          }
        }
        // fallback: wrap value
        fsBox.set(box.get())
        return SIG_NONE
      }
      case 'unassign': {
        const fsName = this.fsNameOf(st.fs)
        const entry = (fsName && scope.lookup(fsName)) || (fsName && this.globalScope.lookup(fsName))
        if (entry) entry.fsBox = null
        return SIG_NONE
      }
      case 'move': {
        const src = this.evalExpr(st.src, scope)
        if (st.corresponding) {
          this.moveCorresponding(src, this.resolveBox(st.dst, scope).get())
        } else {
          this.assignTo(st.dst, src, scope)
        }
        return SIG_NONE
      }
      case 'compute': {
        const val = this.evalExpr(st.expr, scope)
        this.assignTo(st.target, val, scope)
        return SIG_NONE
      }
      case 'arith': {
        const a = this.evalExpr(st.a, scope)
        const b = this.evalExpr(st.b, scope)
        const box = this.resolveBox(st.b, scope)
        const na = toNumber(a)
        const nb = toNumber(b)
        let res = 0
        switch (st.op) {
          case 'ADD': res = na + nb; break
          case 'SUBTRACT': res = nb - na; break
          case 'MULTIPLY': res = na * nb; break
          case 'DIVIDE': {
            if (na === 0) throw new RtException('CX_SY_ZERODIVIDE', 'Division by zero')
            res = nb / na
            break
          }
        }
        const cur = box.get()
        if (cur.kind === 'elem') {
          assignElem(cur, new RtElem('F', res))
        }
        return SIG_NONE
      }
      case 'concatenate': return this.execConcatenate(st, scope)
      case 'split': return this.execSplit(st, scope)
      case 'condense': {
        const box = this.resolveBox(st.target, scope)
        const v = box.get()
        if (v.kind === 'elem') {
          let s = String(v.value ?? '')
          if (st.noGaps) s = s.replace(/\s+/g, ' ').trim()
          else {
            // ABAP CONDENSE: remove leading blanks, collapse multiple blanks to one, remove trailing
            s = s.replace(/\s+/g, ' ').trim()
          }
          assignElem(v, new RtElem('STRING', s))
        }
        return SIG_NONE
      }
      case 'translate': {
        const box = this.resolveBox(st.target, scope)
        const v = box.get()
        if (v.kind === 'elem' && v.type !== 'X' && v.type !== 'XSTRING') {
          let s = String(v.value ?? '')
          if (st.toUpper) s = s.toUpperCase()
          else if (st.toLower) s = s.toLowerCase()
          else if (st.using) {
            const rule = toStringValue(this.evalExpr(st.using, scope))
            for (let i = 0; i + 1 < rule.length; i += 2) {
              s = s.split(rule[i]).join(rule[i + 1])
            }
          }
          v.value = s
        }
        return SIG_NONE
      }
      case 'replace': {
        const box = st.in ? this.resolveBox(st.in, scope) : null
        const v = box?.get()
        if (v && v.kind === 'elem') {
          const pat = toStringValue(this.evalExpr(st.pattern, scope))
          const wth = toStringValue(this.evalExpr(st.with, scope))
          let s = String(v.value ?? '')
          let flags = 'g'
          if (st.ignoringCase) flags += 'i'
          try {
            const rx = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
            s = s.replace(rx, wth)
            this.setSys('SUBRC', 0)
          } catch {
            this.setSys('SUBRC', 4)
          }
          v.value = s
        }
        return SIG_NONE
      }
      case 'shift': {
        const box = this.resolveBox(st.target, scope)
        const v = box.get()
        if (v.kind === 'elem') {
          let s = String(v.value ?? '')
          const n = st.places ? Math.trunc(toNumber(this.evalExpr(st.places, scope))) : 1
          if (st.dir === 'left') s = s.slice(n)
          else if (st.dir === 'right') s = s.slice(0, Math.max(0, s.length - n))
          else {
            // circular
            const m = ((n % s.length) + s.length) % s.length
            s = s.slice(m) + s.slice(0, m)
          }
          // pad to original length for fixed C
          if (v.type === 'C' && v.length) s = s.padEnd(v.length, ' ')
          v.value = s
        }
        return SIG_NONE
      }
      case 'find': {
        const v = st.in ? this.evalExpr(st.in, scope) : null
        const pat = toStringValue(this.evalExpr(st.pattern, scope))
        let s = ''
        if (v && v.kind === 'elem') s = String(v.value ?? '')
        const idx = s.indexOf(pat)
        if (idx >= 0) {
          this.setSys('SUBRC', 0)
          this.setSys('FDPOS', idx)
          if (st.matchCount) this.assignTo(st.matchCount, new RtElem('I', st.all ? s.split(pat).length - 1 : 1), scope)
          if (st.matchOffset) this.assignTo(st.matchOffset, new RtElem('I', idx), scope)
          if (st.matchLength) this.assignTo(st.matchLength, new RtElem('I', pat.length), scope)
        } else {
          this.setSys('SUBRC', 4)
          if (st.matchCount) this.assignTo(st.matchCount, new RtElem('I', 0), scope)
        }
        return SIG_NONE
      }
      case 'perform': return this.execPerform(st, scope)
      case 'form': return SIG_NONE
      case 'callfunction': return this.execCallFunction(st, scope)
      case 'functiondef': return SIG_NONE
      case 'event': return SIG_NONE
      case 'message': return this.execMessage(st, scope)
      case 'classdef': case 'classimpl': return SIG_NONE
      case 'createobject': {
        let clsName = st.className
        if (!clsName) {
          const t = this.evalExpr(st.target, scope)
          if (t.kind === 'oref') clsName = t.clsName || t.refType || ''
        }
        if (!clsName) throw new RtDump('CREATE OBJECT: object type could not be determined', 'CREATE_OBJ_TYPE_NOT_FOUND')
        const obj = this.instantiate(clsName, st.exporting, scope)
        this.assignTo(st.target, obj, scope)
        return SIG_NONE
      }
      case 'callmethod': {
        // CALL METHOD [recv->|class=>]meth ...
        let recvVal: RtValue | undefined
        let staticCls = ''
        if (st.recv) {
          if (st.recv.t === 'var') {
            const entry = scope.lookup(st.recv.name)
            if (entry) recvVal = entry.value
            else if (this.classes.has(st.recv.name) || this.interfaces.has(st.recv.name) || isNativeClassName(st.recv.name)) staticCls = st.recv.name
            else {
              // maybe ME / SUPER
              if (st.recv.name === 'ME' && this.currentSelf) recvVal = this.currentSelf
              else if (st.recv.name === 'SUPER' && this.currentSelf) { recvVal = this.currentSelf; staticCls = this.parentOfClass(this.currentClassName ?? '') }
              else throw new RtDump(`Class or object ${st.recv.name} is unknown`, 'FIELD_UNKNOWN')
            }
          } else {
            recvVal = this.evalExpr(st.recv, scope)
          }
        }
        const method = st.name ?? this.getMethodCallName(st, scope)
        this.invokeMethodOrStatic(recvVal, staticCls, method, st.args, scope, undefined, st.line)
        return SIG_NONE
      }
      case 'methodcallexpr': {
        this.evalExpr(st.expr, scope)
        return SIG_NONE
      }
      case 'sethandler': {
        for (const h of st.handlers) {
          let clsName = ''
          let isStatic = false
          let targetOref: RtOref | undefined
          let box: Box | undefined
          if (h.recv) {
            if (h.recv.t === 'var') {
              const entry = scope.lookup(h.recv.name)
              if (entry && entry.value.kind === 'oref') {
                targetOref = entry.value
                clsName = entry.value.clsName
              } else {
                clsName = h.recv.name
                isStatic = true
              }
            }
          } else {
            // method of current class
            clsName = this.currentClassName ?? ''
            isStatic = false
            if (this.currentSelf) targetOref = this.currentSelf
          }
          this.eventHandlers.push({ clsName, methodName: h.name, isStatic, targetOref, box })
        }
        return SIG_NONE
      }
      case 'raiseevent': return this.execRaiseEvent(st, scope)
      case 'try': {
        try {
          const sig = this.execStmts(st.tryBody, scope)
          if (sig.type !== 'none') return sig
        } catch (e) {
          if (e instanceof RtException) {
            for (const c of st.catches) {
              if (this.exceptionMatches(e.className, c.className)) {
                if (c.into) {
                  const obj = e.obj ?? this.makeExceptionObject(e.className, e.message)
                  this.assignTo(c.into, obj, scope)
                }
                return this.execStmts(c.body, scope)
              }
            }
          }
          throw e
        }
        return SIG_NONE
      }
      case 'raiseexception': {
        // inside a function module: RAISE <exc_name> → caller handles via EXCEPTIONS/sy-subrc
        if (!this.classes.has(st.className) && !st.className.startsWith('CX_') && (this.currentFormScope as any)?.kind === 'function') {
          const err: any = new RtFatal(`Exception ${st.className} raised in function module`, 'E')
          err.excName = st.className
          throw err
        }
        const msgText = st.message ? (st.message.t === 'str' ? (st.message as any).v : toStringValue(this.evalExpr(st.message, scope))) : `Exception in ${st.className}`
        throw new RtException(st.className, msgText, this.makeExceptionObject(st.className, msgText, st.exporting, scope))
      }
      case 'select': return this.execSelect(st, scope)
      case 'insertdb': return this.execInsertDb(st, scope)
      case 'updatedb': return this.execUpdateDb(st, scope)
      case 'modifydb': return this.execModifyDb(st, scope)
      case 'deletedb': return this.execDeleteDb(st, scope)
      case 'wait': return SIG_NONE
      case 'leave': {
        if (st.toTransaction) {
          throw new RtFatal(`LEAVE TO TRANSACTION ${toStringValue(this.evalExpr(st.toTransaction, scope))} — not supported in simulation`, 'A')
        }
        return { type: 'leaveProgram' }
      }
      case 'commit': return SIG_NONE
      case 'gettime': {
        const sy = this.globalScope.lookup('SY')?.value as RtStruct
        const d = sy.fields.get('DATUM') as RtElem
        d.value = todayYYYYMMDD()
        const t = sy.fields.get('UZEIT') as RtElem
        t.value = nowHHMMSS()
        if (st.target) this.assignTo(st.target, initialElem('P', 0), scope)
        return SIG_NONE
      }
      case 'getruntime': {
        this.assignTo(st.target, new RtElem('I', Math.round((Date.now() - this.startTime) * 1000)), scope)
        return SIG_NONE
      }
      case 'setpfstatus': case 'settitlebar': {
        if (st.t === 'settitlebar' && st.title) {
          const sy = this.globalScope.lookup('SY')?.value as RtStruct
          const ti = sy.fields.get('TITLE') as RtElem
          if (ti) ti.value = toStringValue(this.evalExpr(st.title, scope)).slice(0, 70)
        }
        return SIG_NONE
      }
      case 'authoritycheck': case 'submit': case 'datainfo': return SIG_NONE
      case 'expr': {
        this.evalExpr(st.expr, scope)
        return SIG_NONE
      }
      default:
        return SIG_NONE
    }
  }

  private getMethodCallName(st: any, scope: Scope): string {
    return st.name ?? ''
  }

  private fsNameOf(e: Expr): string | null {
    if (e.t === 'var') return e.name
    return null
  }

  private mapColor(c: string, on: boolean): string {
    const names: Record<string, string> = {
      '1': 'heading', '2': 'normal', '3': 'total', '4': 'key', '5': 'positive', '6': 'negative', '7': 'group',
      COL_HEADING: 'heading', COL_NORMAL: 'normal', COL_TOTAL: 'total', COL_KEY: 'key',
      COL_POSITIVE: 'positive', COL_NEGATIVE: 'negative', COL_GROUP: 'group', COL_BACKGROUND: 'background',
    }
    let base = names[c] ?? 'normal'
    if (!on) base = 'off'
    return base
  }

  // ── WRITE ───────────────────────────────────────────────────────────
  execWrite(st: any, scope: Scope): Signal {
    for (const item of st.items) {
      if (item.newline) {
        this.newline()
      }
      let col = this.curCol
      let len: number | undefined
      if (item.pos?.col !== undefined || item.pos?.len !== undefined) {
        if (item.pos?.col !== undefined) col = this.exprNum(item.pos.col, scope)
        if (item.pos?.len !== undefined) len = this.exprNum(item.pos.len, scope)
      }
      const v = this.evalExpr(item.expr, scope)
      const w = writeText(v, { noSign: item.noSign, noZero: item.noZero })
      let text = w.text
      // justification
      const isNum = w.kind === 'number'
      if (len !== undefined) {
        if (text.length > len) text = text.slice(0, len)
        else if (item.justified === 'left') text = text.padEnd(len)
        else if (item.justified === 'center') {
          const l = Math.floor((len - text.length) / 2)
          text = ' '.repeat(l) + text.padEnd(len - l)
        } else if (isNum || item.justified === 'right') text = text.padStart(len)
        else text = text.padEnd(len)
      } else if (isNum) {
        text = text.padStart(w.outLen)
      } else if (item.justified === 'right') {
        text = text.padStart(w.outLen)
      }
      if (text.length === 0) text = ''
      const segColor = item.color ? this.mapColor(item.color, item.colorOn !== false) : this.formatState.color
      this.pushSegment(text, col, {
        color: segColor || undefined,
        intensified: item.intensified === 'off' ? false : item.intensified === 'on' ? true : this.formatState.intensified || undefined,
        inverse: item.inverse === 'on' ? true : item.inverse === 'off' ? false : this.formatState.inverse || undefined,
        hotspot: item.hotspot === 'on' || (item.hotspot === undefined && this.formatState.hotspot) || undefined,
        input: item.input || undefined,
        kind: w.kind,
      })
      if (item.noGap) this.curCol = col + text.length
    }
    return SIG_NONE
  }

  pushSegment(text: string, x: number, extra: Partial<ListSegment>) {
    if (!this.topOfPageDone && this.lines.length === 0 && this.curSegments.length === 0 && this.prog.events.has('TOP-OF-PAGE')) {
      this.execStmts(this.prog.events.get('TOP-OF-PAGE')!, this.globalScope)
      this.topOfPageDone = true
    }
    if (text.length > 0) {
      this.lineOpen = true
      this.curSegments.push({ text, x, len: text.length, ...extra })
      this.curCol = x + text.length
    }
  }

  // '/' — move to next line (first output starts at line 1)
  newline() {
    if (this.lineOpen) {
      this.lines.push({ segments: this.curSegments })
      this.linesWritten++
      this.checkLineLimit()
      this.curLine++
    }
    this.curSegments = []
    this.lineOpen = true
  }

  flushLine() {
    if (this.lineOpen && this.curSegments.length > 0) {
      this.lines.push({ segments: this.curSegments })
      this.linesWritten++
      this.checkLineLimit()
      this.curLine++
    }
    this.curSegments = []
    this.lineOpen = false
    this.curCol = 1
  }

  checkLineLimit() {
    if (this.linesWritten > 10000) throw new RtDump('List output exceeds 10000 lines', 'LIST_OUTPUT_LIMIT')
  }

  // ── LOOP ────────────────────────────────────────────────────────────
  execLoop(st: any, scope: Scope): Signal {
    const tableVal = this.evalExpr(st.table, scope)
    if (!tableVal || tableVal.kind !== 'table') {
      throw new RtDump(`LOOP AT: ${exprToName(st.table)} is not an internal table`, 'ITAB_WRONG_TYPE')
    }
    const rows = tableVal.rows
    let startIdx = st.from ? this.exprNum(st.from, scope) - 1 : 0
    let endIdx = st.to ? this.exprNum(st.to, scope) - 1 : rows.length - 1
    if (startIdx < 0) startIdx = 0
    for (let i = startIdx; i <= endIdx && i < rows.length; i++) {
      this.tick()
      const row = rows[i]
      if (st.where) {
        const condOk = this.evalRowCond(st.where, row, scope)
        if (!condOk) continue
      }
      this.setSys('TABIX', i + 1)
      if (st.into) {
        const box = this.resolveBox(st.into, scope)
        box.set(deepCopyValue(row))
      } else if (st.assigning) {
        this.bindFsToRow(st.assigning, tableVal, i, scope)
      } else if (st.referenceInto) {
        const box = this.resolveBox(st.referenceInto, scope)
        const d = new RtDref()
        d.target = row
        box.set(d)
      }
      const sig = this.execStmts(st.body, scope)
      if (sig.type === 'continue') continue
      if (sig.type === 'exit') break
      if (sig.type !== 'none') return sig
    }
    return SIG_NONE
  }

  evalRowCond(cond: Expr, row: RtValue, scope: Scope): boolean {
    // evaluate condition where unqualified names resolve to row components first
    return this.truthy(this.evalExpr(cond, scope, row))
  }

  bindFsToRow(fsExpr: Expr, table: RtTable, idx: number, scope: Scope) {
    const name = fsExpr.t === 'var' || fsExpr.t === 'fsdecl' ? fsExpr.name : null
    if (!name) return
    let entry = scope.lookup(name) ?? this.globalScope.lookup(name)
    if (!entry) {
      // inline FIELD-SYMBOL(<fs>) — declare in current scope
      scope.declare(name, initialElem('C', 1))
      entry = scope.vars.get(name)!
    }
    entry.isFs = true
    entry.fsBox = {
      get: () => table.rows[idx],
      set: (v) => { table.rows[idx] = v },
    }
  }

  // ── table ops ───────────────────────────────────────────────────────
  getTable(e: Expr, scope: Scope): RtTable {
    const v = this.evalExpr(e, scope)
    if (!v || v.kind !== 'table') throw new RtDump(`${exprToName(e)} is not an internal table`, 'ITAB_WRONG_TYPE')
    return v
  }

  execAppend(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    let lineVal: RtValue
    if (st.initialLine) lineVal = initialFromDef(table.lineType)
    else if (st.linesOf) {
      const src = this.evalExpr(st.linesOf, scope)
      if (src.kind === 'table') {
        for (const r of src.rows) table.rows.push(deepCopyValue(r))
        this.setSys('SUBRC', 0)
        return SIG_NONE
      }
      throw new RtDump('APPEND LINES OF: source is not a table', 'ITAB_WRONG_TYPE')
    } else if (st.src) {
      lineVal = deepCopyValue(this.evalExpr(st.src, scope))
    } else {
      lineVal = initialFromDef(table.lineType)
    }
    // adapt to line type
    lineVal = this.adaptToType(lineVal, table.lineType)
    table.rows.push(lineVal)
    this.setSys('SUBRC', 0)
    if (st.assigning) this.bindFsToRow(st.assigning, table, table.rows.length - 1, scope)
    return SIG_NONE
  }

  adaptToType(v: RtValue, def: AbapTypeDef): RtValue {
    if (def.kind === 'elem') {
      if (v.kind === 'elem') return v
      const e = initialFromDef(def) as RtElem
      assignElem(e, v)
      return e
    }
    if (def.kind === 'struct') {
      if (v.kind === 'struct') return v
      const s = initialFromDef(def) as RtStruct
      if (v.kind === 'elem') {
        // spread char over? keep initial
        return s
      }
      return s
    }
    if (def.kind === 'table') return v
    if (def.kind === 'oref') return v
    return v
  }

  execInsert(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    if (st.linesOf) {
      const src = this.evalExpr(st.linesOf, scope)
      if (src.kind === 'table') {
        for (const r of src.rows) table.rows.push(deepCopyValue(r))
        this.setSys('SUBRC', 0)
      }
      return SIG_NONE
    }
    const lineVal = st.src ? this.adaptToType(deepCopyValue(this.evalExpr(st.src, scope)), table.lineType) : initialFromDef(table.lineType)
    if (st.index) {
      const idx = this.exprNum(st.index, scope)
      if (idx >= 1 && idx <= table.rows.length + 1) {
        table.rows.splice(idx - 1, 0, lineVal)
        this.setSys('SUBRC', 0)
      } else this.setSys('SUBRC', 4)
    } else {
      table.rows.push(lineVal)
      this.setSys('SUBRC', 0)
    }
    if (st.assign) this.bindFsToRow(st.assign, table, table.rows.length - 1, scope)
    return SIG_NONE
  }

  execReadTable(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    let found = -1
    if (st.index !== undefined) {
      const idx = this.exprNum(st.index, scope)
      if (idx >= 1 && idx <= table.rows.length) found = idx - 1
    } else if (st.withKey) {
      if (st.withKey.simple !== undefined) {
        const val = this.evalExpr(st.withKey.simple, scope)
        // compare with first key field or first field
        const keyName = table.keyFields?.[0] ?? (table.lineType.kind === 'struct' ? table.lineType.fields[0]?.name : null)
        if (keyName) {
          for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i]
            const comp = this.readComponent(row, keyName)
            if (comp && valuesEqual(comp, val)) { found = i; break }
          }
        }
      } else {
        for (let i = 0; i < table.rows.length; i++) {
          const row = table.rows[i]
          let ok = true
          for (const comp of st.withKey.comps) {
            const expected = this.evalExpr(comp.value, scope)
            const actual = this.readComponent(row, comp.name)
            if (!actual || !valuesEqual(actual, expected)) { ok = false; break }
          }
          if (ok) { found = i; break }
        }
      }
    } else {
      // default: index 1? ABAP requires key or index; use sy-index? Read with nothing → use index 1
      if (table.rows.length > 0) found = 0
    }
    if (found < 0) {
      this.setSys('SUBRC', st.index !== undefined ? 4 : 4)
      this.setSys('TABIX', 0)
      return SIG_NONE
    }
    this.setSys('SUBRC', 0)
    this.setSys('TABIX', found + 1)
    const row = table.rows[found]
    if (st.into) {
      const box = this.resolveBox(st.into, scope)
      box.set(deepCopyValue(row))
    }
    if (st.assigning) {
      this.bindFsToRow(st.assigning, table, found, scope)
    }
    if (st.referenceInto) {
      const box = this.resolveBox(st.referenceInto, scope)
      const d = new RtDref()
      d.target = row
      box.set(d)
    }
    return SIG_NONE
  }

  readComponent(row: RtValue, name: string): RtValue | null {
    if (row.kind === 'struct') return row.fields.get(name) ?? null
    return null
  }

  execModifyItab(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    const src = this.evalExpr(st.src, scope)
    let count = 0
    if (st.where) {
      for (let i = 0; i < table.rows.length; i++) {
        if (this.evalRowCond(st.where, table.rows[i], scope)) {
          table.rows[i] = this.mergeRow(table.rows[i], src, st.transporting)
          count++
        }
      }
    } else if (st.index !== undefined) {
      const idx = this.exprNum(st.index, scope)
      if (idx >= 1 && idx <= table.rows.length) {
        table.rows[idx - 1] = this.mergeRow(table.rows[idx - 1], src, st.transporting)
        count = 1
      }
    } else {
      // modify current loop row via sy-tabix
      const idx = toNumber(this.sysVal('TABIX'))
      if (idx >= 1 && idx <= table.rows.length) {
        table.rows[idx - 1] = this.mergeRow(table.rows[idx - 1], src, st.transporting)
        count = 1
      }
    }
    this.setSys('SUBRC', count > 0 ? 0 : 4)
    return SIG_NONE
  }

  mergeRow(target: RtValue, src: RtValue, transporting?: string[]): RtValue {
    if (src.kind === 'struct' && target.kind === 'struct') {
      for (const [k, v] of src.fields) {
        if (transporting && !transporting.includes(k)) continue
        if (target.fields.has(k)) target.fields.set(k, deepCopyValue(v))
      }
      return target
    }
    return deepCopyValue(src)
  }

  execDeleteItab(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    if (st.adjacentDuplicates) {
      let count = 0
      const compareFields = st.comparing && st.comparing[0] !== 'ALL' ? st.comparing : null
      for (let i = table.rows.length - 2; i >= 0; i--) {
        const a = table.rows[i]
        const b = table.rows[i + 1]
        let same = false
        if (compareFields) {
          same = compareFields.every((f) => {
            const ca = this.readComponent(a, f)
            const cb = this.readComponent(b, f)
            return ca && cb && valuesEqual(ca, cb)
          })
        } else {
          same = valuesEqual(a, b)
        }
        if (same) {
          table.rows.splice(i + 1, 1)
          count++
        }
      }
      this.setSys('SUBRC', 0)
      return SIG_NONE
    }
    let count = 0
    if (st.where) {
      for (let i = table.rows.length - 1; i >= 0; i--) {
        if (this.evalRowCond(st.where, table.rows[i], scope)) {
          table.rows.splice(i, 1)
          count++
        }
      }
    } else if (st.index !== undefined) {
      const idx = this.exprNum(st.index, scope)
      if (idx >= 1 && idx <= table.rows.length) {
        table.rows.splice(idx - 1, 1)
        count = 1
      }
    } else if (st.from !== undefined || st.to !== undefined) {
      const from = st.from ? this.exprNum(st.from, scope) : 1
      const to = st.to ? this.exprNum(st.to, scope) : table.rows.length
      const del = Math.max(0, to - from + 1)
      table.rows.splice(from - 1, del)
      count = del
    } else {
      // delete current row (sy-tabix)
      const idx = toNumber(this.sysVal('TABIX'))
      if (idx >= 1 && idx <= table.rows.length) {
        table.rows.splice(idx - 1, 1)
        count = 1
      }
    }
    this.setSys('SUBRC', count > 0 ? 0 : 4)
    return SIG_NONE
  }

  execSort(st: any, scope: Scope): Signal {
    const table = this.getTable(st.table, scope)
    const keys = st.by.length > 0 ? st.by : [{ expr: null, dir: st.defaultDir }]
    const fieldNames = keys.map((k: any) => (k.expr ? exprToName(k.expr) : null))
    const dirs = keys.map((k: any) => k.dir)
    table.rows.sort((a, b) => {
      for (let i = 0; i < keys.length; i++) {
        const fname = fieldNames[i]
        let va: RtValue, vb: RtValue
        if (fname) {
          va = this.readComponent(a, fname) ?? initialElem('C', 1)
          vb = this.readComponent(b, fname) ?? initialElem('C', 1)
        } else {
          va = a
          vb = b
        }
        const cmp = compareValues(va, vb)
        const applied = dirs[i] === 'desc' ? -cmp : cmp
        if (applied !== 0) return applied
      }
      return 0
    })
    return SIG_NONE
  }

  moveCorresponding(src: RtValue, dst: RtValue) {
    if (src.kind === 'struct' && dst.kind === 'struct') {
      for (const [k, v] of src.fields) {
        if (dst.fields.has(k)) {
          const target = dst.fields.get(k)!
          if (target.kind === 'elem' && v.kind === 'elem') assignElem(target, v)
          else dst.fields.set(k, deepCopyValue(v))
        }
      }
    }
    if (src.kind === 'table' && dst.kind === 'table') {
      // move-corresponding tables line by line
      dst.rows = []
      for (const r of src.rows) {
        const newRow = initialFromDef(dst.lineType)
        this.moveCorresponding(r, newRow)
        dst.rows.push(newRow)
      }
    }
  }

  // ── string statements ───────────────────────────────────────────────
  execConcatenate(st: any, scope: Scope): Signal {
    let parts: string[] = []
    if (st.linesOf) {
      const t = this.evalExpr(st.linesOf, scope)
      if (t.kind === 'table') {
        for (const r of t.rows) parts.push(toStringValue(r))
      }
    } else {
      parts = st.sources.map((s: Expr) => toStringValue(this.evalExpr(s, scope)))
    }
    const sep = st.separatedBy ? toStringValue(this.evalExpr(st.separatedBy, scope)) : ''
    let result: string
    if (st.respectingBlanks) result = parts.join(sep)
    else result = parts.map((p) => p.replace(/\s+$/, '')).join(sep)
    if (st.into) this.assignTo(st.into, new RtElem('STRING', result), scope)
    return SIG_NONE
  }

  execSplit(st: any, scope: Scope): Signal {
    const src = toStringValue(this.evalExpr(st.src, scope))
    const sep = toStringValue(this.evalExpr(st.at, scope))
    const parts = src.split(sep)
    if (st.intoTable) {
      const tab = this.getTable(st.intoTable, scope)
      tab.rows = []
      for (const p of parts) {
        const line = initialFromDef(tab.lineType)
        if (line.kind === 'elem') assignElem(line, new RtElem('STRING', p))
        tab.rows.push(line)
      }
    } else {
      for (let i = 0; i < st.targets.length; i++) {
        const val = i < parts.length ? parts[i] : ''
        this.assignTo(st.targets[i], new RtElem('STRING', val), scope)
      }
    }
    return SIG_NONE
  }

  // ── PERFORM / FORM ──────────────────────────────────────────────────
  execPerform(st: any, scope: Scope): Signal {
    const form = this.prog.forms.get(st.form)
    if (!form) throw new RtDump(`PERFORM: form ${st.form} is unknown`, 'FORM_UNKNOWN')
    const formScope = new Scope('form', this.globalScope)
    // bind USING (by value), CHANGING/TABLES (by reference boxes)
    const bindParams = (params: FormParam[], args: Expr[], byRef: boolean) => {
      for (let i = 0; i < params.length; i++) {
        const p = params[i]
        const arg = args[i]
        if (!arg) {
          formScope.declare(p.name, initialFromDef(this.paramTypeSpec(p, formScope)))
          continue
        }
        if (byRef) {
          const box = this.resolveBox(arg, scope)
          const entry = formScope.declare(p.name, box.get())
          // mark as ref param: store box in special map
          ;(formScope as any).refBoxes = (formScope as any).refBoxes ?? new Map()
          ;(formScope as any).refBoxes.set(p.name, box)
        } else {
          let val = deepCopyValue(this.evalExpr(arg, scope))
          if (p.typeSpec) {
            const def = this.resolveTypeSpec(p.typeSpec, formScope)
            val = this.adaptToType(val, def)
          }
          formScope.declare(p.name, val)
        }
      }
    }
    bindParams(form.params.filter((p) => p.kind === 'using'), st.using, false)
    bindParams(form.params.filter((p) => p.kind === 'changing'), st.changing, true)
    bindParams(form.params.filter((p) => p.kind === 'tables'), st.tables, true)
    const sig = this.execStmts(form.body, formScope)
    // write back ref params
    const refBoxes: Map<string, Box> = (formScope as any).refBoxes ?? new Map()
    for (const [name, box] of refBoxes) {
      const entry = formScope.vars.get(name)
      if (entry) box.set(entry.value)
    }
    if (sig.type === 'exitForm' || sig.type === 'leaveProgram' || sig.type === 'none') return sig.type === 'exitForm' ? SIG_NONE : sig
    return SIG_NONE
  }

  paramTypeSpec(p: FormParam, scope: Scope): AbapTypeDef {
    if (p.typeSpec) return this.resolveTypeSpec(p.typeSpec, scope)
    return { kind: 'elem', type: 'C', length: 40 }
  }

  // ── CALL FUNCTION ───────────────────────────────────────────────────
  execCallFunction(st: any, scope: Scope): Signal {
    const fm = this.fms.get(st.name)
    if (!fm) {
      // built-in FMs
      if (st.name === 'REUSE_ALV_GRID_DISPLAY') {
        this.emitReuseAlv(st, scope)
        this.setSys('SUBRC', 0)
        return SIG_NONE
      }
      if (st.name === 'CONVERSION_EXIT_ALPHA_INPUT' || st.name === 'CONVERSION_EXIT_ALPHA_OUTPUT') {
        const inp = st.tables.find((x: any) => x.name === 'INPUT') ?? st.changing.find((x: any) => x.name === 'INPUT')
        if (inp) {
          const box = this.resolveBox(inp.value, scope)
          const v = box.get()
          if (v.kind === 'elem') {
            let s = String(v.value ?? '')
            if (st.name === 'CONVERSION_EXIT_ALPHA_INPUT') s = s.replace(/^0+/, '').padStart(v.length ?? 10, '0')
            else s = s.replace(/^0+/, '') || '0'
            v.value = s
          }
        }
        this.setSys('SUBRC', 0)
        return SIG_NONE
      }
      throw new RtDump(`Function module ${st.name} is unknown`, 'FUNCTION_NOT_FOUND')
    }
    // run FM
    const fmScope = new Scope('function', this.globalScope)
    const refBoxes = new Map<string, Box>()
    const bind = (params: any[], args: CallArg[], ref: boolean) => {
      for (const p of params) {
        const arg = args.find((a) => a.name === p.name.toUpperCase())
        if (!arg) {
          fmScope.declare(p.name, initialFromDef(this.fmParamDef(p)))
          continue
        }
        if (ref) {
          const box = this.resolveBox(arg.value, scope)
          fmScope.declare(p.name, box.get())
          refBoxes.set(p.name, box)
        } else {
          fmScope.declare(p.name, deepCopyValue(this.evalExpr(arg.value, scope)))
        }
      }
    }
    bind(fm.importing, st.exporting, false)
    bind(fm.exporting, st.importing, true)
    bind(fm.tables, st.tables, true)
    bind(fm.changing, st.changing, true)
    const outParams = [...fm.exporting.map((p) => p.name), ...fm.tables.map((p) => p.name), ...fm.changing.map((p) => p.name)]
    const fmProg = fm.prog
    const fnDef = [...fmProg.functions.values()][0]
    const prevForm = this.currentFormScope
    this.currentFormScope = fmScope
    try {
      const sig = this.execStmts(fnDef.body, fmScope)
    } catch (e) {
      // RAISE <exception> inside FM → RtFatal with excName
      if (e instanceof RtFatal && (e as any).excName) {
        const excName = (e as any).excName
        const excArg = st.exceptions.find((x: any) => x.name === excName || x.name === 'OTHERS')
        if (excArg) {
          const code = toNumber(this.evalExpr(excArg.value, scope)) || 1
          this.setSys('SUBRC', code)
          return SIG_NONE
        }
        this.setSys('SUBRC', 1)
        return SIG_NONE
      }
      throw e
    } finally {
      this.currentFormScope = prevForm
    }
    // write back ref params
    for (const [name, box] of refBoxes) {
      const entry = fmScope.vars.get(name)
      if (entry) box.set(entry.value)
    }
    // IMPORTING section: caller receives export params
    for (const arg of st.importing) {
      const entry = fmScope.vars.get(arg.name.toUpperCase())
      if (entry) this.assignTo(arg.value, entry.value, scope)
    }
    this.setSys('SUBRC', 0)
    return SIG_NONE
  }

  fmParamDef(p: any): AbapTypeDef {
    const t = String(p.type ?? '').toUpperCase()
    if (t === 'I' || t === 'INT4') return { kind: 'elem', type: 'I' }
    if (t === 'STRING' || t === 'STR') return { kind: 'elem', type: 'STRING' }
    if (t === 'CHAR' || t === 'C') return { kind: 'elem', type: 'C', length: p.length ?? 30 }
    if (t === 'NUMC' || t === 'N') return { kind: 'elem', type: 'N', length: p.length ?? 10 }
    if (t === 'DEC' || t === 'P' || t === 'QUAN' || t === 'CURR') return { kind: 'elem', type: 'P', length: p.length ?? 13, decimals: 2 }
    if (t === 'DATE' || t === 'DATS' || t === 'D') return { kind: 'elem', type: 'D' }
    if (t === 'TIME' || t === 'TIMS' || t === 'T') return { kind: 'elem', type: 'T' }
    if (this.db.get(t)) return this.db.structDefFor(t)
    return { kind: 'elem', type: 'C', length: 40 }
  }

  // ── MESSAGE ─────────────────────────────────────────────────────────
  execMessage(st: any, scope: Scope): Signal {
    let text = ''
    if (st.text) {
      text = st.text.t === 'str' ? (st.text as any).v : toStringValue(this.evalExpr(st.text, scope))
    } else if (st.id && st.number) {
      const num = st.number.t === 'str' ? (st.number as any).v.replace(/^[eiasiwx]/i, '') : String(toNumber(this.evalExpr(st.number, scope))).padStart(3, '0')
      const args = st.with.map((w: Expr) => toStringValue(this.evalExpr(w, scope)))
      let t = `Message ${num}(${st.id})`
      if (args.length) t += `: ${args.join(' ')}`
      text = t
      if (!st.msgType) st.msgType = 'E'
    }
    const msgType = (st.msgType ?? 'S').toUpperCase()
    const item: MessageItem = { msgType: msgType as any, text, displayLike: st.displayLike, line: st.line }
    this.setSys('MSGTY', msgType)
    this.setSys('MSGV1', st.with[0] ? toStringValue(this.evalExpr(st.with[0], scope)).slice(0, 50) : '')
    if (st.raise) {
      // RAISE exc inside function module
      const err = new RtFatal(`Exception ${st.raise} raised in function module`, 'E') as any
      err.excName = st.raise
      throw err
    }
    if (msgType === 'I' || msgType === 'S' || msgType === 'W') {
      this.messages.push(item)
      return SIG_NONE
    }
    if (msgType === 'E' || msgType === 'A') {
      this.messages.push(item)
      this.aborted = true
      this.abortedMsg = item
      throw new RtFatal(text, msgType)
    }
    if (msgType === 'X') {
      throw new RtDump(text, 'MESSAGE_TYPE_X')
    }
    return SIG_NONE
  }

  // ── OOP runtime ─────────────────────────────────────────────────────
  allMethodsOf(clsName: string): Map<string, MethodDecl> {
    const out = new Map<string, MethodDecl>()
    const chain = this.classChain(clsName)
    // iterate root-first so subclass overrides
    for (const cn of [...chain].reverse()) {
      const def = this.classes.get(cn)
      if (!def) continue
      for (const sec of def.sections) {
        for (const m of sec.members) {
          if (m.kind !== 'method') continue
          const d = m.decl
          // a bare REDEFINITION (no own params, no returning) inherits the parent signature
          const isBareRedefinition = d.redefinition && d.importing.length === 0 && d.exporting.length === 0 && d.changing.length === 0 && !d.returning
          if (isBareRedefinition && out.has(d.name)) continue
          out.set(d.name, d)
        }
      }
      // interface methods
      for (const ifc of def.interfaces) {
        const idef = this.interfaces.get(ifc.name)
        if (!idef) continue
        for (const sec of idef.sections) {
          for (const m of sec.members) {
            if (m.kind === 'method') {
              const key = `${ifc.name}~${m.decl.name}`
              if (!out.has(key)) out.set(key, m.decl)
              // also plain name for aliased access
              if (!out.has(m.decl.name)) out.set(m.decl.name, m.decl)
            }
          }
        }
      }
    }
    return out
  }

  classChain(clsName: string): string[] {
    const chain: string[] = []
    let cur: string | undefined = clsName
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      chain.push(cur)
      const def = this.classes.get(cur)
      cur = def?.inheriting
    }
    return chain
  }

  parentOfClass(clsName: string): string {
    return this.classes.get(clsName)?.inheriting ?? ''
  }

  findMethod(clsName: string, methodName: string): { decl: MethodDecl; impl: ClassImplStmt } | null {
    const chain = this.classChain(clsName)
    for (const cn of chain) {
      const impl = this.impls.get(cn)
      if (impl) {
        const m = impl.methods.find((x) => x.name === methodName)
        if (m) {
          const decl = this.allMethodsOf(cn).get(methodName) ?? this.allMethodsOf(clsName).get(methodName)
          return { decl: decl ?? {
            name: methodName, isStatic: false, isConstructor: false, isClassConstructor: false,
            redefinition: false, abstract: false, final: false, visibility: 'public',
            importing: [], exporting: [], changing: [], raising: [], exceptions: [], line: 0,
          }, impl }
        }
      }
      // interface methods: if~meth
      const def = this.classes.get(cn)
      if (def) {
        for (const ifc of def.interfaces) {
          const alias = ifc.aliases.find((a) => a.target === `${ifc.name}~${methodName}`)
          const ifMethodName = `${ifc.name}~${methodName}`
          const impl2 = this.impls.get(cn)
          const m2 = impl2?.methods.find((x) => x.name === ifMethodName)
          if (m2) {
            const idef = this.interfaces.get(ifc.name)
            const idecl = idef ? this.findInterfaceMethod(idef, methodName) : null
            return { decl: idecl ?? {
              name: ifMethodName, isStatic: false, isConstructor: false, isClassConstructor: false,
              redefinition: false, abstract: false, final: false, visibility: 'public',
              importing: [], exporting: [], changing: [], raising: [], exceptions: [], line: 0,
            }, impl: impl2! }
          }
        }
      }
    }
    return null
  }

  findInterfaceMethod(idef: ClassDefStmt, methodName: string): MethodDecl | null {
    for (const sec of idef.sections) {
      for (const m of sec.members) {
        if (m.kind === 'method' && m.decl.name === methodName) return m.decl
      }
    }
    return null
  }

  instantiate(clsName: string, exporting: CallArg[], scope: Scope): RtOref {
    if (isNativeClassName(clsName)) {
      return callNativeStatic(this, clsName, '__CONSTRUCT', exporting, scope) as RtOref
    }
    const def = this.classes.get(clsName)
    if (!def) throw new RtDump(`Class ${clsName} is unknown`, 'CLASS_UNKNOWN')
    const obj = new RtOref(clsName)
    const chain = [...this.classChain(clsName)].reverse()
    for (const cn of chain) {
      const cdef = this.classes.get(cn)
      if (!cdef) continue
      for (const sec of cdef.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var') {
            const d = m.decl as VarDeclStmt
            if (d.kind === 'CLASS-DATA') {
              this.ensureClassStatic(cn, d)
            } else if (d.kind === 'DATA' || d.kind === 'CONSTANTS' || d.kind === 'STATICS') {
              const saved = this.currentClassName
              this.currentClassName = cn
              try {
                const def2 = d.typeSpec ? this.resolveTypeSpec(d.typeSpec, this.globalScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 1 }
                let v = initialFromDef(def2)
                if (d.value) {
                  try {
                    const val = this.evalExpr(d.value, this.globalScope)
                    if (v.kind === 'elem' && val.kind === 'elem') assignElem(v, val)
                    else v = deepCopyValue(val)
                  } catch { /* ignore */ }
                }
                obj.attrs.set(d.name, v)
              } finally {
                this.currentClassName = saved
              }
            }
          }
        }
      }
    }
    // constructors root-first
    const ctorDone = new Set<string>()
    this.ctorDone.set(obj, ctorDone)
    for (const cn of chain) {
      const impl = this.impls.get(cn)
      const ctor = impl?.methods.find((x) => x.name === 'CONSTRUCTOR')
      if (ctor) {
        if (ctorDone.has(cn)) continue
        ctorDone.add(cn)
        const args = cn === clsName ? exporting : []
        this.invokeUserMethod(obj, cn, ctor, 'CONSTRUCTOR', args, scope, undefined, true)
      }
    }
    return obj
  }

  ensureClassStatic(clsName: string, d: VarDeclStmt) {
    let store = this.classStatics.get(clsName)
    if (!store) {
      store = new Map()
      this.classStatics.set(clsName, store)
    }
    if (!store.has(d.name)) {
      const saved = this.currentClassName
      this.currentClassName = clsName
      try {
        const def = d.typeSpec ? this.resolveTypeSpec(d.typeSpec, this.globalScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 1 }
        let v = initialFromDef(def)
        if (d.value) {
          try {
            const val = this.evalExpr(d.value, this.globalScope)
            if (v.kind === 'elem' && val.kind === 'elem') assignElem(v, val)
            else v = deepCopyValue(val)
          } catch { /* ignore */ }
        }
        if (d.kind === 'CONSTANTS' && v.kind === 'elem') v.readOnly = true
        store.set(d.name, v)
      } finally {
        this.currentClassName = saved
      }
    }
  }

  staticsOf(clsName: string): Map<string, RtValue> {
    let store = this.classStatics.get(clsName)
    if (!store) {
      store = new Map()
      this.classStatics.set(clsName, store)
    }
    return store
  }

  invokeMethodOrStatic(recvVal: RtValue | undefined, staticCls: string, method: string, args: CallArg[], scope: Scope, self?: RtOref, line?: number): RtValue {
    if (staticCls) {
      // static method
      if (isNativeClassName(staticCls)) {
        return callNativeStatic(this, staticCls, method, args, scope)
      }
      const def = this.classes.get(staticCls)
      if (def) {
        // class constructor
        this.runClassConstructor(staticCls)
        const impl = this.impls.get(staticCls)
        const m = impl?.methods.find((x) => x.name === method) ?? impl?.methods.find((x) => x.name === `${method}`)
        if (m) {
          return this.invokeUserMethod(undefined, staticCls, m, method, args, scope)
        }
        // maybe inherited static? walk chain
        for (const cn of this.classChain(staticCls)) {
          const impl2 = this.impls.get(cn)
          const m2 = impl2?.methods.find((x) => x.name === method)
          if (m2) return this.invokeUserMethod(undefined, cn, m2, method, args, scope)
        }
        throw new RtDump(`Method ${method} does not exist on class ${staticCls}`, 'METHOD_UNKNOWN')
      }
      const idef = this.interfaces.get(staticCls)
      if (idef) {
        // interface constants? treat as error for methods
        throw new RtDump(`Interface method ${staticCls}~${method} called statically`, 'METHOD_UNKNOWN')
      }
      throw new RtDump(`Class ${staticCls} is unknown`, 'CLASS_UNKNOWN')
    }
    // instance method
    if (!recvVal || recvVal.kind !== 'oref' || recvVal.clsName === '') {
      throw new RtException('CX_SY_REF_IS_INITIAL', `Call of method ${method}: object reference is initial (null)`)
    }
    if (recvVal.native) {
      return callNativeMethod(this, recvVal, method, args, scope)
    }
    const found = this.findMethod(recvVal.clsName, method)
    if (!found) {
      throw new RtDump(`Method ${method} does not exist on class ${recvVal.clsName}`, 'METHOD_UNKNOWN')
    }
    const mImpl = found.impl.methods.find((x) => x.name === method) ?? found.impl.methods[0]
    return this.invokeUserMethod(recvVal, recvVal.clsName, mImpl, method, args, scope)
  }

  runClassConstructor(clsName: string) {
    if (this.classStaticDone.has(clsName)) return
    this.classStaticDone.add(clsName)
    const impl = this.impls.get(clsName)
    const m = impl?.methods.find((x) => x.name === 'CLASS_CONSTRUCTOR')
    if (m) {
      this.invokeUserMethod(undefined, clsName, m, 'CLASS_CONSTRUCTOR', [], this.globalScope)
    }
  }

  invokeUserMethod(self: RtOref | undefined, clsName: string, methodImpl: { name: string; body: Stmt[] }, methodName: string, args: CallArg[], scope: Scope, returningTo?: Box, skipCtorCheck = false): RtValue {
    this.tick()
    const decl = this.allMethodsOf(clsName).get(methodName) ?? this.findMethodAnywhere(clsName, methodName)
    const mScope = new Scope('method', this.globalScope)
    const refBoxes = new Map<string, Box>()
    ;(mScope as any).refBoxes = refBoxes
    // bind params
    const bind = (params: MethParam[], section: string, argsList: CallArg[], byRef: boolean) => {
      for (const p of params) {
        const arg = argsList.find((a) => (a.name ?? '').toUpperCase() === p.name)
        const argSection = arg?.section ?? 'exporting'
        if (!arg || (argSection !== section && !(section === 'exporting' && arg.section === undefined && !arg.name) && !(section === 'exporting' && arg.section === 'exporting'))) {
          // unbound optional/default
          if (p.defaultVal) {
            mScope.declare(p.name, deepCopyValue(this.evalExpr(p.defaultVal, scope)))
          } else {
            const def = p.typeSpec ? this.resolveTypeSpec(p.typeSpec, mScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 40 }
            mScope.declare(p.name, initialFromDef(def))
          }
          continue
        }
        if (byRef) {
          const box = this.resolveBox(arg.value, scope)
          mScope.declare(p.name, box.get())
          refBoxes.set(p.name, box)
        } else {
          let val = this.evalExpr(arg.value, scope)
          if (p.typeSpec) {
            const def = this.resolveTypeSpec(p.typeSpec, mScope)
            val = this.adaptToType(val, def)
          }
          mScope.declare(p.name, deepCopyValue(val))
        }
      }
    }
    if (decl) {
      bind(decl.importing, 'exporting', args, false)
      bind(decl.changing, 'changing', args, true)
      bind(decl.exporting, 'importing', args, true)
      // RETURNING parameter variable
      if (decl.returning) {
        const def = decl.returning.typeSpec ? this.resolveTypeSpec(decl.returning.typeSpec, mScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 1 }
        mScope.declare(decl.returning.name, initialFromDef(def))
      }
    }
    // expose instance attributes (shared value references) + class statics
    if (self) {
      for (const [k, v] of self.attrs) {
        if (!mScope.vars.has(k)) mScope.declare(k, v)
      }
    }
    for (const cn of this.classChain(clsName)) {
      const cdef = this.classes.get(cn)
      if (!cdef) continue
      for (const sec of cdef.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var' && m.decl.kind === 'CLASS-DATA') {
            this.ensureClassStatic(cn, m.decl)
            const store = this.staticsOf(cn)
            if (!mScope.vars.has(m.decl.name) && store.has(m.decl.name)) {
              mScope.declare(m.decl.name, store.get(m.decl.name)!)
            }
          }
        }
      }
    }
    // ME / SUPER
    if (self) {
      mScope.declare('ME', self)
      mScope.declare('SUPER', self)
    }
    const prevCls = this.currentClassName
    const prevSelf = this.currentSelf
    this.currentClassName = clsName
    this.currentSelf = self ?? null
    try {
      const sig = this.execStmts(methodImpl.body, mScope)
    } finally {
      this.currentClassName = prevCls
      this.currentSelf = prevSelf
    }
    // write back refs
    for (const [name, box] of refBoxes) {
      const entry = mScope.vars.get(name)
      if (entry) box.set(entry.value)
    }
    // RETURNING value: local variable named after returning param, or RESULT
    if (decl?.returning) {
      const entry = mScope.vars.get(decl.returning.name)
      if (entry) return entry.value
    }
    return initialElem('C', 1)
  }

  findMethodAnywhere(clsName: string, methodName: string): MethodDecl | null {
    for (const cn of this.classChain(clsName)) {
      const def = this.classes.get(cn)
      if (def) {
        for (const sec of def.sections) {
          for (const m of sec.members) {
            if (m.kind === 'method' && (m.decl.name === methodName || m.decl.name === `${cn}~${methodName}`)) return m.decl
          }
        }
        for (const ifc of def.interfaces) {
          const idef = this.interfaces.get(ifc.name)
          const md = idef ? this.findInterfaceMethod(idef, methodName) : null
          if (md) return md
          const alias = ifc.aliases.find((a) => a.name === methodName)
          if (alias) {
            const [inm, mnm] = alias.target.split('~')
            const idef2 = this.interfaces.get(inm)
            const md2 = idef2 ? this.findInterfaceMethod(idef2, mnm) : null
            if (md2) return md2
          }
        }
      }
    }
    return null
  }

  makeExceptionObject(clsName: string, message: string, exporting?: CallArg[], scope?: Scope): RtOref {
    const oref = new RtOref(clsName)
    if (isNativeClassName(clsName) || clsName.startsWith('CX_')) {
      oref.native = { nativeKind: 'cx', data: { message } }
      oref.clsName = clsName
    } else {
      // user exception class — instantiate without ctor
      const def = this.classes.get(clsName)
      if (def) {
        for (const cn of [...this.classChain(clsName)].reverse()) {
          const cdef = this.classes.get(cn)
          if (!cdef) continue
          for (const sec of cdef.sections) {
            for (const m of sec.members) {
              if (m.kind === 'var' && m.decl.kind === 'DATA') {
                const d = m.decl
                const def2 = d.typeSpec ? this.resolveTypeSpec(d.typeSpec, this.globalScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 1 }
                oref.attrs.set(d.name, initialFromDef(def2))
              }
            }
          }
        }
      }
      const txt = new RtElem('STRING', message)
      oref.attrs.set('TEXT', txt)
    }
    return oref
  }

  exceptionMatches(thrown: string, caught: string): boolean {
    if (thrown === caught) return true
    if (caught === 'CX_ROOT') return true
    let cur: string | undefined = thrown
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (cur === caught) return true
      const userDef = this.classes.get(cur)
      cur = userDef?.inheriting ?? BUILTIN_EXC_HIER[cur]?.[0]
    }
    return false
  }

  execRaiseEvent(st: any, scope: Scope): Signal {
    const evName = st.event.toUpperCase()
    const self = this.currentSelf
    // gather event params
    const params: Record<string, RtValue> = {}
    for (const arg of st.exporting) {
      params[(arg.name ?? '').toUpperCase()] = this.evalExpr(arg.value, scope)
    }
    if (self) params['SENDER'] = self
    for (const h of this.eventHandlers) {
      // which event does this handler handle? prefer the FOR EVENT declaration
      const decl = this.allMethodsOf(h.clsName || (self?.clsName ?? '')).get(h.methodName)
      const handles =
        decl?.forEvent?.toUpperCase() === evName ||
        h.methodName.toUpperCase() === evName ||
        h.methodName.toUpperCase().includes(evName)
      if (!handles) continue
      if (h.isStatic) {
        this.invokeMethodOrStatic(undefined, h.clsName, h.methodName, [], this.globalScope)
      } else {
        const target = h.targetOref ?? self
        if (target) {
          const found = this.findMethod(target.clsName, h.methodName)
          if (found) {
            const mImpl = found.impl.methods.find((x) => x.name === h.methodName) ?? found.impl.methods[0]
            this.invokeUserMethodWithParams(target, target.clsName, mImpl, h.methodName, params, this.globalScope)
          }
        }
      }
    }
    return SIG_NONE
  }

  invokeUserMethodWithParams(self: RtOref, clsName: string, methodImpl: { name: string; body: Stmt[] }, methodName: string, params: Record<string, RtValue>, scope: Scope): RtValue {
    const decl = this.allMethodsOf(clsName).get(methodName)
    const mScope = new Scope('method', this.globalScope)
    if (decl) {
      const bind = (plist: MethParam[]) => {
        for (const p of plist) {
          const v = params[p.name.toUpperCase()]
          if (v !== undefined) mScope.declare(p.name, deepCopyValue(v))
          else mScope.declare(p.name, initialFromDef(p.typeSpec ? this.resolveTypeSpec(p.typeSpec, mScope) : { kind: 'elem', type: 'C', length: 40 }))
        }
      }
      bind(decl.importing)
      if (decl.returning) {
        const def = decl.returning.typeSpec ? this.resolveTypeSpec(decl.returning.typeSpec, mScope) : { kind: 'elem' as const, type: 'C' as ElemType, length: 1 }
        mScope.declare(decl.returning.name, initialFromDef(def))
      }
    }
    if (self) {
      mScope.declare('ME', self)
      mScope.declare('SUPER', self)
      for (const [k, v] of self.attrs) {
        if (!mScope.vars.has(k)) mScope.declare(k, v)
      }
    }
    for (const cn of this.classChain(clsName)) {
      const cdef = this.classes.get(cn)
      if (!cdef) continue
      for (const sec of cdef.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var' && m.decl.kind === 'CLASS-DATA') {
            this.ensureClassStatic(cn, m.decl)
            const store = this.staticsOf(cn)
            if (!mScope.vars.has(m.decl.name) && store.has(m.decl.name)) {
              mScope.declare(m.decl.name, store.get(m.decl.name)!)
            }
          }
        }
      }
    }
    const prevCls = this.currentClassName
    const prevSelf = this.currentSelf
    this.currentClassName = clsName
    this.currentSelf = self
    try {
      this.execStmts(methodImpl.body, mScope)
    } finally {
      this.currentClassName = prevCls
      this.currentSelf = prevSelf
    }
    return initialElem('C', 1)
  }

  // ── SQL ─────────────────────────────────────────────────────────────
  execSelect(st: any, scope: Scope): Signal {
    this.selects++
    this.dbReads++
    const mainTable = this.db.get(st.from.table)
    if (!mainTable) throw new RtDump(`Table ${st.from.table} is unknown in SELECT`, 'DBTABLE_UNKNOWN')
    // build joined rows
    type Row = Record<string, any>
    let rows: Row[] = mainTable.rows.map((r) => {
      const o: Row = {}
      for (const f of mainTable.fields) o[`${mainTable.name.toUpperCase()}-${f.name.toUpperCase()}`] = r[f.name.toUpperCase()] ?? ''
      return o
    })
    const aliasOf = (t: string) => {
      const j = st.joins.find((x: any) => x.table === t)
      return (j?.alias ?? (st.from.table === t ? st.from.alias : undefined))?.toUpperCase()
    }
    for (const join of st.joins) {
      const jt = this.db.get(join.table)
      if (!jt) throw new RtDump(`Table ${join.table} is unknown in JOIN`, 'DBTABLE_UNKNOWN')
      const joined: Row[] = []
      for (const left of rows) {
        for (const right of jt.rows) {
          const combined: Row = { ...left }
          for (const f of jt.fields) combined[`${jt.name.toUpperCase()}-${f.name.toUpperCase()}`] = right[f.name.toUpperCase()] ?? ''
          if (this.evalSqlCond(join.on, combined, scope, mainTable.name, jt.name)) joined.push(combined)
        }
      }
      rows = joined
    }
    // WHERE
    if (st.where) {
      rows = rows.filter((r) => this.evalSqlCond(st.where, r, scope, st.from.table, st.joins[0]?.table))
    }
    // aggregates
    const hasAgg = st.fields.some((f: any) => f.count || /^(SUM|AVG|MIN|MAX)\(/i.test(f.expr))
    let outRows: Record<string, any>[] = []
    const fieldSpecs = st.fields.length ? st.fields : [{ expr: '*' }]
    if (hasAgg && st.groupBy && st.groupBy.length) {
      const groups = new Map<string, Row[]>()
      for (const r of rows) {
        const key = st.groupBy.map((g: string) => this.resolveDbField(g, r, st.from.table, st.joins[0]?.table) ?? '').join('|')
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(r)
      }
      for (const [key, grp] of groups) {
        const out: Record<string, any> = {}
        for (const f of fieldSpecs) {
          this.assignSqlField(f, out, grp, st.from.table, st.joins[0]?.table, scope)
        }
        outRows.push(out)
      }
    } else if (hasAgg) {
      const out: Record<string, any> = {}
      for (const f of fieldSpecs) {
        this.assignSqlField(f, out, rows, st.from.table, st.joins[0]?.table, scope)
      }
      outRows.push(out)
    } else {
      for (const r of rows) {
        const out: Record<string, any> = {}
        for (const f of fieldSpecs) {
          this.assignSqlField(f, out, [r], st.from.table, st.joins[0]?.table, scope)
        }
        outRows.push(out)
      }
    }
    // ORDER BY
    if (st.orderBy && st.orderBy.length) {
      const orderBy = st.orderBy
      outRows.sort((a, b) => {
        for (const ob of orderBy) {
          const key = ob.expr.toUpperCase()
          const va = a[key] ?? a[key.replace(/^[A-Z0-9]+~/, '')] ?? ''
          const vb = b[key] ?? b[key.replace(/^[A-Z0-9]+~/, '')] ?? ''
          const na = parseFloat(va)
          const nb = parseFloat(vb)
          let cmp = 0
          if (!isNaN(na) && !isNaN(nb)) cmp = na - nb
          else cmp = String(va) < String(vb) ? -1 : String(va) > String(vb) ? 1 : 0
          if (ob.dir === 'desc') cmp = -cmp
          if (cmp !== 0) return cmp
        }
        return 0
      })
    }
    // DISTINCT
    if (st.distinct) {
      const seen = new Set<string>()
      outRows = outRows.filter((r) => {
        const k = JSON.stringify(r)
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    // UP TO
    if (st.upTo) {
      const n = this.exprNum(st.upTo, scope)
      outRows = outRows.slice(0, n)
    }
    // SELECT SINGLE
    if (st.single) outRows = outRows.slice(0, 1)
    // build output values
    const buildLine = (r: Record<string, any>): RtValue => {
      // struct with plain field names
      const s = new RtStruct()
      for (const [k, v] of Object.entries(r)) {
        const plain = k.replace(/^[A-Z0-9]+[~-]/, '')
        // find DDIC type
        let type: ElemType = 'C'
        let length: number | undefined
        let decimals: number | undefined
        if (typeof v === 'number') {
          type = 'P'
          decimals = 2
        }
        for (const tbl of [mainTable, ...st.joins.map((j: any) => this.db.get(j.table))].filter(Boolean)) {
          const fname = k.includes('-') ? plain : k
          const fd = tbl.fields.find((x) => x.name.toUpperCase() === fname.toUpperCase())
          if (fd) {
            const et = DbSnapshot.fieldToElemType(fd)
            type = et.type
            length = et.length
            decimals = et.decimals
            break
          }
        }
        const e = initialElem(type, length, decimals)
        if (isNumericType(type)) e.value = typeof v === 'number' ? v : parseFloat(String(v)) || 0
        else e.value = String(v)
        s.fields.set(plain, e)
      }
      return s
    }
    const count = outRows.length
    this.setSys('DBCNT', count)
    this.setSys('SUBRC', count > 0 ? 0 : 4)
    if (!st.into) return SIG_NONE
    if (st.intoTable) {
      let table: RtTable
      const intoExpr = st.into
      if (intoExpr.t === 'inlinedecl') {
        table = new RtTable({ kind: 'struct', fields: [] })
        const box = this.resolveBox(intoExpr, scope)
        box.set(table)
      } else {
        const target = this.evalExpr(intoExpr, scope)
        if (target.kind === 'table') table = target
        else {
          table = new RtTable(this.defOfValue(target))
          this.assignTo(intoExpr, table, scope)
        }
      }
      if (!st.appending) table.rows = []
      for (const r of outRows) table.rows.push(buildLine(r))
    } else {
      const box = this.resolveBox(st.into, scope)
      if (outRows.length > 0) {
        const line = buildLine(outRows[0])
        if (st.intoCorresponding) {
          const target = box.get()
          if (target.kind === 'struct') this.moveCorresponding(line, target)
        } else {
          const target = box.get()
          if (target.kind === 'struct') this.moveCorresponding(line, target)
          else if (target.kind === 'elem') box.set(line)
          else box.set(line)
        }
      }
    }
    return SIG_NONE
  }

  resolveDbField(name: string, row: Record<string, any>, mainTable: string, joinTable?: string): any {
    const n = name.toUpperCase()
    if (n.includes('~')) {
      const [alias, field] = n.split('~')
      const key = `${alias}-${field}`
      for (const k of Object.keys(row)) {
        if (k.toUpperCase() === key) return row[k]
      }
      return undefined
    }
    if (row[n] !== undefined) return row[n]
    // plain name → any table-field
    for (const k of Object.keys(row)) {
      if (k.toUpperCase().endsWith(`-${n}`)) return row[k]
    }
    return undefined
  }

  assignSqlField(f: any, out: Record<string, any>, rows: Record<string, any>[], mainTable: string, joinTable: string | undefined, scope: Scope) {
    if (f.expr === '*') {
      const r = rows[0] ?? {}
      for (const [k, v] of Object.entries(r)) {
        out[k] = v
      }
      return
    }
    if (f.count) {
      out[f.alias ?? 'COUNT'] = rows.length
      return
    }
    const aggMatch = f.expr.match(/^(SUM|AVG|MIN|MAX)\((.+)\)$/)
    if (aggMatch) {
      const fn = aggMatch[1]
      const field = aggMatch[2]
      const vals = rows.map((r) => parseFloat(String(this.resolveDbField(field, r, mainTable, joinTable) ?? '0')) || 0)
      let v = 0
      if (fn === 'SUM') v = vals.reduce((a, b) => a + b, 0)
      else if (fn === 'AVG') v = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      else if (fn === 'MIN') v = vals.length ? Math.min(...vals) : 0
      else if (fn === 'MAX') v = vals.length ? Math.max(...vals) : 0
      out[f.alias ?? `${fn}_${field}`] = Math.round(v * 100) / 100
      return
    }
    const v = this.resolveDbField(f.expr, rows[0] ?? {}, mainTable, joinTable)
    out[f.alias ?? f.expr] = v ?? ''
  }

  evalSqlCond(cond: Expr, row: Record<string, any>, scope: Scope, mainTable: string, joinTable?: string): boolean {
    // evaluate condition: identifiers resolve to DB fields first, then scope vars
    const v = this.evalExpr(cond, scope, undefined, { row, mainTable, joinTable })
    return this.truthy(v)
  }

  execInsertDb(st: any, scope: Scope): Signal {
    const table = this.db.get(st.table)
    if (!table) throw new RtDump(`Table ${st.table} is unknown`, 'DBTABLE_UNKNOWN')
    this.dbReads++
    if (st.fromTable) {
      const src = this.evalExpr(st.src, scope)
      if (src.kind === 'table') {
        for (const r of src.rows) {
          if (r.kind === 'struct') table.rows.push(this.db.structToRow(st.table, r))
        }
        this.setSys('DBCNT', src.rows.length)
        this.setSys('SUBRC', 0)
        return SIG_NONE
      }
    }
    const src = this.evalExpr(st.src, scope)
    if (src.kind === 'struct') {
      table.rows.push(this.db.structToRow(st.table, src))
      this.setSys('DBCNT', 1)
      this.setSys('SUBRC', 0)
    } else {
      this.setSys('SUBRC', 4)
    }
    return SIG_NONE
  }

  execUpdateDb(st: any, scope: Scope): Signal {
    const table = this.db.get(st.table)
    if (!table) throw new RtDump(`Table ${st.table} is unknown`, 'DBTABLE_UNKNOWN')
    this.dbReads++
    let count = 0
    if (st.src) {
      const src = this.evalExpr(st.src, scope)
      if (src && src.kind === 'table' && st.fromTable) {
        for (const r of src.rows) {
          if (r.kind === 'struct') {
            const newRow = this.db.structToRow(st.table, r)
            const key = this.db.keyOf(st.table, newRow)
            const idx = table.rows.findIndex((x) => this.db.keyOf(st.table, x) === key)
            if (idx >= 0) { table.rows[idx] = newRow; count++ }
          }
        }
      } else if (src && src.kind === 'struct') {
        const newRow = this.db.structToRow(st.table, src)
        const key = this.db.keyOf(st.table, newRow)
        const idx = table.rows.findIndex((x) => this.db.keyOf(st.table, x) === key)
        if (idx >= 0) { table.rows[idx] = newRow; count = 1 }
      }
    } else if (st.sets && st.sets.length) {
      const matching = table.rows.filter((r) => (st.where ? this.evalSqlWhereRow(st.where, r, scope, st.table) : true))
      for (const r of matching) {
        for (const s of st.sets) {
          const v = this.evalExpr(s.value, scope)
          r[s.field.toUpperCase()] = toStringValue(v)
        }
        count++
      }
    }
    this.setSys('DBCNT', count)
    this.setSys('SUBRC', count > 0 ? 0 : 4)
    return SIG_NONE
  }

  evalSqlWhereRow(cond: Expr, row: Record<string, string>, scope: Scope, table: string): boolean {
    return this.evalSqlCond(cond, this.rowToPrefixed(row, table), scope, table)
  }

  rowToPrefixed(row: Record<string, string>, table: string): Record<string, any> {
    const o: Record<string, any> = {}
    const t = this.db.get(table)
    if (t) for (const f of t.fields) o[`${table.toUpperCase()}-${f.name.toUpperCase()}`] = row[f.name.toUpperCase()] ?? ''
    return o
  }

  execModifyDb(st: any, scope: Scope): Signal {
    const table = this.db.get(st.table)
    if (!table) throw new RtDump(`Table ${st.table} is unknown`, 'DBTABLE_UNKNOWN')
    this.dbReads++
    const src = this.evalExpr(st.src, scope)
    if (st.fromTable && src.kind === 'table') {
      let count = 0
      for (const r of src.rows) {
        if (r.kind === 'struct') {
          const newRow = this.db.structToRow(st.table, r)
          const key = this.db.keyOf(st.table, newRow)
          const idx = table.rows.findIndex((x) => this.db.keyOf(st.table, x) === key)
          if (idx >= 0) table.rows[idx] = newRow
          else table.rows.push(newRow)
          count++
        }
      }
      this.setSys('DBCNT', count)
      this.setSys('SUBRC', 0)
      return SIG_NONE
    }
    if (src.kind === 'struct') {
      const newRow = this.db.structToRow(st.table, src)
      const key = this.db.keyOf(st.table, newRow)
      const idx = table.rows.findIndex((x) => this.db.keyOf(st.table, x) === key)
      if (idx >= 0) table.rows[idx] = newRow
      else table.rows.push(newRow)
      this.setSys('DBCNT', 1)
      this.setSys('SUBRC', 0)
    }
    return SIG_NONE
  }

  execDeleteDb(st: any, scope: Scope): Signal {
    const table = this.db.get(st.table)
    if (!table) throw new RtDump(`Table ${st.table} is unknown`, 'DBTABLE_UNKNOWN')
    this.dbReads++
    if (st.src) {
      const src = this.evalExpr(st.src, scope)
      if (src.kind === 'struct') {
        const key = this.db.keyOf(st.table, this.db.structToRow(st.table, src))
        const idx = table.rows.findIndex((x) => this.db.keyOf(st.table, x) === key)
        if (idx >= 0) {
          table.rows.splice(idx, 1)
          this.setSys('DBCNT', 1)
          this.setSys('SUBRC', 0)
          return SIG_NONE
        }
      }
      this.setSys('SUBRC', 4)
      return SIG_NONE
    }
    const before = table.rows.length
    if (st.where) {
      table.rows = table.rows.filter((r) => !this.evalSqlWhereRow(st.where, r, scope, st.table))
    } else {
      // delete all? ABAP requires WHERE; keep all
    }
    const count = before - table.rows.length
    this.setSys('DBCNT', count)
    this.setSys('SUBRC', count > 0 ? 0 : 4)
    return SIG_NONE
  }

  // ── assignments & lvalues ───────────────────────────────────────────
  assignTo(target: Expr, value: RtValue, scope: Scope) {
    const box = this.resolveBox(target, scope)
    const cur = box.get()
    if (cur.kind === 'elem') {
      if (value.kind === 'elem') assignElem(cur, value)
      else if (value.kind === 'oref' || value.kind === 'dref') box.set(value)
      else {
        // struct/table into elem — replace with adapted? keep initial
        box.set(value)
      }
    } else if (cur.kind === 'struct') {
      if (value.kind === 'struct') {
        // copy matching components
        for (const [k, v] of value.fields) {
          if (cur.fields.has(k)) {
            const t = cur.fields.get(k)!
            if (t.kind === 'elem' && v.kind === 'elem') assignElem(t, v)
            else cur.fields.set(k, deepCopyValue(v))
          }
        }
      } else box.set(value)
    } else if (cur.kind === 'table') {
      if (value.kind === 'table') {
        cur.rows = value.rows.map((r) => deepCopyValue(r))
        cur.lineType = value.lineType
      } else box.set(value)
    } else if (cur.kind === 'oref' || cur.kind === 'dref') {
      box.set(value)
    } else {
      box.set(value)
    }
  }

  resolveBox(e: Expr, scope: Scope): Box {
    switch (e.t) {
      case 'var': {
        const name = e.name
        const entry = scope.lookup(name)
        if (entry) {
          if (entry.isFs) {
            if (!entry.fsBox) throw new RtDump(`Field symbol <${name}> is not assigned`, 'FS_NOT_ASSIGNED')
            return entry.fsBox
          }
          return { get: () => entry.value, set: (v) => { entry.value = v } }
        }
        // class statics access? zcl=>attr handled by member; plain var unknown
        throw new RtDump(`Field ${name} is unknown`, 'FIELD_UNKNOWN')
      }
      case 'inlinedecl': {
        // DATA(x) — create in current scope
        const cur = scope
        if (!cur.vars.has(e.name)) {
          cur.declare(e.name, initialElem('STRING'))
        }
        const entry = cur.vars.get(e.name)!
        return { get: () => entry.value, set: (v) => { entry.value = v } }
      }
      case 'fsdecl': {
        if (!scope.vars.has(e.name)) {
          scope.declare(e.name, initialElem('C', 1))
          scope.vars.get(e.name)!.isFs = true
          scope.vars.get(e.name)!.fsBox = { get: () => initialElem('C', 1), set: () => {} }
        }
        const entry = scope.vars.get(e.name)!
        return {
          get: () => (entry.fsBox ? entry.fsBox.get() : initialElem('C', 1)),
          set: (v) => { if (entry.fsBox) entry.fsBox.set(v) },
        }
      }
      case 'member': {
        // struct component, object attr, static attr, system field
        if (e.obj.t === 'var') {
          const entry = scope.lookup(e.obj.name)
          if (!entry) {
            // class static attr: zcl_x=>attr / interface const
            if (e.sep === '=>') {
              return this.staticAttrBox(e.obj.name, e.name)
            }
            throw new RtDump(`Field ${e.obj.name} is unknown`, 'FIELD_UNKNOWN')
          }
          if (entry.isFs) {
            if (!entry.fsBox) throw new RtDump(`Field symbol <${e.obj.name}> is not assigned`, 'FS_NOT_ASSIGNED')
            const target = entry.fsBox.get()
            return this.memberBoxOf(target, e.name, e.sep, e.obj.name)
          }
          if (entry.value.kind === 'oref' && !entry.value.native) {
            return this.attrBox(entry.value, e.name, entry.value.clsName)
          }
          if (entry.value.kind === 'oref' && entry.value.native) {
            return this.nativeAttrBox(entry.value, e.name)
          }
          return this.memberBoxOf(entry.value, e.name, e.sep, e.obj.name)
        }
        // evaluate obj
        if (e.obj.t === 'member' && e.obj.sep === '=>') {
          // nested static: cls=>inner=>x — rare; handle one level via eval
        }
        const objVal = this.evalExpr(e.obj, scope)
        if (objVal.kind === 'oref') {
          if (objVal.native) return this.nativeAttrBox(objVal, e.name)
          return this.attrBox(objVal, e.name, objVal.clsName)
        }
        if (objVal.kind === 'struct') return this.memberBoxOf(objVal, e.name, e.sep, exprToName(e.obj))
        throw new RtDump(`Cannot access component ${e.name}`, 'FIELD_UNKNOWN')
      }
      case 'index': {
        // table expression lvalue: it[ ... ]
        const table = this.getTable(e.arr, scope)
        const idx = this.findRowIndexByExpr(table, e.args, scope)
        if (idx < 0) throw new RtException('CX_SY_ITAB_LINE_NOT_FOUND', 'Table line not found (itab expression)')
        return { get: () => table.rows[idx], set: (v) => { table.rows[idx] = v } }
      }
      case 'deref': {
        const ref = this.evalExpr(e.ref, scope)
        if (ref.kind !== 'dref' || !ref.target) throw new RtDump('Dereference of NULL reference', 'DEREF_NULL')
        return {
          get: () => ref.target!,
          set: (v) => { ref.target = v },
        }
      }
      default:
        throw new RtDump('Expression cannot be used as assignment target', 'NOT_ASSIGNABLE')
    }
  }

  memberBoxOf(target: RtValue, name: string, sep: string, ownerName: string): Box {
    if (target.kind === 'struct') {
      const key = findFieldKey(target, name)
      if (key) return { get: () => target.fields.get(key)!, set: (v) => target.fields.set(key, v) }
      throw new RtDump(`Component ${name} of ${ownerName} does not exist`, 'COMPONENT_MISSING')
    }
    if (target.kind === 'table') {
      // header line?
      if (target.headerLine) return { get: () => target.headerLine!, set: (v) => { target.headerLine = v } }
      throw new RtDump(`${ownerName} is a table without header line`, 'ITAB_NO_HEADER')
    }
    throw new RtDump(`Cannot access ${name} on ${ownerName}`, 'FIELD_UNKNOWN')
  }

  attrBox(obj: RtOref, name: string, clsName: string): Box {
    // instance attr or static attr (search hierarchy)
    if (obj.attrs.has(name)) {
      return { get: () => obj.attrs.get(name)!, set: (v) => obj.attrs.set(name, v) }
    }
    // static attr?
    for (const cn of this.classChain(clsName)) {
      const def = this.classes.get(cn)
      if (!def) continue
      for (const sec of def.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var' && m.decl.name === name && m.decl.kind === 'CLASS-DATA') {
            this.ensureClassStatic(cn, m.decl)
            const store = this.staticsOf(cn)
            return { get: () => store.get(name)!, set: (v) => store.set(name, v) }
          }
        }
      }
    }
    // ME / SUPER special
    if (name === 'ME' || name === 'SUPER') {
      return { get: () => obj, set: () => {} }
    }
    throw new RtDump(`Attribute ${name} does not exist on class ${clsName}`, 'ATTR_UNKNOWN')
  }

  staticAttrBox(clsName: string, name: string): Box {
    if (isNativeClassName(clsName)) {
      return {
        get: () => getNativeAttr(this, clsName, name),
        set: () => { /* native constants read-only */ },
      }
    }
    // walk hierarchy for CLASS-DATA / CONSTANTS / DATA(static access)
    for (const cn of this.classChain(clsName)) {
      const def = this.classes.get(cn)
      if (!def) continue
      for (const sec of def.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var' && m.decl.name === name) {
            this.ensureClassStatic(cn, m.decl)
            const store = this.staticsOf(cn)
            return { get: () => store.get(name)!, set: (v) => store.set(name, v) }
          }
        }
      }
    }
    // interface constant
    const idef = this.interfaces.get(clsName)
    if (idef) {
      for (const sec of idef.sections) {
        for (const m of sec.members) {
          if (m.kind === 'var' && m.decl.name === name) {
            const v = m.decl.value ? this.evalExpr(m.decl.value, this.globalScope) : initialElem('C', 1)
            const holder = { v }
            return { get: () => holder.v, set: () => {} }
          }
        }
      }
    }
    throw new RtDump(`Static attribute ${clsName}=>${name} is unknown`, 'ATTR_UNKNOWN')
  }

  nativeAttrBox(oref: RtOref, name: string): Box {
    const holder = { v: getNativeAttr(this, oref.clsName, name, oref) }
    return {
      get: () => holder.v,
      set: (v) => { setNativeAttr(this, oref, name, v) },
    }
  }

  findRowIndexByExpr(table: RtTable, args: Expr[], scope: Scope): number {
    if (args.length === 1 && args[0].t === 'num') return Math.trunc((args[0] as any).v) - 1
    if (args.length === 1 && args[0].t === 'binop' && (args[0] as any).op === '=') {
      const { l, r } = args[0] as any
      const fieldName = exprToName(l)
      const val = this.evalExpr(r, scope)
      for (let i = 0; i < table.rows.length; i++) {
        const comp = this.readComponent(table.rows[i], fieldName)
        if (comp && valuesEqual(comp, val)) return i
      }
      return -1
    }
    // key = value, key2 = value2 (AND)
    if (args.length > 0 && args[0].t === 'binop' && (args[0] as any).op === 'AND') {
      const collect = (e: Expr, acc: { l: Expr; r: Expr }[]) => {
        if (e.t === 'binop' && (e as any).op === 'AND') {
          collect((e as any).l, acc)
          collect((e as any).r, acc)
        } else if (e.t === 'binop' && (e as any).op === '=') {
          acc.push({ l: (e as any).l, r: (e as any).r })
        }
      }
      const acc: { l: Expr; r: Expr }[] = []
      args.forEach((a) => collect(a, acc))
      for (let i = 0; i < table.rows.length; i++) {
        let ok = true
        for (const { l, r } of acc) {
          const fieldName = exprToName(l)
          const val = this.evalExpr(r, scope)
          const comp = this.readComponent(table.rows[i], fieldName)
          if (!comp || !valuesEqual(comp, val)) { ok = false; break }
        }
        if (ok) return i
      }
      return -1
    }
    return -1
  }

  // ── expression evaluation ───────────────────────────────────────────
  evalExpr(e: Expr, scope: Scope, rowCtx?: RtValue, sqlCtx?: { row: Record<string, any>; mainTable: string; joinTable?: string }): RtValue {
    this.tick()
    switch (e.t) {
      case 'num': {
        if (e.raw.includes('.') || e.raw.toLowerCase().includes('e')) return new RtElem('F', e.v)
        return new RtElem('I', Math.trunc(e.v))
      }
      case 'str': return new RtElem('STRING', e.v)
      case 'bool': return new RtElem('C', e.v, 1)
      case 'null': return new RtElem('C', '', 1)
      case 'tmpl': {
        let s = ''
        for (const p of e.parts) {
          if ('lit' in p) s += p.lit
          else {
            let v = this.evalExpr(p.expr, scope)
            let text: string
            if (p.options?.DECIMALS !== undefined) {
              const n = toNumber(v)
              text = n.toFixed(Number(p.options.DECIMALS))
            } else if (p.options?.WIDTH !== undefined) {
              text = toStringValue(v)
              const w = Number(p.options.WIDTH)
              const align = String(p.options.ALIGN ?? 'LEFT').toUpperCase()
              if (align === 'RIGHT') text = text.padStart(w)
              else if (align === 'CENTER') {
                const l = Math.floor((w - text.length) / 2)
                text = ' '.repeat(Math.max(0, l)) + text.padEnd(w - Math.max(0, l))
              } else text = text.padEnd(w)
            } else {
              text = toStringValue(v, true)
            }
            s += text
          }
        }
        return new RtElem('STRING', s)
      }
      case 'var': {
        const name = e.name
        // LOOP WHERE / row context: resolve unqualified names to row components first
        if (rowCtx && rowCtx.kind === 'struct') {
          for (const k of rowCtx.fields.keys()) {
            if (k.toUpperCase() === name) return rowCtx.fields.get(k)!
          }
        }
        // SQL context: resolve db fields
        if (sqlCtx) {
          const fv = this.resolveDbField(name, sqlCtx.row, sqlCtx.mainTable, sqlCtx.joinTable)
          if (fv !== undefined) {
            if (typeof fv === 'number') return new RtElem('P', fv, undefined, 2)
            const str = String(fv)
            // try numeric
            if (/^-?\d+$/.test(str.trim())) return new RtElem('I', parseInt(str))
            if (/^-?\d*\.?\d+$/.test(str.trim())) return new RtElem('P', parseFloat(str), undefined, 2)
            return new RtElem('STRING', str)
          }
          // host variable
          const entry = scope.lookup(name)
          if (entry) {
            if (entry.isFs && entry.fsBox) return entry.fsBox.get()
            return entry.value
          }
          // class name used in sql? no
          throw new RtDump(`Field ${name} is unknown`, 'FIELD_UNKNOWN')
        }
        if (name === 'ABAP_TRUE') return new RtElem('C', 'X', 1)
        if (name === 'ABAP_FALSE' || name === 'SPACE' || name === 'ABAP_UNDEFINED') return new RtElem('C', ' ', 1)
        const entry = scope.lookup(name)
        if (entry) {
          if (entry.isFs) {
            if (!entry.fsBox) throw new RtDump(`Field symbol <${name}> is not assigned`, 'FS_NOT_ASSIGNED')
            return entry.fsBox.get()
          }
          return entry.value
        }
        // class or interface name (for => access) — return marker
        if (this.classes.has(name) || this.interfaces.has(name) || isNativeClassName(name)) {
          return new RtElem('STRING', `#CLASS#${name}`)
        }
        // ME / SUPER in method context
        if (name === 'ME' || name === 'SUPER') {
          if (this.currentSelf) return this.currentSelf
          throw new RtDump('ME/SUPER only valid in instance methods', 'FIELD_UNKNOWN')
        }
        throw new RtDump(`Field ${name} is unknown`, 'FIELD_UNKNOWN')
      }
      case 'member': {
        const objName = e.obj.t === 'var' ? e.obj.name : null
        // system field sy-xxx
        if (objName === 'SY') {
          const syv = this.sysVal(e.name)
          return syv
        }
        // static access class=>attr
        if (e.obj.t === 'var' && !scope.lookup(e.obj.name) && (this.classes.has(e.obj.name) || this.interfaces.has(e.obj.name) || isNativeClassName(e.obj.name)) && e.sep === '=>') {
          if (isNativeClassName(e.obj.name)) return getNativeAttr(this, e.obj.name, e.name)
          return this.staticAttrBox(e.obj.name, e.name).get()
        }
        // evaluate object
        let objVal: RtValue
        if (e.obj.t === 'var' && e.obj.name === 'ME' && this.currentSelf) objVal = this.currentSelf
        else if (e.obj.t === 'var' && e.obj.name === 'SUPER' && this.currentSelf) objVal = this.currentSelf
        else objVal = this.evalExpr(e.obj, scope, rowCtx, sqlCtx)
        if (e.sep === '~') {
          // interface method/attr: if~name
          const name = e.name
          if (objVal.kind === 'oref') {
            if (objVal.native) return getNativeAttr(this, objVal.clsName, name, objVal)
            // try attr box with if~name
            if (objVal.attrs.has(name)) return objVal.attrs.get(name)!
            return this.attrBox(objVal, name, objVal.clsName).get()
          }
        }
        if (objVal.kind === 'struct') {
          const key = findFieldKey(objVal, e.name)
          if (key) return objVal.fields.get(key)!
          throw new RtDump(`Component ${e.name} does not exist`, 'COMPONENT_MISSING')
        }
        if (objVal.kind === 'oref') {
          if (objVal.native) return getNativeAttr(this, objVal.clsName, e.name, objVal)
          return this.attrBox(objVal, e.name, objVal.clsName).get()
        }
        if (objVal.kind === 'elem' && String(objVal.value).startsWith('#CLASS#')) {
          // static on returned class — rare
          const cls = String(objVal.value).slice(7)
          if (isNativeClassName(cls)) return getNativeAttr(this, cls, e.name)
          return this.staticAttrBox(cls, e.name).get()
        }
        if (objVal.kind === 'table' && objVal.headerLine) {
          return this.memberBoxOf(objVal.headerLine, e.name, '-', 'header').get()
        }
        if (rowCtx && objVal.kind === 'elem') {
          throw new RtDump(`Object not bound for access ->${e.name}`, 'OBJ_NOT_BOUND')
        }
        throw new RtDump(`Cannot access ${e.name}`, 'FIELD_UNKNOWN')
      }
      case 'index': {
        const table = this.getTable(e.arr, scope)
        const idx = this.findRowIndexByExpr(table, e.args, scope)
        if (idx < 0) throw new RtException('CX_SY_ITAB_LINE_NOT_FOUND', 'Table line not found in table expression')
        return table.rows[idx]
      }
      case 'deref': {
        const ref = this.evalExpr(e.ref, scope)
        if (ref.kind !== 'dref' || !ref.target) throw new RtDump('Dereference of NULL reference', 'DEREF_NULL')
        return ref.target
      }
      case 'binop': return this.evalBinop(e, scope, rowCtx, sqlCtx)
      case 'unop': {
        if (e.op === '-') {
          const v = this.evalExpr(e.e, scope, rowCtx, sqlCtx)
          return new RtElem('I', -toNumber(v))
        }
        if (e.op === 'NOT') {
          const v = this.evalExpr(e.e, scope, rowCtx, sqlCtx)
          return new RtElem('C', this.truthy(v) ? ' ' : 'X', 1)
        }
        return initialElem('C', 1)
      }
      case 'is': {
        if (e.what === 'LINE_EXISTS') {
          // e.e is index expr
          try {
            const table = this.getTable((e.e as any).arr, scope)
            const idx = this.findRowIndexByExpr(table, (e.e as any).args, scope)
            return new RtElem('C', idx >= 0 ? 'X' : ' ', 1)
          } catch {
            return new RtElem('C', ' ', 1)
          }
        }
        const v = this.evalExpr(e.e, scope, rowCtx, sqlCtx)
        switch (e.what) {
          case 'INITIAL': return new RtElem('C', isInitial(v) ? 'X' : ' ', 1)
          case 'NOT_INITIAL': return new RtElem('C', isInitial(v) ? ' ' : 'X', 1)
          case 'BOUND': return new RtElem('C', v.kind === 'oref' && v.clsName !== '' ? 'X' : ' ', 1)
          case 'NOT_BOUND': return new RtElem('C', v.kind === 'oref' && v.clsName !== '' ? ' ' : 'X', 1)
          case 'ASSIGNED': {
            if (e.e.t === 'var') {
              const entry = scope.lookup(e.e.name)
              return new RtElem('C', entry?.isFs && entry.fsBox ? 'X' : ' ', 1)
            }
            return new RtElem('C', ' ', 1)
          }
          case 'NOT_ASSIGNED': {
            if (e.e.t === 'var') {
              const entry = scope.lookup(e.e.name)
              return new RtElem('C', entry?.isFs && entry.fsBox ? ' ' : 'X', 1)
            }
            return new RtElem('C', 'X', 1)
          }
          case 'SUPPLIED': {
            // method param supplied? check mScope
            if (e.e.t === 'var') {
              const entry = scope.lookup(e.e.name)
              return new RtElem('C', entry ? 'X' : ' ', 1)
            }
            return new RtElem('C', ' ', 1)
          }
          default: return new RtElem('C', ' ', 1)
        }
      }
      case 'in': {
        // e IN range-table
        const v = this.evalExpr(e.e, scope, rowCtx, sqlCtx)
        const range = this.evalExpr(e.range, scope)
        let result = false
        if (range.kind === 'table') {
          for (const r of range.rows) {
            if (r.kind !== 'struct') continue
            const sign = toStringValue(r.fields.get('SIGN') ?? new RtElem('C', 'I', 1)).trim()
            const opt = toStringValue(r.fields.get('OPTION') ?? new RtElem('C', 'EQ', 2)).trim().toUpperCase()
            const low = r.fields.get('LOW')
            const high = r.fields.get('HIGH')
            let match = false
            const lv = low ?? initialElem('C', 1)
            const hv = high ?? initialElem('C', 1)
            switch (opt) {
              case 'EQ': match = valuesEqual(v, lv); break
              case 'NE': match = !valuesEqual(v, lv); break
              case 'GT': match = compareValues(v, lv) > 0; break
              case 'LT': match = compareValues(v, lv) < 0; break
              case 'GE': match = compareValues(v, lv) >= 0; break
              case 'LE': match = compareValues(v, lv) <= 0; break
              case 'BT': match = compareValues(v, lv) >= 0 && compareValues(v, hv) <= 0; break
              case 'NB': match = !(compareValues(v, lv) >= 0 && compareValues(v, hv) <= 0); break
              case 'CP': match = abapPatternMatch(toStringValue(v), toStringValue(lv)); break
              case 'NP': match = !abapPatternMatch(toStringValue(v), toStringValue(lv)); break
              default: match = valuesEqual(v, lv)
            }
            if (sign === 'I' && match) { result = true; break }
            if (sign === 'E' && match) { result = false; break }
          }
        }
        return new RtElem('C', result ? 'X' : ' ', 1)
      }
      case 'between': {
        const v = this.evalExpr(e.e, scope, rowCtx, sqlCtx)
        const lo = this.evalExpr(e.lo, scope, rowCtx, sqlCtx)
        const hi = this.evalExpr(e.hi, scope, rowCtx, sqlCtx)
        return new RtElem('C', compareValues(v, lo) >= 0 && compareValues(v, hi) <= 0 ? 'X' : ' ', 1)
      }
      case 'strpred': {
        const l = this.evalExpr(e.l, scope, rowCtx, sqlCtx)
        const r = this.evalExpr(e.r, scope, rowCtx, sqlCtx)
        const ls = toStringValue(l)
        const rs = toStringValue(r)
        let res = false
        let fdpos = 0
        switch (e.op) {
          case 'CO': {
            // contains only chars from rs
            res = true
            for (const ch of ls.trim()) {
              if (!rs.includes(ch)) { res = false; fdpos = ls.indexOf(ch); break }
            }
            if (res) fdpos = ls.trim().length
            break
          }
          case 'CA': {
            res = false
            for (const ch of rs) {
              const idx = ls.indexOf(ch)
              if (idx >= 0) { res = true; fdpos = idx; break }
            }
            break
          }
          case 'CS': {
            const idx = ls.indexOf(rs)
            res = idx >= 0
            fdpos = Math.max(0, idx)
            break
          }
          case 'NS': res = !ls.includes(rs); break
          case 'NA': res = !rs.split('').some((ch: string) => ls.includes(ch)); break
          case 'CP': res = abapPatternMatch(ls, rs); break
          case 'NP': res = !abapPatternMatch(ls, rs); break
          case 'LIKE': res = sqlLikeMatch(ls, rs); break
        }
        this.setSys('FDPOS', fdpos)
        return new RtElem('C', res ? 'X' : ' ', 1)
      }
      case 'call': {
        if (e.fn === 'METHOD') {
          // method call
          let recvVal: RtValue | undefined
          let staticCls = ''
          const recv = e.recv!
          if (recv.t === 'var') {
            const entry = scope.lookup(recv.name)
            if (entry && !(entry.value.kind === 'elem' && String((entry.value as RtElem).value).startsWith('#CLASS#'))) {
              if (entry.isFs && entry.fsBox) recvVal = entry.fsBox.get()
              else recvVal = entry.value
            } else if (!entry) {
              if (this.classes.has(recv.name) || this.interfaces.has(recv.name) || isNativeClassName(recv.name)) staticCls = recv.name
              else if (recv.name === 'ME' || recv.name === 'SUPER') {
                if (!this.currentSelf) throw new RtException('CX_SY_REF_IS_INITIAL', 'ME used outside instance method')
                recvVal = this.currentSelf
                if (recv.name === 'SUPER') {
                  // dispatch to parent — handled via invokeMethodOrStatic parent
                }
              } else {
                throw new RtDump(`Variable or class ${recv.name} is unknown`, 'FIELD_UNKNOWN')
              }
            } else {
              // entry exists but is class marker — unlikely
              staticCls = recv.name
            }
          } else {
            recvVal = this.evalExpr(recv, scope)
            if (recvVal.kind === 'elem' && String(recvVal.value).startsWith('#CLASS#')) {
              staticCls = String(recvVal.value).slice(7)
              recvVal = undefined
            }
          }
          const ret = this.invokeMethodOrStatic(recvVal, staticCls, e.method ?? this.methodNameOf(e), e.args, scope)
          return ret
        }
        // builtin function
        return this.callBuiltin(e.fn, e.args, scope)
      }
      case 'new': {
        let clsName = e.className
        if (clsName === '#INFER#') {
          throw new RtDump('NEW #(...) type inference not supported here', 'TYPE_INFER')
        }
        return this.instantiate(clsName, e.args, scope)
      }
      case 'value': {
        return this.evalValueExpr(e, scope)
      }
      case 'conv': {
        return this.evalExpr(e.expr, scope)
      }
      case 'cond': {
        for (const w of e.whens) {
          for (const cond of w.when) {
            if (this.truthy(this.evalExpr(cond, scope))) return this.evalExpr(w.then, scope)
          }
        }
        if (e.els) return this.evalExpr(e.els, scope)
        return initialElem('C', 1)
      }
      case 'switch': {
        if (e.subject !== undefined) {
          const subj = this.evalExpr(e.subject, scope)
          for (const c of e.cases) {
            for (const wv of c.when) {
              if (valuesEqual(subj, this.evalExpr(wv, scope))) return this.evalExpr(c.then, scope)
            }
          }
          if (e.default) return this.evalExpr(e.default, scope)
        }
        return initialElem('C', 1)
      }
      case 'reduce': {
        return this.evalReduce(e, scope)
      }
      case 'ref': {
        const box = this.resolveBox(e.expr, scope)
        const d = new RtDref()
        d.target = box.get()
        return d
      }
      default:
        throw new RtDump(`Unsupported expression type ${(e as any).t}`, 'EXPR_UNSUPPORTED')
    }
  }

  methodNameOf(e: any): string {
    return e.method ?? ''
  }

  evalBinop(e: any, scope: Scope, rowCtx?: RtValue, sqlCtx?: { row: Record<string, any>; mainTable: string; joinTable?: string }): RtValue {
    switch (e.op) {
      case 'AND': {
        const l = this.truthy(this.evalExpr(e.l, scope, rowCtx, sqlCtx))
        if (!l) return new RtElem('C', ' ', 1)
        const r = this.truthy(this.evalExpr(e.r, scope, rowCtx, sqlCtx))
        return new RtElem('C', r ? 'X' : ' ', 1)
      }
      case 'OR': {
        const l = this.truthy(this.evalExpr(e.l, scope, rowCtx, sqlCtx))
        if (l) return new RtElem('C', 'X', 1)
        const r = this.truthy(this.evalExpr(e.r, scope, rowCtx, sqlCtx))
        return new RtElem('C', r ? 'X' : ' ', 1)
      }
      case '&&': {
        const l = toStringValue(this.evalExpr(e.l, scope, rowCtx, sqlCtx))
        const r = toStringValue(this.evalExpr(e.r, scope, rowCtx, sqlCtx))
        return new RtElem('STRING', l + r)
      }
      case '=': case '<>': case '<': case '>': case '<=': case '>=': case 'EQ': case 'NE': case 'LT': case 'GT': case 'LE': case 'GE': {
        const l = this.evalExpr(e.l, scope, rowCtx, sqlCtx)
        const r = this.evalExpr(e.r, scope, rowCtx, sqlCtx)
        const cmp = compareValues(l, r)
        let res = false
        switch (e.op) {
          case '=': case 'EQ': res = cmp === 0; break
          case '<>': case 'NE': res = cmp !== 0; break
          case '<': case 'LT': res = cmp < 0; break
          case '>': case 'GT': res = cmp > 0; break
          case '<=': case 'LE': res = cmp <= 0; break
          case '>=': case 'GE': res = cmp >= 0; break
        }
        return new RtElem('C', res ? 'X' : ' ', 1)
      }
      case '+': case '-': case '*': case '/': case '**': case 'DIV': case 'MOD': {
        const l = this.evalExpr(e.l, scope)
        const r = this.evalExpr(e.r, scope)
        const isFloat = (l.kind === 'elem' && l.type === 'F') || (r.kind === 'elem' && r.type === 'F') ||
          (l.kind === 'elem' && l.type === 'P' && (l.decimals ?? 0) > 0) || (r.kind === 'elem' && r.type === 'P' && (r.decimals ?? 0) > 0)
        const na = toNumber(l)
        const nb = toNumber(r)
        let res: number
        switch (e.op) {
          case '+': res = na + nb; break
          case '-': res = na - nb; break
          case '*': res = na * nb; break
          case '/': {
            if (nb === 0) throw new RtException('CX_SY_ZERODIVIDE', 'Division by zero')
            res = na / nb
            return new RtElem('F', res)
          }
          case '**': res = Math.pow(na, nb); break
          case 'DIV': {
            if (nb === 0) throw new RtException('CX_SY_ZERODIVIDE', 'Division by zero')
            res = Math.trunc(na / nb)
            break
          }
          case 'MOD': {
            if (nb === 0) throw new RtException('CX_SY_ZERODIVIDE', 'Division by zero')
            res = na - nb * Math.trunc(na / nb)
            break
          }
          default: res = 0
        }
        if (isFloat) return new RtElem('F', res)
        return new RtElem('I', Math.trunc(res))
      }
      default:
        throw new RtDump(`Unknown operator ${e.op}`, 'OP_UNKNOWN')
    }
  }

  truthy(v: RtValue): boolean {
    if (v.kind === 'elem') {
      if (typeof v.value === 'number') return v.value !== 0
      const s = String(v.value ?? '').trim()
      return s === 'X' || s === 'x' || (s !== '' && s !== ' ' && !isNaN(parseFloat(s)) && parseFloat(s) !== 0 && (v.type === 'I' || v.type === 'F' || v.type === 'P' || v.type === 'N'))
    }
    return false
  }

  evalValueExpr(e: any, scope: Scope): RtValue {
    // VALUE #( ... ) — build struct or table
    const fieldLines = e.lines.filter((l: any) => l.kind === 'field')
    const hasTableMarkers = e.lines.some((l: any) => l.kind === 'row' || l.kind === 'for')
    // struct case: only field lines
    if (!hasTableMarkers && fieldLines.length > 0) {
      const s = new RtStruct()
      for (const l of fieldLines) {
        s.fields.set(l.name, deepCopyValue(this.evalExpr(l.expr, scope)))
      }
      return s
    }
    // table case
    const t = new RtTable({ kind: 'struct', fields: [] })
    const buildStructFromLines = (lines: any[], baseRow?: RtValue): RtStruct => {
      const s = (baseRow ? deepCopyValue(baseRow) : new RtStruct()) as RtStruct
      for (const l of lines) {
        if (l.kind === 'field') s.fields.set(l.name, deepCopyValue(this.evalExpr(l.expr, scope)))
        else if (l.kind === 'base' && baseRow) {
          const b = this.evalExpr(l.expr, scope)
          if (b.kind === 'struct') for (const [k, v] of b.fields) s.fields.set(k, deepCopyValue(v))
        }
      }
      return s
    }
    for (const l of e.lines) {
      if (l.kind === 'base') {
        const b = this.evalExpr(l.expr, scope)
        if (b.kind === 'table') {
          t.lineType = b.lineType
          t.rows = b.rows.map((r) => deepCopyValue(r))
        } else if (b.kind === 'struct') {
          t.lineType = this.defOfValue(b)
          t.rows.push(deepCopyValue(b))
        } else {
          t.rows.push(deepCopyValue(b))
        }
      } else if (l.kind === 'row') {
        const rowFields = l.lines.filter((x: any) => x.kind === 'field')
        const rowBases = l.lines.filter((x: any) => x.kind === 'base')
        if (rowFields.length === 0 && rowBases.length === 1) {
          // Elementary table rows: VALUE i( ( 1 ) ( 2 ) ).
          const value = this.evalExpr(rowBases[0].expr, scope)
          if (t.rows.length === 0) t.lineType = this.defOfValue(value)
          t.rows.push(deepCopyValue(value))
        } else {
          const row = buildStructFromLines(l.lines)
          if (t.rows.length === 0) t.lineType = this.defOfValue(row)
          t.rows.push(row)
        }
      } else if (l.kind === 'for') {
        const table = this.evalExpr(l.table, scope)
        if (table.kind === 'table') {
          t.lineType = table.lineType
          for (const row of table.rows) {
            if (l.where && !this.truthy(this.evalExpr(l.where, scope, row))) continue
            const loopScope = new Scope('form', scope)
            loopScope.declare(l.iterVar, row)
            if (l.lines.length === 0) {
              t.rows.push(deepCopyValue(row))
            } else {
              const buildInLoop = (lines: any[], baseRow?: RtValue): RtStruct => {
                const s = (baseRow ? deepCopyValue(baseRow) : new RtStruct()) as RtStruct
                for (const il of lines) {
                  if (il.kind === 'field') s.fields.set(il.name, deepCopyValue(this.evalExpr(il.expr, loopScope)))
                }
                return s
              }
              for (const inner of l.lines) {
                if (inner.kind === 'row') {
                  t.rows.push(buildInLoop(inner.lines.filter((x: any) => x.kind === 'field'), row))
                } else if (inner.kind === 'field') {
                  t.rows.push(buildInLoop(l.lines, row))
                  break
                }
              }
            }
          }
        }
      } else if (l.kind === 'field') {
        // field lines at top level of a table VALUE → single struct row
        t.rows.push(buildStructFromLines(e.lines.filter((x: any) => x.kind === 'field')))
      }
    }
    return t
  }

  evalReduce(e: ReduceExpr, scope: Scope): RtValue {
    const acc = new RtElem('I', 0)
    const loopScope = new Scope('form', scope)
    const initVal = this.evalExpr(e.init.expr, scope)
    loopScope.declare(e.init.name, deepCopyValue(initVal))
    if (e.forOf) {
      loopScope.declare(e.forOf.var, initialElem('C', 1))
      const table = this.evalExpr(e.forOf.table, scope)
      if (table.kind !== 'table') return loopScope.vars.get(e.init.name)?.value ?? acc
      for (const row of table.rows) {
        if (e.forOf.where && !this.truthy(this.evalExpr(e.forOf.where, loopScope, row))) continue
        loopScope.vars.set(e.forOf.var, { value: row })
        const nextVal = this.evalExpr(e.next.expr, loopScope)
        loopScope.vars.set(e.init.name, { value: nextVal })
      }
      return loopScope.vars.get(e.init.name)?.value ?? acc
    }
    if (e.forNum) {
      // Numeric FOR: FOR i = init THEN step WHILE condition NEXT ...
      loopScope.declare(e.forNum.var, deepCopyValue(this.evalExpr(e.forNum.init, scope)))
      let guard = 0
      while (this.truthy(this.evalExpr(e.forNum.while, loopScope))) {
        if (++guard > 1_000_000) throw new RtDump('REDUCE endless loop', 'STEP_LIMIT_EXCEEDED')
        const nextVal = this.evalExpr(e.next.expr, loopScope)
        loopScope.vars.set(e.init.name, { value: nextVal })
        const stepVal = this.evalExpr(e.forNum.step, loopScope)
        loopScope.vars.set(e.forNum.var, { value: stepVal })
      }
      return loopScope.vars.get(e.init.name)?.value ?? acc
    }
    if (e.while) {
      // Compatibility for a REDUCE whose WHILE is stored at the top level.
      let guard = 0
      while (this.truthy(this.evalExpr(e.while, loopScope))) {
        if (++guard > 1_000_000) throw new RtDump('REDUCE endless loop', 'STEP_LIMIT_EXCEEDED')
        const nextVal = this.evalExpr(e.next.expr, loopScope)
        loopScope.vars.set(e.init.name, { value: nextVal })
      }
      return loopScope.vars.get(e.init.name)?.value ?? acc
    }
    return loopScope.vars.get(e.init.name)?.value ?? acc
  }

  // ── builtin functions ───────────────────────────────────────────────
  callBuiltin(fn: string, args: CallArg[], scope: Scope): RtValue {
    const arg = (i: number): RtValue => (args[i] ? this.evalExpr(args[i].value, scope) : initialElem('C', 1))
    const named = (name: string): RtValue | undefined => {
      const a = args.find((x) => (x.name ?? '').toUpperCase() === name)
      return a ? this.evalExpr(a.value, scope) : undefined
    }
    switch (fn.toUpperCase()) {
      case 'STRLEN': return new RtElem('I', toStringValue(arg(0)).length)
      case 'NUMOFCHAR': return new RtElem('I', toStringValue(arg(0)).trimEnd().length)
      case 'LINES': {
        const t = arg(0)
        return new RtElem('I', t.kind === 'table' ? t.rows.length : 0)
      }
      case 'LINE_INDEX': {
        const a = args[0]
        if (a && a.value.t === 'index') {
          const table = this.getTable((a.value as any).arr, scope)
          const idx = this.findRowIndexByExpr(table, (a.value as any).args, scope)
          return new RtElem('I', idx + 1)
        }
        return new RtElem('I', 0)
      }
      case 'ABS': return new RtElem('F', Math.abs(toNumber(arg(0))))
      case 'CEIL': return new RtElem('I', Math.ceil(toNumber(arg(0))))
      case 'FLOOR': return new RtElem('I', Math.floor(toNumber(arg(0))))
      case 'TRUNC': return new RtElem('I', Math.trunc(toNumber(arg(0))))
      case 'FRAC': return new RtElem('F', toNumber(arg(0)) - Math.trunc(toNumber(arg(0))))
      case 'ROUND': {
        const dec = named('DEC') ? Math.trunc(toNumber(named('DEC')!)) : 0
        const n = toNumber(arg(0))
        const f = Math.pow(10, dec)
        return new RtElem('P', Math.round(n * f) / f, undefined, dec)
      }
      case 'TO_UPPER': return new RtElem('STRING', toStringValue(arg(0)).toUpperCase())
      case 'TO_LOWER': return new RtElem('STRING', toStringValue(arg(0)).toLowerCase())
      case 'CONDENSE': {
        const v = named('VAL') ?? arg(0)
        let s = toStringValue(v).replace(/\s+/g, ' ').trim()
        if (named('GAPS') && this.truthy(named('GAPS')!)) s = toStringValue(v).replace(/\s+/g, '')
        return new RtElem('STRING', s)
      }
      case 'REVERSE': {
        const s = toStringValue(named('VAL') ?? arg(0))
        return new RtElem('STRING', s.split('').reverse().join(''))
      }
      case 'SHIFT_LEFT': case 'SHIFT_RIGHT': {
        const v = named('VAL') ?? arg(0)
        let s = toStringValue(v)
        const places = named('PLACES') ? Math.trunc(toNumber(named('PLACES')!)) : 1
        if (named('CIRCULAR') && this.truthy(named('CIRCULAR')!)) {
          s = s.slice(places) + s.slice(0, places)
        } else if (fn.toUpperCase() === 'SHIFT_LEFT') s = s.slice(places)
        else s = s.slice(0, s.length - places)
        return new RtElem('STRING', s)
      }
      case 'SUBSTRING': {
        const v = named('VAL') ?? arg(0)
        const s = toStringValue(v)
        const off = named('OFF') ? Math.trunc(toNumber(named('OFF')!)) : 0
        const len = named('LEN') ? Math.trunc(toNumber(named('LEN')!)) : s.length - off
        return new RtElem('STRING', s.substr(off, len))
      }
      case 'REPEAT': {
        const v = named('VAL') ?? arg(0)
        const occ = named('OCC') ? Math.trunc(toNumber(named('OCC')!)) : 1
        return new RtElem('STRING', toStringValue(v).repeat(Math.max(0, Math.min(1000, occ))))
      }
      case 'XSDBOOLEAN': return new RtElem('C', 'X', 1)
      case 'MATCHES': return new RtElem('C', ' ', 1)
      default:
        throw new RtDump(`Function ${fn} is unknown`, 'FUNC_UNKNOWN')
    }
  }

  // ── ALV emission ────────────────────────────────────────────────────
  emitAlv(table: RtTable, title: string, columnOverrides?: Map<string, { label?: string; visible?: boolean }>) {
    // build columns from line type
    const cols: { name: string; label: string; type: string; length: number; visible: boolean }[] = []
    const sample = table.rows.find((r) => r.kind === 'struct') as RtStruct | undefined
    const lineDef = table.lineType
    if (lineDef.kind === 'struct') {
      for (const f of lineDef.fields) {
        const ov = columnOverrides?.get(f.name)
        cols.push({
          name: f.name,
          label: ov?.label ?? this.db.labelFor(f.name),
          type: f.type.kind === 'elem' ? f.type.type : 'C',
          length: f.type.kind === 'elem' ? (f.type.length ?? 10) : 10,
          visible: ov?.visible ?? true,
        })
      }
    } else if (sample) {
      for (const [k, v] of sample.fields) {
        const ov = columnOverrides?.get(k)
        cols.push({
          name: k,
          label: ov?.label ?? this.db.labelFor(k),
          type: v.kind === 'elem' ? v.type : 'C',
          length: v.kind === 'elem' ? (v.length ?? 10) : 10,
          visible: ov?.visible ?? true,
        })
      }
    } else {
      cols.push({ name: 'LINE', label: 'Line', type: 'STRING', length: 40, visible: true })
    }
    const rows: Record<string, string>[] = []
    for (const r of table.rows) {
      if (r.kind === 'struct') {
        const o: Record<string, string> = {}
        for (const c of cols) {
          const v = r.fields.get(c.name)
          o[c.name] = v ? (v.kind === 'elem' ? formatElem(v, true) : '') : ''
        }
        rows.push(o)
      } else {
        rows.push({ LINE: toStringValue(r) })
      }
    }
    this.alvColumns = cols
    this.alvRows = rows
    this.alvTitle = title || this.alvTitle
    this.alvEmitted = true
  }

  emitReuseAlv(st: any, scope: Scope) {
    const outtabArg = st.tables.find((x: any) => x.name === 'T_OUTTAB')
    let table: RtTable | null = null
    if (outtabArg) {
      const v = this.evalExpr(outtabArg.value, scope)
      if (v.kind === 'table') table = v
    }
    if (!table) throw new RtDump('REUSE_ALV_GRID_DISPLAY: T_OUTTAB must be an internal table', 'CALL_FUNCTION_PARM_UNKNOWN')
    let title = ''
    const titleArg = st.exporting.find((x: any) => x.name === 'I_GRID_TITLE')
    if (titleArg) title = toStringValue(this.evalExpr(titleArg.value, scope))
    // field catalog
    const fcArg = st.tables.find((x: any) => x.name === 'IT_FIELDCAT')
    const overrides = new Map<string, { label?: string; visible?: boolean }>()
    if (fcArg) {
      const fcv = this.evalExpr(fcArg.value, scope)
      if (fcv.kind === 'table') {
        for (const r of fcv.rows) {
          if (r.kind !== 'struct') continue
          const fname = toStringValue(r.fields.get('FIELDNAME') ?? new RtElem('C', '')).trim().toUpperCase()
          if (!fname) continue
          const selText = toStringValue(r.fields.get('SELTEXT_L') ?? r.fields.get('SELTEXT_M') ?? r.fields.get('SELTEXT_S') ?? new RtElem('C', '')).trim()
          const noOut = toStringValue(r.fields.get('NO_OUT') ?? new RtElem('C', ' ')).trim()
          const ov: { label?: string; visible?: boolean } = {}
          if (selText) ov.label = selText
          if (noOut === 'X') ov.visible = false
          overrides.set(fname, ov)
        }
      }
    }
    // structure name → ddic columns
    const structArg = st.exporting.find((x: any) => x.name === 'I_STRUCTURE_NAME')
    if (structArg) {
      const sname = toStringValue(this.evalExpr(structArg.value, scope)).toUpperCase()
      const tdef = this.db.get(sname)
      if (tdef) {
        // ensure columns match ddic
        const cols = tdef.fields.map((f) => {
          const et = DbSnapshot.fieldToElemType(f)
          const ov = overrides.get(f.name.toUpperCase())
          return { name: f.name.toUpperCase(), label: ov?.label ?? f.text ?? f.name, type: et.type, length: et.length ?? 10, visible: ov?.visible ?? true }
        })
        const rows: Record<string, string>[] = []
        for (const r of table.rows) {
          if (r.kind === 'struct') {
            const o: Record<string, string> = {}
            for (const c of cols) {
              const v = r.fields.get(c.name)
              o[c.name] = v ? (v.kind === 'elem' ? formatElem(v, true) : '') : ''
            }
            rows.push(o)
          }
        }
        this.alvColumns = cols
        this.alvRows = rows
        this.alvTitle = title || this.alvTitle
        this.alvEmitted = true
        return
      }
    }
    this.emitAlv(table, title, overrides)
  }
}

// ── helpers ────────────────────────────────────────────────────────────
export function exprToName(e: Expr): string {
  if (e.t === 'var') return e.name
  if (e.t === 'member') return exprToName(e.obj) + '-' + e.name
  return '?'
}

function findFieldKey(s: RtStruct, name: string): string | null {
  if (s.fields.has(name)) return name
  for (const k of s.fields.keys()) {
    if (k.toUpperCase() === name.toUpperCase()) return k
  }
  return null
}

export function abapPatternMatch(s: string, pattern: string): boolean {
  // CP: * = any string, + = any single char; case-insensitive
  const rx = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\+/g, '.')
  try {
    return new RegExp(`^${rx}$`, 'i').test(s)
  } catch {
    return false
  }
}

export function sqlLikeMatch(s: string, pattern: string): boolean {
  const rx = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  try {
    return new RegExp(`^${rx}$`).test(s)
  } catch {
    return false
  }
}

export function isNativeClassName(name: string): boolean {
  return /^CL_SALV|^CL_DEMO|^CL_GUI|^CX_|^IF_SALV/.test(name.toUpperCase())
}
