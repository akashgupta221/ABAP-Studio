import { describe, expect, test } from 'bun:test'
import { prettyPrintAbap } from '../src/lib/abap/pretty'
import { applySelectionFilters, parseSelectionFilters, rowMatchesCriterion } from '../src/lib/table-filters'

describe('Pretty Printer (adapted from App 2)', () => {
  test('indents nested blocks with two spaces per level', () => {
    const src = `REPORT zpp.
IF lv_x > 1.
WRITE 'a'.
ELSE.
WRITE 'b'.
ENDIF.
`
    const out = prettyPrintAbap(src)
    expect(out).toBe(`REPORT zpp.
IF lv_x > 1.
  WRITE 'a'.
ELSE.
  WRITE 'b'.
ENDIF.
`)
  })

  test('upper-cases known keywords but not identifiers or string literals', () => {
    const out = prettyPrintAbap(`report zpp.\ndata lv_msg type string.\nlv_msg = 'keep lower'.\nwrite lv_msg.\n`)
    expect(out).toContain('REPORT zpp.')
    expect(out).toContain('DATA lv_msg TYPE string.')
    expect(out).toContain("lv_msg = 'keep lower'.") // literal untouched, variable untouched
    expect(out).toContain('WRITE lv_msg.')
  })

  test('FORM/PERFORM, METHOD and CLASS blocks indent and dedent', () => {
    const out = prettyPrintAbap(`report zpp.
form helper.
if 1 = 1.
write 'x'.
endif.
endform.
`)
    const lines = out.split('\n')
    expect(lines[1]).toBe('FORM helper.')
    expect(lines[2]).toBe('  IF 1 = 1.')
    expect(lines[3]).toBe("    WRITE 'x'.")
    expect(lines[4]).toBe('  ENDIF.')
    expect(lines[5]).toBe('ENDFORM.')
  })

  test('comments and blank lines keep their position unindented', () => {
    const out = prettyPrintAbap(`report zpp.
* full-line comment
if 1 = 1.

write 'x'.
endif.
`)
    const lines = out.split('\n')
    expect(lines[1]).toBe('* full-line comment')
    expect(lines[2]).toBe('IF 1 = 1.')
    expect(lines[3]).toBe('')
    expect(lines[4]).toBe("  WRITE 'x'.")
  })

  test('formatting is idempotent', () => {
    const src = `report zpp.\ndo 3 times.\nwrite sy-index.\nenddo.\n`
    expect(prettyPrintAbap(prettyPrintAbap(src))).toBe(prettyPrintAbap(src))
  })
})

describe('SE16 selection criteria', () => {
  const rows = [
    { MATNR: 'A1', MTART: 'FERT', WERKS: '1000' },
    { MATNR: 'A2', MTART: 'HALB', WERKS: '2000' },
    { MATNR: 'B1', MTART: 'FERT', WERKS: '3000' },
    { MATNR: 'C9', MTART: 'ROH', WERKS: '1000' },
  ]

  test('parseSelectionFilters validates and normalizes', () => {
    expect(parseSelectionFilters(null)).toBeUndefined() // absent — no filtering
    expect(parseSelectionFilters('nope')).toBeNull()
    expect(parseSelectionFilters('[]')).toEqual([])
    expect(parseSelectionFilters(JSON.stringify([{ field: 'matnr', op: 'eq', low: 'A1' }]))).toEqual([
      { field: 'MATNR', op: 'EQ', low: 'A1', high: '' },
    ])
    // BT requires both bounds
    expect(parseSelectionFilters(JSON.stringify([{ field: 'A', op: 'BT', low: '1' }]))).toBeNull()
    // unknown op rejected
    expect(parseSelectionFilters(JSON.stringify([{ field: 'A', op: 'XX', low: '1' }]))).toBeNull()
  })

  test('EQ, NE and BT filter numerically and lexically', () => {
    expect(applySelectionFilters(rows, [{ field: 'MTART', op: 'EQ', low: 'FERT', high: '' }])).toHaveLength(2)
    expect(applySelectionFilters(rows, [{ field: 'MTART', op: 'NE', low: 'FERT', high: '' }])).toHaveLength(2)
    // inclusive bounds: 1000, 2000 and 1000 again
    expect(applySelectionFilters(rows, [{ field: 'WERKS', op: 'BT', low: '1000', high: '2000' }])).toHaveLength(3)
  })

  test('CP supports * and + wildcards', () => {
    expect(applySelectionFilters(rows, [{ field: 'MATNR', op: 'CP', low: 'A*', high: '' }])).toHaveLength(2)
    expect(applySelectionFilters(rows, [{ field: 'MATNR', op: 'CP', low: 'A+', high: '' }])).toHaveLength(2)
    expect(applySelectionFilters(rows, [{ field: 'MATNR', op: 'CP', low: 'B1', high: '' }])).toHaveLength(1)
    expect(rowMatchesCriterion(rows[2], { field: 'MATNR', op: 'CP', low: 'A1', high: '' })).toBe(false)
  })

  test('multiple criteria are AND-combined', () => {
    const out = applySelectionFilters(rows, [
      { field: 'WERKS', op: 'EQ', low: '1000', high: '' },
      { field: 'MTART', op: 'EQ', low: 'ROH', high: '' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].MATNR).toBe('C9')
  })
})
