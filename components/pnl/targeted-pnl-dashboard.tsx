'use client'

import { useMemo, useState, useCallback } from 'react'
import type { DateRange } from 'react-day-picker'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { TabNavigation } from '@/components/employee/tab-navigation'
import {
  PnlDateRangePicker,
  dateRangeToMonthParams,
  defaultPnlDateRange,
} from '@/components/pnl/pnl-date-range-picker'
import { PnlSummaryCards } from '@/components/pnl/pnl-summary-cards'
import { PnlDepartmentTable } from '@/components/pnl/pnl-department-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TargetPnlOverviewData } from '@/components/pnl/types'
import { PNL_EXPENSE_SOURCE_KEYS } from '@/lib/pnl/constants'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

const QUERY_KEY = 'targeted-pnl-overview'

export function TargetedPnlDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => defaultPnlDateRange())
  const [tab, setTab] = useState('overall')
  const qc = useQueryClient()

  const { startMonth, startYear, endMonth, endYear } = useMemo(
    () => dateRangeToMonthParams(dateRange),
    [dateRange]
  )

  const params = useMemo(
    () => `startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`,
    [startMonth, startYear, endMonth, endYear]
  )

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => apiGet<TargetPnlOverviewData>(`/api/pnl/targeted/overview?${params}`),
  })

  const saveCell = useCallback(
    async (
      departmentKey: string,
      sourceKey: string,
      _monthKey: string,
      month: number,
      year: number,
      amount: number
    ) => {
      await apiPost('/api/pnl/targeted/entries', { departmentKey, sourceKey, month, year, amount })
      await qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      toast.success('Target saved')
    },
    [qc]
  )

  const deptTabMap: Record<string, string> = {
    surgery: 'SURGERY',
    it: 'IT',
    loan: 'LOAN_DEMAT',
    ads: 'GOOGLE_ADS',
  }

  const activeDeptKey = deptTabMap[tab]
  const activeDept = data?.departments.find((d) => d.key === activeDeptKey)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Targeted P&amp;L</h1>
          <p className="text-muted-foreground">
            Set revenue &amp; expense targets by department
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
          <p className="text-muted-foreground py-12">Loading...</p>
        ) : tab === 'overall' ? (
          <TargetedOverallView data={data} onDepartmentClick={(k) => {
            const tabKey = Object.entries(deptTabMap).find(([, v]) => v === k)?.[0]
            if (tabKey) setTab(tabKey)
          }} />
        ) : activeDept ? (
          <TargetedDeptView
            dept={activeDept}
            monthKeys={data.monthKeys}
            savedKeys={new Set(data.savedKeys)}
            onSave={saveCell}
          />
        ) : null}
      </div>
    </div>
  )
}

function TargetedOverallView({
  data,
  onDepartmentClick,
}: {
  data: TargetPnlOverviewData
  onDepartmentClick: (key: string) => void
}) {
  return (
    <div className="space-y-6">
      <PnlSummaryCards
        totalRevenue={data.totals.totalRevenue}
        totalExpenses={data.totals.totalExpenses}
        netPnL={data.totals.netPnL}
      />

      <Card>
        <CardHeader>
          <CardTitle>Department Targets</CardTitle>
          <CardDescription>Click a row to edit department targets</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Target Revenue</TableHead>
                <TableHead className="text-right">Target Expenses</TableHead>
                <TableHead className="text-right">Target Net P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.departments.map((d) => (
                <TableRow
                  key={d.key}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => onDepartmentClick(d.key)}
                >
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">
                    {formatInr(d.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-rose-700">
                    {formatInr(d.totalExpenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-medium',
                      d.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    )}
                  >
                    {formatInr(d.netPnL)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold bg-muted/40">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatInr(data.totals.totalRevenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatInr(data.totals.totalExpenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    data.totals.netPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  )}
                >
                  {formatInr(data.totals.netPnL)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function TargetedDeptView({
  dept,
  monthKeys,
  savedKeys,
  onSave,
}: {
  dept: TargetPnlOverviewData['departments'][0]
  monthKeys: string[]
  savedKeys: Set<string>
  onSave: (deptKey: string, srcKey: string, monthKey: string, month: number, year: number, amount: number) => Promise<void>
}) {
  // Map the targeted PnL data to the shape PnlDepartmentTable expects
  const revenueAmounts = dept.revenueByMonth
  const revenueAutoFilled: Record<string, boolean> = {}
  for (const k of monthKeys) {
    revenueAutoFilled[k] = !savedKeys.has(`${dept.key}-REVENUE-${k}`)
  }

  const expenseCategories = dept.expenseCategories.map((ec) => {
    const isAutoFilled: Record<string, boolean> = {}
    for (const k of monthKeys) {
      isAutoFilled[k] = !savedKeys.has(`${dept.key}-${ec.sourceKey}-${k}`)
    }
    return {
      categoryId: ec.sourceKey,
      name: ec.name,
      sourceKey: ec.sourceKey,
      departmentKey: dept.key,
      isSystem: true,
      amounts: ec.amounts,
      isAutoFilled,
      seatCostHint: ec.sourceKey === 'SEAT_COST' ? ec.hints : undefined,
      salaryHint: ec.sourceKey === 'SALARY' && dept.key === 'IT' ? ec.hints : undefined,
    }
  })

  const handleCellSave = async (
    categoryId: string, // this is sourceKey for targeted PnL
    monthKey: string,
    month: number,
    year: number,
    amount: number
  ) => {
    await onSave(dept.key, categoryId, monthKey, month, year, amount)
  }

  return (
    <div className="space-y-4">
      <PnlSummaryCards
        totalRevenue={dept.totalRevenue}
        totalExpenses={dept.totalExpenses}
        netPnL={dept.netPnL}
      />
      <PnlDepartmentTable
        monthKeys={monthKeys}
        departmentKey={dept.key}
        revenueCategoryId="REVENUE"
        revenueLabel={`${dept.name} Revenue`}
        revenueAmounts={revenueAmounts}
        revenueAutoFilled={revenueAutoFilled}
        expenseCategories={expenseCategories}
        canWrite={true}
        onCellSave={handleCellSave}
        onAddExpenseCategory={async () => {}}
        allEditable
      />
    </div>
  )
}
