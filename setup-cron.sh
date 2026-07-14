#!/bin/bash
set -e

# ============================================================
# Cron Jobs Setup Script for Mediend CRM
# Run this on your VPS server to configure cron jobs
# ============================================================

APP_DIR="/root/mediend.workspace"
ENV_FILE="${APP_DIR}/.env"

echo "===> Setting up cron jobs for Mediend CRM..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Error: Please run as root (use sudo)"
  exit 1
fi

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env not found at $ENV_FILE"
  exit 1
fi

# Extract CRON_SECRET from .env
CRON_SECRET=$(grep "^CRON_SECRET=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)

if [ -z "$CRON_SECRET" ]; then
  echo "Error: CRON_SECRET not found in $ENV_FILE"
  echo "Please add CRON_SECRET to your .env.production file"
  echo "Generate one with: openssl rand -base64 32"
  exit 1
fi

echo "✓ Found CRON_SECRET"

# Create log directories
mkdir -p /var/log
touch /var/log/cron-attendance.log
touch /var/log/cron-leads.log
touch /var/log/cron-cleanup.log
touch /var/log/cron-work-log-reminders.log
touch /var/log/cron-leave-accrual.log
chmod 644 /var/log/cron-*.log
echo "✓ Created log files"

# Create backup script directory
mkdir -p /opt/backups
BACKUP_SCRIPT="/opt/backups/pg_backup.sh"

# Create PostgreSQL backup script
cat > "$BACKUP_SCRIPT" << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
docker exec mediend-crm-postgres-1 \
  pg_dump -U postgres mediend_crm | gzip > "$BACKUP_DIR/mediend_crm_$TIMESTAMP.sql.gz"
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] Backup: mediend_crm_$TIMESTAMP.sql.gz"
EOF

chmod +x "$BACKUP_SCRIPT"
echo "✓ Created backup script"

# Backup existing crontab
CRON_BACKUP="/tmp/crontab_backup_$(date +%Y%m%d_%H%M%S)"
crontab -l > "$CRON_BACKUP" 2>/dev/null || true
echo "✓ Backed up existing crontab to $CRON_BACKUP"

# Remove ALL old Mediend CRM cron entries (comments + commands)
crontab -l 2>/dev/null | sed '/^# Mediend CRM Cron Jobs/,/^$/{ /^$/!d; }' | sed '/api\/cron/d' | sed '/pg_backup/d' | sed '/^$/N;/^\n$/d' | crontab - 2>/dev/null || true

# Add new cron entries
(crontab -l 2>/dev/null; cat << EOF

# Mediend CRM Cron Jobs
# Attendance sync - every 5 minutes
*/5 * * * * curl -sf -X POST http://localhost:3000/api/cron/attendance -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-attendance.log 2>&1

# Leads sync - every 5 minutes
*/5 * * * * curl -sf -X POST http://localhost:3000/api/cron/leads -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-leads.log 2>&1

# Work log reminders (push notifications) - every 15 min, IST (tzOffsetMinutes=330)
*/15 * * * * curl -sf -X GET "http://localhost:3000/api/cron/work-log-reminders?tzOffsetMinutes=330" -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-work-log-reminders.log 2>&1

# Database backup - daily at 2 AM UTC
0 2 * * * ${BACKUP_SCRIPT} >> /var/log/pg_backup.log 2>&1

# Cleanup old logs - daily at 3 AM UTC
0 3 * * * curl -sf -X POST http://localhost:3000/api/cron/cleanup -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-cleanup.log 2>&1

# Monthly leave accrual - 1st of every month at 1:30 AM UTC (7:00 AM IST)
30 1 1 * * curl -sf -X POST http://localhost:3000/api/cron/leave-accrual -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/cron-leave-accrual.log 2>&1
EOF
) | crontab -

echo "✓ Added cron jobs to crontab"

# Verify cron jobs were added
echo ""
echo "===> Current crontab:"
crontab -l | grep -A 10 "Mediend CRM" || echo "Warning: Could not verify cron jobs"

echo ""
echo "===> Testing cron endpoints..."

# Test endpoints
echo "Testing attendance endpoint..."
ATTENDANCE_TEST=$(curl -sf -X POST http://localhost:3000/api/cron/attendance -H "Authorization: Bearer ${CRON_SECRET}" -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "HTTP_CODE:000")
if echo "$ATTENDANCE_TEST" | grep -q "HTTP_CODE:200\|HTTP_CODE:201"; then
  echo "✓ Attendance endpoint is working"
else
  echo "✗ Attendance endpoint test failed (this is OK if app is not running)"
fi

echo "Testing leads endpoint..."
LEADS_TEST=$(curl -sf -X POST http://localhost:3000/api/cron/leads -H "Authorization: Bearer ${CRON_SECRET}" -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "HTTP_CODE:000")
if echo "$LEADS_TEST" | grep -q "HTTP_CODE:200\|HTTP_CODE:201"; then
  echo "✓ Leads endpoint is working"
else
  echo "✗ Leads endpoint test failed (this is OK if app is not running)"
fi

echo "Testing work-log-reminders endpoint..."
REMINDERS_TEST=$(curl -sf -X GET "http://localhost:3000/api/cron/work-log-reminders?tzOffsetMinutes=330" -H "Authorization: Bearer ${CRON_SECRET}" -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "HTTP_CODE:000")
if echo "$REMINDERS_TEST" | grep -q "HTTP_CODE:200"; then
  echo "✓ Work log reminders endpoint is working"
else
  echo "✗ Work log reminders endpoint test failed (this is OK if app is not running)"
fi

echo ""
echo "===> Setup complete!"
echo ""
echo "Cron jobs configured:"
echo "  - Attendance sync: every 5 minutes"
echo "  - Leads sync: every 5 minutes"
echo "  - Work log reminders (push): every 15 minutes"
echo "  - Database backup: daily at 2 AM UTC"
echo "  - Log cleanup: daily at 3 AM UTC"
echo "  - Leave accrual: 1st of every month at 1:30 AM UTC (7:00 AM IST)"
echo ""
echo "Log files:"
echo "  - /var/log/cron-attendance.log"
echo "  - /var/log/cron-leads.log"
echo "  - /var/log/cron-work-log-reminders.log"
echo "  - /var/log/cron-cleanup.log"
echo "  - /var/log/pg_backup.log"
echo ""
echo "To view cron logs:"
echo "  tail -f /var/log/cron-attendance.log"
echo "  tail -f /var/log/cron-leads.log"
echo ""
echo "To edit cron jobs:"
echo "  crontab -e"
echo ""
echo "To view current cron jobs:"
echo "  crontab -l"
