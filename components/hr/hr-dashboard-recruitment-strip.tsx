'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { endOfWeek, format, isPast, isSameDay, startOfWeek } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, Briefcase, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InterviewMeet } from '@/components/hr/interview-list'

export function HRDashboardRecruitmentStrip() {
  const { user } = useAuth()
  const canRecruit = user && hasPermission(user, 'hrms:recruitment:read')

  const weekBounds = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    }
  }, [])

  const { data: weekInterviews = [] } = useQuery<InterviewMeet[]>({
    queryKey: ['hr-interviews', 'dashboard-week', weekBounds.from],
    queryFn: () =>
      apiGet<InterviewMeet[]>(
        `/api/hr/interviews?from=${encodeURIComponent(weekBounds.from)}&to=${encodeURIComponent(weekBounds.to)}`
      ),
    enabled: !!canRecruit,
  })

  const sortedWeek = useMemo(() => {
    return [...weekInterviews].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
  }, [weekInterviews])

  const todayCount = useMemo(() => {
    const day = new Date()
    return weekInterviews.filter((i) => isSameDay(new Date(i.scheduledAt), day)).length
  }, [weekInterviews])

  const upcomingCount = useMemo(() => {
    const now = new Date()
    return weekInterviews.filter((i) => new Date(i.scheduledAt) >= now).length
  }, [weekInterviews])

  const { data: hrAchievement } = useQuery<{
    currentMonth: {
      actual: number
      targetValue: number
      percentage: number
    }
    metric: string
  }>({
    queryKey: ['hr-head-achievement', user?.id],
    queryFn: () =>
      apiGet(`/api/md/head-targets/achievement?headUserId=${encodeURIComponent(user!.id)}`),
    enabled: !!user && user.role === 'HR_HEAD',
  })

  if (!canRecruit) return null

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card className="border-2 border-violet-200/60 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/40 dark:from-violet-950/20 dark:to-fuchsia-950/10 overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-4 space-y-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
                Interviews this week
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Mon–Sun · {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM')} –{' '}
                {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM yyyy')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs font-normal">
                {weekInterviews.length} scheduled
              </Badge>
              {todayCount > 0 ? (
                <Badge className="text-xs bg-teal-600 hover:bg-teal-600">{todayCount} today</Badge>
              ) : null}
              {upcomingCount > 0 && upcomingCount < weekInterviews.length ? (
                <Badge variant="outline" className="text-xs">
                  {upcomingCount} upcoming
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {sortedWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center sm:text-left">
              No interviews scheduled for this week.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[min(55vh,400px)] overflow-y-auto overscroll-contain pr-1 -mr-1">
              {sortedWeek.map((i) => {
                const at = new Date(i.scheduledAt)
                const past = isPast(at)
                const label = i.candidateName?.trim() || i.title || 'Interview'
                return (
                  <li
                    key={i.id}
                    className={cn(
                      'rounded-xl border bg-background/90 dark:bg-background/50 px-3 py-2.5 text-sm shadow-sm',
                      past && 'opacity-70 border-muted'
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold leading-snug break-words">{label}</p>
                        {(() => {
                          const meta = [
                            i.candidateRole,
                            i.department?.name,
                            i.interviewRound != null ? `Round ${i.interviewRound}` : null,
                          ].filter(Boolean) as string[]
                          if (meta.length === 0) return null
                          return <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p>
                        })()}
                        {i.createdBy?.name ? (
                          <p className="text-xs text-muted-foreground">Coordinator: {i.createdBy.name}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 border-t sm:border-t-0 border-border/60 pt-2 sm:pt-0">
                        <div className="text-left sm:text-right text-xs">
                          <div className="font-semibold text-foreground tabular-nums">
                            {format(at, 'EEE, d MMM')}
                          </div>
                          <div className="text-muted-foreground tabular-nums">{format(at, 'h:mm a')}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {i.type === 'VIRTUAL' ? 'Virtual' : 'In person'}
                        </Badge>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Button variant="outline" size="sm" className="w-full rounded-xl border-violet-300" asChild>
            <Link href="/hr/recruitment" className="gap-1">
              Open recruitment
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {user?.role === 'HR_HEAD' && (
        <Card className="border-2 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Hiring target
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3 text-sm">
            {hrAchievement?.currentMonth && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Headcount (this month)</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {hrAchievement.currentMonth.actual}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    / {hrAchievement.currentMonth.targetValue || '—'} target
                  </span>
                  {hrAchievement.currentMonth.targetValue > 0 && (
                    <Badge variant="outline" className="ml-auto">
                      {hrAchievement.currentMonth.percentage}%
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {!hrAchievement?.currentMonth && (
              <p className="text-xs text-muted-foreground">
                No active monthly target set. Ask MD to set headcount targets.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(user?.role === 'MD' || user?.role === 'ADMIN') && (
        <Card className="border-2 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Department targets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Set and review department head targets (including HR hiring goals).
            </p>
            <Button size="sm" className="w-full rounded-xl" variant="secondary" asChild>
              <Link href="/md/targets">Open Targets</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
