'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function PnlSummaryCards({
  totalRevenue,
  totalExpenses,
  netPnL,
  readOnly,
}: {
  totalRevenue: number
  totalExpenses: number
  netPnL: number
  readOnly?: boolean
}) {
  const positive = netPnL >= 0
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        className={cn(
          'overflow-hidden border-0 text-white shadow-lg',
          'bg-gradient-to-br from-emerald-500 to-emerald-700'
        )}
      >
        <CardContent className="p-6">
          <p className="text-sm font-medium text-emerald-100">Total revenue</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{formatInr(totalRevenue)}</p>
          <p className="mt-1 text-xs text-emerald-200">From all revenue lines</p>
        </CardContent>
      </Card>
      <Card
        className={cn('overflow-hidden border-0 text-white shadow-lg', 'bg-gradient-to-br from-rose-500 to-rose-700')}
      >
        <CardContent className="p-6">
          <p className="text-sm font-medium text-rose-100">Total expenses</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{formatInr(totalExpenses)}</p>
          <p className="mt-1 text-xs text-rose-200">Including salary & ops</p>
        </CardContent>
      </Card>
      <Card
        className={cn(
          'overflow-hidden border-0 text-white shadow-lg',
          positive ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-gradient-to-br from-amber-500 to-amber-700'
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium opacity-90">Net P&amp;L</p>
            {positive ? (
              <TrendingUp className="h-5 w-5 opacity-90" />
            ) : (
              <TrendingDown className="h-5 w-5 opacity-90" />
            )}
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight">{formatInr(netPnL)}</p>
          <p className="mt-1 text-xs opacity-90">{positive ? 'Profit' : 'Loss'} {readOnly ? '(view only)' : ''}</p>
        </CardContent>
      </Card>
    </div>
  )
}
