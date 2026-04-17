'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { TargetVsActualData, TargetVsActualRow } from '@/components/pnl/types'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function formatPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function VarianceCell({ value, invert }: { value: number; invert?: boolean }) {
  const favorable = invert ? value <= 0 : value >= 0
  return (
    <TableCell
      className={cn(
        'text-right tabular-nums text-sm',
        favorable ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {value >= 0 ? '+' : ''}{formatInr(value)}
    </TableCell>
  )
}

function ComparisonRow({
  row,
  invertVariance,
  bold,
}: {
  row: TargetVsActualRow
  invertVariance?: boolean
  bold?: boolean
}) {
  return (
    <TableRow className={bold ? 'font-semibold bg-muted/30' : ''}>
      <TableCell className={bold ? 'font-semibold' : 'pl-6'}>{row.name}</TableCell>
      <TableCell className="text-right tabular-nums">{formatInr(row.totalTargeted)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatInr(row.totalActual)}</TableCell>
      <VarianceCell value={row.totalVariance} invert={invertVariance} />
      <TableCell
        className={cn(
          'text-right tabular-nums text-sm',
          (invertVariance ? row.totalVariancePct <= 0 : row.totalVariancePct >= 0)
            ? 'text-emerald-600'
            : 'text-rose-600'
        )}
      >
        {formatPct(row.totalVariancePct)}
      </TableCell>
    </TableRow>
  )
}

export function TargetedVsActualTab({
  startMonth,
  startYear,
  endMonth,
  endYear,
}: {
  startMonth: number
  startYear: number
  endMonth: number
  endYear: number
}) {
  const params = useMemo(
    () => `startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`,
    [startMonth, startYear, endMonth, endYear]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['targeted-vs-actual', params],
    queryFn: () => apiGet<TargetVsActualData>(`/api/pnl/targeted/comparison?${params}`),
  })

  if (isLoading || !data) {
    return <p className="text-muted-foreground py-12">Loading...</p>
  }

  const t = data.totals
  const hasTargets = t.targetedRevenue > 0 || t.targetedExpenses > 0

  if (!hasTargets) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">No targets set for this period</p>
        <p className="text-sm mt-1">Ask the Finance Head to set targets in the Targeted P&amp;L page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Revenue"
          targeted={t.targetedRevenue}
          actual={t.actualRevenue}
          favorableWhenPositive
        />
        <SummaryCard
          label="Expenses"
          targeted={t.targetedExpenses}
          actual={t.actualExpenses}
          favorableWhenPositive={false}
        />
        <SummaryCard
          label="Net P&L"
          targeted={t.targetedNet}
          actual={t.actualNet}
          favorableWhenPositive
        />
      </div>

      {/* Per-department breakdown */}
      <div className="space-y-4">
        {data.departments.map((dept) => (
          <Card key={dept.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{dept.name}</CardTitle>
                <span
                  className={cn(
                    'text-sm tabular-nums font-medium',
                    dept.net.totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}
                >
                  Net: {formatInr(dept.net.totalActual)} vs {formatInr(dept.net.totalTargeted)}
                  {' '}({dept.net.totalVariance >= 0 ? '+' : ''}{formatInr(dept.net.totalVariance)})
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[180px]">Category</TableHead>
                    <TableHead className="text-right">Targeted</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Var %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ComparisonRow row={dept.revenue} bold />
                  {dept.expenses.map((e) => (
                    <ComparisonRow key={e.sourceKey} row={e} invertVariance />
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>Net P&amp;L</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(dept.net.totalTargeted)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(dept.net.totalActual)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        dept.net.totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      {dept.net.totalVariance >= 0 ? '+' : ''}{formatInr(dept.net.totalVariance)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  targeted,
  actual,
  favorableWhenPositive,
}: {
  label: string
  targeted: number
  actual: number
  favorableWhenPositive: boolean
}) {
  const variance = actual - targeted
  const favorable = favorableWhenPositive ? variance >= 0 : variance <= 0

  return (
    <Card className="overflow-hidden border">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-baseline gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Targeted</p>
            <p className="text-lg font-bold tabular-nums">{formatInr(targeted)}</p>
          </div>
          <span className="text-muted-foreground">vs</span>
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-lg font-bold tabular-nums">{formatInr(actual)}</p>
          </div>
        </div>
        <div className={cn('mt-2 flex items-center gap-1 text-sm font-medium', favorable ? 'text-emerald-600' : 'text-rose-600')}>
          {favorable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {variance >= 0 ? '+' : ''}{formatInr(variance)}
        </div>
      </CardContent>
    </Card>
  )
}
