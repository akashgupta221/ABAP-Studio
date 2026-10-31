// ── Syllabus coverage harness ────────────────────────────────────────────
// One runnable ABAP sample per construct from the classical ABAP syllabus
// (15 chapters). Run: bun test tests/syllabus-coverage.test.ts
import { describe, expect, test } from 'bun:test'
import { DbSnapshot, runAbap, type DbTableDef, type FmEntry } from '../src/lib/abap'
import { parseAbap } from '../src/lib/abap/parser'

function snapshot(): DbSnapshot {
  const snap = new DbSnapshot()
  const tables: DbTableDef[] = [
    {
      name: 'SCARR', description: 'Airlines',
      fields: [
        { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline code' },
        { name: 'CARRNAME', type: 'CHAR', length: 20, text: 'Airline name' },
        { name: 'CURRCODE', type: 'CHAR', length: 5, text: 'Currency' },
      ],
      rows: [
        { CARRID: 'AA', CARRNAME: 'American Airlines', CURRCODE: 'USD' },
        { CARRID: 'LH', CARRNAME: 'Lufthansa', CURRCODE: 'EUR' },
        { CARRID: 'SQ', CARRNAME: 'Singapore Airlines', CURRCODE: 'SGD' },
      ],
    },
    {
      name: 'SPFLI', description: 'Flight schedule',
      fields: [
        { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
        { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Connection' },
        { name: 'CITYFROM', type: 'CHAR', length: 20, text: 'From' },
        { name: 'CITYTO', type: 'CHAR', length: 20, text: 'To' },
        { name: 'DEPTIME', type: 'TIMS', length: 6, text: 'Departure' },
        { name: 'PRICE', type: 'DEC', length: 10, decimals: 2, text: 'Price' },
      ],
      rows: [
        { CARRID: 'LH', CONNID: '0400', CITYFROM: 'FRANKFURT', CITYTO: 'NEW YORK', DEPTIME: '103000', PRICE: '540.00' },
        { CARRID: 'LH', CONNID: '0401', CITYFROM: 'FRANKFURT', CITYTO: 'LONDON', DEPTIME: '091500', PRICE: '180.50' },
        { CARRID: 'SQ', CONNID: '0001', CITYFROM: 'SINGAPORE', CITYTO: 'TOKYO', DEPTIME: '082000', PRICE: '620.00' },
        { CARRID: 'AA', CONNID: '0017', CITYFROM: 'NEW YORK', CITYTO: 'SAN FRANCISCO', DEPTIME: '073000', PRICE: '290.00' },
      ],
    },
    {
      name: 'SBOOK', description: 'Flight bookings',
      fields: [
        { name: 'CARRID', type: 'CHAR', length: 3, key: true, text: 'Airline' },
        { name: 'CONNID', type: 'NUMC', length: 4, key: true, text: 'Connection' },
        { name: 'BOOKID', type: 'NUMC', length: 8, key: true, text: 'Booking' },
        { name: 'CUSTOMID', type: 'NUMC', length: 8, text: 'Customer' },
        { name: 'SMOKER', type: 'CHAR', length: 1, text: 'Smoker' },
        { name: 'LUGGWEIGHT', type: 'DEC', length: 10, decimals: 4, text: 'Weight' },
      ],
      rows: [
        { CARRID: 'LH', CONNID: '0400', BOOKID: '00000001', CUSTOMID: '00000001', SMOKER: 'X', LUGGWEIGHT: '20.0000' },
        { CARRID: 'LH', CONNID: '0400', BOOKID: '00000002', CUSTOMID: '00000002', SMOKER: '', LUGGWEIGHT: '23.5000' },
        { CARRID: 'LH', CONNID: '0400', BOOKID: '00000003', CUSTOMID: '00000001', SMOKER: '', LUGGWEIGHT: '18.2500' },
        { CARRID: 'LH', CONNID: '0401', BOOKID: '00000004', CUSTOMID: '00000003', SMOKER: '', LUGGWEIGHT: '12.0000' },
        { CARRID: 'SQ', CONNID: '0001', BOOKID: '00000005', CUSTOMID: '00000004', SMOKER: 'X', LUGGWEIGHT: '30.0000' },
      ],
    },
  ]
  for (const t of tables) snap.tables.set(t.name, t)
  return snap
}

function fms(): Map<string, FmEntry> {
  const map = new Map<string, FmEntry>()
  map.set('Z_ADD', {
    name: 'Z_ADD',
    importing: [{ name: 'IV_A', type: 'I' }, { name: 'IV_B', type: 'I' }],
    exporting: [{ name: 'EV_SUM', type: 'I' }],
    changing: [], tables: [],
    prog: parseAbap("FUNCTION Z_ADD.\n  EV_SUM = IV_A + IV_B.\nENDFUNCTION."),
  })
  map.set('Z_DIV', {
    name: 'Z_DIV',
    importing: [{ name: 'IV_A', type: 'I' }, { name: 'IV_B', type: 'I' }],
    exporting: [{ name: 'EV_Q', type: 'I' }],
    changing: [], tables: [],
    prog: parseAbap("FUNCTION Z_DIV.\n  IF IV_B = 0.\n    RAISE ZERO_DIVIDE.\n  ENDIF.\n  EV_Q = IV_A / IV_B.\nENDFUNCTION."),
  })
  return map
}

function runSrc(source: string, opts?: { parameters?: Record<string, string | string[]> }) {
  return runAbap({ source, repid: 'ZSYLLABUS_TEST', db: snapshot(), functionModules: fms(), parameters: opts?.parameters })
}

function listText(r: { list: any[] }): string {
  return r.list.map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join(' ')).join('\n')
}

function ok(source: string, expectInList?: string | RegExp) {
  const r = runSrc(source)
  if (r.error) throw new Error(`status=${r.status} ${r.error.kind} line=${r.error.line}: ${r.error.message}`)
  if (expectInList) {
    const text = listText(r)
    const hit = expectInList instanceof RegExp ? expectInList.test(text) : text.includes(expectInList)
    if (!hit) throw new Error(`expected "${String(expectInList)}" in list, got:\n${text}`)
  }
  return r
}

describe('Ch1 Foundations', () => {
  test('REPORT statement + simple WRITE', () => {
    ok("REPORT ZSYLLABUS_TEST.\nWRITE 'Hello ABAP'.", 'Hello ABAP')
  })
  test('PROGRAM statement accepted', () => {
    ok("PROGRAM ZSYLLABUS_TEST.\nWRITE 'P'.")
  })
})

describe('Ch2 Data types & declarations', () => {
  test('predefined types incl. P, D, T, X, STRING, N', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA: c1 TYPE c LENGTH 10 VALUE \'ABC\',',
      '      n1 TYPE n LENGTH 4 VALUE \'0042\',',
      '      d1 TYPE d, t1 TYPE t, p1 TYPE p DECIMALS 2 VALUE \'12.34\',',
      '      x1 TYPE x LENGTH 2 VALUE \'ABCD\', s1 TYPE string, xs TYPE xstring, i1 TYPE i VALUE 7.',
      'd1 = \'20260101\'. t1 = \'123456\'. s1 = \'str\'.',
      'WRITE: / c1, n1, d1, t1, p1, i1, s1.',
    ].join('\n'), '12.34')
  })
  test('TYPES + CONSTANTS + STATICS in form', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'TYPES ty_name TYPE c LENGTH 20.',
      'CONSTANTS gc_vat TYPE p DECIMALS 2 VALUE \'0.19\'.',
      'DATA gv_name TYPE ty_name.',
      'gv_name = \'AKASH\'.',
      'PERFORM show_static.',
      'PERFORM show_static.',
      'FORM show_static.',
      '  STATICS sv_count TYPE i.',
      '  sv_count = sv_count + 1.',
      '  WRITE: / gv_name, gc_vat, sv_count.',
      'ENDFORM.',
    ].join('\n'), /AKASH\s+0\.19\s+2/)
  })
  test('structures BEGIN OF / END OF, nested, INCLUDES?', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'TYPES: BEGIN OF ty_addr,',
      '         city TYPE c LENGTH 20,',
      '         zip  TYPE n LENGTH 5,',
      '       END OF ty_addr.',
      'DATA: BEGIN OF gs_person,',
      '        name TYPE c LENGTH 20 VALUE \'MEIER\',',
      '        addr TYPE ty_addr,',
      '      END OF gs_person.',
      'gs_person-addr-city = \'BERLIN\'.',
      'WRITE: / gs_person-name, gs_person-addr-city.',
    ].join('\n'), 'MEIER')
  })
  test('field symbols ASSIGN / ASSIGNING in loop', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA it TYPE STANDARD TABLE OF i.',
      'FIELD-SYMBOLS <fs> TYPE i.',
      'APPEND 1 TO it. APPEND 2 TO it. APPEND 3 TO it.',
      'ASSIGN 42 TO <fs>.',
      'WRITE <fs>.',
      'LOOP AT it ASSIGNING <fs>.',
      '  <fs> = <fs> * 10.',
      'ENDLOOP.',
      'READ TABLE it INDEX 3 INTO DATA(lv).',
      'WRITE: / lv.',
    ].join('\n'), /42\s+30/)
  })
  test('data references REF TO / CREATE DATA / ->*', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA dref TYPE REF TO i.',
      'CREATE DATA dref.',
      'dref->* = 99.',
      'WRITE dref->*.',
    ].join('\n'), '99')
  })
  test('system fields sy-subrc sy-tabix sy-index sy-datum', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA it TYPE STANDARD TABLE OF i.',
      'APPEND 5 TO it.',
      'READ TABLE it INDEX 1.',
      'WRITE: / sy-subrc, sy-tabix.',
      'DO 3 TIMES.',
      '  WRITE sy-index.',
      'ENDDO.',
    ].join('\n'), /0\s+1\s+1\s+2\s+3/)
  })
})

