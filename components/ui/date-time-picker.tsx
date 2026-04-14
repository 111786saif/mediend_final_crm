'use client'

import * as React from 'react'
import { format, isValid, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function combineDateAndTime(day: Date, hour: number, minute: number): Date {
  const next = new Date(day)
  next.setHours(hour, minute, 0, 0)
  return next
}

export interface DateTimePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  disabled?: boolean
  className?: string
  /** Modal popover + higher z-index for Drawer / Sheet (stacking above z-50 overlays). */
  nested?: boolean
  id?: string
  'aria-labelledby'?: string
  /** Disable selecting dates before today. */
  disablePast?: boolean
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  className,
  nested,
  id,
  'aria-labelledby': ariaLabelledBy,
  disablePast,
}: DateTimePickerProps) {
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const [open, setOpen] = React.useState(false)
  const [hour, setHour] = React.useState(10)
  const [minute, setMinute] = React.useState(0)

  React.useEffect(() => {
    if (value && isValid(value)) {
      setHour(value.getHours())
      setMinute(value.getMinutes())
    }
  }, [value])

  const hasDate = Boolean(value && isValid(value))
  const calendarDay = hasDate ? startOfDay(value!) : undefined

  const onDaySelect = (day: Date | undefined) => {
    if (!day) {
      onChange(undefined)
      return
    }
    onChange(combineDateAndTime(startOfDay(day), hour, minute))
  }

  const selectZ = nested ? 'z-[110]' : undefined
  const popoverZ = nested ? 'z-[100]' : undefined

  return (
    <Popover modal={Boolean(nested)} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            'w-full justify-start text-left font-normal',
            !hasDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          {hasDate ? format(value!, 'PPP · p') : <span>Pick date & time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn('w-auto p-0', popoverZ)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={calendarDay}
            onSelect={onDaySelect}
            defaultMonth={calendarDay ?? new Date()}
            disabled={disablePast ? { before: today } : undefined}
            modifiersClassNames={{
              today:
                '[&>button]:bg-blue-600 [&>button]:text-white [&>button]:font-semibold [&>button]:hover:bg-blue-700 [&>button]:hover:text-white',
            }}
            className="p-2 sm:p-3"
          />
          <div
            className={cn(
              'flex flex-col gap-2 border-t p-3 sm:w-[148px] sm:border-t-0 sm:border-l',
              'border-border'
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">Time</p>
            <div className="flex items-center gap-1.5">
              <Select
                value={String(hour)}
                onValueChange={(v) => {
                  const h = Number.parseInt(v, 10)
                  setHour(h)
                  if (hasDate) {
                    onChange(combineDateAndTime(startOfDay(value!), h, minute))
                  }
                }}
                disabled={!hasDate}
              >
                <SelectTrigger className="h-9 flex-1" aria-label="Hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn('max-h-60', selectZ)}>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-sm">:</span>
              <Select
                value={String(minute)}
                onValueChange={(v) => {
                  const m = Number.parseInt(v, 10)
                  setMinute(m)
                  if (hasDate) {
                    onChange(combineDateAndTime(startOfDay(value!), hour, m))
                  }
                }}
                disabled={!hasDate}
              >
                <SelectTrigger className="h-9 flex-1" aria-label="Minute">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn('max-h-60', selectZ)}>
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {String(m).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
