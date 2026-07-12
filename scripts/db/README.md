# Employee seed data (not in git)

Place `employee-backup-supabase.csv` here on the server:

```
/root/mediend.workspace/scripts/db/employee-backup-supabase.csv
```

Columns: `email,name,role,employee_code,bd_number`

Upload from your PC (PowerShell):

```powershell
scp "C:\Users\DHRUV\OneDrive\Desktop\mediend-crm-v2\scripts\db\employee-backup-supabase.csv" root@srv1532122:/root/mediend.workspace/scripts/db/employee-backup-supabase.csv
```

Then seed:

```bash
docker compose --profile tools run --rm --build seed-csv /app/scripts/db/employee-backup-supabase.csv
```

Or with init-db (auto-detects this path):

```bash
docker compose --profile tools run --rm --build init-db -- --only employees,permissions
```
