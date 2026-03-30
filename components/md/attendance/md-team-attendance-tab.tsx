'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AttendanceHeatmap,
  countAttendanceStatusesInPeriod,
  type AttendanceDay as HeatmapAttendanceDay,
} from '@/components/employee/attendance-heatmap'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type TeamSubordinate = {
  id: string
  userId: string
  employeeCode: string | null
  name: string
  email: string
  role: string
  departmentName: string | null
}

type TeamAttendanceApiEntry = {
  employeeId: string
  name: string
  email: string
  role: string
  attendance: Array<{
    date: string
    inTime: string | null
    outTime: string | null
    workHours?: number | null
    isLate: boolean
    status?: string
    penalty?: number
    isHalfDay?: boolean
    isNormalized?: boolean
    isPendingNormalization?: boolean
  }>
  leaveDays: Array<{ date: string; isUnpaid: boolean; isHalfDay?: boolean }>
  leaveByType: Array<{ code: string; days: number }>
}

type TeamAttendanceApiResponse = {
  entries: TeamAttendanceApiEntry[]
  holidayDays: { date: string; name: string }[]
  fromDate: string | null
  toDate: string | null
}

type MyTeamApiResponse = {
  subordinates: TeamSubordinate[]
  count: number
}

function toHeatmapAttendance(rows: TeamAttendanceApiEntry['attendance']): HeatmapAttendanceDay[] {
  return rows.map((r) => ({
    date: new Date(r.date),
    inTime: r.inTime ? new Date(r.inTime) : null,
    outTime: r.outTime ? new Date(r.outTime) : null,
    workHours: r.workHours ?? null,
    isLate: r.isLate,
    status: r.status as HeatmapAttendanceDay['status'] | undefined,
    penalty: r.penalty,
    isHalfDay: r.isHalfDay,
    isNormalized: r.isNormalized,
    isPendingNormalization: r.isPendingNormalization,
  }))
}

type MergedMember = {
  employeeId: string
  name: string
  email: string
  role: string
  departmentName: string | null
  attendance: TeamAttendanceApiEntry['attendance']
  leaveDays: TeamAttendanceApiEntry['leaveDays']
  leaveByType: TeamAttendanceApiEntry['leaveByType']
}

function mergeTeamWithAttendance(
  subordinates: TeamSubordinate[],
  entries: TeamAttendanceApiEntry[]
): MergedMember[] {
  const byId = new Map(entries.map((e) => [e.employeeId, e]))
  return subordinates.map((s) => {
    const e = byId.get(s.id)
    return {
      employeeId: s.id,
      name: e?.name ?? s.name,
      email: e?.email ?? s.email,
      role: e?.role ?? s.role,
      departmentName: s.departmentName,
      attendance: e?.attendance ?? [],
      leaveDays: e?.leaveDays ?? [],
      leaveByType: e?.leaveByType ?? [],
    }
  })
}

function summaryCounts(
  member: MergedMember,
  fromDate: string,
  toDate: string,
  holidayDays: { date: string; name: string }[]
) {
  const attendance = toHeatmapAttendance(member.attendance)
  const counts = countAttendanceStatusesInPeriod(
    attendance,
    member.leaveDays,
    holidayDays,
    fromDate,
    toDate
  )
  const grace1 = counts['grace-1'] ?? 0
  const grace2 = counts['grace-2'] ?? 0
  const late = (counts['late'] ?? 0) + (counts['late-penalty'] ?? 0)
  const absent = counts['absent'] ?? 0
  const onTime = counts['on-time'] ?? 0
  const halfDay = counts['half-day'] ?? 0
  return { grace1, grace2, late, absent, onTime, halfDay, counts }
}

function StatMini({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-2 py-1.5 text-center min-w-[4.5rem] flex-1',
        className
      )}
    >
      <div className="text-lg font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</div>
    </div>
  )
}

type PendingNormLite = { employeeId: string; date: string }

type MDTeamAttendanceTabProps = {
  highlightNormalizations?: PendingNormLite[]
}

