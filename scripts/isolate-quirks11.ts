// Isolate part 11: FM end-to-end, JOIN, dates, selopts — final round
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()
db.tables.set('SCARR', {
  name: 'SCARR', description: 'Airline',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CARRNAME', type: 'CHAR', length: 20, text: 'Airline Name' },
    { name: 'CURRCODE', type: 'CHAR', length: 5, text: 'Currency' },
  ],
  rows: [
    { CARRID: 'AA', CARRNAME: 'American Airlines', CURRCODE: 'USD' },
    { CARRID: 'LH', CARRNAME: 'Lufthansa', CURRCODE: 'EUR' },
  ],
})
db.tables.set('SPFLI', {
  name: 'SPFLI', description: 'Flight schedule',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'CITYFROM', type: 'CHAR', length: 20, text: 'Departure City' },
    { name: 'CITYTO', type: 'CHAR', length: 20, text: 'Arrival City' },
    { name: 'DEPTIME', type: 'TIMS', text: 'Departure Time' },
    { name: 'DISTANCE', type: 'QUAN', length: 9, decimals: 2, text: 'Distance' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', CITYFROM: 'NEW YORK', CITYTO: 'SAN FRANCISCO', DEPTIME: '110000', DISTANCE: '4142.00' },
    { CARRID: 'LH', CONNID: '0400', CITYFROM: 'FRANKFURT', CITYTO: 'NEW YORK', DEPTIME: '103000', DISTANCE: '6200.00' },
  ],
})
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
    { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Currency' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max Seats' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occupied' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40', CURRENCY: 'USD', SEATSMAX: '280', SEATSOCC: '220' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR', SEATSMAX: '350', SEATSOCC: '300' },
  ],
})

const fms = new Map<any, any>()
function reg(name: string, src: string, importing: any[], exporting: any[]) {
  fms.set(name, { name, importing, exporting, changing: [], tables: [], prog: parseAbap(src) })
}

reg('Z_GET_FLIGHT_DETAILS', `FUNCTION 'Z_GET_FLIGHT_DETAILS'.
  DATA: lv_carrid TYPE sflight-carrid,
        lv_connid TYPE sflight-connid.
  lv_carrid = carrid.
  lv_connid = connid.
  SELECT SINGLE * FROM sflight INTO flight WHERE carrid = lv_carrid AND connid = lv_connid.
  IF sy-subrc <> 0.
    RAISE not_found.
  ENDIF.
ENDFUNCTION.`, [
  { name: 'CARRID', type: 'CHAR', length: 3 },
  { name: 'CONNID', type: 'NUMC', length: 4 },
], [
  { name: 'FLIGHT', type: 'SFLIGHT' },
])

reg('Z_CALC_DISCOUNT', `FUNCTION 'Z_CALC_DISCOUNT'.
  DATA: lv_price TYPE p DECIMALS 2,
        lv_type  TYPE c LENGTH 1.
  lv_price = price.
  lv_type  = cust_type.
  IF lv_type = 'P'.
    discount_pct = '10.00'.
  ELSEIF lv_type = 'G'.
    discount_pct = '5.00'.
  ELSE.
    discount_pct = '0.00'.
  ENDIF.
  discount_price = lv_price - ( lv_price * discount_pct / 100 ).
ENDFUNCTION.`, [
  { name: 'PRICE', type: 'DEC', length: 10, decimals: 2 },
  { name: 'CUST_TYPE', type: 'CHAR', length: 1 },
], [
  { name: 'DISCOUNT_PRICE', type: 'DEC', length: 10, decimals: 2 },
  { name: 'DISCOUNT_PCT', type: 'DEC', length: 5, decimals: 2 },
])

