#!/usr/bin/env bash
# Disposable UI-test server: fresh SQLite schema, test owner, no Clerk keys.
# Never uses production credentials or the production database.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_PATH="$(pwd)/prisma/db/ui-api-test.db"
PORT=3101
BASE="http://localhost:${PORT}"
LOG="$(mktemp -t abap-ui-test.XXXXXX.log)"
E2E_SECRET="${E2E_TEST_SECRET:-ui-test-only-secret-0123456789abcdef}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$DB_PATH" "$DB_PATH-journal" "$LOG"
}
trap cleanup EXIT INT TERM

rm -f "$DB_PATH" "$DB_PATH-journal"
echo "── Preparing disposable UI database ──"
DATABASE_URL="file:${DB_PATH}" bunx prisma db push --skip-generate --accept-data-loss >/dev/null
DATABASE_URL="file:${DB_PATH}" bun tests/provision-test-db.ts

echo "── Starting UI test server on ${PORT} ──"
DATABASE_URL="file:${DB_PATH}" \
TURSO_DATABASE_URL="" \
OWNER_USERNAME="TESTOWNER" \
OWNER_EMAIL="" \
E2E_TEST_MODE="1" \
E2E_TEST_SECRET="$E2E_SECRET" \
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="" \
CLERK_SECRET_KEY="" \
NODE_ENV="development" \
bunx next dev -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 90); do
  if curl -sf "$BASE/api/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "UI test server exited before becoming ready:"
    tail -60 "$LOG"
    exit 1
  fi
  sleep 1
done

if ! curl -sf "$BASE/api/health" >/dev/null 2>&1; then
  echo "UI test server did not become ready:"
  tail -60 "$LOG"
  exit 1
fi

wait "$SERVER_PID"
