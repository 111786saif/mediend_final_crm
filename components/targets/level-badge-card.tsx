'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Award } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface Tier {
  id: string
  name: string
  thresholdValue: number
  order: number
  rewardAmount: number | null
}

interface MyLevel {
  metric: string
  actual: number
  currentTier: Tier | null
  nextTier: Tier | null
  remainingToNext: number
  ladder: Tier[]
}

const SALES_ROLES = ['BD', 'TEAM_LEAD', 'SALES_HEAD']

const TIER_COLORS: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-slate-400 to-slate-300',
  gold: 'from-yellow-500 to-amber-300',
  platinum: 'from-cyan-400 to-teal-300',
}

function tierGradient(name?: string) {
  const key = (name ?? '').toLowerCase()
  return TIER_COLORS[key] ?? 'from-teal-500 to-teal-300'
}

export function LevelBadgeCard() {
  const { user } = useAuth()
  const isSalesRole = !!user && SALES_ROLES.includes(user.role)

  const { data: level, isLoading } = useQuery<MyLevel | null>({
    queryKey: ['my-level', 'IPD_DONE', user?.id],
    queryFn: () => apiGet<MyLevel | null>('/api/levels/my-level?metric=IPD_DONE'),
    enabled: !!user?.id && isSalesRole,
  })

  if (!isSalesRole) return null
  if (isLoading) {
    return <div className="rounded-2xl border bg-card p-4 shadow-sm h-[140px] animate-pulse" />
  }
  // No tier ladder configured yet — show a quiet placeholder instead of
  // vanishing, so the row doesn't look like something broke.
  if (!level || level.ladder.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-4 flex flex-col items-center justify-center text-center h-full min-h-[140px]">
        <Award className="h-5 w-5 text-muted-foreground mb-2" />
        <p className="text-xs font-medium text-muted-foreground">Levels not set up yet</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Ask your Sales Head to configure the tier ladder</p>
      </div>
    )
  }

  const { currentTier, nextTier, remainingToNext, actual } = level
  const progressPct = nextTier
    ? Math.min(100, Math.round((actual / nextTier.thresholdValue) * 100))
    : 100

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">My Level</h2>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tierGradient(currentTier?.name)} flex items-center justify-center shrink-0 shadow-sm`}
        >
          <Award className="h-6 w-6 text-white drop-shadow" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">
            {currentTier ? currentTier.name : 'Unranked'}
          </p>
          {currentTier?.rewardAmount != null && (
            <p className="text-xs text-muted-foreground">
              ₹{currentTier.rewardAmount.toLocaleString('en-IN')} tier reward
            </p>
          )}
        </div>
      </div>

      {nextTier ? (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Progress to {nextTier.name}</span>
            <span className="text-xs font-semibold tabular-nums">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {remainingToNext} more to reach {nextTier.name}
          </p>
        </>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          You've reached the top tier 🎉
        </p>
      )}
    </div>
  )
}