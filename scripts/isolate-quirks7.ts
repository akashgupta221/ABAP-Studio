// Isolate part 7: FOR-IN forms that parse
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

// W1: paren-less FOR fields
run('W1_FOR_FLAT', `
REPORT W1.
TYPES: BEGIN OF ty_f,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_f.
TYPES ty_f_t TYPE STANDARD TABLE OF ty_f WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_copy) = VALUE ty_f_t( FOR ls IN lt_src carrid = ls-carrid price = ls-price ).
LOOP AT gt_copy INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// W2: FOR with comma then row parens
run('W2_FOR_COMMA', `
REPORT W2.
TYPES: BEGIN OF ty_f,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_f.
TYPES ty_f_t TYPE STANDARD TABLE OF ty_f WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_copy) = VALUE ty_f_t( FOR ls IN lt_src, ( carrid = ls-carrid price = ls-price ) ).
LOOP AT gt_copy INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// W3: FOR IN with WHERE, flat
run('W3_FOR_WHERE', `
REPORT W3.
TYPES: BEGIN OF ty_f,
         carrid TYPE c LENGTH 3,
         price TYPE p DECIMALS 2,
       END OF ty_f.
TYPES ty_f_t TYPE STANDARD TABLE OF ty_f WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_cheap) = VALUE ty_f_t( FOR ls IN lt_src WHERE ls-price < 500 carrid = ls-carrid price = ls-price ).
WRITE: / |Cheap: { lines( gt_cheap ) }|.
LOOP AT gt_cheap INTO DATA(ls).
  WRITE: / ls-carrid, ls-price.
ENDLOOP.
`)

// W4: numeric FOR with REDUCE (known working) + SWITCH
run('W4_REDUCE', `
REPORT W4.
DATA(lv_sum) = REDUCE #( INIT s = 0 FOR i = 1 THEN i + 1 WHILE i <= 10 NEXT s = s + i ).
WRITE: / |Sum 1..10 = { lv_sum }|.
DATA(lv_grade) = 'B'.
DATA(lv_txt) = SWITCH #( lv_grade WHEN 'A' THEN 'Excellent' WHEN 'B' THEN 'Good' ELSE 'Other' ).
WRITE: / |Grade B = { lv_txt }|.
`)

// W5: FOR over numeric range inside REDUCE with strings
run('W5_REDUCE_STR', `
REPORT W5.
DATA(lv_stars) = REDUCE #( INIT s = '' FOR i = 1 THEN i + 1 WHILE i <= 5 NEXT s = s && '*' ).
WRITE: / lv_stars.
`)

// W6: nested FOR?
run('W6_FOR_NESTED', `
REPORT W6.
TYPES ty_s TYPE STANDARD TABLE OF string WITH EMPTY KEY.
SELECT carrid price FROM sflight INTO TABLE @DATA(lt_src).
DATA(gt_lbl) = VALUE ty_s( FOR ls IN lt_src ( |{ ls-carrid }: { ls-price }| ) ).
LOOP AT gt_lbl INTO DATA(lv).
  WRITE: / lv.
ENDLOOP.
`)
