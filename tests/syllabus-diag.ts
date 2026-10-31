// standalone diagnostic for syllabus harness
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
  map.set('Z_ADD', { name: 'Z_ADD', importing: [{ name: 'IV_A', type: 'I' }, { name: 'IV_B', type: 'I' }], exporting: [{ name: 'EV_SUM', type: 'I' }], changing: [], tables: [], prog: parseAbap("FUNCTION Z_ADD.\n  EV_SUM = IV_A + IV_B.\nENDFUNCTION.") })
  map.set('Z_DIV', { name: 'Z_DIV', importing: [{ name: 'IV_A', type: 'I' }, { name: 'IV_B', type: 'I' }], exporting: [{ name: 'EV_Q', type: 'I' }], changing: [], tables: [], prog: parseAbap("FUNCTION Z_DIV.\n  IF IV_B = 0.\n    RAISE ZERO_DIVIDE.\n  ENDIF.\n  EV_Q = IV_A / IV_B.\nENDFUNCTION.") })
  return map
}

export function runOne(source: string, opts?: { parameters?: Record<string, string | string[]> }) {
  return runAbap({ source, repid: 'ZSYLLABUS_TEST', db: snapshot(), functionModules: fms(), parameters: opts?.parameters })
}

export function listText(r: any): string {
  return (r.list ?? []).map((l: any) => (l.segments ?? []).map((s: any) => s.text ?? '').join(' ')).join('\n')
}

