#!/usr/bin/env bash
# ── Live local demo: main topics, taught with real programs ────────────
# Starts the app on a disposable database, creates one demo program per main
# topic (SE38), executes it (F8), and prints the actual list output.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_PATH="$(pwd)/prisma/db/api-test-demo.db"
PORT=3125
BASE="http://localhost:${PORT}"
LOG="$(pwd)/demo-server.log"
SECRET="$(grep -E '^E2E_SECRET=' tests/run-api-tests.sh | head -1 | cut -d= -f2 | tr -d '"')"
COOKIE_JAR="$(mktemp)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_PATH" "$DB_PATH-journal" "$COOKIE_JAR" "$LOG"
}
trap cleanup EXIT

rm -f "$DB_PATH" "$DB_PATH-journal"
DATABASE_URL="file:${DB_PATH}" "$HOME/.bun/bin/bunx" prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1
DATABASE_URL="file:${DB_PATH}" "$HOME/.bun/bin/bun" tests/provision-test-db.ts >/dev/null

DATABASE_URL="file:${DB_PATH}" \
TURSO_DATABASE_URL="" OWNER_USERNAME="TESTOWNER" OWNER_EMAIL="" \
E2E_TEST_MODE="1" E2E_TEST_SECRET="${SECRET}" \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="" CLERK_SECRET_KEY="" \
NODE_ENV="development" "$HOME/.bun/bin/bunx" next dev -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 90); do curl -sf "$BASE/api/health" >/dev/null 2>&1 && break; sleep 1; done
curl -sf "$BASE/api/health" >/dev/null

CJ="$COOKIE_JAR"
curl -sf -c "$CJ" -X POST "$BASE/api/test/session" -H "content-type: application/json" -H "x-e2e-secret: ${SECRET}" -d '{"username":"TESTOWNER"}' >/dev/null

api() { # METHOD PATH [JSON]
  local m="$1" p="$2" d="${3:-}"
  if [[ -n "$d" ]]; then
    curl -sS -b "$CJ" -X "$m" "$BASE$p" -H "content-type: application/json" -H "origin: $BASE" -d "$d"
  else
    curl -sS -b "$CJ" -X "$m" "$BASE$p" -H "origin: $BASE"
  fi
}

# workbench objects the workbench demo will use (SE11 / SE91 / SNRO / CG3Z)
api POST /api/tables '{"name":"ZQAIRLINE","description":"Demo airline table","fields":[{"name":"CARRID","type":"CHAR","length":3,"key":true,"text":"Airline"},{"name":"CARRNAME","type":"CHAR","length":30,"text":"Name"},{"name":"PRICE","type":"DEC","length":10,"decimals":2,"text":"Price"}]}' >/dev/null
api POST /api/tables/ZQAIRLINE/rows '{"data":{"CARRID":"QA1","CARRNAME":"QA Air One","PRICE":"120.50"}}' >/dev/null
api POST /api/tables/ZQAIRLINE/rows '{"data":{"CARRID":"QA2","CARRNAME":"QA Air Two","PRICE":"89.00"}}' >/dev/null
api POST /api/messages '{"name":"ZMSG_DEMO","description":"Demo messages","messages":[{"number":"001","text":"Table &1 holds &2 entries"}]}' >/dev/null
api POST /api/number-ranges '{"object":"ZDEMO_ORDER","shortText":"Demo orders","fromNumber":1,"toNumber":500}' >/dev/null
api POST /api/appserver/files '{"path":"/tmp/demo/notes.txt","content":"ABAP-Studio demo file\nline two"}' >/dev/null

# program factory: NAME then heredoc body via stdin
create_and_run() {
  local name="$1" title="$2"
  python3 - "$name" "$title" <<'PY' > /tmp/demo_prog.json
import json, sys
name, title, source = sys.argv[1], sys.argv[2], open('/tmp/demo_src.abap').read()
print(json.dumps({"name": name, "type": "REPORT", "paradigm": "POP", "title": title, "source": source}))
PY
  api POST /api/programs "$(cat /tmp/demo_prog.json)" >/dev/null
  api POST /api/execute "$(cat /tmp/demo_prog.json)" > /tmp/demo_exec.json
  python3 - <<'PY'
import json
d = json.load(open('/tmp/demo_exec.json'))
print('   [status]', d.get('status'))
err = d.get('error')
if err: print('   [error]', err.get('kind') if isinstance(err, dict) else err, err.get('message') if isinstance(err, dict) else '')
for m in d.get('messages', []):
    print('   [status-bar]', m.get('text') if isinstance(m, dict) else m)
for l in (d.get('list') or []):
    if isinstance(l, dict):
        print('   |', ''.join(s.get('text', '') for s in l.get('segments', [])))
    else:
        print('   |', l)
PY
}

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 01/02 — Foundations & Data Types"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_01_basics.

