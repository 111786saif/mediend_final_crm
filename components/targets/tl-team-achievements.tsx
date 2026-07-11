'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { getAvatarColor } from '@/lib/avatar-colors'
import { format } from 'date-fns'
import { Users, Trophy } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BdMember {
  id: string
  name: string
  profilePicture: string | null
  actual: number
  percentage?: number
}

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM'
  metric: string
  targetValue: number
  actual: number
  percentage: number
  status: 'completed' | 'on_track' | 'at_risk'
  entityName: string
  bdBreakdown: BdMember[]
}

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPD Done',
  SURGERIES_DONE: 'Surgeries',
  LEADS_CLOSED: 'Leads Closed',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
}

function fmtVal(value: number, metric: string) {
  if (['NET_PROFIT', 'BILL_AMOUNT'].includes(metric)) {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
    return `₹${value}`
  }
  return String(value)
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white"><Trophy className="size-3" /></span>
  if (rank === 2) return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-700"><Trophy className="size-3" /></span>
  if (rank === 3) return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white"><Trophy className="size-3" /></span>
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-[11px] font-bold">{rank}</span>
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct >= 100) {
    return <Badge className="text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">Done ✓</Badge>
  }
  if (pct >= 60) {
    return <Badge className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">On Track</Badge>
  }
  return <Badge className="text-[11px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 shrink-0">At Risk</Badge>
}

/**
 * Team member breakdown vs. individual targets (Team Lead home page).
 * Complements <TeamTargetWidget />, which already shows the overall team
 * summary card just above this — so this component intentionally only
 * renders the per-member table, avoiding a duplicate summary card.
 */
export function TLTeamAchievements() {
  const { user } = useAuth()
  const month = format(new Date(), 'yyyy-MM')

  const { data: targets, isLoading } = useQuery<TargetProgress[]>({
    queryKey: ['tl-team-achievements', month],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${month}`),
    enabled: !!user && user.role === 'TEAM_LEAD',
  })

  if (user?.role !== 'TEAM_LEAD') return null

  const teamTarget = targets?.find((t) => t.targetType === 'TEAM')
  const bdTargets = targets?.filter((t) => t.targetType === 'BD') ?? []

  // Merge bdBreakdown from team target with individual BD targets for richer data
  const members: Array<BdMember & { individualTarget?: number }> = (
    teamTarget?.bdBreakdown ?? []
  ).map((bd) => {
    const individual = bdTargets.find((t) => t.id === bd.id || t.entityName === bd.name)
    const indivTarget = individual?.targetValue
    const pct = indivTarget && indivTarget > 0
      ? Math.round((bd.actual / indivTarget) * 100)
      : bd.percentage ?? 0
    return { ...bd, percentage: pct, individualTarget: indivTarget }
  })

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 animate-pulse h-40" />
    )
  }

  if (members.length === 0) return null

  const metric = teamTarget?.metric ?? 'IPD_DONE'

  // Sort: highest actual first
  const sorted = [...members].sort((a, b) => b.actual - a.actual)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="size-4" /> Team Members
        </h2>
        <Link href="/team-lead/targets" className="text-xs text-primary hover:underline">
          View targets →
        </Link>
      </div>

      <div className="rounded-xl border bg-card divide-y overflow-hidden shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[1fr_84px_1fr_88px] gap-3 px-4 py-2.5 bg-muted/40">
          <p className="text-xs font-medium text-muted-foreground">Member</p>
          <p className="text-xs font-medium text-muted-foreground text-center">Achieved</p>
          <p className="text-xs font-medium text-muted-foreground">Progress</p>
          <p className="text-xs font-medium text-muted-foreground text-right">Status</p>
        </div>

        {sorted.map((bd, i) => {
          const ac = getAvatarColor(bd.name)
          const pct = Math.min(bd.percentage ?? 0, 100)
          const barColor =
            pct >= 100 ? '[&>div]:bg-emerald-500'
            : pct >= 60 ? '[&>div]:bg-blue-500'
            : '[&>div]:bg-red-400'

          return (
            <div key={bd.id} className="grid grid-cols-[1fr_84px_1fr_88px] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
              {/* Member */}
              <div className="flex items-center gap-2.5 min-w-0">
                <RankBadge rank={i + 1} />
                <Avatar size="sm">
                  {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                  <AvatarFallback className={cn(ac.bg, ac.text, 'text-[10px] font-bold')}>
                    {getInitials(bd.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{bd.name}</p>
                  {bd.individualTarget && (
                    <p className="text-[11px] text-muted-foreground">
                      Target: {fmtVal(bd.individualTarget, metric)}
                    </p>
                  )}
                </div>
              </div>

              {/* Achieved */}
              <div className="text-center">
                <span className="text-sm font-bold tabular-nums">
                  {fmtVal(bd.actual, metric)}
                </span>
              </div>

              {/* Progress bar + % */}
              <div className="flex items-center gap-2">
                <Progress value={pct} className={cn('h-1.5 flex-1', barColor)} />
                <span className={cn(
                  'text-xs font-bold tabular-nums w-9 shrink-0 text-right',
                  pct >= 100 ? 'text-emerald-600'
                  : pct >= 60 ? 'text-blue-600'
                  : 'text-red-500'
                )}>
                  {bd.percentage ?? 0}%
                </span>
              </div>

              {/* Status */}
              <div className="flex justify-end">
                <StatusBadge pct={bd.percentage ?? 0} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}