function run(name: string, source: string, params?: any) {
  try {
    const result = runAbap({ source, repid: name, db, functionModules: fms, parameters: params })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} :: ${JSON.stringify(text.slice(0, 300))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// D1: FM found + not-found with sacrificial SKIP
run('D1_FM', `
REPORT D1.
DATA gs_flight TYPE sflight.
WRITE: / '== Calling Z_GET_FLIGHT_DETAILS for AA 0017 =='.
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
  WRITE: / |Found: { gs_flight-carrid } { gs_flight-connid } on { gs_flight-fldate } fare { gs_flight-price } { gs_flight-currency }|.
ELSE.
  WRITE: / |Not found, sy-subrc = { sy-subrc }|.
ENDIF.
WRITE: / '== Calling for XX 9999 =='.
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
  WRITE: / |Found: { gs_flight-carrid } fare { gs_flight-price }|.
ELSE.
  WRITE: / |Not found, sy-subrc = { sy-subrc }|.
ENDIF.
`)

// D2: Z_CALC_DISCOUNT
run('D2_DISC', `
REPORT D2.
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
WRITE: / |Premium: 1000.00 -> { gv_new } ({ gv_pct }%)|.
`)

// D3: JOIN SPFLI + SCARR
run('D3_JOIN', `
REPORT D3.
TYPES: BEGIN OF ty_route,
         carrid   TYPE c LENGTH 3,
         carrname TYPE c LENGTH 20,
         connid   TYPE c LENGTH 4,
         cityfrom TYPE c LENGTH 20,
         cityto   TYPE c LENGTH 20,
       END OF ty_route.
DATA gt_routes TYPE STANDARD TABLE OF ty_route.
SELECT spfli~carrid scarr~carrname spfli~connid spfli~cityfrom spfli~cityto
  FROM spfli INNER JOIN scarr ON spfli~carrid = scarr~carrid
  INTO TABLE gt_routes.
WRITE: / |Routes: { lines( gt_routes ) }|.
LOOP AT gt_routes INTO DATA(ls).
  WRITE: / ls-carrid, ls-carrname, ls-connid, ls-cityfrom, '->', ls-cityto.
ENDLOOP.
`)

// D4: date/time/numc display via WRITE
run('D4_TYPES_OUT', `
REPORT D4.
DATA: gs TYPE sflight.
SELECT SINGLE * FROM sflight INTO gs WHERE carrid = 'AA'.
WRITE: / gs-fldate.
WRITE: / gs-connid.
WRITE: / gs-price.
DATA gs_p TYPE spfli.
SELECT SINGLE * FROM spfli INTO gs_p WHERE carrid = 'AA'.
WRITE: / gs_p-deptime.
WRITE: / gs_p-distance.
`)

// D5: PARAMETERS + SELECT-OPTIONS with defaults rerun {}
run('D5_SEL', `
REPORT D5.
PARAMETERS: p_city TYPE c LENGTH 20 DEFAULT 'NEW YORK'.
SELECT-OPTIONS: s_dist FOR spfli-distance.
SELECT * FROM spfli INTO TABLE @DATA(lt_f) WHERE cityto = @p_city AND distance IN @s_dist.
WRITE: / |Flights to { p_city }: { lines( lt_f ) }|.
LOOP AT lt_f INTO DATA(ls).
  WRITE: / ls-carrid, ls-connid, ls-cityfrom, ls-distance.
ENDLOOP.
`)
const r5 = runAbap({
  source: `REPORT D5.
PARAMETERS: p_city TYPE c LENGTH 20 DEFAULT 'NEW YORK'.
SELECT-OPTIONS: s_dist FOR spfli-distance.
SELECT * FROM spfli INTO TABLE @DATA(lt_f) WHERE cityto = @p_city AND distance IN @s_dist.
WRITE: / |Flights to { p_city }: { lines( lt_f ) }|.
LOOP AT lt_f INTO DATA(ls).
  WRITE: / ls-carrid, ls-connid, ls-cityfrom, ls-distance.
ENDLOOP.`, repid: 'D5', db, functionModules: fms,
})
console.log('D5 no-params →', r5.status)
const r5b = runAbap({
  source: `REPORT D5.
PARAMETERS: p_city TYPE c LENGTH 20 DEFAULT 'NEW YORK'.
SELECT-OPTIONS: s_dist FOR spfli-distance.
SELECT * FROM spfli INTO TABLE @DATA(lt_f) WHERE cityto = @p_city AND distance IN @s_dist.
WRITE: / |Flights to { p_city }: { lines( lt_f ) }|.
LOOP AT lt_f INTO DATA(ls).
  WRITE: / ls-carrid, ls-connid, ls-cityfrom, ls-distance.
ENDLOOP.`, repid: 'D5', db, functionModules: fms, parameters: {},
})
console.log('D5 with {} →', r5b.status, r5b.list.map((l) => l.segments.map((s) => s.text).join('')).join('|'))

// D6: ORDER BY with GROUP BY
run('D6_ORDER', `
REPORT D6.
TYPES: BEGIN OF ty_l,
         carrid TYPE c LENGTH 3,
         cnt TYPE i,
       END OF ty_l.
DATA gt TYPE STANDARD TABLE OF ty_l.
SELECT carrid COUNT(*) AS cnt FROM sflight INTO TABLE gt GROUP BY carrid ORDER BY carrid ASCENDING.
LOOP AT gt INTO DATA(ls).
  WRITE: / |{ ls-carrid }: { ls-cnt DECIMALS = 0 }|.
ENDLOOP.
`)
