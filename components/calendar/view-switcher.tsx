'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalendarView } from './team-calendar'
import { format, addMonths, addWeeks, addDays } from 'date-fns'

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
]

export function ViewSwitcher({
  view,
  onViewChange,
  focusedDate,
  onFocusedDateChange,
}: {
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  focusedDate: Date
  onFocusedDateChange: (d: Date) => void
}) {
  const shift = (dir: 1 | -1) => {
    if (view === 'month') onFocusedDateChange(addMonths(focusedDate, dir))
    else if (view === 'week') onFocusedDateChange(addWeeks(focusedDate, dir))
    else onFocusedDateChange(addDays(focusedDate, dir))
  }

  const label =
    view === 'month'
      ? format(focusedDate, 'MMMM yyyy')
      : view === 'week'
        ? `Week of ${format(focusedDate, 'MMM d')}`
        : format(focusedDate, 'EEE, d')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
          onClick={() => shift(-1)}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center text-sm font-semibold truncate">{label}</div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
          onClick={() => shift(1)}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl shrink-0"
          onClick={() => onFocusedDateChange(new Date())}
        >
          Today
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className={cn(
              'h-8 rounded-lg text-xs font-semibold transition-colors',
              view === v.key
                ? 'bg-background text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
