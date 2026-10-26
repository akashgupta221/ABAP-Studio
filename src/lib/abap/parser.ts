// ── ABAP Engine: Parser (tokens → AST) ─────────────────────────────────
import { tokenize, type Token } from './tokenizer'
import { AbapSyntaxError } from './tokenizer'
import type {
  AbapProgram, Stmt, Expr, CallArg, TypeSpecAST, VarDeclStmt, MethodDecl, MethParam,
  FormParam, ClassMember, ClassDefStmt, ValueLine, TmplPart, PosSpec, SelectStmt,
} from './ast-types'

// ── cursor over tokens ─────────────────────────────────────────────────
class Cursor {
  toks: Token[]
  pos = 0
  constructor(toks: Token[]) {
    this.toks = toks
  }
  peek(off = 0): Token | undefined {
    return this.toks[this.pos + off]
  }
  get cur(): Token | undefined {
    return this.toks[this.pos]
  }
  next(): Token {
    const t = this.toks[this.pos]
    this.pos++
    return t ?? { type: 'PUNCT', value: '.', upper: '.', line: 0, col: 0 }
  }
  atEnd(): boolean {
    return this.pos >= this.toks.length
  }
  isKw(upper: string, off = 0): boolean {
    const t = this.peek(off)
    return !!t && t.type === 'IDENT' && t.upper === upper
  }
  isPunc(v: string, off = 0): boolean {
    const t = this.peek(off)
    return !!t && t.type === 'PUNCT' && t.value === v
  }
  tryKw(upper: string): boolean {
    if (this.isKw(upper)) {
      this.pos++
      return true
    }
    return false
  }
  tryPunc(v: string): boolean {
    if (this.isPunc(v)) {
      this.pos++
      return true
    }
    return false
  }
  expectPunc(v: string, what = ''): Token {
    if (!this.isPunc(v)) this.err(`Expected "${v}" ${what}`.trim())
    return this.next()
  }
  expectIdent(what = 'identifier'): Token {
    const t = this.peek()
    if (!t || t.type !== 'IDENT') this.err(`Expected ${what}`)
    return this.next()
  }
  err(msg: string): never {
    const t = this.peek()
    throw new AbapSyntaxError(msg, t?.line ?? 0, this.currentStmtText())
  }
  // text of current statement for error reporting
  currentStmtText(): string {
    let s = ''
    for (let i = this.pos; i < Math.min(this.pos + 8, this.toks.length); i++) {
      s += this.toks[i].value + ' '
      if (this.toks[i].value === '.') break
    }
    return s.trim()
  }
  // Collect tokens of one statement up to '.' at top nesting level
  // Handles chains: returns null if statement ended with ',' (chain continues)
  rawStatement(): Token[] | null {
    const out: Token[] = []
    let depth = 0
    while (!this.atEnd()) {
      const t = this.cur!
      if (t.value === '(' || t.value === '[') depth++
      if (t.value === ')' || t.value === ']') depth--
      if (t.value === '.' && depth <= 0) {
        this.next()
        return out
      }
      if (t.value === ',' && depth <= 0) {
        this.next()
        return null // chain marker — caller handles
      }
      if (t.value === ';') {
        this.next()
        return out
      }
      out.push(this.next())
    }
    return out
  }
  // Collect the remaining tokens of one statement, skipping separators.
  rawStatementTokens(): Token[] {
    const out: Token[] = []
    while (!this.atEnd()) {
      const t = this.cur!
      if (t.value === '.' || t.value === ';') { this.next(); break }
      if (t.value === ',' || t.value === ':') { this.next(); continue }
      out.push(this.next())
    }
    return out
  }
  rawStatementToDotWhere(): void {
    while (!this.atEnd() && !this.isPunc('.')) this.next()
    this.tryPunc('.')
  }
}

// Compound keywords: sequences of IDENT - IDENT [- IDENT] that form one keyword
const COMPOUND_KEYWORDS: { parts: string[]; joined: string }[] = [
  { parts: ['SELECT', 'OPTIONS'], joined: 'SELECT-OPTIONS' },
  { parts: ['SELECTION', 'SCREEN'], joined: 'SELECTION-SCREEN' },
  { parts: ['TYPE', 'POOLS'], joined: 'TYPE-POOLS' },
  { parts: ['TYPE', 'POOL'], joined: 'TYPE-POOL' },
  { parts: ['AUTHORITY', 'CHECK'], joined: 'AUTHORITY-CHECK' },
  { parts: ['FUNCTION', 'POOL'], joined: 'FUNCTION-POOL' },
  { parts: ['START', 'OF', 'SELECTION'], joined: 'START-OF-SELECTION' },
  { parts: ['END', 'OF', 'SELECTION'], joined: 'END-OF-SELECTION' },
  { parts: ['AT', 'SELECTION', 'SCREEN'], joined: 'AT-SELECTION-SCREEN' },
  { parts: ['LOAD', 'OF', 'PROGRAM'], joined: 'LOAD-OF-PROGRAM' },
  { parts: ['TOP', 'OF', 'PAGE'], joined: 'TOP-OF-PAGE' },
  { parts: ['END', 'OF', 'PAGE'], joined: 'END-OF-PAGE' },
  { parts: ['MOVE', 'CORRESPONDING'], joined: 'MOVE-CORRESPONDING' },
  { parts: ['CLASS', 'DATA'], joined: 'CLASS-DATA' },
  { parts: ['CLASS', 'METHODS'], joined: 'CLASS-METHODS' },
  { parts: ['CLASS', 'EVENTS'], joined: 'CLASS-EVENTS' },
]

// Check whether cursor begins a compound keyword; returns matched string or ''
function tryCompound(c: Cursor): string {
  const t1 = c.peek()
  if (!t1 || t1.type !== 'IDENT') return ''
  for (const entry of COMPOUND_KEYWORDS) {
    if (t1.upper !== entry.parts[0]) continue
    let ok = true
    let off = 0
    for (let i = 0; i < entry.parts.length; i++) {
      // IDENT at off, then '-' at off+1 (except last)
      const idTok = c.peek(off)
      if (!idTok || idTok.type !== 'IDENT' || idTok.upper !== entry.parts[i]) { ok = false; break }
      off++
      if (i < entry.parts.length - 1) {
        const p = c.peek(off)
        if (!p || p.type !== 'PUNCT' || p.value !== '-') { ok = false; break }
        off++
      }
    }
    if (ok) return entry.joined
  }
  return ''
}

// number of tokens a compound keyword occupies
function compoundTokenCount(joined: string): number {
  return joined.split('-').length * 2 - 1
}

function joinCompound(st: Token[]): Token[] {
  // merge compound keyword token sequences into single IDENT tokens (for dispatch)
  const out: Token[] = []
  let i = 0
  while (i < st.length) {
    const t = st[i]
    if (t.type === 'IDENT') {
      const c = new Cursor(st.slice(i))
      const m = tryCompound(c)
      if (m) {
        const consume = m.split('-').length + (m.startsWith('AT-') || m.startsWith('MOVE-') || m.startsWith('CLASS-') ? 0 : 0)
        // tokens consumed: count idents+puncs: recompute from m: number of hyphens + 1 tokens of pattern IDENT - IDENT ...
        const parts = m.split('-')
        out.push({ type: 'IDENT', value: m, upper: m, line: t.line, col: t.col })
        i += parts.length * 2 - 1
        continue
      }
    }
    out.push(t)
    i++
  }
  return out
}

// ── Parser ─────────────────────────────────────────────────────────────
export class Parser {
  private c: Cursor
  private forms = new Map<string, any>()
  private classes = new Map<string, ClassDefStmt>()
  private interfaces = new Map<string, ClassDefStmt>()
  private impls = new Map<string, any>()
  private functions = new Map<string, any>()
  private events = new Map<string, Stmt[]>()
  private defaultEvent: Stmt[] = []
  private currentEvent = '' // '' = default (START-OF-SELECTION)
  private repid = ''
  private topLevel: Stmt[] = []

  constructor(source: string) {
    this.c = new Cursor(tokenize(source))
  }

  private push(stmt: Stmt) {
    this.topLevel.push(stmt)
    if (this.currentEvent === '') {
      this.defaultEvent.push(stmt)
    } else {
      const list = this.events.get(this.currentEvent) ?? []
      list.push(stmt)
      this.events.set(this.currentEvent, list)
    }
  }

  private line(): number {
    return this.c.peek()?.line ?? 0
  }

  parse(): AbapProgram {
    while (!this.c.atEnd()) {
      this.parseTopStatement()
    }
    return {
      repid: this.repid,
      stmts: this.topLevel,
      forms: this.forms,
      classes: this.classes,
      interfaces: this.interfaces,
      impls: this.impls,
      functions: this.functions,
      events: this.events,
      defaultEvent: this.defaultEvent,
    }
  }

  // ── top level ───────────────────────────────────────────────────────
  private parseTopStatement() {
    const c = this.c
    const t = c.peek()
    if (!t) return
    if (t.type !== 'IDENT') {
      // stray punctuation — skip statement
      c.rawStatement()
      return
    }
    const comp = tryCompound(c)
    const kw = comp || t.upper
    if (comp) {
      for (let i = 0; i < compoundTokenCount(comp); i++) c.next()
    } else {
      c.next()
    }
    switch (kw) {
      case 'REPORT': case 'PROGRAM': this.parseReport(kw); return
      case 'FUNCTION': this.parseFunctionDef(); return
      case 'FORM': this.parseForm(); return
      case 'CLASS': this.parseClassDefOrImpl(); return
      case 'INTERFACE': this.parseInterfaceDef(); return
      case 'INITIALIZATION': this.beginEvent('INITIALIZATION'); return
      case 'START-OF-SELECTION': this.beginEvent('START-OF-SELECTION'); return
      case 'END-OF-SELECTION': this.beginEvent('END-OF-SELECTION'); return
      case 'AT-SELECTION-SCREEN': this.beginEvent('AT-SELECTION-SCREEN'); return
      case 'LOAD-OF-PROGRAM': this.beginEvent('LOAD-OF-PROGRAM'); return
      case 'TOP-OF-PAGE': this.beginEvent('TOP-OF-PAGE'); return
      case 'END-OF-PAGE': this.beginEvent('END-OF-PAGE'); return
      case 'TYPE-POOLS': case 'TABLES': case 'NODES': {
        // TABLES: dbtab → create work area decl(s)
        const stmts = this.parseTablesWithChain()
        for (const s of stmts) this.push(s)
        return
      }
      default: {
        // regular statement parsed in shared statement parser
        this.c.pos-- // unconsume
        if (comp) this.c.pos -= comp.split('-').length // shouldn't happen
        const st = this.parseStatement()
        if (st) {
          if (Array.isArray(st)) st.forEach((x) => this.push(x))
          else this.push(st as Stmt)
        }
        return
      }
    }
  }

  private beginEvent(name: string) {
    // skip optional '.' via raw statement remainder
    this.c.rawStatement()
    this.currentEvent = name
    if (!this.events.has(name)) this.events.set(name, [])
  }

  // ── REPORT ──────────────────────────────────────────────────────────
  private parseReport(kw: string) {
    let name = ''
    const t = this.c.peek()
    if (t && t.type === 'IDENT') {
      name = t.upper
      this.c.next()
    }
    let lineSize: Expr | undefined
    let lineCount: Expr | undefined
    let noStd = false
    // options until '.'
    const st = this.c.rawStatement() ?? []
    const sub = new Cursor(st)
    while (!sub.atEnd()) {
      if (sub.tryKw('LINE-SIZE')) lineSize = this.parseExprCursor(sub)
      else if (sub.tryKw('LINE-COUNT')) lineCount = this.parseExprCursor(sub)
      else if (sub.tryKw('NO')) { sub.tryKw('STANDARD'); sub.tryKw('PAGE'); sub.tryKw('HEADING'); noStd = true }
      else if (sub.tryKw('STANDARD')) { sub.tryKw('PAGE'); sub.tryKw('HEADING') }
      else sub.next()
    }
    if (this.repid === '') this.repid = name
    this.push({ t: 'report', name, lineSize, lineCount, noStdHeading: noStd })
  }

  // ── TABLES ──────────────────────────────────────────────────────────
  private parseTablesWithChain(): Stmt[] {
    const out: Stmt[] = []
    const parseOne = () => {
      const nameTok = this.c.expectIdent('table name')
      out.push({
        t: 'vardecl', kind: 'TABLES', name: nameTok.upper,
        typeSpec: { kind: 'ddic', typeName: nameTok.upper },
        level: 'global', line: nameTok.line,
      } as VarDeclStmt)
    }
    this.c.tryPunc(':')
    for (;;) {
      parseOne()
      if (this.c.tryPunc(',')) continue
      this.c.expectPunc('.', 'after TABLES')
      break
    }
    return out
  }

  // ── declarations (DATA/TYPES/CONSTANTS/...) ──────────────────────────
  private declKeyword(kw: string): boolean {
    return ['DATA', 'TYPES', 'CONSTANTS', 'STATICS', 'CLASS-DATA', 'PARAMETERS', 'SELECT-OPTIONS', 'FIELD-SYMBOLS', 'RANGES'].includes(kw)
  }

  private parseDeclaration(kw: string, level: 'global' | 'class' | 'local' = 'global', visibility: 'public' | 'protected' | 'private' = 'public', isStatic = false): VarDeclStmt[] {
    const out: VarDeclStmt[] = []
    this.c.tryPunc(':')
    const parseGroup = () => {
      // BEGIN OF structure group
      if (this.c.isKw('BEGIN') && this.c.isKw('OF', 1)) {
        this.c.next(); this.c.next()
        const sname = this.c.expectIdent('structure name').upper
        const fields: { name: string; type: TypeSpecAST; length?: Expr; decimals?: Expr; value?: Expr }[] = []
        // parse members until END OF
        for (;;) {
          if (this.c.isKw('END') && this.c.isKw('OF', 1) && this.isIdent(sname, 2)) {
            this.c.next(); this.c.next(); this.c.next()
            break
          }
          if (this.c.atEnd()) this.c.err(`Missing END OF for structure ${sname}`)
          const m = this.parseSingleDecl(kw, level)
          if (m) {
            if (m.typeSpec && m.typeSpec.kind === 'struct') {
              // nested inline structure
              fields.push({ name: m.name, type: m.typeSpec })
            } else {
              fields.push({ name: m.name, type: m.typeSpec!, length: m.length, decimals: m.decimals, value: m.value })
            }
          }
          // separator: ',' → continue member, '.' → end group
          if (this.c.isPunc(',')) { this.c.next(); continue }
          if (this.c.isPunc('.')) { this.c.next(); break }
          // could be directly next member keyword? ABAP requires , or .
        }
        out.push({
          t: 'vardecl', kind: kw as any, name: sname,
          typeSpec: { kind: 'struct', fields },
          level, line: this.line(),
        } as VarDeclStmt)
        return
      }
      const d = this.parseSingleDecl(kw, level)
      if (d) out.push(d)
    }
    parseGroup()
    // chain continuation
    while (this.c.isPunc(',')) {
      this.c.next()
      parseGroup()
    }
    if (!this.c.atEnd() && !this.c.isPunc('.')) this.c.expectPunc('.', 'after declaration')
    else this.c.tryPunc('.')
    return out
  }

  private isIdent(name: string, off: number): boolean {
    const t = this.c.peek(off)
    return !!t && t.type === 'IDENT' && t.upper === name
  }

