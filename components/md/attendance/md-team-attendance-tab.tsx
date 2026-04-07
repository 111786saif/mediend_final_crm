'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react'
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
  const onTime = counts['on-time'] ?? 0
  const halfDay = counts['half-day'] ?? 0
  const leaves = member.leaveDays.reduce((s, l) => s + (l.isHalfDay ? 0.5 : 1), 0)
  return { grace1, grace2, late, onTime, halfDay, leaves, counts }
}

type PendingNormLite = { employeeId: string; date: string }

type LeaveBalanceEntry = {
  employeeId: string
  employeeName: string
  employeeEmail: string
  isProbation: boolean
  balances: {
    leaveTypeId: string
    leaveTypeName: string
    allocated: number
    used: number
    remaining: number
    locked: number
  }[]
}

type LeaveBalancesResponse = {
  balances: LeaveBalanceEntry[]
}

type SearchEmployee = {
  id: string
  userId: string
  employeeCode: string | null
  name: string
  email: string
  role: string
  departmentName: string | null
}

type MDTeamAttendanceTabProps = {
  highlightNormalizations?: PendingNormLite[]
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function MDTeamAttendanceTab({ highlightNormalizations = [] }: MDTeamAttendanceTabProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [drawerMember, setDrawerMember] = useState<MergedMember | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const [selectedSearchEmployee, setSelectedSearchEmployee] = useState<SearchEmployee | null>(null)

  const today = new Date()
  const isCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() &&
    viewMonth.getMonth() === today.getMonth()
  const fromDate = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
  const toDate = format(isCurrentMonth ? today : endOfMonth(viewMonth), 'yyyy-MM-dd')

  // Team data (default view)
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

  const { data: balancesData } = useQuery<LeaveBalancesResponse>({
    queryKey: ['hierarchy', 'my-team', 'leave-balances'],
    queryFn: () => apiGet<LeaveBalancesResponse>('/api/hierarchy/my-team/leave-balances'),
    enabled: (teamData?.subordinates.length ?? 0) > 0,
  })

  // Search employees
  const { data: searchResults } = useQuery<SearchEmployee[]>({
    queryKey: ['md', 'employees', 'search', debouncedSearch],
    queryFn: () => apiGet<SearchEmployee[]>(`/api/md/employees?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length >= 2,
  })

  // Fetch searched employee's attendance
  const { data: searchedAttData } = useQuery<{
    entry: TeamAttendanceApiEntry
    holidayDays: { date: string; name: string }[]
  }>({
    queryKey: ['md', 'employee-attendance', selectedSearchEmployee?.id, fromDate, toDate],
    queryFn: () =>
      apiGet(`/api/md/employee-attendance?employeeId=${selectedSearchEmployee!.id}&fromDate=${fromDate}&toDate=${toDate}`),
    enabled: !!selectedSearchEmployee,
  })

  // Fetch searched employee's leave balance
  const { data: searchedBalanceData } = useQuery<{
    balance: LeaveBalanceEntry
  }>({
    queryKey: ['md', 'employee-leave-balance', selectedSearchEmployee?.id],
    queryFn: () =>
      apiGet(`/api/md/employee-leave-balance?employeeId=${selectedSearchEmployee!.id}`),
    enabled: !!selectedSearchEmployee,
  })

  const balancesByEmployee = useMemo(() => {
    const map = new Map<string, LeaveBalanceEntry>()
    for (const b of balancesData?.balances ?? []) map.set(b.employeeId, b)
    if (searchedBalanceData?.balance) {
      map.set(searchedBalanceData.balance.employeeId, searchedBalanceData.balance)
    }
    return map
  }, [balancesData, searchedBalanceData])

  const holidayDays = selectedSearchEmployee
    ? (searchedAttData?.holidayDays ?? [])
    : (attData?.holidayDays ?? [])

  const members = useMemo(() => {
    if (selectedSearchEmployee && searchedAttData) {
      const entry = searchedAttData.entry
      return [{
        employeeId: selectedSearchEmployee.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        departmentName: selectedSearchEmployee.departmentName,
        attendance: entry.attendance,
        leaveDays: entry.leaveDays,
        leaveByType: entry.leaveByType,
      }]
    }
    const subs = teamData?.subordinates ?? []
    return mergeTeamWithAttendance(subs, attData?.entries ?? [])
  }, [teamData, attData, selectedSearchEmployee, searchedAttData])

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

  const handleSelectSearchResult = (emp: SearchEmployee) => {
    setSelectedSearchEmployee(emp)
    setSearchQuery('')
  }

  const handleClearSearch = () => {
    setSelectedSearchEmployee(null)
    setSearchQuery('')
  }

  if (teamLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value === '') setSelectedSearchEmployee(null)
              }}
              placeholder="Search any employee in the org..."
              className="pl-9"
            />
          </div>
          {selectedSearchEmployee && (
            <Button variant="outline" size="sm" onClick={handleClearSearch} className="shrink-0 gap-1.5">
              <X className="h-3.5 w-3.5" />
              Back to team
            </Button>
          )}
        </div>
        {/* Search dropdown */}
        {searchQuery.length >= 2 && !selectedSearchEmployee && searchResults && searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 flex items-center gap-3 border-b last:border-0"
                onClick={() => handleSelectSearchResult(emp)}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs font-semibold">
                    {emp.name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                </div>
                {emp.departmentName && (
                  <span className="text-xs text-muted-foreground shrink-0">{emp.departmentName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected search employee indicator */}
      {selectedSearchEmployee && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm">
            Viewing: <strong>{selectedSearchEmployee.name}</strong>
            {selectedSearchEmployee.departmentName && (
              <span className="text-muted-foreground"> · {selectedSearchEmployee.departmentName}</span>
            )}
          </span>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Previous month"
          onClick={() => setViewMonth((d) => startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold text-center">
          {format(viewMonth, 'MMMM yyyy')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Next month"
          onClick={() => setViewMonth((d) => startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading && attData === undefined && !selectedSearchEmployee && (
        <p className="text-center text-sm text-muted-foreground py-4">Loading attendance...</p>
      )}

      {!selectedSearchEmployee && !teamData?.subordinates.length && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-60" />
            No direct reports yet.
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.employeeId}>
            <button
              type="button"
              className="w-full text-left rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
              onClick={() => setDrawerMember(m)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-sm font-semibold">
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
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Detail drawer */}
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
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
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
                  {format(viewMonth, 'MMMM yyyy')}
                </p>
              </DrawerHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Period summary
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {drawerSummary.onTime}
                        </p>
                        <p className="text-xs text-muted-foreground">On time</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">
                          {drawerSummary.grace1}
                        </p>
                        <p className="text-xs text-muted-foreground">Grace 1</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums">
                          {drawerSummary.grace2}
                        </p>
                        <p className="text-xs text-muted-foreground">Grace 2</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                          {drawerSummary.late}
                        </p>
                        <p className="text-xs text-muted-foreground">Late / penalty</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums text-pink-700 dark:text-pink-300">
                          {drawerSummary.halfDay}
                        </p>
                        <p className="text-xs text-muted-foreground">Half day</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                          {drawerSummary.leaves}
                        </p>
                        <p className="text-xs text-muted-foreground">Leaves</p>
                      </div>
                      <div className="rounded-lg border p-3 sm:col-span-2">
                        <p className="text-2xl font-bold tabular-nums">
                          {(drawerSummary.counts['normalized'] ?? 0) +
                            (drawerSummary.counts['pending-normalization'] ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Normalized / pending</p>
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
                          <Badge key={lt.code} variant="secondary" className="text-sm px-3 py-1">
                            {lt.code}: {lt.days} day{lt.days !== 1 ? 's' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {balancesByEmployee.get(drawerMember.employeeId) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Leave balance
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {balancesByEmployee.get(drawerMember.employeeId)!.balances.map((b) => (
                          <div
                            key={b.leaveTypeId}
                            className="rounded-lg border p-2.5 text-center"
                          >
                            <p className="text-[10px] text-muted-foreground font-medium mb-1 truncate">
                              {b.leaveTypeName}
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-none">
                              {b.remaining}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {b.used} used / {b.allocated} total
                            </p>
                            {b.locked > 0 && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                                {b.locked} locked
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Calendar
                    </p>
                    <div className="rounded-lg border bg-card p-2 -mx-1">
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
                <Button variant="outline" className="w-full h-11 rounded-lg" onClick={() => setDrawerMember(null)}>
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
