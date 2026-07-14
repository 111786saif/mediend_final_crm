'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  emptyLabel?: string
  /** When true, empty selection means "all" */
  emptyMeansAll?: boolean
}

export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className,
  emptyLabel = 'All',
  emptyMeansAll = true,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const allSelected = selected.length === 0
  const showAll = emptyMeansAll && allSelected

  const triggerLabel = useMemo(() => {
    if (showAll) return emptyLabel
    if (selected.length === options.length) return emptyLabel
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? placeholder
    }
    return `${selected.length} selected`
  }, [showAll, selected, options, emptyLabel, placeholder])

  const isChecked = (value: string) => allSelected || selected.includes(value)

  const toggle = (value: string) => {
    if (allSelected) {
      onChange(options.map((o) => o.value).filter((v) => v !== value))
      return
    }
    if (selected.includes(value)) {
      const next = selected.filter((v) => v !== value)
      onChange(next.length === options.length ? [] : next)
    } else {
      const next = [...selected, value]
      onChange(next.length === options.length ? [] : next)
    }
  }

  const selectAll = () => onChange([])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={selectAll}
          >
            Select all
          </button>
          {!showAll && selected.length > 0 && (
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          )}
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No matches</p>
          ) : (
            filtered.map((opt) => {
              const checked = isChecked(opt.value)
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(opt.value)}
                  />
                  <span className="truncate">{opt.label}</span>
                  {checked && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </label>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
