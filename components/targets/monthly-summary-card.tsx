'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useMyTargetProgress } from '@/app/bd/dashboard/BDDashboard'
import { calculateIncentive } from '@/lib/analytics/incentives'
import { Target, Trophy, Percent, Gift } from 'lucide-react'

interface TrendPoint {
  label: string
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

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function MonthlySummaryCard() {
  const { user } = useAuth()
  const { isTargetRole, monthly } = useMyTargetProgress()

  // Same queryKey as TargetTrendCard's monthly fetch — react-query dedupes this,
  // so no extra network call when both cards are rendered together.
  const { data: trend } = useQuery<TrendResponse>({
    queryKey: ['target-trend', 'MONTH', user?.id],
    queryFn: () => apiGet<TrendResponse>('/api/targets/trend?periodType=MONTH&count=6'),
    enabled: !!user?.id && isTargetRole,
  })

  const bestMonth = useMemo(() => {
    const points = trend?.points ?? []
    if (!points.length) return null
    return points.reduce((best, p) => (p.actual > best.actual ? p : best), points[0])
  }, [trend])

  const incentive = useMemo(() => {
    if (!monthly?.bonusRules?.length) return null
    return calculateIncentive(monthly.bonusRules, monthly.actual)
  }, [monthly])

  if (!isTargetRole) return null

  if (!monthly) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold">Score Card</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<Target className="h-3.5 w-3.5" />} label="Target / Achieved" value="–" sub="No target assigned" />
          <StatTile icon={<Percent className="h-3.5 w-3.5" />} label="Achievement" value="–" sub="No target assigned" />
          <StatTile
            icon={<Trophy className="h-3.5 w-3.5" />}
            label="Best Month"
            value={bestMonth ? bestMonth.label : '–'}
            sub={bestMonth ? `${fmtVal(bestMonth.actual, trend?.metric ?? '')} ${METRIC_LABELS[trend?.metric ?? ''] ?? ''}` : 'Not enough data yet'}
          />
          <StatTile icon={<Gift className="h-3.5 w-3.5" />} label="Incentive Earned" value="–" sub="No reward earned yet" />
        </div>
      </div>
    )
  }

  const metric = monthly.metric
  const label = METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ')

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-teal-600" />
        <h2 className="text-sm font-semibold">Score Card</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Target className="h-3.5 w-3.5" />}
          label="Target / Achieved"
          value={
            <>
              {fmtVal(monthly.actual, metric)}
              <span className="text-muted-foreground font-normal text-sm"> / {fmtVal(monthly.targetValue, metric)}</span>
            </>
          }
          sub={label}
        />

        <StatTile
          icon={<Percent className="h-3.5 w-3.5" />}
          label="Achievement"
          value={`${Math.round(monthly.percentage)}%`}
          sub={monthly.status === 'completed' ? 'Goal met' : monthly.status === 'on_track' ? 'On track' : 'At risk'}
        />

        <StatTile
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Best Month"
          value={bestMonth ? `${bestMonth.label}` : '—'}
          sub={bestMonth ? `${fmtVal(bestMonth.actual, metric)} ${label}` : 'Not enough data yet'}
        />

        <StatTile
          icon={<Gift className="h-3.5 w-3.5" />}
          label="Incentive Earned"
          value={incentive && incentive.totalReward > 0 ? `₹${incentive.totalReward.toLocaleString('en-IN')}` : '—'}
          sub={
            incentive?.unresolvedRules.length
              ? 'Some bonus rules need a fixed amount configured'
              : incentive && incentive.totalReward > 0
              ? 'Live calculation'
              : 'No reward earned yet'
          }
        />
      </div>
    </div>
  )
}