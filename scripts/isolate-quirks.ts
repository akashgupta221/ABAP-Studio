// Isolate parser quirks found by probes
import { runAbap, DbSnapshot } from '../src/lib/abap/index'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT',
  description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', PRICE: '425.40' },
    { CARRID: 'AA', CONNID: '0064', PRICE: '550.00' },
    { CARRID: 'LH', CONNID: '0400', PRICE: '350.00' },
  ],
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} :: ${JSON.stringify(text.slice(0, 120))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// 1. CALL FUNCTION EXCEPTIONS → IF/ELSE
run('Q1_FM_EXC', `
REPORT Q1.
DATA gv_ok TYPE i VALUE 1.
IF gv_ok = 1.
  WRITE 'yes'.
ELSE.
  WRITE 'no'.
ENDIF.
`)

// 2. simple IF after WRITE colon chain
run('Q2_IF', `
REPORT Q2.
WRITE: / 'x'.
IF 1 = 1.
  WRITE 'one'.
ELSE.
  WRITE 'other'.
ENDIF.
`)

// 3. table expr multi-cond without AND
run('Q3_MULTI', `
REPORT Q3.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA(ls_a) = lt_f[ carrid = 'AA' connid = '0064' ].
WRITE / ls_a-price.
`)

// 4. table expr multi-cond with AND
run('Q4_AND', `
REPORT Q4.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA(ls_a) = lt_f[ carrid = 'AA' AND connid = '0064' ].
WRITE / ls_a-price.
`)

// 5. table expr single cond
run('Q5_SINGLE', `
REPORT Q5.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA(ls_a) = lt_f[ carrid = 'AA' ].
WRITE / ls_a-price.
`)

// 6. WRITE chain formatting variants
run('Q6_WRITE_FORMS', `
REPORT Q6.
WRITE: / AT 3(10) 'abc' COLOR 4.
WRITE AT 15(10) 'xyz' COLOR 6 INVERSE.
ULINE AT 1(40).
SKIP.
WRITE: / 'plain'.
`)

// 7. FORMAT COLOR / statement-level
run('Q7_FORMAT', `
REPORT Q7.
FORMAT COLOR 2 INTENSIFIED.
WRITE: / 'header' .
FORMAT COLOR OFF.
WRITE: / 'normal'.
`)

// 8. sy-index write and DO nested exit/check/continue
run('Q8_LOOPCTL', `
REPORT Q8.
DO 10 TIMES.
  IF sy-index = 3. CONTINUE. ENDIF.
  IF sy-index > 5. EXIT. ENDIF.
  CHECK sy-index <> 5.
  WRITE: / sy-index.
ENDDO.
`)

// 9. WHILE + nested
run('Q9_WHILE', `
REPORT Q9.
DATA gv_i TYPE i VALUE 1.
WHILE gv_i <= 3.
  DATA gv_j TYPE i VALUE 1.
  WHILE gv_j <= gv_i.
    WRITE '*'.
    gv_j = gv_j + 1.
  ENDWHILE.
  NEW-LINE.
  gv_i = gv_i + 1.
ENDWHILE.
`)

// 10. DESCRIBE TABLE
run('Q10_DESCRIBE', `
REPORT Q10.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
DATA lv_lines TYPE i.
DESCRIBE TABLE lt_f LINES lv_lines.
WRITE: / 'Lines:', lv_lines.
`)

// 11. MOVE-CORRESPONDING
run('Q11_MOVECORR', `
REPORT Q11.
TYPES: BEGIN OF ty_a,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
         extra TYPE c LENGTH 5,
       END OF ty_a.
TYPES: BEGIN OF ty_b,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_b.
DATA gs_a TYPE ty_a.
DATA gs_b TYPE ty_b.
gs_a-carrid = 'LH'. gs_a-price = '350.00'. gs_a-extra = 'XYZ'.
MOVE-CORRESPONDING gs_a TO gs_b.
WRITE: / gs_b-carrid, gs_b-price.
`)

// 12. field symbols loop assigning
run('Q12_FS', `
REPORT Q12.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f ASSIGNING FIELD-SYMBOL(<fs>).
  <fs>-price = <fs>-price + 10.
  WRITE: / <fs>-carrid, <fs>-price.
ENDLOOP.
`)

// 13. nested include + constants + FORM with TABLES
run('Q13_FORMS', `
REPORT Q13.
TYPES: BEGIN OF ty_l,
         v TYPE i,
       END OF ty_l.
DATA gt TYPE STANDARD TABLE OF ty_l.
DATA gs TYPE ty_l.
gs-v = 3. APPEND gs TO gt.
gs-v = 4. APPEND gs TO gt.
PERFORM sum_table TABLES gt.
FORM sum_table TABLES p_t STRUCTURE gs.
  DATA lv_s TYPE i.
  LOOP AT p_t INTO gs.
    lv_s = lv_s + gs-v.
  ENDLOOP.
  WRITE: / 'sum =', lv_s.
ENDFORM.
`)

// 14. string functions
run('Q14_STRFN', `
REPORT Q14.
DATA(lv_s) = '  Hello ABAP  '.
WRITE: / |len={ strlen( lv_s ) }|.
CONDENSE lv_s.
WRITE: / |[{ lv_s }]|.
WRITE: / |to_upper={ to_upper( 'abc' ) } to_lower={ to_lower( 'XYZ' ) }|.
WRITE: / |lines?| .
DATA(lv_sub) = substring( val = 'ABCDEF' off = 2 len = 3 ).
WRITE: / lv_sub.
`)

// 15. itab functions: line_index, lines, value for, sort, delete adj
run('Q15_ITAB', `
REPORT Q15.
TYPES: BEGIN OF ty_p,
         name TYPE string,
         sal TYPE i,
       END OF ty_p.
TYPES ty_p_t TYPE STANDARD TABLE OF ty_p WITH EMPTY KEY.
DATA(gt) = VALUE ty_p_t( ( name = 'A' sal = 300 ) ( name = 'B' sal = 100 ) ( name = 'C' sal = 200 ) ).
SORT gt BY sal ASCENDING.
LOOP AT gt INTO DATA(ls).
  WRITE: / ls-name, ls-sal.
ENDLOOP.
WRITE: / |lines={ lines( gt ) } idxB={ line_index( gt[ name = 'B' ] ) }|.
`)
