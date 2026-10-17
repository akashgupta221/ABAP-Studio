// ABAP engine smoke test — run with: bun run scripts/test-abap.ts
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

// ── build a small demo DB ─────────────────────────────────────────────
const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT',
  description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Flight Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Air Fare' },
    { name: 'CURRENCY', type: 'CHAR', length: 5, text: 'Local Currency' },
    { name: 'SEATSMAX', type: 'INT4', text: 'Max Seats' },
    { name: 'SEATSOCC', type: 'INT4', text: 'Occupied Seats' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40', CURRENCY: 'USD', SEATSMAX: '280', SEATSOCC: '220' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00', CURRENCY: 'EUR', SEATSMAX: '350', SEATSOCC: '300' },
    { CARRID: 'SQ', CONNID: '0198', FLDATE: '20250210', PRICE: '980.00', CURRENCY: 'SGD', SEATSMAX: '300', SEATSOCC: '290' },
  ],
})

let passed = 0
let failed = 0

function run(name: string, source: string, expect: { ok?: boolean; includesText?: string; alv?: boolean; errorIncludes?: string; params?: Record<string, string | string[]> }) {
  const t0 = Date.now()
  let result
  try {
    result = runAbap({ source, repid: name, db, parameters: expect.params })
  } catch (e: any) {
    failed++
    console.log(`✗ ${name} — THREW: ${e.message}`)
    return
  }
  const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
  const errs: string[] = []
  if (expect.ok !== false) {
    if (result.status === 'ERROR') errs.push(`error: ${result.error?.message} (line ${result.error?.line})`)
  } else if (result.status !== 'ERROR') {
    errs.push('expected error but got success')
  }
  if (expect.includesText && !text.includes(expect.includesText)) errs.push(`output missing "${expect.includesText}" — got: ${JSON.stringify(text.slice(0, 200))}`)
  if (expect.errorIncludes && !(`${result.error?.message ?? ''}`).toLowerCase().includes(expect.errorIncludes.toLowerCase())) errs.push(`error missing "${expect.errorIncludes}": ${result.error?.message}`)
  if (expect.alv && !result.alv) errs.push('expected ALV output')
  if (errs.length === 0) {
    passed++
    console.log(`✓ ${name} (${Date.now() - t0}ms)${result.alv ? ' [ALV]' : ''}`)
  } else {
    failed++
    console.log(`✗ ${name} — ${errs.join('; ')}`)
    console.log(`   output: ${JSON.stringify(text.slice(0, 300))}`)
  }
}

// ── 1. Basics ──────────────────────────────────────────────────────────
run('Z_HELLO', `
REPORT Z_HELLO.
WRITE 'Hello ABAP World!'.
`, { includesText: 'Hello ABAP World!' })

run('Z_WRITE_CHAIN', `
REPORT Z_WRITE_CHAIN.
DATA: gv_a TYPE i VALUE 5,
      gv_b TYPE i VALUE 3.
WRITE: 'Sum is', gv_a + gv_b.
WRITE: / 'A =', gv_a.
`, { includesText: 'Sum is' })

run('Z_VAR_TYPES', `
REPORT Z_VAR_TYPES.
DATA: gv_int TYPE i VALUE 42,
      gv_dec TYPE p LENGTH 8 DECIMALS 2 VALUE '3.14',
      gv_txt TYPE string VALUE 'ABAP',
      gv_dat TYPE d VALUE '20250115',
      gv_flag TYPE c LENGTH 1 VALUE 'X'.
WRITE: / 'Int:', gv_int,
      / 'Dec:', gv_dec,
      / 'Txt:', gv_txt,
      / 'Dat:', gv_dat.
`, { includesText: '42' })

// ── 2. Control structures ──────────────────────────────────────────────
run('Z_IF_ELSE', `
REPORT Z_IF_ELSE.
DATA gv_num TYPE i VALUE 15.
IF gv_num > 10.
  WRITE 'Number is greater than 10'.
ELSEIF gv_num > 5.
  WRITE 'Number is between 5 and 10'.
ELSE.
  WRITE 'Number is 5 or less'.
ENDIF.
`, { includesText: 'greater than 10' })

