// Isolate part 13: inheritance own-attr, all data types, flagship report layout
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline Code' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
    { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Local Currency' },
    { name: 'PLANETYPE', type: 'CHAR', length: 10, text: 'Aircraft Type' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max Seats' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occupied Seats' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250110', PRICE: '425.40', CURRENCY: 'USD', PLANETYPE: '747-400', SEATSMAX: '385', SEATSOCC: '373' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR', PLANETYPE: 'A340-600', SEATSMAX: '330', SEATSOCC: '290' },
    { CARRID: 'SQ', CONNID: '0198', FLDATE: '20250210', PRICE: '980.00', CURRENCY: 'SGD', PLANETYPE: 'A380-800', SEATSMAX: '479', SEATSOCC: '421' },
    { CARRID: 'SQ', CONNID: '0087', FLDATE: '20250305', PRICE: '820.00', CURRENCY: 'SGD', PLANETYPE: '777-200', SEATSMAX: '328', SEATSOCC: '212' },
    { CARRID: 'AA', CONNID: '0064', FLDATE: '20250420', PRICE: '522.30', CURRENCY: 'USD', PLANETYPE: '767-200', SEATSMAX: '252', SEATSOCC: '105' },
  ],
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} ::\n${text.slice(0, 900)}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// F1: inheritance — own attrs, direct set, polymorphic loop
run('F1_INH', `
REPORT F1.
CLASS lcl_vehicle DEFINITION.
  PUBLIC SECTION.
    METHODS: get_info RETURNING VALUE(r) TYPE string,
             set_name IMPORTING iv_name TYPE string.
    DATA: mv_name TYPE string.
ENDCLASS.
CLASS lcl_vehicle IMPLEMENTATION.
  METHOD get_info.
    r = |Vehicle: { me->mv_name }|.
  ENDMETHOD.
  METHOD set_name.
    me->mv_name = iv_name.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_car DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS: get_info REDEFINITION.
    DATA: mv_doors TYPE i.
ENDCLASS.
CLASS lcl_car IMPLEMENTATION.
  METHOD get_info.
    r = |Car: { me->mv_name } ({ me->mv_doors } doors)|.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_bike DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS: get_info REDEFINITION.
ENDCLASS.
CLASS lcl_bike IMPLEMENTATION.
  METHOD get_info.
    r = |Bike: { me->mv_name }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA go_car TYPE REF TO lcl_car.
  CREATE OBJECT go_car.
  go_car->set_name( iv_name = 'Maruti Swift' ).
  go_car->mv_doors = 4.
  DATA(go_bike) = NEW lcl_bike( ).
  go_bike->set_name( iv_name = 'Royal Enfield' ).
  DATA gt TYPE STANDARD TABLE OF REF TO lcl_vehicle.
  APPEND go_car TO gt.
  APPEND go_bike TO gt.
  LOOP AT gt INTO DATA(lo_v).
    WRITE: / lo_v->get_info( ).
  ENDLOOP.
`)

// F2: all elementary types
run('F2_TYPES', `
REPORT F2.
DATA: gv_int   TYPE i VALUE 42,
      gv_int2  TYPE int2 VALUE 7,
      gv_p     TYPE p LENGTH 8 DECIMALS 2 VALUE '1234.56',
      gv_f     TYPE f VALUE '3.14159',
      gv_c     TYPE c LENGTH 10 VALUE 'ABAP',
      gv_str   TYPE string VALUE 'String type',
      gv_n     TYPE n LENGTH 6 VALUE '000123',
      gv_d     TYPE d VALUE '20250115',
      gv_t     TYPE t VALUE '143045',
      gv_x     TYPE x LENGTH 2 VALUE 'FF00',
      gv_flag  TYPE c VALUE 'X'.
WRITE: / |Integer i: { gv_int }|.
WRITE: / |Packed p: { gv_p }|.
WRITE: / |Float f: { gv_f }|.
WRITE: / |Char c: [{ gv_c }]|.
WRITE: / |String: [{ gv_str }]|.
WRITE: / |Numeric n: { gv_n }|.
WRITE: / |Date d: { gv_d }|.
WRITE: / |Time t: { gv_t }|.
WRITE: / |Hex x: { gv_x }|.
WRITE: / |Flag: { gv_flag }|.
`)

// F3: flagship report
run('F3_REPORT', `
REPORT F3 LINE-SIZE 100 NO STANDARD PAGE HEADING.
*--------------------------------------------------------------------*
* Flight Availability Report — classical list with colors & totals
*--------------------------------------------------------------------*
DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      gs_flight  TYPE sflight,
      gv_total   TYPE p DECIMALS 2,
      gv_seats   TYPE i,
      gv_occ     TYPE i.
INITIALIZATION.
  gv_total = 0.
START-OF-SELECTION.
  SELECT * FROM sflight INTO TABLE gt_flights.
  IF sy-subrc <> 0.
    MESSAGE 'No flight data found' TYPE 'E'.
  ENDIF.
  SKIP.
  FORMAT COLOR 1 INTENSIFIED ON.
  WRITE: / AT 30(45) 'FLIGHT AVAILABILITY REPORT'.
  FORMAT COLOR OFF.
  SKIP.
  FORMAT COLOR 2.
  WRITE: / AT 1(8) 'Airline', AT 12(5) 'Conn', AT 20(12) 'Flight Date',
         AT 35(12) 'Price', AT 49(6) 'Curr', AT 57(11) 'Aircraft',
         AT 70(9) 'Seats', AT 81(9) 'Free'.
  FORMAT COLOR OFF.
  ULINE AT 1(90).
  FORMAT COLOR 3.
  LOOP AT gt_flights INTO gs_flight.
    WRITE: / AT 1(8) gs_flight-carrid, AT 12(5) gs_flight-connid,
           AT 20(12) gs_flight-fldate, AT 35(12) gs_flight-price,
           AT 49(6) gs_flight-currency, AT 57(11) gs_flight-planetype,
           AT 70(9) gs_flight-seatsmax, AT 81(9) gs_flight-seatsmax - ( gs_flight-seatsocc ).
    gv_total = gv_total + gs_flight-price.
    gv_seats = gv_seats + gs_flight-seatsmax.
    gv_occ = gv_occ + gs_flight-seatsocc.
  ENDLOOP.
  FORMAT COLOR OFF.
  ULINE AT 1(90).
  FORMAT COLOR 6.
  WRITE: / AT 1(19) 'TOTAL', AT 35(12) gv_total, AT 70(9) gv_seats, AT 81(9) gv_seats - ( gv_occ ).
  FORMAT COLOR OFF.
  ULINE AT 1(90).
  SKIP.
  WRITE: / |Records listed: { lines( gt_flights ) }, generated by { sy-uname } on { sy-datum }|.
`)
