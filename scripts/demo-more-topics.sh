#!/usr/bin/env bash
# ── Live local demo part 2: remaining main topics ──────────────────────
# TOPIC 06 OOP · TOPIC 07 ALV · TOPIC 09 Modern ABAP 7.40 ·
# TOPIC 11 Selection Screens (interactive) · TOPIC 12 Classical Lists · ST22 dump
set -euo pipefail
cd "$(dirname "$0")/.."

DB_PATH="$(pwd)/prisma/db/api-test-demo2.db"
PORT=3126
BASE="http://localhost:${PORT}"
LOG="$(pwd)/demo2-server.log"
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

api() {
  local m="$1" p="$2" d="${3:-}"
  if [[ -n "$d" ]]; then
    curl -sS -b "$CJ" -X "$m" "$BASE$p" -H "content-type: application/json" -H "origin: $BASE" -d "$d"
  else
    curl -sS -b "$CJ" -X "$m" "$BASE$p" -H "origin: $BASE"
  fi
}

# helper: create + execute; params optional (selection screens)
create_and_run() {
  local name="$1" title="$2" params="${3:-}"
  python3 - "$name" "$title" <<'PY' > /tmp/demo_prog.json
import json, sys
name, title, source = sys.argv[1], sys.argv[2], open('/tmp/demo_src.abap').read()
print(json.dumps({"name": name, "type": "REPORT", "paradigm": "POP", "title": title, "source": source}))
PY
  api POST /api/programs "$(cat /tmp/demo_prog.json)" >/dev/null
  if [[ -n "$params" ]]; then
    python3 - <<PY > /tmp/demo_exec.json
import json
d = json.load(open('/tmp/demo_prog.json'))
d['parameters'] = json.loads('''$params''')
print(json.dumps(d))
PY
  else
    cp /tmp/demo_prog.json /tmp/demo_exec.json
  fi
  api POST /api/execute "$(cat /tmp/demo_exec.json)" > /tmp/demo_exec.json.out
  python3 - <<'PY'
import json
d = json.load(open('/tmp/demo_exec.json.out'))
print('   [status]', d.get('status'))
if d.get('selectionScreen'):
    print('   [selection screen]')
    for item in d['selectionScreen']:
        print('    ·', item.get('label') or item.get('name'), '=', item.get('defaultValue') or '')
err = d.get('error')
if err: print('   [error]', err.get('kind') if isinstance(err, dict) else err, err.get('message') if isinstance(err, dict) else '')
for m in d.get('messages', []):
    print('   [status-bar]', m.get('text') if isinstance(m, dict) else m)
if d.get('alv'):
    a = d['alv']
    print('   [ALV grid]', a.get('title'), '—', a.get('totalRows'), 'rows,', len(a.get('columns', [])), 'columns')
    print('    ', ' | '.join(c.get('label') or c.get('field','') for c in a.get('columns', []))[:100])
    for row in (a.get('rows') or [])[:3]:
        print('    ', ' | '.join(str(row.get(c.get('field',''))) for c in a.get('columns', []))[:100])
for l in (d.get('list') or []):
    if isinstance(l, dict):
        print('   |', ''.join(s.get('text', '') for s in l.get('segments', [])))
    else:
        print('   |', l)
PY
}

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 06 — ABAP Objects (classes, methods, constructor)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_08_oop.

CLASS lcl_car DEFINITION.
  PUBLIC SECTION.
    METHODS: constructor IMPORTING iv_name TYPE string,
             drive    RETURNING VALUE(rv_msg) TYPE string.
    DATA mv_name TYPE string READ-ONLY.
  PROTECTED SECTION.
    DATA: mv_speed TYPE i.
ENDCLASS.

CLASS lcl_car IMPLEMENTATION.
  METHOD constructor.
    mv_name  = iv_name.
    mv_speed = 0.
  ENDMETHOD.
  METHOD drive.
    mv_speed = 60.
    rv_msg = |{ mv_name } drives at { mv_speed } km/h|.
  ENDMETHOD.
ENDCLASS.

