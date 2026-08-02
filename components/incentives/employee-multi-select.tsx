'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type EmployeeOption = {
  id: string
  employeeCode: string
  name: string
  department: string | null
}

interface EmployeeMultiSelectProps {
  employees: EmployeeOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = 'Select employees',
  disabled,
}: EmployeeMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.department?.toLowerCase().includes(q) ?? false),
    )
  }, [employees, search])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: string) => {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedSet.has(e.id))

  const triggerLabel =
    selectedIds.length === 0
      ? placeholder
      : `${selectedIds.length} employee${selectedIds.length === 1 ? '' : 's'} selected`

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={cn('truncate', selectedIds.length === 0 && 'text-muted-foreground')}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        portalled={false}
      >
        <div className="border-b p-2">
          <Input
            placeholder="Search by name, ID, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex items-center justify-between border-b px-2 py-1">
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              if (allFilteredSelected) {
                const remove = new Set(filtered.map((e) => e.id))
                onChange(selectedIds.filter((id) => !remove.has(id)))
              } else {
                const merged = new Set([...selectedIds, ...filtered.map((e) => e.id)])
                onChange(Array.from(merged))
              }
            }}
          >
            {allFilteredSelected ? 'Clear filtered' : 'Select filtered'}
          </Button>
        </div>
        <div
          className="max-h-48 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No employees found</p>
          ) : (
            filtered.map((emp) => (
              <div
                key={emp.id}
                role="option"
                aria-selected={selectedSet.has(emp.id)}
                className="flex w-full cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted/60"
                onClick={() => toggle(emp.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(emp.id)
                  }
                }}
                tabIndex={0}
              >
                <Checkbox
                  checked={selectedSet.has(emp.id)}
                  className="pointer-events-none mt-0.5"
                  tabIndex={-1}
                  aria-hidden
                />
                <span className="min-w-0 text-sm leading-snug">
                  <span className="font-medium">{emp.name}</span>
                  <span className="text-muted-foreground"> · {emp.employeeCode}</span>
                  {emp.department && (
                    <span className="block truncate text-xs text-muted-foreground">{emp.department}</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
