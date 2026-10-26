import { describe, expect, test } from 'bun:test'
import { parseAbap } from '../src/lib/abap/parser'
import { checkSyntax, DbSnapshot, runAbap } from '../src/lib/abap'
import { Interpreter } from '../src/lib/abap/interpreter'
import { SANDBOX_SOURCE } from '../src/lib/sandbox'
import { topics, tables } from '../scripts/seed-content'
import { programsPart1 } from '../scripts/seed-programs-1'
import { programsPart2, functions, includeProgram } from '../scripts/seed-programs-2'
import { modernPrograms } from '../scripts/seed-modern'
import { MODERN_TEMPLATES, validateModernSource } from '../src/lib/modern'
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

  test('WRITE / resets every list line to column 1', () => {
    const result = runAbap({
      source:
        "REPORT Z_WRITE_COLUMNS.\n" +
        "WRITE: / 'first line'.\n" +
        "WRITE: / 'second line'.\n" +
        "WRITE: / 'third line'.",
      repid: 'Z_WRITE_COLUMNS',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const rows = result.list.filter((line) => line.segments.length > 0)
    expect(rows).toHaveLength(3)
    expect(rows[0]?.segments[0]?.x).toBe(1)
    expect(rows[1]?.segments[0]?.x).toBe(1)
    expect(rows[2]?.segments[0]?.x).toBe(1)
  })

  test('syntax check reports a broken statement', () => {
    const issues = checkSyntax('REPORT Z_BROKEN.\nWRITE .')
    expect(issues.some((i) => i.kind === 'E')).toBe(true)
  })

  test('numeric REDUCE accumulates across its WHILE loop', () => {
    const result = runAbap({
      source:
        "REPORT Z_REDUCE_NUM.\n" +
        'DATA(lv_sum) = REDUCE #( INIT s = 0 FOR i = 1 THEN i + 1 WHILE i <= 10 NEXT s = s + i ).\n' +
        'WRITE lv_sum.',
      repid: 'Z_REDUCE_NUM',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text.trim()).toBe('55')
  })

  test('REDUCE over elementary VALUE rows accumulates their values', () => {
    const result = runAbap({
      source:
        "REPORT Z_REDUCE_TABLE.\n" +
        'DATA(lt) = VALUE i( ( 1 ) ( 2 ) ( 3 ) ).\n' +
        'DATA(lv_sum) = REDUCE #( INIT s = 0 FOR n IN lt NEXT s = s + n ).\n' +
        'WRITE lv_sum.',
      repid: 'Z_REDUCE_TABLE',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text.trim()).toBe('6')
  })

  test('caught exceptions expose their message text', () => {
    const result = runAbap({
      source:
        "REPORT Z_EXCEPTION_TEXT.\n" +
        'DATA lv_text TYPE string.\n' +
        'TRY.\n' +
        '  DATA(lv_x) = 10 / 0.\n' +
        'CATCH cx_sy_zerodivide INTO DATA(lx_err).\n' +
        '  lv_text = lx_err->get_text( ).\n' +
        'ENDTRY.\n' +
        'WRITE lv_text.',
      repid: 'Z_EXCEPTION_TEXT',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('Division by zero')
  })

  test('CATCH BEFORE UNWIND parses and handles the exception', () => {
    const result = runAbap({
      source:
        "REPORT Z_CATCH_UNWIND.\n" +
        'TRY.\n' +
        '  DATA(lv_x) = 1 / 0.\n' +
        'CATCH cx_root BEFORE UNWIND.\n' +
        "  WRITE 'caught'.\n" +
        'ENDTRY.',
      repid: 'Z_CATCH_UNWIND',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('caught')
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

  test('the executable Modern ABAP example runs and uses FOR ... WHERE', () => {
    const modern = modernPrograms.find((p) => p.name === 'Z_MD_CONSTRUCTORS')
    expect(modern).toBeTruthy()
    const result = runExample(modern!.source, modern!.name)
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('REDUCE 1..5 = 15')
    expect(text).toContain('First IT row via table expression: ARJUN')
    expect(text).not.toContain('MEERA')
  })

  test('FOR ... WHERE can read iterator components', () => {
    const result = runAbap({
      source:
        "REPORT Z_FOR_WHERE.\n" +
        'TYPES: BEGIN OF ty_row, name TYPE string, dept TYPE string, END OF ty_row.\n' +
        'TYPES tt_rows TYPE STANDARD TABLE OF ty_row WITH EMPTY KEY.\n' +
        "DATA(lt_rows) = VALUE tt_rows(\n" +
        "  ( name = 'ARJUN' dept = 'IT' )\n" +
        "  ( name = 'MEERA' dept = 'HR' )\n" +
        "  ( name = 'VIKRAM' dept = 'IT' ) ).\n" +
        'DATA(lt_it) = VALUE tt_rows(\n' +
        "  FOR row IN lt_rows WHERE ( row-dept = 'IT' )\n" +
        '  ( name = row-name dept = row-dept ) ).\n' +
        'LOOP AT lt_it INTO DATA(ls_it).\n' +
        '  WRITE ls_it-name.\n' +
        'ENDLOOP.',
      repid: 'Z_FOR_WHERE',
      db: new DbSnapshot(),
    })
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('ARJUN')
    expect(text).toContain('VIKRAM')
    expect(text).not.toContain('MEERA')
  })

  test('all seeded Modern definitions validate', () => {
    for (const modern of modernPrograms) {
      const validation = validateModernSource(modern.modernKind, modern.source)
      expect(validation.status, `${modern.name}: ${JSON.stringify(validation.issues)}`).not.toBe('INVALID')
      if (modern.modernKind !== 'ABAP') expect(validation.status).toBe('VALID')
    }
    expect(modernPrograms.length).toBe(4)
  })

  test('the private Modern starter templates are usable', () => {
    const result = runExample(MODERN_TEMPLATES.ABAP, 'Z_MD_SCRATCH')
    expect(result.status).toBe('SUCCESS')
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('Hello Modern ABAP')
    expect(text).toContain('Total: 6')
    expect(validateModernSource('CDS', MODERN_TEMPLATES.CDS).status).toBe('VALID')
    expect(validateModernSource('RAP', MODERN_TEMPLATES.RAP).status).toBe('VALID')
    expect(validateModernSource('AMDP', MODERN_TEMPLATES.AMDP).status).toBe('VALID')
  })

  test('malformed Modern definitions are rejected', () => {
    expect(validateModernSource('CDS', 'define view entity ZI_BAD as select from sflight').status).toBe('INVALID')
    expect(
      validateModernSource(
        'RAP',
        'define behavior for ZI_Bad alias Bad\n{\n  create;\n}',
      ).status,
    ).toBe('INVALID')
    expect(
      validateModernSource(
        'AMDP',
        'CLASS zcl_bad DEFINITION.\nENDCLASS.\nCLASS zcl_bad IMPLEMENTATION.\nENDCLASS.',
      ).status,
    ).toBe('INVALID')
    expect(validateModernSource('ABAP', '').status).toBe('INVALID')
    expect(validateModernSource('ABAP', 'REPORT Z_OK.').status).toBe('EXECUTABLE')
  })

  test('training content is still present in the seed payload', () => {
    expect(topics.length).toBeGreaterThanOrEqual(10)
    expect(tables.length).toBeGreaterThanOrEqual(11)
    expect(all.length).toBe(37)
  })
})