DATA(go_car) = NEW lcl_car( iv_name = 'Herbie' ).
WRITE / go_car->drive( ).
DATA(go_second) = NEW lcl_car( iv_name = 'KITT' ).
WRITE / go_second->drive( ).
WRITE: / 'Objects created: 2 — each with its own state'.
ABAP
create_and_run Z_DEMO_08_OOP "ABAP Objects: class, constructor, methods"

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 07 — ALV Grid (REUSE_ALV_GRID_DISPLAY over real SFLIGHT)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_09_alv.

DATA gt_flights TYPE STANDARD TABLE OF sflight.

SELECT * FROM sflight INTO TABLE gt_flights UP TO 5 ROWS.

CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    i_structure_name = 'SFLIGHT'
    i_grid_title     = 'Flight overview — classic ALV'
  TABLES
    t_outtab         = gt_flights.
ABAP
create_and_run Z_DEMO_09_ALV "ALV grid from real SFLIGHT data"

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 09 — Modern ABAP 7.40 (inline, VALUE, COND, REDUCE, FOR)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_10_modern.

TYPES: BEGIN OF ty_emp,
         name   TYPE string,
         salary TYPE p DECIMALS 2,
       END OF ty_emp.
TYPES tt_emp TYPE STANDARD TABLE OF ty_emp WITH EMPTY KEY.
TYPES int4_table TYPE STANDARD TABLE OF i WITH EMPTY KEY.

DATA(lv_hour) = 9.
DATA(lv_greeting) = COND string( WHEN lv_hour < 12 THEN 'Good morning' ELSE 'Good afternoon' ).
WRITE / lv_greeting.

DATA(lt_emp) = VALUE tt_emp(
  ( name = 'ARJUN'  salary = '50000.00' )
  ( name = 'MEERA'  salary = '42000.00' )
  ( name = 'VIKRAM' salary = '38000.00' )
).
DATA(lv_total) = REDUCE p DECIMALS 2(
  INIT sum = 0
  FOR ls IN lt_emp
  NEXT sum = sum + ls-salary ).
WRITE: / 'Payroll total:', lv_total.

DATA(lt_nums) = VALUE int4_table( FOR i = 1 THEN i + 2 WHILE i <= 7 ( i ) ).
LOOP AT lt_nums INTO DATA(n).
  WRITE: / 'odd number:', n.
ENDLOOP.

WRITE: / |String template: first employee is { lt_emp[ 1 ]-name }|.
ABAP
create_and_run Z_DEMO_10_MODERN "Modern ABAP 7.40 syntax"

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 11 — Selection Screens (interactive: screen → input → run)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_11_selection.

PARAMETERS p_carr TYPE spfli-carrid DEFAULT 'LH' OBLIGATORY.
SELECT-OPTIONS s_con FOR spfli-connid.

START-OF-SELECTION.
  DATA wa TYPE spfli.
  SELECT * FROM spfli INTO wa
    WHERE carrid = p_carr AND connid IN s_con.
    WRITE: / wa-carrid, wa-connid, wa-cityfrom, '->', wa-cityto.
  ENDSELECT.
ABAP
create_and_run Z_DEMO_11_SELECTION "Selection screen" '{"P_CARR":"LH","S_CON":["0400","0402"]}'

echo
echo "════════════════════════════════════════════════════════════"
echo " TOPIC 12 — Classical list events (TOP-OF-PAGE / END-OF-SELECTION)"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_12_list LINE-COUNT 10.

DATA wa TYPE scarr.

TOP-OF-PAGE.
  WRITE: / 'AIRLINE CATALOG — page', sy-pagno.
  ULINE.

START-OF-SELECTION.
  SELECT * FROM scarr INTO wa.
    WRITE: / wa-carrid, wa-carrname.
  ENDSELECT.

END-OF-SELECTION.
  ULINE.
  WRITE: / 'End of report'.
ABAP
create_and_run Z_DEMO_12_LIST "Classical list with events"

echo
echo "════════════════════════════════════════════════════════════"
echo " ST22 — a runtime error becomes a short dump"
echo "════════════════════════════════════════════════════════════"
cat > /tmp/demo_src.abap <<'ABAP'
REPORT z_demo_13_dump.

DATA lv_x TYPE i.
lv_x = 100 / 0.
WRITE / 'never reached'.
ABAP
create_and_run Z_DEMO_13_DUMP "Division by zero → CX_SY_ZERODIVIDE"

echo
echo "DEMO PART 2 COMPLETE"
