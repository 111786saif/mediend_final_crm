'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { endOfWeek, format, isPast, isSameDay, startOfWeek, isToday, isTomorrow } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Briefcase, ChevronRight, Phone, Target, UserPlus, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { InterviewMeet } from '@/components/hr/interview-list'
import type { HRAnalytics } from '@/components/hr/hr-dashboard'
import type { HRDashboardFilters } from './md-hr-filter-drawer'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface HeadTargetItem {
  head: { id: string; name: string; email: string; role: string; profilePicture: string | null; department: { id: string; name: string } | null; departmentLabel: string }
  activeTarget: { id: string; metric: string; targetValue: number; departmentTargets?: { departmentId: string; addCount: number }[] | null; periodStartDate: string; periodEndDate: string; periodType: string } | null
  achievement: { actual: number; targetValue: number; percentage: number; metric: string }
}

interface EmployeeForTargets {
  joinDate: string | null
  departmentId: string | null
  employeeCode?: string
  salary?: number | null
  user?: { name: string }
}

function getMonthBounds(month: number, year: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

function countJoinsInDept(employees: EmployeeForTargets[], deptId: string, start: Date, end: Date): number {
  return employees.filter((e) => {
    if (!e.joinDate || e.departmentId !== deptId) return false
    const jd = new Date(e.joinDate)
    return !isNaN(jd.getTime()) && jd >= start && jd <= end
  }).length
}

function getJoinersInDept(employees: EmployeeForTargets[], deptId: string, start: Date, end: Date) {
  return employees.filter((e) => {
    if (!e.joinDate || e.departmentId !== deptId) return false
    const jd = new Date(e.joinDate)
    return !isNaN(jd.getTime()) && jd >= start && jd <= end
  })
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE, d MMM')
}

interface MdHrRecruitmentTabProps {
  filters: HRDashboardFilters
}

function getInitials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export function MdHrRecruitmentTab({ filters }: MdHrRecruitmentTabProps) {
  const { user } = useAuth()
  const [detailDeptId, setDetailDeptId] = useState<string | null>(null)
  const [joinersDrawerOpen, setJoinersDrawerOpen] = useState(false)

  const weekBounds = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return { from: start.toISOString(), to: end.toISOString(), start, end }
  }, [])

  const { data: weekInterviews = [], isLoading: interviewsLoading } = useQuery<InterviewMeet[]>({
    queryKey: ['hr-interviews', 'md-hr-tab', weekBounds.from],
    queryFn: () => apiGet<InterviewMeet[]>(`/api/hr/interviews?from=${encodeURIComponent(weekBounds.from)}&to=${encodeURIComponent(weekBounds.to)}`),
  })

  const { data: analytics } = useQuery<HRAnalytics>({
    queryKey: ['analytics', 'md', 'hr', filters.month, filters.year],
    queryFn: () => apiGet<HRAnalytics>(`/api/analytics/md/hr?month=${filters.month}&year=${filters.year}`),
  })

  const { data: headTargetItems = [], isLoading: targetsLoading } = useQuery<HeadTargetItem[]>({
    queryKey: ['md-head-targets', 'hr-tab', filters.month, filters.year],
    queryFn: () => apiGet<HeadTargetItem[]>(`/api/md/head-targets?month=${filters.month}&year=${filters.year}`),
  })

  const { data: employeesRaw = [] } = useQuery<EmployeeForTargets[]>({
    queryKey: ['employees-for-hr-targets'],
    queryFn: () => apiGet<EmployeeForTargets[]>('/api/employees'),
  })

  const { data: departments = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments-for-hr-targets'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
  })

  // Interviews
  const sortedWeek = useMemo(
    () => [...weekInterviews].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [weekInterviews]
  )

  const todayInterviewCount = useMemo(() => {
    const day = new Date()
    return weekInterviews.filter((i) => isSameDay(new Date(i.scheduledAt), day)).length
  }, [weekInterviews])

  const groupedInterviews = useMemo(() => {
    const groups = new Map<string, InterviewMeet[]>()
    for (const interview of sortedWeek) {
      const date = new Date(interview.scheduledAt)
      const key = format(date, 'yyyy-MM-dd')
      const existing = groups.get(key) ?? []
      existing.push(interview)
      groups.set(key, existing)
    }
    return Array.from(groups.entries()).map(([key, interviews]) => ({
      date: new Date(key),
      label: getDayLabel(new Date(key)),
      interviews,
      isPast: isPast(new Date(key)) && !isToday(new Date(key)),
    }))
  }, [sortedWeek])

  // Targets
  const deptNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of departments) {
      if (d.id && d.name) m.set(d.id, d.name)
    }
    // Also build from employees as fallback (employees have department.name)
    for (const e of employeesRaw as any[]) {
      if (e.department?.id && e.department?.name && !m.has(e.department.id)) {
        m.set(e.department.id, e.department.name)
      }
    }
    return m
  }, [departments, employeesRaw])

  const monthBounds = useMemo(() => getMonthBounds(filters.month, filters.year), [filters.month, filters.year])

  const employeesForTargets = useMemo((): EmployeeForTargets[] => {
    return (employeesRaw as any[]).map((e: any) => ({
      joinDate: e.joinDate ?? null,
      departmentId: e.departmentId ?? null,
      employeeCode: e.employeeCode ?? '',
      salary: e.salary ?? null,
      user: e.user ?? { name: 'Unknown' },
    }))
  }, [employeesRaw])

  const hrTarget = useMemo(() => {
    const hrItems = headTargetItems.filter((item) => item.head.role === 'HR_HEAD')
    return hrItems.find((item) => item.activeTarget && item.achievement.metric === 'HEAD_COUNT') ?? hrItems.find((item) => item.achievement.metric === 'HEAD_COUNT')
  }, [headTargetItems])

  const deptFilter = useMemo(() => filters.departments.length > 0 ? new Set(filters.departments) : null, [filters.departments])

  const departmentBreakdown = useMemo(() => {
    if (!hrTarget?.activeTarget?.departmentTargets) return []
    return hrTarget.activeTarget.departmentTargets
      .filter((dt) => dt.addCount > 0 && (!deptFilter || deptFilter.has(dt.departmentId)))
      .map((dt) => {
        const actual = countJoinsInDept(employeesForTargets, dt.departmentId, monthBounds.start, monthBounds.end)
        const pct = dt.addCount > 0 ? Math.round((actual / dt.addCount) * 100) : 0
        return { departmentId: dt.departmentId, departmentName: deptNameById.get(dt.departmentId) ?? 'Department', target: dt.addCount, actual, percentage: pct }
      })
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [hrTarget, employeesForTargets, deptNameById, monthBounds, deptFilter])

  const selectedDept = useMemo(() => detailDeptId ? departmentBreakdown.find((d) => d.departmentId === detailDeptId) ?? null : null, [detailDeptId, departmentBreakdown])
  const selectedDeptJoiners = useMemo(() => detailDeptId ? getJoinersInDept(employeesForTargets, detailDeptId, monthBounds.start, monthBounds.end) : [], [detailDeptId, employeesForTargets, monthBounds])

  const chartData = useMemo(() => {
    const rows = analytics?.recruitmentMonthlyTrend ?? []
    return rows.map((r) => ({ ...r, label: `${MONTHS[r.month - 1].slice(0, 3)} '${String(r.year).slice(-2)}` }))
  }, [analytics?.recruitmentMonthlyTrend])

  const achievement = hrTarget?.achievement
  const newJoiners = analytics?.newJoiners ?? []
  const newJoinersCount = analytics?.kpis.newJoinersCount ?? newJoiners.length
  const openPositions = achievement ? Math.max(0, achievement.targetValue - achievement.actual) : 0

  // Group new joiners by department
  const joinersByDept = useMemo(() => {
    const map = new Map<string, typeof newJoiners>()
    for (const j of newJoiners) {
      const dept = j.departmentName || 'Unassigned'
      const list = map.get(dept) ?? []
      list.push(j)
      map.set(dept, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [newJoiners])

  if (interviewsLoading || targetsLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div>
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7 pb-8">
      {/* Stat Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Interviews Today" value={todayInterviewCount} subValue="Scheduled" accent="purple" valueAccent />
        <StatCard label="This Week" value={weekInterviews.length} subValue="Interviews" accent="blue" />
        <StatCard
          label="New Joiners"
          value={newJoinersCount}
          subValue={MONTHS[filters.month - 1]}
          accent="teal"
          valueAccent
          className={newJoinersCount > 0 ? 'cursor-pointer active:scale-[0.97] transition-transform' : undefined}
          onClick={newJoinersCount > 0 ? () => setJoinersDrawerOpen(true) : undefined}
        />
        <StatCard
          label="Open Positions"
          value={achievement ? openPositions : '—'}
          subValue="Unfilled"
          accent={openPositions > 0 ? 'orange' : 'emerald'}
          valueAccent={openPositions > 0}
        />
      </div>

      {/* Headcount & Department Targets */}
      {achievement && hrTarget?.activeTarget && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            {/* Overall Target */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headcount Target</p>
                  <p className="text-2xl font-bold tracking-tight mt-0.5">
                    {achievement.actual} <span className="text-sm font-normal text-muted-foreground">/ {achievement.targetValue}</span>
                  </p>
                </div>
              </div>
              <Badge variant={achievement.percentage >= 100 ? 'default' : 'secondary'} className={cn('text-base px-3 py-1', achievement.percentage >= 100 && 'bg-emerald-600')}>
                {achievement.percentage}%
              </Badge>
            </div>
            <Progress value={Math.min(achievement.percentage, 100)} className="mt-4 h-2.5" />

            {/* Department Breakdown */}
            {departmentBreakdown.length > 0 && (
              <div className="mt-5 pt-5 border-t space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">By Department</p>
                {departmentBreakdown.map((dept) => (
                  <button
                    key={dept.departmentId}
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => setDetailDeptId(dept.departmentId)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{dept.departmentName}</p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground shrink-0">{dept.actual}/{dept.target}</span>
                    <Badge variant={dept.percentage >= 100 ? 'default' : 'outline'} className={cn('text-xs tabular-nums shrink-0', dept.percentage >= 100 && 'bg-emerald-600')}>
                      {dept.percentage}%
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interviews This Week */}
      <Card>
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <CardTitle className="text-lg">Interviews This Week</CardTitle>
            <Badge variant="secondary" className="ml-auto">{format(weekBounds.start, 'd MMM')} – {format(weekBounds.end, 'd MMM')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          {sortedWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No interviews scheduled this week</p>
          ) : (
            <div className="space-y-4 max-h-[min(55vh,460px)] overflow-y-auto overscroll-contain pr-1 -mr-1">
              {groupedInterviews.map((group) => (
                <div key={group.label} className={cn(group.isPast && 'opacity-60')}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.interviews.map((interview) => {
                      const at = new Date(interview.scheduledAt)
                      const past = isPast(at)
                      const label = interview.candidateName?.trim() || interview.title || 'Interview'
                      return (
                        <div key={interview.id} className={cn('rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors', past ? 'border-muted opacity-70' : 'border-violet-200/80 dark:border-violet-800/60')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold leading-snug break-words">{label}</p>
                              {(() => {
                                const meta = [interview.candidateRole, interview.department?.name, interview.interviewRound != null ? `Round ${interview.interviewRound}` : null].filter(Boolean) as string[]
                                return meta.length > 0 ? <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p> : null
                              })()}
                              {interview.candidatePhone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{interview.candidatePhone}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold tabular-nums">{format(at, 'h:mm a')}</p>
                              <Badge variant="outline" className="text-[10px] mt-1">{interview.type === 'VIRTUAL' ? 'Virtual' : 'In person'}</Badge>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full mt-4 rounded-xl" asChild>
            <Link href="/hr/recruitment" className="gap-1">Open recruitment<ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <CardTitle className="text-lg">Interviews vs New Hires</CardTitle>
            </div>
            <CardDescription>Last 12 months ending {MONTHS[filters.month - 1]} {filters.year}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-4 pb-3">
            <div className="sm:hidden px-3 pb-2">
              <Table>
                <TableHeader><TableRow><TableHead className="text-sm h-10">Month</TableHead><TableHead className="text-sm h-10 text-right">Interviews</TableHead><TableHead className="text-sm h-10 text-right">Hires</TableHead></TableRow></TableHeader>
                <TableBody>
                  {chartData.map((row, i) => (
                    <TableRow key={`${row.year}-${row.month}-${i}`}>
                      <TableCell className="text-sm py-2.5 font-medium">{row.label}</TableCell>
                      <TableCell className="text-sm py-2.5 text-right tabular-nums">{row.interviews}</TableCell>
                      <TableCell className="text-sm py-2.5 text-right tabular-nums">{row.newHires}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="hidden sm:block w-full overflow-x-auto overscroll-x-contain touch-pan-x">
              <ChartContainer config={{ interviews: { label: 'Interviews', color: 'hsl(239 84% 67%)' }, newHires: { label: 'New hires', color: 'hsl(173 58% 40%)' } }} className="h-[280px] w-full min-w-[520px] sm:min-w-0 aspect-auto mx-auto">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} height={36} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-3 justify-center pt-1" />} />
                  <Bar dataKey="interviews" fill="var(--color-interviews)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="newHires" fill="var(--color-newHires)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full targets link */}
      <Button variant="outline" className="w-full rounded-xl" asChild>
        <Link href="/md/targets" className="gap-1.5">View all department targets<ChevronRight className="h-4 w-4" /></Link>
      </Button>

      {/* New Joiners Drawer */}
      <Drawer open={joinersDrawerOpen} onOpenChange={setJoinersDrawerOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-500" />
              New Joiners — {MONTHS[filters.month - 1]} {filters.year}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-2 pb-6 max-h-[70dvh]">
            {newJoiners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No new joiners this month</p>
            ) : (
              <>
                {joinersByDept.map(([dept, joiners]) => (
                  <div key={dept} className="mt-3 first:mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-1">{dept}</p>
                    <ul className="space-y-0.5">
                      {joiners.map((j, i) => (
                        <li key={`${j.employeeName}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-[10px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                              {getInitials(j.employeeName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight truncate">{j.employeeName}</p>
                          </div>
                          <span className="text-xs text-teal-600 dark:text-teal-400 font-medium shrink-0 tabular-nums">
                            {new Date(j.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Department Detail Drawer */}
      <Drawer open={!!detailDeptId} onOpenChange={(open) => !open && setDetailDeptId(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              {selectedDept?.departmentName ?? 'Department'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selectedDept && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Hiring progress</span>
                  <span className="text-sm font-semibold tabular-nums">{selectedDept.actual} / {selectedDept.target}</span>
                </div>
                <Progress value={Math.min(selectedDept.percentage, 100)} className="h-2.5" />
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">New joiners this month</p>
                  {selectedDeptJoiners.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No new joiners yet</p>
                  ) : (
                    <div className="overflow-y-auto max-h-[50dvh]">
                      <Table>
                        <TableHeader><TableRow><TableHead className="text-sm">Name</TableHead><TableHead className="text-sm text-right">Salary</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {selectedDeptJoiners.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium py-3">{e.user?.name ?? 'Unknown'}</TableCell>
                              <TableCell className="text-sm py-3 text-right tabular-nums font-medium">
                                {e.salary ? `₹${e.salary.toLocaleString('en-IN')}` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
