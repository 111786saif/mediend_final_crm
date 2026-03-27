'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { endOfWeek, format, isSameDay, startOfWeek } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, Briefcase, ChevronRight } from 'lucide-react'
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

  const upcomingWeek = useMemo(() => {
    const now = new Date()
    return weekInterviews
      .filter((i) => new Date(i.scheduledAt) >= now)
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
      .slice(0, 5)
  }, [weekInterviews])

  const todayCount = useMemo(() => {
    const day = new Date()
    return weekInterviews.filter((i) => isSameDay(new Date(i.scheduledAt), day)).length
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
      apiGet(
        `/api/md/head-targets/achievement?headUserId=${encodeURIComponent(user!.id)}`
      ),
    enabled: !!user && user.role === 'HR_HEAD',
  })

  if (!canRecruit) return null

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="border-2 border-violet-200/60 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/40 dark:from-violet-950/20 dark:to-fuchsia-950/10 overflow-hidden">
        <CardHeader className="pb-2 px-3 pt-3 md:px-4 md:pt-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-violet-600" />
              This week&apos;s interviews
            </CardTitle>
            <div className="flex gap-1.5 shrink-0">
              <Badge variant="secondary" className="text-[10px] md:text-xs">
                {weekInterviews.length} week
              </Badge>
              <Badge className="text-[10px] md:text-xs bg-teal-600">
                {todayCount} today
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-4 md:pb-4 space-y-2">
          {upcomingWeek.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No upcoming interviews left this week.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {upcomingWeek.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/70 dark:bg-background/40 px-2 py-1.5 text-xs"
                >
                  <span className="truncate font-medium">
                    {i.candidateName || i.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {format(new Date(i.scheduledAt), 'EEE h:mm a')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-violet-300"
            asChild
          >
            <Link href="/hr/recruitment" className="gap-1">
              Open recruitment
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {user?.role === 'HR_HEAD' && (
        <Card className="border-2 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardHeader className="pb-2 px-3 pt-3 md:px-4 md:pt-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" />
              Hiring target
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-4 md:pb-4 space-y-3 text-sm">
            {hrAchievement?.currentMonth && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Headcount (this month)
                </p>
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
          <CardHeader className="pb-2 px-3 pt-3 md:px-4 md:pt-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" />
              Department targets
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 md:px-4 md:pb-4 space-y-3 text-sm">
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