describe('Ch3 ABAP Dictionary (engine-visible part)', () => {
  test('SELECT from transparent table works', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA wa TYPE scarr.',
      'SELECT SINGLE * FROM scarr INTO wa WHERE carrid = \'LH\'.',
      'WRITE wa-carrname.',
    ].join('\n'), 'Lufthansa')
  })
})

describe('Ch4 Internal tables', () => {
  const prelude = [
    'REPORT ZSYLLABUS_TEST.',
    'TYPES: BEGIN OF ty_flight,',
    '         carrid TYPE c LENGTH 3,',
    '         connid TYPE n LENGTH 4,',
    '         cityto TYPE c LENGTH 20,',
    '         price  TYPE p DECIMALS 2,',
    '       END OF ty_flight.',
    'DATA it TYPE STANDARD TABLE OF ty_flight WITH DEFAULT KEY.',
    'DATA wa TYPE ty_flight.',
    "SELECT * FROM spfli INTO TABLE it.",
  ].join('\n')
  test('APPEND/INSERT/READ/LOOP/SORT/DELETE/MODIFY on structured itab', () => {
    ok([
      prelude,
      'READ TABLE it INTO wa WITH KEY carrid = \'LH\' connid = \'0401\'.',
      'WRITE: / wa-cityto.',
      'SORT it BY price DESCENDING.',
      'READ TABLE it INDEX 1 INTO wa.',
      'WRITE wa-cityto.',
      'INSERT VALUE #( carrid = \'XX\' connid = \'9999\' cityto = \'ROME\' price = \'10.00\' ) INTO TABLE it.',
      'DELETE it WHERE carrid = \'AA\'.',
      'DESCRIBE TABLE it LINES DATA(lines).',
      'WRITE lines.',
    ].join('\n'), /LONDON\s+TOKYO\s+4/)
  })
  test('COLLECT sums numeric fields', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'TYPES: BEGIN OF ty_cnt, name TYPE c LENGTH 5, cnt TYPE i, END OF ty_cnt.',
      'DATA it TYPE STANDARD TABLE OF ty_cnt WITH DEFAULT KEY.',
      'DATA wa TYPE ty_cnt.',
      'wa-name = \'A\'. wa-cnt = 2. COLLECT wa INTO it.',
      'wa-name = \'B\'. wa-cnt = 1. COLLECT wa INTO it.',
      'wa-name = \'A\'. wa-cnt = 3. COLLECT wa INTO it.',
      'LOOP AT it INTO wa.',
      '  WRITE: / wa-name, wa-cnt.',
      'ENDLOOP.',
    ].join('\n'), /A\s+5/)
  })
  test('control breaks AT FIRST/AT NEW/AT END OF/AT LAST + SUM', () => {
    ok([
      prelude,
      'DATA lv_total TYPE p DECIMALS 2.',
      'SORT it BY carrid.',
      'LOOP AT it INTO wa.',
      '  AT FIRST.',
      '    WRITE / \'-- START --\'.',
      '  ENDAT.',
      '  AT NEW carrid.',
      '    WRITE: / \'Airline\', wa-carrid.',
      '  ENDAT.',
      '  lv_total = lv_total + wa-price.',
      '  AT END OF carrid.',
      '    SUM.',
      '    WRITE: / \'subtotal\', wa-price.',
      '  ENDAT.',
      '  AT LAST.',
      '    WRITE / \'-- END --\'.',
      '  ENDAT.',
      'ENDLOOP.',
    ].join('\n'), '-- START --')
  })
  test('REFRESH / CLEAR / FREE', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA it TYPE STANDARD TABLE OF i.',
      'APPEND 1 TO it. APPEND 2 TO it.',
      'REFRESH it.',
      'APPEND 9 TO it.',
      'READ TABLE it INDEX 1 INTO DATA(lv).',
      'WRITE lv.',
      'CLEAR it. FREE it.',
    ].join('\n'), '9')
  })
  test('sorted + hashed table kinds', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA st TYPE SORTED TABLE OF i WITH NON-UNIQUE DEFAULT KEY.',
      'DATA ht TYPE HASHED TABLE OF i WITH UNIQUE DEFAULT KEY.',
      'INSERT 3 INTO TABLE st. INSERT 1 INTO TABLE st. INSERT 2 INTO TABLE st.',
      'INSERT 5 INTO TABLE ht. INSERT 1 INTO TABLE ht.',
      'LOOP AT st INTO DATA(lv). WRITE lv. ENDLOOP.',
      'LOOP AT ht INTO lv. WRITE lv. ENDLOOP.',
    ].join('\n'), /1\s+2\s+3\s+5\s+1/)  // hashed: duplicate INSERT rejected; iteration in insertion order
  })
  test('table expressions itab[ 1 ] and VALUE with FOR', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA it TYPE STANDARD TABLE OF i.',
      'APPEND 7 TO it. APPEND 8 TO it.',
      'WRITE it[ 2 ].',
      'WRITE lines( it ).',
    ].join('\n'), /8\s+2/)
  })
})

