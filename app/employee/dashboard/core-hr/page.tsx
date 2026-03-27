'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { BadgeCounts } from '@/app/api/badge-counts/route'
import { format } from 'date-fns'
import { Calendar, FileText, ExternalLink, CalendarDays } from 'lucide-react'
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
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { SectionContainer } from '@/components/employee/section-container'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { AttendanceHeatmap, type AttendanceDay as HeatmapAttendanceDay } from '@/components/employee/attendance-heatmap'
import { LeaveApplicationForm } from '@/components/hrms/LeaveApplicationForm'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { NORMALIZATION_REASON_MIN_CHARS } from '@/lib/hrms/normalization-deadline'

const CORE_HR_TAB_VALUES = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'leaves', label: 'Leaves' },
  { value: 'holidays', label: 'Holidays' },
  { value: 'documents', label: 'Documents' },
] as const

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
  totalPenalty: number
  normalizationsUsed: number
  normalizationsLimitDays: number
  normalizationsHoursUsed: number
  normalizationsLimitHours: number
}

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
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

  return (
    <div className="space-y-6">

      <TabNavigation
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="core-hr"
      />

      <div className="mt-6">
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'leaves' && <LeavesTab />}
        {activeTab === 'holidays' && <HolidaysTab />}
        {activeTab === 'documents' && <DocumentsTab router={router} />}
      </div>
    </div>
  )
}

function RequestNormalizationButton({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  const [dates, setDates] = useState<string[]>([''])
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const requestMutation = useMutation({
    mutationFn: (payload: { dates: string[]; reason: string }) =>
      apiPost<{ created?: number; skipped?: number }>('/api/attendance/normalize/request', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'team-requests'] })
      setOpen(false)
      setDates([''])
      setReason('')
      const created = data?.created ?? 0
      if (created > 0) toast.success(`Requested normalization for ${created} day(s). Pending manager approval.`)
      onSuccess?.()
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to request normalization'),
  })

  const reasonTrimmed = reason.trim()
  const reasonOk = reasonTrimmed.length >= NORMALIZATION_REASON_MIN_CHARS

  const handleSubmit = () => {
    const validDates = dates.filter((d) => d.trim())
    if (validDates.length === 0) {
      toast.error('Add at least one date')
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
        <Button variant="outline" size="sm">Request from manager</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request normalization from manager</DialogTitle>
          <DialogDescription>
            Request attendance normalization for specific days. Your manager will review and approve (as half or full day). From April 2026, requests must be within the same week.
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

function AttendanceTab() {
  const [fromDate, setFromDate] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  )
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [normalizeDialogOpen, setNormalizeDialogOpen] = useState(false)
  const [normalizeDate, setNormalizeDate] = useState('')
  const [normalizeHours, setNormalizeHours] = useState<1 | 2 | 3>(1)
  const [normalizeReason, setNormalizeReason] = useState('')
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

  const normalizeReasonTrimmed = normalizeReason.trim()
  const normalizeReasonOk = normalizeReasonTrimmed.length >= NORMALIZATION_REASON_MIN_CHARS

  const normalizeMutation = useMutation({
    mutationFn: ({
      date,
      hours,
      reason,
    }: {
      date: string
      hours: 1 | 2 | 3
      reason: string
    }) => apiPost<unknown>('/api/attendance/normalize', { date, hours, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats'] })
      setNormalizeDialogOpen(false)
      setNormalizeDate('')
      setNormalizeHours(1)
      setNormalizeReason('')
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 p-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Grace 1</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.grace1Count}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-800 p-4">
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Grace 2</p>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{stats.grace2Count}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Late Penalty</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.latePenaltyCount}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-800 p-4">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Half-days</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{stats.halfDayCount}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 p-4">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Total Penalties</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">₹{stats.totalPenalty}</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 dark:bg-teal-950/40 dark:border-teal-800 p-4">
            <p className="text-xs font-medium text-teal-600 dark:text-teal-400">Normalizations</p>
            <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 mt-1">{stats.normalizationsHoursUsed}/{stats.normalizationsLimitHours}<span className="text-sm font-medium ml-1">hrs</span></p>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">{stats.normalizationsUsed}/{stats.normalizationsLimitDays} days used</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-muted-foreground text-sm">You can use up to 3 hours per month, on up to 3 days. Choose 1, 2, or 3 hours per day. Only days where you were in by 11 AM or worked at least 7 hours can be normalized; leave and absent days cannot. Or request normalization from your manager for days that need approval.</span>
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
                setNormalizeReason('')
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Normalize attendance</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Normalize a day</DialogTitle>
              <DialogDescription>Select a date and how many hours (1, 2, or 3) to use from your monthly allowance. You can use up to 3 hours per month on up to 3 days.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={normalizeDate}
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
              <div>
                <Label>Reason (required, min {NORMALIZATION_REASON_MIN_CHARS} characters)</Label>
                <Textarea
                  value={normalizeReason}
                  onChange={(e) => setNormalizeReason(e.target.value)}
                  placeholder="Explain why you are using your normalization allowance for this day…"
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {normalizeReasonTrimmed.length}/{NORMALIZATION_REASON_MIN_CHARS} characters (minimum)
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNormalizeDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!normalizeDate) {
                      toast.error('Select a date')
                      return
                    }
                    if (!normalizeReasonOk) {
                      toast.error(`Reason must be at least ${NORMALIZATION_REASON_MIN_CHARS} characters`)
                      return
                    }
                    normalizeMutation.mutate({
                      date: normalizeDate,
                      hours: normalizeHours,
                      reason: normalizeReasonTrimmed,
                    })
                  }}
                  disabled={!normalizeDate || !normalizeReasonOk || normalizeMutation.isPending}
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
                Submit a new leave request. Balances are computed from policy (1 CL, 0.5 SL, 0.5 EL per month; EL carries forward).
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