  // parse one declaration item (name TYPE ... etc.) — stops before , or .
  private parseSingleDecl(kw: string, level: 'global' | 'class' | 'local', classCtx?: { visibility: string }): VarDeclStmt | null {
    const c = this.c
    const line = c.peek()?.line ?? 0
    // TYPE-POOLS etc. skip
    let name = ''
    let length: Expr | undefined
    let decimals: Expr | undefined
    // field-symbol: <fs>
    if (kw === 'FIELD-SYMBOLS') {
      const fs = this.parseFieldSymbolName()
      name = fs
    } else {
      const nt = c.peek()
      if (!nt || nt.type !== 'IDENT') {
        // skip tokens until , or .
        while (!c.atEnd() && !c.isPunc(',') && !c.isPunc('.')) c.next()
        return null
      }
      name = nt.upper
      c.next()
      // LENGTH (n) or (n) after name for C/N/P/X
      if (c.isPunc('(')) {
        c.next()
        const numTok = c.peek()
        if (numTok && numTok.type === 'NUMBER') {
          length = { t: 'num', v: parseFloat(numTok.value), raw: numTok.value }
          c.next()
        }
        c.expectPunc(')')
      }
    }
    const decl: VarDeclStmt = {
      t: 'vardecl', kind: kw as any, name,
      level, line,
    }
    let typeSpec: TypeSpecAST | undefined
    // TYPE / LIKE / VALUE / LENGTH / DECIMALS / OCCURS / etc.
    for (;;) {
      const t = c.peek()
      if (!t || t.type !== 'IDENT') break
      const u = t.upper
      if (u === 'TYPE' || u === 'LIKE') {
        const isLike = u === 'LIKE'
        c.next()
        typeSpec = this.parseTypeSpec(isLike)
        // continue parsing (VALUE/LENGTH/DECIMALS may follow)
      } else if (u === 'VALUE' || (kw === 'PARAMETERS' && u === 'DEFAULT')) {
        c.next()
        // VALUE IS / DEFAULT
        c.tryKw('IS')
        decl.value = this.parseExprStopAtChain()
        decl.defaultVal = decl.value
      } else if (u === 'STRUCTURE') {
        c.next()
        const vt = c.peek()
        if (vt && vt.type === 'IDENT') c.next() // STRUCTURE gs — type taken from variable
      } else if (u === 'LENGTH') {
        c.next()
        c.tryKw('IS')
        length = this.parseExprStopAtChain()
      } else if (u === 'DECIMALS') {
        c.next()
        c.tryKw('IS')
        decimals = this.parseExprStopAtChain()
      } else if (u === 'OCCURS') {
        // old-style: DATA it OCCURS 10 [WITH HEADER LINE] ...
        c.next()
        const n = c.peek()
        if (n && n.type === 'NUMBER') { c.next() }
        typeSpec = typeSpec ?? { kind: 'like', likeTarget: 'ANY' }
        const ts = typeSpec
        typeSpec = { kind: 'table', tableKind: 'STANDARD', lineType: ts, headerLine: false }
        // WITH HEADER LINE handled below by generic loop? handle now:
      } else if (u === 'WITH' && c.isKw('HEADER', 1) && c.isKw('LINE', 2)) {
        c.next(); c.next(); c.next()
        if (typeSpec) typeSpec = { kind: 'table', tableKind: 'STANDARD', lineType: typeSpec, headerLine: true }
      } else if (u === 'READ') { c.next(); c.next() } // READ-ONLY
      else if (kw === 'PARAMETERS' && (u === 'OBLIGATORY')) {
        c.next()
        decl.obligatory = true
      } else if (kw === 'PARAMETERS' && u === 'AS' && c.isKw('CHECKBOX', 1)) {
        c.next(); c.next()
        decl.paramKind = 'checkbox'
      } else if (kw === 'PARAMETERS' && u === 'AS' && c.isKw('LISTBOX', 1)) {
        c.next(); c.next()
        decl.paramKind = 'listbox'
      } else if (kw === 'PARAMETERS' && u === 'RADIOBUTTON' && c.isKw('GROUP', 1)) {
        c.next(); c.next()
        const g = c.expectIdent('radio group')
        decl.paramKind = 'radiobutton'
        decl.radioGroup = g.upper
      } else if (kw === 'PARAMETERS' && u === 'LOWER') {
        c.next(); c.tryKw('CASE')
        decl.lowerCase = true
      } else if (kw === 'PARAMETERS' && u === 'MEMORY' && c.isKw('ID', 1)) {
        c.next(); c.next()
        if (c.peek() && c.peek()!.type === 'STRING') c.next()
      } else if (kw === 'PARAMETERS' && u === 'MATCHCODE' && c.isKw('OBJECT', 1)) {
        c.next(); c.next(); if (c.peek()?.type === 'IDENT') c.next()
      } else if (kw === 'PARAMETERS' && u === 'VISIBLE' && c.isPunc('(', 1)) {
        c.next(); c.next()
        if (c.peek()?.type === 'NUMBER') { decl.visibleLength = parseInt(c.next().value) }
        c.tryPunc(')')
      } else if (u === 'FOR' && (kw === 'SELECT-OPTIONS' || kw === 'RANGES')) {
        c.next()
        // FOR f | FOR dbtab-f
        const ft = c.expectIdent('field')
        if (c.isPunc('-')) {
          c.next()
          const ff = c.expectIdent('field')
          decl.forField = { table: ft.upper, field: ff.upper }
        } else {
          decl.forField = { field: ft.upper }
        }
      } else if (u === 'NO' && kw === 'SELECT-OPTIONS') {
        c.next()
        if (c.tryKw('INTERVALS')) decl.noIntervals = true
        else if (c.tryKw('EXTENSION')) decl.noExtension = true
        else if (c.tryKw('DISPLAY')) { c.tryKw('SIGN') }
      } else if (u === 'OBLIGATORY') {
        c.next()
      } else if (u === 'IS' || u === 'NOT' || u === 'INHERITING' || u === 'MODE') {
        c.next()
      } else break
    }
    if (typeSpec) decl.typeSpec = typeSpec
    if (length) decl.length = length
    if (decimals) decl.decimals = decimals
    if (classCtx) decl.level = 'class'
    if (kw === 'RANGES') {
      // RANGES r FOR f → table of range line
      decl.kind = 'SELECT-OPTIONS'
      if (!decl.forField) {
        // try parse FOR
      }
    }
    return decl
  }

  // ── TYPE spec parsing ───────────────────────────────────────────────
  private parseTypeSpec(isLike: boolean, stopAtDot = false): TypeSpecAST {
    const c = this.c
    // LINE OF
    if (c.isKw('LINE') && c.isKw('OF', 1)) {
      c.next(); c.next()
      const target = c.expectIdent('table').upper
      return { kind: 'likeLine', likeTarget: target }
    }
    // TABLE OF ...
    if (c.isKw('TABLE') && c.isKw('OF', 1)) {
      c.next(); c.next()
      const lineType = this.parseTypeSpec(isLike, stopAtDot)
      return { kind: 'table', tableKind: 'STANDARD', lineType }
    }
    if (c.isKw('STANDARD') || c.isKw('SORTED') || c.isKw('HASHED')) {
      const kindTok = c.next().upper as 'STANDARD' | 'SORTED' | 'HASHED'
      if (!c.tryKw('TABLE')) {
        // "STANDARD TABLE" missing — tolerate
      }
      c.tryKw('OF')
      const lineType = this.parseTypeSpec(isLike, stopAtDot)
      const spec: TypeSpecAST = { kind: 'table', tableKind: kindTok, lineType }
      return this.parseTableOptions(spec)
    }
    // RANGE OF
    if (c.isKw('RANGE') && c.isKw('OF', 1)) {
      c.next(); c.next()
      const elem = this.parseTypeSpec(false, stopAtDot)
      return { kind: 'table', tableKind: 'STANDARD', lineType: elem }
    }
    // REF TO
    if (c.isKw('REF') && c.isKw('TO', 1)) {
      c.next(); c.next()
      const cls = c.expectIdent('class name').upper
      return { kind: 'oref', typeName: cls }
    }
    // BEGIN OF (inside TYPES parse via group — handled by parseDeclaration)
    // simple name or builtin
    const t = c.peek()
    if (!t || t.type !== 'IDENT') c.err('Expected type')
    c.next()
    const u = t!.upper
    // dbtab-field DDIC reference
    if (c.isPunc('-')) {
      c.next()
      const f = c.expectIdent('field')
      return { kind: 'ddic', ddicField: { table: u, field: f.upper }, typeName: `${u}-${f.upper}` }
    }
    if (isLike) {
      if (c.isKw('TABLE')) {
        // LIKE TABLE OF
        c.next()
        c.tryKw('OF')
        const lt = this.parseTypeSpec(false, stopAtDot)
        return { kind: 'table', tableKind: 'STANDARD', lineType: lt }
      }
      return { kind: 'like', likeTarget: u }
    }
    const builtins = new Set(['I', 'INT8', 'F', 'P', 'C', 'N', 'D', 'T', 'STRING', 'XSTRING', 'X', 'B', 'S', 'ANY', 'DATA', 'SIMPLE', 'NUMERIC', 'CLIKE', 'CSEQUENCE', 'XSEQUENCE', 'TABLE', 'STANDARD', 'SORTED', 'HASHED', 'INDEX', 'OBJECT', 'REF'])
    if (builtins.has(u)) {
      return { kind: 'elem', elem: u as any }
    }
    // named type (local TYPES, class type, DDIC)
    if (c.isPunc('=>') || c.isPunc('->')) {
      c.next()
      const sub = c.expectIdent('type').upper
      return { kind: 'named', typeName: `${u}=>${sub}` }
    }
    return { kind: 'named', typeName: u }
  }

  private parseTableOptions(spec: TypeSpecAST): TypeSpecAST {
    const c = this.c
    if (spec.kind !== 'table') return spec
    for (;;) {
      if (c.isKw('WITH')) {
        c.next()
        let uniq = false
        if (c.tryKw('UNIQUE')) uniq = true
        else if (c.tryKw('NON')) {
          c.tryKw('-')
          c.tryKw('UNIQUE')
        }
        if (c.isKw('DEFAULT')) {
          c.next()
          c.tryKw('KEY')
          spec.keyFields = []
          continue
        }
        if (c.isKw('EMPTY')) {
          c.next(); c.tryKw('KEY')
          spec.keyFields = []
          continue
        }
        if (c.tryKw('HEADER')) {
          c.tryKw('LINE')
          spec.headerLine = true
          continue
        }
        c.tryKw('KEY')
        // key fields until WITH/,/.
        const keys: string[] = []
        while (c.peek() && c.peek()!.type === 'IDENT' && !['WITH', 'INITIAL', ''].includes(c.peek()!.upper)) {
          // support keyname / components comp1 comp2
          const kt = c.next()
          if (kt.upper === 'COMPONENTS') {
            while (c.peek() && c.peek()!.type === 'IDENT' && !c.isPunc(',') && !c.isPunc('.')) keys.push(c.next().upper)
            break
          }
          keys.push(kt.upper)
          // table_line
          if (c.isPunc('-')) {
            c.next()
            c.next()
          }
          if (c.isPunc('(')) {
            let d = 0
            do {
              const tk = c.next()
              if (tk.value === '(') d++
              if (tk.value === ')') d--
            } while (d > 0 && !c.atEnd())
          }
        }
        spec.unique = uniq
        spec.keyFields = keys
        continue
      }
      if (c.isKw('INITIAL') && c.isKw('SIZE', 1)) {
        c.next(); c.next()
        if (c.peek()?.type === 'NUMBER') c.next()
        continue
      }
      break
    }
    return spec
  }

  private parseFieldSymbolName(): string {
    const c = this.c
    c.expectPunc('<', 'field symbol')
    const name = c.expectIdent('field symbol name').upper
    c.expectPunc('>')
    return name
  }

  // expression parse that stops at ',' or '.' — for declaration values
  private parseExprStopAtChain(): Expr {
    // simple: parse expression with the main cursor (statement splitter handles . ,)
    return this.parseExpr()
  }

