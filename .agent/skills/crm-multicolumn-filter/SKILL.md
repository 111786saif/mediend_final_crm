---
name: crm-multicolumn-filter
description: >
  Add CRM-grade, backend-driven multi-column filtering to any table + API
  combination in this project. Covers all filter types (multiSelect, dateRange,
  numberRange, search), the filter-config metadata API, the data API filter
  parser, and the React page wiring — all fully backward compatible.
---

# CRM Multi-Column Filter — Implementation Skill

> **Reference files (P/L Dashboard — the canonical implementation)**
> - `components/ui/column-filter.tsx` — shared UI component (DO NOT MODIFY)
> - `app/api/leads/filter-config/route.ts` — filter metadata API (P/L example)
> - `app/api/leads/route.ts` — data API with filter parser (P/L example)
> - `app/pl/dashboard/page.tsx` — page wiring (P/L example)
> - Architecture docs: `crm-multi-column-filter-architecture.md`, `crm-multicolumn-filter.md`

---

## Architecture Overview

This system uses **two APIs + one shared UI component**:

```
GET  /api/<module>/filter-config   →  returns filter metadata per column
GET  /api/<module>/list (or route) →  accepts ?filters=JSON and returns filtered data
<ColumnFilter />                   →  shared UI that renders the right control per filterType
```

The backend owns **what** can be filtered and **how**. The frontend renders dynamically.

---

## Filter Types — Complete Reference

| filterType    | UI rendered by ColumnFilter             | Value emitted by onChange                        | Backend operator |
|---------------|-----------------------------------------|--------------------------------------------------|------------------|
| multiSelect   | Checkbox list with search box           | string[] e.g. ["Delhi","Mumbai"]                 | in               |
| search        | Single text input (Enter to apply)      | string e.g. "knee"                               | contains         |
| dateRange     | Calendar range picker + quick shortcuts | [fromISO, toISO] two-element string array        | between          |
| numberRange   | Min / Max number inputs                 | { min: number|null, max: number|null }           | between          |
| boolean       | Yes / No radio                          | true | false | null                               | equals           |

---

## Step 1 — Create the Filter-Config API

Create `app/api/<module>/filter-config/route.ts`.

### Rules
1. Auth first — always check session + permission before querying.
2. All DB queries in one Promise.all — never sequential awaits.
3. Distinct string values: use findMany with distinct and { not: null }.
   For non-nullable string columns use { not: '' } instead.
4. Numeric bounds: use aggregate with _min/_max and where: { fieldName: { gt: 0 } }.
   CRITICAL: verify the field exists on the model before using it — do not assume.
5. Authoritative sources: For user/person fields (BDM, Manager) query the User table
   with role = X instead of string columns in PLRecord/DischargeSheet — User table is always complete.
6. Payment types and other enums: merge hardcoded known values with DB distinct values
   so options always appear even if DB has no data yet.
7. Multi-source fields: for fields that exist on multiple models (e.g. hospitalName on
   Lead, PLRecord, DischargeSheet), collect from all and deduplicate using the toOptions helper.
8. Filter noise: remove known bad values after deduplication (e.g. 'Unknown', '').
9. staleTime hint: the response can be cached by the frontend for 5 minutes.

### Helper function (copy into every filter-config route)

```typescript
function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }))
}
```

### Full Template

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { UserRole } from '@/generated/prisma/client' // only if querying User by role

