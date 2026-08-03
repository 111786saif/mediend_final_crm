"use client"

import { cn } from "@/lib/utils"
import * as React from "react"
import { ChevronDown } from "lucide-react"
import { ColumnFilter } from "@/components/ui/column-filter"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getTextContent(children: React.ReactNode): string {
  if (children === null || children === undefined) return ""
  if (typeof children === "string" || typeof children === "number") return String(children)
  if (typeof children === "boolean") return ""
  if (Array.isArray(children)) return children.map(getTextContent).join(" ")
  if (React.isValidElement(children)) {
    return getTextContent((children as React.ReactElement<any>).props.children)
  }
  return ""
}

function isDateColumn(label: string, values: string[]): boolean {
  const normalizedLabel = label.toLowerCase()
  if (
    normalizedLabel.includes("date") ||
    normalizedLabel.includes("time") ||
    normalizedLabel.includes("created") ||
    normalizedLabel.includes("updated") ||
    normalizedLabel.includes("admission") ||
    normalizedLabel.includes("surgery") ||
    normalizedLabel.includes("discharge") ||
    normalizedLabel.includes("received") ||
    normalizedLabel.includes("processed")
  ) {
    return true
  }

  const parseableDateCount = values.filter((value) => {
    const parsed = new Date(value)
    return !Number.isNaN(parsed.getTime())
  }).length

  return values.length > 0 && parseableDateCount / values.length > 0.7
}

function normalizeHeaderLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

interface TableFilterContextType {
  registerHeader: (colIndex: number, text: string) => void
  registerCell: (rowIndex: number, colIndex: number, text: string) => void
  unregisterRow: (rowIndex: number) => void
  columnOptions: Record<number, string[]>
  activeFilters: Record<number, string[]>
  setFilter: (colIndex: number, selected: string[]) => void
  isRowFiltered: (rowIndex: number) => boolean
  filterableHeaders?: Set<string>
}

const TableFilterContext = React.createContext<TableFilterContextType | null>(null)