  // ── FORM ────────────────────────────────────────────────────────────
  private parseForm() {
    const line = this.line()
    const nameTok = this.c.expectIdent('form name')
    const name = nameTok.upper
    const params: FormParam[] = []
    // parse parameter clauses until '.'
    const parseClause = (kind: 'using' | 'changing' | 'tables') => {
      for (;;) {
        const t = this.c.peek()
        if (!t) break
        if (t.type !== 'IDENT' && t.value !== '(') break
        // stop at clause keywords or statement end
        if (t.type === 'IDENT' && ['USING', 'CHANGING', 'TABLES', 'RAISING', 'CHANGING'].includes(t.upper)) break
        let pname = ''
        let byValue = false
        if (t.value === '(') {
          this.c.next()
          pname = this.c.expectIdent('param').upper
          this.c.expectPunc(')')
        } else {
          pname = t.upper
          this.c.next()
        }
        // VALUE(p)
        if (this.c.isKw('VALUE') && this.c.isPunc('(', 1)) {
          this.c.next(); this.c.next()
          const vp = this.c.expectIdent('param').upper
          this.c.expectPunc(')')
          pname = vp
          byValue = true
        }
        // optional TYPE
        let typeSpec: TypeSpecAST | undefined
        let typed = false
        let length: Expr | undefined
        if (this.c.tryKw('TYPE') || this.c.tryKw('LIKE')) {
          typed = true
          typeSpec = this.parseTypeSpec(false)
        }
        if (this.c.tryKw('LENGTH')) length = this.parseExpr()
        params.push({ name: pname, typeSpec, byValue, kind, typed, length })
        // ',' separates chained FORM declarations? Actually FORMs aren't chained; but stop at clause keywords
        const nt = this.c.peek()
        if (nt && nt.type === 'IDENT' && !['USING', 'CHANGING', 'TABLES', 'RAISING'].includes(nt.upper)) continue
        break
      }
    }
    for (;;) {
      if (this.c.isPunc('.')) { this.c.next(); break }
      const t = this.c.peek()
      if (!t) break
      const u = t.upper
      if (u === 'USING') { this.c.next(); parseClause('using') }
      else if (u === 'CHANGING') { this.c.next(); parseClause('changing') }
      else if (u === 'TABLES') { this.c.next(); parseClause('tables') }
      else if (u === 'RAISING') { this.c.next(); while (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.') && !this.c.isPunc(',')) this.c.next() }
      else if (u === 'VALUE') {
        // leading VALUE(p) TYPE ...
        this.c.next()
        this.c.expectPunc('(')
        const p = this.c.expectIdent('param').upper
        this.c.expectPunc(')')
        const nt = this.c.peek()
        let typeSpec: TypeSpecAST | undefined
        if (nt && (nt.upper === 'TYPE' || nt.upper === 'LIKE')) {
          this.c.next()
          typeSpec = this.parseTypeSpec(false)
        }
        params.push({ name: p, typeSpec, byValue: true, kind: 'using', typed: !!typeSpec })
        if (this.c.isPunc(',')) { this.c.next(); continue }
      } else this.c.next()
    }
    // body until ENDFORM
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDFORM'))
    this.c.rawStatement() // consume ENDFORM.
    this.forms.set(name, { t: 'form', name, params, body, line })
  }

  // ── FUNCTION def (within FUNCTION GROUP source) ──────────────────────
  private parseFunctionDef() {
    // FUNCTION name.  (name can be quoted string or bare identifier)
    const t = this.c.peek()
    if (!t || (t.type !== 'STRING' && t.type !== 'IDENT')) {
      // skip to end
      this.c.rawStatement()
      return
    }
    const name = (t.type === 'STRING' ? t.value : t.upper).toUpperCase()
    this.c.next()
    this.c.rawStatement() // consume rest of FUNCTION header line
    // optional IMPORT/EXPORT/CHANGING/TABLES/EXCEPTIONS clauses (comment style) — skip them
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDFUNCTION'))
    this.c.rawStatement()
    // extract param docs from preceding statements? The FM params are documented externally (stored in DB).
    this.functions.set(name, { t: 'functiondef', name, params: [], body })
  }

  // ── CLASS / INTERFACE ───────────────────────────────────────────────
  private parseClassDefOrImpl() {
    const nameTok = this.c.expectIdent('class name')
    const name = nameTok.upper
    if (this.c.tryKw('DEFINITION')) {
      this.parseClassDef(name, false)
    } else if (this.c.tryKw('DEFERRED')) {
      this.c.rawStatement()
      // forward declaration — ignore
    } else if (this.c.tryKw('IMPLEMENTATION')) {
      this.parseClassImpl(name)
    } else if (this.c.tryKw('LOAD')) {
      this.c.rawStatement()
    } else {
      // could be "CLASS DEFINITION" split? consume rest
      this.c.rawStatement()
    }
  }

  private parseClassDef(name: string, isInterface: boolean) {
    const line = this.line()
    const def: ClassDefStmt = {
      t: 'classdef', name, isInterface,
      interfaces: [], sections: [], line,
      final: false, abstract: false,
    }
    // header options until '.'
    for (;;) {
      if (this.c.isPunc('.')) { this.c.next(); break }
      const t = this.c.peek()
      if (!t) break
      const u = t.upper
      if (u === 'INHERITING' && this.c.isKw('FROM', 1)) {
        this.c.next(); this.c.next()
        def.inheriting = this.c.expectIdent('parent class').upper
      } else if (u === 'FINAL') { this.c.next(); def.final = true }
      else if (u === 'ABSTRACT') { this.c.next(); def.abstract = true }
      else if (u === 'CREATE') {
        this.c.next()
        if (this.c.isKw('PUBLIC')) this.c.next()
        else if (this.c.isKw('PROTECTED')) this.c.next()
        else if (this.c.isKw('PRIVATE')) this.c.next()
        def.create = 'public'
      }
      else if (u === 'PUBLIC') { this.c.next(); def.create = 'public' }
      else if (u === 'SHARED') { this.c.next(); this.c.tryKw('MEMORY'); this.c.tryKw('ENABLED') }
      else if (u === 'MESSAGE' && this.c.isKw('ID', 1)) {
        this.c.next(); this.c.next()
        // message id args — skip to end
        while (!this.c.isPunc('.') && !this.c.atEnd()) this.c.next()
      }
      else if (u === 'RISK' || u === 'DURATION' || u === 'FOR' || u === 'TESTING' || u === 'INHERITING') { this.c.next(); while (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.')) this.c.next() }
      else this.c.next()
    }
    // body until ENDCLASS / ENDINTERFACE
    const endKw = isInterface ? 'ENDINTERFACE' : 'ENDCLASS'
    let currentVis: 'public' | 'protected' | 'private' = isInterface ? 'public' : 'public'
    let members: ClassMember[] = []
    const flush = () => {
      if (members.length) def.sections.push({ visibility: currentVis, members })
      members = []
    }
    while (!this.c.atEnd()) {
      if (this.c.isKw(endKw)) { this.c.rawStatement(); break }
      if (this.c.isKw('PUBLIC') && this.c.isKw('SECTION', 1)) {
        this.c.rawStatement()
        flush(); currentVis = 'public'; continue
      }
      if (this.c.isKw('PROTECTED') && this.c.isKw('SECTION', 1)) {
        this.c.rawStatement()
        flush(); currentVis = 'protected'; continue
      }
      if (this.c.isKw('PRIVATE') && this.c.isKw('SECTION', 1)) {
        this.c.rawStatement()
        flush(); currentVis = 'private'; continue
      }
      if (this.c.isKw('INTERFACES')) {
        const toks = this.c.rawStatementTokens()
        const iname = toks.find((x) => x.type === 'IDENT' && x.upper !== 'INTERFACES')?.upper ?? ''
        if (iname) def.interfaces.push({ name: iname, aliases: [] })
        continue
      }
      if (this.c.isKw('ALIASES')) {
        const toks = this.c.rawStatementTokens()
        const idents = toks.filter((x) => x.type === 'IDENT' && x.upper !== 'ALIASES' && x.upper !== 'FOR').map((x) => x.upper)
        if (idents.length >= 2 && def.interfaces.length) {
          const target = def.interfaces[def.interfaces.length - 1]
          target.aliases.push({ name: idents[0], target: idents[1] })
        }
        continue
      }
      if (this.c.isKw('TYPE-POOLS') || this.c.isKw('TYPE-POOL')) { this.c.rawStatement(); continue }
      const comp = tryCompound(this.c)
      const t = this.c.peek()
      if (!t || t.type !== 'IDENT') { this.c.rawStatement(); continue }
      const kw = comp || t.upper
      if (comp) {
        for (let i = 0; i < compoundTokenCount(comp); i++) this.c.next()
      } else this.c.next()
      if (['DATA', 'TYPES', 'CONSTANTS', 'STATICS', 'CLASS-DATA'].includes(kw)) {
        const decls = this.parseDeclaration(kw, 'class', currentVis, kw === 'CLASS-DATA')
        for (const d of decls) members.push({ kind: 'var', decl: d })
      } else if (kw === 'METHODS' || kw === 'CLASS-METHODS') {
        const decls = this.parseMethodDecls(kw === 'CLASS-METHODS', currentVis)
        for (const d of decls) members.push({ kind: 'method', decl: d })
      } else if (kw === 'EVENTS' || kw === 'CLASS-EVENTS') {
        const decl = this.parseEventDecl(kw === 'CLASS-EVENTS')
        members.push({ kind: 'event', decl })
      } else {
        this.c.rawStatement()
      }
    }
    flush()
    if (isInterface) this.interfaces.set(name, def)
    else this.classes.set(name, def)
  }

  private lastRaw: Token[] = []

  private parseInterfaceDef() {
    const name = this.c.expectIdent('interface name').upper
    this.parseClassDef(name, true)
  }

  private parseMethodDecls(isStatic: boolean, visibility: 'public' | 'protected' | 'private'): MethodDecl[] {
    const out: MethodDecl[] = []
    this.c.tryPunc(':')
    for (;;) {
      const line = this.line()
      let name = ''
      let isConstructor = false
      let isClassConstructor = false
      const t = this.c.peek()
      if (!t || t.type !== 'IDENT') {
        while (!this.c.atEnd() && !this.c.isPunc(',') && !this.c.isPunc('.')) this.c.next()
        if (this.c.tryPunc(',')) continue
        this.c.tryPunc('.')
        break
      }
      name = t.upper
      this.c.next()
      if (name === 'CONSTRUCTOR') isConstructor = true
      if (name === 'CLASS_CONSTRUCTOR') isClassConstructor = true
      const decl: MethodDecl = {
        name, isStatic, isConstructor, isClassConstructor,
        redefinition: false, abstract: false, final: false, visibility,
        importing: [], exporting: [], changing: [], raising: [], exceptions: [],
        line,
      }
      // parse param clauses
      let endedWith = ''
      for (;;) {
        if (this.c.isPunc('.')) { this.c.next(); endedWith = '.'; break }
        if (this.c.isPunc(',')) { this.c.next(); endedWith = ','; break }
        const t2 = this.c.peek()
        if (!t2) { endedWith = '.'; break }
        const u = t2.upper
        if (u === 'IMPORTING' || u === 'EXPORTING' || u === 'CHANGING') {
          this.c.next()
          const kind = u.toLowerCase() as 'importing' | 'exporting' | 'changing'
          this.parseMethParams(decl, kind)
        } else if (u === 'RETURNING') {
          this.c.next()
          this.c.tryKw('VALUE')
          this.c.expectPunc('(')
          const pname = this.c.expectIdent('returning param').upper
          this.c.expectPunc(')')
          let typeSpec: TypeSpecAST | undefined
          if (this.c.tryKw('TYPE') || this.c.tryKw('LIKE')) typeSpec = this.parseTypeSpec(false)
          decl.returning = { name: pname, typeSpec, byValue: true, optional: false }
        } else if (u === 'RAISING') {
          this.c.next()
          while (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.') && !this.c.isPunc(',')) decl.raising.push(this.c.next().upper)
        } else if (u === 'EXCEPTIONS') {
          this.c.next()
          while (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.') && !this.c.isPunc(',')) {
            const en = this.c.next().upper
            let code = 1
            if (this.c.isPunc('=')) {
              this.c.next()
              if (this.c.peek()?.type === 'NUMBER') code = parseInt(this.c.next().value)
            }
            decl.exceptions.push({ name: en, code })
          }
        } else if (u === 'REDEFINITION') { this.c.next(); decl.redefinition = true }
        else if (u === 'ABSTRACT') { this.c.next(); decl.abstract = true }
        else if (u === 'FINAL' && !this.c.isKw('IMPORTING', 1) && !this.c.isKw('EXPORTING', 1)) { this.c.next(); decl.final = true }
        else if (u === 'FOR') {
          this.c.next()
          if (this.c.isKw('EVENT')) {
            this.c.next()
            decl.forEvent = this.c.expectIdent('event name').upper
            if (this.c.tryKw('OF')) decl.forClass = this.c.expectIdent('class').upper
          } else {
            while (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.') && !this.c.isPunc(',')) this.c.next()
          }
        }
        else if (u === 'DEFAULT' || u === 'OPTIONAL') { this.c.next() }
        else this.c.next()
      }
      out.push(decl)
      if (endedWith === ',') continue
      break
    }
    return out
  }

  private parseMethParams(decl: MethodDecl, kind: 'importing' | 'exporting' | 'changing') {
    for (;;) {
      const t = this.c.peek()
      if (!t) return
      if (t.type !== 'IDENT' && t.value !== '(') return
      if (t.type === 'IDENT' && ['IMPORTING', 'EXPORTING', 'CHANGING', 'RETURNING', 'RAISING', 'EXCEPTIONS', 'REDEFINITION'].includes(t.upper)) return
      let pname = ''
      let byValue = false
      if (t.value === '(') {
        // (i_param) style
        this.c.next()
        pname = this.c.expectIdent('param').upper
        this.c.expectPunc(')')
      } else {
        pname = t.upper
        this.c.next()
      }
      if (this.c.isKw('VALUE') && this.c.isPunc('(', 1)) {
        this.c.next(); this.c.next()
        pname = this.c.expectIdent('param').upper
        this.c.expectPunc(')')
        byValue = true
      }
      if (this.c.isKw('TYPE') && this.c.isKw('ANY', 1)) {
        // TYPE ANY marker
        this.c.next(); this.c.next()
      }
      let optional = false
      let defaultVal: Expr | undefined
      let typeSpec: TypeSpecAST | undefined
      let length: Expr | undefined
      let decimals: Expr | undefined
      for (;;) {
        if (this.c.isKw('TYPE') || this.c.isKw('LIKE')) {
          this.c.next()
          typeSpec = this.parseTypeSpec(false)
        } else if (this.c.isKw('OPTIONAL')) {
          this.c.next()
          optional = true
        } else if (this.c.isKw('DEFAULT')) {
          this.c.next()
          defaultVal = this.parseExprStopAtParam()
          optional = true
        } else if (this.c.isKw('LENGTH')) {
          this.c.next()
          length = this.parseExprStopAtParam()
        } else if (this.c.isKw('DECIMALS')) {
          this.c.next()
          decimals = this.parseExprStopAtParam()
        } else break
      }
      const p: MethParam = { name: pname, typeSpec, byValue, optional, defaultVal, length, decimals, typed: !!typeSpec }
      decl[kind].push(p)
      // ',' separates chained METHODS declarations — stop here (do not treat as param separator)
      const nt = this.c.peek()
      if (nt && (nt.type === 'IDENT' || nt.value === '(') && !['IMPORTING', 'EXPORTING', 'CHANGING', 'RETURNING', 'RAISING', 'EXCEPTIONS', 'REDEFINITION', 'ABSTRACT', 'FINAL', 'FOR'].includes(nt.type === 'IDENT' ? nt.upper : '')) continue
      return
    }
  }

  private parseExprStopAtParam(): Expr {
    return this.parseExpr()
  }

  private parseEventDecl(isStatic: boolean): { name: string; isStatic: boolean; exporting: MethParam[] } {
    this.c.tryPunc(':')
    const name = this.c.expectIdent('event name').upper
    const exporting: MethParam[] = []
    for (;;) {
      if (this.c.isPunc('.')) { this.c.next(); break }
      if (this.c.isKw('EXPORTING')) {
        this.c.next()
        for (;;) {
          const t = this.c.peek()
          if (!t || t.type !== 'IDENT') break
          let pname = t.upper
          this.c.next()
          let byValue = false
          if (this.c.isKw('VALUE') && this.c.isPunc('(', 1)) {
            this.c.next(); this.c.next()
            pname = this.c.expectIdent('param').upper
            this.c.expectPunc(')')
            byValue = true
          }
          let typeSpec: TypeSpecAST | undefined
          if (this.c.tryKw('TYPE') || this.c.tryKw('LIKE')) typeSpec = this.parseTypeSpec(false)
          exporting.push({ name: pname, typeSpec, byValue, optional: false })
          if (this.c.isPunc(',')) { this.c.next(); continue }
          break
        }
        continue
      }
      if (this.c.atEnd()) break
      this.c.next()
    }
    return { name, isStatic, exporting }
  }

  private parseClassImpl(name: string) {
    const line = this.line()
    this.c.rawStatement() // consume rest of header
    const methods: { name: string; body: Stmt[]; line: number }[] = []
    while (!this.c.atEnd()) {
      if (this.c.isKw('ENDCLASS')) { this.c.rawStatement(); break }
      if (this.c.isKw('METHOD')) {
        this.c.next() // consume METHOD keyword
        const mline = this.line()
        let mname = this.c.expectIdent('method name').upper
        // interface method: METHOD if_x~meth.
        if (this.c.isPunc('~')) {
          this.c.next()
          const m2 = this.c.expectIdent('interface method').upper
          mname = `${mname}~${m2}`
        }
        this.c.rawStatement()
        const body: Stmt[] = []
        this.parseBodyUntil(body, () => this.c.isKw('ENDMETHOD'))
        this.c.rawStatement()
        methods.push({ name: mname, body, line: mline })
        continue
      }
      this.c.rawStatement()
    }
    this.impls.set(name, { t: 'classimpl', name, methods, line })
  }

  // parse statements into body until predicate true (terminator NOT consumed)
  private parseBodyUntil(body: Stmt[], isEnd: () => boolean) {
    while (!this.c.atEnd()) {
      if (isEnd()) return
      const st = this.parseStatement()
      if (st) {
        if (Array.isArray(st)) st.forEach((x) => body.push(x))
        else body.push(st as Stmt)
      }
    }
  }

  // ── general statements ──────────────────────────────────────────────
  // returns Stmt | Stmt[] | null
  private parseStatement(): Stmt | Stmt[] | null {
    const c = this.c
    const t = c.peek()
    if (!t) return null
    if (t.type === 'PUNCT' && t.value === '.') { c.next(); return null }
    if (t.type !== 'IDENT') {
      // e.g. stray STRING? skip statement
      c.rawStatement()
      return null
    }
    const comp = tryCompound(c)
    let kw = comp || t.upper
    if (comp) {
      for (let i = 0; i < compoundTokenCount(comp); i++) c.next()
    } else {
      c.next()
    }
    switch (kw) {
      case 'DATA': case 'TYPES': case 'CONSTANTS': case 'STATICS': case 'CLASS-DATA': case 'FIELD-SYMBOLS': {
        // inline declaration statement: DATA(x) = ... — parse as expression statement
        if ((kw === 'DATA' || kw === 'STATICS') && this.c.isPunc('(')) {
          this.c.pos--
          return this.parseExpressionStatement()
        }
        return this.parseDeclaration(kw, 'local')
      }
      case 'RANGES': {
        const decls = this.parseDeclaration('RANGES', 'local')
        return decls
      }
      case 'PARAMETERS': {
        const decls = this.parseDeclaration('PARAMETERS', 'global')
        return decls
      }
      case 'SELECTION-SCREEN': {
        c.rawStatement()
        return null
      }
      case 'SELECT-OPTIONS': {
        const decls = this.parseDeclaration('SELECT-OPTIONS', 'global')
        return decls
      }
      case 'TYPE-POOLS': case 'NODES': { c.rawStatement(); return null }
      case 'TABLES': return this.parseTablesWithChain()
      case 'INCLUDE': {
        const nt = c.peek()
        if (nt && nt.type === 'IDENT') {
          const name = nt.upper
          c.rawStatement()
          return { t: 'include', name }
        }
        c.rawStatement()
        return null
      }
      case 'WRITE': return this.parseWrite()
      case 'ULINE': {
        const line = this.line()
        c.rawStatementTokens()
        const toks = this.lastRaw
        const pos = this.parsePosTokens(toks)
        return { t: 'uline', pos, line }
      }
      case 'SKIP': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        let n: Expr | undefined
        let toLine: Expr | undefined
        if (sub.tryKw('TO')) { sub.tryKw('LINE'); toLine = this.parseExprCursor(sub) }
        else if (sub.peek()?.type === 'NUMBER') n = { t: 'num', v: parseFloat(sub.next().value), raw: '' }
        return { t: 'skip', n, toLine, line }
      }
      case 'NEW-LINE': { c.rawStatement(); return { t: 'newline', line: this.line() } }
      case 'FORMAT': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        let color: string | undefined
        let colorOn: boolean | undefined
        let intensified: 'on' | 'off' | undefined
        let inverse: 'on' | 'off' | undefined
        let hotspot: 'on' | 'off' | undefined
        let reset = false
        while (!sub.atEnd()) {
          const tk = sub.peek()!
          if (tk.type !== 'IDENT') { sub.next(); continue }
          const u = tk.upper
          if (u === 'COLOR') {
            sub.next()
            if (sub.peek()?.type === 'NUMBER') color = sub.next().value
            else if (sub.peek()?.type === 'IDENT') color = sub.next().upper
            if (sub.tryKw('ON')) colorOn = true
            else if (sub.tryKw('OFF')) colorOn = false
          } else if (u === 'INTENSIFIED') { sub.next(); intensified = sub.tryKw('ON') ? 'on' : sub.tryKw('OFF') ? 'off' : 'on' }
          else if (u === 'INVERSE') { sub.next(); inverse = sub.tryKw('ON') ? 'on' : sub.tryKw('OFF') ? 'off' : 'on' }
          else if (u === 'HOTSPOT') { sub.next(); hotspot = sub.tryKw('ON') ? 'on' : sub.tryKw('OFF') ? 'off' : 'on' }
          else if (u === 'RESET') { sub.next(); reset = true }
          else sub.next()
        }
        return { t: 'format', color, colorOn, intensified, inverse, hotspot, reset, line }
      }
      case 'IF': return this.parseIf()
      case 'CASE': return this.parseCase()
      case 'DO': return this.parseDo()
      case 'WHILE': return this.parseWhile()
      case 'LOOP': return this.parseLoop()
      case 'CONTINUE': { c.rawStatement(); return { t: 'continue' } }
      case 'EXIT': { c.rawStatement(); return { t: 'exit' } }
      case 'RETURN': { c.rawStatement(); return { t: 'return' } }
      case 'CHECK': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const cond = this.parseExprCursor(sub)
        return { t: 'check', cond, line }
      }
      case 'APPEND': return this.parseAppend()
      case 'INSERT': return this.parseInsert()
      case 'READ': return this.parseReadTable()
      case 'MODIFY': return this.parseModify()
      case 'DELETE': return this.parseDelete()
      case 'SORT': return this.parseSort()
      case 'CLEAR': {
        const line = this.line()
        const out: Stmt[] = []
        c.tryPunc(':')
        for (;;) {
          const e = this.parseExpr()
          out.push({ t: 'clear', targets: [e], line })
          if (c.tryPunc(',')) continue
          break
        }
        c.expectPunc('.', 'after CLEAR')
        if (out.length === 1) return out[0]
        return out
      }
      case 'REFRESH': {
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const table = this.parseExprCursor(sub)
        return { t: 'refresh', table }
      }
      case 'FREE': {
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const target = this.parseExprCursor(sub)
        return { t: 'free', target }
      }
      case 'DESCRIBE': return this.parseDescribe()
      case 'MOVE': case 'MOVE-CORRESPONDING': {
        const line = this.line()
        // MOVE src TO dst
        const src = this.parseExpr()
        if (c.tryKw('TO')) {
          const dst = this.parseExpr()
          c.expectPunc('.', 'after MOVE')
          return { t: 'move', src, dst, corresponding: kw === 'MOVE-CORRESPONDING', line }
        }
        c.expectPunc('.', 'after MOVE')
        return { t: 'expr', expr: src, line }
      }
      case 'COMPUTE': {
        const line = this.line()
        const target = this.parseExpr()
        if (c.tryKw('EXACT')) { /* tolerate */ }
        c.expectPunc('=', 'after COMPUTE target')
        const expr = this.parseExpr()
        c.expectPunc('.', 'after COMPUTE')
        return { t: 'compute', target, expr, op: '=', line }
      }
      case 'ADD': case 'SUBTRACT': case 'MULTIPLY': case 'DIVIDE': {
        const line = this.line()
        const a = this.parseExpr()
        const prep = kw === 'ADD' ? 'TO' : kw === 'SUBTRACT' ? 'FROM' : 'BY'
        if (kw === 'SUBTRACT' || kw === 'DIVIDE') {
          // SUBTRACT a FROM b ; DIVIDE a BY b
          if (!c.tryKw(prep)) c.err(`Expected ${prep} in ${kw}`)
          const b = this.parseExpr()
          c.expectPunc('.', 'after ' + kw)
          return { t: 'arith', op: kw as any, a, b, line }
        }
        if (!c.tryKw(prep)) c.err(`Expected ${prep} in ${kw}`)
        const b = this.parseExpr()
        c.expectPunc('.', 'after ' + kw)
        return { t: 'arith', op: kw as any, a, b, line }
      }
      case 'CONCATENATE': return this.parseConcatenate()
      case 'SPLIT': return this.parseSplit()
      case 'CONDENSE': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const target = this.parseExprCursor(sub)
        let noGaps = false
        if (sub.tryKw('NO')) { sub.tryKw('-'); sub.tryKw('GAPS'); noGaps = true }
        return { t: 'condense', target, noGaps, line }
      }
      case 'TRANSLATE': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const target = this.parseExprCursor(sub)
        let toUpper = false
        let toLower = false
        let using: Expr | undefined
        if (sub.tryKw('TO')) {
          if (sub.tryKw('UPPER')) { sub.tryKw('CASE'); toUpper = true }
          else if (sub.tryKw('LOWER')) { sub.tryKw('CASE'); toLower = true }
        } else if (sub.tryKw('USING')) {
          using = this.parseExprCursor(sub)
        }
        return { t: 'translate', target, toUpper, toLower, using, line }
      }
      case 'REPLACE': return this.parseReplace()
      case 'SHIFT': return this.parseShift()
      case 'FIND': return this.parseFind()
      case 'SEARCH': {
        // SEARCH s FOR x → map to find
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const inExpr = this.parseExprCursor(sub)
        let pattern: Expr | undefined
        if (sub.tryKw('FOR')) pattern = this.parseExprCursor(sub)
        return { t: 'find', in: inExpr, pattern: pattern ?? { t: 'str', v: '' }, line }
      }
      case 'PERFORM': return this.parsePerform()
      case 'CALL': return this.parseCall()
      case 'MESSAGE': return this.parseMessage()
      case 'RAISE': {
        const line = this.line()
        // RAISE EXCEPTION TYPE cls ... | RAISE EVENT ev EXPORTING ... | RAISE excname (in FM)
        if (c.isKw('EXCEPTION')) {
          c.next()
          let className = ''
          if (c.tryKw('TYPE')) className = c.expectIdent('exception class').upper
          else if (c.peek()?.type === 'STRING') className = 'CX_STATIC_CHECK'
          let message: Expr | undefined
          const exporting: CallArg[] = []
          let msgType: string | undefined
          if (c.tryKw('MESSAGE')) {
            const mt = c.peek()
            if (mt?.type === 'STRING') { message = { t: 'str', v: c.next().value } }
            else if (mt?.type === 'IDENT') { c.next(); message = this.parseExpr() }
            if (c.isKw('TYPE')) { c.next(); const tt = c.peek(); if (tt?.type === 'STRING') { msgType = c.next().value } else if (tt?.type === 'IDENT') { msgType = c.next().upper } }
          }
          if (c.tryKw('EXPORTING')) {
            for (;;) {
              const nt = c.peek()
              if (!nt || nt.type !== 'IDENT') break
              const name = c.next().upper
              c.expectPunc('=')
              const val = this.parseExpr()
              exporting.push({ name, value: val })
              if (c.isPunc(',')) { c.next(); continue }
              break
            }
          }
          c.rawStatement()
          if (!className) className = 'CX_STATIC_CHECK'
          return { t: 'raiseexception', className, exporting, message, msgType, line }
        }
        // RAISE EVENT ev [EXPORTING a = b ...].
        if (c.isKw('EVENT')) {
          c.next()
          const evName = c.expectIdent('event name').upper
          const exporting: CallArg[] = []
          if (c.tryKw('EXPORTING')) {
            for (;;) {
              const nt = c.peek()
              if (!nt || nt.type !== 'IDENT') break
              const name = c.next().upper
              c.expectPunc('=')
              const val = this.parseExpr()
              exporting.push({ name, value: val })
              if (c.isPunc(',')) { c.next(); continue }
              break
            }
          }
          c.rawStatement()
          return { t: 'raiseevent', event: evName, exporting, line }
        }
        // RAISE <exception> (inside function modules)
        const excName = c.peek()?.upper ?? ''
        c.rawStatement()
        if (excName) return { t: 'raiseexception', className: excName, exporting: [], line }
        return null
      }
      case 'CREATE': return this.parseCreate()
      case 'GET': {
        const line = this.line()
        // GET TIME / GET RUN TIME FIELD f / GET BIT...: only support TIME & RUN TIME
        if (c.isKw('TIME')) {
          c.next()
          const st = c.rawStatement() ?? []
          const sub = new Cursor(st)
          let target: Expr | undefined
          if (sub.tryKw('STAMP')) { sub.tryKw('FIELD'); target = sub.peek() ? this.parseExprCursor(sub) : undefined }
          else if (sub.peek()) target = this.parseExprCursor(sub)
          return { t: 'gettime', target, line }
        }
        if (c.isKw('RUN') && c.isKw('TIME', 1)) {
          c.next(); c.next()
          const st = c.rawStatement() ?? []
          const sub = new Cursor(st)
          if (sub.tryKw('FIELD')) {
            const target = this.parseExprCursor(sub)
            return { t: 'getruntime', target, line }
          }
          return null
        }
        c.rawStatement()
        return null
      }
      case 'SET': return this.parseSet()
      case 'TRY': return this.parseTry()
      case 'SELECT': return this.parseSelect()
      case 'UPDATE': return this.parseUpdateDb()
      case 'INSERT': return this.parseInsert() // unreachable (INSERT handled above); safety
      case 'COMMIT': {
        c.rawStatement()
        return { t: 'commit', work: true, line: this.line() }
      }
      case 'ROLLBACK': { c.rawStatement(); return null }
      case 'WAIT': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        let seconds: Expr | undefined
        if (sub.tryKw('UP')) { sub.tryKw('TO'); if (sub.peek()?.type === 'NUMBER') seconds = { t: 'num', v: parseFloat(sub.next().value), raw: '' } }
        return { t: 'wait', seconds, line }
      }
      case 'LEAVE': {
        const line = this.line()
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        if (sub.tryKw('TO')) {
          if (sub.tryKw('CURRENT')) { sub.tryKw('STATE'); sub.tryKw('TRANSACTION') ; return { t: 'leave', line } }
          sub.tryKw('TRANSACTION')
          const name: Expr = sub.peek() ? this.parseExprCursor(sub) : { t: 'str', v: '' }
          return { t: 'leave', toTransaction: name, line }
        }
        if (sub.tryKw('LIST-PROCESSING')) { sub.tryKw('AND'); sub.tryKw('RETURN'); sub.tryKw('TO'); sub.tryKw('SCREEN'); return { t: 'leave', toListProcessing: true, line } }
        sub.tryKw('SCREEN')
        sub.tryKw('PROGRAM')
        return { t: 'leave', line }
      }
      case 'AUTHORITY-CHECK': { c.rawStatement(); return { t: 'authoritycheck', line: this.line() } }
      case 'SUBMIT': { c.rawStatement(); return { t: 'submit', name: { t: 'str', v: '' }, line: this.line() } }
      case 'ASSERT': { c.rawStatement(); return null }
      case 'UNASSIGN': {
        const st = c.rawStatement() ?? []
        const sub = new Cursor(st)
        const fs = this.parseExprCursor(sub)
        return { t: 'unassign', fs }
      }
      case 'STATICS': return this.parseDeclaration('STATICS', 'local')
      case 'ENHANCEMENT': case 'ENDENHANCEMENT': { c.rawStatement(); return null }
      case 'AT': {
        // AT FIRST/LAST/NEW f — group loops; treat as no-op boundary
        c.rawStatement()
        return null
      }
      case 'ENDAT': { c.rawStatement(); return null }
      case 'SUM': { c.rawStatement(); return null }
      case 'TOP-OF-PAGE': case 'END-OF-PAGE': { c.rawStatement(); return null }
      case 'WHEN': case 'ELSE': case 'ENDIF': case 'ENDCASE': case 'ENDDO': case 'ENDWHILE': case 'ENDLOOP': case 'ENDFORM': case 'ENDFUNCTION': case 'ENDCLASS': case 'ENDINTERFACE': case 'ENDMETHOD': case 'ENDTRY': case 'CATCH': case 'CLEANUP': case 'ELSEIF': case 'OTHERS': {
        c.err(`Unexpected ${kw}`)
        return null
      }
      case 'SELECT-': case 'WITH': { c.rawStatement(); return null }
      default: {
        // unknown statement: could be assignment or method call expression
        c.pos-- // unconsume keyword token
        if (comp) c.pos -= 1 // rough
        return this.parseExpressionStatement()
      }
    }
  }

