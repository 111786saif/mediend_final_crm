'use client'

import {
  AttendanceHeatmap,
  countAttendanceStatusesInPeriod,
  type AttendanceDay,
} from '@/components/employee/attendance-heatmap'
import { SelectableAttendanceHeatmap } from '@/components/employee/selectable-attendance-heatmap'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { getDisabledNormalizationDateKeys } from '@/lib/hrms/normalization-deadline'
import { Calendar, Check, Clock, Users, X, UserCheck, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ManagerMarkLeavePanel } from '@/components/hrms/ManagerMarkLeavePanel'

interface LeaveDayRow {
  date: string
  isUnpaid: boolean
  isHalfDay?: boolean
}

interface LeaveByTypeRow {
  code: string
  days: number
}

interface AttendanceEntry {
  employeeId: string
  name: string
  email: string
  role: string
  attendance: AttendanceDay[]
  leaveDays: LeaveDayRow[]
  leaveByType: LeaveByTypeRow[]
}

interface TeamAttendanceResponse {
  entries: AttendanceEntry[]
  holidayDays: { date: string; name: string }[]
  fromDate: string | null
  toDate: string | null
}

interface TeamMember {
  id: string
  userId: string
  employeeCode: string
  name: string
  email: string
  role: string
  departmentName: string | null
  subordinateCount: number
  hasSubordinates: boolean
}

interface TeamTreeResponse {
  managerEmployeeId: string
  members: TeamMember[]
}

interface TeamLeave {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedAt: string | null
  createdAt: string
}

interface TeamLeavesResponse {
  leaves: TeamLeave[]
}

interface NormalizationRecord {
  id: string
  employeeId: string
  date: string
  type: string
  status: string
  reason: string | null
  normalizeAs: string | null
  hrRejectionReason: string | null
  createdAt: string
  attendanceIn: string | null
  attendanceOut: string | null
  employee: { id: string; employeeCode: string; user: { name: string; email: string } }
  requestedBy?: { id: string; user: { name: string } }
  approvedBy?: { id: string; user: { name: string } } | null
}

function formatPunchUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function normalizationTypeLabel(type: string): string {
  switch (type) {
    case 'EMPLOYEE_REQUEST':
      return 'Employee → HR'
    case 'MANAGER':
      return 'Manager → HR'
    case 'SELF':
      return 'Self'
    default:
      return type
  }
}

interface TeamNormalizationResponse {
  list: NormalizationRecord[]
  subordinates: { id: string; employeeCode: string; name: string; email: string }[]
}

const PRIMARY_LEAVE_CODES = ['CL', 'SL', 'EL'] as const

function formatLeaveTypeDays(n: number | undefined): string {
  if (n === undefined || n === 0) return '—'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

function LeaveTypeBreakdown({ rows }: { rows: LeaveByTypeRow[] }) {
  const map = new Map(rows.map((r) => [r.code, r.days]))
  const extra = rows.filter((r) => !PRIMARY_LEAVE_CODES.includes(r.code as (typeof PRIMARY_LEAVE_CODES)[number]))
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground border-b border-border/40 pb-2.5 mb-2.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 shrink-0">
        Leave (days)
      </span>
      {PRIMARY_LEAVE_CODES.map((code) => (
        <span key={code} className="whitespace-nowrap">
          <span className="font-medium text-foreground/75">{code}</span>{' '}
          <span className="tabular-nums">{formatLeaveTypeDays(map.get(code))}</span>
        </span>
      ))}
      {extra.map((r) => (
        <span key={r.code} className="whitespace-nowrap">
          <span className="font-medium text-foreground/75">{r.code}</span>{' '}
          <span className="tabular-nums">{formatLeaveTypeDays(r.days)}</span>
        </span>
      ))}
    </div>
  )
}

