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
import { Progress } from '@/components/ui/progress'
import { Target, Briefcase, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InterviewMeet } from '@/components/hr/interview-list'

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPD done',
  HEAD_COUNT: 'Head count',
  LEADS_GENERATED: 'Leads',
  REVENUE: 'Revenue',
}

function formatAchievementValue(value: number, metric: string): string {
  if (metric === 'REVENUE') {
    if (value >= 1000000) return `₹${(value / 1000000).toFixed(1)}M`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    return `₹${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

interface HeadTargetItem {
  head: {
    id: string
    name: string
    email: string
    role: string
    profilePicture: string | null
    department: { id: string; name: string } | null
    departmentLabel: string
  }
  activeTarget: {
    id: string
    metric: string
    targetValue: number
    departmentTargets?: { departmentId: string; addCount: number }[] | null
    periodStartDate: string
    periodEndDate: string
    periodType: string
  } | null
  achievement: {
    actual: number
    targetValue: number
    percentage: number
    metric: string
  }
}

interface EmployeeForTargets {
  joinDate: string | null
  departmentId: string | null
}

function getMonthBounds() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function countJoinsInDept(
  employees: EmployeeForTargets[],
  deptId: string,
  start: Date,
  end: Date
): number {
  return employees.filter((e) => {
    if (!e.joinDate || e.departmentId !== deptId) return false
    const jd = new Date(e.joinDate)
    return !isNaN(jd.getTime()) && jd >= start && jd <= end
  }).length
}

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

  const showInterviews = !!canRecruit
  const showHiringTarget = user?.role === 'HR_HEAD'
  const showMdDeptTargets = user?.role === 'MD' || user?.role === 'ADMIN'

  const { data: headTargetItems = [], isLoading: headTargetsLoading } = useQuery<HeadTargetItem[]>({
    queryKey: ['md-head-targets', 'dashboard-strip'],
    queryFn: () => apiGet<HeadTargetItem[]>('/api/md/head-targets'),
    enabled: showMdDeptTargets,
  })

  const { data: employeesRaw = [] } = useQuery<EmployeeForTargets[]>({
    queryKey: ['employees-for-head-targets-strip'],
    queryFn: () => apiGet<EmployeeForTargets[]>('/api/employees'),
    enabled: showMdDeptTargets,
  })

  const { data: departments = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments-for-head-targets-strip'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
    enabled: showMdDeptTargets,
  })

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of departments) {
      m.set(d.id, d.name)
    }
    return m
  }, [departments])

  const monthBounds = useMemo(() => getMonthBounds(), [])

  const employeesForTargets = useMemo((): EmployeeForTargets[] => {
    return (employeesRaw as { joinDate?: string | null; departmentId?: string | null }[]).map((e) => ({
      joinDate: e.joinDate ?? null,
      departmentId: e.departmentId ?? null,
    }))
  }, [employeesRaw])

  if (!showInterviews && !showHiringTarget && !showMdDeptTargets) return null

  return (
    <div className="grid gap-2.5 sm:gap-4 grid-cols-1 lg:grid-cols-2">
      {showInterviews ? (
        <Card className="border-2 border-violet-200/60 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/40 dark:from-violet-950/20 dark:to-fuchsia-950/10 overflow-hidden">
          <CardHeader className="pb-2 px-2 sm:px-6 pt-4 space-y-1">
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
          <CardContent className="px-2 sm:px-6 pb-4 space-y-3">
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
      ) : null}

      {showHiringTarget ? (
        <Card className="border-2 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardHeader className="pb-2 px-2 sm:px-6 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Hiring target
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-4 space-y-3 text-sm">
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
                {hrAchievement.currentMonth.targetValue > 0 && (
                  <Progress
                    value={Math.min(hrAchievement.currentMonth.percentage, 100)}
                    className="mt-3 h-2"
                  />
                )}
              </div>
            )}
            {!hrAchievement?.currentMonth && (
              <p className="text-xs text-muted-foreground">
                No active monthly target set. Ask MD to set headcount targets.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showMdDeptTargets ? (
        <Card className="border-2 border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10">
          <CardHeader className="pb-2 px-2 sm:px-6 pt-4 space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              HR &amp; department goals
            </CardTitle>
            <CardDescription className="text-xs">
              This month — progress vs targets by department head (HR hiring shown per department when set)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-4 space-y-3 text-sm">
            {headTargetsLoading ? (
              <div className="space-y-2 animate-pulse py-2">
                <div className="h-16 rounded-lg bg-muted/80" />
                <div className="h-16 rounded-lg bg-muted/80" />
              </div>
            ) : headTargetItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No department heads found.</p>
            ) : (
              <div className="space-y-3 max-h-[min(55vh,440px)] overflow-y-auto overscroll-contain pr-0.5 -mr-0.5">
                {[...headTargetItems]
                  .sort((a, b) => a.head.name.localeCompare(b.head.name))
                  .map((item) => {
                    const { head, achievement, activeTarget } = item
                    const metric = achievement.metric
                    const hasTarget = achievement.targetValue > 0
                    const deptRows =
                      head.role === 'HR_HEAD' &&
                      metric === 'HEAD_COUNT' &&
                      activeTarget?.departmentTargets &&
                      activeTarget.departmentTargets.length > 0
                        ? activeTarget.departmentTargets.filter((d) => d.addCount > 0)
                        : null

                    return (
                      <div
                        key={head.id}
                        className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-background/70 dark:bg-background/40 p-2.5 sm:p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight truncate">{head.name}</p>
                            <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                              {head.departmentLabel}
                            </Badge>
                          </div>
                        </div>

                        {!hasTarget ? (
                          <p className="text-xs text-muted-foreground">No target set</p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">
                                {METRIC_LABELS[metric] ?? metric}
                                {deptRows ? ' (total)' : ''}
                              </span>
                              <span className="font-medium tabular-nums shrink-0">
                                {formatAchievementValue(achievement.actual, metric)} /{' '}
                                {formatAchievementValue(achievement.targetValue, metric)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(achievement.percentage, 100)}
                                className="h-2 flex-1"
                              />
                              <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
                                {achievement.percentage}%
                              </Badge>
                            </div>

                            {deptRows && deptRows.length > 0 ? (
                              <div className="mt-2 space-y-2 border-l-2 border-amber-300/50 dark:border-amber-800/50 pl-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  By department
                                </p>
                                {deptRows.map((dt) => {
                                  const deptName =
                                    deptNameById.get(dt.departmentId) ?? 'Department'
                                  const actual = countJoinsInDept(
                                    employeesForTargets,
                                    dt.departmentId,
                                    monthBounds.start,
                                    monthBounds.end
                                  )
                                  const pct =
                                    dt.addCount > 0
                                      ? Math.round((actual / dt.addCount) * 100)
                                      : 0
                                  return (
                                    <div key={dt.departmentId} className="space-y-1">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate font-medium">{deptName}</span>
                                        <span className="tabular-nums text-muted-foreground shrink-0">
                                          {actual} / {dt.addCount}
                                        </span>
                                      </div>
                                      <Progress value={Math.min(pct, 100)} className="h-1.5" />
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
            <Button size="sm" className="w-full rounded-xl" variant="secondary" asChild>
              <Link href="/md/targets" className="gap-1">
                Open targets
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
