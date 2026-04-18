"use client"

import { useState } from "react"
import { Calendar as CalendarIcon, ArrowUpDown, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ComplianceCallSort } from "@/hooks/use-compliance-calls"
import { DateRangeSheet, formatDateRange, type DateRange } from "./date-range-sheet"

const SORT_OPTIONS: { value: ComplianceCallSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
]

interface Props {
  dateRange: DateRange
  onDateRangeChange: (r: DateRange) => void
  sort: ComplianceCallSort
  onSortChange: (s: ComplianceCallSort) => void
}

export function FilterBar({ dateRange, onDateRangeChange, sort, onSortChange }: Props) {
  const [dateOpen, setDateOpen] = useState(false)
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Recent"

  return (
    <div className="sticky top-0 z-20 -mx-1 flex items-center gap-2 border-b bg-background/90 px-1 py-2 backdrop-blur">
      <button
        type="button"
        onClick={() => setDateOpen(true)}
        className="flex min-w-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted active:scale-[0.98] transition"
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{formatDateRange(dateRange)}</span>
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted active:scale-[0.98] transition"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSortChange(opt.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted",
                sort === opt.value && "font-medium",
              )}
            >
              {opt.label}
              {sort === opt.value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <DateRangeSheet
        open={dateOpen}
        onOpenChange={setDateOpen}
        value={dateRange}
        onChange={onDateRangeChange}
      />
    </div>
  )
}
