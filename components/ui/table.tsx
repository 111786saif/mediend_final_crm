"use client"

import { cn } from "@/lib/utils"
import * as React from "react"
import { ColumnFilter } from "./column-filter"

// Helper function to extract text recursively from React elements
function getTextContent(children: React.ReactNode): string {
  if (children === null || children === undefined) return ""
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }
  if (typeof children === "boolean") return ""
  if (Array.isArray(children)) {
    return children.map(getTextContent).join(" ")
  }
  if (React.isValidElement(children)) {
    return getTextContent((children as React.ReactElement<any>).props.children)
  }
  return ""
}

// Helper to determine if a column mostly contains date values
function isDateColumn(label: string, values: string[]): boolean {
  const normalizedLabel = label.toLowerCase()
  if (
    normalizedLabel.includes("date") ||
    normalizedLabel.includes("time") ||
    normalizedLabel.includes("created") ||
    normalizedLabel.includes("updated") ||
    normalizedLabel.includes("admission") ||
    normalizedLabel.includes("surgery") ||
    normalizedLabel.includes("discharge")
  ) {
    return true
  }

  // Regex to check patterns like YYYY-MM-DD or DD-MM-YYYY or similar
  const datePattern = /^\d{4}-\d{2}-\d{2}/
  const slashPattern = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/

  const validDateCount = values.filter(
    (v) => datePattern.test(v) || slashPattern.test(v)
  ).length
  if (values.length > 0 && validDateCount / values.length > 0.7) {
    return true
  }

  return false
}

interface TableFilterContextType {
  registerHeader: (colIndex: number, text: string) => void
  registerCell: (rowIndex: number, colIndex: number, text: string) => void
  unregisterRow: (rowIndex: number) => void
  columnOptions: Record<number, string[]>
  activeFilters: Record<number, string[]>
  setFilter: (colIndex: number, selected: string[]) => void
  isRowFiltered: (rowIndex: number) => boolean
}

const TableFilterContext = React.createContext<TableFilterContextType | null>(null)

function Table({ className, ...props }: React.ComponentProps<"table">) {
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

  // Sync cells options to state on changes/renders without loops
  React.useEffect(() => {
    const currentCells = cellsRef.current
    const options: Record<number, string[]> = {}

    Object.keys(currentCells).forEach((rKey) => {
      const rIdx = Number(rKey)
      const row = currentCells[rIdx]
      Object.keys(row).forEach((cKey) => {
        const cIdx = Number(cKey)
        const val = (row[cIdx] || "").trim()
        if (val) {
          if (!options[cIdx]) {
            options[cIdx] = []
          }
          if (!options[cIdx].includes(val)) {
            options[cIdx].push(val)
          }
        }
      })
    })

    // Sort options
    Object.keys(options).forEach((cKey) => {
      const cIdx = Number(cKey)
      options[cIdx].sort((a, b) => a.localeCompare(b))
    })

    // Compare options with current state
    let hasChanged = false
    const prevKeys = Object.keys(columnOptions)
    const newKeys = Object.keys(options)

    if (prevKeys.length !== newKeys.length) {
      hasChanged = true
    } else {
      for (const key of newKeys) {
        const idx = Number(key)
        const prevOpt = columnOptions[idx] || []
        const newOpt = options[idx] || []
        if (prevOpt.length !== newOpt.length || prevOpt.some((v, i) => v !== newOpt[i])) {
          hasChanged = true
          break
        }
      }
    }

    if (hasChanged) {
      setColumnOptions(options)
    }
  }) // runs after every commit, compares values to prevent infinite loops

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
      const isDate = isDateColumn(headerText, options)

      if (isDate && filterValues.length === 2) {
        const [startStr, endStr] = filterValues
        const cellDate = new Date(cellValue)
        if (!isNaN(cellDate.getTime())) {
          const start = new Date(startStr)
          const end = new Date(endStr)
          start.setHours(0, 0, 0, 0)
          end.setHours(23, 59, 59, 999)
          const t = cellDate.getTime()
          if (t < start.getTime() || t > end.getTime()) {
            return true // Filtered out
          }
        } else {
          return true // Invalid date, filter out
        }
      } else {
        if (!filterValues.includes(cellValue)) {
          return true // Filtered out
        }
      }
    }

    return false
  }, [activeFilters, columnOptions])

  const contextValue = React.useMemo(() => ({
    registerHeader,
    registerCell,
    unregisterRow,
    columnOptions,
    activeFilters,
    setFilter,
    isRowFiltered,
  }), [registerHeader, registerCell, unregisterRow, columnOptions, activeFilters, setFilter, isRowFiltered])

  return (
    <TableFilterContext.Provider value={contextValue}>
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
      >
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
          const currentIdx = rowIndex++
          return React.cloneElement(child as React.ReactElement<any>, { rowIndex: currentIdx })
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
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
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
          const currentIdx = colIndex++
          return React.cloneElement(child as React.ReactElement<any>, {
            rowIndex,
            colIndex: currentIdx,
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
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      style={isFiltered ? { display: "none" } : undefined}
      {...props}
    >
      {children}
    </tr>
  )
}

// Helper to recursively check if children tree contains a ColumnFilter element
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

    // Skip filters for columns like Actions, Edit, Delete, Checkbox
    const skipKeywords = ["action", "edit", "delete", "select", "checkbox", "options", "status", "view"]
    const normalized = headerText.toLowerCase()
    if (skipKeywords.some((kw) => normalized.includes(kw))) {
      return null
    }

    // Check if children already contains a ColumnFilter to prevent duplicates
    if (hasColumnFilter(props.children)) return null

    const options = context.columnOptions[colIndex] || []
    if (options.length <= 1) return null

    const isDate = isDateColumn(headerText, options)

    return (
      <ColumnFilter
        type={isDate ? "date" : "text"}
        options={options}
        onChange={(selected) => context.setFilter(colIndex, selected)}
      />
    )
  }, [context, colIndex, headerText, props.children])

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-1">
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
  isHeader,
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

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table, TableBody, TableCaption, TableCell, TableFooter,
  TableHead, TableHeader, TableRow
}

