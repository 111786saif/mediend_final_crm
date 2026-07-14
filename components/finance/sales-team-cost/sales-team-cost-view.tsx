'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { RoleCostNode } from '@/components/finance/sales-team-cost/role-cost-node'
import { BulkCostDialog } from '@/components/finance/sales-team-cost/bulk-cost-dialog'
import { BulkCostActivityDrawer } from '@/components/finance/sales-team-cost/bulk-cost-activity-drawer'
import type { BulkCostType } from '@/hooks/use-sales-team-bulk-costs'

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)

export function SalesTeamCostView() {
  const now = new Date()
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false

  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1))
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))
  const [bulkDialog, setBulkDialog] = useState<BulkCostType | null>(null)
  const [activityType, setActivityType] = useState<BulkCostType | null>(null)

  const filters = useMemo(
    () => ({
      month: Number(filterMonth),
      year: Number(filterYear),
    }),
    [filterMonth, filterYear],
  )

  const { data, isLoading, isError, refetch, isFetching, isPlaceholderData } =
    useSalesTeamCost(filters)

  const periodLabel = formatIncentiveMonthYear(filters.month, filters.year)
  const showRefreshOverlay = isFetching && (!!data || isPlaceholderData)

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if ((isError && !data) || !data) {
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
    <div className="relative space-y-6">
      {showRefreshOverlay && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/60 pt-24 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating sales team cost…
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Team Cost</h1>
          <p className="text-sm text-muted-foreground">
            Hierarchy: Sales Head → Category Manager → Team Leader → Business Developer. Salary
            defaults from Payroll and can be overridden here without changing Payroll; marketing and
            seating are sourced automatically; incentives come from the incentive module; misc and
            other costs are entered here in bulk.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canWrite && (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setBulkDialog('MISC')}
              >
                <Plus className="h-4 w-4" />
                Add Misc Cost
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setBulkDialog('OTHER')}
              >
                <Plus className="h-4 w-4" />
                Add Other Cost
              </Button>
            </>
          )}
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
        {isFetching ? ' · Updating…' : ''}
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
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
              <button
                type="button"
                className="rounded-md text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -m-1.5 p-1.5"
                onClick={() => setActivityType('MISC')}
                title="View Misc Cost activity"
              >
                <p className="text-xs text-muted-foreground">Misc</p>
                <p className="font-semibold underline decoration-dotted underline-offset-4">
                  {formatCurrency(summary.rollup.misc)}
                </p>
                {(summary.unallocated?.misc ?? 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    incl. {formatCurrency(summary.unallocated.misc)} unassigned
                  </p>
                )}
                <p className="text-[10px] text-primary">View activity</p>
              </button>
              <button
                type="button"
                className="rounded-md text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring -m-1.5 p-1.5"
                onClick={() => setActivityType('OTHER')}
                title="View Other Cost activity"
              >
                <p className="text-xs text-muted-foreground">Other</p>
                <p className="font-semibold underline decoration-dotted underline-offset-4">
                  {formatCurrency(summary.rollup.other)}
                </p>
                {(summary.unallocated?.other ?? 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    incl. {formatCurrency(summary.unallocated.other)} unassigned
                  </p>
                )}
                <p className="text-[10px] text-primary">View activity</p>
              </button>
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
            <RoleCostNode
              key={root.id}
              node={root}
              month={filters.month}
              year={filters.year}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      {bulkDialog && (
        <BulkCostDialog
          open={!!bulkDialog}
          onOpenChange={(open) => !open && setBulkDialog(null)}
          costType={bulkDialog}
          defaultMonth={filters.month}
          defaultYear={filters.year}
          onSaved={({ month, year }) => {
            setFilterMonth(String(month))
            setFilterYear(String(year))
          }}
        />
      )}

      {activityType && (
        <BulkCostActivityDrawer
          open={!!activityType}
          onOpenChange={(open) => !open && setActivityType(null)}
          costType={activityType}
          month={filters.month}
          year={filters.year}
        />
      )}
    </div>
  )
}