  // assignment or method-call statement: starts with IDENT / <fs> etc.
  private parseExpressionStatement(): Stmt | null {
    const line = this.line()
    const save = this.c.pos
    try {
      // parse only the target chain (var / member / index / call) — stops before operators
      const target = this.parseTargetExpr(this.c)
      if (this.c.isPunc('=') || this.c.isPunc('?=')) {
        this.c.next()
        const rhs = this.parseExpr()
        this.c.expectPunc('.', 'after assignment')
        return { t: 'compute', target, expr: rhs, op: '=', line }
      }
      this.c.expectPunc('.', 'after statement')
      if (target.t === 'call' || target.t === 'member' || target.t === 'inlinedecl') return { t: 'methodcallexpr', expr: target, line }
      return { t: 'expr', expr: target, line }
    } catch (e) {
      // restore and skip statement
      this.c.pos = save
      this.c.rawStatement()
      return null
    }
  }

  // restricted expression parse for assignment targets: primary + postfix chains only
  private parseTargetExpr(c: Cursor): Expr {
    return this.parsePostfix(c)
  }

  // ── WRITE ───────────────────────────────────────────────────────────
  private parseWrite(): Stmt {
    const line = this.line()
    const stmt: any = { t: 'write', items: [], line }
    const parseItem = () => {
      let item: any = { expr: undefined }
      // position spec / newline
      let slash = false
      let col: Expr | undefined
      let len: Expr | undefined
      const c = this.c
      // leading '/' before AT or expr
      if (c.isPunc('/')) { c.next(); slash = true }
      if (c.tryKw('AT')) {
        if (c.isPunc('/')) { c.next(); slash = true }
        // position: number or simple variable (NOT followed by '(' which is the length spec)
        if (c.peek()?.type === 'NUMBER') {
          col = { t: 'num', v: parseFloat(c.next().value), raw: '' }
        } else if (c.peek()?.type === 'IDENT') {
          col = { t: 'var', name: c.next().upper }
        } else if (c.isPunc('(')) {
          c.next()
          col = this.parseExpr()
          c.expectPunc(')')
        }
        if (c.isPunc('(')) {
          c.next()
          if (c.peek()?.type === 'NUMBER') len = { t: 'num', v: parseFloat(c.next().value), raw: '' }
          else len = this.parseExpr()
          c.expectPunc(')')
        }
      }
      item.expr = this.parseExpr()
      // formatting additions
      for (;;) {
        const t = c.peek()
        if (!t || t.type !== 'IDENT') break
        const u = t.upper
        if (u === 'COLOR') {
          c.next()
          if (c.peek()?.type === 'NUMBER') item.color = c.next().value
          else if (c.peek()?.type === 'IDENT') item.color = c.next().upper
          if (c.tryKw('ON')) item.colorOn = true
          else if (c.tryKw('OFF')) item.colorOn = false
          else item.colorOn = true
        } else if (u === 'INTENSIFIED') { c.next(); item.intensified = c.tryKw('ON') ? 'on' : c.tryKw('OFF') ? 'off' : 'on' }
        else if (u === 'INVERSE') { c.next(); item.inverse = c.tryKw('ON') ? 'on' : c.tryKw('OFF') ? 'off' : 'on' }
        else if (u === 'HOTSPOT') { c.next(); item.hotspot = c.tryKw('ON') ? 'on' : c.tryKw('OFF') ? 'off' : 'on' }
        else if (u === 'INPUT') { c.next(); c.tryKw('ON'); c.tryKw('OFF'); item.input = true }
        else if (u === 'NO-GAP') { c.next(); item.noGap = true }
        else if (u === 'NO-ZERO') { c.next(); item.noZero = true }
        else if (u === 'NO-SIGN') { c.next(); item.noSign = true }
        else if (u === 'UNDER') { c.next(); this.parseExpr() }
        else if (u === 'RIGHT-JUSTIFIED') { c.next(); item.justified = 'right' }
        else if (u === 'LEFT-JUSTIFIED') { c.next(); item.justified = 'left' }
        else if (u === 'CENTERED') { c.next(); item.justified = 'center' }
        else if (u === 'UNDERSCORE' || u === 'LINE') { c.next() }
        else if (u === 'USING') { c.next(); c.tryKw('EDIT'); c.tryKw('MASK'); this.parseExpr() }
        else if (u === 'AS') { c.next(); c.tryKw('ICON'); c.tryKw('SYMBOL'); c.tryKw('LINE'); c.tryKw('CHECKBOX') }
        else if (u === 'EXPONENT' || u === 'ROUND' || u === 'DECIMALS' || u === 'UNIT' || u === 'CURRENCY' || u === 'TIME') {
          c.next()
          this.parseExpr()
        }
        else if (u === 'DD/MM/YY' || u === 'MM/DD/YY' || u === 'DD/MM/YYYY' || u === 'MM/DD/YYYY' || u === 'YYMMDD' || u === 'ISO') { c.next() }
        else break
      }
      item.newline = slash
      if (col !== undefined || len !== undefined) item.pos = { col, len }
      return item
    }
    // WRITE [/][AT pos] ...
    this.c.tryPunc(':')
    stmt.items.push(parseItem())
    while (this.c.isPunc(',')) {
      this.c.next()
      stmt.items.push(parseItem())
    }
    this.c.expectPunc('.', 'after WRITE')
    return stmt
  }

  private parsePosTokens(toks: Token[]): PosSpec | undefined {
    const sub = new Cursor(toks)
    let col: Expr | undefined
    let len: Expr | undefined
    if (sub.isPunc('/')) sub.next()
    if (sub.tryKw('AT')) {
      if (sub.isPunc('/')) sub.next()
      if (sub.peek()?.type === 'NUMBER') col = { t: 'num', v: parseFloat(sub.next().value), raw: '' }
      else if (sub.peek()?.type === 'IDENT') col = { t: 'var', name: sub.next().upper }
      if (sub.isPunc('(')) {
        sub.next()
        if (sub.peek()?.type === 'NUMBER') len = { t: 'num', v: parseFloat(sub.next().value), raw: '' }
        sub.tryPunc(')')
      }
    }
    if (col === undefined && len === undefined) return undefined
    return { col, len }
  }

  // ── control flow ────────────────────────────────────────────────────
  private parseIf(): Stmt {
    const branches: { cond: Expr; body: Stmt[] }[] = []
    const cond = this.parseExpr()
    this.c.expectPunc('.', 'after IF condition')
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDIF') || this.c.isKw('ELSE') || this.c.isKw('ELSEIF'))
    branches.push({ cond, body })
    let elseBody: Stmt[] = []
    for (;;) {
      if (this.c.isKw('ELSEIF')) {
        const toks = this.c.rawStatementTokens().filter((t) => t.upper !== 'ELSEIF')
        const sub = new Cursor(toks)
        const c2 = this.parseExprCursor(sub)
        const body2: Stmt[] = []
        this.parseBodyUntil(body2, () => this.c.isKw('ENDIF') || this.c.isKw('ELSE') || this.c.isKw('ELSEIF'))
        branches.push({ cond: c2, body: body2 })
        continue
      }
      if (this.c.isKw('ELSE')) {
        this.c.rawStatement()
        this.parseBodyUntil(elseBody, () => this.c.isKw('ENDIF'))
        continue
      }
      if (this.c.isKw('ENDIF')) {
        this.c.rawStatement()
        break
      }
      break
    }
    return { t: 'if', branches, elseBody }
  }

  private parseCase(): Stmt {
    const subject = this.parseExpr()
    this.c.expectPunc('.', 'after CASE')
    const whens: { values: Expr[]; body: Stmt[] }[] = []
    let others: Stmt[] | undefined
    while (!this.c.atEnd()) {
      if (this.c.isKw('ENDCASE')) { this.c.rawStatement(); break }
      if (this.c.isKw('WHEN')) {
        this.c.next()
        const values: Expr[] = []
        for (;;) {
          values.push(this.parseExpr())
          if (this.c.tryKw('OR')) continue
          break
        }
        if (this.c.tryKw('OTHERS')) { /* handled below */ }
        this.c.expectPunc('.', 'after WHEN')
        const body: Stmt[] = []
        let isOthers = false
        if (values.length === 1 && values[0].t === 'var' && (values[0] as any).name === 'OTHERS') isOthers = true
        this.parseBodyUntil(body, () => this.c.isKw('WHEN') || this.c.isKw('ENDCASE'))
        if (isOthers) others = body
        else whens.push({ values, body })
        continue
      }
      this.c.rawStatement()
    }
    return { t: 'case', subject, whens, others }
  }

  private parseDo(): Stmt {
    let times: Expr | undefined
    // DO [n TIMES] [VARYING x FROM a NEXT b].
    if (this.c.peek()?.type === 'NUMBER' && this.c.isKw('TIMES', 1)) {
      times = { t: 'num', v: parseFloat(this.c.next().value), raw: '' }
      this.c.next()
    } else if (this.c.peek()?.type === 'IDENT' && !this.c.isPunc('.')) {
      // VARYING or expr TIMES
      const save = this.c.pos
      if (this.c.isKw('VARYING')) {
        // consume until '.'
        this.c.rawStatement()
      } else {
        this.c.pos = save
        try {
          const e = this.parseExpr()
          if (this.c.tryKw('TIMES')) {
            times = e
            this.c.expectPunc('.', 'after DO')
          } else {
            this.c.expectPunc('.', 'after DO')
          }
        } catch {
          this.c.pos = save
          this.c.rawStatement()
        }
      }
    } else {
      this.c.rawStatement()
    }
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDDO'))
    this.c.rawStatement()
    return { t: 'do', times, body }
  }

  private parseWhile(): Stmt {
    const cond = this.parseExpr()
    this.c.expectPunc('.', 'after WHILE')
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDWHILE'))
    this.c.rawStatement()
    return { t: 'while', cond, body }
  }

  private parseLoop(): Stmt {
    const line = this.line()
    // LOOP AT it [INTO wa | ASSIGNING <fs> | REFERENCE INTO r] [FROM i TO j] [WHERE cond] [GROUP BY...].
    let table: Expr = { t: 'var', name: '' }
    let into: Expr | undefined
    let assigning: Expr | undefined
    let referenceInto: Expr | undefined
    let where: Expr | undefined
    let from: Expr | undefined
    let to: Expr | undefined
    if (this.c.tryKw('AT')) {
      table = this.parseExpr()
    } else {
      // LOOP AT GROUP ... etc — tolerate
      this.c.rawStatement()
      const body: Stmt[] = []
      this.parseBodyUntil(body, () => this.c.isKw('ENDLOOP'))
      this.c.rawStatement()
      return { t: 'loop', table, body, line }
    }
    for (;;) {
      if (this.c.isPunc('.')) { this.c.next(); break }
      if (this.c.tryKw('INTO')) {
        // INTO wa — but careful: INTO TABLE not in loops
        into = this.parseExpr()
      } else if (this.c.tryKw('ASSIGNING')) {
        assigning = this.parseExpr()
      } else if (this.c.isKw('REFERENCE') && this.c.isKw('INTO', 1)) {
        this.c.next(); this.c.next()
        referenceInto = this.parseExpr()
      } else if (this.c.tryKw('FROM')) {
        from = this.parseExpr()
      } else if (this.c.tryKw('TO')) {
        to = this.parseExpr()
      } else if (this.c.tryKw('WHERE')) {
        where = this.parseExpr()
      } else if (this.c.isKw('GROUP') && this.c.isKw('BY', 1)) {
        // skip group by clause
        this.c.next(); this.c.next()
        let depth = 0
        while (!this.c.atEnd()) {
          const t = this.c.cur!
          if (t.value === '(') depth++
          if (t.value === ')') depth--
          if (t.value === '.' && depth <= 0) break
          this.c.next()
        }
      } else if (this.c.tryKw('ASSIGNED')) {
      } else if (this.c.tryKw('TRANSPORTING')) {
        while (!this.c.isPunc('.') && !this.c.atEnd()) this.c.next()
      } else {
        this.c.next()
      }
    }
    const body: Stmt[] = []
    this.parseBodyUntil(body, () => this.c.isKw('ENDLOOP'))
    this.c.rawStatement()
    return { t: 'loop', table, into, assigning, referenceInto, where, from, to, body, line }
  }

