---
name: tanstack-table-migration
description: Instructions for migrating legacy manual Table structures to the unified, generic, and flexible DataTable component built on TanStack React Table v8. Ensures zero regressions in UI, state management, or functionality.
---

# TanStack DataTable Migration Guide

This skill documents the standard operating procedure (SOP) for migrating legacy, hard-coded `<Table>` components to the highly flexible, headless `@/components/ui/data-table.tsx` built on TanStack React Table v8.

**Goal**: Seamlessly replace legacy table markup with the unified `DataTable` without breaking any existing UI layouts, column filters, pagination, or math calculations (like footers).

---

## 1. Prerequisites & Component API

Ensure the target project already has the unified `DataTable` component located at `components/ui/data-table.tsx`. 

The `DataTable` accepts the following key props:
- `columns`: The array of TanStack `ColumnDef` objects.
- `data`: The raw data array to display.
- `searchKey`: (Optional) The primary column ID used for a global or default search filter.
- `onRowClick`: (Optional) Callback when a table row is clicked.
- `loading`: (Optional) Boolean to render skeleton rows when data is fetching.
- `enablePagination`: (Optional) Boolean to show the pagination footer.
- `enableColumnVisibility`: (Optional) Boolean to show the "View" dropdown.
- `footer`: (Optional) React Node to inject custom footer rows (essential for live calculations).
- `onColumnVisibilityChange`: (Optional) Function to sync visibility state (e.g., local storage).
- `initialColumnVisibility`: (Optional) Initial state object for column visibility.

---

## 2. Migration Steps (The 10-Year Vet Approach)

When migrating a complex dashboard page to the `DataTable`, follow these precise steps to guarantee zero regressions.

### Phase A: Setup the Columns Schema
Legacy tables usually map over an array in the JSX and hard-code `TableHead` and `TableCell` elements. You must extract this into a `useMemo` array of `ColumnDef`.

1. **Import TanStack Types**:
   ```tsx
   import { ColumnDef } from "@tanstack/react-table";
   ```
2. **Define the `columns` array**:
   Extract all column headers and their corresponding cell logic into a `useMemo` block inside the main component.
   *Crucial*: If the legacy table uses `ColumnFilter` for column headers, port them directly into the `header` render function.

   ```tsx
   const columns = useMemo<ColumnDef<YourDataType>[]>(() => [
     {
       accessorKey: "date",
       header: () => (
         <ColumnFilter
           columnName="Date"
           filterValue={filters.date}
           setFilterValue={(val) => setFilters(prev => ({ ...prev, date: val }))}
         />
       ),
       cell: ({ row }) => <div>{formatDate(row.original.date)}</div>,
     },
     // ... repeat for all legacy columns
   ], [filters, otherDependencies]); // Don't forget dependencies!
   ```

### Phase B: Handle Column Visibility & Persistence
If the legacy table persists column visibility to local storage, you must ensure the update function handles TanStack's `Updater<VisibilityState>` pattern.

1. **Adapt the Setter**:
   TanStack can pass a functional updater (e.g., `(old) => newState`). Modify the `persistCols` or `setCols` function to handle both raw objects and updater functions:
   ```tsx
   const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialCols);

   const persistCols = (updaterOrValue: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
     const newValue = typeof updaterOrValue === "function" 
       ? updaterOrValue(columnVisibility) 
       : updaterOrValue;
     
     setColumnVisibility(newValue);
     localStorage.setItem("myPageCols", JSON.stringify(newValue));
   };
   ```

### Phase C: Preserve the Footer Math
Many financial or CRM dashboards have a complex `<TableFooter>` that calculates live totals across the filtered data.
**Do not rewrite the math logic.**

1. Extract the legacy `<TableFooter>` block.
2. Pass it exactly as-is into the `footer` prop of the `DataTable`.
3. The `<DataTable>` is designed to render `<tbody>` and then optionally render `{footer}` directly below it, keeping DOM structures valid.

### Phase D: The JSX Swap
Replace the hundreds of lines of legacy `<Table>`, `<TableHeader>`, `<TableBody>`, and `<TableRow>` markup with the single generic component.

```tsx
<DataTable
  columns={columns}
  data={filteredData} // Pass the data *after* external filters are applied
  searchKey="name" // Optional
  loading={isLoading}
  enablePagination={true}
  enableColumnVisibility={true}
  initialColumnVisibility={columnVisibility}
  onColumnVisibilityChange={persistCols} // Uses the adapted function from Phase B
  footer={<MyLegacyFooterComponent data={filteredData} />} // Injects calculations safely
/>
```

---

## 3. QA & Anti-Regression Checklist

Before considering the migration complete, verify the following:
- [ ] **CSS & Layout**: Does the table stretch properly? Is horizontal scrolling preserved on overflow?
- [ ] **State Integrity**: Do external custom filters (like `ColumnFilter` with checkboxes/dates) still trigger state changes without re-mounting the entire table? (Verify `useMemo` dependencies).
- [ ] **Math Totals**: If a footer exists, do the totals recalculate correctly when external filters are applied?
- [ ] **Local Storage**: Toggle a column off. Refresh the page. Does it stay off?
- [ ] **Types**: Did you use strict typing for the `ColumnDef<T>` instead of `any`?

## 4. Best Practices
- **Keep `DataTable` Headless-ish**: The `DataTable` component should not know about specific business logic (like date parsing or currency formatting). All of that belongs in the `columns` definition within the page component.
- **Exporting**: If the page has an "Export to CSV" button, use the `DataTable`'s underlying API or keep the external export function. If moving export logic inside `DataTable`, ensure it can access the currently filtered/sorted rows.
