// Probe round 3: subtraction workarounds, FS mutation, REF, sorted tables, form untyped params
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT',
  description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max Seats' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occupied Seats' },
  ],
  rows: [
    { CARRID: 'AA', SEATSMAX: '385', SEATSOCC: '371' },
    { CARRID: 'LH', SEATSMAX: '280', SEATSOCC: '250' },
  ],
})

let pass = 0, fail = 0
function run(name: string, source: string, opts?: { includes?: Map<string, string>; expectText?: string }) {
  let result
  try {
    result = runAbap({ source, repid: name, db, includes: opts?.includes })
  } catch (e: any) { fail++; console.log(`✗ ${name} — THREW: ${e.message}`); return }
  const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
  const errs: string[] = []
  if (result.status === 'ERROR') errs.push(`error: ${result.error?.message} (line ${result.error?.line})`)
  if (opts?.expectText && !text.includes(opts.expectText)) errs.push(`missing "${opts.expectText}" — got ${JSON.stringify(text.slice(0, 250))}`)
  if (errs.length === 0) { pass++; console.log(`✓ ${name}`) }
  else { fail++; console.log(`✗ ${name} — ${errs.join('; ')}`); if (result.status !== 'ERROR') console.log(`   out: ${JSON.stringify(text.slice(0, 350))}`) }
  return result
}

// R1: SUBTRACT + numeric-literal subtraction
run('R1_SUBTRACT', `
REPORT R1.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 4.
SUBTRACT gv_b FROM gv_a.
WRITE: / 'a =', gv_a.
DATA(gv_c) = gv_a - 2.
WRITE: / 'c =', gv_c.
DATA(gv_d) = gv_a + ( -1 ) * gv_b.
WRITE: / 'd =', gv_d.
`)

// R2: FS simulation actually mutates rows
run('R2_FS_MUTATE', `
REPORT R2.
TYPES: BEGIN OF ty_e,
         name TYPE c LENGTH 10,
         sal  TYPE i,
       END OF ty_e.
DATA: gt TYPE STANDARD TABLE OF ty_e,
      fs TYPE ty_e,
      gs TYPE ty_e.
gs-name = 'AJAY'.  gs-sal = 5000. APPEND gs TO gt.
gs-name = 'MEERA'. gs-sal = 6000. APPEND gs TO gt.
LOOP AT gt ASSIGNING <fs>.
  <fs>-sal = <fs>-sal + 500.
ENDLOOP.
LOOP AT gt INTO gs.
  WRITE: / gs-name, gs-sal.
ENDLOOP.
`, { expectText: '5500' })

// R3: REF + deref
run('R3_REF', `
REPORT R3.
TYPES: BEGIN OF ty_e,
         name TYPE c LENGTH 10,
         sal  TYPE i,
       END OF ty_e.
DATA gs TYPE ty_e.
gs-name = 'ARJUN'. gs-sal = 7000.
DATA(lr) = REF #( gs ).
lr->*-sal = 8000.
WRITE: / gs-name, gs-sal.
`)

// R4: sorted table type
run('R4_SORTED', `
REPORT R4.
TYPES: BEGIN OF ty_n,
         n TYPE i,
       END OF ty_n.
TYPES ty_n_s TYPE SORTED TABLE OF ty_n WITH UNIQUE KEY n.
DATA gt TYPE ty_n_s.
DATA gs TYPE ty_n.
gs-n = 3. APPEND gs TO gt.
gs-n = 1. APPEND gs TO gt.
gs-n = 2. APPEND gs TO gt.
LOOP AT gt INTO gs.
  WRITE: / gs-n.
ENDLOOP.
`)

// R5: untyped FORM params (include style)
run('R5_FORM_UNTYPED', `
REPORT R5.
DATA lv_r TYPE i.
PERFORM add USING 5 3 CHANGING lv_r.
WRITE: / 'r =', lv_r.
FORM add USING a b CHANGING r.
  r = a + b.
ENDFORM.
`)