function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }))
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const [stringDistinct, numericBounds] = await Promise.all([
      prisma.myModel.findMany({
        where: { myField: { not: null } },
        select: { myField: true },
        distinct: ['myField'],
      }),
      prisma.myModel.aggregate({
        _min: { amount: true },
        _max: { amount: true },
        where: { amount: { gt: 0 } },
      }),
    ])

    return successResponse({
      filters: [
        {
          field: 'myField',
          label: 'My Field',
          filterType: 'multiSelect',
          filterable: true,
          options: toOptions(stringDistinct.map(r => r.myField)),
        },
        {
          field: 'status',
          label: 'Status',
          filterType: 'multiSelect',
          filterable: true,
          options: [
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' },
          ],
        },
        { field: 'patientName', label: 'Patient Name', filterType: 'search', filterable: true },
        { field: 'createdAt', label: 'Created Date', filterType: 'dateRange', filterable: true },
        {
          field: 'amount',
          label: 'Amount',
          filterType: 'numberRange',
          filterable: true,
          min: numericBounds._min.amount ?? 0,
          max: numericBounds._max.amount ?? 0,
        },
      ],
    })
  } catch (error) {
    console.error('[filter-config] Error:', error)
    return errorResponse('Failed to fetch filter config', 500)
  }
}
```

### Response Shape — NEVER change this structure (backward compatible)

```json
{
  "filters": [
    { "field": "bdm",       "label": "BDM",    "filterType": "multiSelect", "filterable": true, "options": [{"label":"...", "value":"..."}] },
    { "field": "createdAt", "label": "Date",   "filterType": "dateRange",   "filterable": true },
    { "field": "amount",    "label": "Amount", "filterType": "numberRange", "filterable": true, "min": 0, "max": 50000 },
    { "field": "name",      "label": "Name",   "filterType": "search",      "filterable": true }
  ]
}
```

Adding new filter fields is safe (additive). Never rename field, label, filterType, options, min, max.

---

## Step 2 — Extend the Data API with a Filter Parser

In the existing data API (e.g. app/api/leads/route.ts), add a filter parser block
INSIDE the existing WHERE clause builder so it is 100% backward compatible.

### CRITICAL Backward Compatibility Rules
- The filters query param is OPTIONAL. Never break the API if it is absent.
- Parse inside a try/catch — a malformed filter string cannot crash the request.
- Never remove or rename existing query params.
- Never change the API response structure (field names, nesting).
- Always merge filter conditions using AND: [existingWhere, ...filterConditions].
  Never replace finalWhere.

### Filter Parser Block

```typescript
// Place AFTER building base finalWhere and BEFORE the prisma query.
const filtersParam = searchParams.get('filters')
if (filtersParam) {
  try {
    const parsedFilters = JSON.parse(filtersParam)
    if (Array.isArray(parsedFilters)) {
      const filterConditions: Prisma.MyModelWhereInput[] = []

      for (const f of parsedFilters) {
        const { field, operator, value } = f
        if (!field || value === undefined || value === null) continue

        // multiSelect / in
        if (field === 'myStringField') {
          if (Array.isArray(value) && value.length > 0) {
            filterConditions.push({ myStringField: { in: value } })
          }

        // For fields on multiple related models use OR
        } else if (field === 'hospital') {
          if (Array.isArray(value) && value.length > 0) {
            filterConditions.push({
              OR: [
                { hospitalName: { in: value } },
                { plRecord: { hospitalName: { in: value } } },
                { dischargeSheet: { hospitalName: { in: value } } },
              ],
            })
          }

        // search / contains
        } else if (field === 'patientName') {
          if (typeof value === 'string' && value.trim()) {
            filterConditions.push({
              patientName: { contains: value.trim(), mode: 'insensitive' },
            })
          }

        // dateRange / between
        // value = [fromISO, toISO] — two-element string array from ColumnFilter
        } else if (field === 'createdAt') {
          if (Array.isArray(value) && value.length === 2 && value[0]) {
            const from = new Date(value[0])
            const to   = new Date(value[1] || value[0])
            to.setHours(23, 59, 59, 999) // inclusive end of day
            filterConditions.push({ createdAt: { gte: from, lte: to } })
          }

        // numberRange / between
        // value = { min: number|null, max: number|null } from ColumnFilter
        } else if (field === 'amount') {
          const { min, max } = value as { min: number | null; max: number | null }
          const range: Prisma.FloatFilter = {}
          if (min != null) range.gte = min
          if (max != null) range.lte = max
          if (Object.keys(range).length > 0) {
            filterConditions.push({ amount: range })
          }
        }
      }

      // ALWAYS merge — never replace
      if (filterConditions.length > 0) {
        finalWhere = { AND: [finalWhere, ...filterConditions] }
      }
    }
  } catch (err) {
    console.error('Error parsing filters query param:', err)
    // Silently ignore — do not throw, do not return an error response
  }
}
```

### Field Mapping Checklist Before Adding a Filter

Before mapping field: 'myField' to a Prisma filter, verify in the schema:
- Which model actually has the column (PLRecord, DischargeSheet, Lead, etc.)
- Is it nullable String? or non-nullable String?
- Is it a Float or Int for number range filters?
- Does it exist on multiple related models? Use OR.

Quick check command:
  Select-String -Path "prisma\schema.prisma" -Pattern "fieldName"

---

## Step 3 — Wire ColumnFilter in the Page

### 3.1 — State variables (one per filter)

```typescript
// multiSelect  → string[]
const [bdFilter, setBdFilter] = useState<string[]>([])

