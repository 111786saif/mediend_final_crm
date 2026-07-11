'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Progress } from '@/components/ui/progress'
import { Target, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMyTargetProgress } from '@/app/bd/dashboard/BDDashboard'
import { useAuth } from '@/hooks/use-auth'

interface TrendPoint {
  label: string
  metric: string
  actual: number
  targetValue: number
  percentage: number
  hasTarget: boolean
}

interface TrendResponse {
  periodType: 'MONTH' | 'WEEK'
  metric: string
  points: TrendPoint[]
}

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPDs',
  SURGERIES_DONE: 'Surgeries',
  LEADS_CLOSED: 'Leads Closed',
  LEADS_GENERATED: 'Leads Generated',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
  REVENUE: 'Revenue',
  HEAD_COUNT: 'Hires',
}

function fmtVal(value: number, metric: string) {
  if (['NET_PROFIT', 'BILL_AMOUNT', 'REVENUE'].includes(metric)) {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
    return `₹${value}`
  }
  return String(value)
}

function CustomTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as TrendPoint
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="text-muted-foreground">
        Achieved: <span className="font-semibold text-foreground">{fmtVal(p.actual, metric)}</span>
      </p>
      {p.hasTarget && (
        <p className="text-muted-foreground">
          Target: <span className="font-semibold text-foreground">{fmtVal(p.targetValue, metric)}</span>
        </p>
      )}
    </div>
  )
}

export function TargetTrendCard() {
  const { user } = useAuth()
  const { isTargetRole, monthly, weekly } = useMyTargetProgress()
  const [periodType, setPeriodType] = useState<'MONTH' | 'WEEK'>('MONTH')

  const { data: trend, isLoading } = useQuery<TrendResponse>({
    queryKey: ['target-trend', periodType, user?.id],
    queryFn: () => apiGet<TrendResponse>(`/api/targets/trend?periodType=${periodType}&count=6`),
    enabled: !!user?.id && isTargetRole,
  })

  if (!isTargetRole) return null

  const current = periodType === 'MONTH' ? monthly : weekly
  const metric = trend?.metric ?? current?.metric ?? 'IPD_DONE'
  const label = METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ')

  const trackerLink =
    user?.role === 'BD' ? '/bd/kyp'
    : user?.role === 'TEAM_LEAD' ? '/team-lead/pipeline'
    : '/sales/targets'

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      {/* Header: title + Monthly/Weekly toggle */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold">
            {label} Trend
          </h2>
        </div>
        <div className="flex items-center gap-2">
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
          <Link href={trackerLink} className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0">
            Details <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Current period summary */}
      {current && (
        <div className="mb-4">
          <div className="flex items-end justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              This {periodType === 'MONTH' ? 'month' : 'week'}
            </span>
            <span className="text-sm font-bold tabular-nums">
              {fmtVal(current.actual, current.metric)}{' '}
              <span className="text-muted-foreground font-normal">/ {fmtVal(current.targetValue, current.metric)}</span>
            </span>
          </div>
          <Progress value={Math.min(100, current.percentage)} className="h-1.5" />
        </div>
      )}

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
              <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: 'rgba(30,197,183,0.08)' }} />
              <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {trend.points.map((p, i) => (
                  <Cell
                    key={i}
                    fill={
                      !p.hasTarget ? '#cbd5e1'
                      : p.percentage >= 100 ? '#10b981'
                      : p.percentage >= 60 ? '#1EC5B7'
                      : '#f59e0b'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No data yet for this period
          </div>
        )}
      </div>
    </div>
  )
}