'use client'

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete } from '@/lib/api-client'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AttendanceHeatmap,
  type AttendanceDay as HeatmapAttendanceDay,
} from '@/components/employee/attendance-heatmap'
import { ChevronLeft, ChevronRight, Search, Users, X, UserPlus, UserMinus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddPersonDialog } from '@/components/tasks/add-person-dialog'
import { toast } from 'sonner'

type TeamAttendanceApiEntry = {
  employeeId: string
  name: string
  email: string
  role: string
  departmentName?: string | null
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

type TeamOverviewMemberLite = {
  id: string
  employeeId: string
  name: string
  email: string
  role: string
  department: { id: string; name: string } | null
  source: 'team' | 'watchlist' | 'subordinate'
}

type TeamOverviewApiResponse = {
  members: TeamOverviewMemberLite[]
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
  members: TeamOverviewMemberLite[],
  entries: TeamAttendanceApiEntry[]
): MergedMember[] {
  const byId = new Map(entries.map((e) => [e.employeeId, e]))
  return members.map((m) => {
    const e = byId.get(m.employeeId)
    return {
      employeeId: m.employeeId,
      name: e?.name ?? m.name,
      email: e?.email ?? m.email,
      role: e?.role ?? m.role,
      departmentName: m.department?.name ?? null,
      attendance: e?.attendance ?? [],
      leaveDays: e?.leaveDays ?? [],
      leaveByType: e?.leaveByType ?? [],
    }
  })
}

type PendingNormLite = { employeeId: string; date: string }

type LeaveBalanceEntry = {
  employeeId: string
  employeeName: string
  employeeEmail: string
  balances: {
    leaveTypeId: string
    leaveTypeName: string
    allocated: number
    used: number
    remaining: number
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

const todayKey = format(new Date(), 'yyyy-MM-dd')

function formatAttTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function getTodayRecord(member: MergedMember) {
  return member.attendance.find((a) => a.date.startsWith(todayKey)) ?? null
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
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MergedMember | null>(null)
  const queryClient = useQueryClient()
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const [selectedSearchEmployee, setSelectedSearchEmployee] = useState<SearchEmployee | null>(null)

  const today = new Date()
  const isCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() &&
    viewMonth.getMonth() === today.getMonth()
  const fromDate = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
  const toDate = format(isCurrentMonth ? today : endOfMonth(viewMonth), 'yyyy-MM-dd')

  // MD team members (task team + watchlist + any direct subordinates)
  const { data: teamOverview, isLoading: teamLoading } = useQuery<TeamOverviewApiResponse>({
    queryKey: ['md-team-overview', ''],
    queryFn: () => apiGet<TeamOverviewApiResponse>('/api/md/team-overview'),
  })

  const { data: attData, isLoading: attLoading } = useQuery<TeamAttendanceApiResponse>({
    queryKey: ['md-team-attendance', fromDate, toDate],
    queryFn: () =>
      apiGet<TeamAttendanceApiResponse>(
        `/api/md/team-attendance?fromDate=${fromDate}&toDate=${toDate}`
      ),
    enabled: (teamOverview?.members.length ?? 0) > 0,
  })

  const { data: balancesData } = useQuery<LeaveBalancesResponse>({
    queryKey: ['hierarchy', 'my-team', 'leave-balances'],
    queryFn: () => apiGet<LeaveBalancesResponse>('/api/hierarchy/my-team/leave-balances'),
    enabled: (teamOverview?.members.length ?? 0) > 0,
  })

  const removeMutation = useMutation({
    mutationFn: (employeeId: string) =>
      apiDelete<{ removedMembers: number; removedWatchlist: number }>(
        `/api/md/team-overview/${employeeId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md-team-overview'] })
      queryClient.invalidateQueries({ queryKey: ['md-team-attendance'] })
      toast.success('Removed from team')
      setRemoveTarget(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove')
    },
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
    const list = teamOverview?.members ?? []
    return mergeTeamWithAttendance(list, attData?.entries ?? [])
  }, [teamOverview, attData, selectedSearchEmployee, searchedAttData])

  const drawerHighlightKeys = useMemo(() => {
    if (!drawerMember) return []
    return highlightNormalizations
      .filter((n) => n.employeeId === drawerMember.employeeId)
      .map((n) => (n.date.includes('T') ? n.date.split('T')[0]! : n.date))
  }, [drawerMember, highlightNormalizations])

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

      {!selectedSearchEmployee && !teamOverview?.members.length && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-60" />
            <p>No one on your team yet.</p>
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setAddPersonOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Add person
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedSearchEmployee && (teamOverview?.members.length ?? 0) > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {teamOverview!.members.length} {teamOverview!.members.length === 1 ? 'member' : 'members'}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddPersonOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add person
          </Button>
        </div>
      )}

      {/* Members list */}
      <ul className="space-y-2">
        {members.map((m) => {
          const todayRec = getTodayRecord(m)
          const hasIn = !!todayRec?.inTime
          const hasOut = !!todayRec?.outTime
          const isIn = hasIn && !hasOut
          const dotClass = isIn
            ? 'bg-emerald-500'
            : hasOut
            ? 'bg-amber-500'
            : 'bg-slate-300 dark:bg-slate-600'
          const statusLabel = isIn ? 'In' : hasOut ? 'Out' : 'Not in'

          return (
            <li key={m.employeeId}>
              <button
                type="button"
                className="w-full text-left rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-border/80 hover:shadow-md active:scale-[0.995]"
                onClick={() => setDrawerMember(m)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-semibold">
                        {m.name
                          .split(/\s+/)
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card',
                        dotClass
                      )}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.departmentName || m.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {hasIn ? (
                      <>
                        <div className="flex items-center justify-end gap-1 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">In</span>
                          {formatAttTime(todayRec!.inTime!)}
                        </div>
                        {hasOut ? (
                          <div className="flex items-center justify-end gap-1 text-xs font-medium tabular-nums text-amber-600 dark:text-amber-400">
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Out</span>
                            {formatAttTime(todayRec!.outTime!)}
                          </div>
                        ) : (
                          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">
                            Working
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {statusLabel}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Detail drawer */}
      <Drawer open={!!drawerMember} onOpenChange={(o) => !o && setDrawerMember(null)} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={cn(
            'mt-0 flex max-h-[100dvh] h-[100dvh] flex-col rounded-t-2xl border-0 p-0 gap-0 overflow-hidden',
            '[&>div:first-child]:hidden'
          )}
        >
          {drawerMember && (
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
                  {drawerMember.leaveByType.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Leave taken ({format(viewMonth, 'MMM yyyy')})
                      </p>
                      <div className="flex gap-2">
                        {drawerMember.leaveByType.map((lt) => (
                          <Badge key={lt.code} variant="secondary" className="text-xs px-2.5 py-1 whitespace-nowrap">
                            {lt.code}: {lt.days}d
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
                      <div className="flex gap-2">
                        {balancesByEmployee.get(drawerMember.employeeId)!.balances.map((b) => (
                          <div
                            key={b.leaveTypeId}
                            className="flex-1 min-w-0 rounded-lg border bg-white dark:bg-card p-2.5 text-center"
                          >
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide truncate">
                              {b.leaveTypeName}
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-none mt-1">
                              {b.remaining}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums whitespace-nowrap">
                              {b.used}/{b.allocated}
                            </p>
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

              <div className="shrink-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm flex gap-2">
                {!selectedSearchEmployee && (
                  <Button
                    variant="outline"
                    className="h-11 rounded-lg text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      setRemoveTarget(drawerMember)
                      setDrawerMember(null)
                    }}
                  >
                    <UserMinus className="h-4 w-4 mr-1.5" />
                    Remove
                  </Button>
                )}
                <Button variant="outline" className="flex-1 h-11 rounded-lg" onClick={() => setDrawerMember(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <AddPersonDialog
        open={addPersonOpen}
        onOpenChange={setAddPersonOpen}
        onAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['md-team-attendance'] })
        }}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from your attendance list and task team. You can add them back any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (removeTarget) removeMutation.mutate(removeTarget.employeeId)
              }}
              disabled={removeMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
