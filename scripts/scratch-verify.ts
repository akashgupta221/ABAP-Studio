// Scratch: verify syntax patterns planned for seed examples
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

const fms = new Map()
fms.set('Z_GET_FLIGHT', {
  name: 'Z_GET_FLIGHT',
  importing: [{ name: 'CARRID', type: 'CHAR', length: 3 }, { name: 'CONNID', type: 'NUMC', length: 4 }],
  exporting: [{ name: 'FLIGHT', type: 'SFLIGHT' }],
  changing: [], tables: [],
  prog: parseAbap(`FUNCTION 'Z_GET_FLIGHT'.
  SELECT SINGLE * FROM sflight INTO flight WHERE carrid = carrid AND connid = connid.
  IF sy-subrc <> 0.
    RAISE not_found.
  ENDIF.
ENDFUNCTION.`),
})

function run(name: string, source: string, params?: Record<string, string | string[]>) {
  let result
  try {
    result = runAbap({ source, repid: name, db, functionModules: fms, parameters: params })
  } catch (e: any) {
    console.log(`✗ ${name} — THREW: ${e.message}`)
    return
  }
  const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
  if (result.status === 'ERROR') {
    console.log(`✗ ${name} — ${result.error?.message} (line ${result.error?.line})`)
    console.log(text.slice(0, 400))
  } else {
    console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''}`)
    if (process.argv.includes('-v')) console.log(text)
  }
}

// 1. WRITE AT + FORMAT COLOR + ULINE + SKIP
run('T1_COLORS', `
REPORT T1.
FORMAT COLOR 1.
WRITE: / '        FLIGHT DATA REPORT'.
FORMAT COLOR OFF.
SKIP.
WRITE: / 'Carrier', AT 10 'Conn', AT 20 'Price'.
ULINE.
FORMAT COLOR 4.
WRITE: / 'AA', AT 10 '0017', AT 20 '425.40'.
FORMAT COLOR OFF.
WRITE AT /30(10) 'right pos' COLOR 5.
ULINE AT 1(40).
`)

// 2. COUNT(*) + SUM with GROUP BY
run('T2_AGG', `
REPORT T2.
TYPES: BEGIN OF ty_line,
        carrid TYPE c LENGTH 3,
        cnt    TYPE i,
        total  TYPE p DECIMALS 2,
      END OF ty_line.
DATA gt_lines TYPE STANDARD TABLE OF ty_line.
SELECT carrid COUNT(*) AS cnt SUM( price ) AS total FROM sflight INTO TABLE gt_lines GROUP BY carrid.
LOOP AT gt_lines INTO DATA(ls_line).
  WRITE: / |{ ls_line-carrid WIDTH = 4 }|, |{ ls_line-cnt WIDTH = 5 }|, |{ ls_line-total WIDTH = 10 DECIMALS = 2 }|.
ENDLOOP.
`)

// 3. SWITCH + COND + REDUCE
run('T3_MODERN', `
REPORT T3.
DATA(lv_grade) = 'B'.
DATA(lv_txt) = SWITCH #( lv_grade WHEN 'A' THEN 'Excellent' WHEN 'B' THEN 'Good' ELSE 'Other' ).
WRITE: / lv_txt.
DATA(lv_fact) = REDUCE #( INIT p = 1 FOR i = 1 THEN i + 1 WHILE i <= 5 NEXT p = p * i ).
WRITE: / |5! = { lv_fact }|.
`)

// 4. table expressions + line_exists + line_index
run('T4_TABLEX', `
REPORT T4.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_flights).
DATA(ls_aa) = lt_flights[ carrid = 'AA' connid = '0064' ].
WRITE: / |AA 0064 price: { ls_aa-price }|.
IF line_exists( lt_flights[ carrid = 'SQ' ] ).
  WRITE: / 'SQ exists'.
ENDIF.
DATA(lv_idx) = line_index( lt_flights[ carrid = 'LH' ] ).
WRITE: / |LH at index { lv_idx }|.
`)

// 5. FM call with IMPORTING + EXCEPTIONS
run('T5_FM', `
REPORT T5.
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
  WRITE: / |Flight { gs_flight-carrid } { gs_flight-connid } on { gs_flight-fldate }, fare { gs_flight-price } { gs_flight-currency }|.
ELSE.
  WRITE: / 'not found'.
ENDIF.
`)

// 6. INCLUDE resolution
const includes = new Map<string, string>()
includes.set('ZINC_TEST', `CONSTANTS: c_pi TYPE p DECIMALS 2 VALUE '3.14'.
FORM double USING p_n TYPE i CHANGING p_r TYPE i.
  p_r = p_n * 2.
ENDFORM.`)
run('T6_INCLUDE', `
REPORT T6.
INCLUDE ZINC_TEST.
DATA gv_r TYPE i.
PERFORM double USING 21 CHANGING gv_r.
WRITE: / |21 * 2 = { gv_r }, pi = { c_pi }|.
`, undefined as any)
// rerun with includes
try {
  const result = runAbap({ source: `REPORT T6.
