# Production database initialization

This guide covers bootstrapping a **fresh** PostgreSQL database on the server using Docker Compose.

## Prerequisites

On the server (`/root/mediend.workspace`):

1. **Docker Compose stack running** — at minimum `postgres` must be healthy:
   ```bash
   docker compose up -d postgres
   ```

2. **`.env` configured** with:
   - `DATABASE_URL` — points at the `postgres` service (`postgresql://postgres:<password>@postgres:5432/mediend_crm`)
   - `POSTGRES_PASSWORD` — same password
   - **MySQL** vars for lead sync (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, etc.)

3. **Employee JSON** — the `csvjson(5).json` export with all users/employees (EMP ID, BDM, DEPT, Email, role, BD number, Manager Number).

## Schema: squashed init migration

Incremental migrations were archived to `prisma/migrations_archive/`. Production uses a single migration:

```
prisma/migrations/20260710120000_init/migration.sql
```

This matches the current `prisma/schema.prisma` exactly. On a fresh DB, `prisma migrate deploy` creates the full schema in one step.

> **Existing production DB** that already ran the old 78 migrations: do **not** re-run init on that database. Use `migrate-deploy` for any new migrations only. Init is for empty/volume-reset databases.

## One-command full bootstrap

From the repo root on the server (`/root/mediend.workspace`):

```bash
cd /root/mediend.workspace
docker compose --profile tools run --rm --build \
  -v "/root/mediend.workspace/csvjson(5).json:/app/csvjson(5).json" \
  init-db -- \
  --employees-json /app/csvjson(5).json \
  --leads-from 2020-01-01
```

### What this runs (in order)

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `prisma migrate deploy` | Create all tables/enums from init migration |
| 2 | `prisma/seed-baseline.ts` | Leave types (CL/SL/EL), HR departments, PnL seat cost |
| 3 | `scripts/seed-rbac.ts` | Navigation resources/modules for permissions |
| 4 | `scripts/seed-employees-from-json.ts` | All users + employees from JSON (password `12345678`) |
| 5 | `scripts/seed-role-permissions.ts` | Role → page access matrix |
| 6 | `prisma/seed-masters.ts` | Hospitals, doctors, TPA, anesthesia dropdowns |
| 7 | `scripts/seed-insurance-tpa.ts` | Insurance company master list |
| 8 | `scripts/sync-mysql-leads.ts` | Historic leads from MySQL |

All seed steps are **idempotent** where possible (upserts / skip-if-exists). Employee seed **replaces** all users/employees (destructive reset of user data).

## Step-by-step (manual)

### 1. Apply schema only

```bash
docker compose --profile tools run --rm migrate-deploy
```

### 2. Baseline + RBAC (no users yet)

```bash
docker compose --profile tools run --rm init-db -- --skip-employees --skip-leads
```

### 3. Users from JSON

```bash
docker compose --profile tools run --rm \
  -v "/path/to/csvjson(5).json:/app/csvjson(5).json" \
  init-db -- --only employees --employees-json /app/csvjson(5).json
```

### 4. Permissions (after users exist)

```bash
docker compose --profile tools run --rm init-db -- --only permissions
```

### 5. Leads from MySQL

```bash
docker compose --profile tools run --rm init-db -- --only leads --leads-from 2020-01-01
```

Or use the existing sync service directly:

```bash
docker compose --profile tools run --rm sync-leads -- --from 2020-01-01
```

## Resetting the database (destructive)

```bash
# Stop app, wipe Postgres volume, start fresh
docker compose down
docker volume rm mediendworkspace_pgdata   # volume name may differ — check: docker volume ls

docker compose up -d postgres
# wait for healthy, then run full init-db command above
```

## Optional post-init

| Task | Command |
|------|---------|
| Treatment master (ATS) | `docker compose --profile tools run --rm seed-treatments` |
| Holidays | `docker compose --profile tools run --rm seed-holidays` |
| Rebuild sales teams | `docker compose --profile tools run --rm rebuild-sales-teams` |
| Historic attendance | `docker compose --profile tools run --rm sync-attendance -- --from 2025-01-01` |
| Case stage migration | `docker compose --profile tools run --rm migrate` |

## Local development

```bash
# Start local Postgres (or use DATABASE_URL in .env)
bun run db:init -- --employees-json ./csvjson(5).json --leads-from 2020-01-01
```

Individual scripts:

```bash
bun run db:seed:baseline
bun run seed:rbac
bun run seed:permissions
bun run seed:employees ./csvjson(5).json
bun run sync:leads -- --from 2020-01-01
```

## Troubleshooting

### Verify migrations are inside the Docker image

After `git pull`, always rebuild:

```bash
docker compose --profile tools build migrate-deploy
docker compose --profile tools run --rm --entrypoint sh migrate-deploy -c \
  "ls -la prisma/migrations && wc -l prisma/migrations/*/migration.sql"
```

You should see `20260710120000_init/migration.sql` (~3900 lines). If not, the image is stale — use `--build`.

### `migrate-deploy` / `init-db` fails in Docker

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Could not find Prisma Schema` / config error | `Dockerfile.migrate` missing `prisma.config.ts` (Prisma 7) | Use `migrate-deploy` (Bun image) or pull latest `Dockerfile.migrate` fix |
| `migration.sql` not found / P3015 | Old broken migrations in image (`set_2414_ea_role` had no `migration.sql`) | Pull latest code (squashed init only), `docker compose build --no-cache migrate-deploy` |
| `Can't reach database` / ECONNREFUSED | `DATABASE_URL` uses `localhost` inside container | Use host `postgres`: `postgresql://postgres:PASSWORD@postgres:5432/mediend_crm` |
| `P3005` database schema is not empty | DB has tables from old `db push` but no `_prisma_migrations` | Wipe volume and start fresh (see below) |
| Stale migrations after pull | Image not rebuilt | Always pass `--build` on `run` |

### Why migrate felt broken before

1. **Prod used `db push`** — no `_prisma_migrations` table; `migrate deploy` then conflicts with existing tables.
2. **78 incremental migrations** — one folder (`20260620120000_set_2414_ea_role`) had no `migration.sql`, so Prisma aborted mid-chain.
3. **`migrate-deploy-node`** — did not copy `prisma.config.ts` (required since Prisma 7).
4. **No `--build`** — container kept old migration files from a previous image layer.

| Issue | Fix |
|-------|-----|
| `P3005` database not empty | DB has tables but no `_prisma_migrations` — drop DB or use `migrate resolve` |
| `migration.sql` not found for `set_2414_ea_role` | Old broken migration — use squashed init (this repo state) |
| Employee JSON not found | Mount file with `-v` or set `EMPLOYEES_JSON` env |
| MySQL connection failed on leads step | Check MySQL env vars; run `--skip-leads` and sync later |
| Permissions seed: no MD/ADMIN | Run employee seed first |
| Wrong leave types | Use `seed-baseline` (CL/SL/EL), not `prisma/seed.ts` (legacy Casual/Paid/Sick) |
