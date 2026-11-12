#!/usr/bin/env bash
# Exporteert het schema van een gemigreerde testdatabase en controleert het databasecontract van de app.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="bf_contract_$$"
if [[ -z "${PGUSER:-}" ]] && id postgres >/dev/null 2>&1 && [[ "$(id -u)" == "0" ]]; then RUN=(runuser -u postgres --); else RUN=(); fi
cleanup() { "${RUN[@]}" dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${RUN[@]}" createdb "$DB"
for f in supabase/tests/00_supabase_stub.sql supabase/migrations/*.sql; do "${RUN[@]}" psql -v ON_ERROR_STOP=1 -q -X -o /dev/null -d "$DB" -f "$f" 2>/dev/null; done
SCHEMA=$(mktemp)
"${RUN[@]}" psql -X -t -A -d "$DB" -c "select json_build_object(
  'tables', (select json_object_agg(table_name, cols) from (select table_name, json_agg(column_name) cols from information_schema.columns where table_schema='public' group by table_name) t),
  'functions', (select json_agg(json_build_object('name', p.proname, 'args', coalesce(p.proargnames, '{}'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'))" > "$SCHEMA"
python3 scripts/check-db-contract.py "$SCHEMA"
