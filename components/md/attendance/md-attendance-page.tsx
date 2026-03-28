'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { BADGE_COUNTS_QUERY_KEY } from '@/hooks/use-badge-counts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Calendar, Check, FileClock, UserCheck, X } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NORM_REJECT_MIN = 15

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

interface LeaveRequestDrawerProps {
  request: TeamLeave | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string) => void
}

function LeaveRequestDrawer({ request, open, onOpenChange, onApprove }: LeaveRequestDrawerProps) {
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!request) return null

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setIsSubmitting(true)
    try {
      await onApprove(request.id, status, status === 'REJECTED' ? remarks : undefined)
      onOpenChange(false)
      setRemarks('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[min(92dvh,100svh-1.25rem)] flex flex-col gap-0 overflow-hidden rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
        <DrawerHeader className="shrink-0 border-b px-6 pb-3 pt-2 text-left">
          <DrawerTitle>Leave Request</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {request.employeeName.split(' ').map((n) => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{request.employeeName}</p>
              <p className="text-sm text-muted-foreground">{request.employeeEmail}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">Leave Type</p>
              <p className="font-medium text-teal-950 dark:text-teal-100">{request.leaveType}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">Days</p>
              <p className="font-medium">{request.days}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">From</p>
              <p className="font-medium">{format(new Date(request.startDate), 'dd MMM yyyy')}</p>
            </div>
            <div className="rounded-lg border border-teal-200/60 bg-teal-50/50 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
              <p className="text-muted-foreground">To</p>
              <p className="font-medium">{format(new Date(request.endDate), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {request.reason && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reason</p>
              <p className="text-sm border rounded-lg p-3 bg-muted/50">{request.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks (for rejection)</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add remarks..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DrawerFooter className="shrink-0 mb-3 flex flex-col-reverse gap-2 border-t bg-background/95 p-4 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 sm:mb-0 sm:flex-row sm:gap-3 sm:pb-4">
          <Button
            variant="outline"
            className="w-full flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="w-full flex-1 bg-teal-600 text-white hover:bg-teal-700"
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
          >
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

interface MDNormalizationRow {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  employeeEmail: string
  date: string
  type: string
  reason: string | null
  normalizeAs: string | null
  managerApprovedAt: string | null
  requestedByName: string | null
  managerApprovedByName: string | null
}

interface NormalizationDrawerProps {
  row: MDNormalizationRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    id: string
    status: 'APPROVED' | 'REJECTED'
    normalizeAs?: 'FULL_DAY' | 'HALF_DAY'
    remarks?: string
  }) => Promise<unknown>
}

function NormalizationDrawer({ row, open, onOpenChange, onSubmit }: NormalizationDrawerProps) {
  const [remarks, setRemarks] = useState('')
  const [normalizeAs, setNormalizeAs] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (row?.normalizeAs === 'HALF_DAY' || row?.normalizeAs === 'FULL_DAY') {
      setNormalizeAs(row.normalizeAs)
    } else {
      setNormalizeAs('FULL_DAY')
    }
    setRemarks('')
  }, [row?.id, row?.normalizeAs])

  if (!row) return null

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED') {
      const t = remarks.trim()
      if (t.length < NORM_REJECT_MIN) {
        toast.error(`Rejection reason must be at least ${NORM_REJECT_MIN} characters`)
        return
      }
    }
    setIsSubmitting(true)
    try {
      await onSubmit({
        id: row.id,
        status,
        ...(status === 'APPROVED' ? { normalizeAs } : { remarks: remarks.trim() }),
      })
      onOpenChange(false)
      setRemarks('')
    } catch (e) {
      console.error(e)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[min(92dvh,100svh-1.25rem)] flex flex-col gap-0 overflow-hidden rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
        <DrawerHeader className="shrink-0 border-b px-6 pb-3 pt-2 text-left">
          <DrawerTitle>Attendance normalization</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-4 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {row.employeeName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold">{row.employeeName}</p>
              <p className="text-sm text-muted-foreground">{row.employeeEmail}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
            <div className="rounded-lg border border-violet-200/60 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">{format(new Date(row.date + 'T12:00:00'), 'dd MMM yyyy')}</p>
            </div>
            <div className="rounded-lg border border-violet-200/60 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30">
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">
                {row.type === 'EMPLOYEE_REQUEST' ? 'Employee request' : 'Manager applied'}
              </p>
            </div>
            {row.managerApprovedByName && (
              <div className="rounded-lg border border-violet-200/60 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/30 sm:col-span-2">
                <p className="text-muted-foreground">Manager approved by</p>
                <p className="font-medium">{row.managerApprovedByName}</p>
              </div>
            )}
          </div>

          {row.reason && (
            <div>
              <p className="text-muted-foreground text-sm mb-1">Reason</p>
              <p className="text-sm border rounded-lg p-3 bg-muted/50">{row.reason}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="md-norm-as">Normalize as (when approving)</Label>
            <Select
              value={normalizeAs}
              onValueChange={(v) => setNormalizeAs(v as 'FULL_DAY' | 'HALF_DAY')}
            >
              <SelectTrigger id="md-norm-as">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DAY">Full day</SelectItem>
                <SelectItem value="HALF_DAY">Half day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="norm-remarks">Rejection reason (min. {NORM_REJECT_MIN} characters)</Label>
            <Textarea
              id="norm-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain why you are rejecting…"
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DrawerFooter className="shrink-0 mb-3 flex flex-col-reverse gap-2 border-t bg-background/95 p-4 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 sm:mb-0 sm:flex-row sm:gap-3 sm:pb-4">
          <Button
            variant="outline"
            className="w-full flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={() => handleAction('REJECTED')}
            disabled={isSubmitting}
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            className="w-full flex-1 bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
          >
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function MDAttendancePage() {
  const queryClient = useQueryClient()
  const [selectedLeave, setSelectedLeave] = useState<TeamLeave | null>(null)
  const [selectedNorm, setSelectedNorm] = useState<MDNormalizationRow | null>(null)

  const { data: leavesData, isLoading: leavesLoading } = useQuery<{ leaves: TeamLeave[] }>({
    queryKey: ['md', 'team', 'leaves', 'pending'],
    queryFn: () => apiGet<{ leaves: TeamLeave[] }>('/api/hierarchy/my-team/leaves?status=PENDING'),
  })

  const leaves = leavesData?.leaves ?? []

  const approveLeaveMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      remarks,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      remarks?: string
    }) => {
      return apiPatch(`/api/leaves/${id}/approve`, {
        status,
        ...(remarks && { remarks }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md', 'team', 'leaves'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'leaves'] })
      toast.success('Leave request processed')
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || 'Failed to process leave request')
    },
  })

  const handleApproveLeave = (id: string, status: 'APPROVED' | 'REJECTED', remarks?: string) => {
    approveLeaveMutation.mutate({ id, status, remarks })
  }

  const { data: normData, isLoading: normLoading } = useQuery<{ list: MDNormalizationRow[] }>({
    queryKey: ['md', 'normalizations', 'pending'],
    queryFn: () => apiGet<{ list: MDNormalizationRow[] }>('/api/md/normalizations'),
  })

  const normalizations = normData?.list ?? []

  const normMutation = useMutation({
    mutationFn: async (payload: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      normalizeAs?: 'FULL_DAY' | 'HALF_DAY'
      remarks?: string
    }) =>
      apiPatch(`/api/md/normalizations/${payload.id}/approve`, {
        status: payload.status,
        ...(payload.status === 'APPROVED' && payload.normalizeAs
          ? { normalizeAs: payload.normalizeAs }
          : {}),
        ...(payload.status === 'REJECTED' && payload.remarks ? { remarks: payload.remarks } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md', 'normalizations'] })
      queryClient.invalidateQueries({ queryKey: BADGE_COUNTS_QUERY_KEY })
      toast.success('Normalization updated')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update'),
  })

  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING')

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex flex-col gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-500/10 via-background to-violet-500/10 p-4 shadow-sm dark:border-teal-900/50 dark:from-teal-500/15 dark:to-violet-500/15 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-teal-950 dark:text-teal-100 sm:text-xl md:text-2xl">
            Team leave requests
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Approve or reject leave for your direct reports
          </p>
        </div>
        <Badge className="w-fit shrink-0 border-violet-300/80 bg-violet-100 text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/80 dark:text-violet-100">
          MD Only
        </Badge>
      </header>

      {leavesLoading ? (
        <Card className="border-teal-200/60 dark:border-teal-900/40">
          <CardContent className="flex items-center justify-center p-8 sm:p-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          </CardContent>
        </Card>
      ) : pendingLeaves.length === 0 ? (
        <Card className="border-teal-200/60 bg-teal-50/40 dark:border-teal-900/40 dark:bg-teal-950/20">
          <CardContent className="p-8 text-center sm:p-12">
            <UserCheck className="mx-auto mb-3 h-10 w-10 text-teal-600 dark:text-teal-400 sm:mb-4 sm:h-12 sm:w-12" />
            <p className="text-lg font-medium text-teal-950 dark:text-teal-100 sm:text-xl">No pending leave requests</p>
            <p className="mt-1 text-sm text-muted-foreground">All leave requests from your team have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-3 sm:gap-4">
          {pendingLeaves.map((leave) => (
            <Card
              key={leave.id}
              className="min-w-0 cursor-pointer border-l-4 border-l-teal-500 transition-all hover:shadow-md dark:border-l-teal-400"
              onClick={() => setSelectedLeave(leave)}
            >
              <CardContent className="min-w-0 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <Avatar className="h-10 w-10 shrink-0 border-2 border-teal-200 dark:border-teal-800 sm:h-12 sm:w-12">
                      <AvatarFallback className="bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                        {leave.employeeName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{leave.employeeName}</div>
                      <div className="truncate text-sm text-muted-foreground">{leave.employeeEmail}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                    <Badge className="bg-teal-600 text-white hover:bg-teal-600">{leave.leaveType}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {leave.days} day{leave.days !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex shrink-0 items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                    <span className="whitespace-normal break-words">
                      {format(new Date(leave.startDate), 'dd MMM')} — {format(new Date(leave.endDate), 'dd MMM yyyy')}
                    </span>
                  </div>
                  {leave.reason && (
                    <div className="line-clamp-2 min-w-0 text-xs sm:line-clamp-1 sm:flex-1">{leave.reason}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <header className="mb-4 mt-10 flex flex-col gap-3 rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-500/10 via-background to-teal-500/10 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-500/15 dark:to-teal-500/15 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight tracking-tight text-violet-950 dark:text-violet-100 sm:text-xl">
            Attendance normalizations (MD team)
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Final approval for your direct reports and MD-managed cohort — not shown in HR queue
          </p>
        </div>
      </header>

      {normLoading ? (
        <Card className="border-violet-200/60 dark:border-violet-900/40">
          <CardContent className="flex items-center justify-center p-8 sm:p-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          </CardContent>
        </Card>
      ) : normalizations.length === 0 ? (
        <Card className="border-violet-200/60 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20">
          <CardContent className="p-8 text-center sm:p-12">
            <FileClock className="mx-auto mb-3 h-10 w-10 text-violet-600 dark:text-violet-400 sm:mb-4 sm:h-12 sm:w-12" />
            <p className="text-lg font-medium text-violet-950 dark:text-violet-100 sm:text-xl">
              No pending normalizations
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              MD team requests are routed here instead of HR
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-3 sm:gap-4">
          {normalizations.map((n) => (
            <Card
              key={n.id}
              className="min-w-0 cursor-pointer border-l-4 border-l-violet-500 transition-all hover:shadow-md dark:border-l-violet-400"
              onClick={() => setSelectedNorm(n)}
            >
              <CardContent className="min-w-0 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <Avatar className="h-10 w-10 shrink-0 border-2 border-violet-200 dark:border-violet-800 sm:h-12 sm:w-12">
                      <AvatarFallback className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        {n.employeeName
                          .split(' ')
                          .map((x) => x[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{n.employeeName}</div>
                      <div className="truncate text-sm text-muted-foreground">{n.employeeEmail}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <Badge className="bg-violet-600 text-white hover:bg-violet-600">
                      {n.type === 'EMPLOYEE_REQUEST' ? 'Employee' : 'Manager'}
                    </Badge>
                    {n.normalizeAs && (
                      <span className="text-xs text-muted-foreground">
                        {n.normalizeAs === 'HALF_DAY' ? 'Half day' : 'Full day'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm text-muted-foreground sm:mt-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex shrink-0 items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                    <span>{format(new Date(n.date + 'T12:00:00'), 'dd MMM yyyy')}</span>
                  </div>
                  {n.reason && (
                    <div className="line-clamp-2 min-w-0 text-xs sm:line-clamp-1 sm:flex-1">{n.reason}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NormalizationDrawer
        row={selectedNorm}
        open={!!selectedNorm}
        onOpenChange={(open) => !open && setSelectedNorm(null)}
        onSubmit={(payload) => normMutation.mutateAsync(payload)}
      />

      <LeaveRequestDrawer
        request={selectedLeave}
        open={!!selectedLeave}
        onOpenChange={(open) => !open && setSelectedLeave(null)}
        onApprove={handleApproveLeave}
      />
    </div>
  )
}
