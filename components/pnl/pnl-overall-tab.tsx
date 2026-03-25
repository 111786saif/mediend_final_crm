'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PnlSummaryCards } from '@/components/pnl/pnl-summary-cards'
import { PnlTrendChart, PnlRevenueDonut } from '@/components/pnl/pnl-charts'
import { PnlSankeyChart } from '@/components/pnl/pnl-sankey-chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PnlOverviewData } from '@/components/pnl/types'
import { cn } from '@/lib/utils'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function PnlOverallTab({
  data,
  onDepartmentClick,
  readOnly,
}: {
  data: PnlOverviewData
  onDepartmentClick: (key: string) => void
  readOnly?: boolean
}) {
  const grandRev = data.departments.reduce((s, d) => s + d.totalRevenue, 0)
  const grandExp = data.departments.reduce((s, d) => s + d.totalExpenses, 0)
  const grandNet = grandRev - grandExp
  const grandMargin = grandRev > 0 ? (grandNet / grandRev) * 100 : 0

  return (
    <div className="space-y-6">
      <PnlSummaryCards
        totalRevenue={data.totals.totalRevenue}
        totalExpenses={data.totals.totalExpenses}
        netPnL={data.totals.netPnL}
        readOnly={readOnly}
      />

      <Card>
        <CardHeader>
          <CardTitle>Revenue → P&amp;L flow</CardTitle>
          <CardDescription>Sankey view of revenue sources, net result, and expense mix</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <PnlSankeyChart data={data} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs expenses</CardTitle>
            <CardDescription>By month in range</CardDescription>
          </CardHeader>
          <CardContent>
            <PnlTrendChart chartSeries={data.chartSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue mix</CardTitle>
            <CardDescription>Department totals (full range)</CardDescription>
          </CardHeader>
          <CardContent>
            <PnlRevenueDonut revenueByDepartment={data.revenueByDepartment} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department P&amp;L</CardTitle>
          <CardDescription>Click a row to open detailed expense breakdown</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net P&amp;L</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
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
                  <TableCell className="text-right tabular-nums text-emerald-700">{formatInr(d.totalRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-700">{formatInr(d.totalExpenses)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-medium',
                      d.netPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    )}
                  >
                    {formatInr(d.netPnL)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {d.marginPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold bg-muted/40">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">{formatInr(grandRev)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInr(grandExp)}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    grandNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  )}
                >
                  {formatInr(grandNet)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{grandMargin.toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