const cases: Array<[string, string]> = [
  ['TYPES+CONST+STATICS', ['REPORT ZSYLLABUS_TEST.', 'TYPES ty_name TYPE c LENGTH 20.', 'CONSTANTS gc_vat TYPE p DECIMALS 2 VALUE \'0.19\'.', 'DATA gv_name TYPE ty_name.', "gv_name = 'AKASH'.", 'PERFORM show_static.', 'PERFORM show_static.', 'FORM show_static.', '  STATICS sv_count TYPE i.', '  sv_count = sv_count + 1.', '  WRITE: / gv_name, gc_vat, sv_count.', 'ENDFORM.'].join('\n')],
  ['nested structure', ['REPORT ZSYLLABUS_TEST.', 'TYPES: BEGIN OF ty_addr,', '         city TYPE c LENGTH 20,', '         zip  TYPE n LENGTH 5,', '       END OF ty_addr.', 'DATA: BEGIN OF gs_person,', '        name TYPE c LENGTH 20 VALUE \'MEIER\',', '        addr TYPE ty_addr,', '      END OF gs_person.', "gs_person-addr-city = 'BERLIN'.", 'WRITE: / gs_person-name, gs_person-addr-city.'].join('\n')],
  ['field symbols', ['REPORT ZSYLLABUS_TEST.', 'DATA it TYPE STANDARD TABLE OF i.', 'FIELD-SYMBOLS <fs> TYPE i.', 'APPEND 1 TO it. APPEND 2 TO it. APPEND 3 TO it.', 'ASSIGN 42 TO <fs>.', 'WRITE <fs>.', 'LOOP AT it ASSIGNING <fs>.', '  <fs> = <fs> * 10.', 'ENDLOOP.', 'READ TABLE it INDEX 3 INTO DATA(lv).', 'WRITE: / lv.'].join('\n')],
  ['dref', ['REPORT ZSYLLABUS_TEST.', 'DATA dref TYPE REF TO i.', 'CREATE DATA dref.', 'dref->* = 99.', 'WRITE dref->*.'].join('\n')],
  ['sysfields', ['REPORT ZSYLLABUS_TEST.', 'DATA it TYPE STANDARD TABLE OF i.', 'APPEND 5 TO it.', 'READ TABLE it INDEX 1.', 'WRITE: / sy-subrc, sy-tabix.', 'DO 3 TIMES.', '  WRITE sy-index.', 'ENDDO.'].join('\n')],
  ['itab main ops', ['REPORT ZSYLLABUS_TEST.', 'TYPES: BEGIN OF ty_flight,', '         carrid TYPE c LENGTH 3,', '         connid TYPE n LENGTH 4,', '         cityto TYPE c LENGTH 20,', '         price  TYPE p DECIMALS 2,', '       END OF ty_flight.', 'DATA it TYPE STANDARD TABLE OF ty_flight WITH DEFAULT KEY.', 'DATA wa TYPE ty_flight.', 'SELECT * FROM spfli INTO TABLE it.', "READ TABLE it INTO wa WITH KEY carrid = 'LH' connid = '0401'.", 'WRITE: / wa-cityto.', 'SORT it BY price DESCENDING.', 'READ TABLE it INDEX 1 INTO wa.', 'WRITE wa-cityto.', "INSERT VALUE #( carrid = 'XX' connid = '9999' cityto = 'ROME' price = '10.00' ) INTO TABLE it.", "DELETE it WHERE carrid = 'AA'.", 'DESCRIBE TABLE it LINES DATA(lines).', 'WRITE lines.'].join('\n')],
  ['COLLECT', ['REPORT ZSYLLABUS_TEST.', 'TYPES: BEGIN OF ty_cnt, name TYPE c LENGTH 5, cnt TYPE i, END OF ty_cnt.', 'DATA it TYPE STANDARD TABLE OF ty_cnt WITH DEFAULT KEY.', 'DATA wa TYPE ty_cnt.', "wa-name = 'A'. wa-cnt = 2. COLLECT wa INTO it.", "wa-name = 'B'. wa-cnt = 1. COLLECT wa INTO it.", "wa-name = 'A'. wa-cnt = 3. COLLECT wa INTO it.", 'LOOP AT it INTO wa.', '  WRITE: / wa-name, wa-cnt.', 'ENDLOOP.'].join('\n')],
  ['sorted hashed', ['REPORT ZSYLLABUS_TEST.', 'DATA st TYPE SORTED TABLE OF i WITH NON-UNIQUE DEFAULT KEY.', 'DATA ht TYPE HASHED TABLE OF i WITH UNIQUE DEFAULT KEY.', 'APPEND 3 TO st. APPEND 1 TO st. APPEND 2 TO st.', 'INSERT 5 INTO TABLE ht. INSERT 1 INTO TABLE ht.', 'LOOP AT st INTO DATA(lv). WRITE lv. ENDLOOP.', 'LOOP AT ht INTO lv. WRITE lv. ENDLOOP.'].join('\n')],
  ['table expr', ['REPORT ZSYLLABUS_TEST.', 'DATA it TYPE STANDARD TABLE OF i.', 'APPEND 7 TO it. APPEND 8 TO it.', 'WRITE it[ 2 ].', 'WRITE lines( it ).'].join('\n')],
  ['ENDSELECT', ['REPORT ZSYLLABUS_TEST.', 'DATA wa TYPE spfli.', "SELECT * FROM spfli INTO wa WHERE cityfrom = 'FRANKFURT' ORDER BY connid.", '  WRITE: / wa-connid, wa-cityto.', 'ENDSELECT.'].join('\n')],
  ['JOIN', ['REPORT ZSYLLABUS_TEST.', 'DATA: BEGIN OF wa, carrname TYPE c LENGTH 20, connid TYPE n LENGTH 4, END OF wa.', "SELECT s~carrname p~connid INTO wa FROM spfli AS p INNER JOIN scarr AS s ON s~carrid = p~carrid WHERE p~carrid = 'SQ'.", '  WRITE: / wa-carrname, wa-connid.', 'ENDSELECT.'].join('\n')],
  ['FAE', ['REPORT ZSYLLABUS_TEST.', 'TYPES: BEGIN OF ty_key, carrid TYPE c LENGTH 3, connid TYPE n LENGTH 4, END OF ty_key.', 'DATA keys TYPE STANDARD TABLE OF ty_key WITH DEFAULT KEY.', 'DATA wa TYPE spfli.', "APPEND VALUE #( carrid = 'LH' connid = '0400' ) TO keys.", "APPEND VALUE #( carrid = 'SQ' connid = '0001' ) TO keys.", 'SELECT * FROM spfli INTO wa FOR ALL ENTRIES IN keys WHERE carrid = keys-carrid AND connid = keys-connid.', '  WRITE: / wa-carrid, wa-connid.', 'ENDSELECT.'].join('\n')],
  ['aggregates', ['REPORT ZSYLLABUS_TEST.', 'DATA: cnt TYPE i, sumw TYPE p DECIMALS 4.', "SELECT COUNT(*) SUM( luggweight ) INTO (cnt, sumw) FROM sbook WHERE carrid = 'LH'.", 'WRITE: / cnt, sumw.', 'DATA: carr TYPE c LENGTH 3, avgw TYPE p DECIMALS 4.', 'SELECT carrid AVG( luggweight ) INTO (carr, avgw) FROM sbook GROUP BY carrid HAVING COUNT(*) > 1.', '  WRITE: / carr, avgw.', 'ENDSELECT.'].join('\n')],
  ['db write', ['REPORT ZSYLLABUS_TEST.', 'DATA wa TYPE scarr.', "wa-carrid = 'ZZ'. wa-carrname = 'Test Air'. wa-currcode = 'EUR'.", 'INSERT scarr FROM wa.', "UPDATE scarr SET currcode = 'USD' WHERE carrid = 'ZZ'.", "wa-currcode = 'GBP'. MODIFY scarr FROM wa.", "SELECT SINGLE currcode FROM scarr INTO wa-currcode WHERE carrid = 'ZZ'.", 'WRITE wa-currcode.', "DELETE FROM scarr WHERE carrid = 'ZZ'.", 'COMMIT WORK.', 'SELECT COUNT(*) FROM scarr INTO DATA(n).', 'WRITE n.'].join('\n')],
  ['control', ['REPORT ZSYLLABUS_TEST.', 'DATA lv TYPE i VALUE 5.', "IF lv > 10. WRITE 'big'. ELSEIF lv > 3. WRITE 'mid'. ELSE. WRITE 'small'. ENDIF.", 'CASE lv.', "  WHEN 5. WRITE 'five'.", "  WHEN OTHERS. WRITE 'other'.", 'ENDCASE.', 'DO 5 TIMES.', '  IF sy-index = 4. EXIT. ENDIF.', '  WRITE sy-index.', 'ENDDO.', 'WHILE lv < 9.', '  lv = lv + 1.', '  IF lv = 7. CONTINUE. ENDIF.', '  CHECK lv <> 8.', '  WRITE lv.', 'ENDWHILE.'].join('\n')],
  ['logical', ['REPORT ZSYLLABUS_TEST.', 'DATA lv TYPE i VALUE 5.', 'IF lv BETWEEN 1 AND 10. WRITE \'in-range\'. ENDIF.', 'IF lv IN ( 4, 5, 6 ) OR lv = 5. WRITE \'in-list\'. ENDIF.', 'DATA lv_str TYPE string.', "IF lv_str IS INITIAL. WRITE 'empty'. ENDIF.", 'DATA lr TYPE REF TO data.', "IF lr IS NOT BOUND. WRITE 'unbound'. ENDIF."].join('\n')],
  ['form tables', ['REPORT ZSYLLABUS_TEST.', 'DATA gv TYPE i VALUE 10.', 'DATA gt TYPE STANDARD TABLE OF i.', 'PERFORM calc USING 5 CHANGING gv.', 'WRITE gv.', 'APPEND 1 TO gt. APPEND 2 TO gt.', 'PERFORM fill TABLES gt.', 'READ TABLE gt INDEX 2 INTO DATA(lv).', 'WRITE lv.', 'FORM calc USING p_add TYPE i CHANGING p_val TYPE i.', '  p_val = p_val + p_add.', 'ENDFORM.', 'FORM fill TABLES p_tab STRUCTURE gv_dummy.', '  APPEND 99 TO p_tab.', 'ENDFORM.'].join('\n')],
  ['macros', ['REPORT ZSYLLABUS_TEST.', 'DEFINE out2.', "  WRITE: / &1, &2.", 'END-OF-DEFINITION.', "out2 'macro' 'works'."].join('\n')],
  ['selscr', ['REPORT ZSYLLABUS_TEST.', 'SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE title.', "PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.", 'SELECT-OPTIONS s_con FOR spfli-connid.', 'SELECTION-SCREEN END OF BLOCK b1.', 'INITIALIZATION.', "  s_con-low = '0400'. s_con-high = '0401'. APPEND s_con.", 'START-OF-SELECTION.', '  DATA wa TYPE spfli.', '  SELECT * FROM spfli INTO wa WHERE carrid = p_carr AND connid IN s_con.', '    WRITE: / wa-connid, wa-cityto.', '  ENDSELECT.'].join('\n')],
  ['at-sel-screen', ['REPORT ZSYLLABUS_TEST.', "PARAMETERS p_num TYPE i DEFAULT '5'.", 'AT SELECTION-SCREEN.', '  IF p_num > 100.', "    MESSAGE 'too big' TYPE 'E'.", '  ENDIF.', 'START-OF-SELECTION.', '  WRITE p_num.'].join('\n')],
  ['events', ['REPORT ZSYLLABUS_TEST.', 'TOP-OF-PAGE.', "  WRITE 'PAGE HEADER'.", 'START-OF-SELECTION.', "  WRITE 'body'.", 'END-OF-SELECTION.', "  WRITE 'done'."].join('\n')],
  ['list fmt', ['REPORT ZSYLLABUS_TEST.', 'ULINE.', 'SKIP 1.', 'FORMAT COLOR COL_TOTAL INTENSIFIED ON.', "WRITE: / 'formatted'.", 'FORMAT RESET.', "WRITE / 'hotspot' HOTSPOT ON.", 'NEW-PAGE.', "WRITE / 'page2'."].join('\n')],
  ['hide/ALS', ['REPORT ZSYLLABUS_TEST.', 'DATA wa TYPE scarr.', "SELECT * FROM scarr INTO wa WHERE carrid = 'LH'.", '  WRITE: / wa-carrid HOTSPOT ON, wa-carrname.', '  HIDE: wa-carrid.', 'ENDSELECT.', 'AT LINE-SELECTION.', "  WRITE: / 'detail', wa-carrid."].join('\n')],
  ['lsind', 'REPORT ZSYLLABUS_TEST.\nWRITE sy-lsind.'],
  ['bdc', ['REPORT ZSYLLABUS_TEST.', 'DATA bdc TYPE STANDARD TABLE OF bdcdata.', 'DATA msg TYPE STANDARD TABLE OF bdcmsgcoll.', "CALL TRANSACTION 'SE38' USING bdc MODE 'E' MESSAGES INTO msg.", 'WRITE sy-subrc.'].join('\n')],
  ['do varying', ['REPORT ZSYLLABUS_TEST.', 'DATA: BEGIN OF gs, a TYPE i VALUE 1, b TYPE i VALUE 2, c TYPE i VALUE 3, END OF gs.', 'DATA lv TYPE i.', 'DO VARYING lv FROM gs-a NEXT gs-b.', '  WRITE lv.', '  IF lv >= 3. EXIT. ENDIF.', 'ENDDO.'].join('\n')],
  ['fm call', ['REPORT ZSYLLABUS_TEST.', 'DATA lv_sum TYPE i.', "CALL FUNCTION 'Z_ADD' EXPORTING iv_a = 3 iv_b = 4 IMPORTING ev_sum = lv_sum.", 'WRITE lv_sum.'].join('\n')],
]

