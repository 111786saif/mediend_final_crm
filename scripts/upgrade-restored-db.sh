#!/bin/bash
# Upgrade a DB restored from old mediend-crm-v2 pg_dump to the new mediend.workspace schema.
#
# Run on the server after:
#   gunzip -c /tmp/mediend_crm_backup.sql.gz | docker compose exec -T postgres psql -U postgres -d mediend_crm
#
# Does NOT wipe users, employees, or leads.
#
# Usage (from /root/mediend.workspace):
#   chmod +x scripts/upgrade-restored-db.sh
#   ./scripts/upgrade-restored-db.sh

set -euo pipefail

APP_DIR="/root/mediend.workspace"
cd "$APP_DIR"

psql_exec() {
  docker compose exec -T postgres psql -U postgres -d mediend_crm "$@"
}

migrate_node() {
  docker compose --profile tools run --rm --build \
    --entrypoint "prisma" migrate-deploy-node "$@"
}

echo "=== Step 1: Baseline row counts (save these) ==="
psql_exec -c "
SELECT COUNT(*) AS leads FROM \"Lead\";
SELECT COUNT(*) AS users FROM \"User\";
SELECT COUNT(*) AS employees FROM \"Employee\";
"

echo ""
echo "=== Step 2: Mark squashed init as already applied (tables exist from old prod) ==="
migrate_node migrate resolve --applied 20260710120000_init

echo ""
echo "=== Step 3: Apply post-init migrations (new tables + columns) ==="
docker compose --profile tools run --rm --build migrate-deploy-node

echo ""
echo "=== Step 4: Seed RBAC + page permissions only (no users/leads) ==="
docker compose --profile tools run --rm --build init-db -- \
  --skip-migrate \
  --skip-employees \
  --skip-leads \
  --only rbac,permissions

echo ""
echo "=== Step 5: Legacy case stages (optional data transform) ==="
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
echo "=== Step 6: Post-upgrade row counts (should match Step 1) ==="
psql_exec -c "
SELECT COUNT(*) AS leads FROM \"Lead\";
SELECT COUNT(*) AS users FROM \"User\";
SELECT COUNT(*) AS employees FROM \"Employee\";
"

echo ""
echo "=== Upgrade complete ==="
echo "Next: bash deploy.sh"
