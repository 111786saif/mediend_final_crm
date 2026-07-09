'use client'

import { useMemo, useState } from 'react'
import { Loader2, Users, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, MONTHS } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import { useSalesTeamCost } from '@/hooks/use-sales-team-cost'
import { RoleCostNode } from '@/components/finance/sales-team-cost/role-cost-node'

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)

export function SalesTeamCostView() {
  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1))
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))

  const filters = useMemo(
    () => ({
      month: Number(filterMonth),
      year: Number(filterYear),
    }),
    [filterMonth, filterYear],
  )

  const { data, isLoading, isError, refetch, isFetching } = useSalesTeamCost(filters)

  const periodLabel = formatIncentiveMonthYear(filters.month, filters.year)

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Failed to load sales team cost data.{' '}
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  const { summary, roots } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Team Cost</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchy: Sales Head → Category Manager → Team Leader → Business Developer. Salary and
            marketing are sourced automatically; incentives, seating, and misc costs come from their
            respective finance modules (approved only) and roll up through the hierarchy.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, i) => (
                <SelectItem key={label} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing costs for <span className="font-medium text-foreground">{periodLabel}</span>
        {isFetching && !isLoading ? ' · Updating…' : ''}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grand total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.grandTotal)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Headcount</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.headcount}</div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost breakdown</CardTitle>
            <CardDescription>Rolled up across the full hierarchy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Salary</p>
                <p className="font-semibold">{formatCurrency(summary.rollup.salary)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Incentives</p>
                <p className="font-semibold">{formatCurrency(summary.rollup.incentives)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Seating</p>
                <p className="font-semibold">{formatCurrency(summary.rollup.seating)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Misc</p>
                <p className="font-semibold">{formatCurrency(summary.rollup.misc)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Marketing (BD)</p>
                <p className="font-semibold">{formatCurrency(summary.rollup.marketing)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {roots.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No sales hierarchy found. Ensure active employees exist with Sales Head, Category Manager,
            Team Lead, or BD roles.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => (
            <RoleCostNode key={root.id} node={root} />
          ))}
        </div>
      )}
    </div>
  )
}
