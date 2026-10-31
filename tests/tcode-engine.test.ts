// ── Classic workbench transaction engine tests ─────────────────────────
// SE91 message classes · SNRO NUMBER_GET_NEXT · AL11 application-server files
import { describe, expect, test } from 'bun:test'
import { DbSnapshot, runAbap } from '../src/lib/abap'

function listText(r: { list: any[] }): string {
  return (r.list ?? []).map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join(' ')).join('\n')
}

describe('SE91 message classes', () => {
  const messageClasses = new Map([
    ['ZMSG_TRAINING', { '001': 'Flight &1 to &2 created', '002': 'Price &1 is invalid' }],
  ])

  test('MESSAGE e001(ZCLASS) resolves stored text with &1..&4 substitution', () => {
    const r = runAbap({
      source: "REPORT ZT.\nMESSAGE s001(ZMSG_TRAINING) WITH 'LH0400' 'TOKYO'.",
      repid: 'ZT', db: new DbSnapshot(), messageClasses,
    })
    expect(r.status).toBe('SUCCESS')
    expect(r.messages[0]?.text).toBe('Flight LH0400 to TOKYO created')
    expect(r.messages[0]?.msgType).toBe('S')
  })

  test('sy-msgid/sy-msgno/sy-msgv1 are populated', () => {
    const r = runAbap({
      source: "REPORT ZT.\nMESSAGE e002(ZMSG_TRAINING) WITH '999'.\nWRITE 'never'.",
      repid: 'ZT', db: new DbSnapshot(), messageClasses,
    })
    expect(r.status).toBe('ERROR') // E aborts
    const syText = listText(r)
    expect(r.messages[0]?.text).toBe('Price 999 is invalid')
  })

  test('unknown class falls back to the synthesized message', () => {
    const r = runAbap({
      source: "REPORT ZT.\nMESSAGE e999(ZNOPE) WITH 'x'.",
      repid: 'ZT', db: new DbSnapshot(), messageClasses,
    })
    expect(r.status).toBe('ERROR')
    expect(r.messages[0]?.text).toContain('Message 999(ZNOPE)')
  })
})

describe('SNRO number ranges', () => {
  const numberRanges = new Map([['ZTRAIN_ORDER', { from: 1, to: 5, current: 3 }]])

  test("CALL FUNCTION 'NUMBER_GET_NEXT' returns the next number in sequence", () => {
    const r = runAbap({
      source: `REPORT ZT.
DATA n TYPE n LENGTH 10.
DO 2 TIMES.
  CALL FUNCTION 'NUMBER_GET_NEXT'
    EXPORTING
      object      = 'ZTRAIN_ORDER'
      nr_range_nr = '01'
    IMPORTING
      number      = n.
  WRITE / n.
ENDDO.`,
      repid: 'ZT', db: new DbSnapshot(), numberRanges,
    })
    expect(r.status).toBe('SUCCESS')
    const t = listText(r)
    expect(t).toContain('0000000004')
    expect(t).toContain('0000000005')
  })

  test('exhausted ranges fail loudly', () => {
    const exhausted = new Map([['ZTRAIN_ORDER', { from: 1, to: 5, current: 5 }]])
    const r = runAbap({
      source: `REPORT ZT.
DATA n TYPE n LENGTH 10.
CALL FUNCTION 'NUMBER_GET_NEXT'
  EXPORTING
    object = 'ZTRAIN_ORDER'
  IMPORTING
    number = n.`,
      repid: 'ZT', db: new DbSnapshot(), numberRanges: exhausted,
    })
    expect(r.status).toBe('ERROR')
    expect(r.error?.message).toContain('exhausted')
  })

  test('unknown number range objects fail loudly', () => {
    const r = runAbap({
      source: `REPORT ZT.
DATA n TYPE n LENGTH 10.
CALL FUNCTION 'NUMBER_GET_NEXT'
  EXPORTING
    object = 'ZNOPE'
  IMPORTING
    number = n.`,
      repid: 'ZT', db: new DbSnapshot(), numberRanges,
    })
    expect(r.status).toBe('ERROR')
    expect(r.error?.message).toContain('does not exist')
  })
})