function AttendancePeriodStats({
  attendance,
  leaveDays,
  holidayDays,
  fromDate,
  toDate,
}: {
  attendance: AttendanceDay[]
  leaveDays: LeaveDayRow[]
  holidayDays: { date: string; name: string }[]
  fromDate: string
  toDate: string
}): ReactNode {
  const segments = useMemo(() => {
    const counts = countAttendanceStatusesInPeriod(
      attendance,
      leaveDays,
      holidayDays,
      fromDate,
      toDate
    )
    const n = (k: string) => counts[k as keyof typeof counts] ?? 0
    const leave =
      n('paid-leave') + n('unpaid-leave') + n('paid-leave-half') + n('unpaid-leave-half')
    const norm = n('normalized') + n('pending-normalization')
    const items: { label: string; value: number }[] = [
      { label: 'On time', value: n('on-time') + n('present') },
      { label: 'G1', value: n('grace-1') },
      { label: 'G2', value: n('grace-2') },
      { label: 'Late ₹', value: n('late-penalty') },
      { label: 'Late', value: n('late') },
      { label: 'Half', value: n('half-day') },
      { label: 'Leave', value: leave },
      { label: 'Absent', value: n('absent') },
      { label: 'Norm', value: norm },
    ]
    return items.filter((i) => i.value > 0)
  }, [attendance, leaveDays, holidayDays, fromDate, toDate])

  if (segments.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">No calendar days in selected range.</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-snug text-muted-foreground border-b border-border/60 pb-3 mb-3">
      {segments.map(({ label, value }) => (
        <span key={label} className="whitespace-nowrap">
          <span className="tabular-nums font-semibold text-foreground">{value}</span>
          <span className="ml-1">{label}</span>
        </span>
      ))}
    </div>
  )
}

