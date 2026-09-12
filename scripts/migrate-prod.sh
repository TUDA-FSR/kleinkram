#!/usr/bin/env bash
# Run TypeORM migrations against the production postgres container.
#
# Upstream does NOT run migrations automatically (synchronize is off in prod,
# and the production image is a webpack bundle without the TypeORM CLI). Run
# this after every `git pull` + rebuild, BEFORE restarting api-server.
#
# Usage:  scripts/migrate-prod.sh show   # read-only: list applied/pending
#         scripts/migrate-prod.sh run    # apply pending migrations
#         scripts/migrate-prod.sh revert # undo the last applied migration
#
# It uses the kleinkram-base image (deps only) + the checked-out source,
# joined to the compose private network so 'postgres' resolves. Credentials
# come from .env.prod via environment, never written to a file.
set -euo pipefail
cd "$(dirname "$0")/.."
action="${1:-show}"
case "$action" in show|run|revert) ;; *) echo "usage: $0 show|run|revert" >&2; exit 2;; esac

set -a; . ./.env.prod; set +a
docker run --rm --network kleinkram_privatenet -v "$PWD:/src:ro" \
  -e prod_dbhost=postgres -e prod_port=5432 -e prod_ssl=false \
  -e prod_dbname="$DB_DATABASE" -e prod_dbuser="$DB_USER" -e prod_dbpassword="$DB_PASSWORD" \
  kleinkram-base sh -c '
    set -e
    cd /app
    cp -r /src/backend/migration /src/backend/src /src/backend/tsconfig*.json backend/
    for p in shared validation api-dto backend-common; do
      cp -r /src/packages/$p/src /src/packages/$p/tsconfig*.json packages/$p/ 2>/dev/null || true
    done
    cp /src/tsconfig.json . 2>/dev/null || true
    cd backend
    pnpm run --silent typeorm migration:'"$action"' -d migration/prod/migration.config.ts'
