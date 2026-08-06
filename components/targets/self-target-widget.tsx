'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { UserRound, ArrowUpRight, Plus } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM' | 'CATEGORY'
  targetForId: string
  metric: string
  targetValue: number
  actual: number
  percentage: number
  status: 'completed' | 'on_track' | 'at_risk'
}

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPD Done',
  SURGERIES_DONE: 'IPD Done',
  LEADS_CLOSED: 'Leads Closed',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
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
 * Small "My Target" card for CM / ACM / TL home pages — their own individual
 * (BD-type, self-assigned) target, kept separate from <TeamTargetWidget />
 * which only ever shows the TEAM-type target. Without this, a CM/ACM/TL's
 * self target was only visible by drilling into /sales/targets or
 * /team-lead/targets — nowhere on the home page.
 */
export function SelfTargetWidget() {
  const { user } = useAuth()
  const month = format(new Date(), 'yyyy-MM')

  const eligible =
    user?.role === 'TEAM_LEAD' ||
    user?.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user?.role === 'CATEGORY_MANAGER'

  const { data: targets } = useQuery<TargetProgress[]>({
    queryKey: ['target-progress-widget', month],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${month}`),
    enabled: !!user && eligible,
  })

  if (!eligible) return null

  const selfTarget = targets?.find((t) => t.targetType === 'BD' && t.targetForId === user?.id)

  const href = user?.role === 'CATEGORY_MANAGER' ? '/sales/targets' : '/team-lead/targets'

  // No self target set yet — small CTA so the option is discoverable, rather
  // than silently disappearing like the old team-only widget would imply.
  if (!selfTarget) {
    return (
      <Link
        href={href}
        className="flex items-center gap-2.5 rounded-xl border border-dashed border-violet-300/70 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/10 px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors group"
      >
        <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
          <Plus className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="font-medium text-violet-700 dark:text-violet-300">Set My Target</span>
        <span className="text-xs text-muted-foreground">— your own individual target, separate from your team&apos;s</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    )
  }

  const pct = Math.min(selfTarget.percentage, 100)

  return (
    <Link
      href={href}
      className="block bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/30 dark:via-card dark:to-fuchsia-950/20 border border-violet-200/70 dark:border-violet-800/50 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
          <UserRound className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-sm font-semibold shrink-0">
          My Target · {METRIC_LABELS[selfTarget.metric] || selfTarget.metric}
        </span>
        <div className="flex-1 min-w-[80px]">
          <Progress
            value={pct}
            className="h-1.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatVal(selfTarget.actual, selfTarget.metric)} / {formatVal(selfTarget.targetValue, selfTarget.metric)}
        </span>
        <StatusBadge status={selfTarget.status} />
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  )
}