function CrmDateColumnFilter({
  value,
  onChange,
}: {
  value?: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tempDate, setTempDate] = React.useState<Date | undefined>(undefined)

  const selectedDate = React.useMemo(() => {
    const firstValue = value?.[0]
    const nextDate = firstValue ? new Date(firstValue) : undefined
    return nextDate && !Number.isNaN(nextDate.getTime()) ? nextDate : undefined
  }, [value])

  const hasActiveFilter = Boolean(selectedDate)

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setTempDate(selectedDate)
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 ${hasActiveFilter ? "font-bold text-primary" : "opacity-60"}`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-50 w-auto p-2">
        <div className="flex flex-col gap-2">
          <Calendar mode="single" selected={tempDate} onSelect={setTempDate} initialFocus />
          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTempDate(undefined)
                onChange([])
                setOpen(false)
              }}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (tempDate) {
                  const isoValue = tempDate.toISOString()
                  onChange([isoValue, isoValue])
                } else {
                  onChange([])
                }
                setOpen(false)
              }}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Apply
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Table({
  className,
  filterableHeaders,
  rowIds,
  onVisibleRowIdsChange,
  ...props
}: React.ComponentProps<"table"> & {
  filterableHeaders?: string[]
  rowIds?: string[]
  onVisibleRowIdsChange?: (rowIds: string[]) => void
}) {
  const [columnOptions, setColumnOptions] = React.useState<Record<number, string[]>>({})
  const [activeFilters, setActiveFilters] = React.useState<Record<number, string[]>>({})

  const headersRef = React.useRef<Record<number, string>>({})
  const cellsRef = React.useRef<Record<number, Record<number, string>>>({})

  const registerHeader = React.useCallback((colIndex: number, text: string) => {
    headersRef.current[colIndex] = text
  }, [])

  const registerCell = React.useCallback((rowIndex: number, colIndex: number, text: string) => {
    if (!cellsRef.current[rowIndex]) {
      cellsRef.current[rowIndex] = {}
    }
    cellsRef.current[rowIndex][colIndex] = text
  }, [])

  const unregisterRow = React.useCallback((rowIndex: number) => {
    delete cellsRef.current[rowIndex]
  }, [])

  const filterableHeaderSet = React.useMemo(
    () =>
      filterableHeaders && filterableHeaders.length > 0
        ? new Set(filterableHeaders.map(normalizeHeaderLabel))
        : undefined,
    [filterableHeaders]
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const currentCells = cellsRef.current
    const options: Record<number, string[]> = {}

    Object.keys(currentCells).forEach((rowKey) => {
      const rowIndex = Number(rowKey)
      const row = currentCells[rowIndex]
      Object.keys(row).forEach((colKey) => {
        const colIndex = Number(colKey)
        const value = (row[colIndex] || "").trim()
        if (!value) return
        if (!options[colIndex]) {
          options[colIndex] = []
        }
        if (!options[colIndex].includes(value)) {
          options[colIndex].push(value)
        }
      })
    })

    Object.keys(options).forEach((colKey) => {
      const colIndex = Number(colKey)
      options[colIndex].sort((left, right) => left.localeCompare(right))
    })

    let hasChanged = false
    const previousKeys = Object.keys(columnOptions)
    const nextKeys = Object.keys(options)

    if (previousKeys.length !== nextKeys.length) {
      hasChanged = true
    } else {
      for (const key of nextKeys) {
        const colIndex = Number(key)
        const previousOptions = columnOptions[colIndex] || []
        const nextOptions = options[colIndex] || []
        if (
          previousOptions.length !== nextOptions.length ||
          previousOptions.some((value, index) => value !== nextOptions[index])
        ) {
          hasChanged = true
          break
        }
      }
    }

    if (hasChanged) {
      setColumnOptions(options)
    }
  })

  const setFilter = React.useCallback((colIndex: number, selected: string[]) => {
    setActiveFilters((prev) => ({
      ...prev,
      [colIndex]: selected,
    }))
  }, [])

  const isRowFiltered = React.useCallback((rowIndex: number) => {
    const rowCells = cellsRef.current[rowIndex]
    if (!rowCells) return false

    for (const key of Object.keys(activeFilters)) {
      const colIndex = Number(key)
      const filterValues = activeFilters[colIndex]
      if (!filterValues || filterValues.length === 0) continue

      const cellValue = (rowCells[colIndex] || "").trim()
      const headerText = headersRef.current[colIndex] || ""
      const options = columnOptions[colIndex] || []
      const dateColumn = isDateColumn(headerText, options)

      if (dateColumn && filterValues.length === 2) {
        const [startStr, endStr] = filterValues
        const cellDate = new Date(cellValue)
        if (Number.isNaN(cellDate.getTime())) {
          return true
        }

        const start = new Date(startStr)
        const end = new Date(endStr)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)

        const time = cellDate.getTime()
        if (time < start.getTime() || time > end.getTime()) {
          return true
        }
      } else if (!filterValues.includes(cellValue)) {
        return true
      }
    }

    return false
  }, [activeFilters, columnOptions])

  React.useEffect(() => {
    if (!onVisibleRowIdsChange) return

    const nextVisibleRowIds = (rowIds ?? []).filter((rowId, rowIndex) => {
      if (!rowId) return false
      return !isRowFiltered(rowIndex)
    })

    onVisibleRowIdsChange(nextVisibleRowIds)
  }, [isRowFiltered, onVisibleRowIdsChange, rowIds])

  const contextValue = React.useMemo(() => ({
    registerHeader,
    registerCell,
    unregisterRow,
    columnOptions,
    activeFilters,
    setFilter,
    isRowFiltered,
    filterableHeaders: filterableHeaderSet,
  }), [registerHeader, registerCell, unregisterRow, columnOptions, activeFilters, setFilter, isRowFiltered, filterableHeaderSet])

  return (
    <TableFilterContext.Provider value={contextValue}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    </TableFilterContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const context = React.useContext(TableFilterContext)

  const children = React.useMemo(() => {
    if (!context) return props.children
    return React.Children.map(props.children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === TableRow || (child.type as any)?.name === "TableRow") {
          return React.cloneElement(child as React.ReactElement<any>, { isHeader: true })
        }
      }
      return child
    })
  }, [props.children, context])

  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    >
      {children}
    </thead>
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  const context = React.useContext(TableFilterContext)

  const children = React.useMemo(() => {
    if (!context) return props.children
    let rowIndex = 0
    return React.Children.map(props.children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === TableRow || (child.type as any)?.name === "TableRow") {
          const currentIndex = rowIndex++
          return React.cloneElement(child as React.ReactElement<any>, { rowIndex: currentIndex })
        }
      }
      return child
    })
  }, [props.children, context])

  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    >
      {children}
    </tbody>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({
  className,
  rowIndex,
  isHeader,
  ...props
}: React.ComponentProps<"tr"> & { rowIndex?: number; isHeader?: boolean }) {
  const context = React.useContext(TableFilterContext)

  const children = React.useMemo(() => {
    if (!context) return props.children
    let colIndex = 0
    return React.Children.map(props.children, (child) => {
      if (React.isValidElement(child)) {
        if (
          child.type === TableCell ||
          child.type === TableHead ||
          (child.type as any)?.name === "TableCell" ||
          (child.type as any)?.name === "TableHead"
        ) {
          const currentIndex = colIndex++
          return React.cloneElement(child as React.ReactElement<any>, {
            rowIndex,
            colIndex: currentIndex,
            isHeader,
          })
        }
      }
      return child
    })
  }, [props.children, context, rowIndex, isHeader])

  const isFiltered = context && rowIndex !== undefined && context.isRowFiltered(rowIndex)

  React.useEffect(() => {
    return () => {
      if (context && rowIndex !== undefined) {
        context.unregisterRow(rowIndex)
      }
    }
  }, [context, rowIndex])

  return (
    <tr
      data-slot="table-row"
      className={cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", className)}
      style={isFiltered ? { display: "none" } : undefined}
      {...props}
    >
      {children}
    </tr>
  )
}

function hasColumnFilter(node: React.ReactNode): boolean {
  if (node === null || node === undefined) return false
  if (React.isValidElement(node)) {
    if (node.type === ColumnFilter || (node.type as any)?.name === "ColumnFilter") {
      return true
    }
    const children = (node as React.ReactElement<any>).props?.children
    if (children) {
      if (Array.isArray(children)) {
        return children.some(hasColumnFilter)
      }
      return hasColumnFilter(children)
    }
  }
  if (Array.isArray(node)) {
    return node.some(hasColumnFilter)
  }
  return false
}

function TableHead({
  className,
  colIndex,
  rowIndex,
  isHeader,
  ...props
}: React.ComponentProps<"th"> & { colIndex?: number; rowIndex?: number; isHeader?: boolean }) {
  const context = React.useContext(TableFilterContext)
  const headerText = React.useMemo(() => getTextContent(props.children).trim(), [props.children])

  React.useEffect(() => {
    if (context && colIndex !== undefined && headerText) {
      context.registerHeader(colIndex, headerText)
    }
  }, [context, colIndex, headerText])

  const filterComponent = React.useMemo(() => {
    if (!context || colIndex === undefined || !headerText) return null

    const skipKeywords = ["action", "edit", "delete", "select", "checkbox", "options", "view"]
    const normalized = headerText.toLowerCase()
    if (skipKeywords.some((keyword) => normalized.includes(keyword))) {
      return null
    }

    if (context.filterableHeaders && !context.filterableHeaders.has(normalizeHeaderLabel(headerText))) {
      return null
    }

    if (hasColumnFilter(props.children)) return null

    const options = context.columnOptions[colIndex] || []
    if (options.length <= 1) return null

    const dateColumn = isDateColumn(headerText, options)
    if (dateColumn) {
      return (
        <CrmDateColumnFilter
          value={context.activeFilters[colIndex]}
          onChange={(selected) => context.setFilter(colIndex, selected)}
        />
      )
    }

    return (
      <ColumnFilter
        type="text"
        options={options}
        value={context.activeFilters[colIndex]}
        onChange={(selected) => context.setFilter(colIndex, selected as string[])}
      />
    )
  }, [context, colIndex, headerText, props.children])

  const isRight = className?.includes("text-right")
  const isCenter = className?.includes("text-center")

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-1",
          isRight ? "justify-end" : isCenter ? "justify-center" : "justify-between"
        )}
      >
        <span>{props.children}</span>
        {filterComponent}
      </div>
    </th>
  )
}

function TableCell({
  className,
  rowIndex,
  colIndex,
  ...props
}: React.ComponentProps<"td"> & { rowIndex?: number; colIndex?: number; isHeader?: boolean }) {
  const context = React.useContext(TableFilterContext)
  const cellText = React.useMemo(() => getTextContent(props.children).trim(), [props.children])

  React.useEffect(() => {
    if (context && rowIndex !== undefined && colIndex !== undefined) {
      context.registerCell(rowIndex, colIndex, cellText)
    }
  }, [context, rowIndex, colIndex, cellText])

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
}
