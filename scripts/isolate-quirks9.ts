// Isolate part 9: inheritance attrs, static counter, REDUCE shapes
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
  ],
  rows: [
    { CARRID: 'AA', PRICE: '425.40' },
    { CARRID: 'LH', PRICE: '350.00' },
    { CARRID: 'SQ', PRICE: '980.00' },
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

// Y1: inheritance attr via constructor, read in subclass method
run('Y1_INH_ATTR', `
REPORT Y1.
CLASS lcl_vehicle DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_name TYPE string,
             describe RETURNING VALUE(r) TYPE string.
    DATA: mv_name TYPE string.
ENDCLASS.
CLASS lcl_vehicle IMPLEMENTATION.
  METHOD constructor.
    me->mv_name = iv_name.
  ENDMETHOD.
  METHOD describe.
    r = |Vehicle: { me->mv_name }|.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_car DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS: describe REDEFINITION.
ENDCLASS.
CLASS lcl_car IMPLEMENTATION.
  METHOD describe.
    r = |Car: { me->mv_name }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_car) = NEW lcl_car( iv_name = 'Swift' ).
  WRITE: / go_car->describe( ).
`)

// Y2: inheritance with own constructor calling super->constructor
run('Y2_SUPER', `
REPORT Y2.
CLASS lcl_vehicle DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_name TYPE string,
             describe RETURNING VALUE(r) TYPE string.
    DATA: mv_name TYPE string.
ENDCLASS.
CLASS lcl_vehicle IMPLEMENTATION.
  METHOD constructor.
    me->mv_name = iv_name.
  ENDMETHOD.
  METHOD describe.
    r = |Vehicle: { me->mv_name }|.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_car DEFINITION INHERITING FROM lcl_vehicle.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_name TYPE string,
             describe REDEFINITION.
    METHODS: drive RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl_car IMPLEMENTATION.
  METHOD constructor.
    super->constructor( iv_name = iv_name ).
  ENDMETHOD.
  METHOD describe.
    r = |Car: { me->mv_name }|.
  ENDMETHOD.
  METHOD drive.
    r = |{ me->mv_name } is driving|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_car) = NEW lcl_car( iv_name = 'Swift' ).
  WRITE: / go_car->describe( ).
  WRITE: / go_car->drive( ).
`)

// Y3: static counter with VALUE clause
run('Y3_STATIC_VAL', `
REPORT Y3.
CLASS lcl_counter DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA: gv_instances TYPE i VALUE 0.
    METHODS: constructor.
    CLASS-METHODS: get_count RETURNING VALUE(r) TYPE i.
ENDCLASS.
CLASS lcl_counter IMPLEMENTATION.
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
  WRITE: / |Instances: { lcl_counter=>get_count( ) }|.
  WRITE: / |Direct: { lcl_counter=>gv_instances }|.
`)

// Y4: REDUCE FOR-IN over itab with simple accumulator
run('Y4_REDUCE_SIMPLE', `
REPORT Y4.
TYPES: BEGIN OF ty_p,
         price TYPE p DECIMALS 2,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA lt_prices TYPE ty_p_t.
DATA ls_p TYPE ty_p.
ls_p-price = '425.40'. APPEND ls_p TO lt_prices.
ls_p-price = '350.00'. APPEND ls_p TO lt_prices.
ls_p-price = '980.00'. APPEND ls_p TO lt_prices.
DATA(lv_total) = REDUCE #( INIT t = 0 FOR ls IN lt_prices NEXT t = t + ls-price ).
WRITE: / |Total: { lv_total }|.
`)

// Y5: FOR bare copy without WHERE
run('Y5_FOR_COPY', `
REPORT Y5.
SELECT * FROM sflight INTO TABLE @DATA(lt_src).
DATA lt_copy TYPE STANDARD TABLE OF sflight.
lt_copy = VALUE #( FOR ls IN lt_src ).
WRITE: / |Copied: { lines( lt_copy ) }|.
`)

// Y6: event with single param
run('Y6_EVENT_ONE', `
REPORT Y6.
CLASS lcl_temp DEFINITION.
  PUBLIC SECTION.
    EVENTS: too_hot EXPORTING VALUE(temp) TYPE i.
    METHODS: check IMPORTING iv_temp TYPE i.
ENDCLASS.
CLASS lcl_temp IMPLEMENTATION.
  METHOD check.
    IF iv_temp > 100.
      RAISE EVENT too_hot EXPORTING temp = iv_temp.
    ENDIF.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_handler DEFINITION.
  PUBLIC SECTION.
    METHODS: on_hot FOR EVENT too_hot OF lcl_temp IMPORTING temp.
ENDCLASS.
CLASS lcl_handler IMPLEMENTATION.
  METHOD on_hot.
    WRITE: / |ALERT: { temp } degrees - too hot!|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(go_t) = NEW lcl_temp( ).
  DATA(go_h) = NEW lcl_handler( ).
  SET HANDLER go_h->on_hot FOR go_t.
  go_t->check( iv_temp = 75 ).
  go_t->check( iv_temp = 120 ).
`)

// Y7: COND nested + string templates date formatting
run('Y7_COND', `
REPORT Y7.
DATA(lv_h) = 14.
DATA(lv_greet) = COND #( WHEN lv_h < 12 THEN 'Good morning'
                         WHEN lv_h < 18 THEN 'Good afternoon'
                         ELSE 'Good evening' ).
WRITE: / |At { lv_h }:00 → { lv_greet }|.
DATA(lv_d) = '20250115'.
WRITE: / |Date: { lv_d DATE = USER }|.
WRITE: / |Date iso: { lv_d }|.
`)

// Y8: form with changing + local data
run('Y8_FORM', `
REPORT Y8.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 3,
      gv_r TYPE i.
PERFORM compute USING gv_a gv_b CHANGING gv_r.
WRITE: / |10 * 3 + 5 = { gv_r }|.
FORM compute USING p_a TYPE i p_b TYPE i CHANGING p_c TYPE i.
  DATA lv_tmp TYPE i.
  lv_tmp = p_a * p_b.
  lv_tmp = lv_tmp + 5.
  p_c = lv_tmp.
ENDFORM.
`)
