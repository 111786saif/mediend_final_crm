'use client'

import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { TabNavigation } from '@/components/employee/tab-navigation'
import {
  PnlDateRangePicker,
  dateRangeToMonthParams,
  defaultPnlDateRange,
} from '@/components/pnl/pnl-date-range-picker'
import { PnlOverallTab } from '@/components/pnl/pnl-overall-tab'
import { PnlDepartmentDrawer } from '@/components/pnl/pnl-department-drawer'
import { PnlSurgeryTab } from '@/components/pnl/pnl-surgery-tab'
import { PnlItTab } from '@/components/pnl/pnl-it-tab'
import { PnlDeptTab } from '@/components/pnl/pnl-dept-tab'
import type { PnlOverviewData } from '@/components/pnl/types'

export function PnlDashboard({
  canWritePnl,
  canWriteLoanDemat,
  queryKeyPrefix = 'pnl-overview',
}: {
  /** pnl:write — Google Ads tab & department expense drawers */
  canWritePnl: boolean
  /** loan-demat:write — Loan & Demat tab entries */
  canWriteLoanDemat?: boolean
  queryKeyPrefix?: string
}) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => defaultPnlDateRange())
  const [tab, setTab] = useState('overall')

  const { startMonth, startYear, endMonth, endYear } = useMemo(
    () => dateRangeToMonthParams(dateRange),
    [dateRange]
  )

  const params = useMemo(
    () => `startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`,
    [startMonth, startYear, endMonth, endYear]
  )

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, params],
    queryFn: () => apiGet<PnlOverviewData>(`/api/pnl/overview?${params}`),
  })

  const [deptDrawer, setDeptDrawer] = useState<string | null>(null)
  const dept = data?.departments.find((d) => d.key === deptDrawer) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Company P&amp;L</h1>
          <p className="text-muted-foreground">
            Unified revenue, expenses, and drill-downs {canWritePnl ? '' : '(read-only)'}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:max-w-md lg:w-auto shrink-0">
          <span className="text-xs text-muted-foreground">Period</span>
          <PnlDateRangePicker value={dateRange} onChange={setDateRange} className="w-full max-w-full" />
        </div>
      </div>

      <TabNavigation
        variant="pnl"
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'overall', label: 'Overall' },
          { value: 'surgery', label: 'Surgery' },
          { value: 'it', label: 'IT' },
          { value: 'loan', label: 'Loan & Demat' },
          { value: 'ads', label: 'Google Ads' },
        ]}
      />

      <div className="pt-2">
        {isLoading || !data ? (
          <p className="text-muted-foreground py-12">Loading…</p>
        ) : tab === 'overall' ? (
          <PnlOverallTab
            data={data}
            onDepartmentClick={(k) => setDeptDrawer(k)}
            readOnly={!canWritePnl}
          />
        ) : tab === 'surgery' ? (
          <PnlSurgeryTab
            startMonth={startMonth}
            startYear={startYear}
            endMonth={endMonth}
            endYear={endYear}
          />
        ) : tab === 'it' ? (
          <PnlItTab
            startMonth={startMonth}
            startYear={startYear}
            endMonth={endMonth}
            endYear={endYear}
          />
        ) : tab === 'loan' ? (
          <PnlDeptTab
            mode="LOAN_DEMAT"
            startYear={startYear}
            endYear={endYear}
            canEdit={!!canWriteLoanDemat}
          />
        ) : (
          <PnlDeptTab
            mode="GOOGLE_ADS"
            startYear={startYear}
            endYear={endYear}
            canEdit={canWritePnl}
          />
        )}
      </div>

      <PnlDepartmentDrawer
        open={!!deptDrawer}
        onOpenChange={(o) => !o && setDeptDrawer(null)}
        department={dept}
        overview={data ?? null}
        canWrite={canWritePnl}
        queryKeyPrefix={queryKeyPrefix}
      />
    </div>
  )
}