describe('AL11 application server files', () => {
  const files = new Map([['/tmp/training/flights.txt', 'LH,0400,NEW YORK\nSQ,0001,TOKYO\n']])

  test('OPEN/READ DATASET walks a persisted file line by line', () => {
    const r = runAbap({
      source: `REPORT ZT.
DATA line TYPE string.
OPEN DATASET '/tmp/training/flights.txt' FOR INPUT IN TEXT MODE ENCODING DEFAULT.
DO.
  READ DATASET '/tmp/training/flights.txt' INTO line.
  IF sy-subrc <> 0. EXIT. ENDIF.
  WRITE / line.
ENDDO.
CLOSE DATASET '/tmp/training/flights.txt'.`,
      repid: 'ZT', db: new DbSnapshot(), files,
    })
    expect(r.status).toBe('SUCCESS')
    const t = listText(r)
    expect(t).toContain('LH,0400,NEW YORK')
    expect(t).toContain('SQ,0001,TOKYO')
  })

  test('OPEN FOR OUTPUT creates a run-local file that TRANSFER fills', () => {
    const r = runAbap({
      source: `REPORT ZT.
DATA out TYPE string.
out = 'written by ABAP'.
OPEN DATASET '/tmp/training/out.txt' FOR OUTPUT IN TEXT MODE ENCODING DEFAULT.
TRANSFER out TO '/tmp/training/out.txt'.
CLOSE DATASET '/tmp/training/out.txt'.

DATA line TYPE string.
OPEN DATASET '/tmp/training/out.txt' FOR INPUT IN TEXT MODE ENCODING DEFAULT.
READ DATASET '/tmp/training/out.txt' INTO line.
CLOSE DATASET '/tmp/training/out.txt'.
WRITE / line.`,
      repid: 'ZT', db: new DbSnapshot(), files,
    })
    expect(r.status).toBe('SUCCESS')
    expect(listText(r)).toContain('written by ABAP')
  })

  test('INPUT on a missing file sets sy-subrc 8', () => {
    const r = runAbap({
      source: `REPORT ZT.
OPEN DATASET '/tmp/training/missing.txt' FOR INPUT IN TEXT MODE ENCODING DEFAULT.
WRITE sy-subrc.`,
      repid: 'ZT', db: new DbSnapshot(), files,
    })
    expect(r.status).toBe('SUCCESS')
    expect(listText(r)).toContain('8')
  })
})

// ── SLG1 application logs (BAL_* built-ins) ────────────────────────────
describe('SLG1 application logs', () => {
  test('BAL_LOG_CREATE + BAL_LOG_MSG_ADD + BAL_DB_SAVE produce result.appLogs', () => {
    const r = runAbap({
      source: `REPORT ZLOG.
DATA h TYPE c LENGTH 20.
CALL FUNCTION 'BAL_LOG_CREATE'
  EXPORTING
    i_object         = 'ZQA'
    i_external_number = 'RUN-1'
  IMPORTING
    e_log_handle     = h.
CALL FUNCTION 'BAL_LOG_MSG_ADD'
  EXPORTING
    i_log_handle = h
    i_msgty      = 'I'
    i_text       = 'Job processed 12 orders'.
CALL FUNCTION 'BAL_LOG_MSG_ADD'
  EXPORTING
    i_log_handle = h
    i_msgty      = 'W'
    i_text       = 'One order skipped'.
CALL FUNCTION 'BAL_DB_SAVE'.
WRITE / 'log saved'.`,
      repid: 'ZLOG', db: new DbSnapshot(),
    })
    expect(r.status).toBe('SUCCESS')
    expect(r.appLogs).toHaveLength(1)
    expect(r.appLogs![0].object).toBe('ZQA')
    expect(r.appLogs![0].externalNumber).toBe('RUN-1')
    expect(r.appLogs![0].messages).toHaveLength(2)
    expect(r.appLogs![0].messages[0]).toEqual({ msgType: 'I', text: 'Job processed 12 orders' })
  })

  test('BAL_LOG_MSG_ADD with a bad handle sets sy-subrc 4 and saves nothing', () => {
    const r = runAbap({
      source: `REPORT ZLOG.
DATA h TYPE c LENGTH 20.
DATA rc TYPE i.
CALL FUNCTION 'BAL_LOG_MSG_ADD' EXPORTING i_log_handle = h i_msgty = 'I' i_text = 'orphan'.
rc = sy-subrc.
CALL FUNCTION 'BAL_DB_SAVE'.
WRITE / rc.`,
      repid: 'ZLOG', db: new DbSnapshot(),
    })
    expect(r.status).toBe('SUCCESS')
    expect(r.appLogs).toBeUndefined()
    expect(listText(r)).toContain('4')
  })
})

