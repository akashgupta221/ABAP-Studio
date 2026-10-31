#!/usr/bin/env bash
# End-to-end proof of the create → use → run → execute cycle through the REAL API.
# Creates a disposable database + owner, starts the app, mints a test session,
# then drives: SE11 create → SM30 entries → SE91 message class → SNRO number range
# → CG3Z upload → SE38 program → execute → SE93 transaction.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_PATH="$(pwd)/prisma/db/api-test-e2e-cycle.db"
PORT=3123
BASE="http://localhost:${PORT}"
LOG="$(pwd)/e2e-cycle-server.log"
SECRET=$(grep -E '^E2E_SECRET=' tests/run-api-tests.sh | head -1 | cut -d= -f2 | tr -d '"')
COOKIE_JAR="$(mktemp -t abap-e2e-cookie.XXXXXX)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_PATH" "$DB_PATH-journal" "$COOKIE_JAR" "$LOG"
}
trap cleanup EXIT

rm -f "$DB_PATH" "$DB_PATH-journal"
echo "── 1. disposable database ──"
DATABASE_URL="file:${DB_PATH}" "$HOME/.bun/bin/bunx" prisma db push --skip-generate --accept-data-loss >/dev/null
DATABASE_URL="file:${DB_PATH}" "$HOME/.bun/bin/bun" tests/provision-test-db.ts >/dev/null

echo "── 2. starting app on ${PORT} ──"
DATABASE_URL="file:${DB_PATH}" \
TURSO_DATABASE_URL="" \
OWNER_USERNAME="TESTOWNER" \
OWNER_EMAIL="" \
E2E_TEST_MODE="1" \
E2E_TEST_SECRET="${SECRET}" \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="" \
CLERK_SECRET_KEY="" \
NODE_ENV="development" \
"$HOME/.bun/bin/bunx" next dev -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 90); do
  if curl -sf "$BASE/api/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "server exited early"; tail -40 "$LOG"; exit 1
  fi
  sleep 1
done
curl -sf "$BASE/api/health" >/dev/null || { echo "server not ready"; tail -40 "$LOG"; exit 1; }

echo "── 3. owner session ──"
curl -sf -c "$COOKIE_JAR" -X POST "$BASE/api/test/session" \
  -H "content-type: application/json" -H "x-e2e-secret: ${SECRET}" \
  -d '{"username":"TESTOWNER"}' >/dev/null

api() { # api METHOD PATH [JSON]
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS -b "$COOKIE_JAR" -X "$method" "$BASE$path" \
      -H "content-type: application/json" -H "origin: $BASE" -d "$data"
  else
    curl -sS -b "$COOKIE_JAR" -X "$method" "$BASE$path" -H "origin: $BASE"
  fi
}

step() { echo; echo "── $1 ──"; }

step "4. SE11 CREATE TABLE ZQAIRLINE"
api POST /api/tables '{
  "name": "ZQAIRLINE",
  "description": "QA end-to-end airline table",
  "fields": [
    {"name":"CARRID","type":"CHAR","length":3,"key":true,"text":"Airline"},
    {"name":"CARRNAME","type":"CHAR","length":30,"text":"Name"},
    {"name":"PRICE","type":"DEC","length":10,"decimals":2,"text":"Price"}
  ]
}'
echo

step "5. SM30 MAINTAIN ENTRIES"
api POST /api/tables/ZQAIRLINE/rows '{"data":{"CARRID":"QA1","CARRNAME":"QA Air One","PRICE":"120.50"}}' >/dev/null
api POST /api/tables/ZQAIRLINE/rows '{"data":{"CARRID":"QA2","CARRNAME":"QA Air Two","PRICE":"89.00"}}' >/dev/null
api GET /api/tables/ZQAIRLINE/rows
echo

step "6. SE91 MESSAGE CLASS ZMSG_QA"
api POST /api/messages '{"name":"ZMSG_QA","description":"QA messages","messages":[{"number":"001","text":"Airline &1: &2 entries ready"}]}'
echo
api GET /api/messages | head -c 400
echo

step "7. SNRO NUMBER RANGE ZQA_ORDER (1..100)"
api POST /api/number-ranges '{"object":"ZQA_ORDER","shortText":"QA order numbers","fromNumber":1,"toNumber":100}'
echo

step "8. CG3Z UPLOAD /tmp/qa/demo.txt"
api POST /api/appserver/files '{"path":"/tmp/qa/demo.txt","content":"QA-HEADER-42\nsecond line\n"}'
echo