run('Z_CASE', `
REPORT Z_CASE.
DATA gv_grade TYPE c VALUE 'B'.
CASE gv_grade.
  WHEN 'A'.
    WRITE 'Excellent'.
  WHEN 'B'.
    WRITE 'Good'.
  WHEN OTHERS.
    WRITE 'Needs improvement'.
ENDCASE.
`, { includesText: 'Good' })

run('Z_DO_LOOP', `
REPORT Z_DO_LOOP.
DO 5 TIMES.
  WRITE: / 'Iteration', sy-index.
ENDDO.
`, { includesText: 'Iteration' })

run('Z_WHILE', `
REPORT Z_WHILE.
DATA gv_count TYPE i VALUE 1.
WHILE gv_count <= 3.
  WRITE: / 'Count:', gv_count.
  gv_count = gv_count + 1.
ENDWHILE.
`, { includesText: 'Count:' })

run('Z_NESTED', `
REPORT Z_NESTED.
DO 3 TIMES.
  DO 2 TIMES.
    WRITE sy-index.
  ENDDO.
  WRITE / ''.
ENDDO.
`, { ok: true })

// ── 3. Structures & internal tables ────────────────────────────────────
run('Z_STRUCT', `
REPORT Z_STRUCT.
TYPES: BEGIN OF ty_student,
         name TYPE c LENGTH 20,
         age  TYPE i,
         city TYPE c LENGTH 15,
       END OF ty_student.
DATA: gs_student TYPE ty_student,
      gt_students TYPE STANDARD TABLE OF ty_student.
gs_student-name = 'RAHUL'.
gs_student-age = 22.
gs_student-city = 'PUNE'.
APPEND gs_student TO gt_students.
gs_student-name = 'PRIYA'.
gs_student-age = 24.
gs_student-city = 'DELHI'.
APPEND gs_student TO gt_students.
LOOP AT gt_students INTO gs_student.
  WRITE: / gs_student-name, gs_student-age, gs_student-city.
ENDLOOP.
`, { includesText: 'RAHUL' })

run('Z_ITAB_OPS', `
REPORT Z_ITAB_OPS.
DATA: BEGIN OF gs_flight,
        carrid TYPE c LENGTH 3,
        price  TYPE p DECIMALS 2,
      END OF gs_flight.
DATA gt_flights LIKE STANDARD TABLE OF gs_flight.
gs_flight-carrid = 'AA'. gs_flight-price = '400.50'.
APPEND gs_flight TO gt_flights.
gs_flight-carrid = 'LH'. gs_flight-price = '350.00'.
APPEND gs_flight TO gt_flights.
gs_flight-carrid = 'SQ'. gs_flight-price = '900.00'.
APPEND gs_flight TO gt_flights.
SORT gt_flights BY price DESCENDING.
READ TABLE gt_flights INTO gs_flight INDEX 1.
WRITE: / 'Cheapest check:'.
SORT gt_flights BY price ASCENDING.
READ TABLE gt_flights INTO gs_flight INDEX 1.
WRITE: / 'Cheapest:', gs_flight-carrid, gs_flight-price.
DELETE gt_flights WHERE price > '500'.
WRITE: / 'Remaining:', lines( gt_flights ).
`, { includesText: 'Remaining:' })

run('Z_READ_KEY', `
REPORT Z_READ_KEY.
DATA: BEGIN OF gs_emp,
        empid TYPE i,
        name TYPE c LENGTH 15,
      END OF gs_emp.
DATA gt_emps LIKE STANDARD TABLE OF gs_emp.
gs_emp-empid = 101. gs_emp-name = 'ARJUN'.
APPEND gs_emp TO gt_emps.
gs_emp-empid = 102. gs_emp-name = 'MEERA'.
APPEND gs_emp TO gt_emps.
READ TABLE gt_emps INTO gs_emp WITH KEY empid = 102.
IF sy-subrc = 0.
  WRITE: 'Found:', gs_emp-name.
ENDIF.
`, { includesText: 'MEERA' })

