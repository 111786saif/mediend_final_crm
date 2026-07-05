'use client'

import { useState, useMemo } from 'react'
import { useTabPermissions } from '@/hooks/use-tab-permissions'
import { PermissionsGuard } from '@/components/permissions-guard'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { BadgeCounts } from '@/app/api/badge-counts/route'
import { format } from 'date-fns'
import { Calendar, FileText, ExternalLink, CalendarDays, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'
import { SectionContainer } from '@/components/employee/section-container'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { AttendanceHeatmap, type AttendanceDay as HeatmapAttendanceDay } from '@/components/employee/attendance-heatmap'
import { LeaveApplicationForm } from '@/components/hrms/LeaveApplicationForm'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { NORMALIZATION_REASON_MIN_CHARS } from '@/lib/hrms/normalization-deadline'
import {
  MIN_FULL_DAY_HOURS,
  MIN_HALF_DAY_HOURS,
  DEFAULT_DEPARTMENT_TIMING,
} from '@/lib/hrms/attendance-constants'

const CORE_HR_TAB_VALUES = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'leaves', label: 'Leaves' },
  { value: 'holidays', label: 'Holidays' },
  { value: 'documents', label: 'Documents' },
  { value: 'policies', label: 'HR Policies' },
] as const

const GRACE2_MONTHLY_MAX = 10

/** Shown on the attendance stats card, HR Policies, and normalize dialog. */
const SELF_NORMALIZATION_RULE_TEXT =
  'You can use up to 3 hours per month, on up to 3 days. Choose 1, 2, or 3 hours per day. Only days where you were in by 11 AM or worked at least 7 hours can be normalized (including days with a late fine); leave and absent days cannot. Or request normalization from HR for days that need approval (with a reason).'

function clockFromHourMinute(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function addMinutesToShift(
  shiftHour: number,
  shiftMinute: number,
  addMinutes: number
): string {
  const total = shiftHour * 60 + shiftMinute + addMinutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return clockFromHourMinute(hh, mm)
}

interface TimingStats {
  shiftStartHour: number
  shiftStartMinute: number
  grace1Minutes: number
  grace2Minutes: number
  penaltyMinutes: number
}

/** Use API timing when present; avoids treating 0 as missing (e.g. midnight hour). */
function coalesceTimingFromStats(stats: AttendanceStats | undefined): TimingStats {
  const d = DEFAULT_DEPARTMENT_TIMING
  if (!stats) {
    return {
      shiftStartHour: d.shiftStartHour,
      shiftStartMinute: d.shiftStartMinute,
      grace1Minutes: d.grace1Minutes,
      grace2Minutes: d.grace2Minutes,
      penaltyMinutes: d.penaltyMinutes,
    }
  }
  return {
    shiftStartHour: Number.isFinite(stats.shiftStartHour) ? stats.shiftStartHour : d.shiftStartHour,
    shiftStartMinute: Number.isFinite(stats.shiftStartMinute) ? stats.shiftStartMinute : d.shiftStartMinute,
    grace1Minutes: Number.isFinite(stats.grace1Minutes) ? stats.grace1Minutes : d.grace1Minutes,
    grace2Minutes: Number.isFinite(stats.grace2Minutes) ? stats.grace2Minutes : d.grace2Minutes,
    penaltyMinutes: Number.isFinite(stats.penaltyMinutes) ? stats.penaltyMinutes : d.penaltyMinutes,
  }
}

function buildAttendanceStatSubtitles(t: TimingStats) {
  const shift = clockFromHourMinute(t.shiftStartHour, t.shiftStartMinute)
  const g1End = addMinutesToShift(t.shiftStartHour, t.shiftStartMinute, t.grace1Minutes)
  const g2End = addMinutesToShift(
    t.shiftStartHour,
    t.shiftStartMinute,
    t.grace1Minutes + t.grace2Minutes
  )
  const penaltyEnd = addMinutesToShift(
    t.shiftStartHour,
    t.shiftStartMinute,
    t.grace1Minutes + t.grace2Minutes + t.penaltyMinutes
  )
  return {
    fullDays: `On time, before ${shift}`,
    grace1: `${shift} – ${g1End}`,
    grace2: `${g1End} – ${g2End}`,
    latePenalty: `${g2End} – ${penaltyEnd}`,
    halfDay: `After ${penaltyEnd} (≥${MIN_FULL_DAY_HOURS}h full day; ≥${MIN_HALF_DAY_HOURS}h half)`,
    absent: `When a half-day would apply but worked under ${MIN_HALF_DAY_HOURS}h`,
  }
}

interface AttendanceDay {
  date: Date
  inTime: Date | null
  outTime: Date | null
  isLate: boolean
  status?: string
  penalty?: number
  isHalfDay?: boolean
  isNormalized?: boolean
  logs?: Array<{ id: string; logDate: Date; punchDirection: string }>
}

interface AttendanceMyResponse {
  attendance: AttendanceDay[]
  leaveDays: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[]
  holidayDays?: { date: string; name: string }[]
}

interface AttendanceStats {
  grace1Count: number
  grace2Count: number
  latePenaltyCount: number
  halfDayCount: number
  absentCount: number
  fullDayCount: number
  grace2CountThisUtcMonth?: number
  totalPenalty: number
  normalizationsUsed: number
  normalizationsLimitDays: number
  normalizationsHoursUsed: number
  normalizationsLimitHours: number
  shiftStartHour: number
  shiftStartMinute: number
  grace1Minutes: number
  grace2Minutes: number
  penaltyMinutes: number
  penaltyAmount?: number
  departmentName?: string | null
}

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
  code?: string | null
}

