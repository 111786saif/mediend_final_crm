---
name: column-rbac-migration
description: Migrating old database table columns to the new centralized RBAC sanitization model and filtering them in TanStack DataTable pages.
---

# Column-Level RBAC & API Data Filtering Migration Guide

This skill documents how to migrate legacy API endpoints and frontend tables to use the unified **Column-Level Role-Based Access Control (RBAC)**. This ensures that unauthorized sensitive data is stripped at the database/API layer and hidden from the frontend table layout.

---

## 1. Register Resource Keys

The keys must follow this exact nested format:
`[pageKey].table.[tableName].column.[columnName]`

* `[pageKey]`: The static route or component group identifier (e.g. `sales.case_tracker`, `insurance_pl.pl_outstanding`).
* `[tableName]`: The target database entity table name in Prisma (e.g. `lead`, `dischargeSheet`).
* `[columnName]`: The exact camelCase database column name (e.g. `phoneNumber`, `patientEmail`, `netProfit`).

### A. Register in Frontend Resource Map (`lib/rbac/resourceMap.ts`)
Add the mapping to the `RESOURCE_MAP` object:
```typescript
"sales.case_tracker.table.lead.column.phoneNumber": { label: "Patient Phone Number", component: "PatientPhoneNumber" },
```

### B. Register in Database Seeder (`scripts/seed-rbac.ts`)
Add the entity definition to the `resourcesToSeed` array:
```typescript
{ key: 'sales.case_tracker.table.lead.column.phoneNumber', label: 'Patient Phone Number', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 10 },
```
Then run the database seeding command:
```bash
bun run db:seed
```

---

## 2. Migrate the Backend API Route

Ensure the API route handler calls `successResponse()` with the target database table name passed as the third parameter.

* Path: `app/api/[entity]/route.ts` or `app/api/[entity]/[id]/route.ts`

### Example
```diff
- return successResponse(records)
+ return successResponse(records, undefined, 'lead')
```

The centralized serialization helper `successResponse` automatically retrieves the active user session, queries column-level permissions matching `.table.lead.column.`, and nulls out unauthorized fields from the payload on serialization.

---

## 3. Migrate the Frontend Page (`components/ui/data-table.tsx`)

To hide columns on pages utilizing the common `DataTable` component:

### Step A: Load Permissions Hook
Import `usePermissions` in the page component:
```typescript
import { usePermissions } from '@/hooks/use-permissions';
```

### Step B: Filter the Columns Definition
Wrap the column definitions list in a `useMemo` block that dynamically filters out unauthorized columns.

```tsx
const { hasAccess, permissions } = usePermissions();

const columns = useMemo(() => {
  const allColumns: ColumnDef<Lead>[] = [
    {
      id: 'leadRef',
      header: 'Lead Ref',
      accessorKey: 'leadRef',
    },
    {
      id: 'phoneNumber',
      header: 'Phone Number',
      accessorKey: 'phoneNumber',
    },
  ];

  return allColumns.filter((col) => {
    const colId = col.id || (col as any).accessorKey;
    if (!colId) return true;

    // Build the hierarchical resource key
    const resourceKey = `sales.case_tracker.table.lead.column.${colId}`;

    // If registered in permissions map, verify read access
    if (permissions && resourceKey in permissions) {
      return hasAccess(resourceKey, 'READ');
    }
    return true;
  });
}, [hasAccess, permissions]);
```

### Step C: Render using DataTable
Pass the filtered `columns` list directly into the `<DataTable>` component:
```tsx
<DataTable
  columns={columns} // Passes only the authorized columns
  data={data}
  isLoading={isLoading}
/>
```
Because the unauthorized columns are completely filtered out of the definition array, the `DataTable` rendering lifecycle will never render the column headers, cells, or inputs, ensuring zero visual leaks.