// ── 4. Modularization ──────────────────────────────────────────────────
run('Z_PERFORM', `
REPORT Z_PERFORM.
DATA: gv_a TYPE i VALUE 10,
      gv_b TYPE i VALUE 20,
      gv_sum TYPE i.
PERFORM calculate_sum USING gv_a gv_b CHANGING gv_sum.
WRITE: / 'Sum =', gv_sum.
FORM calculate_sum USING p_a TYPE i p_b TYPE i CHANGING p_sum TYPE i.
  p_sum = p_a + p_b.
ENDFORM.
`, { includesText: 'Sum =' })

run('Z_FORM_TABLES', `
REPORT Z_FORM_TABLES.
TYPES: BEGIN OF ty_line,
         val TYPE i,
       END OF ty_line.
DATA gt_tab TYPE STANDARD TABLE OF ty_line.
DATA gs_line TYPE ty_line.
gs_line-val = 5. APPEND gs_line TO gt_tab.
gs_line-val = 10. APPEND gs_line TO gt_tab.
PERFORM double_all TABLES gt_tab.
LOOP AT gt_tab INTO gs_line.
  WRITE: / gs_line-val.
ENDLOOP.
FORM double_all TABLES p_tab STRUCTURE gs_line.
  LOOP AT p_tab INTO gs_line.
    gs_line-val = gs_line-val * 2.
    MODIFY p_tab FROM gs_line.
  ENDLOOP.
ENDFORM.
`, { includesText: '10' })

// ── 5. OOP ─────────────────────────────────────────────────────────────
run('Z_CLASS_BASIC', `
REPORT Z_CLASS_BASIC.
CLASS lcl_student DEFINITION.
  PUBLIC SECTION.
    DATA: mv_name TYPE string,
          mv_age  TYPE i.
    METHODS: set_data IMPORTING iv_name TYPE string iv_age TYPE i,
             display.
ENDCLASS.
CLASS lcl_student IMPLEMENTATION.
  METHOD set_data.
    me->mv_name = iv_name.
    me->mv_age = iv_age.
  ENDMETHOD.
  METHOD display.
    WRITE: / 'Name:', mv_name, 'Age:', mv_age.
  ENDMETHOD.
ENDCLASS.
DATA go_student TYPE REF TO lcl_student.
START-OF-SELECTION.
  CREATE OBJECT go_student.
  go_student->set_data( iv_name = 'KUMAR' iv_age = 21 ).
  go_student->display( ).
`, { includesText: 'KUMAR' })

run('Z_METHOD_RETURNING', `
REPORT Z_METHOD_RETURNING.
CLASS lcl_math DEFINITION.
  PUBLIC SECTION.
    METHODS add IMPORTING a TYPE i b TYPE i RETURNING VALUE(r) TYPE i.
ENDCLASS.
CLASS lcl_math IMPLEMENTATION.
  METHOD add.
    r = a + b.
  ENDMETHOD.
ENDCLASS.
DATA(go_math) = NEW lcl_math( ).
DATA(gv_result) = go_math->add( a = 7 b = 8 ).
WRITE: / '7 + 8 =', gv_result.
`, { includesText: '15' })

run('Z_INHERITANCE', `
REPORT Z_INHERITANCE.
CLASS lcl_animal DEFINITION.
  PUBLIC SECTION.
    METHODS speak RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl_animal IMPLEMENTATION.
  METHOD speak.
    r = 'Some sound'.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_dog DEFINITION INHERITING FROM lcl_animal.
  PUBLIC SECTION.
    METHODS speak REDEFINITION.
ENDCLASS.
CLASS lcl_dog IMPLEMENTATION.
  METHOD speak.
    r = 'Woof!'.
  ENDMETHOD.
ENDCLASS.
DATA(go_animal) = NEW lcl_animal( ).
DATA(go_dog) = NEW lcl_dog( ).
WRITE: / go_animal->speak( ).
WRITE: / go_dog->speak( ).
`, { includesText: 'Woof!' })

