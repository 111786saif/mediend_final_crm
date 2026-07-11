'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { useMyTargetProgress } from '@/app/bd/dashboard/BDDashboard'

interface TrendPoint {
  label: string
  actual: number
}

interface TrendResponse {
  periodType: 'MONTH' | 'WEEK'
  metric: string
  points: TrendPoint[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="text-muted-foreground">
        Leads: <span className="font-semibold text-foreground">{payload[0].value}</span>
      </p>
    </div>
  )
}

/**
 * Leads-generated trend card — same visual language as TargetTrendCard,
 * but always tracks LEADS_GENERATED (leads received in the period) rather
 * than whatever metric the user's assigned Target uses. Most BDs don't
 * have a formal "leads" target, so this is a pure activity trend, no
 * target/percentage overlay.
 */
export function LeadsTrendCard() {
  const { user } = useAuth()
  const { isTargetRole } = useMyTargetProgress()
  const [periodType, setPeriodType] = useState<'MONTH' | 'WEEK'>('MONTH')

  const { data: trend, isLoading } = useQuery<TrendResponse>({
    queryKey: ['leads-trend', periodType, user?.id],
    queryFn: () =>
      apiGet<TrendResponse>(`/api/targets/trend?periodType=${periodType}&count=6&metric=LEADS_GENERATED`),
    enabled: !!user?.id && isTargetRole,
  })

  if (!isTargetRole) return null

  const total = trend?.points?.reduce((sum, p) => sum + p.actual, 0) ?? 0

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      {/* Header: title + Monthly/Weekly toggle */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold">Leads Trend</h2>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(['MONTH', 'WEEK'] as const).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPeriodType(pt)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                periodType === pt
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {pt === 'MONTH' ? 'Monthly' : 'Weekly'}
            </button>
          ))}
        </div>
      </div>

      {/* Total summary */}
      <div className="mb-3 flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">
          leads over the last 6 {periodType === 'MONTH' ? 'months' : 'weeks'}
        </span>
      </div>

      {/* Trend chart */}
      <div className="h-[180px]">
        {isLoading ? (
          <div className="h-full w-full rounded-lg bg-muted animate-pulse" />
        ) : trend?.points?.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend.points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.08)' }} />
              <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={28} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No lead data yet for this period
          </div>
        )}
      </div>
    </div>
  )
}