# Targeted P&L — Change Summary

## What is Targeted P&L?

Targeted P&L allows the Finance Head to set **target revenue and expense figures** for each department and month — completely separate from the actual (auto-calculated) P&L data. This enables budget planning and goal-setting. The MD can then view a **Targeted vs Actual** comparison report to track performance against those targets.

All target data is stored in its own database table and never interferes with actual P&L data.

---

## Database

### New Model: `TargetPnLEntry`

**File:** `prisma/schema.prisma`

A flat table storing one target value per department + category + month combination.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `departmentKey` | String | `SURGERY`, `IT`, `LOAN_DEMAT`, or `GOOGLE_ADS` |
| `sourceKey` | String | `REVENUE`, `SALARY`, `SEAT_COST`, `MARKETING`, `FREELANCERS`, or `MISC` |
| `month` | Int | 1-12 |
| `year` | Int | e.g. 2026 |
| `amount` | Float | The target amount (default 0) |
| `notes` | String? | Optional notes |
| `createdById` | String? | FK to User |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-set |

**Unique constraint:** `(departmentKey, sourceKey, month, year)` — one target per slot.

**Why flat instead of mirroring PnLCategory + PnLEntry?** The category structure for targets is fixed (4 departments x 6 source keys = 24 slots per month). A flat table avoids needing a separate category seeding flow and simplifies the API.

A `targetPnlEntriesCreated` relation was also added to the `User` model.

---

## API Routes

All three routes live under `/api/pnl/targeted/` and use the same auth pattern as existing PnL routes.

### GET `/api/pnl/targeted/overview`

**Auth:** `pnl:read`
**Query params:** `startMonth`, `startYear`, `endMonth`, `endYear`

Returns all saved target entries for the date range, structured by department. Also computes **auto-fill hints** using the same functions as the regular PnL overview:

- Revenue hints from `surgeryRevenueByMonth()`, `itRevenueByMonth()`, `departmentRevenueByMonth()`
- Seat cost hints from `buildSeatCostHintsByMonth()`
- IT salary hints from `itSalaryHintByMonth()`
- Marketing hints from `marketingSpendByMonth()`

If a cell has no saved target, the hint value is shown as the default. The response includes a `savedKeys` array so the frontend knows which cells have explicit targets vs defaults.

**File:** `app/api/pnl/targeted/overview/route.ts`

---

### POST `/api/pnl/targeted/entries`

**Auth:** `pnl:write`
**Body:** `{ departmentKey, sourceKey, month, year, amount, notes? }`

Upserts a single target entry. Validates that `departmentKey` is one of the 4 department keys and `sourceKey` is one of `REVENUE` + the 5 expense keys.

**File:** `app/api/pnl/targeted/entries/route.ts`

---

### GET `/api/pnl/targeted/comparison`

**Auth:** `pnl:read`
**Query params:** `startMonth`, `startYear`, `endMonth`, `endYear`

Fetches both targeted entries and actual P&L data, then computes per-department, per-category:

- `targeted` — the saved target value (or 0 if none)
- `actual` — the real P&L value (same calculation as the regular overview)
- `variance` — actual minus targeted
- `variancePct` — percentage difference

Returns a response with department breakdowns and grand totals for the MD comparison view.

**File:** `app/api/pnl/targeted/comparison/route.ts`

---

## Frontend Components

### `TargetedPnlDashboard` (new)

**File:** `components/pnl/targeted-pnl-dashboard.tsx`

The main dashboard for the Finance Head to edit targets. Mirrors the structure of the existing `PnlDashboard`:

