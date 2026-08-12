#!/bin/bash
# Restore /tmp/mediend_crm_backup.sql.gz on new-workspace and upgrade schema.
# Run on 200.141.7.195 after scp from workspace (93.127.195.235).
#
#   cd /root/mediend.workspace
#   git pull origin main
#   chmod +x scripts/restore-workspace-backup.sh scripts/upgrade-restored-db.sh
#   ./scripts/restore-workspace-backup.sh

set -euo pipefail

BACKUP="${1:-/tmp/mediend_crm_backup.sql.gz}"
APP_DIR="/root/mediend.workspace"

cd "$APP_DIR"

if [ ! -f "$BACKUP" ]; then
  echo "Backup not found: $BACKUP"
  echo "Usage: $0 [/tmp/mediend_crm_backup.sql.gz]"
  exit 1
fi

if ! grep -q '@postgres:5432/mediend_crm' .env 2>/dev/null; then
  echo "ERROR: .env DATABASE_URL must use @postgres:5432/mediend_crm (not Supabase)"
  grep DATABASE_URL .env || true
  exit 1
fi

echo "=== Restore from $BACKUP ==="
ls -lh "$BACKUP"

docker compose stop app worker-bulk-reassign

docker compose exec -T postgres psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'mediend_crm' AND pid <> pg_backend_pid();
"
docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS mediend_crm;"
docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE mediend_crm;"

gunzip -c "$BACKUP" | docker compose exec -T postgres psql -U postgres -d mediend_crm

echo "=== Post-restore counts ==="
docker compose exec -T postgres psql -U postgres -d mediend_crm -c "
SELECT COUNT(*) AS leads FROM \"Lead\";
SELECT COUNT(*) AS users FROM \"User\";
SELECT COUNT(*) AS employees FROM \"Employee\";
"

echo ""
echo "=== Schema upgrade (schema-gap — NOT migrate deploy) ==="
./scripts/upgrade-restored-db.sh

echo ""
echo "=== Start app ==="
docker compose up -d --force-recreate app worker-bulk-reassign
docker compose exec -T app printenv DATABASE_URL
curl -s http://127.0.0.1:3000/api/health || true

echo ""
echo "=== Done. Test https://new-workspace.mediend.com ==="