interface LeaveRequest {
  id: string
  leaveType: LeaveType
  startDate: Date
  endDate: Date
  days: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  isUnpaid?: boolean
  approvedAt: Date | null
  approvedBy: { id: string; name: string; email: string } | null
  remarks: string | null
}

interface LeaveData {
  requests: LeaveRequest[]
  balances: Array<{
    id: string
    leaveTypeId: string
    allocated: number
    used: number
    remaining: number
    locked?: number
    isProbation?: boolean
    carryForward?: boolean
    leaveType: LeaveType
  }>
}

interface EmployeeDocument {
  id: string
  documentType: 'OFFER_LETTER' | 'INCREMENT_LETTER' | 'EXPERIENCE_LETTER' | 'RELIEVING_LETTER' | 'CUSTOM'
  documentUrl?: string | null
  title?: string | null
  generatedAt: string
}

const DOCUMENT_TYPES: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  CUSTOM: 'Custom',
}

function getDocumentLabel(doc: EmployeeDocument): string {
  if (doc.documentType === 'CUSTOM' && doc.title) return doc.title
  return DOCUMENT_TYPES[doc.documentType] ?? doc.documentType
}

function formatTime(date: Date | string | null) {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export default function CoreHRPage() {
  const [activeTab, setActiveTab] = useState('attendance')
  const router = useRouter()

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ['badge-counts'],
    queryFn: () => apiGet<BadgeCounts>('/api/badge-counts'),
    refetchInterval: 60_000,
  })

  const tabs: TabItem[] = useMemo(
    () =>
      CORE_HR_TAB_VALUES.map((t) => ({
        ...t,
        badge: t.value === 'leaves' ? badges?.pendingLeaveRequests : undefined,
      })),
    [badges]
  )

  const tabsWithPerms = useMemo(() => {
    return tabs.map((t) => {
      const key = t.value === 'policies' ? 'hr_policies' : t.value
      return {
        ...t,
        perm: `myhrms.my_core_hr.${key}`,
      }
    })
  }, [tabs])

  const { allowedTabs, isLoading: isPermsLoading } = useTabPermissions(tabsWithPerms, activeTab, setActiveTab)

  return (
    <PermissionsGuard
      isLoading={isPermsLoading}
      hasAccess={allowedTabs.length > 0}
      resourceName="Core HR"
      variant="card"
    >
      <div className="space-y-6">

        <TabNavigation
          tabs={allowedTabs}
          value={activeTab}
          onValueChange={setActiveTab}
          variant="core-hr"
        />

        <div className="mt-6">
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'leaves' && <LeavesTab />}
          {activeTab === 'holidays' && <HolidaysTab />}
          {activeTab === 'documents' && <DocumentsTab router={router} />}
          {activeTab === 'policies' && <PoliciesTab />}
        </div>
      </div>
    </PermissionsGuard>
  )
}

