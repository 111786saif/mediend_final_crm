'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import type { DateRange } from 'react-day-picker'

interface ColumnFilterProps {
  options: string[]
  onChange: (selected: string[]) => void
  type?: 'text' | 'date'
}

export function ColumnFilter({ options, onChange, type = 'text' }: ColumnFilterProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [tempSelected, setTempSelected] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // For date range
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined)

  const [open, setOpen] = useState(false)

  const getQuickRange = (range: 'current' | '3months' | '6months') => {
    const now = new Date()
    let from: Date
    let to: Date = now

    if (range === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (range === '3months') {
      from = new Date(now)
      from.setMonth(now.getMonth() - 3)
    } else {
      from = new Date(now)
      from.setMonth(now.getMonth() - 6)
    }
    from.setHours(0, 0, 0, 0)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }

  const isRangeActive = (range: 'current' | '3months' | '6months') => {
    if (!tempRange?.from || !tempRange?.to) return false
    const expected = getQuickRange(range)
    const isSameDate = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()

    return isSameDate(tempRange.from, expected.from) && isSameDate(tempRange.to, expected.to)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      if (type === 'date') {
        setTempRange(selectedRange)
      } else {
        setTempSelected(selected)
        setSearchQuery('') // Clear search query when dropdown opens
      }
    }
  }

  const handleCheckedChange = (option: string, checked: boolean) => {
    setTempSelected((prev) =>
      checked ? [...prev, option] : prev.filter((item) => item !== option)
    )
  }

  const handleApply = () => {
    if (type === 'date') {
      setSelectedRange(tempRange)
      if (tempRange?.from) {
        const fromStr = tempRange.from.toISOString()
        const toStr = tempRange.to ? tempRange.to.toISOString() : fromStr
        onChange([fromStr, toStr])
      } else {
        onChange([])
      }
    } else {
      setSelected(tempSelected)
      onChange(tempSelected)
    }
    setOpen(false)
  }

  const handleClear = () => {
    if (type === 'date') {
      setSelectedRange(undefined)
      setTempRange(undefined)
      onChange([])
    } else {
      setSelected([])
      setTempSelected([])
      onChange([])
    }
    setOpen(false)
  }

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hasActiveFilters = type === 'date'
    ? !!selectedRange?.from
    : selected.length > 0

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center p-1 ml-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 ${
              hasActiveFilters ? 'text-primary font-bold' : 'opacity-60'
            }`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2 z-50">
        {type === 'date' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1.5 px-1 pt-1 border-b pb-2">
              <Button
                variant={isRangeActive('current') ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2 py-0 font-medium"
                onClick={() => {
                  const { from, to } = getQuickRange('current')
                  setTempRange({ from, to })
                }}
              >
                Current Month
              </Button>
              <Button
                variant={isRangeActive('3months') ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2 py-0 font-medium"
                onClick={() => {
                  const { from, to } = getQuickRange('3months')
                  setTempRange({ from, to })
                }}
              >
                3 Months
              </Button>
              <Button
                variant={isRangeActive('6months') ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2 py-0 font-medium"
                onClick={() => {
                  const { from, to } = getQuickRange('6months')
                  setTempRange({ from, to })
                }}
              >
                6 Months
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-56">
            <Input
              type="text"
              placeholder="Search options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs px-2"
              onKeyDown={(e) => e.stopPropagation()} // Prevent closing on keyboard interaction (e.g., Space)
            />
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={tempSelected.includes(option)}
                    onCheckedChange={(checked) => handleCheckedChange(option, checked)}
                    onSelect={(e) => e.preventDefault()} // Prevent closing when clicking checkbox
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
