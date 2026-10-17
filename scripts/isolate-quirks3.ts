// Isolate part 3: field symbols + method args
import { runAbap, DbSnapshot } from '../src/lib/abap/index'
import { parseAbap } from '../src/lib/abap/parser'

const db = new DbSnapshot()
db.tables.set('SFLIGHT', {
  name: 'SFLIGHT', description: 'Flight',
  fields: [
    { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
    { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Flight No.' },
    { name: 'PRICE', type: 'CURR', length: 10, decimals: 2, text: 'Fare' },
  ],
  rows: [
    { CARRID: 'AA', CONNID: '0017', PRICE: '425.40' },
    { CARRID: 'LH', CONNID: '0400', PRICE: '350.00' },
  ],
})

function run(name: string, source: string, opts?: any) {
  try {
    const result = runAbap({ source, repid: name, db, ...opts })
    const text = result.list.map((l) => l.segments.map((s) => s.text).join('')).join('\n')
    if (result.status === 'ERROR') console.log(`✗ ${name} — ${result.error?.kind} ${result.error?.message} (line ${result.error?.line})`)
    else console.log(`✓ ${name} [${result.status}] :: ${JSON.stringify(text.slice(0, 160))}`)
  } catch (e: any) {
    console.log(`✗ ${name} — THREW ${e.message}`)
  }
}

// S1: minimal FIELD-SYMBOLS before anything else
run('S1_FS_MIN', `
REPORT S1.
FIELD-SYMBOLS: <fs_line> TYPE any.
DATA: BEGIN OF gs,
        carrid TYPE c LENGTH 3,
      END OF gs.
gs-carrid = 'AA'.
ASSIGN gs-carrid TO <fs_line>.
WRITE: / <fs_line>.
`)

// S2: LOOP ASSIGNING with declared fs
run('S2_FS_LOOP', `
REPORT S2.
FIELD-SYMBOLS <fs_row> TYPE any.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f ASSIGNING <fs_row>.
  WRITE: / <fs_row>-carrid, <fs_row>-price.
ENDLOOP.
`)

// S3: inline FIELD-SYMBOL( ) without space
run('S3_FS_INLINE', `
REPORT S3.
SELECT carrid connid price FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f ASSIGNING FIELD-SYMBOL(<fs_row>).
  WRITE: / <fs_row>-carrid, <fs_row>-price.
ENDLOOP.
`)

// S4: dump AST of a FIELD-SYMBOLS statement
try {
  const p = parseAbap(`REPORT X.
FIELD-SYMBOLS: <fs_line> TYPE any.
WRITE <fs_line>.`)
  console.log('S4 stmts:', JSON.stringify(p.stmts.map((s: any) => ({ t: s.t, kind: s.kind, name: s.name }))))
} catch (e: any) { console.log('S4 parse fail:', e.message) }

// S5: method call with named args vs positional
run('S5_ARGS', `
REPORT S5.
CLASS lcl_m DEFINITION.
  PUBLIC SECTION.
    METHODS: pay IMPORTING amount TYPE i RETURNING VALUE(r) TYPE string.
ENDCLASS.
CLASS lcl_m IMPLEMENTATION.
  METHOD pay.
    r = |amount={ amount }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA(lo_m) = NEW lcl_m( ).
  WRITE: / lo_m->pay( amount = 500 ).
  WRITE: / lo_m->pay( 700 ).
`)

// S6: interface method via ref with named arg
run('S6_IF_ARG', `
REPORT S6.
INTERFACE lif_p.
  METHODS pay IMPORTING amount TYPE i RETURNING VALUE(r) TYPE string.
ENDINTERFACE.
CLASS lcl_c DEFINITION.
  PUBLIC SECTION.
    INTERFACES lif_p.
ENDCLASS.
CLASS lcl_c IMPLEMENTATION.
  METHOD lif_p~pay.
    r = |Card: { amount }|.
  ENDMETHOD.
ENDCLASS.
START-OF-SELECTION.
  DATA lo_p TYPE REF TO lif_p.
  lo_p = NEW lcl_c( ).
  WRITE: / lo_p->lif_payment~pay( amount = 100 ).
`)