function RequestNormalizationButton({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [dates, setDates] = useState<string[]>([''])
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const requestMutation = useMutation({
    mutationFn: async (payload: { dates: string[]; reason: string }) => {
      const res = await apiRequest<{ created?: number; skipped?: number }>(
        '/api/attendance/normalize/request',
        { method: 'POST', body: JSON.stringify(payload) }
      )
      if (!res.success) throw new Error(res.error || 'Request failed')
      return { data: res.data, message: res.message }
    },
    onSuccess: ({ data, message }) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'my'] })
      setOpen(false)
      setDates([''])
      setReason('')
      const created = data?.created ?? 0
      if (created > 0) toast.success(message || `Requested normalization for ${created} day(s).`)
      onSuccess?.()
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to request normalization'),
  })

  const reasonTrimmed = reason.trim()
  const reasonOk = reasonTrimmed.length >= NORMALIZATION_REASON_MIN_CHARS

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const handleSubmit = () => {
    const validDates = dates.filter((d) => d.trim())
    if (validDates.length === 0) {
      toast.error('Add at least one date')
      return
    }
    if (validDates.some((d) => d > todayStr)) {
      toast.error('Cannot request normalization for a future date')
      return
    }
    if (!reasonOk) {
      toast.error(`Reason must be at least ${NORMALIZATION_REASON_MIN_CHARS} characters`)
      return
    }
    requestMutation.mutate({ dates: validDates, reason: reasonTrimmed })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Request normalization</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request normalization from HR</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Request attendance normalization for specific days with a reason. HR will review and set full or half day.
              From April 2026, requests must be within the same week.
            </span>
            <span className="block text-xs text-muted-foreground">
              Use this when you need HR approval (e.g. days that do not meet self-normalization rules on your Attendance
              stats card).
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Dates</Label>
            {dates.map((d, i) => (
              <div key={i} className="flex gap-2 mt-1 mb-2">
                <Input
                  type="date"
                  value={d}
                  max={todayStr}
                  onChange={(e) => {
                    const next = [...dates]
                    next[i] = e.target.value
                    setDates(next)
                  }}
                />
                {dates.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDates(dates.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDates([...dates, ''])}
            >
              Add another date
            </Button>
          </div>
          <div>
            <Label>Reason (required, min {NORMALIZATION_REASON_MIN_CHARS} characters)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you need normalization for these day(s)…"
              rows={4}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {reasonTrimmed.length}/{NORMALIZATION_REASON_MIN_CHARS} characters (minimum)
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!dates.some((d) => d.trim()) || !reasonOk || requestMutation.isPending}
            >
              {requestMutation.isPending ? 'Submitting...' : 'Submit request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AttendanceStatsList({ stats }: { stats: AttendanceStats }) {
  const timing = coalesceTimingFromStats(stats)
  const sub = buildAttendanceStatSubtitles(timing)
  const penaltyAmt =
    typeof stats.penaltyAmount === 'number' && Number.isFinite(stats.penaltyAmount)
      ? stats.penaltyAmount
      : DEFAULT_DEPARTMENT_TIMING.penaltyAmount
  const fullDayCount = stats.fullDayCount ?? 0
  const absentCount = stats.absentCount ?? 0
  const grace2OverInSelectedRange = stats.grace2Count > GRACE2_MONTHLY_MAX

  const rowClass =
    'flex flex-wrap items-center justify-between gap-2 px-4 py-3'

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <p className="text-xs font-medium text-foreground">Your shift windows (UTC)</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {stats.departmentName ? (
            <>
              Department: <span className="text-foreground/90">{stats.departmentName}</span>
            </>
          ) : (
            <>
              No department on your profile — using default shift ({clockFromHourMinute(DEFAULT_DEPARTMENT_TIMING.shiftStartHour, DEFAULT_DEPARTMENT_TIMING.shiftStartMinute)} UTC). Contact HR if this should match your team.
            </>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Late penalty in this list is ₹{penaltyAmt} per applicable day (from your department settings).
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Full days</p>
          <p className="text-xs text-muted-foreground">{sub.fullDays}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
          {fullDayCount}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Grace 1</p>
          <p className="text-xs text-muted-foreground">{sub.grace1}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
          {stats.grace1Count}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Grace 2</p>
            {grace2OverInSelectedRange ? (
              <Badge variant="destructive" className="text-xs font-normal">
                Over limit (max {GRACE2_MONTHLY_MAX}/month in selected range)
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{sub.grace2}</p>
          {typeof stats.grace2CountThisUtcMonth === 'number' ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              This calendar month (UTC): {stats.grace2CountThisUtcMonth} Grace 2 day(s)
              {stats.grace2CountThisUtcMonth > GRACE2_MONTHLY_MAX
                ? ' — manager & HR notified if not already this month'
                : null}
            </p>
          ) : null}
        </div>
        <p className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
          {stats.grace2Count}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Late penalty</p>
          <p className="text-xs text-muted-foreground">{sub.latePenalty}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
          {stats.latePenaltyCount}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Half-days</p>
          <p className="text-xs text-muted-foreground">{sub.halfDay}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
          {stats.halfDayCount}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Absent</p>
          <p className="text-xs text-muted-foreground">{sub.absent}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
          {absentCount}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Total penalties</p>
          <p className="text-xs text-muted-foreground">Late fine (₹) in selected range</p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
          ₹{stats.totalPenalty}
        </p>
      </div>
      <div className={rowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Normalizations</p>
          <p className="text-xs text-muted-foreground">
            Self-service this month: {stats.normalizationsUsed}/{stats.normalizationsLimitDays} days ·{' '}
            {stats.normalizationsHoursUsed}/{stats.normalizationsLimitHours} hrs used
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400 shrink-0">
          {stats.normalizationsHoursUsed}/{stats.normalizationsLimitHours}
          <span className="text-sm font-medium ml-1">hrs</span>
        </p>
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-3">
        <p className="text-xs font-medium text-foreground">Self-normalization rules</p>
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
          {SELF_NORMALIZATION_RULE_TEXT}
        </p>
      </div>
    </div>
  )
}

function AttendanceTab() {
  const [fromDate, setFromDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  )
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [normalizeDialogOpen, setNormalizeDialogOpen] = useState(false)
  const [normalizeDate, setNormalizeDate] = useState('')
  const [normalizeHours, setNormalizeHours] = useState<1 | 2 | 3>(1)
  const queryClient = useQueryClient()

  const { data: attendanceData, isLoading } = useQuery<AttendanceMyResponse>({
    queryKey: ['attendance', 'my', fromDate, toDate],
    queryFn: () =>
      apiGet<AttendanceMyResponse>(
        `/api/attendance/my?fromDate=${fromDate}&toDate=${toDate}`
      ),
  })

  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ['attendance', 'stats', fromDate, toDate],
    queryFn: () =>
      apiGet<AttendanceStats>(
        `/api/attendance/stats?fromDate=${fromDate}&toDate=${toDate}`
      ),
  })

  const normalizeMutation = useMutation({
    mutationFn: ({ date, hours }: { date: string; hours: 1 | 2 | 3 }) =>
      apiPost<unknown>('/api/attendance/normalize', { date, hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] })
      setNormalizeDialogOpen(false)
      setNormalizeDate('')
      setNormalizeHours(1)
      toast.success('Attendance normalized successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to normalize attendance')
    },
  })

  const attendance = attendanceData?.attendance ?? []
  const leaveDays = attendanceData?.leaveDays ?? []
  const holidayDays = attendanceData?.holidayDays ?? []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>From</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>To</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {stats && (
        <AttendanceStatsList stats={stats} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex gap-2 shrink-0">
          <RequestNormalizationButton
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
              queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'my'] })
            }}
          />
          <Dialog
            open={normalizeDialogOpen}
            onOpenChange={(open) => {
              setNormalizeDialogOpen(open)
              if (!open) {
                setNormalizeDate('')
                setNormalizeHours(1)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Self Normalize</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Normalize a day</DialogTitle>
                <DialogDescription className="space-y-2">
                  <span className="block">
                    Select a date and how many hours (1, 2, or 3) to use from your monthly allowance. No reason is required
                    for self-normalization.
                  </span>
                  <span className="block text-xs text-muted-foreground">{SELF_NORMALIZATION_RULE_TEXT}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={normalizeDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setNormalizeDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Hours to use (1, 2, or 3)</Label>
                  <div className="flex gap-2 mt-2">
                    {([1, 2, 3] as const).map((h) => (
                      <Button
                        key={h}
                        type="button"
                        variant={normalizeHours === h ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNormalizeHours(h)}
                      >
                        {h} hr{h > 1 ? 's' : ''}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNormalizeDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!normalizeDate) {
                        toast.error('Select a date')
                        return
                      }
                      if (normalizeDate > format(new Date(), 'yyyy-MM-dd')) {
                        toast.error('Cannot normalize a future date')
                        return
                      }
                      normalizeMutation.mutate({
                        date: normalizeDate,
                        hours: normalizeHours,
                      })
                    }}
                    disabled={!normalizeDate || normalizeMutation.isPending}
                  >
                    {normalizeMutation.isPending ? 'Normalizing...' : 'Normalize'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <SectionContainer title="Attendance records">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (attendance.length > 0 || leaveDays.length > 0) ? (
          <AttendanceHeatmap
            attendance={attendance as HeatmapAttendanceDay[]}
            fromDate={fromDate}
            toDate={toDate}
            leaveDays={leaveDays}
            holidayDays={holidayDays}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No attendance records found
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function LeavesTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: leaveData, isLoading } = useQuery<LeaveData>({
    queryKey: ['leaves', 'my'],
    queryFn: () => apiGet<LeaveData>('/api/leaves/my'),
  })

  const { data: leaveTypes, isLoading: leaveTypesLoading, error: leaveTypesError } = useQuery<
    LeaveType[]
  >({
    queryKey: ['leaveTypes'],
    queryFn: () => apiGet<LeaveType[]>('/api/leaves/types?activeOnly=true'),
  })

  const isProbation = leaveData?.balances?.[0]?.isProbation ?? false

  const applyLeaveMutation = useMutation({
    mutationFn: (data: {
      leaveTypeId: string
      startDate: Date
      endDate: Date
      reason?: string
      isHalfDay?: boolean
    }) =>
      apiPost<LeaveRequest>('/api/leaves/apply', {
        leaveTypeId: data.leaveTypeId,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        reason: data.reason,
        ...(data.isHalfDay ? { isHalfDay: true } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'my'] })
      setIsDialogOpen(false)
      toast.success('Leave application submitted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit leave application')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="font-medium">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive" className="font-medium">Rejected</Badge>
      default:
        return <Badge variant="secondary" className="font-medium">Pending</Badge>
    }
  }

  // Compute total balance for compact summary
  const leaveBalances = leaveData?.balances ?? [];
  const totalRemaining = leaveBalances.reduce((acc, b) => acc + (b.remaining || 0), 0);
  const totalUsed = leaveBalances.reduce((acc, b) => acc + (b.used || 0), 0);
  const totalAllocated = leaveBalances.reduce((acc, b) => acc + (b.allocated || 0), 0);

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-muted-foreground">
          Loading your leave balance…
        </div>
      ) : leaveBalances.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">Your leave balance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {leaveBalances.map((b, i) => {
              const colors = [
                { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/40', label: 'text-blue-600 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300' },
                { border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-950/40', label: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300' },
                { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/40', label: 'text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-300' },
                { border: 'border-purple-200 dark:border-purple-800', bg: 'bg-purple-50 dark:bg-purple-950/40', label: 'text-purple-600 dark:text-purple-400', value: 'text-purple-700 dark:text-purple-300' },
              ]
              const c = colors[i % colors.length]
              return (
                <div key={b.leaveTypeId} className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
                  <p className={`text-xs font-medium ${c.label}`}>{b.leaveType.name}</p>
                  <p className={`text-2xl font-bold ${c.value} mt-1`}>{b.remaining}<span className="text-sm font-medium ml-1">left</span></p>
                  <p className={`text-xs ${c.label} mt-0.5`}>{b.used} used · {b.allocated} allocated</p>
                </div>
              )
            })}
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Total Balance</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{totalRemaining}<span className="text-sm font-medium ml-1">left</span></p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{totalUsed} used · {totalAllocated} allocated</p>
            </div>
          </div>
        </div>
      ) : leaveData && !leaveBalances.length ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          No leave balance data available. Contact HR if this is unexpected.
        </div>
      ) : null}

      <div className="flex items-center justify-between flex-wrap gap-2">
        {isProbation ? (
          <p className="text-sm text-muted-foreground">
            Leave applications are locked during your first 6 months. You will be able to apply after completing probation.
          </p>
        ) : (
          <span />
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={isProbation}
            >
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>
                Submit a new leave request. Balances follow policy (1 CL, 0.5 SL, 0.5 EL per month; EL carries forward).
              </DialogDescription>
            </DialogHeader>
            {isProbation ? (
              <p className="text-sm text-muted-foreground py-4">
                Leave applications are not available during your probation period (first 6 months).
              </p>
            ) : leaveTypesLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading leave types...</div>
            ) : leaveTypesError ? (
              <div className="text-center py-4 text-red-500">Failed to load leave types.</div>
            ) : leaveTypes && leaveTypes.length > 0 ? (
              <LeaveApplicationForm
                leaveTypes={leaveTypes}
                balances={leaveData?.balances?.map((b) => ({
                  leaveTypeId: b.leaveTypeId,
                  remaining: b.remaining,
                  allocated: b.allocated,
                  locked: b.locked,
                  isProbation: b.isProbation,
                })) ?? []}
                onSubmit={(data) => applyLeaveMutation.mutate(data)}
                isLoading={applyLeaveMutation.isPending}
              />
            ) : (
              <div className="text-center py-4 text-muted-foreground">No leave types available.</div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {leaveData?.requests && leaveData.requests.filter((r) => r.status === 'APPROVED' && r.isUnpaid).length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 p-4">
          <h3 className="font-medium text-rose-800 dark:text-rose-200">Unpaid leave</h3>
          <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">
            {leaveData.requests
              .filter((r) => r.status === 'APPROVED' && r.isUnpaid)
              .reduce((sum, r) => sum + r.days, 0)}{' '}
            day(s) taken as unpaid leave (quota exhausted).
          </p>
        </div>
      )}

      <SectionContainer title="Leave history">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveData?.requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.leaveType.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(req.startDate), 'PPP')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(req.endDate), 'PPP')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.days === 0.5 ? (
                      <Badge className="bg-cyan-600 text-white hover:bg-cyan-600 font-medium border-0">
                        ½ day (0.5)
                      </Badge>
                    ) : (
                      <span>
                        <strong>{req.days}</strong> days
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{req.reason || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(req.status)}
                      {req.approvedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(req.approvedAt), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {req.approvedBy ? (
                      <div>
                        <p className="text-sm font-medium">{req.approvedBy.name}</p>
                        <p className="text-xs text-muted-foreground">{req.approvedBy.email}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{req.remarks || 'N/A'}</TableCell>
                </TableRow>
              ))}
              {(!leaveData?.requests || leaveData.requests.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No leave requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SectionContainer>
    </div>
  )
}

interface HolidayItem {
  id: string
  date: string
  name: string
  type: string
}

function HolidaysTab() {
  const currentYear = new Date().getFullYear()
  const { data: holidays = [], isLoading } = useQuery<HolidayItem[]>({
    queryKey: ['holidays', currentYear],
    queryFn: () => apiGet<HolidayItem[]>(`/api/holidays?year=${currentYear}`),
  })

  return (
    <div className="space-y-6">
      <SectionContainer title="Official holidays">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : holidays.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sl No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h, i) => (
                <TableRow key={h.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(h.date), 'PPP')}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(h.date), 'EEEE')}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>
                    <Badge variant={h.type === 'Compulsory' ? 'default' : 'secondary'}>
                      {h.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No holidays configured for {currentYear}</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function DocumentsTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const { data: documents, isLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ['my-documents'],
    queryFn: () => apiGet<EmployeeDocument[]>('/api/employee/documents'),
  })

  const handleView = (doc: EmployeeDocument) => {
    if (doc.documentType === 'CUSTOM' && doc.documentUrl) {
      window.open(doc.documentUrl, '_blank')
    } else {
      router.push(`/employee/documents/${doc.id}/view`)
    }
  }

  return (
    <div className="space-y-6">
      <SectionContainer title="Employment documents">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : documents && documents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {getDocumentLabel(doc)}
                  </TableCell>
                  <TableCell>{format(new Date(doc.generatedAt), 'PPP')}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => handleView(doc)}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {doc.documentType === 'CUSTOM' ? 'Open' : 'View & Download'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No documents available yet</p>
            <p className="text-sm mt-1">Documents will appear here once HR generates them</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function PoliciesTab() {
  const { data: stats, isLoading } = useQuery<AttendanceStats>({
    queryKey: ['attendance', 'stats', 'policies-timing'],
    queryFn: () => apiGet<AttendanceStats>('/api/attendance/stats'),
    staleTime: 60_000,
  })

  const timing = coalesceTimingFromStats(stats)
  const sub = buildAttendanceStatSubtitles(timing)
  const penaltyAmt =
    stats && typeof stats.penaltyAmount === 'number' && Number.isFinite(stats.penaltyAmount)
      ? stats.penaltyAmount
      : DEFAULT_DEPARTMENT_TIMING.penaltyAmount

  const policyRowClass = 'flex flex-wrap items-start justify-between gap-3 px-4 py-3'

  const policiesIndexRows: { id: string; title: string }[] = [
    { id: 'policies-attendance', title: 'Attendance' },
    { id: 'policies-self-normalization', title: 'Self-normalization' },
    { id: 'policies-hr-normalization', title: 'HR normalization' },
    { id: 'policies-leave', title: 'Leave' },
    { id: 'policies-payroll', title: 'Payroll (summary)' },
    { id: 'policies-increment', title: 'Apply for increments' },
    { id: 'policies-support', title: 'Support & services' },
    { id: 'policies-md-connect', title: 'MD Connect' },
  ]

  return (
    <div className="space-y-8">
      <SectionContainer title="HR policies & guidelines">
        <p className="text-sm text-muted-foreground mb-6">
          Summary of attendance, normalization, leave, payroll, and where to get help. Shift windows use{' '}
          <strong className="text-foreground">your department&apos;s settings</strong> (UTC), same as the Attendance
          tab stats.
        </p>

        <div className="rounded-lg border border-border overflow-hidden mb-8">
          <div className="px-4 py-3 bg-muted/30 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">On this page</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Jump to a section by clicking the links below.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policiesIndexRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <a href={`#${row.id}`} className="text-primary underline-offset-2 hover:underline">
                      {row.title}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-8 text-sm">
          <section id="policies-attendance" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Attendance (your department times)</h3>
            {isLoading ? (
              <p className="text-muted-foreground text-sm py-4">Loading your department timings…</p>
            ) : (
              <div className="rounded-lg border border-border bg-card divide-y divide-border mb-4">
                <div className="px-4 py-3 bg-muted/20">
                  <p className="text-xs font-medium text-foreground">Shift windows — UTC (punch clock)</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {stats?.departmentName ? (
                      <>Department: <span className="text-foreground/90">{stats.departmentName}</span></>
                    ) : (
                      <>
                        No department on your profile — showing default shift (
                        {clockFromHourMinute(
                          DEFAULT_DEPARTMENT_TIMING.shiftStartHour,
                          DEFAULT_DEPARTMENT_TIMING.shiftStartMinute
                        )}{' '}
                        UTC). Ask HR to assign your department if this is wrong.
                      </>
                    )}
                  </p>
                </div>
                <div className={policyRowClass}>
                  <span className="text-muted-foreground">Full day (on time)</span>
                  <span className="font-medium tabular-nums text-right">{sub.fullDays}</span>
                </div>
                <div className={policyRowClass}>
                  <span className="text-muted-foreground">Grace 1</span>
                  <span className="font-medium tabular-nums text-right">{sub.grace1}</span>
                </div>
                <div className={policyRowClass}>
                  <span className="text-muted-foreground">Grace 2</span>
                  <span className="font-medium tabular-nums text-right">{sub.grace2}</span>
                </div>
                <div className={policyRowClass}>
                  <span className="text-muted-foreground">Late penalty window</span>
                  <span className="font-medium tabular-nums text-right">{sub.latePenalty}</span>
                </div>
                <div className={policyRowClass}>
                  <span className="text-muted-foreground">After penalty window (half / absent rules)</span>
                  <span className="font-medium text-right max-w-[min(100%,20rem)]">{sub.halfDay}</span>
                </div>
                <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/10">
                  Late fine when applicable: <strong className="text-foreground">₹{penaltyAmt}</strong> per day (from
                  your department). Grace 1 and Grace 2: no penalty if you complete {MIN_FULL_DAY_HOURS}+ hours. Max{' '}
                  <strong className="text-foreground">{GRACE2_MONTHLY_MAX}</strong> Grace 2 days per calendar month
                  (UTC); your manager and HR are notified if you exceed it.
                </div>
              </div>
            )}
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Grace 1 / Grace 2:</strong> no penalty; count as full day if you work
                at least {MIN_FULL_DAY_HOURS} hours.
              </li>
              <li>
                <strong className="text-foreground">Late penalty:</strong> applies only when you work a full day (
                {MIN_FULL_DAY_HOURS}+ hours) and punch in within the late-penalty window above.
              </li>
              <li>
                After the penalty window ends: half-day by punch-in time; under {MIN_HALF_DAY_HOURS} hours worked →{' '}
                <strong className="text-foreground">absent</strong> (see the Absent row on your Attendance tab for
                counts).
              </li>
              <li>
                At least <strong className="text-foreground">two punch logs</strong> (IN and OUT) are needed to compute
                work hours reliably.
              </li>
            </ul>
          </section>

          <section id="policies-self-normalization" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Self-normalization</h3>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs font-medium text-foreground mb-2">Official rule (same as on your Attendance tab)</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{SELF_NORMALIZATION_RULE_TEXT}</p>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-sm">
              <li>
                <strong className="text-foreground">Allowance:</strong> 3 hours total per calendar month, spread across up
                to 3 separate days (1, 2, or 3 hours on a given day).
              </li>
              <li>
                <strong className="text-foreground">Eligible days:</strong> punch in by 11:00 AM <em>or</em> work at least
                7 hours that day (per system rules).
              </li>
              <li>
                <strong className="text-foreground">Not allowed:</strong> leave days and absent days cannot be
                self-normalized.
              </li>
              <li>
                <strong className="text-foreground">HR path:</strong> for anything that needs approval, use “Request
                normalization” with a reason — HR decides full or half day.
              </li>
            </ul>
          </section>

          <section id="policies-hr-normalization" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">HR normalization</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Request from HR with a mandatory reason (minimum {NORMALIZATION_REASON_MIN_CHARS} characters).
              </li>
              <li>HR reviews and approves as full day or half day.</li>
              <li>From April 2026, requests must be within the same week (see deadline rules in-app).</li>
            </ul>
          </section>

          <section id="policies-leave" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Leave</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">CL:</strong> typically 1 per month; valid dates are enforced when you apply.
              </li>
              <li>
                <strong className="text-foreground">SL:</strong> typically 0.5 per month; past dates allowed per policy.
              </li>
              <li>
                <strong className="text-foreground">EL:</strong> typically 0.5 per month; may carry forward per policy.
              </li>
              <li>
                <strong className="text-foreground">Probation:</strong> first 6 months — leave applications may be
                locked.
              </li>
              <li>Unpaid leave may apply automatically when quota is exhausted.</li>
            </ul>
          </section>

          <section id="policies-payroll" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Payroll day calculation (summary)</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Payable days ≈ full days + (half days × 0.5) + paid leave days (per payroll run rules).
              </li>
              <li>Late fines are deducted from salary where applicable.</li>
              <li>Sundays and official company holidays are not working days.</li>
              <li>Unpaid leave reduces payable days 1:1.</li>
            </ul>
          </section>

          <section id="policies-increment" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Apply for increments</h3>
            <p className="text-muted-foreground">
              Increment requests (current salary, requested amount, reason, achievements, supporting documents) are
              submitted from the Financial area, not from this tab.
            </p>
            <p className="text-muted-foreground">
              Open{' '}
              <Link
                href="/employee/dashboard/financial?tab=increment"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Financial → Increment
              </Link>
              , fill the form, and track status there.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Who sees it in the system:</strong> when you submit,{' '}
              <strong className="text-foreground">HR Head</strong> users get an in-app notification and HR reviews
              approve/reject (and remarks) from the HR Increments screen. Your{' '}
              <strong className="text-foreground">reporting manager is not notified</strong> in this app today — if your
              department expects manager input first, follow your offline process and still submit here when ready.
            </p>
          </section>

          <section id="policies-support" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">Support &amp; services</h3>
            <p className="text-muted-foreground">
              Use{' '}
              <Link
                href="/employee/dashboard/support-services?tab=feedback"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Support &amp; Services → Feedback
              </Link>{' '}
              for general feedback to HR (culture, suggestions, concerns). Submissions are reviewed and can be marked
              acknowledged.
            </p>
            <p className="text-muted-foreground">
              For a specific request that needs a department head, use{' '}
              <Link
                href="/employee/dashboard/support-services?tab=tickets"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Support &amp; Services → Tickets
              </Link>
              : choose the right head, subject, priority, description, and optional attachments (PDF or images). Target
              response SLA is within 48 hours.
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <p className="text-xs font-medium text-foreground">Issue type → who to raise the ticket to</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Topic / issue type</TableHead>
                    <TableHead>Raise ticket to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">HR policies, leave, attendance queries</TableCell>
                    <TableCell className="font-medium">HR Head</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Salary, payslips, reimbursements, finance process</TableCell>
                    <TableCell className="font-medium">Finance Head</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Sales / BD operations</TableCell>
                    <TableCell className="font-medium">Sales Head</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Marketing, campaigns, digital</TableCell>
                    <TableCell className="font-medium">Digital Marketing Head</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">IT access, devices, business systems</TableCell>
                    <TableCell className="font-medium">IT Head</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">General / cross-team / unclear owner</TableCell>
                    <TableCell className="font-medium">Admin</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          <section id="policies-md-connect" className="scroll-mt-24 space-y-3">
            <h3 className="text-base font-semibold">MD Connect</h3>
            <p className="text-muted-foreground">
              <strong className="text-foreground">What it is:</strong> MD Connect (under Support &amp; Services) is for
              reaching the Managing Director in two ways — without mixing them up with regular HR tickets.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Anonymous message:</strong> Send text to the MD; your identity is not
                stored with the message (see the in-app notice before you submit).
              </li>
              <li>
                <strong className="text-foreground">Appointment request:</strong> Propose a preferred day and explain
                why you need time with the MD. The MD (or office) confirms date, time, and virtual or offline details.
              </li>
            </ul>
            <p className="text-muted-foreground">
              <strong className="text-foreground">How to use:</strong> Open{' '}
              <Link
                href="/employee/dashboard/support-services?tab=md-connect"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Support &amp; Services → MD Connect
              </Link>
              . Use one section at a time; if you already have a pending appointment request, wait for a decision
              before sending another.
            </p>
            <p className="text-sm">
              <Link
                href="/employee/dashboard/support-services?tab=md-connect"
                className="inline-flex items-center gap-1 text-primary font-medium underline-offset-2 hover:underline"
              >
                Go to MD Connect
                <ChevronRight className="h-4 w-4 opacity-70" />
              </Link>
            </p>
          </section>
        </div>
      </SectionContainer>
    </div>
  )
}
