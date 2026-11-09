#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# NEXORA — local database test runner
#
# Spins up a throw-away PostgreSQL database, installs a minimal Supabase stub
# (auth.users, auth.uid(), anon/authenticated roles), applies every migration,
# then runs the RLS + business-logic test suite.
#
# Requires PostgreSQL 14+ with `psql` available. It works whether you connect
# as your own user or via `sudo -u postgres` (files are staged into a
# world-readable temp dir in that case).
#
#   bash supabase/tests/run.sh
# ---------------------------------------------------------------------------
set -euo pipefail

DB="${NEXORA_TEST_DB:-nexora_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

if psql -q -d postgres -c 'select 1' >/dev/null 2>&1; then
  PSQL=(psql)
else
  PSQL=(sudo -n -u postgres psql)
fi
SUDO_PG=$([[ "${PSQL[0]}" == "sudo" ]] && echo 1 || echo 0)

STAGE="$(mktemp -d /tmp/nexora-sql-XXXXXX)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

stage() { cp "$1" "$STAGE/$(basename "$1")"; echo "$STAGE/$(basename "$1")"; }
chmod 755 "$STAGE"
[[ $SUDO_PG == 1 ]] && chmod -R a+r "$STAGE"

echo "▸ Recreating database $DB"
"${PSQL[@]}" -q -d postgres -c "drop database if exists $DB;" >/dev/null 2>&1 || true
"${PSQL[@]}" -q -d postgres -c "create database $DB;"

run() { "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -d "$DB" -f "$(stage "$1")"; }

echo "▸ Installing Supabase stub (local test harness only)"
run "$HERE/supabase_stub.sql" >/dev/null
"${PSQL[@]}" -q -d "$DB" -c "grant all on schema public to anon, authenticated, service_role;" >/dev/null 2>&1 || true

echo "▸ Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '   %-50s' "$(basename "$f")"
  if run "$f" > /tmp/nexora-mig.log 2>&1; then echo "OK"; else echo "FAILED"; cat /tmp/nexora-mig.log; exit 1; fi
done

echo "▸ Running RLS + business-logic tests"
set +e
"${PSQL[@]}" -v ON_ERROR_STOP=1 -d "$DB" -f "$(stage "$HERE/rls_test.sql")" > /tmp/nexora-tests.log 2>&1
STATUS=$?
set -e
grep -E 'PASS|ASSERT FAILED|ERROR|ALL TESTS PASSED' /tmp/nexora-tests.log || true

if [[ $STATUS -ne 0 ]]; then
  echo "✗ TEST SUITE FAILED (exit $STATUS) — full log: /tmp/nexora-tests.log"
  exit $STATUS
fi

COUNT=$("${PSQL[@]}" -t -d "$DB" -c "select count(*) from public.products;" | tr -d ' ')
PASSED=$(grep -c 'PASS' /tmp/nexora-tests.log || true)
echo "▸ Catalogue seeded: $COUNT products"
echo "✓ All $PASSED assertions passed"
