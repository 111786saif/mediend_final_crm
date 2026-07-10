# Mediend CRM - VPS Deployment Guide

This guide covers deploying the Mediend CRM to a VPS using Docker Compose, Nginx, and automated cron jobs.

## Architecture

- **Docker Compose**: Runs the Next.js app, PostgreSQL, and Uptime Kuma
- **Nginx**: Reverse proxy with SSL via Let's Encrypt
- **Cron Jobs**: Automated attendance sync, leads sync, and backups
- **Observability**: Built-in dashboard at `/admin/system`

## Files Created

### Infrastructure Files
- `Dockerfile` - Multi-stage Docker build for Next.js
- `docker-compose.yml` - Full stack definition (app + PostgreSQL + Uptime Kuma)
- `.dockerignore` - Excludes unnecessary files from Docker builds
- `deploy.sh` - One-command deployment script

### API Endpoints
- `/api/health` - Health check endpoint
- `/api/cron/attendance` - Attendance sync wrapper (logs to DB)
- `/api/cron/leads` - Leads sync wrapper (logs to DB)
- `/api/cron/cleanup` - Log cleanup job
- `/api/admin/system/health` - System health metrics
- `/api/admin/system/metrics` - CPU, RAM, disk usage
- `/api/admin/system/logs` - API request logs
- `/api/admin/system/cron-logs` - Cron job execution history
- `/api/admin/system/db` - Database size and table info
- `/api/admin/system/errors` - Error tracking
- `/api/admin/system/active-users` - Active user monitoring
- `/api/admin/system/deploy` - Current deployment info

### UI
- `/app/admin/system/page.tsx` - Observability dashboard with 6 tabs

### Database
- Added `CronJobLog` model - Tracks all cron job executions
- Added `RequestLog` model - Logs all API requests

### Utilities
- `lib/request-logger.ts` - Async request logging utility

## Server Setup

### Prerequisites
- Ubuntu 24.04 VPS with 4GB RAM
- Domain name pointed to the VPS IP
- SSH access as root

### Step 1: Initial Setup

```bash
# Update and reboot
apt update && apt upgrade -y && reboot

# After reboot, add swap
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' >> /etc/sysctl.conf
sysctl -p

# Install Docker, Nginx, Certbot
curl -fsSL https://get.docker.com | sh
apt install -y nginx certbot python3-certbot-nginx

# Firewall
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
```

### Step 2: Clone Repo and Setup Environment

```bash
mkdir -p /root/mediend.workspace
cd /root/mediend.workspace
git clone https://github.com/YOUR-ORG/mediend.workspace.git .

# Create production env file (referenced by docker-compose.yml)
nano .env
```