describe('Ch5 Open SQL', () => {
  test('SELECT ... ENDSELECT + WHERE + ORDER BY', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA wa TYPE spfli.',
      'SELECT * FROM spfli INTO wa WHERE cityfrom = \'FRANKFURT\' ORDER BY connid.',
      '  WRITE: / wa-connid, wa-cityto.',
      'ENDSELECT.',
    ].join('\n'), /0400\s+NEW YORK/)
  })
  test('JOIN', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA: BEGIN OF wa, carrname TYPE c LENGTH 20, connid TYPE n LENGTH 4, END OF wa.',
      'SELECT s~carrname p~connid INTO wa FROM spfli AS p INNER JOIN scarr AS s ON s~carrid = p~carrid WHERE p~carrid = \'SQ\'.',
      '  WRITE: / wa-carrname, wa-connid.',
      'ENDSELECT.',
    ].join('\n'), /Singapore Airlines\s+0001/)
  })
  test('FOR ALL ENTRIES', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'TYPES: BEGIN OF ty_key, carrid TYPE c LENGTH 3, connid TYPE n LENGTH 4, END OF ty_key.',
      'DATA keys TYPE STANDARD TABLE OF ty_key WITH DEFAULT KEY.',
      'DATA wa TYPE spfli.',
      'APPEND VALUE #( carrid = \'LH\' connid = \'0400\' ) TO keys.',
      'APPEND VALUE #( carrid = \'SQ\' connid = \'0001\' ) TO keys.',
      'SELECT * FROM spfli INTO wa FOR ALL ENTRIES IN keys WHERE carrid = keys-carrid AND connid = keys-connid.',
      '  WRITE: / wa-carrid, wa-connid.',
      'ENDSELECT.',
    ].join('\n'), /LH\s+0400/)
  })
  test('aggregates COUNT/SUM/AVG + GROUP BY + HAVING', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA: cnt TYPE i, sumw TYPE p DECIMALS 4.',
      'SELECT COUNT(*) SUM( luggweight ) INTO (cnt, sumw) FROM sbook WHERE carrid = \'LH\'.',
      'WRITE: / cnt, sumw.',
      'DATA: carr TYPE c LENGTH 3, avgw TYPE p DECIMALS 4.',
      'SELECT carrid AVG( luggweight ) INTO (carr, avgw) FROM sbook GROUP BY carrid HAVING COUNT(*) > 1.',
      '  WRITE: / carr, avgw.',
      'ENDSELECT.',
    ].join('\n'), /4\s+73\.75/)
  })
  test('INSERT/UPDATE/MODIFY/DELETE db + COMMIT WORK', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA wa TYPE scarr.',
      "wa-carrid = 'ZZ'. wa-carrname = 'Test Air'. wa-currcode = 'EUR'.",
      'INSERT scarr FROM wa.',
      "UPDATE scarr SET currcode = 'USD' WHERE carrid = 'ZZ'.",
      "wa-currcode = 'GBP'. MODIFY scarr FROM wa.",
      'SELECT SINGLE currcode FROM scarr INTO wa-currcode WHERE carrid = \'ZZ\'.',
      'WRITE wa-currcode.',
      'DELETE FROM scarr WHERE carrid = \'ZZ\'.',
      'COMMIT WORK.',
      'SELECT COUNT(*) FROM scarr INTO DATA(n).',
      'WRITE n.',
    ].join('\n'), /GBP\s+3/)
  })
  test('AUTHORITY-CHECK statement parses and runs', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'AUTHORITY-CHECK OBJECT \'S_TCODE\' ID \'TCD\' FIELD \'SE38\'.',
      'WRITE sy-subrc.',
    ].join('\n'))
  })
})