- Date range picker at the top
- Tab navigation: Overall, Surgery, IT, Loan & Demat, Google Ads
- **Overall tab:** Summary cards (total targeted revenue/expenses/net) + department table (click a row to switch to that department's tab)
- **Department tabs:** Renders `PnlDepartmentTable` with `allEditable={true}` so every cell (revenue and expenses) is clickable and editable. Values default to auto-fill hints (seat cost, salary, etc.) until the user saves a custom target.
- Each cell save calls `POST /api/pnl/targeted/entries`

---

### `TargetedVsActualTab` (new)

**File:** `components/pnl/targeted-vs-actual-tab.tsx`

The MD's comparison view, rendered as a tab within the existing `PnlDashboard`. Shows:

- **3 summary cards:** Revenue (targeted vs actual), Expenses (targeted vs actual), Net P&L (targeted vs actual) — with variance and trend indicators
- **Department cards:** One card per department, each containing a table with:
  - Revenue row (targeted, actual, variance, variance %)
  - Expense rows per category (same columns)
  - Net P&L row
- Color coding: green for favorable variance, red for unfavorable
- If no targets are set for the period, shows a placeholder message

---

### `PnlDepartmentTable` (modified)

**File:** `components/pnl/pnl-department-table.tsx`

Added an `allEditable?: boolean` prop. When `true`:

- **Revenue cells:** Removes the `auto` guard — all revenue cells become clickable even if auto-filled
- **Revenue badge:** Hides the "auto" lock badge
- **"Add expense row" button:** Hidden (targeted PnL uses fixed categories)
- **Expense cells:** Already editable when `canWrite` is true — no change needed

This change is backward-compatible: existing callers don't pass `allEditable`, so their behavior is unchanged.

---

### `PnlDashboard` (modified)

**File:** `components/pnl/pnl-dashboard.tsx`

Added `showTargetedComparison?: boolean` prop. When `true`, a "Targeted vs Actual" tab is appended to the tab navigation. Selecting it renders the `TargetedVsActualTab` component with the current date range.

---

## Pages

### `/finance/pnl/targeted` (new)

**File:** `app/finance/pnl/targeted/page.tsx`

The Finance Head's page for editing targets. Requires `pnl:write` permission. Renders `TargetedPnlDashboard`.

---

### `/md/pnl` (modified)

**File:** `app/md/pnl/page.tsx`

Now passes `showTargetedComparison={true}` to `PnlDashboard`, adding the "Targeted vs Actual" tab for the MD.

---

## Navigation

**File:** `lib/sidebar-nav.ts`

Added a new sidebar nav item:

```
Title: "Targeted P&L"
URL: /finance/pnl/targeted
Icon: Target
Permission: pnl:write
```

Visible to: `FINANCE_HEAD`, `MD`, `ADMIN` (same access as "Company P&L"). Also added to the MD's nav filter so it appears in their sidebar.

---

## Constants & Types

### `lib/pnl/constants.ts`

Added:
- `TARGET_PNL_SOURCE_KEYS` — `['REVENUE', 'SALARY', 'SEAT_COST', 'MARKETING', 'FREELANCERS', 'MISC']`
- `TargetPnlSourceKey` type

### `components/pnl/types.ts`

Added types for the targeted PnL data flow:

- `TargetPnlExpenseCategory` — per-category amounts + hints
- `TargetPnlDepartmentData` — per-department revenue, expenses, totals
- `TargetPnlOverviewData` — full API response shape
- `TargetVsActualRow` — comparison row with targeted/actual/variance
- `TargetVsActualDepartment` — per-department comparison
- `TargetVsActualData` — full comparison API response

---

## Data Flow

### Finance Head setting targets:

```
/finance/pnl/targeted
  -> TargetedPnlDashboard
    -> GET /api/pnl/targeted/overview (loads saved targets + hints)
    -> User clicks a cell, edits value
    -> POST /api/pnl/targeted/entries (upserts to TargetPnLEntry table)
    -> Query invalidation -> refetch
```

### MD viewing comparison:

```
/md/pnl -> "Targeted vs Actual" tab
  -> TargetedVsActualTab
    -> GET /api/pnl/targeted/comparison (loads both targeted + actual data)
    -> Renders side-by-side with variance calculations
```

---

## Access Control

| Role | Can edit targets? | Can view comparison? |
|------|-------------------|---------------------|
| Finance Head | Yes | Yes |
| MD | Yes | Yes |
| Admin | Yes | Yes |
| Others | No | No |