* ── declarations: character, integer, packed, date ──
DATA: gv_name  TYPE c LENGTH 20 VALUE 'AKASH',
      gv_count TYPE i VALUE 42,
      gv_price TYPE p DECIMALS 2 VALUE '199.99',
      gv_text  TYPE string.

CONCATENATE 'Welcome' gv_name 'to ABAP-Studio' INTO gv_text SEPARATED BY space.

WRITE: / gv_text.
WRITE: / 'Count:', gv_count, '| Price:', gv_price.
WRITE: / 'Today:', sy-datum, '| Time:', sy-uzeit.
WRITE: / 'User:', sy-uname, '| Client:', sy-mandt, '| System:', sy-sysid.
ABAP
create_and_run Z_DEMO_01_BASICS "Basics: data types, structures, system fields"
echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 03 — Control Structures"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_02_control.

* ── DO loop with IF branch ──
DO 4 TIMES.
  IF sy-index MOD 2 = 0.
    WRITE: / 'Iteration', sy-index, '-> even'.
  ELSE.
    WRITE: / 'Iteration', sy-index, '-> odd'.
  ENDIF.
ENDDO.

* ── CASE ──
DATA(lv_grade) = 'B'.
CASE lv_grade.
  WHEN 'A'. WRITE / 'Grade A: excellent'.
  WHEN 'B'. WRITE / 'Grade B: good'.
  WHEN OTHERS. WRITE / 'Other grade'.
ENDCASE.

* ── WHILE ──
DATA lv_n TYPE i VALUE 1.
WHILE lv_n <= 3.
  WRITE: / 'while pass', lv_n.
  lv_n = lv_n + 1.
ENDWHILE.
ABAP
create_and_run Z_DEMO_02_CONTROL "Control structures: IF / CASE / DO"
echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 04 — Modularization (FORM + real Function Module)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_03_modular.

DATA: gv_sum    TYPE i,
      lv_price  TYPE sflight-price,
      lv_type   TYPE sflight-planetype.

* ── subroutine ──
PERFORM add USING 7 35 CHANGING gv_sum.
WRITE: / 'FORM result: 7 + 35 =', gv_sum.

* ── function module from the repository (SE37), reading real SFLIGHT data ──
CALL FUNCTION 'Z_GET_FLIGHT_DETAILS'
  EXPORTING
    iv_carrid = 'LH'
    iv_connid = '0400'
  IMPORTING
    ev_flight = DATA(ls_flight).

lv_price = ls_flight-price.
lv_type  = ls_flight-planetype.
WRITE: / 'FM result: flight LH0400 costs', lv_price, 'on plane', lv_type.

FORM add USING p_a TYPE i p_b TYPE i CHANGING p_sum TYPE i.
  p_sum = p_a + p_b.
ENDFORM.
ABAP
create_and_run Z_DEMO_03_MODULAR "Modularization: FORM/PERFORM and CALL FUNCTION"
echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 05 — Internal Tables & Control Breaks"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_04_itab.

TYPES: BEGIN OF ty_sales,
         region TYPE c LENGTH 10,
         amount TYPE p DECIMALS 2,
       END OF ty_sales.
DATA it   TYPE STANDARD TABLE OF ty_sales WITH DEFAULT KEY.
DATA wa   TYPE ty_sales.

APPEND VALUE #( region = 'EAST' amount = '1200.00' ) TO it.
APPEND VALUE #( region = 'WEST' amount = '800.50' ) TO it.
APPEND VALUE #( region = 'EAST' amount = '450.25' ) TO it.
APPEND VALUE #( region = 'WEST' amount = '300.00' ) TO it.

SORT it BY region amount DESCENDING.

