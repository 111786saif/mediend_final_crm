'use client'

import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
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
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

interface FilterOption {
  label: string
  value: string
}

interface ColumnFilterProps {
  options?: FilterOption[] | string[]
  value?: any
  onChange: (value: any) => void
  type?: 'search' | 'multiSelect' | 'dateRange' | 'numberRange' | 'boolean' | 'text' | 'date'
  min?: number
  max?: number
  placeholder?: string
  trigger?: React.ReactNode
}

export function ColumnFilter({
  options = [],
  value,
  onChange,
  type = 'multiSelect',
  min,
  max,
  placeholder,
  trigger,
}: ColumnFilterProps) {
  // Normalize options to FilterOption[]
  const normalizedOptions = useMemo(() => {
    if (!options) return []
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt }
      }
      return { label: String(opt.label), value: String(opt.value) }
    })
  }, [options])

  const [selected, setSelected] = useState<string[]>([])
  const [tempSelected, setTempSelected] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Text search input state
  const [textSearch, setTextSearch] = useState('')
  const [tempTextSearch, setTempTextSearch] = useState('')

  // Date range state
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined)
  const [tempRange, setTempRange] = useState<DateRange | undefined>(undefined)

  // Number range state
  const [numMin, setNumMin] = useState<string>('')
  const [numMax, setNumMax] = useState<string>('')
  const [tempNumMin, setTempNumMin] = useState<string>('')
  const [tempNumMax, setTempNumMax] = useState<string>('')

  // Boolean state
  const [boolValue, setBoolValue] = useState<boolean | null>(null)
  const [tempBoolValue, setTempBoolValue] = useState<boolean | null>(null)

  const [open, setOpen] = useState(false)

  // Mapping types to legacy text/date formats
  const resolvedType = useMemo(() => {
    if (type === 'text') return 'multiSelect'
    if (type === 'date') return 'dateRange'
    return type
  }, [type])

  // Synchronize temp states when value changes or popover opens
  useEffect(() => {
    if (resolvedType === 'dateRange') {
      const range = value as DateRange | [string, string] | undefined
      if (Array.isArray(range)) {
        const fromVal = range[0] ? new Date(range[0]) : undefined
        const toVal = range[1] ? new Date(range[1]) : undefined
        setTempRange({ from: fromVal, to: toVal })
        setSelectedRange({ from: fromVal, to: toVal })
      } else {
        setTempRange(range)
        setSelectedRange(range)
      }
    } else if (resolvedType === 'numberRange') {
      const numRange = value as { min: number | null; max: number | null } | undefined
      const minStr = numRange?.min != null ? String(numRange.min) : ''
      const maxStr = numRange?.max != null ? String(numRange.max) : ''
      setTempNumMin(minStr)
      setTempNumMax(maxStr)
      setNumMin(minStr)
      setNumMax(maxStr)
    } else if (resolvedType === 'boolean') {
      setTempBoolValue(value as boolean | null)
      setBoolValue(value as boolean | null)
    } else if (resolvedType === 'search') {
      const strVal = (value as string) || ''
      setTempTextSearch(strVal)
      setTextSearch(strVal)
    } else {
      const arrVal = (value as string[]) || []
      setTempSelected(arrVal)
      setSelected(arrVal)
    }
  }, [value, resolvedType, open])

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
      setSearchQuery('')
    }
  }

  const handleCheckedChange = (optionValue: string, checked: boolean) => {
    setTempSelected((prev) =>
      checked ? [...prev, optionValue] : prev.filter((item) => item !== optionValue)
    )
  }

  const handleApply = () => {
    console.log('[ColumnFilter] Applying filters:', { resolvedType, tempSelected, tempRange, tempNumMin, tempNumMax, tempBoolValue, tempTextSearch })
    if (resolvedType === 'dateRange') {
      setSelectedRange(tempRange)
      if (tempRange?.from) {
        const fromStr = format(tempRange.from, 'yyyy-MM-dd')
        const toStr = tempRange.to ? format(tempRange.to, 'yyyy-MM-dd') : fromStr
        onChange([fromStr, toStr])
      } else {
        onChange([])
      }
    } else if (resolvedType === 'numberRange') {
      setNumMin(tempNumMin)
      setNumMax(tempNumMax)
      const minVal = tempNumMin ? Number(tempNumMin) : null
      const maxVal = tempNumMax ? Number(tempNumMax) : null
      onChange({ min: minVal, max: maxVal })
    } else if (resolvedType === 'boolean') {
      setBoolValue(tempBoolValue)
      onChange(tempBoolValue)
    } else if (resolvedType === 'search') {
      setTextSearch(tempTextSearch)
      onChange(tempTextSearch)
    } else {
      setSelected(tempSelected)
      onChange(tempSelected)
    }
    setOpen(false)
  }

  const handleClear = () => {
    console.log('[ColumnFilter] Clearing filters for:', resolvedType)
    if (resolvedType === 'dateRange') {
      setSelectedRange(undefined)
      setTempRange(undefined)
      onChange([])
    } else if (resolvedType === 'numberRange') {
      setNumMin('')
      setNumMax('')
      setTempNumMin('')
      setTempNumMax('')
      onChange(null)
    } else if (resolvedType === 'boolean') {
      setBoolValue(null)
      setTempBoolValue(null)
      onChange(null)
    } else if (resolvedType === 'search') {
      setTextSearch('')
      setTempTextSearch('')
      onChange('')
    } else {
      setSelected([])
      setTempSelected([])
      onChange([])
    }
    setOpen(false)
  }

  const filteredOptions = normalizedOptions.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isAllSelected = useMemo(() => {
    const targetOptions = searchQuery ? filteredOptions : normalizedOptions
    if (targetOptions.length === 0) return false
    return targetOptions.every((opt) => tempSelected.includes(opt.value))
  }, [searchQuery, filteredOptions, normalizedOptions, tempSelected])

  const handleSelectAllChange = (checked: boolean) => {
    const targetOptions = searchQuery ? filteredOptions : normalizedOptions
    const targetValues = targetOptions.map((opt) => opt.value)

    if (checked) {
      setTempSelected((prev) => {
        const next = [...prev]
        targetValues.forEach((val) => {
          if (!next.includes(val)) {
            next.push(val)
          }
        })
        return next
      })
    } else {
      setTempSelected((prev) => prev.filter((val) => !targetValues.includes(val)))
    }
  }

  const hasActiveFilters = useMemo(() => {
    if (resolvedType === 'dateRange') {
      return !!selectedRange?.from
    }
    if (resolvedType === 'numberRange') {
      return numMin !== '' || numMax !== ''
    }
    if (resolvedType === 'boolean') {
      return boolValue !== null
    }
    if (resolvedType === 'search') {
      return textSearch !== ''
    }
    return selected.length > 0
  }, [resolvedType, selectedRange, numMin, numMax, boolValue, textSearch, selected])

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center shrink-0 transition-colors ml-1 p-0.3 rounded-md border",
              hasActiveFilters
                ? "bg-teal-500/15 text-teal-700 hover:bg-teal-500/25 border-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400"
                : "border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5",
                hasActiveFilters ? "text-teal-700 dark:text-teal-400 font-bold" : "opacity-60"
              )}
            />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2 z-50">
        {resolvedType === 'dateRange' && (
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
              classNames={{
                day: "h-8 w-8 text-center text-sm p-0 relative focus-within:relative focus-within:z-20 data-[range-middle=true]:bg-[#95CCDD]/20 data-[range-middle=true]:text-[#95CCDD] data-[range-start=true]:bg-[#95CCDD] data-[range-start=true]:text-[#07112f] data-[range-end=true]:bg-[#95CCDD] data-[range-end=true]:text-[#07112f] data-[selected-single=true]:bg-[#95CCDD] data-[selected-single=true]:text-[#07112f]",
                today: "bg-accent text-accent-foreground",
                outside: "text-muted-foreground opacity-50",
                disabled: "text-muted-foreground opacity-50",
              }}
            />
          </div>
        )}

        {resolvedType === 'numberRange' && (
          <div className="flex flex-col gap-2 w-48 p-1">
            <span className="text-xs font-semibold text-muted-foreground">Range</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={min !== undefined ? `Min (${min})` : 'Min'}
                value={tempNumMin}
                onChange={(e) => setTempNumMin(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="number"
                placeholder={max !== undefined ? `Max (${max})` : 'Max'}
                value={tempNumMax}
                onChange={(e) => setTempNumMax(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {resolvedType === 'boolean' && (
          <div className="flex flex-col gap-1 w-40 p-1">
            <span className="text-xs font-semibold text-muted-foreground mb-1">Select option</span>
            {[
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ].map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.label}
                checked={tempBoolValue === opt.value}
                onCheckedChange={(checked) => {
                  if (checked) setTempBoolValue(opt.value)
                  else setTempBoolValue(null)
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        )}

        {resolvedType === 'search' && (
          <div className="flex flex-col gap-2 w-52 p-1">
            <Input
              type="text"
              placeholder={placeholder || 'Search...'}
              value={tempTextSearch}
              onChange={(e) => setTempTextSearch(e.target.value)}
              className="h-8 text-xs px-2"
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') handleApply()
              }}
            />
          </div>
        )}

        {resolvedType === 'multiSelect' && (
          <div className="flex flex-col gap-2 w-56">
            <Input
              type="text"
              placeholder="Search options..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs px-2"
              onKeyDown={(e) => e.stopPropagation()}
            />
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {normalizedOptions.length > 0 && (
                <>
                  <DropdownMenuCheckboxItem
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAllChange}
                    onSelect={(e) => e.preventDefault()}
                    className="font-semibold text-xs border-b border-muted rounded-none py-1.5"
                  >
                    Select All
                  </DropdownMenuCheckboxItem>
                </>
              )}
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={tempSelected.includes(option.value)}
                    onCheckedChange={(checked) => handleCheckedChange(option.value, checked)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {option.label}
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