step "9. SE38 CREATE PROGRAM ZQA_EXEC (uses everything)"
python3 - <<'PY' > /tmp/qa_program.json
import json
source = """REPORT ZQA_EXEC.

DATA wa TYPE zqairline.
DATA lines TYPE i.
DATA rn TYPE n LENGTH 10.
DATA file_line TYPE string.

SELECT * FROM zqairline INTO TABLE DATA(it).
DESCRIBE TABLE it LINES lines.

MESSAGE s001(ZMSG_QA) WITH 'ZQAIRLINE' lines.

CALL FUNCTION 'NUMBER_GET_NEXT'
  EXPORTING
    object      = 'ZQA_ORDER'
    nr_range_nr = '01'
  IMPORTING
    number      = rn.
WRITE: / 'Order number:', rn.

OPEN DATASET '/tmp/qa/demo.txt' FOR INPUT IN TEXT MODE ENCODING DEFAULT.
IF sy-subrc = 0.
  READ DATASET '/tmp/qa/demo.txt' INTO file_line.
  WRITE: / 'File says:', file_line.
  CLOSE DATASET '/tmp/qa/demo.txt'.
ENDIF.

LOOP AT it INTO wa.
  WRITE: / wa-carrid, wa-carrname, wa-price.
ENDLOOP.
"""
print(json.dumps({
  "name": "ZQA_EXEC",
  "type": "REPORT",
  "paradigm": "POP",
  "title": "QA end-to-end program",
  "description": "Runs against the QA table, message class, number range and file",
  "source": source,
}))
PY
api POST /api/programs "$(cat /tmp/qa_program.json)" | head -c 300
echo

step "10. EXECUTE ZQA_EXEC"
python3 - <<'PY' > /tmp/qa_exec_body.json
import json
source = open('/tmp/qa_program.json')
src = json.load(source)['source']
print(json.dumps({"name": "ZQA_EXEC", "source": src}))
PY
api POST /api/execute "$(cat /tmp/qa_exec_body.json)" > /tmp/qa_exec_out.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/qa_exec_out.json'))
print('status:', d.get('status'))
if d.get('error'):
    print('ERROR:', d['error'].get('kind'), 'line', d['error'].get('line'), '-', d['error'].get('message'))
for line in d.get('list', []):
    print('  |', ''.join(seg.get('text','') for seg in line.get('segments', [])))
print('messages:', [m.get('text') for m in d.get('messages', [])])
PY

step "11. SE93 REGISTER ZQA_RUN -> ZQA_EXEC"
api POST /api/transactions '{"code":"ZQA_RUN","program":"ZQA_EXEC","description":"QA report transaction"}'
echo
api GET /api/transactions
echo

step "12. PERSISTENCE CHECK — table entries after the run"
api GET /api/tables/ZQAIRLINE/rows
echo


step "13. SM36/SM37 BACKGROUND JOB (delay 0 → runs on monitor open)"
api PUT /api/jobs '{"name":"ZQA_NIGHTLY","report":"ZQA_EXEC","delaySeconds":0}' >/dev/null
sleep 1
api GET /api/jobs | python3 -c "import json,sys; d=json.load(sys.stdin); [print(j['name'], j['status'], j['resultStatus'], 'log lines:', j['lines']) for j in d['jobs']]"

step "14. SLG1 / SM21 LOGS (written by the run)"
api POST /api/system-log '{}' >/dev/null
api GET /api/system-log | python3 -c "import json,sys; d=json.load(sys.stdin); [print(e['type'], '|', e['text'][:60]) for e in d['entries'][:3]]"
api GET /api/logs | head -c 200; echo ' (application logs: empty unless BAL_* used)'

step "15. SCI/SLIN INSPECTOR over ZQA_EXEC"
api GET "/api/inspector?name=ZQA_EXEC" | python3 -c "import json,sys; d=json.load(sys.stdin); print('metrics:', d['metrics']); [print(i['kind'], i['check'], '-', i['message'][:70]) for i in d['issues'][:6]]"

step "16. SQ02 INFOSET + SQ01 QUERY (generated ABAP, executed)"
api POST /api/query '{"kind":"infoset","name":"ZQA_FLIGHT","baseTable":"SPFLI","description":"QA flights"}' >/dev/null
api POST /api/query '{"kind":"query","name":"ZQA_FLIGHT_LIST","infoset":"ZQA_FLIGHT","fields":["CARRID","CITYFROM","CITYTO"]}' >/dev/null
api GET "/api/query?action=run&name=ZQA_FLIGHT_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print('status:', d['status']); print('\n'.join(d['list'][:4]))"

step "17. SE09/SE10 TRANSPORT + STMS IMPORT"
api POST /api/transports '{"action":"create","type":"WORKBENCH","description":"QA transport"}' > /tmp/qa_req.json
REQ=$(python3 -c "import json;print(json.load(open('/tmp/qa_req.json'))['reqId'])")
api POST /api/transports '{"action":"add","reqId":"'"$REQ"'","objectType":"PROG","objectName":"ZQA_EXEC"}' >/dev/null
api POST /api/transports '{"action":"release","reqId":"'"$REQ"'"}' >/dev/null
api POST /api/transports '{"action":"import","reqId":"'"$REQ"'"}' >/dev/null
api GET "/api/transports?queue=released" | python3 -c "import json,sys; d=json.load(sys.stdin); [print('released queue:', r['reqId']) for r in d['queue']]"
api GET /api/transports | python3 -c "import json,sys; d=json.load(sys.stdin); [print(r['reqId'], r['status']) for r in d['requests']]"

step "18. SM50 WORK PROCESSES"
api GET "/api/executions?limit=5" | python3 -c "import json,sys; d=json.load(sys.stdin); [print('WP DIALOG |', e['programName'], '|', e['status'], '|', e['durationMs'], 'ms') for e in d['executions'][:5]]"

echo
echo "E2E CYCLE COMPLETE"