  // ── internal table ops ──────────────────────────────────────────────
  private parseAppend(): Stmt {
    const line = this.line()
    let src: Expr | undefined
    let table: Expr | undefined
    let initialLine = false
    let linesOf: Expr | undefined
    let assigning: Expr | undefined
    let sortedBy: Expr | undefined
    let c = this.c
    // APPEND [wa TO | INITIAL LINE TO | LINES OF it1 TO] it2 [ASSIGNING <fs>] [SORTED BY f]
    if (c.isKw('INITIAL') && c.isKw('LINE', 1)) {
      c.next(); c.next()
      initialLine = true
      if (c.tryKw('TO')) table = this.parseExpr()
    } else if (c.isKw('LINES') && c.isKw('OF', 1)) {
      c.next(); c.next()
      linesOf = this.parseExpr()
      if (c.tryKw('TO')) table = this.parseExpr()
    } else {
      src = this.parseExpr()
      if (c.tryKw('TO')) table = this.parseExpr()
      else if (c.isPunc('.')) {
        // APPEND it. → append initial line of it (header line semantics) — treat table=src
        table = src
        src = undefined
      }
    }
    if (c.tryKw('ASSIGNING')) assigning = this.parseExpr()
    if (c.isKw('SORTED') && c.isKw('BY', 1)) {
      c.next(); c.next()
      sortedBy = this.parseExpr()
      if (c.tryKw('DESCENDING')) { /* tolerate */ }
    }
    if (c.isKw('TO')) { c.next(); table = this.parseExpr() }
    c.expectPunc('.', 'after APPEND')
    return { t: 'append', src, table: table ?? src!, initialLine, linesOf, assigning, sortedBy, line }
  }

  private parseInsert(): Stmt {
    const line = this.line()
    const c = this.c
    // forms:
    // INSERT wa INTO TABLE it. | INSERT wa INTO it INDEX n. | INSERT INITIAL LINE INTO TABLE it
    // INSERT LINES OF it1 INTO TABLE it2 | INSERT dbtab FROM wa. | INSERT dbtab FROM TABLE it.
    // INSERT INTO dbtab VALUES wa.
    // Detect: INSERT INTO → db insert with VALUES, or internal INTO TABLE it
    let src: Expr | undefined
    let table: Expr | undefined
    let index: Expr | undefined
    let initialLine = false
    let linesOf: Expr | undefined
    let assign: Expr | undefined
    let fromTable = false
    let isDb = false
    let dbTable = ''
    // Peek pattern
    const isIntoStart = c.isKw('INTO')
    if (isIntoStart) {
      // INSERT INTO dbtab VALUES wa. (classic db) — or INSERT INTO it INDEX?
      c.next()
      const nameTok = c.expectIdent('table')
      if (c.isKw('VALUES')) {
        c.next()
        const val = this.parseExpr()
        c.expectPunc('.', 'after INSERT')
        return { t: 'insertdb', table: nameTok.upper, src: val, line }
      }
      // internal: INSERT INTO it INDEX n ... → treat nameTok as table with following options
      table = { t: 'var', name: nameTok.upper }
      // continue generic option parsing below
      this.parseInsertOptions(c, { getTable: () => table, setTable: (e) => (table = e), setIndex: (e) => (index = e), setAssign: (e) => (assign = e) })
      c.expectPunc('.', 'after INSERT')
      return { t: 'insert', src: undefined, table: table!, index, linesOf, initialLine, assign, line }
    }
    if (c.isKw('INITIAL') && c.isKw('LINE', 1)) {
      c.next(); c.next()
      initialLine = true
      if (c.tryKw('INTO')) {
        if (c.tryKw('TABLE')) table = this.parseExpr()
        else {
          table = this.parseExpr()
        }
      }
    } else if (c.isKw('LINES') && c.isKw('OF', 1)) {
      c.next(); c.next()
      linesOf = this.parseExpr()
      if (c.tryKw('INTO')) {
        c.tryKw('TABLE')
        table = this.parseExpr()
      }
    } else {
      src = this.parseExpr()
      if (c.isKw('FROM')) {
        // INSERT dbtab FROM wa / FROM TABLE it
        isDb = true
        dbTable = (src as any).name ?? ''
        if (c.tryKw('TABLE')) {
          fromTable = true
          const src2 = this.parseExpr()
          c.expectPunc('.', 'after INSERT')
          return { t: 'insertdb', table: dbTable, src: src2, fromTable, line }
        }
        const src2 = this.parseExpr()
        c.expectPunc('.', 'after INSERT')
        return { t: 'insertdb', table: dbTable, src: src2, line }
      }
      if (c.tryKw('INTO')) {
        if (c.tryKw('TABLE')) {
          table = this.parseExpr()
        } else {
          table = this.parseExpr()
          if (c.tryKw('INDEX')) index = this.parseExpr()
        }
      } else {
        // INSERT it. → header-line style; table = src
        table = src
        src = undefined
      }
    }
    if (c.tryKw('ASSIGNING')) assign = this.parseExpr()
    if (c.tryKw('INDEX')) index = this.parseExpr()
    c.expectPunc('.', 'after INSERT')
    return { t: 'insert', src, table: table!, index, linesOf, initialLine, assign, line }
  }

  private parseInsertOptions(c: Cursor, h: { getTable(): Expr | undefined; setTable(e: Expr): void; setIndex(e: Expr): void; setAssign(e: Expr): void }) {
    // parse remaining options: [INDEX n] [ASSIGNING <fs>]
    for (;;) {
      if (c.isPunc('.')) { c.next(); return }
      if (c.tryKw('INDEX')) { h.setIndex(this.parseExpr()); continue }
      if (c.tryKw('ASSIGNING')) { h.setAssign(this.parseExpr()); continue }
      if (c.atEnd()) return
      c.next()
    }
  }

  private parseReadTable(): Stmt {
    const line = this.line()
    const c = this.c
    // READ TABLE it INTO wa INDEX n | WITH KEY k = v | WITH TABLE KEY k = v [BINARY SEARCH] [COMPARING...] [TRANSPORTING...]
    // also READ TABLE it ASSIGNING <fs> ...
    if (!c.tryKw('TABLE')) {
      // READ REPORT etc.
      c.rawStatement()
      return { t: 'datainfo', raw: 'READ ...', line }
    }
    const table = this.parseExpr()
    let into: Expr | undefined
    let assigning: Expr | undefined
    let index: Expr | undefined
    let withKey: { comps: { name: string; value: Expr }[]; simple?: Expr } | undefined
    let binarySearch = false
    let comparing: string[] | undefined
    let transporting: string[] | undefined
    let referenceInto: Expr | undefined
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('INTO')) {
        // INTO wa — but READ TABLE it INTO wa: expr may be followed by FROM/INDEX...
        into = this.parseExpr()
      } else if (c.tryKw('ASSIGNING')) {
        assigning = this.parseExpr()
      } else if (c.isKw('REFERENCE') && c.isKw('INTO', 1)) {
        c.next(); c.next()
        referenceInto = this.parseExpr()
      } else if (c.tryKw('INDEX')) {
        index = this.parseExpr()
      } else if (c.isKw('WITH')) {
        c.next()
        if (c.tryKw('TABLE')) c.tryKw('KEY')
        else if (c.tryKw('KEY')) { /* ok */ }
        // simple WITH KEY = value | WITH KEY comp = value comp2 = value2
        if (c.isPunc('=')) {
          c.next()
          const value = this.parseExpr()
          withKey = { comps: [], simple: value }
        } else {
          const comps: { name: string; value: Expr }[] = []
          for (;;) {
            const nt = c.peek()
            if (!nt || nt.type !== 'IDENT') break
            const name = c.next().upper
            // COMPONENTS name = value
            if (name === 'COMPONENTS') {
              const ct = c.peek()
              if (ct && ct.type === 'IDENT') {
                const cname = c.next().upper
                c.expectPunc('=')
                const v = this.parseExpr()
                comps.push({ name: cname, value: v })
                if (c.isPunc('AND')) { c.next(); continue }
                continue
              }
              continue
            }
            c.expectPunc('=')
            const v = this.parseExpr()
            comps.push({ name, value: v })
            if (c.isKw('AND')) { c.next(); continue }
            break
          }
          withKey = { comps }
        }
      } else if (c.isKw('BINARY') && c.isKw('SEARCH', 1)) {
        c.next(); c.next()
        binarySearch = true
      } else if (c.tryKw('COMPARING')) {
        comparing = []
        for (;;) {
          const t = c.peek()
          if (!t || t.type !== 'IDENT') break
          comparing.push(c.next().upper)
          if (c.isKw('ALL')) { c.next(); c.tryKw('FIELDS') }
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
      } else if (c.tryKw('TRANSPORTING')) {
        transporting = []
        for (;;) {
          const t = c.peek()
          if (!t || t.type !== 'IDENT') break
          transporting.push(c.next().upper)
          if (c.isKw('ALL')) { c.next(); c.tryKw('FIELDS'); break }
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
      } else {
        c.next()
      }
    }
    return { t: 'readtable', table, into, assigning, index, withKey, binarySearch, comparing, transporting, line }
  }

  private parseModify(): Stmt {
    const line = this.line()
    const c = this.c
    // MODIFY it FROM wa [INDEX n] [TRANSPORTING f1 f2] [WHERE cond]
    // MODIFY it FROM wa TRANSPORTING f WHERE...
    // MODIFY dbtab FROM wa / FROM TABLE it
    // MODIFY SCREEN / CURRENT LINE — skip
    if (c.isKw('SCREEN') || c.isKw('CURRENT')) {
      c.rawStatement()
      return { t: 'datainfo', raw: 'MODIFY SCREEN/LINE', line }
    }
    // first expression = target
    const table = this.parseExpr()
    if (c.tryKw('FROM')) {
      const src = this.parseExpr()
      if (c.tryKw('TABLE')) {
        c.expectPunc('.', 'after MODIFY')
        return { t: 'modifydb', table: (table as any).name ?? '', src, fromTable: true, line }
      }
      let index: Expr | undefined
      let where: Expr | undefined
      let transporting: string[] | undefined
      for (;;) {
        if (c.isPunc('.')) { c.next(); break }
        if (c.tryKw('INDEX')) { index = this.parseExpr(); continue }
        if (c.tryKw('WHERE')) { where = this.parseExpr(); continue }
        if (c.tryKw('TRANSPORTING')) {
          transporting = []
          for (;;) {
            const t = c.peek()
            if (!t || t.type !== 'IDENT') break
            transporting.push(c.next().upper)
            if (c.isPunc(',')) { c.next(); continue }
            break
          }
          continue
        }
        c.next()
      }
      // DB modify if table is a db table name (var with no runtime binding decided at runtime)
      const name = (table as any).name
      if (name && /^[szt]/i.test(name) && !name.includes('_') === false) {
        // heuristics are unreliable — decide at runtime: emit special stmt that tries itab first then db
      }
      return { t: 'modifyitab', table, src, index, where, transporting, line }
    }
    // MODIFY it [INDEX n] [FROM wa]... unlikely; finish statement
    c.expectPunc('.', 'after MODIFY')
    return { t: 'modifyitab', table, src: table, line }
  }

