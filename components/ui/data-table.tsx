'use client'

import { useState, useMemo } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  OnChangeFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: TData) => void
  enablePagination?: boolean
  initialPageSize?: number
  pageSizeOptions?: number[]
  enableExport?: boolean
  exportFilename?: string
  onExport?: (data: TData[]) => void
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  footer?: React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No results found.',
  onRowClick,
  enablePagination = false,
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  enableExport = false,
  exportFilename = 'export.csv',
  onExport,
  columnVisibility,
  onColumnVisibilityChange,
  footer,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [localColumnVisibility, setLocalColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const visibilityState = columnVisibility !== undefined ? columnVisibility : localColumnVisibility
  const onVisibilityChangeState = onColumnVisibilityChange !== undefined ? onColumnVisibilityChange : setLocalColumnVisibility

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility: visibilityState,
      pagination: enablePagination ? pagination : undefined,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: onVisibilityChangeState,
    onPaginationChange: enablePagination ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
  })

  // Default CSV export handler
  const handleExport = () => {
    if (onExport) {
      onExport(data)
      return
    }

    // Fallback: Default CSV generation
    const exportableCols = columns.filter((col) => {
      const colId = col.id || (col as any).accessorKey
      return colId !== 'actions' && colId !== 'select'
    })

    const headers = exportableCols.map((col) => {
      if (typeof col.header === 'string') return col.header
      return col.id || (col as any).accessorKey || 'Column'
    })

    const rows = data.map((row) =>
      exportableCols.map((col) => {
        const key = (col as any).accessorKey || col.id
        const val = (row as any)[key]
        if (val === null || val === undefined) return ''
        return typeof val === 'object' ? JSON.stringify(val) : String(val)
      })
    )

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', exportFilename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {/* Table Toolbar controls: Columns Visibility dropdown & CSV Export */}
      {(enableExport || !columnVisibility) && (
        <div className="flex items-center justify-end gap-2 px-4 py-1">
          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 gap-2 border-indigo-200 hover:bg-indigo-50/50 dark:border-indigo-850 dark:hover:bg-indigo-950/20"
            >
              <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Export CSV</span>
            </Button>
          )}

          {!columnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-8 gap-2 border-indigo-200 hover:bg-indigo-50/50 dark:border-indigo-850 dark:hover:bg-indigo-950/20"
                >
                  <Settings2 className="h-4 w-4 text-slate-500" />
                  <span>Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-h-[min(60vh,380px)] overflow-y-auto">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => {
                    const colName = typeof col.columnDef.header === 'string'
                      ? col.columnDef.header
                      : col.id
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        className="capitalize"
                        checked={col.getIsVisible()}
                        onCheckedChange={(value) => col.toggleVisibility(!!value)}
                      >
                        {colName}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Main Table Content */}
      <div className="rounded-md border border-slate-200/60 dark:border-slate-800/40 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/60 hover:bg-slate-50/60 dark:bg-slate-900/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-slate-200/50 dark:border-slate-800/30">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.columnDef.size }}
                      className="text-slate-600 dark:text-slate-300 font-semibold px-4 py-3"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading Skeleton Rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100 dark:border-slate-900/60">
                    {columns.map((col, j) => (
                      <TableCell key={j} className="h-12 px-4 py-3">
                        <div className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse w-full max-w-[85%]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "border-b border-slate-100 dark:border-slate-900/40 transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-slate-50/30 dark:hover:bg-slate-900/20" : "hover:bg-transparent"
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3 text-sm font-normal text-slate-800 dark:text-slate-200">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground px-4 py-8"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {footer}
          </Table>
        </div>
      </div>

      {/* Pagination Controls Footer */}
      {enablePagination && !isLoading && table.getPageCount() > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded border border-slate-200/80 bg-background px-2 text-sm focus:outline-none dark:border-slate-800"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