INCLUDE ZINC_TEST.
DATA gv_r TYPE i.
PERFORM double USING 21 CHANGING gv_r.
WRITE: / |21 * 2 = { gv_r }, pi = { c_pi }|.`, repid: 'T6B', db, includes })
  console.log(result.status === 'SUCCESS' ? '✓ T6B include' : `✗ T6B ${result.error?.message}`)
  if (result.status !== 'SUCCESS') console.log(result.error)
} catch (e: any) { console.log('✗ T6B threw ' + e.message) }

// 7. PARAMETERS default → REQUIRES_INPUT then re-run with defaults {}
run('T7_PARAMS', `
REPORT T7.
PARAMETERS: p_carr TYPE c LENGTH 3 DEFAULT 'AA'.
SELECT * FROM sflight INTO TABLE @DATA(lt_f) WHERE carrid = @p_carr.
WRITE: / |Airline { p_carr }: { lines( lt_f ) } flights|.
`)
const r7 = runAbap({ source: `REPORT T7.
PARAMETERS: p_carr TYPE c LENGTH 3 DEFAULT 'AA'.
SELECT * FROM sflight INTO TABLE @DATA(lt_f) WHERE carrid = @p_carr.
WRITE: / |Airline { p_carr }: { lines( lt_f ) } flights|.`, repid: 'T7', db })
console.log('T7 no-params →', r7.status, r7.selectionScreen?.map((s) => `${s.name}=${(s as any).defaultValue}`))
const r7b = runAbap({ source: `REPORT T7.
PARAMETERS: p_carr TYPE c LENGTH 3 DEFAULT 'AA'.
SELECT * FROM sflight INTO TABLE @DATA(lt_f) WHERE carrid = @p_carr.
WRITE: / |Airline { p_carr }: { lines( lt_f ) } flights|.`, repid: 'T7', db, parameters: {} })
console.log('T7 with {} →', r7b.status, r7b.list.map((l) => l.segments.map((s) => s.text).join('')).join(''))

// 8. sy fields
run('T8_SYS', `
REPORT T8.
WRITE: / |User: { sy-uname }, Date: { sy-datum }, Time: { sy-uzeit }|.
WRITE: / |Program: { sy-repid }, Client: { sy-mandt }, System: { sy-sysid }|.
`)

// 9. string template WIDTH/ALIGN/PAD + nested templates
run('T9_TPL', `
REPORT T9.
WRITE: / |{ 'ABAP' WIDTH = 10 ALIGN = RIGHT PAD = '.' }END|.
WRITE: / |{ 'left' WIDTH = 8 }| && |{ 'right' WIDTH = 8 ALIGN = RIGHT }|.
WRITE: / |Center: { 42 WIDTH = 6 ALIGN = CENTER } done|.
`)

// 10. DO with varying + star pattern AT positions
run('T10_STARS', `
REPORT T10.
DO 5 TIMES.
  DATA(lv_n) = sy-index.
  DATA(lv_stars) = repeat( val = '*' occ = lv_n ).
  WRITE: / AT sy-index lv_stars COLOR 4.
ENDDO.
`)

// 11. INITIALIZATION + START-OF-SELECTION events
run('T11_EVENTS', `
REPORT T11 LINE-SIZE 120.
INITIALIZATION.
  DATA gv_started TYPE string VALUE 'init'.
START-OF-SELECTION.
  WRITE: / 'In START-OF-SELECTION:'.
  WRITE: / |User = { sy-uname }, Repid = { sy-repid }|.
`)

// 12. CLASS constructor + class-constructor
run('T12_CTOR', `
REPORT T12.
CLASS lcl_counter DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA: gv_count TYPE i.
    CLASS-METHODS: class_constructor.
    METHODS: constructor.
ENDCLASS.
CLASS lcl_counter IMPLEMENTATION.
  METHOD class_constructor.
    gv_count = 100.
    WRITE: / 'class_constructor executed'.
  ENDMETHOD.
  METHOD constructor.
    gv_count = gv_count + 1.
    WRITE: / |Instance created, count = { gv_count }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(o1) = NEW lcl_counter( ).
  DATA(o2) = NEW lcl_counter( ).
`)

// 13. WHILE with CONCATENATE
run('T13_STR', `
REPORT T13.
DATA lv_s TYPE string VALUE 'SAP'.
WHILE strlen( lv_s ) < 12.
  lv_s = lv_s && '*'.
ENDWHILE.
WRITE: / lv_s.
CONCATENATE 'ABAP' 'Workbench' INTO DATA(lv_t) SEPARATED BY space.
WRITE: / lv_t.
`)

// 14. REUSE ALV with IT_FIELDCAT VALUE #
run('T14_FCAT', `
REPORT T14.
SELECT carrid connid price currency FROM sflight INTO TABLE @DATA(lt_f).
DATA(lt_fcat) = VALUE slis_t_fieldcat_alv(
  ( fieldname = 'CARRID' seltext_l = 'Airline' )
  ( fieldname = 'CONNID' seltext_l = 'Flight No' )
  ( fieldname = 'PRICE'  seltext_l = 'Fare' )
  ( fieldname = 'CURRENCY' seltext_l = 'Curr' ) ).
CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    i_grid_title = 'Flights'
    it_fieldcat  = lt_fcat
  TABLES
    t_outtab     = lt_f.
`)