run('Z_INTERFACE', `
REPORT Z_INTERFACE.
INTERFACE lif_shape.
  METHODS: get_area RETURNING VALUE(r) TYPE i,
           get_name RETURNING VALUE(r) TYPE string.
ENDINTERFACE.
CLASS lcl_rect DEFINITION.
  PUBLIC SECTION.
    INTERFACES: lif_shape.
    DATA: mv_w TYPE i,
          mv_h TYPE i.
ENDCLASS.
CLASS lcl_rect IMPLEMENTATION.
  METHOD lif_shape~get_area.
    r = me->mv_w * me->mv_h.
  ENDMETHOD.
  METHOD lif_shape~get_name.
    r = 'Rectangle'.
  ENDMETHOD.
ENDCLASS.
DATA go_shape TYPE REF TO lif_shape.
DATA go_rect TYPE REF TO lcl_rect.
CREATE OBJECT go_rect EXPORTING .
go_rect->mv_w = 5.
go_rect->mv_h = 4.
go_shape = go_rect.
WRITE: / go_shape->lif_shape~get_name( ), 'area =', go_shape->lif_shape~get_area( ).
`, { includesText: 'area =' })

run('Z_EXCEPTIONS', `
REPORT Z_EXCEPTIONS.
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
DATA go_calc TYPE REF TO lcl_calc.
DATA gv_res TYPE f.
CREATE OBJECT go_calc.
TRY.
    gv_res = go_calc->divide( a = 10 b = 0 ).
    WRITE: / 'Result:', gv_res.
  CATCH cx_sy_zerodivide.
    WRITE: / 'Caught: division by zero!'.
ENDTRY.
gv_res = go_calc->divide( a = 10 b = 2 ).
WRITE: / 'Result:', gv_res.
`, { includesText: 'Caught: division by zero' })

run('Z_EVENTS', `
REPORT Z_EVENTS.
CLASS lcl_counter DEFINITION.
  PUBLIC SECTION.
    EVENTS: threshold_exceeded EXPORTING VALUE(count) TYPE i.
    METHODS: increment.
    DATA: mv_count TYPE i.
ENDCLASS.
CLASS lcl_counter IMPLEMENTATION.
  METHOD increment.
    mv_count = mv_count + 1.
    IF mv_count >= 3.
      RAISE EVENT threshold_exceeded EXPORTING count = mv_count.
    ENDIF.
  ENDMETHOD.
ENDCLASS.
CLASS lcl_handler DEFINITION.
  PUBLIC SECTION.
    METHODS: on_threshold FOR EVENT threshold_exceeded OF lcl_counter IMPORTING count.
ENDCLASS.
CLASS lcl_handler IMPLEMENTATION.
  METHOD on_threshold.
    WRITE: / 'Threshold reached! Count =', count.
  ENDMETHOD.
ENDCLASS.
DATA: go_counter TYPE REF TO lcl_counter,
      go_handler TYPE REF TO lcl_handler.
CREATE OBJECT go_counter.
CREATE OBJECT go_handler.
SET HANDLER go_handler->on_threshold FOR go_counter.
DO 5 TIMES.
  go_counter->increment( ).
ENDDO.
`, { includesText: 'Threshold reached' })

run('Z_STATIC', `
REPORT Z_STATIC.
CLASS lcl_company DEFINITION.
  PUBLIC SECTION.
    CLASS-DATA: gv_employees TYPE i.
    CLASS-METHODS: add_employee.
ENDCLASS.
CLASS lcl_company IMPLEMENTATION.
  METHOD add_employee.
    gv_employees = gv_employees + 1.
  ENDMETHOD.
ENDCLASS.
lcl_company=>add_employee( ).
lcl_company=>add_employee( ).
lcl_company=>add_employee( ).
WRITE: / 'Employees:', lcl_company=>gv_employees.
`, { includesText: 'Employees:' })