  private parseDelete(): Stmt {
    const line = this.line()
    const c = this.c
    if (c.isKw('ADJACENT')) {
      // handled in itab path below
    }
    // forms: DELETE it [INDEX n | WHERE cond | FROM i TO j | ADJACENT DUPLICATES [COMPARING...]]
    //        DELETE TABLE it WITH KEY... | DELETE dbtab FROM wa | DELETE FROM dbtab WHERE...
    // detect "DELETE FROM"
    if (c.isKw('FROM')) {
      c.next()
      const nameTok = c.expectIdent('table')
      let where: Expr | undefined
      for (;;) {
        if (c.isPunc('.')) { c.next(); break }
        if (c.tryKw('WHERE')) { where = this.parseExpr(); continue }
        c.next()
      }
      return { t: 'deletedb', table: nameTok.upper, where, line }
    }
    if (c.isKw('TABLE')) {
      c.next()
      // DELETE TABLE it [WITH KEY ...] [FROM ...]
      const table = this.parseExpr()
      let where: Expr | undefined
      let index: Expr | undefined
      for (;;) {
        if (c.isPunc('.')) { c.next(); break }
        if (c.tryKw('WITH')) {
          c.tryKw('KEY')
          const comps: { name: string; value: Expr }[] = []
          for (;;) {
            const nt = c.peek()
            if (!nt || nt.type !== 'IDENT') break
            const nm = c.next().upper
            c.expectPunc('=')
            comps.push({ name: nm, value: this.parseExpr() })
            if (c.isKw('AND')) { c.next(); continue }
            break
          }
          where = comps.length
            ? comps.map((x) => ({ t: 'binop', op: '=', l: { t: 'var', name: x.name } as Expr, r: x.value } as Expr)).reduce((a, b) => ({ t: 'binop', op: 'AND', l: a, r: b } as Expr))
            : undefined
          continue
        }
        if (c.tryKw('INDEX')) { index = this.parseExpr(); continue }
        c.next()
      }
      return { t: 'deleteitab', table, where, index, line }
    }
    // internal table or dbtab FROM wa
    const table = this.parseExpr()
    if (c.isKw('FROM') && !c.isKw('TABLE', 1)) {
      // could be "DELETE dbtab FROM wa" — db tables are all-caps SAP names; decide at runtime
      // For db: DELETE sflight FROM wa.
      const isDbCandidate = table.t === 'var' && /^[A-Z][A-Z0-9]{3,}$/.test((table as any).name) && !this.looksLikeItab((table as any).name)
      if (isDbCandidate) {
        c.next()
        const src = this.parseExpr()
        if (c.tryKw('TABLE')) {
          c.expectPunc('.', 'after DELETE')
          return { t: 'deletedb', table: (table as any).name, src, fromTable: true, line }
        }
        c.expectPunc('.', 'after DELETE')
        return { t: 'deletedb', table: (table as any).name, src, line }
      }
    }
    // DELETE it [INDEX n] [FROM i] [TO j] [WHERE cond] [ADJACENT DUPLICATES [COMPARING f...]]
    let index: Expr | undefined
    let where: Expr | undefined
    let from: Expr | undefined
    let to: Expr | undefined
    let adjacentDuplicates = false
    let comparing: string[] | undefined
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('INDEX')) { index = this.parseExpr(); continue }
      if (c.isKw('FROM') && !c.isKw('TABLE', 1)) { c.next(); from = this.parseExpr(); continue }
      if (c.isKw('ADJACENT')) {
        c.next()
        c.tryKw('DUPLICATES')
        c.tryKw('FROM')
        adjacentDuplicates = true
        continue
      }
      if (c.tryKw('COMPARING')) {
        comparing = []
        for (;;) {
          const t = c.peek()
          if (!t || t.type !== 'IDENT') break
          comparing.push(c.next().upper)
          if (c.isKw('ALL')) { c.next(); c.tryKw('FIELDS'); break }
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
        continue
      }
      if (c.tryKw('TO')) { to = this.parseExpr(); continue }
      if (c.tryKw('WHERE')) { where = this.parseExpr(); continue }
      c.next()
    }
    return { t: 'deleteitab', table, index, where, from, to, adjacentDuplicates, comparing, line }
  }

  private looksLikeItab(name: string): boolean {
    return /^(IT_|LT_|GT_|<)/i.test(name) || /(ITAB|TABLE)$/i.test(name)
  }

  private parseSort(): Stmt {
    const line = this.line()
    const c = this.c
    // SORT it [ASCENDING|DESCENDING] [AS TEXT] [STABLE] [BY f1 [ASC|DESC] f2 ...]
    const table = this.parseExpr()
    let defaultDir: 'asc' | 'desc' = 'asc'
    let asText = false
    let stable = false
    const by: { expr: Expr; dir: 'asc' | 'desc' }[] = []
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('ASCENDING')) { defaultDir = 'asc'; continue }
      if (c.tryKw('DESCENDING')) { defaultDir = 'desc'; continue }
      if (c.isKw('AS') && c.isKw('TEXT', 1)) { c.next(); c.next(); asText = true; continue }
      if (c.tryKw('STABLE')) { stable = true; continue }
      if (c.tryKw('BY')) {
        for (;;) {
          const t = c.peek()
          if (!t || t.type !== 'IDENT') break
          if (t.upper === 'ASCENDING' || t.upper === 'DESCENDING') break
          const e = this.parseExpr()
          let dir = defaultDir
          if (c.tryKw('ASCENDING')) dir = 'asc'
          else if (c.tryKw('DESCENDING')) dir = 'desc'
          else if (c.tryKw('AS')) { c.tryKw('TEXT') }
          by.push({ expr: e, dir })
          if (c.isPunc(',')) { c.next(); continue }
        }
        continue
      }
      c.next()
    }
    return { t: 'sort', table, by, defaultDir, asText, stable, line }
  }

  private parseDescribe(): Stmt {
    const line = this.line()
    const c = this.c
    // DESCRIBE TABLE it [LINES n] [KIND k] [OCCURS n] | DESCRIBE FIELD f LENGTH n ...
    if (c.tryKw('FIELD')) {
      c.rawStatement()
      return { t: 'datainfo', raw: 'DESCRIBE FIELD', line }
    }
    c.tryKw('TABLE')
    const table = this.parseExpr()
    let linesInto: Expr | undefined
    let kindInto: Expr | undefined
    let occursInto: Expr | undefined
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('LINES')) { linesInto = this.parseExpr(); continue }
      if (c.tryKw('KIND')) { kindInto = this.parseExpr(); continue }
      if (c.tryKw('OCCURS')) { occursInto = this.parseExpr(); continue }
      c.next()
    }
    return { t: 'describe', table, linesInto, kindInto, occursInto, line }
  }

  // ── string ops ──────────────────────────────────────────────────────
  private parseConcatenate(): Stmt {
    const line = this.line()
    const c = this.c
    const sources: Expr[] = []
    for (;;) {
      const t = c.peek()
      if (!t) break
      if (t.type === 'IDENT') {
        const u = t.upper
        if (u === 'INTO' || u === 'SEPARATED' || u === 'LINES' || u === 'RESPECTING') break
      }
      if (t.type === 'PUNCT' && (t.value === '.' || t.value === ',')) break
      sources.push(this.parseExpr())
      if (c.isPunc(',')) { c.next(); continue }
      // continue if next token starts another source (IDENT / STRING / TEMPLATE / '(')
      const nt = c.peek()
      if (nt && (nt.type === 'IDENT' || nt.type === 'STRING' || nt.type === 'TEMPLATE' || (nt.type === 'PUNCT' && nt.value === '('))) {
        const u = nt.type === 'IDENT' ? nt.upper : ''
        if (!['INTO', 'SEPARATED', 'LINES', 'RESPECTING'].includes(u)) continue
      }
      break
    }
    let into: Expr | undefined
    let separatedBy: Expr | undefined
    let linesOf: Expr | undefined
    let respectingBlanks = false
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('INTO')) {
        into = this.parseExpr()
        continue
      }
      if (c.isKw('SEPARATED') && c.isKw('BY', 1)) {
        c.next(); c.next()
        separatedBy = this.parseExpr()
        continue
      }
      if (c.isKw('LINES') && c.isKw('OF', 1)) {
        c.next(); c.next()
        linesOf = this.parseExpr()
        continue
      }
      if (c.isKw('RESPECTING') && c.isKw('BLANKS', 1)) {
        c.next(); c.next()
        respectingBlanks = true
        continue
      }
      c.next()
    }
    return { t: 'concatenate', sources, into: into!, separatedBy, linesOf, respectingBlanks, line }
  }

  private parseSplit(): Stmt {
    const line = this.line()
    const c = this.c
    const src = this.parseExpr()
    c.tryKw('AT')
    const at = this.parseExpr()
    const targets: Expr[] = []
    let intoTable: Expr | undefined
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('INTO')) {
        if (c.tryKw('TABLE')) {
          intoTable = this.parseExpr()
          continue
        }
        // collect plain targets: INTO t1 t2 t3 ... (space separated)
        for (;;) {
          targets.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          const nt = c.peek()
          if (nt && nt.type === 'IDENT' && nt.upper !== 'TABLE') continue
          break
        }
        continue
      }
      c.next()
    }
    return { t: 'split', src, at, targets, intoTable, line }
  }

  private parseReplace(): Stmt {
    const line = this.line()
    const c = this.c
    let all = false
    let regex = false
    let pattern: Expr | undefined
    let inExpr: Expr | undefined
    let withExpr: Expr | undefined
    let target: Expr | undefined
    let ignoringCase = false
    // REPLACE [ALL OCCURRENCES OF] [SUBSTRING|REGEX] pat IN [SUBSTRING] s WITH w [IGNORING CASE]
    if (c.isKw('ALL')) {
      c.next(); c.tryKw('OCCURRENCES'); c.tryKw('OF')
      all = true
    }
    if (c.tryKw('REGEX')) regex = true
    else c.tryKw('SUBSTRING')
    pattern = this.parseExpr()
    if (c.tryKw('IN')) {
      c.tryKw('SUBSTRING')
      inExpr = this.parseExpr()
    }
    if (c.tryKw('WITH')) {
      withExpr = this.parseExpr()
    }
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.isKw('IGNORING') && c.isKw('CASE', 1)) { c.next(); c.next(); ignoringCase = true; continue }
      if (c.tryKw('REPLACEMENT')) { c.next(); if (c.isPunc('=')) { c.next(); this.parseExpr() } continue }
      if (c.isKw('LENGTH')) { c.next(); c.next(); if (c.isPunc('=')) { c.next(); this.parseExpr() } continue }
      if (c.tryKw('INTO')) { target = this.parseExpr(); continue }
      c.next()
    }
    if (!withExpr) withExpr = { t: 'str', v: '' }
    if (!inExpr && target) inExpr = target
    return { t: 'replace', all, pattern: pattern!, in: inExpr!, with: withExpr, ignoringCase, regex, line }
  }

  private parseShift(): Stmt {
    const line = this.line()
    const c = this.c
    const target = this.parseExpr()
    let dir: 'left' | 'right' | 'circular' = 'left'
    let places: Expr | undefined
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('LEFT')) { dir = 'left'; continue }
      if (c.tryKw('RIGHT')) { dir = 'right'; continue }
      if (c.tryKw('CIRCULAR')) { dir = 'circular'; continue }
      if (c.tryKw('BY')) { places = this.parseExpr(); c.tryKw('PLACES'); continue }
      if (c.tryKw('UP')) { c.tryKw('TO'); this.parseExpr(); continue }
      if (c.tryKw('TO')) { c.next(); continue } // TO LEFT/RIGHT - rare
      if (c.tryKw('DELETING')) { this.parseExpr(); continue }
      if (c.tryKw('IN')) { c.tryKw('BYTE'); c.tryKw('MODE'); continue }
      c.next()
    }
    return { t: 'shift', target, dir, places, line }
  }

  private parseFind(): Stmt {
    const line = this.line()
    const c = this.c
    let regex = false
    let all = false
    let inExpr: Expr | undefined
    let pattern: Expr | undefined
    const submatches: Expr[] = []
    let matchCount: Expr | undefined
    let matchOffset: Expr | undefined
    let matchLength: Expr | undefined
    if (c.isKw('ALL')) { c.next(); c.tryKw('OCCURRENCES'); c.tryKw('OF'); all = true }
    if (c.tryKw('REGEX')) regex = true
    else c.tryKw('SUBSTRING')
    pattern = this.parseExpr()
    if (c.tryKw('IN')) {
      inExpr = this.parseExpr()
    }
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      if (c.tryKw('MATCH')) {
        c.tryKw('COUNT')
        if (c.isPunc('=')) { c.next(); matchCount = this.parseExpr(); continue }
        c.tryKw('OFFSET')
        if (c.isPunc('=')) { c.next(); matchOffset = this.parseExpr(); continue }
        c.tryKw('LENGTH')
        if (c.isPunc('=')) { c.next(); matchLength = this.parseExpr(); continue }
        continue
      }
      if (c.tryKw('RESULTS')) { this.parseExpr(); continue }
      if (c.isKw('SUBMATCHES')) {
        c.next()
        for (;;) {
          const t = c.peek()
          if (!t || t.type !== 'IDENT') break
          submatches.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
        continue
      }
      c.next()
    }
    return { t: 'find', in: inExpr!, pattern: pattern!, regex, all, submatches, matchCount, matchOffset, matchLength, line }
  }

  // ── modularization ──────────────────────────────────────────────────
  private parsePerform(): Stmt {
    const line = this.line()
    const c = this.c
    const nameTok = c.expectIdent('form name')
    const name = nameTok.upper
    const using: Expr[] = []
    const changing: Expr[] = []
    const tables: Expr[] = []
    c.tryPunc('ON') // PERFORM ... ON COMMIT — tolerate
    for (;;) {
      if (c.isPunc('.')) { c.next(); break }
      const isArgStart = () => {
        const t = c.peek()
        if (!t) return false
        if (t.type === 'NUMBER' || t.type === 'STRING' || t.type === 'TEMPLATE') return true
        if (t.type === 'PUNCT' && (t.value === '-' || t.value === '(' || t.value === '@' || t.value === '<')) return true
        if (t.type === 'IDENT' && !['USING', 'CHANGING', 'TABLES', 'ON', 'IN', 'PROGRAM', 'COMMIT', 'ROLLBACK'].includes(t.upper)) return true
        return false
      }
      if (c.tryKw('USING')) {
        for (;;) {
          using.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          if (isArgStart()) continue
          break
        }
        continue
      }
      if (c.tryKw('CHANGING')) {
        for (;;) {
          changing.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          if (isArgStart()) continue
          break
        }
        continue
      }
      if (c.tryKw('TABLES')) {
        for (;;) {
          tables.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          if (isArgStart()) continue
          break
        }
        continue
      }
      if (c.isKw('IN')) { c.next(); c.tryKw('PROGRAM'); if (c.peek()?.type === 'IDENT' || c.peek()?.type === 'STRING') c.next(); continue }
      if (c.isKw('ON')) { c.next(); c.rawStatement(); return { t: 'perform', form: name, using, changing, tables, line } }
      c.next()
    }
    return { t: 'perform', form: name, using, changing, tables, line }
  }

  private parseCall(): Stmt | null {
    const c = this.c
    if (c.isKw('METHOD')) {
      c.next()
      // CALL METHOD [oref->|class=>]meth [EXPORTING...]
      let recv: Expr | undefined
      let sep: '->' | '=>' | '~' | undefined
      let name = ''
      const first = c.expectIdent('method name')
      if (c.isPunc('->') || c.isPunc('=>') || c.isPunc('~')) {
        sep = c.next().value as any
        name = c.expectIdent('method name').upper
        recv = { t: 'var', name: first.upper }
      } else {
        name = first.upper
      }
      const args: CallArg[] = []
      this.parseCallSections(c, args)
      return { t: 'callmethod', recv, sep, name, dynamicName: undefined, args, line: this.line() }
    }
    if (c.isKw('FUNCTION')) {
      c.next()
      const t = c.peek()
      if (!t || t.type !== 'STRING') {
        c.rawStatement()
        return null
      }
      const name = t.value.toUpperCase()
      c.next()
      const exporting: CallArg[] = []
      const importing: CallArg[] = []
      const changing: CallArg[] = []
      const tables: CallArg[] = []
      const exceptions: CallArg[] = []
      // parse sections until '.'
      const parseSec = (list: CallArg[]) => {
        for (;;) {
          const nt = c.peek()
          if (!nt || (nt.type !== 'IDENT' && nt.type !== 'PUNCT')) break
          if (c.isPunc('.')) { c.next(); return }
          if (c.isPunc(',')) { c.next(); continue }
          if (nt.type === 'IDENT' && ['EXPORTING', 'IMPORTING', 'CHANGING', 'TABLES', 'EXCEPTIONS'].includes(nt.upper)) break
          const nameTok = c.expectIdent('parameter')
          // VALUE(x) / dref = x / name = value / name
          let pname = nameTok.upper
          if (c.isKw('VALUE') && c.isPunc('(', 1)) {
            c.next(); c.next()
            pname = c.expectIdent('param').upper
            c.expectPunc(')')
          }
          if (c.isPunc('=')) {
            c.next()
            const val = this.parseExpr()
            list.push({ name: pname, value: val })
          } else {
            list.push({ name: pname, value: { t: 'var', name: pname } })
          }
          if (c.isPunc(',')) { c.next(); continue }
          if (c.isPunc('.')) return
          // next param name directly
          continue
        }
      }
      for (;;) {
        if (c.isPunc('.')) { c.next(); break }
        if (c.tryKw('EXPORTING')) { parseSec(exporting); continue }
        if (c.tryKw('IMPORTING')) { parseSec(importing); continue }
        if (c.tryKw('CHANGING')) { parseSec(changing); continue }
        if (c.tryKw('TABLES')) { parseSec(tables); continue }
        if (c.tryKw('EXCEPTIONS')) { parseSec(exceptions); continue }
        if (c.atEnd()) break
        c.next()
      }
      return { t: 'callfunction', name, exporting, importing, changing, tables, exceptions, line: this.line() }
    }
    if (c.isKw('SCREEN')) { c.rawStatement(); return { t: 'datainfo', raw: 'CALL SCREEN', line: this.line() } }
    if (c.isKw('TRANSACTION')) { c.rawStatement(); return { t: 'datainfo', raw: 'CALL TRANSACTION', line: this.line() } }
    if (c.isKw('DIALOG')) { c.rawStatement(); return { t: 'datainfo', raw: 'CALL DIALOG', line: this.line() } }
    if (c.isKw('BADI')) { c.rawStatement(); return null }
    c.rawStatement()
    return null
  }

  private parseCallSections(c: Cursor, args: CallArg[]) {
    // EXPORTING/IMPORTING/CHANGING/RECEIVING/EXCEPTIONS params for method calls
    let mode: 'exporting' | 'importing' | 'changing' | 'receiving' = 'exporting'
    for (;;) {
      if (c.isPunc('.')) { c.next(); return }
      if (c.tryKw('EXPORTING')) { mode = 'exporting'; continue }
      if (c.tryKw('IMPORTING')) { mode = 'importing'; continue }
      if (c.tryKw('CHANGING')) { mode = 'changing'; continue }
      if (c.tryKw('RECEIVING')) { mode = 'receiving'; continue }
      if (c.tryKw('EXCEPTIONS')) {
        // OTHERS = 1 etc — skip
        while (!c.isPunc('.') && !c.atEnd()) c.next()
        continue
      }
      const t = c.peek()
      if (!t) return
      if (t.type === 'IDENT') {
        const name = c.next().upper
        if (c.isPunc('=')) {
          c.next()
          const val = this.parseExpr()
          args.push({ name, value: val, section: mode })
        } else {
          args.push({ name, value: { t: 'var', name }, section: mode })
        }
        if (c.isPunc(',')) { c.next(); continue }
        continue
      }
      c.next()
    }
  }

  private parseMessage(): Stmt {
    const line = this.line()
    const c = this.c
    // MESSAGE 'text' TYPE 'S' [DISPLAY LIKE 'W'] | MESSAGE ID id NUMBER n WITH a b | MESSAGE e001(zclass) WITH.. | MESSAGE x TYPE 'E' RAISE exc
    let text: Expr | undefined
    let msgType: string | undefined
    let id: string | undefined
    let number: Expr | undefined
    const withArgs: Expr[] = []
    let displayLike: string | undefined
    let raise: string | undefined
    const t = c.peek()
    if (t?.type === 'STRING') {
      c.next()
      text = { t: 'str', v: t.value }
      if (c.tryKw('TYPE')) {
        const mt = c.peek()
        if (mt?.type === 'STRING') { c.next(); msgType = mt.value.toUpperCase() }
        else if (mt?.type === 'IDENT') { c.next(); msgType = mt.upper }
      }
    } else if (t?.type === 'IDENT') {
      // e.g. MESSAGE e001(zclass) WITH x y. | MESSAGE ID ... NUMBER ...
      const u = t.upper
      if (u === 'ID') {
        c.next()
        const it = c.peek()
        if (it?.type === 'STRING') { c.next(); id = it.value.toUpperCase() }
        else if (it?.type === 'IDENT') { c.next(); id = it.upper }
        if (c.tryKw('NUMBER')) {
          number = this.parseExpr()
        }
      } else if (/^[eiasiwxnn]\d{3}/i.test(u) || /^\d{3}$/.test(u)) {
        // message number e001(zcls)
        c.next()
        number = { t: 'str', v: u }
        msgType = u[0].toUpperCase()
        if (c.isPunc('(')) {
          c.next()
          const cls = c.peek()
          if (cls?.type === 'IDENT') { c.next(); id = cls.upper }
          c.expectPunc(')')
        }
      } else {
        // MESSAGE var TYPE ... | MESSAGE ID var ...
        text = this.parseExpr()
        if (c.tryKw('TYPE')) {
          const mt = c.peek()
          if (mt?.type === 'STRING') { c.next(); msgType = mt.value.toUpperCase() }
          else if (mt?.type === 'IDENT') { c.next(); msgType = mt.upper }
        }
      }
    } else if (t?.type === 'NUMBER') {
      c.next()
      number = { t: 'str', v: t.value }
      msgType = 'E'
    }
    for (;;) {
      if (c.isPunc('.') || c.atEnd()) { c.tryPunc('.'); break }
      if (c.tryKw('WITH')) {
        for (;;) {
          withArgs.push(this.parseExpr())
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
        continue
      }
      if (c.isKw('DISPLAY') && c.isKw('LIKE', 1)) {
        c.next(); c.next()
        const dt = c.peek()
        if (dt?.type === 'STRING') { c.next(); displayLike = dt.value.toUpperCase() }
        else if (dt?.type === 'IDENT') { c.next(); displayLike = dt.upper }
        continue
      }
      if (c.tryKw('RAISE')) {
        const rt = c.peek()
        if (rt?.type === 'IDENT') { c.next(); raise = rt.upper }
        continue
      }
      if (c.tryKw('TYPE')) {
        const mt = c.peek()
        if (mt?.type === 'STRING') { c.next(); msgType = mt.value.toUpperCase() }
        else if (mt?.type === 'IDENT') { c.next(); msgType = mt.upper }
        continue
      }
      if (c.tryKw('INTO')) { this.parseExpr(); continue }
      c.next()
    }
    if (!msgType) msgType = 'S'
    return { t: 'message', text, msgType, id, number, with: withArgs, displayLike, raise, line }
  }

  private parseCreate(): Stmt | null {
    const c = this.c
    if (c.isKw('OBJECT')) {
      c.next()
      const line = this.line()
      const target = this.parseExpr()
      let className: string | undefined
      const exporting: CallArg[] = []
      if (c.tryKw('TYPE')) {
        const nt = c.expectIdent('class')
        className = nt.upper
        if (c.isPunc('(')) { c.next(); c.expectPunc(')') }
      }
      if (c.tryKw('EXPORTING')) {
        for (;;) {
          const nt = c.peek()
          if (!nt || nt.type !== 'IDENT') break
          const name = c.next().upper
          c.expectPunc('=')
          const val = this.parseExpr()
          exporting.push({ name, value: val })
          if (c.isPunc(',')) { c.next(); continue }
          break
        }
      }
      c.rawStatement()
      return { t: 'createobject', target, className, exporting, exceptions: [], line }
    }
    if (c.isKw('DATA')) {
      // CREATE DATA dref [TYPE ...] — tolerate
      c.rawStatement()
      return null
    }
    c.rawStatement()
    return null
  }

  private parseSet(): Stmt | null {
    const c = this.c
    if (c.isKw('HANDLER')) {
      c.next()
      const line = this.line()
      const handlers: { recv?: Expr; sep?: '->' | '=>'; name: string }[] = []
      for (;;) {
        const first = c.expectIdent('handler method')
        if (c.isPunc('->') || c.isPunc('=>')) {
          const sep = c.next().value as '->' | '=>'
          const name = c.expectIdent('method').upper
          handlers.push({ recv: { t: 'var', name: first.upper }, sep, name })
        } else {
          handlers.push({ name: first.upper })
        }
        if (c.isPunc(',')) { c.next(); continue }
        break
      }
      let forRef: Expr | undefined
      let forAll = false
      let activation = true
      for (;;) {
        if (c.isPunc('.') || c.atEnd()) { c.tryPunc('.'); break }
        if (c.tryKw('FOR')) {
          if (c.isKw('ALL') && c.isKw('INSTANCES', 1)) {
            c.next(); c.next()
            forAll = true
          } else {
            forRef = this.parseExpr()
          }
          continue
        }
        if (c.tryKw('ACTIVATION')) {
          const e = this.parseExpr()
          activation = true
          continue
        }
        c.next()
      }
      return { t: 'sethandler', handlers, for: forRef, forAll, activation, line }
    }
    if (c.isKw('PF-STATUS')) { c.rawStatement(); return { t: 'setpfstatus', line: this.line() } }
    if (c.isKw('TITLEBAR')) {
      const toks = c.rawStatementTokens().filter((x) => x.upper !== 'TITLEBAR' && x.upper !== 'OF')
      const sub = new Cursor(toks)
      const title: Expr = sub.peek() ? this.parseExprCursor(sub) : { t: 'str', v: '' }
      return { t: 'settitlebar', title, line: this.line() }
    }
    if (c.isKw('SCREEN')) { c.rawStatement(); return null }
    if (c.isKw('COUNTRY')) { c.rawStatement(); return null }
    if (c.isKw('CURSOR')) { c.rawStatement(); return null }
    if (c.isKw('PARAMETER')) { c.rawStatement(); return null }
    if (c.isKw('EXTENDED')) { c.rawStatement(); return null }
    if (c.isKw('PROPERTY')) { c.rawStatement(); return null }
    if (c.isKw('BIT')) { c.rawStatement(); return null }
    if (c.isKw('BLANK')) { c.rawStatement(); return null }
    if (c.isKw('LANGUAGE')) { c.rawStatement(); return null }
    c.rawStatement()
    return null
  }

  private parseTry(): Stmt {
    this.c.expectPunc('.', 'after TRY')
    const tryBody: Stmt[] = []
    const catches: { className: string; into?: Expr; body: Stmt[] }[] = []
    let cleanup: Stmt[] | undefined
    this.parseBodyUntil(tryBody, () => this.c.isKw('CATCH') || this.c.isKw('CLEANUP') || this.c.isKw('ENDTRY'))
    while (!this.c.atEnd()) {
      if (this.c.isKw('CATCH')) {
        this.c.next()
        const classToks: string[] = []
        let into: Expr | undefined
        for (;;) {
          const t = this.c.peek()
          if (!t || t.type !== 'IDENT') break
          if (t.upper === 'INTO' || t.upper === 'BEFORE' || t.upper === 'OR') { break }
          classToks.push(this.c.next().upper)
        }
        if (this.c.tryKw('BEFORE')) {
          this.c.tryKw('UNWIND')
          // Consume the rest of the CATCH header, leaving the terminating dot.
          while (!this.c.atEnd() && !this.c.isPunc('.')) this.c.next()
        }
        if (this.c.tryKw('INTO')) {
          into = this.parseExpr()
        }
        this.c.expectPunc('.', 'after CATCH')
        const body: Stmt[] = []
        this.parseBodyUntil(body, () => this.c.isKw('CATCH') || this.c.isKw('CLEANUP') || this.c.isKw('ENDTRY'))
        for (const cn of classToks.length ? classToks : ['CX_ROOT']) catches.push({ className: cn, into, body })
        continue
      }
      if (this.c.isKw('CLEANUP')) {
        this.c.rawStatement()
        cleanup = []
        this.parseBodyUntil(cleanup, () => this.c.isKw('ENDTRY'))
        continue
      }
      if (this.c.isKw('ENDTRY')) {
        this.c.rawStatement()
        break
      }
      break
    }
    return { t: 'try', tryBody, catches, cleanup }
  }

  // ── SELECT ──────────────────────────────────────────────────────────
  private parseSelect(): Stmt {
    const line = this.line()
    const c = this.c
    const sel: SelectStmt = {
      t: 'select', fields: [], from: { table: '' }, joins: [], orderBy: [], line,
    }
    if (c.isKw('SINGLE')) {
      c.next()
      sel.single = true
      if (c.isKw('FOR')) { c.next(); c.tryKw('UPDATE') }
    }
    if (c.isKw('DISTINCT')) { c.next(); sel.distinct = true }
    // fields: until FROM — collect raw text pieces (support s~carrid, *, a-b, COUNT(*) AS n)
    const fieldParts: { expr: string; alias?: string; count?: boolean }[] = []
    while (!c.isKw('FROM') && !c.atEnd() && !c.isPunc('.')) {
      const t = c.peek()!
      if (t.type === 'PUNCT' && t.value === ',') { c.next(); continue }
      if (t.upper === 'COUNT') {
        c.next()
        c.tryPunc('(')
        c.tryPunc('*')
        c.tryPunc(')')
        let alias: string | undefined
        if (c.tryKw('AS')) alias = c.expectIdent('alias').upper
        fieldParts.push({ expr: 'COUNT(*)', alias, count: true })
        continue
      }
      if (t.upper === 'SUM' || t.upper === 'AVG' || t.upper === 'MIN' || t.upper === 'MAX') {
        const fn = c.next().upper
        c.tryPunc('(')
        const arg = c.next().upper
        c.tryPunc(')')
        let alias: string | undefined
        if (c.tryKw('AS')) alias = c.expectIdent('alias').upper
        fieldParts.push({ expr: `${fn}(${arg})`, alias, count: false })
        continue
      }
      // normal field
      let name = ''
      const ft = c.peek()
      if (ft?.type === 'PUNCT' && ft.value === '*') {
        c.next()
        fieldParts.push({ expr: '*' })
        continue
      }
      if (ft?.type === 'IDENT') {
        name = c.next().upper
        if (c.isPunc('~')) {
          c.next()
          const f2 = c.expectIdent('field')
          name = `${name}~${f2.upper}`
        } else if (c.isPunc('-')) {
          c.next()
          const f2 = c.expectIdent('field')
          name = `${name}-${f2.upper}`
        }
      } else {
        c.next()
        continue
      }
      let alias: string | undefined
      if (c.tryKw('AS')) alias = c.expectIdent('alias').upper
      fieldParts.push({ expr: name, alias })
    }
    sel.fields = fieldParts
    if (c.tryKw('FROM')) {
      const nameTok = c.expectIdent('table name')
      sel.from.table = nameTok.upper
      if (c.tryKw('AS')) sel.from.alias = c.expectIdent('alias').upper
      // JOINs
      while (c.isKw('INNER') || c.isKw('LEFT') || c.isKw('RIGHT') || c.isKw('JOIN')) {
        const isLeft = c.tryKw('LEFT')
        const isRight = c.tryKw('RIGHT')
        if (!c.tryKw('OUTER')) { /* ok */ }
        c.tryKw('INNER')
        if (!c.tryKw('JOIN')) break
        const jt = c.expectIdent('join table')
        const jalias = c.tryKw('AS') ? c.expectIdent('alias').upper : undefined
        let on: Expr = { t: 'bool', v: 'X' }
        if (c.tryKw('ON')) {
          on = this.parseSqlCond(c)
        }
        sel.joins.push({ table: jt.upper, alias: jalias, on })
      }
    }
    // remaining clauses in any order
    for (;;) {
      if (c.isPunc('.') || c.atEnd()) { c.tryPunc('.'); break }
      if (c.tryKw('INTO')) {
        if (c.tryKw('CORRESPONDING')) { c.tryKw('FIELDS'); c.tryKw('OF'); sel.intoCorresponding = true }
        if (c.isKw('TABLE')) {
          c.next()
          sel.intoTable = true
          sel.into = this.parseExpr()
        } else if (c.isPunc('(')) {
          // inline decl INTO (@DATA(x)) or field list (f1, f2)
          const save = c.pos
          c.next()
          if (c.isKw('DATA') || c.isKw('FINAL') || c.isPunc('@')) {
            if (c.isPunc('@')) c.next()
            if (c.isKw('DATA') || c.isKw('FINAL')) {
              c.next()
              const nm = c.expectIdent('var')
              c.expectPunc(')')
              sel.into = { t: 'inlinedecl', name: nm.upper }
              continue
            }
          }
          // field list INTO (f1, f2)
          c.pos = save
          sel.into = this.parseExpr()
        } else {
          sel.into = this.parseExpr()
        }
        continue
      }
      if (c.isKw('APPENDING')) {
        c.next()
        c.tryKw('TABLE')
        sel.appending = true
        sel.intoTable = true
        sel.into = this.parseExpr()
        continue
      }
      if (c.isKw('UP') && c.isKw('TO', 1)) {
        c.next(); c.next()
        if (c.isPunc('@')) c.next()
        sel.upTo = this.parseExpr()
        continue
      }
      if (c.tryKw('WHERE')) {
        sel.where = this.parseSqlCond(c)
        continue
      }
      if (c.tryKw('ORDER')) {
        c.tryKw('BY')
        for (;;) {
          if (c.isPunc('.') || c.atEnd() || c.isKw('INTO')) break
          const t = c.peek()
          if (t?.type === 'IDENT') {
            let name = c.next().upper
            if (c.isPunc('~')) { c.next(); name += '~' + c.expectIdent('f').upper }
            let dir: 'asc' | 'desc' = 'asc'
            if (c.tryKw('ASCENDING')) dir = 'asc'
            else if (c.tryKw('DESCENDING')) dir = 'desc'
            else if (c.tryKw('DESC')) dir = 'desc'
            else if (c.tryKw('ASC')) dir = 'asc'
            sel.orderBy.push({ expr: name, dir })
            if (c.isPunc(',')) { c.next(); continue }
            continue
          }
          if (t?.type === 'PUNCT' && t.value === ',') { c.next(); continue }
          if (t?.type === 'PUNCT' && t.value === '*') { c.next(); continue }
          c.next()
        }
        continue
      }
      if (c.isKw('GROUP')) {
        c.next(); c.tryKw('BY')
        const groups: string[] = []
        while (!c.isPunc('.') && !c.atEnd() && !c.isKw('INTO')) {
          const t = c.peek()
          if (t?.type === 'IDENT') groups.push(c.next().upper)
          else c.next()
        }
        sel.groupBy = groups
        continue
      }
      if (c.isKw('FOR')) { c.next(); c.rawStatementToDotWhere() ; continue }
      if (c.isKw('CLIENT') || c.isKw('USING')) { while (!c.isPunc('.') && !c.atEnd()) c.next(); continue }
      c.next()
    }
    return sel
  }

  private pendingInlineDecl: { name: string; tableOf: boolean } | null = null
  public takePendingInlineDecl() {
    const d = this.pendingInlineDecl
    this.pendingInlineDecl = null
    return d
  }

  // SQL condition — parse with expression parser (supports AND/OR, IN, BETWEEN, LIKE, host vars @x, db fields)
  private parseSqlCond(c: Cursor): Expr {
    return this.parseExpr()
  }

  private parseUpdateDb(): Stmt {
    const line = this.line()
    const c = this.c
    const nameTok = c.expectIdent('table name')
    const table = nameTok.upper
    let from: Expr | undefined
    let fromTable = false
    const sets: { field: string; value: Expr }[] = []
    let where: Expr | undefined
    if (c.tryKw('FROM')) {
      if (c.tryKw('TABLE')) fromTable = true
      from = this.parseExpr()
      c.expectPunc('.', 'after UPDATE')
      return { t: 'updatedb', table, src: from, fromTable, sets, line }
    }
    if (c.tryKw('SET')) {
      for (;;) {
        const t = c.peek()
        if (!t || t.type !== 'IDENT') break
        if (t.upper === 'WHERE') break
        const f = c.next().upper
        c.expectPunc('=')
        if (c.isPunc('@')) c.next()
        const v = this.parseExpr()
        sets.push({ field: f, value: v })
        if (c.isPunc(',')) { c.next(); continue }
      }
      if (c.tryKw('WHERE')) where = this.parseExpr()
      c.expectPunc('.', 'after UPDATE')
      return { t: 'updatedb', table, sets, where, line }
    }
    c.expectPunc('.', 'after UPDATE')
    return { t: 'updatedb', table, sets, where, line }
  }

  // ── Expression parser ───────────────────────────────────────────────
  parseExpr(): Expr {
    return this.parseOr(this.c)
  }
  parseExprCursor(c: Cursor): Expr {
    return this.parseOr(c)
  }

  private parseOr(c: Cursor): Expr {
    let l = this.parseAnd(c)
    for (;;) {
      if (c.isKw('OR')) { c.next(); const r = this.parseAnd(c); l = { t: 'binop', op: 'OR', l, r } }
      else return l
    }
  }
  private parseAnd(c: Cursor): Expr {
    let l = this.parseNot(c)
    for (;;) {
      if (c.isKw('AND')) { c.next(); const r = this.parseNot(c); l = { t: 'binop', op: 'AND', l, r } }
      else return l
    }
  }
  private parseNot(c: Cursor): Expr {
    if (c.isKw('NOT')) {
      // NOT ( ... ) or NOT predicate
      c.next()
      const e = this.parseNot(c)
      return { t: 'unop', op: 'NOT', e }
    }
    return this.parseComparison(c)
  }

  private isComparisonAhead(c: Cursor): boolean {
    const t = c.peek()
    if (!t) return false
    if (t.type === 'PUNCT') return ['=', '<>', '<', '>', '<=', '>=', '?='].includes(t.value)
    if (t.type === 'IDENT') {
      return ['EQ', 'NE', 'LT', 'GT', 'LE', 'GE', 'BETWEEN', 'LIKE', 'IN', 'IS', 'CO', 'CA', 'CS', 'CP', 'NA', 'NS', 'NP'].includes(t.upper)
    }
    return false
  }

  private parseComparison(c: Cursor): Expr {
    const l = this.parseConcat(c)
    const t = c.peek()
    if (!t) return l
    let op = ''
    if (t.type === 'PUNCT' && ['=', '<>', '<', '>', '<=', '>='].includes(t.value)) {
      op = c.next().value
    } else if (t.type === 'IDENT') {
      const u = t.upper
      if (u === 'EQ' || u === 'NE' || u === 'LT' || u === 'GT' || u === 'LE' || u === 'GE') {
        op = { EQ: '=', NE: '<>', LT: '<', GT: '>', LE: '<=', GE: '>=' }[u]!
        c.next()
      } else if (u === 'BETWEEN') {
        c.next()
        const lo = this.parseConcat(c)
        if (!c.tryKw('AND')) c.err('Expected AND in BETWEEN')
        const hi = this.parseConcat(c)
        return { t: 'between', e: l, lo, hi }
      } else if (u === 'LIKE') {
        c.next()
        const r = this.parseConcat(c)
        return { t: 'strpred', op: 'LIKE', l, r }
      } else if (u === 'IN') {
        c.next()
        const r = this.parseConcat(c)
        return { t: 'in', e: l, range: r }
      } else if (u === 'IS') {
        c.next()
        let negated = false
        if (c.tryKw('NOT')) negated = true
        const what = c.expectIdent('IS clause').upper
        if (what === 'SUPPLIED') return { t: 'is', e: l, what: negated ? 'NOT_SUPPLIED' : 'SUPPLIED' }
        if (what === 'BOUND') return { t: 'is', e: l, what: negated ? 'NOT_BOUND' : 'BOUND' }
        if (what === 'ASSIGNED') return { t: 'is', e: l, what: negated ? 'NOT_ASSIGNED' : 'ASSIGNED' }
        if (what === 'INITIAL') return { t: 'is', e: l, what: negated ? 'NOT_INITIAL' : 'INITIAL' }
        if (what === 'INSTANCE') { c.tryKw('OF'); const cls = c.expectIdent('class').upper; return { t: 'is', e: l, what: negated ? 'NOT_INSTANCE' : 'INSTANCE', arg: { t: 'var', name: cls } } }
        return { t: 'is', e: l, what }
      } else if (['CO', 'CA', 'CS', 'CP', 'NA', 'NS', 'NP'].includes(u)) {
        c.next()
        const r = this.parseConcat(c)
        return { t: 'strpred', op: u, l, r }
      }
    }
    if (op) {
      const r = this.parseConcat(c)
      return { t: 'binop', op, l, r }
    }
    return l
  }

  // && and &
  private parseConcat(c: Cursor): Expr {
    let l = this.parseAdditive(c)
    for (;;) {
      if (c.isPunc('&&')) { c.next(); const r = this.parseAdditive(c); l = { t: 'binop', op: '&&', l, r } }
      else if (c.isPunc('&')) { c.next(); const r = this.parseAdditive(c); l = { t: 'binop', op: '&&', l, r } }
      else return l
    }
  }

  private parseAdditive(c: Cursor): Expr {
    let l = this.parseMultiplicative(c)
    for (;;) {
      if (c.isPunc('+')) { c.next(); const r = this.parseMultiplicative(c); l = { t: 'binop', op: '+', l, r } }
      else if (c.isPunc('-')) { c.next(); const r = this.parseMultiplicative(c); l = { t: 'binop', op: '-', l, r } }
      else return l
    }
  }

  private parseMultiplicative(c: Cursor): Expr {
    let l = this.parseUnary(c)
    for (;;) {
      if (c.isPunc('*')) { c.next(); const r = this.parseUnary(c); l = { t: 'binop', op: '*', l, r } }
      else if (c.isPunc('/')) { c.next(); const r = this.parseUnary(c); l = { t: 'binop', op: '/', l, r } }
      else if (c.isPunc('**')) { c.next(); const r = this.parseUnary(c); l = { t: 'binop', op: '**', l, r } }
      else if (c.isKw('DIV')) { c.next(); const r = this.parseUnary(c); l = { t: 'binop', op: 'DIV', l, r } }
      else if (c.isKw('MOD')) { c.next(); const r = this.parseUnary(c); l = { t: 'binop', op: 'MOD', l, r } }
      else return l
    }
  }

  private parseUnary(c: Cursor): Expr {
    if (c.isPunc('-')) {
      c.next()
      const e = this.parseUnary(c)
      if (e.t === 'num') return { t: 'num', v: -e.v, raw: e.raw }
      return { t: 'unop', op: '-', e }
    }
    if (c.isPunc('+')) { c.next(); return this.parseUnary(c) }
    return this.parsePostfix(c)
  }

  // postfix: chains of ->, =>, ~, -, and calls ( ... )
  private parsePostfix(c: Cursor): Expr {
    let e = this.parsePrimary(c)
    for (;;) {
      if (c.isPunc('->') || c.isPunc('=>') || c.isPunc('~')) {
        const sep = c.next().value as '->' | '=>' | '~'
        // obj->* deref
        if (c.isPunc('*')) {
          c.next()
          e = { t: 'deref', ref: e }
          continue
        }
        const nameTok = c.expectIdent('member name')
        let name = nameTok.upper
        // interface qualifier: obj->if_x~meth( )
        if (c.isPunc('~')) {
          c.next()
          const m2 = c.expectIdent('interface method').upper
          name = `${name}~${m2}`
        }
        // method call on member: alv->display( )
        if (c.isPunc('(')) {
          const args = this.parseArgs(c)
          e = { t: 'call', fn: 'METHOD', method: name, recv: e, sep, args, style: 'functional' }
        } else {
          e = { t: 'member', obj: e, name, sep }
        }
        continue
      }
      if (c.isPunc('-')) {
        // member access if attached (no gap) and followed by IDENT; spaced '-' = subtraction
        const nt = c.peek(1)
        const dashTok = c.peek()!
        const prevTok = c.toks[c.pos - 1]
        const attached = prevTok ? dashTok.col <= prevTok.col + prevTok.value.length : true
        if (nt && nt.type === 'IDENT' && attached) {
          c.next()
          const nameTok = c.expectIdent('component')
          const name = nameTok.upper
          if (c.isPunc('(')) {
            const args = this.parseArgs(c)
            e = { t: 'call', fn: 'METHOD', method: name, recv: e, sep: '-', args, style: 'functional' }
          } else {
            e = { t: 'member', obj: e, name, sep: '-' }
          }
          continue
        }
        return e
      }
      if (c.isPunc('[')) {
        c.next()
        const args: Expr[] = []
        while (!c.isPunc(']') && !c.atEnd()) {
          args.push(this.parseOr(c))
          if (c.isPunc(',')) { c.next(); continue }
        }
        c.expectPunc(']')
        e = { t: 'index', arr: e, args }
        continue
      }
      if (c.isPunc('(')) {
        // direct call on primary — only valid when primary is plain ident (function)
        if (e.t === 'var') {
          const args = this.parseArgs(c)
          e = { t: 'call', fn: e.name, args, style: 'functional' }
          continue
        }
        return e
      }
      return e
    }
  }

  private parseArgs(c: Cursor): CallArg[] {
    c.expectPunc('(')
    const args: CallArg[] = []
    if (c.isPunc(')')) { c.next(); return args }
    // EXPORTING a = b c = d IMPORTING ... style — or positional a b
    let mode: 'exporting' | 'importing' | 'changing' | 'receiving' = 'exporting'
    for (;;) {
      if (c.isPunc(')')) { c.next(); break }
      const t = c.peek()
      if (!t) break
      if (t.type === 'IDENT' && ['EXPORTING', 'IMPORTING', 'CHANGING', 'RECEIVING'].includes(t.upper)) {
        mode = t.upper.toLowerCase() as any
        c.next()
        continue
      }
      if (t.type === 'IDENT' && t.upper === 'EXCEPTIONS') {
        // skip exception params
        c.next()
        while (!c.isPunc(')') && !c.atEnd()) c.next()
        continue
      }
      const nameTok = c.peek()
      if (nameTok?.type === 'IDENT' && c.isPunc('=', 1)) {
        c.next(); c.next()
        const val = this.parseOr(c)
        args.push({ name: nameTok.upper, value: val, section: mode })
      } else {
        const val = this.parseOr(c)
        args.push({ name: undefined, value: val, section: mode })
      }
      if (c.isPunc(',')) { c.next(); continue }
    }
    return args
  }

  private parsePrimary(c: Cursor): Expr {
    const t = c.peek()
    if (!t) c.err('Unexpected end of statement')
    // string
    if (t.type === 'STRING') { c.next(); return { t: 'str', v: t.value } }
    // template
    if (t.type === 'TEMPLATE') {
      c.next()
      const parts = this.parseTemplateParts(t.value, t.line)
      return { t: 'tmpl', parts }
    }
    // number
    if (t.type === 'NUMBER') { c.next(); return { t: 'num', v: parseFloat(t.value), raw: t.value } }
    // @ host variable → strip and parse var
    if (t.type === 'PUNCT' && t.value === '@') {
      c.next()
      return this.parsePrimary(c)
    }
    // parentheses
    if (t.type === 'PUNCT' && t.value === '(') {
      c.next()
      const e = this.parseOr(c)
      c.expectPunc(')')
      return e
    }
    // field symbol <fs>
    if (t.type === 'PUNCT' && t.value === '<') {
      // could be <fs> — must be followed by IDENT then >
      if (c.peek(1)?.type === 'IDENT' && c.isPunc('>', 2)) {
        c.next()
        const name = c.next().upper
        c.next()
        return { t: 'var', name }
      }
      c.err('Unexpected "<"')
    }
    if (t.type !== 'IDENT') c.err(`Unexpected "${t.value}"`)
    const u = t.upper
    c.next()
    // inline declaration DATA( x ) / FINAL( x )
    if ((u === 'DATA' || u === 'FINAL') && c.isPunc('(')) {
      c.next()
      const nm = c.expectIdent('inline variable').upper
      c.expectPunc(')')
      return { t: 'inlinedecl', name: nm }
    }
    // inline field-symbol FIELD-SYMBOL( <fs> ) — tokens: FIELD - SYMBOL ( < x > )
    if (u === 'FIELD' && c.isPunc('-', 0) && c.isKw('SYMBOL', 1) && c.isPunc('(', 2)) {
      c.next(); c.next(); c.next()
      c.expectPunc('<')
      const nm = c.expectIdent('field symbol').upper
      c.expectPunc('>')
      c.expectPunc(')')
      return { t: 'fsdecl', name: nm }
    }
    // constructor expressions VALUE #(...) / VALUE type(...) / NEW cls(...) / CONV / REF / COND / REDUCE / SWITCH
    if (u === 'VALUE' && (c.isPunc('#') || c.isPunc('(') || c.peek()?.type === 'IDENT')) {
      if (c.isPunc('#')) {
        c.next()
      } else if (c.peek()?.type === 'IDENT' && c.isPunc('(', 1)) {
        c.next() // consume explicit type name — type adopted from value
      }
      // VALUE #( ... ) — parse lines
      const lines = this.parseValueLines(c)
      return { t: 'value', base: '#', lines }
    }
    if (u === 'NEW') {
      // NEW cls( ) | NEW #( )
      let className = ''
      if (c.isPunc('#')) { c.next(); className = '#INFER#' }
      else if (c.peek()?.type === 'IDENT') { className = c.peek()!.upper; c.next() }
      if (c.isPunc('(')) {
        const args = this.parseArgs(c)
        return { t: 'new', className, args }
      }
      return { t: 'var', name: 'NEW' }
    }
    if (u === 'CONV') {
      if (c.isPunc('#')) { c.next() }
      else if (c.peek()?.type === 'IDENT') { c.next() }
      const e = this.parsePrimary(c)
      return { t: 'conv', base: '#', expr: e }
    }
    if (u === 'REF') {
      if (c.isPunc('#')) c.next()
      const e = this.parsePrimary(c)
      return { t: 'ref', expr: e }
    }
    if (u === 'COND') {
      if (c.isPunc('#')) c.next()
      else if (c.peek()?.type === 'IDENT') c.next()
      c.expectPunc('(')
      const whens: { when: Expr[]; then: Expr }[] = []
      let els: Expr | undefined
      let curWhen: Expr[] | null = null
      for (;;) {
        if (c.isPunc(')')) { c.next(); break }
        if (c.tryKw('WHEN')) {
          const vals: Expr[] = []
          for (;;) {
            vals.push(this.parseOr(c))
            if (c.tryKw('OR')) continue
            break
          }
          c.tryKw('THEN')
          const then = this.parseOr(c)
          whens.push({ when: vals, then })
          continue
        }
        if (c.tryKw('ELSE')) {
          els = this.parseOr(c)
          continue
        }
        c.next()
      }
      return { t: 'cond', base: '#', whens, els }
    }
    if (u === 'SWITCH') {
      if (c.isPunc('#')) c.next()
      else if (c.peek()?.type === 'IDENT') c.next()
      c.expectPunc('(')
      const subject = this.parseOr(c)
      const cases: { when: Expr[]; then: Expr }[] = []
      let dflt: Expr | undefined
      for (;;) {
        if (c.isPunc(')')) { c.next(); break }
        if (c.tryKw('WHEN')) {
          const vals: Expr[] = []
          for (;;) {
            vals.push(this.parseOr(c))
            if (c.tryKw('OR')) continue
            break
          }
          c.tryKw('THEN')
          const then = this.parseOr(c)
          cases.push({ when: vals, then })
          continue
        }
        if (c.tryKw('ELSE')) { dflt = this.parseOr(c); continue }
        c.next()
      }
      return { t: 'switch', base: '#', subject, cases, default: dflt }
    }
    if (u === 'REDUCE') {
      if (c.isPunc('#')) c.next()
      else if (c.peek()?.type === 'IDENT') c.next()
      c.expectPunc('(')
      let init: { name: string; expr: Expr } | null = null
      let next: { name: string; expr: Expr } | null = null
      let forOf: { var: string; table: Expr; where?: Expr } | null = null
      let forNum: { var: string; init: Expr; step: Expr; while: Expr } | null = null
      let whileCond: Expr | undefined
      for (;;) {
        if (c.isPunc(')')) { c.next(); break }
        if (c.tryKw('INIT')) {
          const nm = c.expectIdent('var').upper
          c.expectPunc('=')
          const e = this.parseOr(c)
          init = { name: nm, expr: e }
          continue
        }
        if (c.tryKw('NEXT')) {
          const nm = c.expectIdent('var').upper
          c.expectPunc('=')
          const e = this.parseOr(c)
          next = { name: nm, expr: e }
          continue
        }
        if (c.tryKw('FOR')) {
          const v = c.expectIdent('loop var').upper
          if (c.tryKw('IN')) {
            const tbl = this.parseOr(c)
            let where: Expr | undefined
            if (c.tryKw('WHERE')) where = this.parseOr(c)
            forOf = { var: v, table: tbl, where }
          } else {
            // numeric FOR i = init THEN step WHILE cond
            if (c.isPunc('=')) {
              c.next()
              const initE = this.parseOr(c)
              let stepE: Expr = { t: 'var', name: v }
              if (c.tryKw('THEN')) {
                stepE = this.parseOr(c)
              }
              let whileE: Expr | undefined
              if (c.tryKw('WHILE')) whileE = this.parseOr(c)
              forNum = { var: v, init: initE, step: stepE, while: whileE ?? { t: 'bool', v: 'X' } }
            } else {
              // tolerate: FOR i THEN ... WHILE ...
              c.tryKw('THEN')
              const initE = this.parseOr(c)
              let whileE: Expr | undefined
              if (c.tryKw('WHILE')) whileE = this.parseOr(c)
              forNum = { var: v, init: initE, step: { t: 'var', name: v }, while: whileE ?? { t: 'bool', v: 'X' } }
            }
          }
          continue
        }
        if (c.tryKw('WHILE')) { whileCond = this.parseOr(c); continue }
        c.next()
      }
      return { t: 'reduce', init: init ?? { name: 'x', expr: { t: 'num', v: 0, raw: '' } }, next: next ?? { name: 'x', expr: { t: 'num', v: 0, raw: '' } }, forOf: forOf ?? undefined, forNum: forNum ?? undefined, while: whileCond }
    }
    if (u === 'LINE_EXISTS') {
      // LINE_EXISTS( it[ k = v ] )
      c.expectPunc('(')
      const inner = this.parseOr(c)
      c.expectPunc(')')
      return { t: 'is', e: inner, what: 'LINE_EXISTS' }
    }
    if (u === 'ABAP_TRUE') return { t: 'bool', v: 'X' }
    if (u === 'ABAP_FALSE') return { t: 'bool', v: ' ' }
    if (u === 'ABAP_UNDEFINED') return { t: 'bool', v: ' ' }
    if (u === 'SPACE') return { t: 'bool', v: ' ' }
    if (u === 'SY') {
      // sy-subrc etc.
      if (c.isPunc('-')) {
        c.next()
        const f = c.expectIdent('system field')
        return { t: 'member', obj: { t: 'var', name: 'SY' }, name: f.upper, sep: '-' }
      }
      return { t: 'var', name: 'SY' }
    }
    if (u === 'CONV' || u === 'XSDBOOLEAN') return { t: 'var', name: u }
    // plain variable
    return { t: 'var', name: u }
  }

  private parseValueLines(c: Cursor): ValueLine[] {
    c.expectPunc('(')
    const lines: ValueLine[] = []
    let depth = 1 // inside VALUE #(...)
    let currentForLines: ValueLine[] | null = null // lines of the last FOR → subsequent rows/fields attach here
    const addLine = (l: ValueLine) => {
      if (currentForLines) currentForLines.push(l)
      else lines.push(l)
    }
    while (!c.atEnd()) {
      if (c.isPunc(')')) {
        c.next()
        depth--
        if (depth <= 0) break
        continue
      }
      if (c.isPunc(',')) { c.next(); continue }
      // row group: ( field = value ... ) — a table row
      if (c.isPunc('(')) {
        c.next()
        depth++
        const rowLines: ValueLine[] = []
        // parse until the matching ')' of this row
        let d = 1
        while (!c.atEnd()) {
          if (c.isPunc(')')) {
            c.next()
            d--
            if (d === 0) break
            continue
          }
          if (c.isPunc('(')) { c.next(); d++; continue }
          if (c.isPunc(',')) { c.next(); continue }
          const nt = c.peek()
          if (nt?.type === 'IDENT' && c.isPunc('=', 1)) {
            c.next(); c.next()
            const e = this.parseOr(c)
            rowLines.push({ kind: 'field', name: nt.upper, expr: e })
            continue
          }
          if (c.tryKw('BASE')) {
            const e = this.parseOr(c)
            rowLines.push({ kind: 'base', expr: e })
            continue
          }
          if (c.isKw('FOR') || c.isKw('LET')) {
            // rare inside rows — treat as field parse failure: skip token
            c.next()
            continue
          }
          // positional value inside row
          const e = this.parseOr(c)
          rowLines.push({ kind: 'base', expr: e })
        }
        depth--
        addLine({ kind: 'row', lines: rowLines })
        continue
      }
      if (c.tryKw('BASE')) {
        const e = this.parseOr(c)
        addLine({ kind: 'base', expr: e })
        continue
      }
      if (c.isKw('FOR')) {
        c.next()
        const v = c.expectIdent('loop var').upper
        if (c.tryKw('IN')) {
          const tbl = this.parseOr(c)
          let where: Expr | undefined
          if (c.tryKw('WHERE')) where = this.parseOr(c)
          const forLine: ValueLine = { kind: 'for', iterVar: v, table: tbl, where, lines: [] }
          if (currentForLines) {
            // nested FOR: attach to parent's lines
            currentForLines.push(forLine)
            currentForLines = forLine.lines
          } else {
            lines.push(forLine)
            currentForLines = forLine.lines
          }
        } else {
          // numeric FOR i = init THEN step WHILE cond — inside VALUE: skip tokens
          while (!c.isPunc(',') && !c.isPunc(')') && !c.atEnd() && !c.isKw('FOR')) c.next()
        }
        continue
      }
      if (c.tryKw('LET')) {
        // LET x = y IN — skip assignments
        while (!c.tryKw('IN') && !c.atEnd() && !c.isPunc(')')) c.next()
        continue
      }
      const nt = c.peek()
      if (nt?.type === 'IDENT' && c.isPunc('=', 1)) {
        c.next(); c.next()
        const e = this.parseOr(c)
        addLine({ kind: 'field', name: nt.upper, expr: e })
        continue
      }
      if (c.isKw('THEN') || c.isKw('WHILE') || c.isKw('NEXT') || c.isKw('INIT')) {
        // parts of numeric FOR / REDUCE accidentally reached
        c.next()
        continue
      }
      // positional value (structure base or table line)
      const e = this.parseOr(c)
      addLine({ kind: 'base', expr: e })
    }
    return lines
  }


  private parseTemplateParts(raw: string, line: number): TmplPart[] {
    const parts: TmplPart[] = []
    let buf = ''
    let i = 0
    while (i < raw.length) {
      const ch = raw[i]
      if (ch === '{') {
        if (buf) { parts.push({ lit: buf }); buf = '' }
        // find matching } accounting for nested templates/quotes
        let depth = 1
        let j = i + 1
        let exprSrc = ''
        while (j < raw.length && depth > 0) {
          const cj = raw[j]
          if (cj === '{') depth++
          if (cj === '}') { depth--; if (depth === 0) break }
          exprSrc += cj
          j++
        }
        // parse options: expr DECIMALS = 2 WIDTH = 5 etc.
        let exprPart = exprSrc.trim()
        const options: Record<string, number | string> = {}
        // find trailing options keywords
        const optRegex = /(DECIMALS|WIDTH|ALIGN|PAD|DATE|TIME|TIMESTAMP|SIGN|STYLE|CASE)\s*=\s*([^\s]+)\s*/g
        let m: RegExpExecArray | null
        let optStart = exprPart.length
        const found: { idx: number }[] = []
        while ((m = optRegex.exec(exprPart)) !== null) found.push({ idx: m.index })
        if (found.length) {
          optStart = found[0].idx
          const optStr = exprPart.slice(optStart)
          exprPart = exprPart.slice(0, optStart).trim()
          let mm: RegExpExecArray | null
          const re2 = /(DECIMALS|WIDTH|ALIGN|PAD|DATE|TIME|TIMESTAMP|SIGN|STYLE|CASE)\s*=\s*([^\s]+)/g
          while ((mm = re2.exec(optStr)) !== null) {
            options[mm[1]] = mm[2]
          }
        }
        try {
          const sub = new Cursor(tokenize(exprPart))
          const expr = this.parseExprCursor(sub)
          parts.push({ expr, options: Object.keys(options).length ? options : undefined })
        } catch (e: any) {
          throw new AbapSyntaxError(`Invalid expression in string template: { ${exprPart} } — ${e.message}`, line)
        }
        i = j + 1
        continue
      }
      buf += ch
      i++
    }
    if (buf) parts.push({ lit: buf })
    return parts
  }
}

export { Cursor }
export function parseAbap(source: string): AbapProgram {
  return new Parser(source).parse()
}
