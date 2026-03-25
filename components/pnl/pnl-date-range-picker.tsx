'use client'

import * as React from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function dateRangeToMonthParams(range: DateRange | undefined): {
  startMonth: number
  startYear: number
  endMonth: number
  endYear: number
} {
  if (!range?.from) {
    const d = new Date()
    return {
      startMonth: d.getMonth() + 1,
      startYear: d.getFullYear(),
      endMonth: d.getMonth() + 1,
      endYear: d.getFullYear(),
    }
  }
  const from = range.from
  const to = range.to ?? range.from
  let sm = from.getMonth() + 1
  let sy = from.getFullYear()
  let em = to.getMonth() + 1
  let ey = to.getFullYear()
  if (sy > ey || (sy === ey && sm > em)) {
    ;[sm, sy, em, ey] = [em, ey, sm, sy]
  }
  return { startMonth: sm, startYear: sy, endMonth: em, endYear: ey }
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return 'Select period'
  const from = range.from
  const to = range.to ?? range.from
  if (from.getTime() === to.getTime()) {
    return format(from, 'dd MMM yyyy')
  }
  return `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`
}

export function PnlDateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange | undefined
  onChange: (next: DateRange | undefined) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [months, setMonths] = React.useState(1)

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setMonths(mq.matches ? 2 : 1)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'justify-start text-left font-normal min-w-[240px] md:min-w-[280px]',
            !value?.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{formatRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] p-0 overflow-x-auto" align="end">
        <Calendar
          mode="range"
          defaultMonth={value?.from ?? new Date()}
          selected={value}
          onSelect={(r) => {
            onChange(r)
            if (r?.from && r?.to) setOpen(false)
          }}
          numberOfMonths={months}
        />
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const d = new Date()
              onChange({ from: startOfMonth(d), to: endOfMonth(d) })
              setOpen(false)
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Default: current calendar month */
export function defaultPnlDateRange(): DateRange {
  const d = new Date()
  return { from: startOfMonth(d), to: endOfMonth(d) }
}
