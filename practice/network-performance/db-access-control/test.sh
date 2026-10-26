#!/usr/bin/env bash
# Tries to reach the database from four places and reports what stopped each attempt.
#   docker compose up -d && bash test.sh
set -uo pipefail
cd "$(dirname "$0")"

URL="postgresql://app:devpassword@db:5432/shop"
export PGCONNECT_TIMEOUT=3

attempt() {
  local who="$1"; shift
  echo "== $who"
  if out=$("$@" 2>&1); then echo "   ALLOWED: $out"; else echo "   BLOCKED: $(echo "$out" | tail -n 1)"; fi
  echo
}

echo "waiting for postgres to accept connections..."
for _ in $(seq 1 30); do
  docker compose exec -T db pg_isready -q -U app && break
  sleep 1
done
echo

attempt "app (backend network, allowed IP)" \
  docker compose exec -T app psql "$URL" -tAc "select 'connected as ' || current_user || ' from ' || inet_client_addr()"

attempt "rogue (backend network, wrong IP) -> stopped by pg_hba.conf" \
  docker compose exec -T rogue psql "$URL" -tAc "select 1"

attempt "outsider (frontend only) by name -> 'db' doesn't even resolve" \
  docker compose exec -T outsider psql "$URL" -tAc "select 1"

attempt "outsider (frontend only) by IP -> no route to the backend network" \
  docker compose exec -T outsider psql "postgresql://app:devpassword@172.30.0.5:5432/shop" -tAc "select 1"

attempt "host machine on localhost:5432 -> port was never published" \
  bash -c "exec 3<>/dev/tcp/127.0.0.1/5432 && echo 'something is listening on 5432 (is a local postgres running?)'"

attempt "rogue -> internet (backend is internal: no egress either)" \
  docker compose exec -T rogue wget -q -T 3 -O /dev/null http://example.com