// ── 6. SQL ─────────────────────────────────────────────────────────────
run('Z_SELECT', `
REPORT Z_SELECT.
DATA: gs_flight TYPE sflight,
      gt_flights TYPE STANDARD TABLE OF sflight.
SELECT * FROM sflight INTO TABLE gt_flights WHERE carrid = 'AA'.
WRITE: / 'Rows found:', lines( gt_flights ).
LOOP AT gt_flights INTO gs_flight.
  WRITE: / gs_flight-carrid, gs_flight-connid, gs_flight-price, gs_flight-currency.
ENDLOOP.
`, { includesText: 'Rows found:' })

run('Z_SELECT_SINGLE', `
REPORT Z_SELECT_SINGLE.
DATA gs_flight TYPE sflight.
SELECT SINGLE * FROM sflight INTO gs_flight WHERE carrid = 'LH'.
IF sy-subrc = 0.
  WRITE: 'Found LH flight, price:', gs_flight-price.
ENDIF.
`, { includesText: '350.00' })

run('Z_SELECT_JOIN', `
REPORT Z_SELECT_JOIN.
DATA: BEGIN OF gs_line,
        carrid TYPE c LENGTH 3,
        price  TYPE p DECIMALS 2,
      END OF gs_line.
DATA gt_lines LIKE STANDARD TABLE OF gs_line.
SELECT sflight~carrid sflight~price FROM sflight INTO TABLE gt_lines UP TO 10 ROWS.
LOOP AT gt_lines INTO gs_line.
  WRITE: / gs_line-carrid, gs_line-price.
ENDLOOP.
WRITE: / 'Total:', lines( gt_lines ).
`, { includesText: 'Total:' })

// ── 7. ALV ─────────────────────────────────────────────────────────────
run('Z_ALV_SALV', `
REPORT Z_ALV_SALV.
DATA: gt_flights TYPE STANDARD TABLE OF sflight,
      gs_flight  TYPE sflight.
SELECT * FROM sflight INTO TABLE gt_flights.
cl_salv_table=>factory(
  IMPORTING r_salv_table = DATA(lo_alv)
  CHANGING  t_table      = gt_flights ).
lo_alv->display( ).
`, { alv: true })

run('Z_ALV_REUSE', `
REPORT Z_ALV_REUSE.
DATA gt_flights TYPE STANDARD TABLE OF sflight.
SELECT * FROM sflight INTO TABLE gt_flights.
CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    i_structure_name = 'SFLIGHT'
    i_grid_title     = 'Flight List'
  TABLES
    t_outtab         = gt_flights.
`, { alv: true })

// ── 8. Modern syntax (7.40) ────────────────────────────────────────────
run('Z_STRING_TEMPLATES', `
REPORT Z_STRING_TEMPLATES.
DATA(lv_name) = 'SAP ABAP'.
DATA(lv_ver) = '7.40'.
DATA(lv_num) = 3.14159.
WRITE: |Hello, { lv_name }!|.
WRITE: / |Version: { lv_ver }, Pi: { lv_num DECIMALS = 2 }|.
DATA(lv_combined) = |{ lv_name }| && ' rocks'.
WRITE: / lv_combined.
`, { includesText: 'Hello, SAP ABAP!' })

run('Z_VALUE_EXPR', `
REPORT Z_VALUE_EXPR.
TYPES: BEGIN OF ty_emp,
         name TYPE string,
         dept TYPE string,
       END OF ty_emp.
TYPES ty_emp_t TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.
DATA(gt_emps) = VALUE ty_emp_t( ( name = 'AJAY' dept = 'IT' )
                                ( name = 'VIJAY' dept = 'HR' ) ).
LOOP AT gt_emps INTO DATA(ls_emp).
  WRITE: / ls_emp-name, '-', ls_emp-dept.
ENDLOOP.
`, { includesText: 'AJAY' })