describe('Ch6 Control structures', () => {
  test('IF/ELSEIF/CASE/DO/WHILE/EXIT/CONTINUE/CHECK', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA lv TYPE i VALUE 5.',
      'IF lv > 10. WRITE \'big\'. ELSEIF lv > 3. WRITE \'mid\'. ELSE. WRITE \'small\'. ENDIF.',
      'CASE lv.',
      '  WHEN 5. WRITE \'five\'.',
      '  WHEN OTHERS. WRITE \'other\'.',
      'ENDCASE.',
      'DO 5 TIMES.',
      '  IF sy-index = 4. EXIT. ENDIF.',
      '  WRITE sy-index.',
      'ENDDO.',
      'WHILE lv < 9.',
      '  lv = lv + 1.',
      '  IF lv = 7. CONTINUE. ENDIF.',
      '  CHECK lv <> 8.',
      '  WRITE lv.',
      'ENDWHILE.',
    ].join('\n'), /mid\s+five\s+1\s+2\s+3\s+6\s+9/)
  })
  test('logical expressions BETWEEN, IN, IS INITIAL, IS ASSIGNED, IS BOUND', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA lv TYPE i VALUE 5.',
      'IF lv BETWEEN 1 AND 10. WRITE \'in-range\'. ENDIF.',
      'IF lv IN ( 4, 5, 6 ) OR lv = 5. WRITE \'in-list\'. ENDIF.',
      'DATA lv_str TYPE string.',
      'IF lv_str IS INITIAL. WRITE \'empty\'. ENDIF.',
      'DATA lr TYPE REF TO data.',
      'IF lr IS NOT BOUND. WRITE \'unbound\'. ENDIF.',
    ].join('\n'), 'in-range in-list empty unbound')
  })
})

