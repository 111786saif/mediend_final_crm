'use client'

import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import {
  PnlDateRangePicker,
  dateRangeToMonthParams,
  defaultPnlDateRange,
} from '@/components/pnl/pnl-date-range-picker'
import { PnlSurgeryTab } from '@/components/pnl/pnl-surgery-tab'

/** Same body as the Surgery tab on Company P&L, without other tabs or overview fetch. */
export function SalesPnlView() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => defaultPnlDateRange())

  const { startMonth, startYear, endMonth, endYear } = useMemo(
    () => dateRangeToMonthParams(dateRange),
    [dateRange]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sales P&amp;L</h1>
          <p className="text-muted-foreground">Surgery revenue, teams, and BD breakdown (read-only)</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:max-w-md lg:w-auto shrink-0">
          <span className="text-xs text-muted-foreground">Period</span>
          <PnlDateRangePicker value={dateRange} onChange={setDateRange} className="w-full max-w-full" />
        </div>
      </div>

      <div className="pt-2">
        <PnlSurgeryTab
          startMonth={startMonth}
          startYear={startYear}
          endMonth={endMonth}
          endYear={endYear}
        />
      </div>
    </div>
  )
}
