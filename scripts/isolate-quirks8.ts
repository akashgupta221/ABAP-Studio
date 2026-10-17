// Isolate part 8: REDUCE FOR-IN, VALUE FOR bare, exceptions text
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occ' },
  ],
  rows: [
    { CARRID: 'AA', PRICE: '425.40', SEATSMAX: '280', SEATSOCC: '220' },
    { CARRID: 'LH', PRICE: '350.00', SEATSMAX: '350', SEATSOCC: '300' },
    { CARRID: 'SQ', PRICE: '980.00', SEATSMAX: '300', SEATSOCC: '290' },
  ],
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}] :: ${JSON.stringify(text.slice(0, 250))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// X1: REDUCE FOR-IN
run('X1_REDUCE_IN', `
REPORT X1.
SELECT price FROM sflight INTO TABLE @DATA(lt_p).
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(lt_prices) = VALUE ty_p_t( FOR ls IN lt_p ).
DATA(lv_total) = REDUCE #( INIT t = 0 FOR ls IN lt_prices NEXT t = t + ls-price ).
WRITE: / |Total revenue: { lv_total }|.
`)

// X2: VALUE FOR bare copy with WHERE
run('X2_FOR_BARE', `
REPORT X2.
SELECT * FROM sflight INTO TABLE @DATA(lt_src).
DATA lt_copy TYPE STANDARD TABLE OF sflight.
lt_copy = VALUE #( FOR ls IN lt_src WHERE ls-price < 500 ).
WRITE: / |Copied rows: { lines( lt_copy ) }|.
LOOP AT lt_copy INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// X3: exception with MESSAGE + get_text
run('X3_CX_MSG', `
REPORT X3.
CLASS lcl_calc DEFINITION.
  PUBLIC SECTION.
    METHODS divide IMPORTING a TYPE i b TYPE i RETURNING VALUE(r) TYPE f RAISING cx_sy_zerodivide.
ENDCLASS.
CLASS lcl_calc IMPLEMENTATION.
  METHOD divide.
    IF b = 0.
      RAISE EXCEPTION TYPE cx_sy_zerodivide.
    ENDIF.
    r = a / b.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_calc) = NEW lcl_calc( ).
  TRY.
      DATA(lv_res) = go_calc->divide( a = 10 b = 0 ).
      WRITE: / |Result: { lv_res }|.
    CATCH cx_sy_zerodivide INTO DATA(lx_err).
      WRITE: / |Error caught: { lx_err->get_text( ) }|.
  ENDTRY.
  DATA(lv_ok) = go_calc->divide( a = 10 b = 4 ).
  WRITE: / |10 / 4 = { lv_ok }|.
`)

// X4: cl_demo_output
run('X4_DEMO_OUT', `
REPORT X4.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_f).
cl_demo_output=>display( lt_f ).
`)

// X5: event with EXPORTING value + SET HANDLER ALL INSTANCES?
run('X5_EVENTS', `
REPORT X5.
CLASS lcl_temp DEFINITION.
  PUBLIC SECTION.
    EVENTS: threshold_exceeded EXPORTING VALUE(temp) TYPE i VALUE(limit) TYPE i.
    METHODS: set_temperature IMPORTING iv_temp TYPE i.
    DATA: mv_limit TYPE i VALUE 100.
ENDCLASS.
CLASS lcl_temp IMPLEMENTATION.
  METHOD set_temperature.
    IF iv_temp > mv_limit.
      RAISE EVENT threshold_exceeded EXPORTING temp = iv_temp limit = mv_limit.
    ENDIF.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_handler DEFINITION.
  PUBLIC SECTION.
    METHODS: on_threshold FOR EVENT threshold_exceeded OF lcl_temp IMPORTING temp limit.
ENDCLASS.
CLASS lcl_handler IMPLEMENTATION.
  METHOD on_threshold.
    WRITE: / |ALERT: temperature { temp } exceeds limit { limit }!|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_t) = NEW lcl_temp( ).
  DATA(go_h) = NEW lcl_handler( ).
  SET HANDLER go_h->on_threshold FOR go_t.
  go_t->set_temperature( iv_temp = 75 ).
  WRITE: / 'Set to 75 - no alert expected'.
  go_t->set_temperature( iv_temp = 120 ).
  go_t->set_temperature( iv_temp = 95 ).
`)

// X6: constructor with IMPORTING
run('X6_CTOR_ARGS', `
REPORT X6.
CLASS lcl_rect DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_w TYPE i iv_h TYPE i,
             area RETURNING VALUE(r) TYPE i.
    DATA: mv_w TYPE i, mv_h TYPE i.
ENDCLASS.
CLASS lcl_rect IMPLEMENTATION.
  METHOD constructor.
    me->mv_w = iv_w. me->mv_h = iv_h.
  ENDMETHOD.
  METHOD area.
    r = me->mv_w * me->mv_h.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_r) = NEW lcl_rect( iv_w = 5 iv_h = 4 ).
  WRITE: / |Area = { go_r->area( ) }|.
`)

// X7: static counter via constructor
run('X7_STATIC', `
REPORT X7.
CLASS lcl_counter DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA: gv_instances TYPE i.
    CLASS-METHODS: class_constructor.
    METHODS: constructor.
    CLASS-METHODS: get_count RETURNING VALUE(r) TYPE i.
ENDCLASS.
CLASS lcl_counter IMPLEMENTATION.
  METHOD class_constructor.
    gv_instances = 0.
  ENDMETHOD.
  METHOD constructor.
    gv_instances = gv_instances + 1.
  ENDMETHOD.
  METHOD get_count.
    r = gv_instances.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DO 3 TIMES.
    DATA(go_c) = NEW lcl_counter( ).
  ENDDO.
  WRITE: / |Instances created: { lcl_counter=>get_count( ) }|.
`)

// X8: inheritance polymorphic loop
run('X8_INH', `
REPORT X8.
CLASS lcl_vehicle DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_name TYPE string,
             get_info RETURNING VALUE(r) TYPE string.
    DATA: mv_name TYPE string.
ENDCLASS.
CLASS lcl_vehicle IMPLEMENTATION.
  METHOD constructor.
    me->mv_name = iv_name.
  ENDMETHOD.
  METHOD get_info.
    r = |Vehicle: { me->mv_name }|.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_car DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS: get_info REDEFINITION.
ENDCLASS.
CLASS lcl_car IMPLEMENTATION.
  METHOD get_info.
    r = |Car: { me->mv_name }|.
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
  DATA gt_veh TYPE STANDARD TABLE OF REF TO lcl_vehicle.
  APPEND NEW lcl_car( iv_name = 'Swift' ) TO gt_veh.
  APPEND NEW lcl_bike( iv_name = 'Pulsar' ) TO gt_veh.
  APPEND NEW lcl_vehicle( iv_name = 'Generic' ) TO gt_veh.
  LOOP AT gt_veh INTO DATA(lo_v).
    WRITE: / lo_v->get_info( ).
  ENDLOOP.
`)
