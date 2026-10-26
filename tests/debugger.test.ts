import { describe, expect, test } from 'bun:test'
import { DbSnapshot, runAbap, runAbapDebug, type DebugControl, type DebugStopContext } from '../src/lib/abap'
import { parseAbap } from '../src/lib/abap/parser'

const PROGRAM = `REPORT zdbg.
DATA: lv_a TYPE i VALUE 3,
      lv_b TYPE i,
      lv_c TYPE i.
lv_a = 5.
lv_b = 10.
lv_c = lv_a + lv_b.
WRITE: / 'SUM:', lv_c.
FORM helper.
  lv_b = 99.
ENDFORM.
PERFORM helper.
WRITE: / 'AFTER', lv_b.
`

const FM_PROGRAM = `REPORT zdbgfm.
DATA lv_result TYPE i.
CALL FUNCTION 'Z_DBG_DOUBLE'
  EXPORTING iv_in = 21
  IMPORTING ev_out = lv_result.
WRITE: / lv_result.
`

function db(): DbSnapshot {
  return new DbSnapshot()
}

/** collect every stop line of a full run by stepping one-by-one (like the UI does) */
function allStopLines(source: string, parameters?: Record<string, string | string[]>): number[] {
  const lines: number[] = []
  let stopIndex = 0
  for (let guard = 0; guard < 500; guard++) {
    const control: DebugControl = {
      shouldStop: (ctx: DebugStopContext) => (stopIndex === 0 ? true : ctx.stopIndex > stopIndex),
    }
    const { paused, result } = runAbapDebug({ source, repid: 'ZDBG', db: db(), parameters }, control)
    if (result) break
    if (!paused) break
    stopIndex = paused.stopIndex
    lines.push(paused.line)
  }
  return lines
}

