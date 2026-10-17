// Isolate part 4: fs workaround, comments, interface calls, misc
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occ' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40', SEATSMAX: '280', SEATSOCC: '220' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', SEATSMAX: '350', SEATSOCC: '300' },
    { CARRID: 'SQ', CONNID: '0198', FLDATE: '20250210', PRICE: '980.00', SEATSMAX: '300', SEATSOCC: '290' },
  ],
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} :: ${JSON.stringify(text.slice(0, 200))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// T1: * line comments
run('T1_STAR_COMMENT', `
REPORT T1.
* full line comment with star
WRITE 'ok'. " trailing comment
WRITE: / 'ok2'.
`)

// T2: field symbol via matching DATA name
run('T2_FS_HACK', `
REPORT T2.
* Real SAP:  FIELD-SYMBOLS: <fs_flight> TYPE sflight.
DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      fs_flight  TYPE sflight.
SELECT * FROM sflight INTO TABLE gt_flights.
LOOP AT gt_flights ASSIGNING <fs_flight>.
  WRITE: / <fs_flight>-carrid, <fs_flight>-price.
ENDLOOP.
`)

// T3: fs modify in place
run('T3_FS_MODIFY', `
REPORT T3.
DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      fs_flight  TYPE sflight.
SELECT * FROM sflight INTO TABLE gt_flights.
LOOP AT gt_flights ASSIGNING <fs_flight>.
  <fs_flight>-price = <fs_flight>-price + '50.00'.
ENDLOOP.
LOOP AT gt_flights INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// T4: interface method correct name
run('T4_IF_OK', `
REPORT T4.
INTERFACE lif_payment.
  METHODS: pay IMPORTING amount TYPE i RETURNING VALUE(r) TYPE string.
ENDINTERFACE.
CLASS lcl_card DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_payment.
ENDCLASS.
CLASS lcl_card IMPLEMENTATION.
  METHOD lif_payment~pay.
    r = |Credit Card: { amount }|.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_upi DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_payment.
ENDCLASS.
CLASS lcl_upi IMPLEMENTATION.
  METHOD lif_payment~pay.
    r = |UPI: { amount }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA gt_pay TYPE STANDARD TABLE OF REF TO lif_payment.
  APPEND NEW lcl_card( ) TO gt_pay.
  APPEND NEW lcl_upi( ) TO gt_pay.
  LOOP AT gt_pay INTO DATA(lo_p).
    WRITE: / lo_p->lif_payment~pay( amount = 100 ).
  ENDLOOP.
`)

// T5: reference into
run('T5_REF_INTO', `
REPORT T5.
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f REFERENCE INTO DATA(lr).
  WRITE: / lr->carrid, lr->price.
ENDLOOP.
`)

// T6: FORMAT COLOR + WRITE AT + ULINE + SKIP full layout
run('T6_LAYOUT', `
REPORT T6 LINE-SIZE 100.
FORMAT COLOR 1 INTENSIFIED ON.
WRITE: /30 'FLIGHT AVAILABILITY REPORT'.
FORMAT COLOR OFF.
SKIP.
ULINE AT 1(80).
FORMAT COLOR 3.
WRITE: / AT 1(3) 'Car', AT 6(4) 'Conn', AT 15(10) 'Flight Date', AT 30(10) 'Price'.
FORMAT COLOR OFF.
ULINE AT 1(80).
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f INTO DATA(ls).
  WRITE: / AT 1(3) ls-carrid, AT 6(4) ls-connid, AT 15(10) ls-fldate, AT 30(10) ls-price.
ENDLOOP.
ULINE AT 1(80).
`)

// T7: totals with numeric agg + sy-datum
run('T7_TOTALS', `
REPORT T7.
SELECT seatsmax seatsocc FROM sflight INTO TABLE @DATA(lt_s).
DATA(lv_max) = 0.
DATA(lv_occ) = 0.
LOOP AT lt_s INTO DATA(ls).
  lv_max = lv_max + ls-seatsmax.
  lv_occ = lv_occ + ls-seatsocc.
ENDLOOP.
WRITE: / |Total seats: { lv_max }, occupied: { lv_occ }|.
WRITE: / |Available: { lv_max - lv_occ }|.
WRITE: / |Report date: { sy-datum DATE = ENVIRONMENT }|.
`)

// T8: nested structure + MOVE-CORRESPONDING
run('T8_NESTED', `
REPORT T8.
TYPES: BEGIN OF ty_addr,
         city TYPE c LENGTH 15,
         country TYPE c LENGTH 3,
       END OF ty_addr.
TYPES: BEGIN OF ty_emp,
         empid TYPE i,
         name TYPE c LENGTH 15,
         addr TYPE ty_addr,
       END OF ty_emp.
TYPES: BEGIN OF ty_emp2,
         name TYPE c LENGTH 15,
         addr TYPE ty_addr,
       END OF ty_emp2.
DATA: gs_emp TYPE ty_emp,
      gs_copy TYPE ty_emp2.
gs_emp-empid = 101.
gs_emp-name = 'ARJUN'.
gs_emp-addr-city = 'PUNE'.
gs_emp-addr-country = 'IN'.
MOVE-CORRESPONDING gs_emp TO gs_copy.
WRITE: / gs_copy-name, gs_copy-addr-city.
`)

// T9: CONSTANTS + sy fields table
run('T9_CONST', `
REPORT T9.
CONSTANTS: gc_pi TYPE p DECIMALS 2 VALUE '3.14',
           gc_title TYPE string VALUE 'ABAP Constants',
           gc_max TYPE i VALUE 100.
WRITE: / gc_title.
WRITE: / |Pi = { gc_pi }, Max = { gc_max }|.
IF gc_pi < '4'.
  WRITE: / 'Pi is less than 4'.
ENDIF.
`)

// T10: DO nested triangles with star patterns via repeat()
run('T10_PATTERN', `
REPORT T10.
DO 5 TIMES.
  WRITE: / repeat( val = '*' occ = sy-index ).
ENDDO.
SKIP.
DO 5 TIMES.
  DATA(lv_spaces) = 5 - sy-index.
  WRITE: / repeat( val = ' ' occ = lv_spaces ), repeat( val = '*' occ = sy-index ).
ENDDO.
`)
