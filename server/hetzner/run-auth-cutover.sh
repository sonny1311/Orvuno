#!/bin/sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

: "${DATABASE_URL:?DATABASE_URL fuer Hetzner PostgreSQL fehlt}"
: "${SUPABASE_DATABASE_URL:?SUPABASE_DATABASE_URL fuer die einmalige Auth-Migration fehlt}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$HERE/auth_cutover.sql"
node "$HERE/migrate-auth-from-supabase.mjs"

echo "Auth-Migration abgeschlossen. Jetzt den laufenden Orvuno-API-Prozess mit dem aktuellen main-Stand neu starten."