Required environment variables:
```bash
DATABASE_URL=postgresql://mediend:<PASSWORD>@postgres:5432/mediend_crm
POSTGRES_PASSWORD=<SAME-PASSWORD>
JWT_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_APP_URL=https://workspace.mediend.com
NODE_ENV=production
CRON_SECRET=<openssl rand -base64 32>

# Push notifications (work log reminders) - generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>

# Add all other env vars (AWS, AI, MySQL, etc.)
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/mediend-crm`:
```nginx
server {
    server_name workspace.mediend.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Create `/etc/nginx/sites-available/uptime-kuma`:
```nginx
server {
    server_name status.mediend.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable sites and get SSL:
```bash
ln -s /etc/nginx/sites-available/mediend-crm /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/uptime-kuma /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d workspace.mediend.com -d status.mediend.com
```

### Step 4: Setup Cron Jobs

Create backup script:
```bash
mkdir -p /opt/backups
nano /opt/backups/pg_backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
docker exec mediend-crm-postgres-1 \
  pg_dump -U mediend mediend_crm | gzip > "$BACKUP_DIR/mediend_crm_$TIMESTAMP.sql.gz"
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] Backup: mediend_crm_$TIMESTAMP.sql.gz"
```

Make executable and add to cron:
```bash
chmod +x /opt/backups/pg_backup.sh
crontab -e
```

Add these lines (replace YOUR_CRON_SECRET with actual value from .env.production):
```cron
# Attendance sync - every 5 minutes
*/5 * * * * curl -sf -X POST http://localhost:3000/api/cron/attendance -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/cron-attendance.log 2>&1

# Leads sync - every 5 minutes
*/5 * * * * curl -sf -X POST http://localhost:3000/api/cron/leads -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/cron-leads.log 2>&1

# Work log reminders (push) - every 15 min, IST
*/15 * * * * curl -sf -X GET "http://localhost:3000/api/cron/work-log-reminders?tzOffsetMinutes=330" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/cron-work-log-reminders.log 2>&1

# Database backup - daily at 2 AM UTC
0 2 * * * /opt/backups/pg_backup.sh >> /var/log/pg_backup.log 2>&1

# Cleanup old logs - daily at 3 AM UTC
0 3 * * * curl -sf -X POST http://localhost:3000/api/cron/cleanup -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/cron-cleanup.log 2>&1
```

### Step 5: First Deployment

```bash
cd /root/mediend.workspace
docker compose up -d

# Check status
docker compose ps

# Watch logs
docker compose logs -f app

# First-time only: seed database
docker compose exec app npx prisma db seed
```

### Step 6: Setup Uptime Kuma

1. Visit `https://status.mediend.com`
2. Create admin account
3. Add monitors:
   - HTTP: `https://workspace.mediend.com/api/health`
   - TCP: `127.0.0.1:5432` (PostgreSQL)
   - Ping: Your VPS IP

## Daily Deployment

After making code changes locally:

```bash
chmod +x deploy.sh
./deploy.sh
```

This script:
1. Pushes code to GitHub
2. SSHs into the server
3. Pulls latest code
4. Rebuilds and restarts the app container
5. Runs migrations automatically
6. Cleans up old Docker images

## Observability Dashboard

Access at: `https://workspace.mediend.com/admin/system` (MD/ADMIN only)

**Features:**
- **Overview**: System health, CPU/RAM/disk usage, deploy info, quick stats
- **API Logs**: Paginated request logs with filtering
- **Cron Jobs**: Execution history and status for all scheduled jobs
- **Database**: Size, table info, active connections
- **Errors**: Error tracking grouped by endpoint
- **Active Users**: Real-time user activity monitoring

Auto-refresh available (5-second interval).

## Database: What to run on the server

Production uses **Prisma Migrate** with a single squashed init migration (`20260710120000_init`). See **[docs/INIT_DB.md](docs/INIT_DB.md)** for the full bootstrap guide.

### Fresh database (first-time prod)

```bash
docker compose --profile tools run --rm --build \
  -v "/path/to/csvjson(5).json:/app/csvjson(5).json" \
  init-db -- \
  --employees-json /app/csvjson(5).json \
  --leads-from 2020-01-01
```

This applies schema, baseline data, RBAC, users, masters, and MySQL leads in one flow.

### Schema only (migrations on existing empty DB)

```bash
docker compose --profile tools run --rm migrate-deploy
```

### On each deploy (existing DB with migration history)

After the first init, routine deploys only rebuild the app — **no** automatic migration. When new migrations are added:

```bash
docker compose --profile tools run --rm migrate-deploy
```

### One-time data migration (case stages v2)

If the server DB has existing leads with **old** case stages (`KYP_PENDING`, `KYP_COMPLETE`, `ADMITTED`, `IPD_DONE`), run the data migration **once** after schema is in place.

**Option A – Run in a one-off container (recommended on server):**

From the repo root (where `docker-compose.yml` and `.env` with `DATABASE_URL` are):

```bash
docker compose --profile tools run --rm migrate
```

This builds a `migrate` image with the full app context and runs `migrate:case-stages-v2`, then exits.

**Option B – Run on your machine against the server DB:**

Use an SSH tunnel or temporary DB access, then:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/mediend_crm" bun run migrate:case-stages-v2
```

Use `migrate:case-stages` for initial stage assignment; use `migrate:case-stages-v2` when migrating from the old enum values to the new workflow (KYP_BASIC_*, KYP_DETAILED_*, etc.).

### Incremental seeds (after init)

```bash
docker compose --profile tools run --rm seed-treatments
docker compose --profile tools run --rm sync-attendance -- --from 2025-01-01
```

## Database Backups

- **Automatic**: Daily at 2 AM UTC via cron
- **Retention**: 7 days
- **Location**: `/opt/backups/postgres/`

Restore:
```bash
gunzip < /opt/backups/postgres/mediend_crm_TIMESTAMP.sql.gz | \
  docker exec -i mediend-crm-postgres-1 psql -U mediend mediend_crm
```

## Monitoring

1. **Uptime Kuma**: `https://status.mediend.com`
2. **System Dashboard**: `https://workspace.mediend.com/admin/system`
3. **Docker Logs**: `docker compose logs -f app`
4. **Cron Logs**: `/var/log/cron-*.log`

## Troubleshooting

### Container won't start
```bash
docker compose logs app
docker compose ps
```

### Database connection issues
```bash
docker compose exec postgres psql -U mediend -d mediend_crm
```

### Out of disk space
```bash
docker system prune -a
find /opt/backups/postgres -name "*.sql.gz" -mtime +7 -delete
```

### Cron jobs not running
```bash
# Check cron logs
tail -f /var/log/cron-attendance.log
tail -f /var/log/cron-leads.log

# Test manually
curl -X POST http://localhost:3000/api/cron/attendance \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Resource Usage

Typical usage on 4GB RAM VPS:
- PostgreSQL: ~300-500MB
- Next.js App: ~300-500MB
- Nginx: ~10MB
- Uptime Kuma: ~100MB
- **Total**: ~1-1.2GB steady-state
- **Build spikes**: ~2-3GB (uses swap)

## Security Notes

1. All services bind to `127.0.0.1` - only accessible via Nginx
2. Cron endpoints require `CRON_SECRET` authentication
3. Observability dashboard requires MD/ADMIN role
4. SSL certificates auto-renew via certbot systemd timer
5. Database only accessible from inside Docker network

## Next Steps

1. Configure email/Slack notifications in Uptime Kuma
2. Set up off-site backup sync (optional)
3. Configure monitoring alerts
4. Review and adjust cron schedules as needed
