#!/usr/bin/env bash
# Disposable end-to-end API suite: fresh schema, test owner, isolated server.
# Never uses production credentials or the production database.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_PATH="$(pwd)/prisma/db/api-test.db"
PORT=3100
BASE="http://localhost:${PORT}"
LOG="$(mktemp -t abap-api-test.XXXXXX.log)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_PATH" "$DB_PATH-journal"
}
trap cleanup EXIT

rm -f "$DB_PATH" "$DB_PATH-journal"
echo "── Preparing disposable database ──"
DATABASE_URL="file:${DB_PATH}" bunx prisma db push --skip-generate --accept-data-loss >/dev/null
DATABASE_URL="file:${DB_PATH}" bun tests/provision-test-db.ts

echo "── Starting test server on ${PORT} ──"
DATABASE_URL="file:${DB_PATH}" \
TURSO_DATABASE_URL="" \
OWNER_USERNAME="TESTOWNER" \
AUTH_SECRET="api-test-secret-not-for-production" \
NODE_ENV="development" \
bunx next dev -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 90); do
  if curl -sf "$BASE/api/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited before becoming ready:"
    tail -50 "$LOG"
    exit 1
  fi
  sleep 1
done

if ! curl -sf "$BASE/api/health" >/dev/null 2>&1; then
  echo "Server did not become ready:"
  tail -50 "$LOG"
  exit 1
fi

set +e
BASE_URL="$BASE" bun tests/api-security.ts
STATUS=$?
set -e

if [[ $STATUS -ne 0 ]]; then
  echo "── Server log tail ──"
  tail -80 "$LOG"
fi
exit $STATUS