// search  → string
const [treatmentFilter, setTreatmentFilter] = useState<string>('')

// dateRange  → string[] (two ISO strings) or [] when cleared
const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])

// numberRange  → { min: number|null; max: number|null } | null
const [totalBillFilter, setTotalBillFilter] = useState<{ min: number | null; max: number | null } | null>(null)
```

### 3.2 — Fetch filter config

```typescript
const { data: filterConfig } = useQuery<{
  filters: Array<{
    field: string
    label: string
    filterType: string
    filterable: boolean
    options?: Array<{ label: string; value: string }>
    min?: number
    max?: number
  }>
}>({
  queryKey: ['myModule', 'filter-config'],
  queryFn: () => apiGet('/api/<module>/filter-config'),
  staleTime: 5 * 60 * 1000,
})

const filterOptions = useMemo(() => {
  const filters = filterConfig?.filters || []
  const find = (field: string) => filters.find(f => f.field === field)
  return {
    bdms:   find('bdm')?.options || [],
    // numberRange bounds for placeholder display
    totalBillBounds: { min: find('totalBill')?.min ?? 0, max: find('totalBill')?.max ?? 0 },
  }
}, [filterConfig])
```

### 3.3 — Include ALL filter states in queryKey + build filters array

```typescript
const { data: records } = useQuery({
  queryKey: ['myModule', 'records', bdFilter, treatmentFilter, surgeryDateFilter, totalBillFilter],
  queryFn: async () => {
    const filters: Array<{ field: string; operator: string; value: unknown }> = []

    if (bdFilter.length > 0)
      filters.push({ field: 'bdm', operator: 'in', value: bdFilter })
    if (treatmentFilter.trim())
      filters.push({ field: 'treatment', operator: 'contains', value: treatmentFilter })
    if (surgeryDateFilter.length === 2 && surgeryDateFilter[0])
      filters.push({ field: 'surgeryDate', operator: 'between', value: surgeryDateFilter })
    if (totalBillFilter && (totalBillFilter.min != null || totalBillFilter.max != null))
      filters.push({ field: 'totalBill', operator: 'between', value: totalBillFilter })

    const params = new URLSearchParams({ /* existing base params */ })
    if (filters.length > 0) params.set('filters', JSON.stringify(filters))
    return apiGet(`/api/<module>/list?${params.toString()}`)
  },
})
```

### 3.4 — activeFilterCount and clearFilters

```typescript
const activeFilterCount =
  bdFilter.length +
  (treatmentFilter.trim() ? 1 : 0) +
  (surgeryDateFilter.length > 0 ? 1 : 0) +
  (totalBillFilter ? 1 : 0)

