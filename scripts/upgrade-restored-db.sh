#!/bin/bash
# Upgrade a DB restored from old mediend-crm-v2 pg_dump to the current mediend.workspace schema.
#
# Prisma migrate deploy alone fails on restored old DBs (init marked applied but tables missing).
# This script uses prisma migrate diff → apply gap SQL → mark all migrations applied → seed RBAC.
#
# Run on new-workspace AFTER restore:
#   gunzip -c /tmp/mediend_crm_backup.sql.gz | docker compose exec -T postgres psql -U postgres -d mediend_crm
#
# Usage (from /root/mediend.workspace):
#   git pull origin main
#   chmod +x scripts/upgrade-restored-db.sh
#   ./scripts/upgrade-restored-db.sh

set -euo pipefail

APP_DIR="/root/mediend.workspace"
SCHEMA_GAP="/tmp/schema-gap.sql"
SCHEMA_GAP_ERR="/tmp/schema-gap.err"

cd "$APP_DIR"

psql_exec() {
  docker compose exec -T postgres psql -U postgres -d mediend_crm "$@"
}

migrate_node() {
  docker compose --profile tools run --rm \
    --entrypoint "prisma" migrate-deploy-node "$@"
}

generate_schema_gap() {
  echo "Building migrate-deploy-node image..."
  docker compose --profile tools build migrate-deploy-node

  echo "Generating schema gap SQL..."
  rm -f "$SCHEMA_GAP" "$SCHEMA_GAP_ERR"

  if ! docker compose --profile tools run --rm \
    --entrypoint "sh" migrate-deploy-node \
    -c 'prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script' \
    >"$SCHEMA_GAP" 2>"$SCHEMA_GAP_ERR"; then
    echo "migrate diff failed:"
    cat "$SCHEMA_GAP_ERR" || true
    exit 1
  fi

  local lines
  lines=$(wc -l <"$SCHEMA_GAP" | tr -d ' ')
  echo "schema-gap.sql: ${lines} lines"
  head -15 "$SCHEMA_GAP"

  if [ "${lines}" -lt 10 ]; then
    echo "ERROR: schema-gap.sql looks empty. Check $SCHEMA_GAP_ERR"
    cat "$SCHEMA_GAP_ERR" || true
    echo "Retrying with Bun migrate-deploy image..."
    docker compose --profile tools build migrate-deploy
    docker compose --profile tools run --rm \
      --entrypoint "sh" migrate-deploy \
      -c 'bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script' \
      >"$SCHEMA_GAP" 2>"$SCHEMA_GAP_ERR"
    lines=$(wc -l <"$SCHEMA_GAP" | tr -d ' ')
    echo "schema-gap.sql (retry): ${lines} lines"
    if [ "${lines}" -lt 10 ]; then
      cat "$SCHEMA_GAP_ERR" || true
      exit 1
    fi
  fi
}

mark_all_migrations_applied() {
  echo "Marking all timestamped migrations as applied..."
  for d in prisma/migrations/202*/; do
    m=$(basename "$d")
    echo "  → $m"
    migrate_node migrate resolve --applied "$m" 2>/dev/null || true
  done
}

echo "=== Step 1: Baseline row counts (save these) ==="
psql_exec -c "
SELECT COUNT(*) AS leads FROM \"Lead\";
SELECT COUNT(*) AS users FROM \"User\";
SELECT COUNT(*) AS employees FROM \"Employee\";
"

echo ""
echo "=== Step 2: Generate + apply schema gap (old DB → current schema) ==="
generate_schema_gap

echo "Applying schema gap (some FK errors at the end are OK)..."
set +e
psql_exec <"$SCHEMA_GAP" 2>&1 | tail -40
set -e

echo ""
echo "=== Step 3: Orphan FK cleanup + onboarding extras ==="
psql_exec <scripts/fix-orphan-fks.sql
psql_exec <prisma/migrations/onboarding_status.sql
psql_exec <prisma/migrations/new_hire_welcome.sql

echo ""
echo "=== Step 4: Sync Prisma migration history ==="
migrate_node migrate resolve --rolled-back 20260714010000_sales_team_other_cost 2>/dev/null || true
mark_all_migrations_applied

echo "Verifying migrate deploy (expect: no pending migrations)..."
set +e
migrate_node migrate deploy
set -e

echo ""
echo "=== Step 5: Seed RBAC + page permissions (no users/leads) ==="
docker compose --profile tools run --rm --build init-db -- \
  --skip-migrate \
  --skip-employees \
  --skip-leads \
  --only rbac,permissions

echo ""
echo "=== Step 6: Normalize login emails ==="
psql_exec -c 'UPDATE "User" SET email = LOWER(TRIM(email));'

echo ""
echo "=== Step 7: Legacy case stages (optional data transform) ==="
LEGACY_COUNT=$(psql_exec -t -A -c "
SELECT COUNT(*)
FROM \"Lead\"
WHERE \"caseStage\" IN (
  'KYP_PENDING','KYP_COMPLETE','ADMITTED','IPD_DONE',
  'KYP_BASIC_PENDING','KYP_DETAILED_PENDING','KYP_DETAILED_COMPLETE'
);
" | tr -d '[:space:]')

echo "Legacy caseStage rows: ${LEGACY_COUNT:-0}"

if [ "${LEGACY_COUNT:-0}" -gt 0 ]; then
  echo "Running migrate-case-stages-v2..."
  docker compose --profile tools run --rm --build migrate
else
  echo "Skipping case stage migration (no legacy values)."
fi

echo ""
echo "=== Step 8: Post-upgrade row counts (must match Step 1) ==="
psql_exec -c "
SELECT COUNT(*) AS leads FROM \"Lead\";
SELECT COUNT(*) AS users FROM \"User\";
SELECT COUNT(*) AS employees FROM \"Employee\";
"

echo ""
echo "=== Upgrade complete ==="
echo "Next:"
echo "  docker compose up -d --force-recreate app worker-bulk-reassign"
echo "  curl -s http://127.0.0.1:3000/api/health"
