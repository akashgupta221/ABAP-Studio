// Isolate part 2: FM EXCEPTIONS + ASSIGNING + misc
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT',
  description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'FLDATE', type: 'DATS', key: true, text: 'Date' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', FLDATE: '20250101', PRICE: '425.40' },
    { CARRID: 'LH', CONNID: '0400', FLDATE: '20250115', PRICE: '350.00' },
  ],
})

const fms = new Map<any, any>()
fms.set('Z_GET_FLIGHT', {
  name: 'Z_GET_FLIGHT',
  importing: [{ name: 'CARRID', type: 'CHAR', length: 3 }, { name: 'CONNID', type: 'NUMC', length: 4 }],
  exporting: [{ name: 'FLIGHT', type: 'SFLIGHT' }],
  changing: [], tables: [],
  prog: parseAbap(`FUNCTION 'Z_GET_FLIGHT'.
  SELECT SINGLE * FROM sflight INTO flight WHERE carrid = carrid AND connid = connid.
  IF sy-subrc <> 0.
    RAISE not_found.
  ENDIF.
ENDFUNCTION.`),
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}]${result.alv ? ' [ALV]' : ''} :: ${JSON.stringify(text.slice(0, 160))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// 1. CALL FUNCTION with EXCEPTIONS then IF/ELSE — the probe-seed failure
run('R1_FM', `
REPORT R1.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others    = 2.
IF sy-subrc = 0.
  WRITE: / 'found'.
ELSE.
  WRITE: / 'not found'.
ENDIF.
`, { functionModules: fms })

// 2. same but EXCEPTIONS with no spaces around =
run('R2_FM_TIGHT', `
REPORT R2.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight
  EXCEPTIONS
    not_found = 1
    others = 2.
IF sy-subrc = 0.
  WRITE: / 'found'.
ELSE.
  WRITE: / 'not found'.
ENDIF.
`, { functionModules: fms })

// 3. no EXCEPTIONS clause
run('R3_FM_NOEXC', `
REPORT R3.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
  EXPORTING
    carrid = 'AA'
    connid = '0017'
  IMPORTING
    flight = gs_flight.
IF sy-subrc = 0.
  WRITE: / 'found'.
ENDIF.
`, { functionModules: fms })

// 4. IF on same indentation — maybe indentation-sensitive? try single-space indent
run('R4_FM_INDENT', `
REPORT R4.
DATA gs_flight TYPE sflight.
CALL FUNCTION 'Z_GET_FLIGHT'
 EXPORTING
  carrid = 'AA'
  connid = '0017'
 IMPORTING
  flight = gs_flight
 EXCEPTIONS
  not_found = 1
  others = 2.
IF sy-subrc = 0.
 WRITE 'found'.
ELSE.
 WRITE 'not found'.
ENDIF.
`, { functionModules: fms })

// 5. field symbols declared separately
run('R5_FS_DECL', `
REPORT R5.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
FIELD-SYMBOLS <fs> TYPE any.
LOOP AT lt_f ASSIGNING <fs>.
  WRITE: / <fs>-carrid, <fs>-price.
ENDLOOP.
`)

// 6. inline FIELD-SYMBOL( <fs> ) with space
run('R6_FS_INLINE_SP', `
REPORT R6.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f ASSIGNING FIELD-SYMBOL( <fs> ).
  WRITE: / <fs>-carrid, <fs>-price.
ENDLOOP.
`)

// 7. READ TABLE ASSIGNING
run('R7_READ_FS', `
REPORT R7.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
FIELD-SYMBOLS <fs> TYPE any.
READ TABLE lt_f ASSIGNING <fs> INDEX 1.
WRITE: / <fs>-carrid.
`)

// 8. WRITE: / for newline
run('R8_NEWLINE', `
REPORT R8.
WRITE 'a'.
WRITE /.
WRITE 'b'.
`)

// 9. NEW-LINE
run('R9_NEWLINE2', `
REPORT R9.
WRITE 'a'.
NEW-LINE.
WRITE 'b'.
`)

// 10. events: INITIALIZATION + START-OF-SELECTION + sy fields
run('R10_EVENTS', `
REPORT R10.
INITIALIZATION.
  DATA gv_flag TYPE string VALUE 'INITIALIZATION ran'.
START-OF-SELECTION.
  WRITE: / gv_flag.
  WRITE: / |Program: { sy-repid }, User: { sy-uname }, TCode: { sy-tcode }|.
`)

// 11. class events + handler with FOR EVENT (from test-abap, verified pattern)
// 12. interface with two impls + polymorphic table
run('R12_POLY', `
REPORT R12.
INTERFACE lif_payment.
  METHODS: pay IMPORTING amount TYPE i RETURNING VALUE(r) TYPE string.
ENDINTERFACE.
CLASS lcl_card DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_payment.
ENDCLASS.
CLASS lcl_card IMPLEMENTATION.
  METHOD lif_payment~pay.
    r = |Card: { amount }|.
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
    WRITE: / lo_p->lif_payment~pay( 100 ).
  ENDLOOP.
`)

// 13. cl_salv_table full pattern with columns
run('R13_SALV', `
REPORT R13.
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
cl_salv_table=>factory(
  IMPORTING r_salv_table = DATA(lo_alv)
  CHANGING t_table = lt_f ).
lo_alv->get_columns( )->set_optimize( 'X' ).
lo_alv->get_display_settings( )->set_list_header( 'Flight List' ).
DATA(lo_col) = lo_alv->get_columns( )->get_column( 'PRICE' ).
lo_col->set_short_text( 'Fare' ).
lo_alv->display( ).
`)

// 14. exceptions get_text with native cx
run('R14_CX_TEXT', `
REPORT R14.
TRY.
    RAISE EXCEPTION TYPE cx_sy_zerodivide.
  CATCH cx_sy_zerodivide INTO DATA(lx).
    WRITE: / |Caught: { lx->get_text( ) }|.
ENDTRY.
`)

// 15. do varying / while with CHECK
run('R15_CHECK', `
REPORT R15.
DATA gv_i TYPE i VALUE 0.
WHILE gv_i < 10.
  gv_i = gv_i + 1.
  CHECK gv_i MOD 2 = 0.
  WRITE: / gv_i.
ENDWHILE.
`)
