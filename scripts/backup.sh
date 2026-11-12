#!/usr/bin/env bash
# Maakt een logische back-up van de BouwFlow-database (schema public + auth.users-koppelingen
# blijven bij Supabase). Gebruik:
#   DATABASE_URL="postgresql://postgres:<wachtwoord>@db.<project>.supabase.co:5432/postgres" scripts/backup.sh
# Bewaar back-ups versleuteld en buiten Supabase (bijv. in een aparte cloudopslag).
set -euo pipefail
: "${DATABASE_URL:?Stel DATABASE_URL in (zie Supabase → Project Settings → Database)}"
OUT="${1:-bouwflow-backup-$(date -u +%Y%m%dT%H%M%SZ).dump}"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --file="$OUT"
echo "Back-up geschreven naar $OUT"
echo "Let op: bestanden in Supabase Storage (bucket 'documents') worden NIET in deze dump opgenomen; zie docs/PRODUCTIE.md."