// R6: full include program
const includes = new Map<string, string>()
includes.set('Z_INCLUDE_MATH', `CONSTANTS: gc_pi TYPE p DECIMALS 5 VALUE '3.14159'.
FORM add USING a b CHANGING r.
  r = a + b.
ENDFORM.
FORM multiply USING a b CHANGING r.
  r = a * b.
ENDFORM.`)
run('R6_INCLUDE', `
REPORT R6.
INCLUDE Z_INCLUDE_MATH.
DATA: gv_sum TYPE i,
      gv_prod TYPE i.
PERFORM add USING 12 30 CHANGING gv_sum.
PERFORM multiply USING 12 30 CHANGING gv_prod.
WRITE: / |Sum: { gv_sum }, Product: { gv_prod }, Pi: { gc_pi }|.
`, { includes, expectText: 'Sum: 42' })

// R7: READ WITH KEY multi without ORDER BY
run('R7_READKEY', `
REPORT R7.
DATA gs TYPE sflight.
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
SORT lt_f BY carrid.
READ TABLE lt_f INTO gs WITH KEY carrid = 'LH'.
IF sy-subrc = 0.
  WRITE: / 'LH seats:', gs-seatsmax.
ENDIF.
`)

// R8: availability computation pattern for flight report
run('R8_AVAIL', `
REPORT R8.
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f INTO DATA(ls_f).
  DATA(lv_free) = ls_f-seatsmax.
  SUBTRACT ls_f-seatsocc FROM lv_free.
  IF lv_free > 0.
    WRITE: / |{ ls_f-carrid }: { lv_free } free|.
  ENDIF.
ENDLOOP.
`)

// R9: WHILE + CHECK + CONTINUE mix in one program
run('R9_CTRL', `
REPORT R9.
DATA: lv_i TYPE i VALUE 0,
      lv_sum TYPE i VALUE 0.
WHILE lv_i < 10.
  lv_i = lv_i + 1.
  CHECK lv_i MOD 2 = 0.
  lv_sum = lv_sum + lv_i.
ENDWHILE.
WRITE: / 'sum of evens:', lv_sum.
`)

// R10: MESSAGE + ULINE + color page header pattern (flight report core)
run('R10_HEADER', `
REPORT R10 LINE-SIZE 120 NO STANDARD PAGE HEADING.
DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      gs_flight  TYPE sflight,
      gv_totmax  TYPE i,
      gv_totocc  TYPE i.
SELECT * FROM sflight INTO TABLE gt_flights.
FORMAT COLOR 1.
WRITE: / AT 2 'FLIGHT AVAILABILITY REPORT'.
WRITE: / AT 2 |Date: { sy-datum }   Report: { sy-repid }   User: { sy-uname }|.
FORMAT COLOR OFF.
ULINE AT 1(78).
FORMAT COLOR 4.
WRITE: / AT 2 'Carrier', AT 12 'Max', AT 20 'Occ', AT 30 'Free'.
FORMAT COLOR OFF.
ULINE AT 1(78).
LOOP AT gt_flights INTO gs_flight.
  DATA(lv_free) = gs_flight-seatsmax.
  SUBTRACT gs_flight-seatsocc FROM lv_free.
  IF lv_free > 0.
    WRITE: / gs_flight-carrid COLOR 5, AT 12 gs_flight-seatsmax, AT 20 gs_flight-seatsocc, AT 30 lv_free.
  ELSE.
    WRITE: / gs_flight-carrid COLOR 6, AT 12 gs_flight-seatsmax, AT 20 gs_flight-seatsocc, AT 30 lv_free.
  ENDIF.
  gv_totmax = gv_totmax + gs_flight-seatsmax.
  gv_totocc = gv_totocc + gs_flight-seatsocc.
ENDLOOP.
ULINE AT 1(78).
FORMAT COLOR 3.
WRITE: / 'Total', AT 12 gv_totmax, AT 20 gv_totocc.
FORMAT COLOR OFF.
`)

