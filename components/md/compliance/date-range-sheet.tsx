"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export interface DateRange {
  from?: Date
  to?: Date
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: DateRange
  onChange: (range: DateRange) => void
}

const PRESETS: { label: string; resolve: () => DateRange }[] = [
  {
    label: "Today",
    resolve: () => {
      const d = new Date()
      return { from: d, to: d }
    },
  },
  {
    label: "Last 7 days",
    resolve: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 6)
      return { from, to }
    },
  },
  {
    label: "Last 30 days",
    resolve: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 29)
      return { from, to }
    },
  },
  {
    label: "This month",
    resolve: () => {
      const now = new Date()
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
    },
  },
  {
    label: "Last month",
    resolve: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from, to }
    },
  },
  { label: "All time", resolve: () => ({}) },
]

export function formatDateRange(range: DateRange): string {
  if (!range.from && !range.to) return "All time"
  const f = (d?: Date) => (d ? format(d, "d MMM") : "")
  if (range.from && range.to) {
    if (range.from.toDateString() === range.to.toDateString()) return f(range.from)
    return `${f(range.from)} – ${f(range.to)}`
  }
  return f(range.from ?? range.to)
}

export function DateRangeSheet({ open, onOpenChange, value, onChange }: Props) {
  const [draft, setDraft] = useState<DateRange>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const apply = () => {
    onChange(draft)
    onOpenChange(false)
  }

  const clear = () => {
    setDraft({})
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl sm:max-w-md sm:mx-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Date range
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const r = p.resolve()
              const active =
                (r.from?.toDateString() ?? "") === (draft.from?.toDateString() ?? "") &&
                (r.to?.toDateString() ?? "") === (draft.to?.toDateString() ?? "")
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDraft(r)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition active:scale-[0.98]",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="flex justify-center rounded-lg border">
            <Calendar
              mode="range"
              selected={{ from: draft.from, to: draft.to }}
              onSelect={(r) => setDraft({ from: r?.from, to: r?.to })}
              numberOfMonths={1}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clear}>
              Clear
            </Button>
            <Button className="flex-1" onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