LOOP AT it INTO wa.
  AT NEW region.
    WRITE: / 'Region:', wa-region.
  ENDAT.
  WRITE: / '   sale:', wa-amount.
  AT END OF region.
    SUM.
    WRITE: / '   subtotal:', wa-amount.
  ENDAT.
ENDLOOP.
ABAP
create_and_run Z_DEMO_04_ITAB "Internal tables: APPEND, SORT, AT NEW/END OF, SUM"
echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 14 — Open SQL over the real flight model"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_05_opensql.

DATA: lv_name TYPE scarr-carrname,
      wa      TYPE spfli,
      lv_cnt  TYPE i,
      lv_seats TYPE i.

SELECT SINGLE carrname FROM scarr INTO lv_name WHERE carrid = 'LH'.
WRITE: / 'Airline:', lv_name.

SELECT p~connid p~cityfrom p~cityto
  INTO (wa-connid, wa-cityfrom, wa-cityto)
  FROM spfli AS p INNER JOIN scarr AS s ON s~carrid = p~carrid
  WHERE p~carrid = 'LH'
  ORDER BY p~connid.
  WRITE: / '  flight', wa-connid, ':', wa-cityfrom, '->', wa-cityto.
ENDSELECT.

SELECT COUNT(*) SUM( seatsmax ) INTO (lv_cnt, lv_seats) FROM sflight.
WRITE: / 'Fleet:', lv_cnt, 'flights,', lv_seats, 'seats in total'.
ABAP
create_and_run Z_DEMO_05_OPENSQL "Open SQL: SELECT SINGLE, JOIN, aggregates"
echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 15 — Changing data (INSERT / UPDATE / DELETE + LUW)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_06_dbchange.

DATA wa TYPE scarr.

wa-carrid = 'ZQ'. wa-carrname = 'QA Demo Air'. wa-currcode = 'EUR'.
INSERT scarr FROM wa.
WRITE: / 'INSERT sy-subrc =', sy-subrc.

UPDATE scarr SET currcode = 'USD' WHERE carrid = 'ZQ'.

SELECT SINGLE carrname FROM scarr INTO wa-carrname WHERE carrid = 'ZQ'.
SELECT SINGLE currcode FROM scarr INTO wa-currcode WHERE carrid = 'ZQ'.
WRITE: / 'After UPDATE:', wa-carrname, 'flies in', wa-currcode.

DELETE FROM scarr WHERE carrid = 'ZQ'.
COMMIT WORK.
WRITE: / 'Cleaned up — dictionary back to its original state (per-run snapshot)'.
ABAP
create_and_run Z_DEMO_06_DBCHANGE "INSERT, UPDATE, SELECT, DELETE with the SAP LUW"
echo
echo "════════════════════════════════════════════════════════════"
echo " WORKBENCH TOGETHER — SE11 table + SE91 message + SNRO + AL11"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_07_workbench.

* uses objects maintained in the transactions:
*   SE11 table ZQAIRLINE · SE91 class ZMSG_DEMO · SNRO ZDEMO_ORDER · AL11 file
DATA: wa   TYPE zqairline,
      rn   TYPE n LENGTH 10,
      line TYPE string.

SELECT * FROM zqairline INTO TABLE DATA(it).
WRITE: / 'ZQAIRLINE entries:', lines( it ).
LOOP AT it INTO wa.
  WRITE: / '  ', wa-carrid, wa-carrname, wa-price.
ENDLOOP.

CALL FUNCTION 'NUMBER_GET_NEXT'
  EXPORTING
    object      = 'ZDEMO_ORDER'
    nr_range_nr = '01'
  IMPORTING
    number      = rn.
WRITE: / 'Next order number:', rn.

OPEN DATASET '/tmp/demo/notes.txt' FOR INPUT IN TEXT MODE ENCODING DEFAULT.
READ DATASET '/tmp/demo/notes.txt' INTO line.
CLOSE DATASET '/tmp/demo/notes.txt'.
WRITE: / 'AL11 file line:', line.

MESSAGE s001(ZMSG_DEMO) WITH 'ZQAIRLINE' lines( it ).
ABAP
create_and_run Z_DEMO_07_WORKBENCH "All workbench objects working together"
echo
echo "DEMO COMPLETE — programs Z_DEMO_01..07 are saved in the repository (SE38)."
