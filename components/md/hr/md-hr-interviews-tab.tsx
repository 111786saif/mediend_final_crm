'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { endOfWeek, format, isPast, isSameDay, startOfWeek, isToday, isTomorrow, addDays } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useIsMobile } from '@/hooks/use-mobile'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Briefcase, ChevronRight, Phone, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InterviewMeet } from '@/components/hr/interview-list'
import type { HRAnalytics } from '@/components/hr/hr-dashboard'
import type { HRDashboardFilters } from './md-hr-filter-drawer'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MdHrInterviewsTabProps {
  filters: HRDashboardFilters
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEEE, d MMM')
}

export function MdHrInterviewsTab({ filters }: MdHrInterviewsTabProps) {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const weekBounds = useMemo(() => {
    const now = new Date()
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return { from: start.toISOString(), to: end.toISOString(), start, end }
  }, [])

  const { data: weekInterviews = [], isLoading: interviewsLoading } = useQuery<InterviewMeet[]>({
    queryKey: ['hr-interviews', 'md-hr-tab', weekBounds.from],
    queryFn: () =>
      apiGet<InterviewMeet[]>(
        `/api/hr/interviews?from=${encodeURIComponent(weekBounds.from)}&to=${encodeURIComponent(weekBounds.to)}`
      ),
  })

  const { data: analytics } = useQuery<HRAnalytics>({
    queryKey: ['analytics', 'md', 'hr', filters.month, filters.year],
    queryFn: () => apiGet<HRAnalytics>(`/api/analytics/md/hr?month=${filters.month}&year=${filters.year}`),
  })

  const sortedWeek = useMemo(
    () => [...weekInterviews].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [weekInterviews]
  )

  const todayCount = useMemo(() => {
    const day = new Date()
    return weekInterviews.filter((i) => isSameDay(new Date(i.scheduledAt), day)).length
  }, [weekInterviews])

  const upcomingCount = useMemo(() => {
    const now = new Date()
    return weekInterviews.filter((i) => new Date(i.scheduledAt) >= now).length
  }, [weekInterviews])

  // Group interviews by day
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

  const chartData = useMemo(() => {
    const rows = analytics?.recruitmentMonthlyTrend ?? []
    return rows.map((r) => ({
      ...r,
      label: `${MONTHS[r.month - 1].slice(0, 3)} '${String(r.year).slice(-2)}`,
    }))
  }, [analytics?.recruitmentMonthlyTrend])

  if (interviewsLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7 pb-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Today"
          value={todayCount}
          subValue="Interviews"
          accent="purple"
          valueAccent
        />
        <StatCard
          label="This Week"
          value={weekInterviews.length}
          subValue="Scheduled"
          accent="blue"
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          subValue="Remaining"
          accent="teal"
        />
      </div>

      {/* Weekly Interviews */}
      <Card>
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <CardTitle className="text-lg">This Week</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {format(weekBounds.start, 'd MMM')} – {format(weekBounds.end, 'd MMM')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          {sortedWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No interviews scheduled for this week
            </p>
          ) : (
            <div className="space-y-5 max-h-[min(60vh,500px)] overflow-y-auto overscroll-contain pr-1 -mr-1">
              {groupedInterviews.map((group) => (
                <div key={group.label} className={cn(group.isPast && 'opacity-60')}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                    {group.label}
                  </p>
                  <div className="space-y-2.5">
                    {group.interviews.map((interview) => {
                      const at = new Date(interview.scheduledAt)
                      const past = isPast(at)
                      const label = interview.candidateName?.trim() || interview.title || 'Interview'
                      return (
                        <div
                          key={interview.id}
                          className={cn(
                            'rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors',
                            past ? 'border-muted opacity-70' : 'border-violet-200/80 dark:border-violet-800/60'
                          )}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className="text-base font-semibold leading-snug break-words">{label}</p>
                              {(() => {
                                const meta = [
                                  interview.candidateRole,
                                  interview.department?.name,
                                  interview.interviewRound != null ? `Round ${interview.interviewRound}` : null,
                                ].filter(Boolean) as string[]
                                if (meta.length === 0) return null
                                return <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
                              })()}
                              {interview.candidatePhone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5 tabular-nums">
                                  <Phone className="h-3.5 w-3.5 shrink-0" />
                                  {interview.candidatePhone}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 border-t sm:border-t-0 border-border/60 pt-2 sm:pt-0">
                              <div className="text-left sm:text-right text-sm">
                                <div className="font-semibold text-foreground tabular-nums">
                                  {format(at, 'h:mm a')}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {interview.type === 'VIRTUAL' ? 'Virtual' : 'In person'}
                              </Badge>
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
            <Link href="/hr/recruitment" className="gap-1">
              Open recruitment
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Interviews vs New Hires Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <CardTitle className="text-lg">Interviews vs New Hires</CardTitle>
            </div>
            <CardDescription>
              Last 12 months ending {MONTHS[filters.month - 1]} {filters.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-4 pb-3">
            {/* Mobile: table */}
            <div className="sm:hidden px-3 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm h-10">Month</TableHead>
                    <TableHead className="text-sm h-10 text-right">Interviews</TableHead>
                    <TableHead className="text-sm h-10 text-right">New hires</TableHead>
                  </TableRow>
                </TableHeader>
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
            {/* Desktop: chart */}
            <div className="hidden sm:block w-full overflow-x-auto overscroll-x-contain touch-pan-x">
              <ChartContainer
                config={{
                  interviews: { label: 'Interviews', color: 'hsl(239 84% 67%)' },
                  newHires: { label: 'New hires', color: 'hsl(173 58% 40%)' },
                }}
                className="h-[280px] w-full min-w-[520px] sm:min-w-0 aspect-auto mx-auto"
              >
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
    </div>
  )
}
