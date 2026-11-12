#!/usr/bin/env bash
# Test back-up en herstel: bouwt een testdatabase met migraties en testgegevens,
# maakt een pg_dump, herstelt die in een lege database en vergelijkt de inhoud.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="bf_backup_src_$$"; DST="bf_backup_dst_$$"; DUMP="$(mktemp -d)/bouwflow.dump"
if [[ -z "${PGUSER:-}" ]] && id postgres >/dev/null 2>&1 && [[ "$(id -u)" == "0" ]]; then RUN=(runuser -u postgres --); chmod 777 "$(dirname "$DUMP")"; else RUN=(); fi
PSQL=(psql -v ON_ERROR_STOP=1 -q -X -t -o /dev/null)
cleanup() { "${RUN[@]}" dropdb --if-exists "$SRC" >/dev/null 2>&1 || true; "${RUN[@]}" dropdb --if-exists "$DST" >/dev/null 2>&1 || true; rm -rf "$(dirname "$DUMP")"; }
trap cleanup EXIT

"${RUN[@]}" createdb "$SRC"
"${RUN[@]}" "${PSQL[@]}" -d "$SRC" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql supabase/tests/[1-9]*.sql; do "${RUN[@]}" "${PSQL[@]}" -d "$SRC" -f "$f" 2>/dev/null; done

"${RUN[@]}" pg_dump -d "$SRC" --format=custom --no-owner --schema=public --file="$DUMP"

# Herstel: platformschema's (auth/storage) bestaan in Supabase al; hier via de stub.
"${RUN[@]}" createdb "$DST"
"${RUN[@]}" "${PSQL[@]}" -d "$DST" -f supabase/tests/00_supabase_stub.sql
"${RUN[@]}" psql -q -X -d "$SRC" -t -A -c "copy (select * from auth.users) to stdout" | "${RUN[@]}" psql -q -X -d "$DST" -c "copy auth.users from stdin"
"${RUN[@]}" pg_restore -d "$DST" --no-owner --schema=public --exit-on-error "$DUMP" 2>/dev/null || "${RUN[@]}" pg_restore -d "$DST" --no-owner --schema=public "$DUMP"

Q="select string_agg(t || '=' || n, ',' order by t) from (
  select 'customers' t, count(*) n from public.customers union all select 'projects', count(*) from public.projects
  union all select 'invoices', count(*) from public.invoices union all select 'payments', count(*) from public.payments
  union all select 'cost_entries', count(*) from public.project_cost_entries union all select 'stock', count(*) from public.stock_movements
  union all select 'audit', count(*) from public.audit_log union all select 'quotes', count(*) from public.quotes) x;
  select sum(actual_cost_total)::text || '|' || sum(invoiced_excl_tax)::text from public.project_financials;
  select count(*) from public.number_sequences;"
A=$("${RUN[@]}" psql -X -t -A -d "$SRC" -c "$Q")
B=$("${RUN[@]}" psql -X -t -A -d "$DST" -c "$Q")
echo "Bron:    $(echo $A)"
echo "Hersteld: $(echo $B)"
[[ "$A" == "$B" ]] || { echo "✗ Herstelde database wijkt af"; exit 1; }
# Na herstel moeten triggers/RLS nog werken: nummering loopt door
NEXT=$("${RUN[@]}" psql -q -X -t -A -d "$DST" -c "insert into public.customers (organization_id, name) select id, 'Na herstel' from public.organizations order by created_at limit 1 returning customer_number")
echo "Nieuw klantnummer na herstel: $NEXT"
[[ "$NEXT" =~ ^K-[0-9]{5}$ ]] || { echo "✗ Nummering na herstel werkt niet"; exit 1; }
echo "✓ Back-up en herstel geslaagd"
