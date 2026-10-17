// Seed-content probe: isolate engine edge cases needed for seed programs
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT',
  description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
    { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Currency' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max Seats' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occupied Seats' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40', CURRENCY: 'USD', SEATSMAX: '280', SEATSOCC: '220' },
    { CARRID: 'AA', CONNID: '0064', FLDATE: '20250201', PRICE: '550.00', CURRENCY: 'USD', SEATSMAX: '380', SEATSOCC: '300' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR', SEATSMAX: '350', SEATSOCC: '300' },
    { CARRID: 'SQ', CONNID: '0198', FLDATE: '20250210', PRICE: '980.00', CURRENCY: 'SGD', SEATSMAX: '300', SEATSOCC: '290' },
  ],
})

function run(name: string, source: string, opts?: { fms?: Map<any, any>; params?: any; verbose?: boolean }) {
  let result
  try {
    result = runAbap({ source, repid: name, db, functionModules: opts?.fms, parameters: opts?.params })
  } catch (e: any) {
    console.log(`✗ ${name} — THREW: ${e.message}`)
    return null
  }
  const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
  if (result.status === 'ERROR') {
    console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
  } else {
    console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''}`)
  }
  if (opts?.verbose || process.argv.includes('-v')) console.log(text.split('\n').slice(0, 12).join('\n'))
  return result
}

// A: CALL FUNCTION with EXCEPTIONS — parser isolation
run('A_FM_EXC', `
REPORT A.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
IF sy-subrc = 0.
  WRITE: / 'found'.
ELSE.
  WRITE: / 'not found'.
ENDIF.
`)

// A2: same without EXCEPTIONS clause
run('A2_FM_NOEXC', `
REPORT A2.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight.
WRITE: / 'done'.
`)

// B: FM with body-declared DATA + RAISE + subrc — full registry
const fms = new Map<any, any>()
try {
  fms.set('Z_GET_FLIGHT', {
    name: 'Z_GET_FLIGHT',
    importing: [{ name: 'CARRID', type: 'CHAR', length: 3 }, { name: 'CONNID', type: 'NUMC', length: 4 }],
    exporting: [{ name: 'FLIGHT', type: 'SFLIGHT' }],
    changing: [], tables: [],
    prog: parseAbap(`FUNCTION 'Z_GET_FLIGHT'.
  DATA: lv_carrid TYPE sflight-carrid,
        lv_connid TYPE sflight-connid,
        flight    TYPE sflight.
  lv_carrid = carrid.
  lv_connid = connid.
  SELECT SINGLE * FROM sflight INTO flight WHERE carrid = lv_carrid AND connid = lv_connid.
  IF sy-subrc <> 0.
    RAISE not_found.
  ENDIF.
ENDFUNCTION.`),
  })
  console.log('(FM parsed OK)')
} catch (e: any) {
  console.log('FM PARSE FAIL:', e.message)
}

run('B_FM_FOUND', `
REPORT B.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
IF sy-subrc = 0.
  WRITE: / |Flight { gs_flight-carrid } { gs_flight-connid } fare { gs_flight-price }|.
ELSE.
  WRITE: / 'not found'.
ENDIF.
`, { fms, verbose: true })

run('B2_FM_NOTFOUND', `
REPORT B2.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'XX'
    connid = '9999'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
IF sy-subrc = 0.
  WRITE: / |Flight { gs_flight-carrid } fare { gs_flight-price }|.
ELSE.
  WRITE: / |Not found, sy-subrc = { sy-subrc }|.
ENDIF.
`, { fms, verbose: true })

// C: WRITE / AT pos(len) variants
run('C_WRITE_AT', `
REPORT C.
WRITE: / AT 5(10) 'hello' COLOR 5.
WRITE: /30(10) 'rightish' COLOR 5.
WRITE AT 2(8) 'plain'.
ULINE AT 1(40).
SKIP 2.
WRITE: / 'x'.
`)

// D: table expressions — single + multi cond
run('D_TABEXPR', `
REPORT D.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA(ls_a) = lt_f[ carrid = 'AA' ].
WRITE: / |AA price: { ls_a-price }|.
`)
run('D2_TABEXPR_MULTI', `
REPORT D2.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA(ls_a) = lt_f[ carrid = 'AA' connid = '0064' ].
WRITE: / |AA 0064 price: { ls_a-price }|.
`)
run('D3_LINE_EXISTS', `
REPORT D3.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
IF line_exists( lt_f[ carrid = 'SQ' ] ).
  WRITE: / 'SQ exists'.
ENDIF.
WRITE: / |LH idx: { line_index( lt_f[ carrid = 'LH' ] ) }|.
`)