run('Z_INLINE_SELECT', `
REPORT Z_INLINE_SELECT.
SELECT carrid, connid, price FROM sflight INTO TABLE @DATA(lt_flights) WHERE price > 300.
WRITE: / 'Flights above 300:', lines( lt_flights ).
LOOP AT lt_flights INTO DATA(ls_flight).
  WRITE: / ls_flight-carrid, ls_flight-connid, ls_flight-price.
ENDLOOP.
`, { includesText: 'Flights above 300:' })

run('Z_COND_REDUCE', `
REPORT Z_COND_REDUCE.
DATA(lv_hour) = 14.
DATA(lv_greeting) = COND #( WHEN lv_hour < 12 THEN 'Good morning'
                            WHEN lv_hour < 18 THEN 'Good afternoon'
                            ELSE 'Good evening' ).
WRITE: / lv_greeting.
DATA(lv_sum) = REDUCE #( INIT s = 0
                         FOR i = 1 THEN i + 1 WHILE i <= 10
                         NEXT s = s + i ).
WRITE: / 'Sum 1..10 =', lv_sum.
`, { includesText: 'Good afternoon' })

// ── 9. String statements ───────────────────────────────────────────────
run('Z_STRINGS', `
REPORT Z_STRINGS.
DATA: lv_full TYPE string VALUE 'John;Smith;25',
      lv_first TYPE string,
      lv_last TYPE string,
      lv_age TYPE string.
SPLIT lv_full AT ';' INTO lv_first lv_last lv_age.
CONCATENATE lv_last lv_first INTO DATA(lv_name) SEPARATED BY ', '.
WRITE: / lv_name.
TRANSLATE lv_name TO UPPER CASE.
WRITE: / lv_name.
DATA(lv_len) = strlen( lv_name ).
WRITE: / 'Length:', lv_len.
DATA(lv_clean) = '   Hello   World   '.
CONDENSE lv_clean.
WRITE: / lv_clean.
`, { includesText: 'SMITH, JOHN' })

// ── 10. Messages, formats, selection ───────────────────────────────────
run('Z_MESSAGE', `
REPORT Z_MESSAGE.
MESSAGE 'Data saved successfully' TYPE 'S'.
WRITE 'Done'.
MESSAGE 'Please check your input' TYPE 'W'.
`, { includesText: 'Done' })

run('Z_PARAMS', `
REPORT Z_PARAMS.
PARAMETERS: p_carr TYPE c LENGTH 3 DEFAULT 'AA'.
WRITE: / 'Airline:', p_carr.
`, { includesText: 'LH', params: { P_CARR: 'LH' } })

run('Z_SELOPT', `
REPORT Z_SELOPT.
SELECT-OPTIONS: s_price FOR sflight-price.
SELECT * FROM sflight INTO TABLE @DATA(lt_flights) WHERE price IN @s_price.
WRITE: / 'Rows:', lines( lt_flights ).
`, { includesText: 'Rows:', params: { S_PRICE: ['300', '500'] } })

// error cases
run('Z_ERR_SYNTAX', `
REPORT Z_ERR.
DATA gv_x TYPE i
WRITE gv_x.
`, { ok: false, errorIncludes: 'Expected' })

run('Z_ERR_UNKNOWN', `
REPORT Z_ERR2.
WRITE gv_missing.
`, { ok: false, errorIncludes: 'unknown' })

run('Z_ERR_ZERO', `
REPORT Z_ERR3.
DATA gv_a TYPE i.
gv_a = 10 / 0.
`, { ok: false, errorIncludes: 'zero' })

run('Z_DEMO_OUTPUT', `
REPORT Z_DEMO_OUTPUT.
SELECT carrid, connid, price FROM sflight INTO TABLE @DATA(lt_flights) UP TO 5 ROWS.
cl_demo_output=>display( lt_flights ).
`, { ok: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
