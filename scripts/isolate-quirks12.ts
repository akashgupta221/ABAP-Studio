// Isolate part 12: FM with body-declared exports, selopt branching, include
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
    { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Currency' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40', CURRENCY: 'USD' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR' },
  ],
})

const fms = new Map<any, any>()
fms.set('Z_GET_FLIGHT_DETAILS', {
  name: 'Z_GET_FLIGHT_DETAILS',
  importing: [{ name: 'CARRID', type: 'CHAR', length: 3 }, { name: 'CONNID', type: 'NUMC', length: 4 }],
  exporting: [{ name: 'FLIGHT', type: 'SFLIGHT' }],
  changing: [], tables: [],
  prog: parseAbap(`FUNCTION 'Z_GET_FLIGHT_DETAILS'.
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
fms.set('Z_CALC_DISCOUNT', {
  name: 'Z_CALC_DISCOUNT',
  importing: [{ name: 'PRICE', type: 'DEC', length: 10, decimals: 2 }, { name: 'CUST_TYPE', type: 'CHAR', length: 1 }],
  exporting: [
    { name: 'DISCOUNT_PRICE', type: 'DEC', length: 10, decimals: 2 },
    { name: 'DISCOUNT_PCT', type: 'DEC', length: 5, decimals: 2 },
  ],
  changing: [], tables: [],
  prog: parseAbap(`FUNCTION 'Z_CALC_DISCOUNT'.
  DATA: price         TYPE p DECIMALS 2,
        cust_type     TYPE c LENGTH 1,
        discount_price TYPE p DECIMALS 2,
        discount_pct   TYPE p DECIMALS 2.
  price = price_in.
ENDFUNCTION.`),
})
// fix: import param names conflict — use body decl matching import names directly
fms.set('Z_CALC_DISCOUNT', {
  name: 'Z_CALC_DISCOUNT',
  importing: [{ name: 'PRICE', type: 'DEC', length: 10, decimals: 2 }, { name: 'CUST_TYPE', type: 'CHAR', length: 1 }],
  exporting: [
    { name: 'DISCOUNT_PRICE', type: 'DEC', length: 10, decimals: 2 },
    { name: 'DISCOUNT_PCT', type: 'DEC', length: 5, decimals: 2 },
  ],
  changing: [], tables: [],
  prog: parseAbap(`FUNCTION 'Z_CALC_DISCOUNT'.
  DATA: discount_price TYPE p DECIMALS 2,
        discount_pct   TYPE p DECIMALS 2.
  IF cust_type = 'P'.
    discount_pct = '10.00'.
  ELSEIF cust_type = 'G'.
    discount_pct = '5.00'.
  ELSE.
    discount_pct = '0.00'.
  ENDIF.
  discount_price = price - ( price * discount_pct / 100 ).
ENDFUNCTION.`),
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, functionModules: fms, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} :: ${JSON.stringify(text.slice(0, 320))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// E1: FM with body-declared exports — found + not found
run('E1_FM', `
REPORT E1.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
SKIP.
IF sy-subrc = 0.
  WRITE: / |Found: { gs_flight-carrid } { gs_flight-connid } { gs_flight-fldate } { gs_flight-price } { gs_flight-currency }|.
ELSE.
  WRITE: / |Not found, sy-subrc = { sy-subrc }|.
ENDIF.
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING
    carrid = 'XX'
    connid = '9999'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
SKIP.
IF sy-subrc = 0.
  WRITE: / |Found: { gs_flight-carrid }|.
ELSE.
  WRITE: / |XX 9999 not found, sy-subrc = { sy-subrc }|.
ENDIF.
`)

// E2: discount FM
run('E2_DISC', `
REPORT E2.
DATA: gv_new TYPE p DECIMALS 2,
      gv_pct TYPE p DECIMALS 2.
CALL FUNCTION 'Z_CALC_DISCOUNT'
  EXPORTING
    price     = '1000.00'
    cust_type = 'P'
  IMPORTING
    discount_price = gv_new
    discount_pct   = gv_pct.
SKIP.
WRITE: / |Premium 1000.00 → { gv_new } ({ gv_pct }% off)|.
CALL FUNCTION 'Z_CALC_DISCOUNT'
  EXPORTING
    price     = '1000.00'
    cust_type = 'G'
  IMPORTING
    discount_price = gv_new
    discount_pct   = gv_pct.
SKIP.
WRITE: / |Gold    1000.00 → { gv_new } ({ gv_pct }% off)|.
`)

// E3: selopt empty-range branch
run('E3_SELOPT', `
REPORT E3.
SELECT-OPTIONS: s_price FOR sflight-price.
IF lines( s_price ) = 0.
  SELECT * FROM sflight INTO TABLE @DATA(lt_f).
ELSE.
  SELECT * FROM sflight INTO TABLE @DATA(lt_f2) WHERE price IN @s_price.
ENDIF.
WRITE: / 'done'.
`, { parameters: {} })

// E4: include with forms + constants
const includes = new Map<string, string>()
includes.set('Z_INCLUDE_MATH', `CONSTANTS: gc_pi TYPE p DECIMALS 2 VALUE '3.14'.
FORM add USING p_a TYPE i p_b TYPE i CHANGING p_sum TYPE i.
  p_sum = p_a + p_b.
ENDFORM.
FORM multiply USING p_a TYPE i p_b TYPE i CHANGING p_prod TYPE i.
  p_prod = p_a * p_b.
ENDFORM.`)
run('E4_INCLUDE', `
REPORT E4.
INCLUDE Z_INCLUDE_MATH.
DATA: gv_sum TYPE i,
      gv_prod TYPE i.
PERFORM add USING 10, 20 CHANGING gv_sum.
PERFORM multiply USING 10, 20 CHANGING gv_prod.
WRITE: / |10 + 20 = { gv_sum }, 10 * 20 = { gv_prod }, PI = { gc_pi }|.
`, { includes })