export default function MyTeamPage() {
  const queryClient = useQueryClient()
  const [fromDate, setFromDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  )
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('PENDING')
  const [selectedLeave, setSelectedLeave] = useState<TeamLeave | null>(null)
  const [remarks, setRemarks] = useState('')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [normEmployeeId, setNormEmployeeId] = useState('')
  const [normReason, setNormReason] = useState('')
  const [normNormalizeAs, setNormNormalizeAs] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY')
  const [selectedNormDates, setSelectedNormDates] = useState<Set<string>>(new Set())
  const [drillDownManager, setDrillDownManager] = useState<TeamMember | null>(null)

  const { data: treeData } = useQuery<TeamTreeResponse>({
    queryKey: ['hierarchy', 'my-team', 'tree'],
    queryFn: () => apiGet<TeamTreeResponse>('/api/hierarchy/my-team/tree'),
  })

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ['hierarchy', 'my-team', 'attendance', fromDate, toDate],
    queryFn: () =>
      apiGet<TeamAttendanceResponse>(
        `/api/hierarchy/my-team/attendance?fromDate=${fromDate}&toDate=${toDate}`
      ),
  })

  const { data: leavesData, isLoading: leavesLoading } = useQuery<TeamLeavesResponse>({
    queryKey: ['hierarchy', 'my-team', 'leaves', leaveStatusFilter],
    queryFn: () =>
      apiGet<TeamLeavesResponse>(`/api/hierarchy/my-team/leaves?status=${leaveStatusFilter}`),
  })

  const { data: normData, isLoading: normLoading } = useQuery<TeamNormalizationResponse>({
    queryKey: ['attendance', 'normalize', 'team', fromDate, toDate],
    queryFn: () =>
      apiGet<TeamNormalizationResponse>(
        `/api/attendance/normalize/team?fromDate=${fromDate}&toDate=${toDate}`
      ),
  })

  const normalizeMutation = useMutation({
    mutationFn: (payload: { employeeId: string; dates: string[]; reason?: string; normalizeAs?: 'FULL_DAY' | 'HALF_DAY' }) =>
      apiPost<{ created?: number; skipped?: number }>('/api/attendance/normalize/manager', payload),
    onSuccess: (data: { created?: number; skipped?: number }) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'team'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'attendance'] })
      setSelectedNormDates(new Set())
      const created = data?.created ?? 0
      const skipped = data?.skipped ?? 0
      if (created > 0) toast.success(`Normalized ${created} day(s)${skipped > 0 ? ` (${skipped} already normalized)` : ''}`)
      else if (skipped > 0) toast.info('All selected days were already normalized')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to normalize'),
  })

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      remarks: r,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      remarks?: string
    }) => apiPatch(`/api/leaves/${id}/approve`, { status, remarks: r }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'leaves'] })
      setApproveDialogOpen(false)
      setSelectedLeave(null)
      setRemarks('')
      toast.success('Leave request updated')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update leave'),
  })

  const handleApproveClick = (leave: TeamLeave, action: 'APPROVED' | 'REJECTED') => {
    setSelectedLeave(leave)
    setApproveDialogOpen(true)
  }

  const handleApproveSubmit = (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedLeave) return
    approveMutation.mutate({ id: selectedLeave.id, status, remarks: remarks || undefined })
  }

  const entries = attendanceData?.entries ?? []
  const holidayDays = attendanceData?.holidayDays ?? []
  const leaves = leavesData?.leaves ?? []
  const from = attendanceData?.fromDate ?? fromDate
  const to = attendanceData?.toDate ?? toDate

  const normTargetEntry = useMemo(
    () => entries.find((e) => e.employeeId === normEmployeeId),
    [entries, normEmployeeId]
  )

  /** Dates past normalization deadline (week rule from Apr 2026, else 5th of next month). */
  const normalizationDisabledDateKeys = useMemo(
    () => getDisabledNormalizationDateKeys(from, to),
    [from, to]
  )

  const members = treeData?.members ?? []

  const managerMarkTeamOptions = useMemo(() => {
    const m = new Map<string, { id: string; name: string; email: string; employeeCode?: string }>()
    for (const mem of members) {
      m.set(mem.id, {
        id: mem.id,
        name: mem.name,
        email: mem.email,
        employeeCode: mem.employeeCode,
      })
    }
    for (const ent of entries) {
      if (!m.has(ent.employeeId)) {
        m.set(ent.employeeId, {
          id: ent.employeeId,
          name: ent.name,
          email: ent.email,
        })
      }
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [members, entries])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Team</h1>
        <p className="text-muted-foreground mt-1">
          Attendance (with approved leave in range), summaries, and leave approvals for your team
        </p>
      </div>

      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team hierarchy
            </CardTitle>
            <CardDescription>
              Your direct reports. Click &quot;View team&quot; on team leads to see their team&apos;s attendance and leaves.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.employeeCode} · {m.role.replace('_', ' ')}
                      {m.subordinateCount > 0 && ` · ${m.subordinateCount} report(s)`}
                    </p>
                  </div>
                  {m.hasSubordinates && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDrillDownManager(m)}
                      className="shrink-0"
                    >
                      <ChevronRight className="h-4 w-4 mr-1" />
                      View team
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <TeamDrillDownSheet
        manager={drillDownManager}
        open={!!drillDownManager}
        onOpenChange={(open) => !open && setDrillDownManager(null)}
        fromDate={fromDate}
        toDate={toDate}
        onDateChange={(f, t) => {
          setFromDate(f)
          setToDate(t)
        }}
      />

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" />
            Attendance &amp; leave
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2">
            <Calendar className="h-4 w-4" />
            Leaves
          </TabsTrigger>
          <TabsTrigger value="normalization" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Normalization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Date range</CardTitle>
              <CardDescription>Heatmaps include approved leave and official holidays in this range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div>
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {attendanceLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading attendance...</div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>
                  No team data in this range (no punches or approved leave), or you have no direct reports.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {entries.map((entry) => (
                <Card key={entry.employeeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{entry.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {entry.email} · {entry.role.replace(/_/g, ' ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AttendancePeriodStats
                      attendance={entry.attendance}
                      leaveDays={entry.leaveDays ?? []}
                      holidayDays={holidayDays}
                      fromDate={from}
                      toDate={to}
                    />
                    <LeaveTypeBreakdown rows={entry.leaveByType ?? []} />
                    <AttendanceHeatmap
                      attendance={entry.attendance}
                      fromDate={from}
                      toDate={to}
                      leaveDays={entry.leaveDays ?? []}
                      holidayDays={holidayDays}
                      showLegend={false}
                    />
                  </CardContent>
                </Card>
              ))}
              <p className="text-[11px] text-muted-foreground px-1">
                Hover any cell for punch times and status. Counts match the grid (payroll rules).
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter</CardTitle>
              <CardDescription>Leave requests from your team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={leaveStatusFilter === 'PENDING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('PENDING')}
                >
                  Pending
                </Button>
                <Button
                  variant={leaveStatusFilter === 'APPROVED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('APPROVED')}
                >
                  Approved
                </Button>
                <Button
                  variant={leaveStatusFilter === 'REJECTED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('REJECTED')}
                >
                  Rejected
                </Button>
              </div>
            </CardContent>
          </Card>

          <ManagerMarkLeavePanel teamOptions={managerMarkTeamOptions} />

          <Card>
            <CardHeader>
              <CardTitle>Leave requests</CardTitle>
              <CardDescription>{leaves.length} request(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {leavesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {leaveStatusFilter === 'PENDING' && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">
                          {leave.employeeName}
                          <span className="block text-xs text-muted-foreground">
                            {leave.employeeEmail}
                          </span>
                        </TableCell>
                        <TableCell>{leave.leaveType}</TableCell>
                        <TableCell>{format(new Date(leave.startDate), 'PP')}</TableCell>
                        <TableCell>{format(new Date(leave.endDate), 'PP')}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          {leave.reason || '—'}
                        </TableCell>
                        <TableCell>
                          {leave.status === 'PENDING' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {leave.status === 'APPROVED' && (
                            <Badge variant="default">Approved</Badge>
                          )}
                          {leave.status === 'REJECTED' && (
                            <Badge variant="destructive">Rejected</Badge>
                          )}
                        </TableCell>
                        {leaveStatusFilter === 'PENDING' && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveClick(leave, 'APPROVED')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApproveClick(leave, 'REJECTED')}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {leaves.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={leaveStatusFilter === 'PENDING' ? 8 : 7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="normalization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team normalization status</CardTitle>
              <CardDescription>
                Read-only visibility for your direct and indirect reports. Shows each request, raw punch times for that date (UTC), and HR outcome. HR approves employee and manager-submitted requests—you stay informed but do not approve here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {normLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : !normData?.list?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  No normalization records in this date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>In</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>As</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normData.list.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {n.employee?.user?.name ?? '—'}
                            <span className="block text-xs text-muted-foreground font-normal">
                              {n.employee?.employeeCode}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{format(parseISO(n.date), 'PP')}</TableCell>
                          <TableCell className="tabular-nums text-sm">{formatPunchUtc(n.attendanceIn)}</TableCell>
                          <TableCell className="tabular-nums text-sm">{formatPunchUtc(n.attendanceOut)}</TableCell>
                          <TableCell className="text-sm">{normalizationTypeLabel(n.type)}</TableCell>
                          <TableCell className="text-sm">
                            {n.normalizeAs === 'HALF_DAY'
                              ? 'Half day'
                              : n.normalizeAs === 'FULL_DAY'
                                ? 'Full day'
                                : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                n.status === 'APPROVED'
                                  ? 'default'
                                  : n.status === 'REJECTED'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {n.status}
                            </Badge>
                            {n.status === 'REJECTED' && n.hrRejectionReason && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] line-clamp-3">
                                {n.hrRejectionReason}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px] text-sm">
                            <span className="line-clamp-2">{n.reason || '—'}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {n.requestedBy?.user?.name ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Apply for normalization (on behalf)</CardTitle>
              <CardDescription>
                Select a team member and date range, then click days on the heatmap to apply for normalization on their behalf. Deadline rules apply (same week from April 2026, or 5th of next month before that). Applications go to HR for approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label>Date range</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-[140px]"
                    />
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-[140px]"
                    />
                  </div>
                </div>
                <div>
                  <Label>Employee</Label>
                  <select
                    className="mt-1 flex h-9 w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={normEmployeeId}
                    onChange={(e) => {
                      setNormEmployeeId(e.target.value)
                      setSelectedNormDates(new Set())
                    }}
                  >
                    <option value="">Select team member...</option>
                    {(normData?.subordinates ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {normEmployeeId && (
                <>
                  <SelectableAttendanceHeatmap
                    attendance={normTargetEntry?.attendance ?? []}
                    fromDate={from}
                    toDate={to}
                    selectedDates={selectedNormDates}
                    onSelectionChange={setSelectedNormDates}
                    disabledDateKeys={normalizationDisabledDateKeys}
                    leaveDays={normTargetEntry?.leaveDays ?? []}
                  />

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs text-muted-foreground">Normalize as</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          type="button"
                          variant={normNormalizeAs === 'FULL_DAY' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNormNormalizeAs('FULL_DAY')}
                        >
                          Full day
                        </Button>
                        <Button
                          type="button"
                          variant={normNormalizeAs === 'HALF_DAY' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNormNormalizeAs('HALF_DAY')}
                        >
                          Half day
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                      <Input
                        value={normReason}
                        onChange={(e) => setNormReason(e.target.value)}
                        placeholder="e.g. Official travel"
                        className="mt-1 max-w-xs"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (selectedNormDates.size === 0) {
                          toast.error('Select at least one day on the heatmap')
                          return
                        }
                        normalizeMutation.mutate({
                          employeeId: normEmployeeId,
                          dates: Array.from(selectedNormDates),
                          reason: normReason || undefined,
                          normalizeAs: normNormalizeAs,
                        })
                      }}
                      disabled={selectedNormDates.size === 0 || normalizeMutation.isPending}
                      className="mt-6"
                    >
                      {normalizeMutation.isPending
                        ? 'Applying...'
                        : `Apply for ${selectedNormDates.size} day(s)`}
                    </Button>
                  </div>
                </>
              )}

              {!normEmployeeId && (
                <p className="text-sm text-muted-foreground py-4">
                  Select an employee to see their attendance and choose days to normalize.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve / Reject leave</DialogTitle>
            <DialogDescription>
              {selectedLeave &&
                `${selectedLeave.employeeName} · ${selectedLeave.leaveType} (${selectedLeave.days} days)`}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>
                  <p className="font-medium">{format(new Date(selectedLeave.startDate), 'PPP')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>
                  <p className="font-medium">{format(new Date(selectedLeave.endDate), 'PPP')}</p>
                </div>
                {selectedLeave.reason && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Reason:</span>
                    <p className="font-medium">{selectedLeave.reason}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleApproveSubmit('REJECTED')}
                  disabled={approveMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApproveSubmit('APPROVED')}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TeamDrillDownSheet({
  manager,
  open,
  onOpenChange,
  fromDate,
  toDate,
  onDateChange,
}: {
  manager: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  fromDate: string
  toDate: string
  onDateChange: (from: string, to: string) => void
}) {
  const queryClient = useQueryClient()
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('PENDING')
  const [selectedLeave, setSelectedLeave] = useState<TeamLeave | null>(null)
  const [remarks, setRemarks] = useState('')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<TeamAttendanceResponse>({
    queryKey: ['hierarchy', 'my-team', 'attendance', manager?.id, fromDate, toDate],
    queryFn: () =>
      apiGet<TeamAttendanceResponse>(
        `/api/hierarchy/my-team/attendance?fromDate=${fromDate}&toDate=${toDate}&managerEmployeeId=${manager?.id}`
      ),
    enabled: open && !!manager?.id,
  })

  const { data: leavesData, isLoading: leavesLoading } = useQuery<TeamLeavesResponse>({
    queryKey: ['hierarchy', 'my-team', 'leaves', manager?.id, leaveStatusFilter],
    queryFn: () =>
      apiGet<TeamLeavesResponse>(
        `/api/hierarchy/my-team/leaves?status=${leaveStatusFilter}&managerEmployeeId=${manager?.id}`
      ),
    enabled: open && !!manager?.id,
  })

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      remarks: r,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      remarks?: string
    }) => apiPatch(`/api/leaves/${id}/approve`, { status, remarks: r }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'leaves'] })
      setApproveDialogOpen(false)
      setSelectedLeave(null)
      setRemarks('')
      toast.success('Leave request updated')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update leave'),
  })

  const handleApproveSubmit = (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedLeave) return
    approveMutation.mutate({ id: selectedLeave.id, status, remarks: remarks || undefined })
  }

  const entries = attendanceData?.entries ?? []
  const sheetHolidayDays = attendanceData?.holidayDays ?? []
  const leaves = leavesData?.leaves ?? []
  const from = attendanceData?.fromDate ?? fromDate
  const to = attendanceData?.toDate ?? toDate

  if (!manager) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{manager.name}&apos;s team</SheetTitle>
            <SheetDescription>
              {manager.employeeCode} · {manager.role.replace('_', ' ')} · {manager.subordinateCount} report(s)
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Date range</CardTitle>
                <CardDescription>Heatmaps include approved leave and holidays in range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => onDateChange(e.target.value, toDate)}
                    />
                  </div>
                  <div>
                    <Label>To</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => onDateChange(fromDate, e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Attendance &amp; leave
              </h4>
              {attendanceLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm rounded-lg border border-dashed">
                  No punches or approved leave in this range
                </div>
              ) : (
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <Card key={entry.employeeId}>
                      <CardHeader className="py-3 pb-2">
                        <CardTitle className="text-base">{entry.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {entry.email} · {entry.role.replace(/_/g, ' ')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <AttendancePeriodStats
                          attendance={entry.attendance}
                          leaveDays={entry.leaveDays ?? []}
                          holidayDays={sheetHolidayDays}
                          fromDate={from}
                          toDate={to}
                        />
                        <LeaveTypeBreakdown rows={entry.leaveByType ?? []} />
                        <AttendanceHeatmap
                          attendance={entry.attendance}
                          fromDate={from}
                          toDate={to}
                          leaveDays={entry.leaveDays ?? []}
                          holidayDays={sheetHolidayDays}
                          showLegend={false}
                        />
                      </CardContent>
                    </Card>
                  ))}
                  <p className="text-[11px] text-muted-foreground px-1">
                    Hover cells for details. Approve or reject requests in the list below.
                  </p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave requests
              </h4>
              <div className="flex gap-2 mb-3">
                <Button
                  variant={leaveStatusFilter === 'PENDING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('PENDING')}
                >
                  Pending
                </Button>
                <Button
                  variant={leaveStatusFilter === 'APPROVED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('APPROVED')}
                >
                  Approved
                </Button>
                <Button
                  variant={leaveStatusFilter === 'REJECTED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLeaveStatusFilter('REJECTED')}
                >
                  Rejected
                </Button>
              </div>
              {leavesLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        {leaveStatusFilter === 'PENDING' && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium text-sm">
                            {leave.employeeName}
                            <span className="block text-xs text-muted-foreground">{leave.employeeEmail}</span>
                          </TableCell>
                          <TableCell className="text-sm">{leave.leaveType}</TableCell>
                          <TableCell className="text-sm">{format(new Date(leave.startDate), 'PP')}</TableCell>
                          <TableCell className="text-sm">{format(new Date(leave.endDate), 'PP')}</TableCell>
                          <TableCell className="text-sm">{leave.days}</TableCell>
                          <TableCell>
                            {leave.status === 'PENDING' && <Badge variant="secondary">Pending</Badge>}
                            {leave.status === 'APPROVED' && <Badge variant="default">Approved</Badge>}
                            {leave.status === 'REJECTED' && <Badge variant="destructive">Rejected</Badge>}
                          </TableCell>
                          {leaveStatusFilter === 'PENDING' && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => {
                                    setSelectedLeave(leave)
                                    setApproveDialogOpen(true)
                                  }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedLeave(leave)
                                    setApproveDialogOpen(true)
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {leaves.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={leaveStatusFilter === 'PENDING' ? 7 : 6}
                            className="text-center text-muted-foreground py-8 text-sm"
                          >
                            No leave requests
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve / Reject leave</DialogTitle>
            <DialogDescription>
              {selectedLeave &&
                `${selectedLeave.employeeName} · ${selectedLeave.leaveType} (${selectedLeave.days} days)`}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>
                  <p className="font-medium">{format(new Date(selectedLeave.startDate), 'PPP')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>
                  <p className="font-medium">{format(new Date(selectedLeave.endDate), 'PPP')}</p>
                </div>
                {selectedLeave.reason && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Reason:</span>
                    <p className="font-medium">{selectedLeave.reason}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Remarks (optional)</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleApproveSubmit('REJECTED')}
                  disabled={approveMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleApproveSubmit('APPROVED')}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
