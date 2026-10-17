// Isolate part 6: FOR forms, subtraction workaround, READ ASSIGNING
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

// V1: numeric FOR in VALUE
run('V1_FOR_NUM', `
REPORT V1.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(gt_sq) = VALUE ty_i( FOR i = 1 THEN i + 1 WHILE i <= 5 ( i * i ) ).
LOOP AT gt_sq INTO DATA(lv).
  WRITE: / lv.
ENDLOOP.
`)

// V2: FOR ... IN itab
run('V2_FOR_IN', `
REPORT V2.
TYPES: BEGIN OF ty_f,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_f.
TYPES ty_f_t TYPE STANDARD TABLE OF ty_f WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_copy) = VALUE ty_f_t( FOR ls IN lt_src ( carrid = ls-carrid price = ls-price ) ).
LOOP AT gt_copy INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// V3: FOR ... IN ... WHERE
run('V3_FOR_WHERE', `
REPORT V3.
TYPES: BEGIN OF ty_f,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_f.
TYPES ty_f_t TYPE STANDARD TABLE OF ty_f WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_cheap) = VALUE ty_f_t( FOR ls IN lt_src WHERE ( ls-price < 500 ) ( carrid = ls-carrid price = ls-price ) ).
WRITE: / |Cheap flights: { lines( gt_cheap ) }|.
LOOP AT gt_cheap INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// V4: subtraction with parens
run('V4_SUB_PARENS', `
REPORT V4.
DATA: lv_a TYPE i VALUE 10,
      lv_b TYPE i VALUE 32,
      lv_c TYPE i.
lv_c = lv_a - ( lv_b ).
WRITE: / |10 - 32 = { lv_c }|.
lv_c = 100 - ( lv_a ).
WRITE: / |100 - 10 = { lv_c }|.
lv_c = lv_b - 7.
WRITE: / |32 - 7 = { lv_c }|.
`)

// V5: READ TABLE ASSIGNING
run('V5_READ_FS', `
REPORT V5.
DATA: gt TYPE STANDARD TABLE OF sflight,
      fs TYPE sflight.
SELECT * FROM sflight INTO TABLE gt.
READ TABLE gt ASSIGNING <fs> INDEX 2.
IF sy-subrc = 0.
  WRITE: / 'Row 2:', <fs>-carrid, <fs>-price.
ENDIF.
`)

// V6: template with arithmetic on vars precomputed
run('V6_TPL', `
REPORT V6.
DATA: lv_tot TYPE i VALUE 100,
      lv_used TYPE i VALUE 35.
DATA lv_free TYPE i.
lv_free = lv_tot - ( lv_used ).
WRITE: / |Free: { lv_free } of { lv_tot }|.
`)

// V7: COUNT/SUM GROUP BY with join-free select on new DB
run('V7_AGG', `
REPORT V7.
TYPES: BEGIN OF ty_line,
         carrid TYPE c LENGTH 3,
         cnt    TYPE i,
         total  TYPE p DECIMALS 2,
       END OF ty_line.
DATA gt_lines TYPE STANDARD TABLE OF ty_line.
SELECT carrid COUNT(*) AS cnt SUM( price ) AS total FROM sflight INTO TABLE gt_lines GROUP BY carrid.
LOOP AT gt_lines INTO DATA(ls_line).
  WRITE: / |{ ls_line-carrid WIDTH = 4 }|, |{ ls_line-cnt WIDTH = 4 }|, |{ ls_line-total WIDTH = 10 DECIMALS = 2 }|.
ENDLOOP.
`)

// V8: MAX/MIN/AVG without GROUP BY
run('V8_MINMAX', `
REPORT V8.
SELECT MIN( price ) AS lo MAX( price ) AS hi AVG( price ) AS av FROM sflight INTO @DATA(ls_stats).
WRITE: / |Min: { ls_stats-lo }|.
WRITE: / |Max: { ls_stats-hi }|.
WRITE: / |Avg: { ls_stats-av }|.
`)

// V9: nested struct write via fs is fine, loop with where
run('V9_WHERE', `
REPORT V9.
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f INTO DATA(ls) WHERE price > 400.
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// V10: cl_salv_table with column texts + title
run('V10_SALV_FULL', `
REPORT V10.
DATA: lt_f TYPE STANDARD TABLE OF sflight.
SELECT * FROM sflight INTO TABLE lt_f.
cl_salv_table=>factory(
  IMPORTING r_salv_table = DATA(lo_alv)
  CHANGING  t_table      = lt_f ).
DATA(lo_cols) = lo_alv->get_columns( ).
lo_cols->set_optimize( 'X' ).
DATA(lo_col) = lo_cols->get_column( 'CARRID' ).
lo_col->set_long_text( 'Airline Code' ).
lo_col->set_short_text( 'Airline' ).
DATA(lo_col2) = lo_cols->get_column( 'PRICE' ).
lo_col2->set_long_text( 'Air Fare' ).
lo_alv->get_display_settings( )->set_list_header( 'Flight List (ALV)' ).
lo_alv->display( ).
`)
