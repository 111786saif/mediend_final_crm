'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  type CaseTrackerDateRange,
  type DateRangePreset,
  formatCaseTrackerDateRangeLabel,
  getDefaultCaseTrackerDateRange,
  resolvePresetRange,
} from '@/lib/case-tracker-date-range'
import { cn } from '@/lib/utils'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CaseTrackerDateRangeFilterProps {
  value: CaseTrackerDateRange
  onChange: (range: CaseTrackerDateRange) => void
  className?: string
}

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
]

export function CaseTrackerDateRangeFilter({
  value,
  onChange,
  className,
}: CaseTrackerDateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftPreset, setDraftPreset] = useState<DateRangePreset | 'custom' | null>(
    value.preset ?? 'custom'
  )
  const [draftFrom, setDraftFrom] = useState(value.fromDate ?? '')
  const [draftTo, setDraftTo] = useState(value.toDate ?? '')

  useEffect(() => {
    if (!open) return
    setDraftPreset(value.preset ?? (value.fromDate ? 'custom' : null))
    setDraftFrom(value.fromDate ?? '')
    setDraftTo(value.toDate ?? '')
  }, [open, value])

  const selectPreset = (preset: DateRangePreset) => {
    setDraftPreset(preset)
    const range = resolvePresetRange(preset)
    setDraftFrom(range.fromDate)
    setDraftTo(range.toDate)
  }

  const handleApply = () => {
    if (draftPreset && draftPreset !== 'custom') {
      const range = resolvePresetRange(draftPreset)
      onChange({ preset: draftPreset, fromDate: range.fromDate, toDate: range.toDate })
    } else if (draftFrom && draftTo) {
      onChange({ preset: 'custom', fromDate: draftFrom, toDate: draftTo })
    }
    setOpen(false)
  }

  const handleReset = () => {
    const defaults = getDefaultCaseTrackerDateRange()
    onChange(defaults)
    setDraftPreset(defaults.preset)
    setDraftFrom(defaults.fromDate ?? '')
    setDraftTo(defaults.toDate ?? '')
    setOpen(false)
  }

  const canApply =
    (draftPreset && draftPreset !== 'custom') || (Boolean(draftFrom) && Boolean(draftTo))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-9 w-[160px] justify-between px-3 font-normal', className)}
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate text-sm">{formatCaseTrackerDateRangeLabel(value)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">Date Range</p>
        </div>
        <div className="space-y-4 p-3">
          <RadioGroup
            value={draftPreset ?? ''}
            onValueChange={(v) => selectPreset(v as DateRangePreset)}
            className="gap-2"
          >
            {PRESET_OPTIONS.map(({ value: presetValue, label }) => (
              <div key={presetValue} className="flex items-center gap-2">
                <RadioGroupItem value={presetValue} id={`case-tracker-preset-${presetValue}`} />
                <Label htmlFor={`case-tracker-preset-${presetValue}`} className="cursor-pointer font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Custom Range</p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={draftFrom}
                onChange={(e) => {
                  setDraftPreset('custom')
                  setDraftFrom(e.target.value)
                }}
                className="h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={draftTo}
                onChange={(e) => {
                  setDraftPreset('custom')
                  setDraftTo(e.target.value)
                }}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 border-t pt-3">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={handleReset}>
              Reset
            </Button>
            <Button type="button" size="sm" className="flex-1" onClick={handleApply} disabled={!canApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
