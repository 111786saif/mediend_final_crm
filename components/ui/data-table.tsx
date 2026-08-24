'use client'

import { useState, useRef } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
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
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, ChevronLeft, ChevronRight, Settings2, GripVertical } from 'lucide-react'
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
  /** Controlled column order. When provided, overrides the internal drag-reorder state. */
  columnOrder?: ColumnOrderState
  /** Called when the user drag-reorders columns in the Columns dropdown. */
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>
  footer?: React.ReactNode
  pageCount?: number
  paginationState?: { pageIndex: number; pageSize: number }
  onPaginationChange?: OnChangeFn<{ pageIndex: number; pageSize: number }>
  tableHeaderClassName?: string
  tableContainerClassName?: string
  rowClassName?: (row: TData) => string | undefined
  className?: string
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
  columnOrder,
  onColumnOrderChange,
  footer,
  pageCount,
  paginationState,
  onPaginationChange,
  tableHeaderClassName,
  tableContainerClassName,
  rowClassName,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [localColumnVisibility, setLocalColumnVisibility] = useState<VisibilityState>({})
  const [localPagination, setLocalPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })
  const [internalColumnOrder, setInternalColumnOrder] = useState<ColumnOrderState>([])

  // Drag-and-drop refs for the columns dropdown
  const dragColId = useRef<string | null>(null)
  const dragOverColId = useRef<string | null>(null)

  const visibilityState = columnVisibility !== undefined ? columnVisibility : localColumnVisibility
  const onVisibilityChangeState = onColumnVisibilityChange !== undefined ? onColumnVisibilityChange : setLocalColumnVisibility

  // Controlled vs internal column order
  const activeColumnOrder = columnOrder !== undefined ? columnOrder : internalColumnOrder
  const setActiveColumnOrder = onColumnOrderChange !== undefined ? onColumnOrderChange : setInternalColumnOrder

  const pagination = paginationState !== undefined ? paginationState : localPagination
  const onPaginationChangeState = onPaginationChange !== undefined ? onPaginationChange : setLocalPagination

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    manualPagination: pageCount !== undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility: visibilityState,
      columnOrder: activeColumnOrder,
      pagination: enablePagination ? pagination : undefined,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: onVisibilityChangeState,
    onColumnOrderChange: setActiveColumnOrder,
    onPaginationChange: enablePagination ? onPaginationChangeState : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pageCount !== undefined ? undefined : (enablePagination ? getPaginationRowModel() : undefined),
  })

  // Handle drag-and-drop reordering in the columns panel
  const handleDragStart = (colId: string) => {
    dragColId.current = colId
  }

  const handleDragEnter = (colId: string) => {
    dragOverColId.current = colId
  }

  const handleDragEnd = () => {
    const from = dragColId.current
    const to = dragOverColId.current
    if (!from || !to || from === to) {
      dragColId.current = null
      dragOverColId.current = null
      return
    }

    // Build ordered list from current table column order
    const currentOrder = table.getAllLeafColumns().map((c) => c.id)
    const fromIdx = currentOrder.indexOf(from)
    const toIdx = currentOrder.indexOf(to)
    if (fromIdx === -1 || toIdx === -1) return

    const newOrder = [...currentOrder]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, from)
    setActiveColumnOrder(newOrder)

    dragColId.current = null
    dragOverColId.current = null
  }

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
    <div className={cn("space-y-4 w-full", className)}>
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
              <DropdownMenuContent
                align="end"
                className="w-56 max-h-[min(60vh,380px)] overflow-y-auto p-0"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div className="px-2 py-1.5">
                  <DropdownMenuLabel className="px-0 py-0.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Toggle &amp; Reorder Columns
                  </DropdownMenuLabel>
                </div>
                <DropdownMenuSeparator className="my-0" />
                <div className="py-1">
                  {table
                    .getAllColumns()
                    .filter((col) => col.getCanHide())
                    .map((col) => {
                      const colName =
                        typeof col.columnDef.header === 'string'
                          ? col.columnDef.header
                          : col.id
                      return (
                        <div
                          key={col.id}
                          draggable
                          onDragStart={() => handleDragStart(col.id)}
                          onDragEnter={() => handleDragEnter(col.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-default select-none group"
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            id={`col-toggle-${col.id}`}
                            checked={col.getIsVisible()}
                            onChange={(e) => col.toggleVisibility(e.target.checked)}
                            className="h-4 w-4 rounded border border-input accent-primary cursor-pointer shrink-0"
                          />
                          {/* Label */}
                          <label
                            htmlFor={`col-toggle-${col.id}`}
                            className="flex-1 text-sm capitalize cursor-pointer truncate"
                          >
                            {colName}
                          </label>
                          {/* Drag handle — always visible */}
                          <span
                            className="cursor-grab active:cursor-grabbing shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </div>
                      )
                    })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Main Table Content */}
      <div className={cn("rounded-md border border-border bg-card overflow-hidden", tableContainerClassName)}>
        <Table containerClassName="overflow-auto flex-1 min-h-0 h-full">
          <TableHeader className={cn("bg-muted/50 border-b border-border sticky top-0 z-20", tableHeaderClassName)}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ 
                        width: header.column.columnDef.size, 
                        ...((header.column.columnDef.meta as any)?.headerStyle) 
                      }}
                      className={cn(
                        "text-muted-foreground font-semibold px-4 py-3 sticky top-0 z-10",
                        header.colSpan > 1 && "text-center border-x border-border", // Grouped header centering
                        (header.column.columnDef.meta as any)?.headerClassName
                      )}
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
                  <TableRow key={i} className="border-b border-border">
                    {columns.map((col, j) => (
                      <TableCell key={j} className="h-12 px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse w-full max-w-[85%]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "border-b border-border transition-colors",
                      onRowClick && "cursor-pointer",
                      rowClassName ? rowClassName(row.original) : (onRowClick ? "hover:bg-muted/50" : "hover:bg-muted/30")
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const cellStyle = typeof (cell.column.columnDef.meta as any)?.cellStyle === 'function'
                        ? (cell.column.columnDef.meta as any).cellStyle(row.original)
                        : (cell.column.columnDef.meta as any)?.cellStyle

                      const cellClassName = typeof (cell.column.columnDef.meta as any)?.cellClassName === 'function'
                        ? (cell.column.columnDef.meta as any).cellClassName(row.original)
                        : (cell.column.columnDef.meta as any)?.cellClassName

                      return (
                        <TableCell 
                          key={cell.id} 
                          className={cn(
                            "px-4 py-3 text-sm font-normal text-foreground",
                            cellClassName
                          )}
                          style={cellStyle}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      )
                    })}
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

      {/* Pagination Controls Footer */}
      {enablePagination && !isLoading && table.getPageCount() > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 rounded border border-border bg-background text-foreground px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
            <span className="text-sm font-medium text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-foreground"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-foreground"
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
