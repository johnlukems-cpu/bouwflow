#!/usr/bin/env bash
# Test de database-migraties en Row Level Security tegen een tijdelijke,
# lokale PostgreSQL-database. Vereist psql en een draaiende PostgreSQL-server.
#   PGHOST/PGUSER/PGPASSWORD/PGPORT kunnen via de omgeving worden ingesteld.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="bouwflow_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X -t -o /dev/null)
if [[ -z "${PGUSER:-}" ]] && id postgres >/dev/null 2>&1 && [[ "$(id -u)" == "0" ]]; then
  RUN=(runuser -u postgres --)
else
  RUN=()
fi

cleanup() { "${RUN[@]}" dropdb --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${RUN[@]}" createdb "$DB"
"${RUN[@]}" "${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "→ migratie $(basename "$f")"
  "${RUN[@]}" "${PSQL[@]}" -d "$DB" -f "$f"
done
for f in supabase/tests/[1-9]*.sql; do
  echo "→ test $(basename "$f")"
  "${RUN[@]}" "${PSQL[@]}" -d "$DB" -f "$f"
done
echo "✓ Alle databasetests geslaagd"
