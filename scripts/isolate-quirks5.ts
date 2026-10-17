// Isolate part 5: fs write propagation + layout forms + misc
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

// U1: fs write with immediate print
run('U1_FS_WRITE', `
REPORT U1.
DATA: gt TYPE STANDARD TABLE OF sflight,
      fs TYPE sflight.
SELECT * FROM sflight INTO TABLE gt.
LOOP AT gt ASSIGNING <fs>.
  <fs>-price = <fs>-price + '50.00'.
  WRITE: / <fs>-carrid, <fs>-price.
ENDLOOP.
LOOP AT gt INTO DATA(ls).
  WRITE: / 'after:', ls-carrid, ls-price.
ENDLOOP.
`)

// U2: write via INTO + MODIFY instead
run('U2_MODIFY', `
REPORT U2.
DATA: gt TYPE STANDARD TABLE OF sflight,
      gs TYPE sflight.
SELECT * FROM sflight INTO TABLE gt.
LOOP AT gt INTO gs.
  gs-price = gs-price + '50.00'.
  MODIFY gt FROM gs.
  WRITE: / gs-carrid, gs-price.
ENDLOOP.
`)

// U3: layout with / AT everywhere
run('U3_LAYOUT', `
REPORT U3 LINE-SIZE 100.
FORMAT COLOR 1.
WRITE: / AT 25(50) 'FLIGHT AVAILABILITY REPORT'.
FORMAT COLOR OFF.
SKIP.
ULINE AT 1(80).
FORMAT COLOR 3.
WRITE: / AT 1(4) 'Car', AT 8(5) 'Conn', AT 16(12) 'Flight Date', AT 32(10) 'Price'.
FORMAT COLOR OFF.
ULINE AT 1(80).
SELECT * FROM sflight INTO TABLE @DATA(lt_f).
LOOP AT lt_f INTO DATA(ls).
  WRITE: / AT 1(4) ls-carrid, AT 8(5) ls-connid, AT 16(12) ls-fldate, AT 32(10) ls-price.
ENDLOOP.
ULINE AT 1(80).
`)

// U4: arithmetic pre-computed then template
run('U4_ARITH', `
REPORT U4.
DATA lv_a TYPE i VALUE 10.
DATA lv_b TYPE i VALUE 32.
DATA lv_sum TYPE i.
lv_sum = lv_a + lv_b.
WRITE: / |Sum: { lv_sum }|.
DATA(lv_diff) = lv_b - lv_a.
WRITE: / |Diff: { lv_diff }|.
`)

// U5: repeat with local var (sy-index workaround)
run('U5_REPEAT', `
REPORT U5.
DO 5 TIMES.
  DATA(lv_n) = sy-index.
  WRITE: / repeat( val = '*' occ = lv_n ).
ENDDO.
`)

// U6: WRITE statement position form (non-chain)
run('U6_WRITE_POS', `
REPORT U6.
WRITE AT 10(20) 'at ten'.
WRITE / AT 5(10) 'newline five'.
ULINE.
WRITE: / 'X', AT 10 'Y'.
`)

// U7: color statement after chain slash
run('U7_COLOR', `
REPORT U7.
WRITE: / 'red line' COLOR 6.
WRITE: / 'green line' COLOR 5.
WRITE: / 'blue' COLOR 1, AT 10 'yellow' COLOR 7.
`)

// U8: SKIP n + ULINE with int
run('U8_SKIP', `
REPORT U8.
WRITE 'one'.
SKIP 2.
WRITE 'after two skips'.
ULINE.
WRITE 'after uline'.
`)

// U9: MESSAGE
run('U9_MSG', `
REPORT U9.
MESSAGE 'Data saved successfully' TYPE 'S'.
WRITE 'Done'.
MESSAGE 'Please check input' TYPE 'W'.
`)

// U10: APPEND INITIAL LINE / nested VALUE
run('U10_VALUE_NESTED', `
REPORT U10.
TYPES: BEGIN OF ty_item,
         id TYPE i,
         label TYPE string,
       END OF ty_item.
TYPES ty_items TYPE STANDARD TABLE OF ty_item WITH EMPTY KEY.
DATA(gt) = VALUE ty_items( ( id = 1 label = 'One' ) ( id = 2 label = 'Two' ) ).
APPEND VALUE #( id = 3 label = 'Three' ) TO gt.
LOOP AT gt INTO DATA(ls).
  WRITE: / ls-id, ls-label.
ENDLOOP.
`)

// U11: FOR inside VALUE
run('U11_FOR', `
REPORT U11.
TYPES ty_i TYPE STANDARD TABLE OF i WITH EMPTY KEY.
DATA(gt_squares) = VALUE ty_i( FOR i = 1 THEN i + 1 WHILE i <= 5 ( i * i ) ).
LOOP AT gt_squares INTO DATA(lv).
  WRITE: / lv.
ENDLOOP.
`)

// U12: CONV + string funcs in templates
run('U12_CONV', `
REPORT U12.
DATA(lv_num) = CONV i( '42' ).
WRITE: / |num={ lv_num }|.
DATA(lv_txt) = |{ 'abc' WIDTH = 6 }| && '-' && |{ 7 ALIGN = RIGHT WIDTH = 3 }|.
WRITE: / lv_txt.
`)