// R11: COUNT/SUM/AVG/MIN/MAX group by (no ORDER BY)
run('R11_AGG', `
REPORT R11.
TYPES: BEGIN OF ty_a,
         carrid TYPE c LENGTH 3,
         cnt    TYPE i,
         total  TYPE p DECIMALS 2,
       END OF ty_a.
DATA gt_a TYPE STANDARD TABLE OF ty_a.
SELECT carrid COUNT(*) AS cnt SUM( seatsmax ) AS total FROM sflight INTO TABLE gt_a GROUP BY carrid.
LOOP AT gt_a INTO DATA(ls_a).
  WRITE: / |{ ls_a-carrid }: { ls_a-cnt } flights, { ls_a-total } seats|.
ENDLOOP.
`)

// R12: interface def + two impls + interface ref (payments)
run('R12_IFACE', `
REPORT R12.
INTERFACE lif_payment.
  METHODS: pay IMPORTING amount TYPE p DECIMALS 2,
           get_name RETURNING VALUE(r) TYPE string.
ENDINTERFACE.
CLASS lcl_credit_card DEFINITION.
  PUBLIC SECTION.
    INTERFACES: lif_payment.
ENDCLASS.
CLASS lcl_credit_card IMPLEMENTATION.
  METHOD lif_payment~pay.
    WRITE: / |CreditCard: paying { amount }|.
  ENDMETHOD.
  METHOD lif_payment~get_name.
    r = 'Credit Card'.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_upi DEFINITION.
  PUBLIC SECTION.
    INTERFACES: lif_payment.
ENDCLASS.
CLASS lcl_upi IMPLEMENTATION.
  METHOD lif_payment~pay.
    WRITE: / |UPI: paying { amount }|.
  ENDMETHOD.
  METHOD lif_payment~get_name.
    r = 'UPI'.
  ENDMETHOD.
ENDCLASS.
DATA: go_pay TYPE REF TO lif_payment,
      go_cc  TYPE REF TO lcl_credit_card,
      go_upi TYPE REF TO lcl_upi.
CREATE OBJECT go_cc.
CREATE OBJECT go_upi.
go_pay = go_cc.
go_pay->lif_payment~pay( amount = '1500.00' ).
WRITE: / go_pay->lif_payment~get_name( ).
go_pay = go_upi.
go_pay->lif_payment~pay( amount = '250.50' ).
WRITE: / go_pay->lif_payment~get_name( ).
`)

// R13: events with EXPORTING + handler IMPORTING (temperature)
run('R13_EVENTS', `
REPORT R13.
CLASS lcl_temperature DEFINITION.
  PUBLIC SECTION.
    EVENTS: threshold_exceeded EXPORTING VALUE(count) TYPE i.
    METHODS: heat_up.
    DATA: mv_temp TYPE i.
ENDCLASS.
CLASS lcl_temperature IMPLEMENTATION.
  METHOD heat_up.
    mv_temp = mv_temp + 10.
    IF mv_temp >= 30.
      RAISE EVENT threshold_exceeded EXPORTING count = mv_temp.
    ENDIF.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_monitor DEFINITION.
  PUBLIC SECTION.
    METHODS: on_threshold FOR EVENT threshold_exceeded OF lcl_temperature IMPORTING count.
ENDCLASS.
CLASS lcl_monitor IMPLEMENTATION.
  METHOD on_threshold.
    WRITE: / |ALERT: threshold exceeded at { count } degrees|.
  ENDMETHOD.
ENDCLASS.
DATA: go_t TYPE REF TO lcl_temperature,
      go_m TYPE REF TO lcl_monitor.
CREATE OBJECT go_t.
CREATE OBJECT go_m.
SET HANDLER go_m->on_threshold FOR go_t.
DO 4 TIMES.
  go_t->heat_up( ).
ENDDO.
`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
