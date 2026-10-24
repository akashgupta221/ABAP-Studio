import { describe, expect, test } from 'bun:test'
import { parseAbap } from '../src/lib/abap/parser'
import { checkSyntax, DbSnapshot, runAbap } from '../src/lib/abap'
import { Interpreter } from '../src/lib/abap/interpreter'
import { SANDBOX_SOURCE } from '../src/lib/sandbox'
import { topics, tables } from '../scripts/seed-content'
import { programsPart1 } from '../scripts/seed-programs-1'
import { programsPart2, functions, includeProgram } from '../scripts/seed-programs-2'
import type { DbTableDef, FmEntry } from '../src/lib/abap'

function snapshot(): DbSnapshot {
  const snap = new DbSnapshot()
  for (const t of tables as any[]) {
    const def: DbTableDef = {
      name: t.name.toUpperCase(),
      description: t.description,
      fields: (t.fields as any[]).map((f) => ({
        name: String(f.name).toUpperCase(),
        type: String(f.type || 'CHAR').toUpperCase(),
        length: f.length,
        decimals: f.decimals,
        key: !!f.key,
        text: f.text,
      })),
      rows: (t.rows || []).map((row: Record<string, unknown>) => {
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(row)) out[k.toUpperCase()] = String(v)
        return out
      }),
    }
    snap.tables.set(def.name, def)
  }
  return snap
}

function functionModules(): Map<string, FmEntry> {
  const fms = new Map<string, FmEntry>()
  for (const fm of functions as any[]) {
    fms.set(fm.name.toUpperCase(), {
      name: fm.name.toUpperCase(),
      importing: fm.importParams || [],
      exporting: fm.exportParams || [],
      changing: fm.changingParams || [],
      tables: fm.tablesParams || [],
      prog: parseAbap(fm.source || ''),
    })
  }
  return fms
}

function runExample(source: string, repid: string) {
  const includes = new Map<string, string>()
  if (includeProgram?.name) includes.set(includeProgram.name.toUpperCase(), includeProgram.source)
  const common = {
    source,
    repid,
    db: snapshot(),
    includes,
    functionModules: functionModules(),
  }
  let result = runAbap(common)
  if (result.status === 'REQUIRES_INPUT' && result.selectionScreen) {
    const parameters: Record<string, string | string[]> = {}
    for (const item of result.selectionScreen) {
      if (item.kind === 'param') parameters[item.name] = item.defaultValue || ''
      else parameters[item.name] = [item.defaultValue || '', item.defaultValueHigh || '']
    }
    result = runAbap({ ...common, parameters })
  }
  return result
}

describe('Standard ABAP regression suite', () => {
  const all = [...(programsPart1 as any[]), ...(programsPart2 as any[]), includeProgram as any].filter(
    (p) => p.name !== 'Z_MY_PRACTICE',
  )

  test('all 37 seeded examples parse and execute (or parse as INCLUDE)', () => {
    const failures: string[] = []
    for (const program of all) {
      try {
        if (program.type === 'INCLUDE') {
          parseAbap(program.source)
          continue
        }
        const result = runExample(program.source, program.name)
        if (result.status !== 'SUCCESS') {
          failures.push(
            `${program.name}: ${result.error?.kind ?? result.status} ${result.error?.message ?? ''} (line ${result.error?.line ?? '?'})`,
          )
        }
      } catch (error) {
        failures.push(`${program.name}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  test('simple WRITE output and sy fields are available', () => {
    const result = runAbap({
      source: "REPORT Z_TEST.\nWRITE 'hello'.\nWRITE / sy-sysid.",
      repid: 'Z_TEST',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('hello')
    expect(text).toContain('MER')
  })

  test('syntax check reports a broken statement', () => {
    const issues = checkSyntax('REPORT Z_BROKEN.\nWRITE .')
    expect(issues.some((i) => i.kind === 'E')).toBe(true)
  })

  test('statement limit stops an endless loop with a controlled dump', () => {
    const source = 'REPORT Z_LOOP.\nDO 1000000 TIMES.\nENDDO.'
    const program = parseAbap(source)
    const interpreter = new Interpreter(program, {
      source,
      repid: 'Z_LOOP',
      db: new DbSnapshot(),
      includes: new Map(),
      functionModules: new Map(),
      stepLimit: 5_000,
      timeLimitMs: 5_000,
    })
    const result = interpreter.run()
    expect(result.status).toBe('ERROR')
    expect(result.error?.message).toMatch(/limit/i)
  })

  test('the per-user sandbox template parses and executes', () => {
    const result = runAbap({
      source: SANDBOX_SOURCE,
      repid: 'Z_MY_PRACTICE',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
  })

  test('training content is still present in the seed payload', () => {
    expect(topics.length).toBeGreaterThanOrEqual(10)
    expect(tables.length).toBeGreaterThanOrEqual(11)
    expect(all.length).toBe(37)
  })
})