export function MDTeamAttendanceTab({ highlightNormalizations = [] }: MDTeamAttendanceTabProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [drawerMember, setDrawerMember] = useState<MergedMember | null>(null)

  const fromDate = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
  const toDate = format(endOfMonth(viewMonth), 'yyyy-MM-dd')

  const { data: teamData, isLoading: teamLoading } = useQuery<MyTeamApiResponse>({
    queryKey: ['hierarchy', 'my-team'],
    queryFn: () => apiGet<MyTeamApiResponse>('/api/hierarchy/my-team'),
  })

  const { data: attData, isLoading: attLoading } = useQuery<TeamAttendanceApiResponse>({
    queryKey: ['hierarchy', 'my-team', 'attendance', fromDate, toDate],
    queryFn: () =>
      apiGet<TeamAttendanceApiResponse>(
        `/api/hierarchy/my-team/attendance?fromDate=${fromDate}&toDate=${toDate}`
      ),
    enabled: (teamData?.subordinates.length ?? 0) > 0,
  })

  const holidayDays = attData?.holidayDays ?? []

  const members = useMemo(() => {
    const subs = teamData?.subordinates ?? []
    return mergeTeamWithAttendance(subs, attData?.entries ?? [])
  }, [teamData, attData])

  const drawerHighlightKeys = useMemo(() => {
    if (!drawerMember) return []
    return highlightNormalizations
      .filter((n) => n.employeeId === drawerMember.employeeId)
      .map((n) => (n.date.includes('T') ? n.date.split('T')[0]! : n.date))
  }, [drawerMember, highlightNormalizations])

  const drawerSummary = useMemo(() => {
    if (!drawerMember) return null
    return summaryCounts(drawerMember, fromDate, toDate, holidayDays)
  }, [drawerMember, fromDate, toDate, holidayDays])

  const loading = teamLoading || attLoading

  if (teamLoading) {
    return (
      <Card className="border-teal-200/60 dark:border-teal-900/40">
        <CardContent className="flex items-center justify-center p-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  if (!teamData?.subordinates.length) {
    return (
      <Card className="border-dashed border-teal-200/60 dark:border-teal-900/40">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-10 w-10 opacity-60" />
          No direct or indirect reports in your hierarchy yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 dark:border-teal-900/50 dark:bg-teal-950/25">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          aria-label="Previous month"
          onClick={() => setViewMonth((d) => startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-teal-950 dark:text-teal-100">
          {format(viewMonth, 'MMMM yyyy')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          aria-label="Next month"
          onClick={() => setViewMonth((d) => startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading && attData === undefined && (
        <p className="text-center text-sm text-muted-foreground py-4">Loading attendance…</p>
      )}

      <ul className="space-y-2">
        {members.map((m) => {
          const s = summaryCounts(m, fromDate, toDate, holidayDays)
          return (
            <li key={m.employeeId}>
              <button
                type="button"
                className="w-full text-left rounded-2xl border-2 border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40 active:bg-muted/60 touch-manipulation"
                onClick={() => setDrawerMember(m)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 shrink-0 border border-teal-200 dark:border-teal-800">
                    <AvatarFallback className="bg-teal-100 text-teal-900 text-sm dark:bg-teal-950 dark:text-teal-100">
                      {m.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    {m.departmentName && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{m.departmentName}</p>
                    )}
                    {m.leaveByType.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.leaveByType.map((lt) => (
                          <Badge
                            key={lt.code}
                            variant="secondary"
                            className="text-[10px] font-normal px-1.5 py-0"
                          >
                            {lt.code} {lt.days}d
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <StatMini label="G1" value={s.grace1} className="border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30" />
                      <StatMini label="G2" value={s.grace2} className="border-lime-200/80 bg-lime-50/80 dark:bg-lime-950/20" />
                      <StatMini label="Late" value={s.late} className="border-yellow-200/80 bg-yellow-50/80 dark:bg-yellow-950/25" />
                      <StatMini label="Absent" value={s.absent} className="border-red-200/80 bg-red-50/80 dark:bg-red-950/30" />
                    </div>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <Drawer open={!!drawerMember} onOpenChange={(o) => !o && setDrawerMember(null)} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={cn(
            'mt-0 flex max-h-[100dvh] h-[100dvh] flex-col rounded-t-2xl border-0 p-0 gap-0 overflow-hidden',
            '[&>div:first-child]:hidden'
          )}
        >
          {drawerMember && drawerSummary && (
            <>
              <DrawerHeader className="shrink-0 border-b px-4 py-3 text-left space-y-1">
                <div className="flex items-center gap-3 pr-8">
                  <Avatar className="h-12 w-12 border border-teal-200 dark:border-teal-800">
                    <AvatarFallback className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100">
                      {drawerMember.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <DrawerTitle className="text-lg font-semibold leading-tight">{drawerMember.name}</DrawerTitle>
                    <p className="text-xs text-muted-foreground truncate">{drawerMember.email}</p>
                    {drawerMember.departmentName && (
                      <p className="text-[11px] text-muted-foreground truncate">{drawerMember.departmentName}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(viewMonth, 'MMMM yyyy')} · tap a day for details
                </p>
              </DrawerHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Period summary
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/35">
                        <p className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                          {drawerSummary.onTime}
                        </p>
                        <p className="text-xs text-muted-foreground">On time</p>
                      </div>
                      <div className="rounded-xl border border-green-200/80 bg-green-50/90 p-3 dark:border-green-900/50 dark:bg-green-950/35">
                        <p className="text-2xl font-bold tabular-nums text-green-800 dark:text-green-200">
                          {drawerSummary.grace1}
                        </p>
                        <p className="text-xs text-muted-foreground">Grace 1</p>
                      </div>
                      <div className="rounded-xl border border-lime-200/80 bg-lime-50/80 p-3 dark:border-lime-900/40 dark:bg-lime-950/25">
                        <p className="text-2xl font-bold tabular-nums text-lime-900 dark:text-lime-100">
                          {drawerSummary.grace2}
                        </p>
                        <p className="text-xs text-muted-foreground">Grace 2</p>
                      </div>
                      <div className="rounded-xl border border-yellow-200/80 bg-yellow-50/90 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                        <p className="text-2xl font-bold tabular-nums text-yellow-900 dark:text-yellow-100">
                          {drawerSummary.late}
                        </p>
                        <p className="text-xs text-muted-foreground">Late / penalty</p>
                      </div>
                      <div className="rounded-xl border border-pink-200/80 bg-pink-50/90 p-3 dark:border-pink-900/50 dark:bg-pink-950/30">
                        <p className="text-2xl font-bold tabular-nums text-pink-900 dark:text-pink-100">
                          {drawerSummary.halfDay}
                        </p>
                        <p className="text-xs text-muted-foreground">Half day</p>
                      </div>
                      <div className="rounded-xl border border-red-200/80 bg-red-50/90 p-3 dark:border-red-900/50 dark:bg-red-950/35">
                        <p className="text-2xl font-bold tabular-nums text-red-800 dark:text-red-200">
                          {drawerSummary.absent}
                        </p>
                        <p className="text-xs text-muted-foreground">Absent</p>
                      </div>
                      <div className="rounded-xl border border-blue-200/80 bg-blue-50/90 p-3 dark:border-blue-900/50 dark:bg-blue-950/35 sm:col-span-2">
                        <p className="text-2xl font-bold tabular-nums text-blue-800 dark:text-blue-200">
                          {(drawerSummary.counts['normalized'] ?? 0) +
                            (drawerSummary.counts['pending-normalization'] ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Normalized / pending norm.</p>
                      </div>
                    </div>
                  </div>

                  {drawerMember.leaveByType.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Leave taken ({format(viewMonth, 'MMM yyyy')})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {drawerMember.leaveByType.map((lt) => (
                          <Badge key={lt.code} className="text-sm px-3 py-1 bg-teal-600 hover:bg-teal-600">
                            {lt.code}: {lt.days} day{lt.days !== 1 ? 's' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Calendar
                    </p>
                    <div className="rounded-xl border bg-card p-2 -mx-1">
                      <AttendanceHeatmap
                        attendance={toHeatmapAttendance(drawerMember.attendance)}
                        fromDate={fromDate}
                        toDate={toDate}
                        leaveDays={drawerMember.leaveDays}
                        holidayDays={holidayDays}
                        showLegend
                        highlightDateKeys={drawerHighlightKeys}
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
                <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => setDrawerMember(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