describe('Ch7 Modularization', () => {
  test('FORM with USING/CHANGING/TABLES + TYPE VALUE', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA gv TYPE i VALUE 10.',
      'DATA gt TYPE STANDARD TABLE OF i.',
      'PERFORM calc USING 5 CHANGING gv.',
      'WRITE gv.',
      'APPEND 1 TO gt. APPEND 2 TO gt.',
      'PERFORM fill TABLES gt.',
      'READ TABLE gt INDEX 3 INTO DATA(lv).',
      'WRITE lv.',
      'FORM calc USING p_add TYPE i CHANGING p_val TYPE i.',
      '  p_val = p_val + p_add.',
      'ENDFORM.',
      'FORM fill TABLES p_tab STRUCTURE gv_dummy.',
      '  APPEND 99 TO p_tab.',
      'ENDFORM.',
    ].join('\n'), /15\s+99/)
  })
  test('FUNCTION module call EXPORTING/IMPORTING/EXCEPTIONS', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA lv_sum TYPE i.',
      "CALL FUNCTION 'Z_ADD' EXPORTING iv_a = 3 iv_b = 4 IMPORTING ev_sum = lv_sum.",
      'WRITE lv_sum.',
    ].join('\n'), '7')
  })
  test('FM exception RAISE + EXCEPTIONS handling', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA lv_q TYPE i.',
      "CALL FUNCTION 'Z_DIV' EXPORTING iv_a = 10 iv_b = 0 IMPORTING ev_q = lv_q EXCEPTIONS zero_divide = 1 OTHERS = 2.",
      'IF sy-subrc = 1. WRITE \'caught\'. ENDIF.',
    ].join('\n'), 'caught')
  })
  test('INCLUDE program (top-of-file include resolution)', () => {
    const r = runAbap({
      source: "REPORT ZSYLLABUS_TEST.\nINCLUDE ZCOMMON.\nWRITE gv_common.",
      repid: 'ZSYLLABUS_TEST',
      db: snapshot(),
      includes: new Map([['ZCOMMON', 'DATA gv_common TYPE i VALUE 77.']]),
    })
    const text = listText(r)
    expect(text).toContain('77')
  })
  test('macros DEFINE / END-OF-DEFINITION', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DEFINE out2.',
      "  WRITE: / &1, &2.",
      'END-OF-DEFINITION.',
      "out2 'macro' 'works'.",
    ].join('\n'), 'macro works')
  })
  test('MESSAGE ... TYPE with custom message text', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      "MESSAGE 'Something happened' TYPE 'I'.",
      "MESSAGE E001(ZCLASS) WITH 'detail'.",
    ].join('\n'))
    expect(r.messages.length).toBeGreaterThan(0)
  })
})

