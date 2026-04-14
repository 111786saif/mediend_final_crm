"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { addMonths, addDays, startOfDay, startOfWeek, addWeeks, isSameDay } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MONTHS_PER_CHUNK = 5

export interface DrawerDatePickerProps {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
  onClear?: () => void
  className?: string
  disablePast?: boolean
}

export function DrawerDatePicker({
  selected,
  onSelect,
  onClear,
  className,
  disablePast = false,
}: DrawerDatePickerProps) {
  const today = startOfDay(new Date())
  const [chunkCount, setChunkCount] = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const loadMore = useCallback(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    setChunkCount((c) => Math.min(c + 1, 24))
    requestAnimationFrame(() => {
      loadingRef.current = false
    })
  }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore, chunkCount])

  const quickOptions = [
    { label: "Today", get: () => today },
    { label: "Tomorrow", get: () => addDays(today, 1) },
    { label: "Next week", get: () => addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1) },
    { label: "This weekend", get: () => {
      const d = new Date(today)
      const day = d.getDay()
      const toSat = day === 0 ? 6 : 6 - day
      d.setDate(d.getDate() + toSat)
      return d
    } },
  ]

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap gap-2 mb-3">
        {quickOptions.map((opt) => {
          const date = opt.get()
          const active = selected && isSameDay(date, selected)
          return (
            <Button
              key={opt.label}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => onSelect(date)}
            >
              {opt.label}
            </Button>
          )
        })}
      </div>
      <div className="flex flex-col gap-6 w-full min-w-0">
        {Array.from({ length: chunkCount }, (_, i) => (
          <Calendar
            key={i}
            mode="single"
            selected={selected}
            onSelect={onSelect}
            defaultMonth={addMonths(today, i * MONTHS_PER_CHUNK)}
            numberOfMonths={MONTHS_PER_CHUNK}
            disabled={disablePast ? { before: today } : undefined}
            hideNavigation
            className={cn(
              "w-full max-w-full p-0 [--cell-size:2.75rem]",
              "in-data-[slot=calendar]:w-full"
            )}
            classNames={{
              root: "w-full",
              months: "flex flex-col gap-6",
              month: "flex flex-col w-full gap-3",
              nav: "hidden",
              month_caption: "flex w-full items-center justify-center px-0 text-base font-semibold",
              caption_label: "w-full text-center text-base font-semibold",
              weekdays: "flex w-full",
              weekday: "text-xs font-medium text-muted-foreground flex-1 text-center",
              week: "flex w-full mt-1",
              day: "relative flex-1 h-full p-0 text-center aspect-square select-none",
              today: "bg-primary/15 text-primary font-bold rounded-md",
            }}
          />
        ))}
        <div ref={sentinelRef} className="h-4 shrink-0" aria-hidden />
      </div>
      {onClear && selected && (
        <Button
          type="button"
          variant="ghost"
          className="w-full mt-4 text-base text-destructive"
          onClick={onClear}
        >
          Clear date
        </Button>
      )}
    </div>
  )
}
