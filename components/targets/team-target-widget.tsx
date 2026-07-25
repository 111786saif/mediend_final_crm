'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { getAvatarColor } from '@/lib/avatar-colors'
import { Target, Trophy, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM'
  metric: string
  targetValue: number
  actual: number
  percentage: number
  status: 'completed' | 'on_track' | 'at_risk'
  entityName: string
  bdBreakdown: Array<{
    id: string
    name: string
    profilePicture: string | null
    actual: number
  }>
}

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPD Done',
  SURGERIES_DONE: 'IPD Done',
  LEADS_CLOSED: 'Leads Closed',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatVal(value: number, metric: string) {
  if (metric === 'NET_PROFIT' || metric === 'BILL_AMOUNT') {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
    return `₹${value}`
  }
  return String(value)
}

function StatusBadge({ status }: { status: 'completed' | 'on_track' | 'at_risk' }) {
  if (status === 'completed') {
    return <Badge className="text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Done ✓</Badge>
  }
  if (status === 'on_track') {
    return <Badge className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">On Track</Badge>
  }
  return <Badge className="text-[11px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">At Risk</Badge>
}

/**
 * Compact target progress widget for the home page.
 * Shows the current month's team target with top 3 BDs.
 * Renders nothing if the user has no active target.
 *
 * On the Team Lead home page this is the *only* place the overall team
 * summary is shown — the member-by-member breakdown lives separately in
 * <TLTeamAchievements />, so the two don't duplicate the same numbers.
 */
export function TeamTargetWidget() {
  const { user } = useAuth()
  const month = format(new Date(), 'yyyy-MM')

  const { data: targets } = useQuery<TargetProgress[]>({
    queryKey: ['target-progress-widget', month],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${month}`),
    enabled:
      !!user &&
      (user.role === 'TEAM_LEAD' ||
        user.role === 'ASSISTANT_CATEGORY_MANAGER' ||
        user.role === 'CATEGORY_MANAGER' ||
        user.role === 'SALES_HEAD'),
  })

  const teamTarget = targets?.find((t) => t.targetType === 'TEAM')
  if (!teamTarget) return null

  const pct = Math.min(teamTarget.percentage, 100)
  const top3 = teamTarget.bdBreakdown.slice(0, 3)
  const memberCount = teamTarget.bdBreakdown.length

  const href =
    user?.role === 'TEAM_LEAD' || user?.role === 'ASSISTANT_CATEGORY_MANAGER'
      ? '/team-lead/targets'
      : '/sales/targets'

  return (
    <Link
      href={href}
      className="block bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/30 dark:via-card dark:to-fuchsia-950/20 border border-violet-200/70 dark:border-violet-800/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">
            Team Target · {METRIC_LABELS[teamTarget.metric] || teamTarget.metric}
          </span>
          {memberCount > 0 && (
            <span className="text-xs text-muted-foreground">· {memberCount} member{memberCount === 1 ? '' : 's'}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={teamTarget.status} />
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-2xl font-bold text-violet-600">{teamTarget.percentage}%</span>
            <span className="text-sm text-muted-foreground">
              {formatVal(teamTarget.actual, teamTarget.metric)} / {formatVal(teamTarget.targetValue, teamTarget.metric)}
            </span>
          </div>
          <Progress
            value={pct}
            className="h-2 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500"
          />
        </div>

        {top3.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {top3.map((bd, i) => {
              const ac = getAvatarColor(bd.name)
              return (
                <div key={bd.id} className="flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <Avatar size="sm" className={cn(i === 0 && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-background')}>
                      {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                      <AvatarFallback className={cn(ac.bg, ac.text, 'text-[9px] font-bold')}>
                        {getInitials(bd.name)}
                      </AvatarFallback>
                    </Avatar>
                    {i === 0 && <Trophy className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-500" />}
                  </div>
                  <span className="text-[9px] font-medium tabular-nums">{bd.actual}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Link>
  )
}