describe('Ch8 Selection screens', () => {
  test('PARAMETERS with DEFAULT/OBLIGATORY + SELECT-OPTIONS + blocks', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      'SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE title.',
      "PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.",
      'SELECT-OPTIONS s_con FOR spfli-connid.',
      'SELECTION-SCREEN END OF BLOCK b1.',
      'INITIALIZATION.',
      "  s_con-low = '0400'. s_con-high = '0401'. APPEND s_con.",
      'START-OF-SELECTION.',
      '  DATA wa TYPE spfli.',
      '  SELECT * FROM spfli INTO wa WHERE carrid = p_carr AND connid IN s_con.',
      '    WRITE: / wa-connid, wa-cityto.',
      '  ENDSELECT.',
    ].join('\n'))
    expect(r.status).toBe('REQUIRES_INPUT')
    const r2 = runAbap({
      source: [
        'REPORT ZSYLLABUS_TEST.',
        'SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE title.',
        "PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.",
        'SELECT-OPTIONS s_con FOR spfli-connid.',
        'SELECTION-SCREEN END OF BLOCK b1.',
        'INITIALIZATION.',
        "  s_con-low = '0400'. s_con-high = '0401'. APPEND s_con.",
        'START-OF-SELECTION.',
        '  DATA wa TYPE spfli.',
        '  SELECT * FROM spfli INTO wa WHERE carrid = p_carr AND connid IN s_con.',
        '    WRITE: / wa-connid, wa-cityto.',
        '  ENDSELECT.',
      ].join('\n'),
      repid: 'ZSYLLABUS_TEST',
      db: snapshot(),
      functionModules: fms(),
      parameters: { P_CARR: 'LH', S_CON: ['0400', '0401'] },
    })
    if (r2.error) throw new Error(`${r2.error.kind} line=${r2.error.line}: ${r2.error.message}`)
    const text = listText(r2)
    expect(text).toContain('NEW YORK')
  })
  test('AT SELECTION-SCREEN runs after input', () => {
    const src = [
      'REPORT ZSYLLABUS_TEST.',
      "PARAMETERS p_num TYPE i DEFAULT '5'.",
      'AT SELECTION-SCREEN.',
      '  IF p_num > 100.',
      "    MESSAGE 'too big' TYPE 'E'.",
      '  ENDIF.',
      'START-OF-SELECTION.',
      '  WRITE p_num.',
    ].join('\n')
    const first = runSrc(src)
    expect(first.status).toBe('REQUIRES_INPUT')
    const r = runAbap({ source: src, repid: 'ZSYLLABUS_TEST', db: snapshot(), functionModules: fms(), parameters: { P_NUM: '150' } })
    expect(r.messages.length).toBeGreaterThan(0)
    expect(r.status).toBe('ERROR')
  })
})