// ── ABAP Query generation (SQ01/SQ02) ──────────────────────────────────
describe('ABAP Query generation', () => {
  test('generateQuerySource builds executable SELECT over the base table', async () => {
    const { generateQuerySource } = await import('../src/lib/query-gen')
    const snap = new DbSnapshot()
    snap.tables.set('ZQ', {
      name: 'ZQ', description: 'q', fields: [
        { name: 'ID', type: 'CHAR', length: 3, key: true },
        { name: 'CITY', type: 'CHAR', length: 20 },
        { name: 'PRICE', type: 'DEC', length: 10, decimals: 2 },
      ], rows: [
        { ID: 'A', CITY: 'BERLIN', PRICE: '10.00' },
        { ID: 'B', CITY: 'PARIS', PRICE: '20.00' },
      ],
    })
    const { source } = generateQuerySource('ZQ', ['ID', 'PRICE'], [{ field: 'PRICE', op: 'GT', low: '15' }], snap)
    const r = runAbap({ source, repid: 'ZQUERY', db: snap })
    expect(r.status).toBe('SUCCESS')
    const text = listText(r)
    expect(text).toMatch(/Entries found:\s+1/)
    expect(text).toContain('B')
    expect(text).toContain('20.00')
    expect(text).not.toContain('BERLIN')
  })

  test('unknown filter field is rejected', async () => {
    const { generateQuerySource } = await import('../src/lib/query-gen')
    const snap = new DbSnapshot()
    snap.tables.set('ZQ', { name: 'ZQ', description: '', fields: [{ name: 'ID', type: 'CHAR', length: 3, key: true }], rows: [] })
    expect(() => generateQuerySource('ZQ', ['ID'], [{ field: 'NOPE', op: 'EQ', low: 'x' }], snap)).toThrow(/not a field/)
  })
})

// ── VALUE #( ) rows must convert into the typed line struct (SORT/SUM depend on it) ──
describe('typed table row conversion', () => {
  test('APPEND VALUE #( ) then SORT numeric + SUM accumulates correctly', () => {
    const r = runAbap({
      source: `REPORT Z.
TYPES: BEGIN OF ty_sales, region TYPE c LENGTH 10, amount TYPE p DECIMALS 2, END OF ty_sales.
DATA it TYPE STANDARD TABLE OF ty_sales WITH DEFAULT KEY.
DATA wa TYPE ty_sales.
APPEND VALUE #( region = 'EAST' amount = '1200.00' ) TO it.
APPEND VALUE #( region = 'WEST' amount = '800.50' ) TO it.
APPEND VALUE #( region = 'EAST' amount = '450.25' ) TO it.
APPEND VALUE #( region = 'WEST' amount = '300.00' ) TO it.
SORT it BY region amount DESCENDING.
LOOP AT it INTO wa.
  AT NEW region.
    WRITE: / 'Region:', wa-region.
  ENDAT.
  WRITE: / '  sale:', wa-amount.
  AT END OF region.
    SUM.
    WRITE: / '  subtotal:', wa-amount.
  ENDAT.
ENDLOOP.`,
      repid: 'Z', db: new DbSnapshot(),
    })
    expect(r.status).toBe('SUCCESS')
    const lines = (r.list ?? []).map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join(''))
    const text = lines.join('\n')
    // numeric DESC within group: 1200.00 before 450.25 (string sort would flip it)
    expect(text).toContain('1650.25')
    expect(text).toContain('1100.50')
    expect(lines.findIndex((l: string) => l.includes('1200.00'))).toBeLessThan(lines.findIndex((l: string) => l.includes('450.25')))
  })
})
