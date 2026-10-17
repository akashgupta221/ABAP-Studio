// ── ABAP Engine: entry points (run, syntax check) ──────────────────────
import { parseAbap, Parser } from './parser'
import { AbapSyntaxError, tokenize } from './tokenizer'
import { Interpreter, DbSnapshot, type FmEntry } from './interpreter'
import type { RunResult, SelectionScreenItem } from './ast-types'

export { DbSnapshot } from './interpreter'
export type { DbField, DbTableDef } from './interpreter'
export type { FmEntry } from './interpreter'
export type { RunResult, ListLine, ListSegment, AlvGrid, MessageItem, SelectionScreenItem, ParamSpec, SelectOptionSpec } from './ast-types'

export interface RunInput {
  source: string
  repid?: string
  db: DbSnapshot
  includes?: Map<string, string>
  functionModules?: Map<string, FmEntry>
  parameters?: Record<string, string | string[]>
}

// resolve INCLUDE statements (line-level, iterative, cycle-safe)
export function resolveIncludes(source: string, includes: Map<string, string>): string {
  let out = source
  const seen = new Set<string>()
  for (let pass = 0; pass < 10; pass++) {
    let changed = false
    out = out
      .split('\n')
      .map((line) => {
        const m = line.match(/^\s*INCLUDE\s+([A-Za-z0-9_\/%$#]+)\s*\./i)
        if (m) {
          const name = m[1].toUpperCase()
          if (includes.has(name) && !seen.has(name)) {
            seen.add(name)
            changed = true
            return includes.get(name)!
          }
        }
        return line
      })
      .join('\n')
    if (!changed) break
  }
  return out
}

export function runAbap(input: RunInput): RunResult {
  const repid = input.repid ?? 'ZPROGRAM'
  const source = input.includes && input.includes.size ? resolveIncludes(input.source, input.includes) : input.source
  let prog
  try {
    prog = parseAbap(source)
  } catch (e: any) {
    if (e instanceof AbapSyntaxError) {
      return {
        status: 'ERROR',
        error: { kind: 'SYNTAX', message: e.message, line: e.line, statement: e.statement },
        list: [], messages: [], durationMs: 0,
        stats: { steps: 0, linesWritten: 0, selects: 0, dbReads: 0 },
      }
    }
    return {
      status: 'ERROR',
      error: { kind: 'SYNTAX', message: e.message || 'Syntax error', line: 0 },
      list: [], messages: [], durationMs: 0,
      stats: { steps: 0, linesWritten: 0, selects: 0, dbReads: 0 },
    }
  }
  if (!prog.repid) prog.repid = repid
  const interp = new Interpreter(prog, {
    source,
    repid,
    db: input.db,
    includes: input.includes ?? new Map(),
    functionModules: input.functionModules ?? new Map(),
    parameters: input.parameters,
  })
  return interp.run()
}

export interface SyntaxIssue {
  kind: 'E' | 'W' | 'S'
  line: number
  column?: number
  message: string
  statement?: string
}

// SAP-like syntax check (the "Check" / Ctrl+F2 button)
export function checkSyntax(source: string, opts?: { includes?: Map<string, string>; db?: DbSnapshot; classes?: Map<string, any> }): SyntaxIssue[] {
  const issues: SyntaxIssue[] = []
  const src = opts?.includes && opts.includes.size ? resolveIncludes(source, opts.includes) : source
  try {
    const prog = parseAbap(src)
    // semantic warnings
    const definedForms = new Set(prog.forms.keys())
    const calledForms = new Set<string>()
    const definedClasses = new Set([...prog.classes.keys(), ...prog.interfaces.keys()])
    const collect = (stmts: any[]) => {
      for (const st of stmts ?? []) {
        if (!st) continue
        if (st.t === 'perform') calledForms.add(st.form)
        if (st.t === 'classdef') definedClasses.add(st.name)
        for (const key of ['body', 'tryBody', 'elseBody', 'defaultEvent']) {
          if (Array.isArray(st[key])) collect(st[key])
        }
        if (Array.isArray(st.branches)) for (const b of st.branches) collect(b.body)
        if (Array.isArray(st.whens)) for (const w of st.whens) collect(w.body)
        if (Array.isArray(st.methods)) for (const m of st.methods) collect(m.body)
        if (Array.isArray(st.sections)) {
          for (const sec of st.sections) {
            for (const mem of sec.members ?? []) {
              if (mem.kind === 'method' && Array.isArray(mem.decl)) collect([])
            }
          }
        }
      }
    }
    collect(prog.defaultEvent)
    for (const ev of prog.events.values()) collect(ev)
    for (const f of prog.forms.values()) collect(f.body)
    for (const impl of prog.impls.values()) {
      for (const m of impl.methods) collect(m.body)
    }
    for (const called of calledForms) {
      if (!definedForms.has(called)) {
        issues.push({ kind: 'E', line: 0, message: `Form "${called}" is unknown (PERFORM without FORM definition)` })
      }
    }
    issues.push({ kind: 'S', line: 1, message: `Syntax check finished: no errors found (${definedForms.size} forms, ${prog.classes.size} classes)` })
  } catch (e: any) {
    if (e instanceof AbapSyntaxError) {
      issues.push({ kind: 'E', line: e.line || 0, message: e.message, statement: e.statement })
    } else {
      issues.push({ kind: 'E', line: 0, message: e.message || 'Unknown syntax error' })
    }
  }
  return issues
}

// quick token count / statement count for editor stats
export function sourceStats(source: string): { statements: number; lines: number; tokens: number } {
  const toks = tokenize(source)
  let statements = 0
  let depth = 0
  for (const t of toks) {
    if (t.value === '(') depth++
    if (t.value === ')') depth--
    if (t.value === '.' && depth <= 0) statements++
  }
  return { statements, lines: source.split('\n').length, tokens: toks.length }
}