for (const [name, src] of cases) {
  const r = runOne(src)
  if (r.status === 'REQUIRES_INPUT') {
    const params: Record<string, string | string[]> = {}
    for (const item of (r as any).selectionScreen) {
      if (item.kind === 'param') params[item.name] = item.defaultValue || ''
      else params[item.name] = [item.defaultValue || '', item.defaultValueHigh || '']
    }
    const r2 = runAbap({ source: src, repid: 'ZSYLLABUS_TEST', db: snapshot(), functionModules: fms(), parameters: params })
    console.log(`\n== ${name}: first=REQUIRES_INPUT(${(r as any).selectionScreen.length} items) second=${r2.status}`)
    if (r2.error) console.log(`   ERR ${r2.error.kind} line=${r2.error.line}: ${r2.error.message}`)
    else console.log(`   LIST: ${JSON.stringify(listText(r2))}`)
  } else if (r.error) {
    console.log(`\n== ${name}: ${r.status}`)
    console.log(`   ERR ${r.error.kind} line=${r.error.line}: ${r.error.message}`)
  } else {
    console.log(`\n== ${name}: ${r.status}`)
    console.log(`   LIST: ${JSON.stringify(listText(r))}`)
    if (r.messages?.length) console.log(`   MSGS: ${JSON.stringify(r.messages)}`)
  }
}