const clearFilters = () => {
  setBdFilter([])
  setTreatmentFilter('')
  setSurgeryDateFilter([])
  setTotalBillFilter(null)
}
```

### 3.5 — ColumnFilter in table header cells

Pattern — always wrap TableHead with a flex div:

```tsx
{visibleCols.bdm && (
  <TableHead className="min-w-[130px]">
    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
      <span>BDM</span>
      <ColumnFilter type="multiSelect" options={filterOptions.bdms} value={bdFilter} onChange={setBdFilter} />
    </div>
  </TableHead>
)}

{visibleCols.treatment && (
  <TableHead className="min-w-[130px]">
    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
      <span>Treatment</span>
      <ColumnFilter type="search" value={treatmentFilter} onChange={setTreatmentFilter} placeholder="Search..." />
    </div>
  </TableHead>
)}

{visibleCols.surgeryDate && (
  <TableHead className="min-w-[130px]">
    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
      <span>Surgery Date</span>
      <ColumnFilter type="dateRange" value={surgeryDateFilter} onChange={setSurgeryDateFilter} />
    </div>
  </TableHead>
)}

{visibleCols.totalBill && (
  <TableHead className="min-w-[140px]">
    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
      <span>Total Bill</span>
      <ColumnFilter type="numberRange" value={totalBillFilter} onChange={setTotalBillFilter}
        min={filterOptions.totalBillBounds.min} max={filterOptions.totalBillBounds.max} />
    </div>
  </TableHead>
)}
```

---

## ColumnFilter Props Reference

```typescript
interface ColumnFilterProps {
  type?: 'multiSelect' | 'search' | 'dateRange' | 'numberRange' | 'boolean'
  options?: Array<{ label: string; value: string }> | string[]  // multiSelect only
  value?: any
  onChange: (value: any) => void
  min?: number         // numberRange — shown in placeholder
  max?: number         // numberRange — shown in placeholder
  placeholder?: string // search only
}
```

Visual indicator: the chevron turns PRIMARY color when a filter is active.
Apply / Clear buttons are inside the popover — filters are NOT applied on every keystroke.

---

## Common Pitfalls

### Field does not exist on the model
Always run before adding a filter:
  Select-String -Path "prisma\schema.prisma" -Pattern "fieldName"
Check which model block the result is under. A field on DischargeSheet cannot be used
in prisma.pLRecord.aggregate().

### Using notIn: [''] on nullable fields
Use just { not: null } and rely on toOptions() to remove empty strings in JS.

### Replacing finalWhere instead of merging
  WRONG:  finalWhere = { myField: { in: value } }
  CORRECT: finalWhere = { AND: [finalWhere, { myField: { in: value } }] }

### Missing filter state in queryKey
Every filter state used in queryFn MUST be in queryKey. React Query will NOT
refetch if the state is not in queryKey.

### Hardcoding options on the frontend
Never hardcode multiSelect options in the page. Always fetch from filter-config.
Hardcode only static enums (e.g. PENDING/PAID/PARTIAL) as a supplement merged with DB values.

### Changing the API response structure
Never rename: field, label, filterType, options, min, max.
Adding new filter objects to the filters array is safe (additive).

---

## Implementation Checklist

- [ ] 1. List all filterable columns and assign filterType to each
- [ ] 2. Verify each field exists on the correct Prisma model
- [ ] 3. Create app/api/<module>/filter-config/route.ts from the template
- [ ] 4. Test filter-config API response before touching the data API
- [ ] 5. Add filter parser block to the data API inside try/catch
- [ ] 6. Merge conditions with AND — never replace finalWhere
- [ ] 7. Add useState per filter in the page component
- [ ] 8. Add useQuery for filter-config with staleTime: 5 * 60 * 1000
- [ ] 9. Include ALL filter states in the data useQuery queryKey
- [ ] 10. Build filters array in queryFn and append as ?filters=JSON
- [ ] 11. Wrap filterable TableHead with ColumnFilter using correct type prop
- [ ] 12. Update activeFilterCount and clearFilters to cover all new states
- [ ] 13. Verify API works without filters (backward compat)
- [ ] 14. Verify each filter type works individually
- [ ] 15. Verify cards and other unrelated UI are untouched