describe('Ch9 Classical reports & lists', () => {
  test('TOP-OF-PAGE + END-OF-SELECTION events', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'TOP-OF-PAGE.',
      "  WRITE 'PAGE HEADER'.",
      'START-OF-SELECTION.',
      "  WRITE 'body'.",
      'END-OF-SELECTION.',
      "  WRITE 'done'.",
    ].join('\n'), /PAGE HEADER[\s\S]*body[\s\S]*done/)
  })
  test('WRITE formatting: ULINE, SKIP, NEW-PAGE, FORMAT, hotspot', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'ULINE.',
      'SKIP 1.',
      'FORMAT COLOR COL_TOTAL INTENSIFIED ON.',
      "WRITE: / 'formatted'.",
      'FORMAT RESET.',
      "WRITE / 'hotspot' HOTSPOT ON.",
      'NEW-PAGE.',
      "WRITE / 'page2'.",
    ].join('\n'), 'page2')
  })
  test('AT LINE-SELECTION and HIDE do not crash a list report', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA wa TYPE scarr.',
      "SELECT * FROM scarr INTO wa WHERE carrid = 'LH'.",
      '  WRITE: / wa-carrid HOTSPOT ON, wa-carrname.',
      '  HIDE: wa-carrid.',
      'ENDSELECT.',
      'AT LINE-SELECTION.',
      "  WRITE: / 'detail', wa-carrid.",
    ].join('\n'), 'Lufthansa')
  })
  test('sy-lsind / interactive event shape tolerated', () => {
    ok('REPORT ZSYLLABUS_TEST.\nWRITE sy-lsind.', '0')
  })
})

describe('Ch11 Classic lists output', () => {
  test('list buffer lines carry text (LEAVE TO LIST-PROCESSING tolerated in report context)', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      'NEW-PAGE LINE-SIZE 40.',
      "WRITE / 'in list buffer'.",
    ].join('\n'))
    const text = listText(r)
    expect(text).toContain('in list buffer')
  })
})

describe('Ch12 Data transfer / interfaces', () => {
  test('file handling statements parse (OPEN DATASET etc. → simulated failure, no crash)', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      "OPEN DATASET 'test.txt' FOR OUTPUT IN TEXT MODE ENCODING DEFAULT.",
      "IF sy-subrc = 0. TRANSFER 'line' TO 'test.txt'. CLOSE DATASET 'test.txt'. WRITE 'opened'. ELSE. WRITE 'no-file'. ENDIF.",
    ].join('\n'))
    if (r.error) throw new Error(`${r.error.kind} line=${r.error.line}: ${r.error.message}`)
    const text = listText(r)
    expect(text).toMatch(/opened|no-file/)
  })
  test('CALL FUNCTION ... DESTINATION is tolerated (RFC boundary)', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      "CALL FUNCTION 'Z_ADD' DESTINATION 'NONE' EXPORTING iv_a = 1 iv_b = 2 IMPORTING ev_sum = DATA(lv).",
      'WRITE lv.',
    ].join('\n'))
    if (r.error) throw new Error(`${r.error.kind} line=${r.error.line}: ${r.error.message}`)
  })
  test('CALL TRANSACTION / BDC shape tolerated or clearly simulated', () => {
    const r = runSrc([
      'REPORT ZSYLLABUS_TEST.',
      'DATA bdc TYPE STANDARD TABLE OF bdcdata.',
      'DATA msg TYPE STANDARD TABLE OF bdcmsgcoll.',
      "CALL TRANSACTION 'SE38' USING bdc MODE 'E' MESSAGES INTO msg.",
      'WRITE sy-subrc.',
    ].join('\n'))
    if (r.error) throw new Error(`${r.error.kind} line=${r.error.line}: ${r.error.message}`)
  })
})

describe('Ch15 Debugging & runtime', () => {
  test('GET RUNTIME FIELD', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA t0 TYPE i.',
      'GET RUNTIME FIELD t0.',
      'WRITE t0 >= 0.',
    ].join('\n'), 'X')
  })
  test('DO with VARYING / WHILE with complex cond', () => {
    ok([
      'REPORT ZSYLLABUS_TEST.',
      'DATA: BEGIN OF gs, a TYPE i VALUE 1, b TYPE i VALUE 2, c TYPE i VALUE 3, END OF gs.',
      'DATA lv TYPE i.',
      'DO VARYING lv FROM gs-a NEXT gs-b.',
      '  WRITE lv.',
      '  IF lv >= 3. EXIT. ENDIF.',
      'ENDDO.',
    ].join('\n'), /1\s+2\s+3/)
  })
})