describe('ABAP debugger (stateless re-execution stepping)', () => {
  test('start stops at the first executable statement, skipping declarations', () => {
    const { paused, result } = runAbapDebug({ source: PROGRAM, repid: 'ZDBG', db: db() }, { shouldStop: () => true })
    expect(result).toBeNull()
    expect(paused).not.toBeNull()
    expect(paused!.stopIndex).toBe(1)
    expect(paused!.line).toBe(5) // first statement after REPORT/DATA
    expect(paused!.statement).toBe('lv_a = 5.')
    expect(paused!.depth).toBe(0)
  })

  test('variables snapshot shows globals with values', () => {
    const { paused } = runAbapDebug({ source: PROGRAM, repid: 'ZDBG', db: db() }, { shouldStop: () => true })
    const names = paused!.variables.map((v) => v.name)
    expect(names).toContain('LV_A')
    const a = paused!.variables.find((v) => v.name === 'LV_A')!
    expect(a.kind).toBe('I')
    expect(a.value).toBe('3') // paused BEFORE executing lv_a = 5
  })

  test('stepInto advances statement by statement, entering the FORM', () => {
    const lines = allStopLines(PROGRAM)
    // 5=lv_a=5, 6=lv_b=10, 7=lv_c=..., 8=WRITE, 12=PERFORM, 10=FORM body, 13=WRITE AFTER
    expect(lines.slice(0, 4)).toEqual([5, 6, 7, 8])
    expect(lines).toEqual([5, 6, 7, 8, 12, 10, 13])
  })

  test('variables reflect executed state at a later stop', () => {
    // stop at stop #3 (lv_c = lv_a + lv_b) — before it executes, after a=5, b=10
    const { paused } = runAbapDebug(
      { source: PROGRAM, repid: 'ZDBG', db: db() },
      { shouldStop: (ctx) => ctx.stopIndex >= 3 },
    )
    expect(paused!.line).toBe(7)
    const a = paused!.variables.find((v) => v.name === 'LV_A')!
    const b = paused!.variables.find((v) => v.name === 'LV_B')!
    expect(a.value).toBe('5')
    expect(b.value).toBe('10')
  })

  test('stepOver from PERFORM skips the FORM body', () => {
    // stop at the PERFORM statement (stop #5) then stepOver: next stop depth <= 0
    const { paused } = runAbapDebug({ source: PROGRAM, repid: 'ZDBG', db: db() }, { shouldStop: (c) => c.stopIndex >= 5 })
    expect(paused!.statement).toBe('PERFORM helper.')
    const { paused: after, result } = runAbapDebug(
      { source: PROGRAM, repid: 'ZDBG', db: db() },
      { shouldStop: (c) => c.stopIndex > 5 && c.depth <= 0 },
    )
    expect(after).not.toBeNull()
    expect(after!.line).toBe(13) // WRITE: / 'AFTER', lv_b.
    expect(after!.depth).toBe(0)
    expect(result).toBeNull()
  })

  test('stepInto from PERFORM enters the FORM (depth 1)', () => {
    const { paused } = runAbapDebug({ source: PROGRAM, repid: 'ZDBG', db: db() }, { shouldStop: (c) => c.stopIndex >= 5 })
    expect(paused!.statement).toBe('PERFORM helper.')
    const { paused: inside } = runAbapDebug(
      { source: PROGRAM, repid: 'ZDBG', db: db() },
      { shouldStop: (c) => c.stopIndex > 5 },
    )
    expect(inside).not.toBeNull()
    expect(inside!.line).toBe(10) // lv_b = 99. inside FORM
    expect(inside!.depth).toBe(1)
  })

  test('continue runs to a breakpoint line', () => {
    const { paused, result } = runAbapDebug(
      { source: PROGRAM, repid: 'ZDBG', db: db() },
      { shouldStop: (c) => c.stopIndex > 1 && c.line === 8 },
    )
    expect(result).toBeNull()
    expect(paused!.line).toBe(8)
    expect(paused!.statement).toContain('WRITE')
  })

  test('continue without breakpoints runs to completion with output', () => {
    const { paused, result } = runAbapDebug(
      { source: PROGRAM, repid: 'ZDBG', db: db() },
      { shouldStop: () => false },
    )
    expect(paused).toBeNull()
    expect(result).not.toBeNull()
    expect(result!.status).toBe('SUCCESS')
    expect(result!.list.some((l) => l.segments.some((s) => s.text.includes('SUM:')))).toBe(true)
    expect(result!.list.some((l) => l.segments.some((s) => s.text.includes('AFTER')))).toBe(true)
  })

  test('stepInto enters a called function module', () => {
    const fmSource = `FUNCTION Z_DBG_DOUBLE.
  EV_OUT = IV_IN * 2.
ENDFUNCTION.
`
    const fm = new Map([
      [
        'Z_DBG_DOUBLE',
        {
          name: 'Z_DBG_DOUBLE',
          importing: [{ name: 'IV_IN', type: 'I' }],
          exporting: [{ name: 'EV_OUT', type: 'I' }],
          changing: [],
          tables: [],
          prog: parseAbap(fmSource),
        },
      ],
    ])
    // first stop = the CALL FUNCTION statement (stop #1; its source line points
    // at the statement's end, the parser's convention for multi-line statements)
    const { paused } = runAbapDebug({ source: FM_PROGRAM, repid: 'ZDBGFM', db: db(), functionModules: fm }, { shouldStop: () => true })
    expect(paused!.stopIndex).toBe(1)
    expect(paused!.depth).toBe(0)
    // step into → inside the FM at depth 1
    const { paused: inside } = runAbapDebug(
      { source: FM_PROGRAM, repid: 'ZDBGFM', db: db(), functionModules: fm },
      { shouldStop: (c) => c.stopIndex > 1 },
    )
    expect(inside).not.toBeNull()
    expect(inside!.depth).toBe(1)
  })

  test('programs with a selection screen require input before the debugger stops', () => {
    const src = `REPORT zdbgpar.
PARAMETERS p_test TYPE i DEFAULT 4.
WRITE: / p_test.
`
    const { paused, result } = runAbapDebug({ source: src, repid: 'ZDBGPAR', db: db() }, { shouldStop: () => true })
    expect(paused).toBeNull()
    expect(result!.status).toBe('REQUIRES_INPUT')

    const withParams = runAbapDebug(
      { source: src, repid: 'ZDBGPAR', db: db(), parameters: { P_TEST: '7' } },
      { shouldStop: () => true },
    )
    expect(withParams.paused).not.toBeNull()
    expect(withParams.paused!.line).toBe(3)
  })

  test('runtime errors surface as a normal result, not a pause', () => {
    const src = `REPORT zdbgerr.
DATA lv_x TYPE i VALUE 0.
DATA lv_y TYPE i.
lv_y = 1 / lv_x.
`
    const { paused, result } = runAbapDebug(
      { source: src, repid: 'ZDBGERR', db: db() },
      { shouldStop: (c) => c.stopIndex > 3 }, // never: run ends with the dump first
    )
    expect(paused).toBeNull()
    expect(result!.status).toBe('ERROR')
  })

  test('non-debug runs are unaffected by the debugger option (regression)', () => {
    const r = runAbap({ source: PROGRAM, repid: 'ZDBG', db: db() })
    expect(r.status).toBe('SUCCESS')
    expect(r.list.length).toBe(2)
  })
})
