'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useMemo, useState } from 'react'
import { UserCheck, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AttendanceHeatmap, type AttendanceDay } from '@/components/employee/attendance-heatmap'

interface NormalizationRow {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  employeeEmail: string
  date: string
  type: string
  status: string
  reason: string | null
  hrRejectionReason: string | null
  normalizeAs: string | null
  createdAt: string
  attendanceIn: string | null
  attendanceOut: string | null
  requestedBy: string | null
  requestedByEmail: string | null
  /** Who filed the request (employee); may differ from requestedBy when that column shows the approving manager */
  submittedByEmployeeName?: string | null
  submittedByEmployeeEmail?: string | null
  approvedBy: string | null
}

function formatUtcDateKey(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return format(new Date(Date.UTC(y, m - 1, d)), 'PPP')
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

function NormalizationAttendanceContext({ row }: { row: NormalizationRow }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
      <p className="font-medium text-foreground">
        {row.employeeName}{' '}
        <span className="text-muted-foreground font-normal">({row.employeeCode})</span>
      </p>
      <p className="text-muted-foreground">
        Date: <span className="text-foreground font-medium">{formatUtcDateKey(row.date)}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Punch in (UTC)</span>
          <p className="font-mono tabular-nums">{formatPunchUtc(row.attendanceIn)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Punch out (UTC)</span>
          <p className="font-mono tabular-nums">{formatPunchUtc(row.attendanceOut)}</p>
        </div>
      </div>
      {row.reason ? (
        <div className="pt-1 border-t border-border/60">
          <span className="text-xs text-muted-foreground">Request reason</span>
          <p className="mt-0.5 text-foreground">{row.reason}</p>
        </div>
      ) : null}
    </div>
  )
}

interface HRNormalizationsResponse {
  list: NormalizationRow[]
}

interface EmployeeHeatmapPayload {
  attendance: AttendanceDay[]
  leaveDays: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[]
  holidayDays: { date: string; name: string }[]
}

const MIN_REJECTION_LENGTH = 15

export function NormalizationsTab() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  // Pending queue must match badge counts (all-time). Date bounds are optional for history.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectRow, setRejectRow] = useState<NormalizationRow | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveRow, setApproveRow] = useState<NormalizationRow | null>(null)
  const [approveNormalizeAs, setApproveNormalizeAs] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY')
  const [detailRow, setDetailRow] = useState<NormalizationRow | null>(null)

  const detailMonthRange = useMemo(() => {
    if (!detailRow) return null
    const [y, m] = detailRow.date.split('-').map(Number)
    if (!y || !m) return null
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return {
      from: `${y}-${String(m).padStart(2, '0')}-01`,
      to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }, [detailRow])

  const detailMonthLabel = useMemo(() => {
    if (!detailRow) return ''
    const [y, m] = detailRow.date.split('-').map(Number)
    if (!y || !m) return ''
    return format(new Date(Date.UTC(y, m - 1, 15)), 'MMMM yyyy')
  }, [detailRow])

  const { data: detailHeatmap, isLoading: detailHeatmapLoading } = useQuery({
    queryKey: [
      'hr',
      'employee',
      detailRow?.employeeId,
      'attendance-heatmap',
      detailMonthRange?.from,
      detailMonthRange?.to,
    ],
    queryFn: () =>
      apiGet<EmployeeHeatmapPayload>(
        `/api/hr/employees/${detailRow!.employeeId}/attendance-heatmap?fromDate=${detailMonthRange!.from}&toDate=${detailMonthRange!.to}`
      ),
    enabled: !!detailRow && !!detailMonthRange,
  })

  const queryParams = new URLSearchParams({ status: statusFilter })
  if (fromDate) queryParams.set('fromDate', fromDate)
  if (toDate) queryParams.set('toDate', toDate)

  const { data, isLoading } = useQuery<HRNormalizationsResponse>({
    queryKey: ['hr', 'normalizations', statusFilter, fromDate, toDate],
    queryFn: () => apiGet<HRNormalizationsResponse>(`/api/hr/normalizations?${queryParams.toString()}`),
  })

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      status,
      remarks,
      normalizeAs,
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      remarks?: string
      normalizeAs?: 'FULL_DAY' | 'HALF_DAY'
    }) =>
      apiPatch(`/api/attendance/normalize/${id}/approve`, {
        status,
        ...(status === 'REJECTED' && remarks != null ? { remarks } : {}),
        ...(status === 'APPROVED' && normalizeAs ? { normalizeAs } : {}),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'normalizations'] })
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'attendance'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'team'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      toast.success(variables.status === 'APPROVED' ? 'Normalization approved' : 'Normalization rejected')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update'),
  })

  const openRejectDialog = (row: NormalizationRow) => {
    setRejectRow(row)
    setRejectRemarks('')
    setRejectOpen(true)
  }

  const closeRejectDialog = () => {
    setRejectOpen(false)
    setRejectRow(null)
    setRejectRemarks('')
  }

  const trimmedRejectRemarks = rejectRemarks.trim()
  const rejectRemarksValid = trimmedRejectRemarks.length >= MIN_REJECTION_LENGTH

  const confirmReject = () => {
    if (!rejectRow || !rejectRemarksValid) return
    approveMutation.mutate(
      { id: rejectRow.id, status: 'REJECTED', remarks: trimmedRejectRemarks },
      { onSuccess: () => closeRejectDialog() }
    )
  }

  const openApproveDialog = (row: NormalizationRow) => {
    setApproveRow(row)
    setApproveNormalizeAs(row.normalizeAs === 'HALF_DAY' ? 'HALF_DAY' : 'FULL_DAY')
    setApproveOpen(true)
  }

  const closeApproveDialog = () => {
    setApproveOpen(false)
    setApproveRow(null)
  }

  const confirmApprove = () => {
    if (!approveRow) return
    approveMutation.mutate(
      { id: approveRow.id, status: 'APPROVED', normalizeAs: approveNormalizeAs },
      { onSuccess: () => closeApproveDialog() }
    )
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-6">
      <Sheet
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-3xl lg:max-w-4xl overflow-y-auto"
        >
          {detailRow ? (
            <>
              <SheetHeader>
                <SheetTitle>Normalization details</SheetTitle>
                <SheetDescription>
                  {detailRow.employeeName} · {detailMonthLabel} (request date highlighted on the calendar)
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">{detailRow.employeeName}</span>
                    <span className="text-muted-foreground">({detailRow.employeeCode})</span>
                  </div>
                  <p className="text-muted-foreground">{detailRow.employeeEmail}</p>
                  <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-border/60">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Request date</span>
                      <p className="font-medium">{formatUtcDateKey(detailRow.date)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Type</span>
                      <p className="font-medium">
                        {detailRow.type === 'EMPLOYEE_REQUEST' ? 'Employee request' : 'Manager applied'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Normalize as</span>
                      <p className="font-medium">
                        {detailRow.normalizeAs === 'HALF_DAY'
                          ? 'Half day'
                          : detailRow.normalizeAs === 'FULL_DAY'
                            ? 'Full day'
                            : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                      <p className="font-medium capitalize">{detailRow.status.toLowerCase()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Punch in (UTC)</span>
                      <p className="font-mono tabular-nums">{formatPunchUtc(detailRow.attendanceIn)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Punch out (UTC)</span>
                      <p className="font-mono tabular-nums">{formatPunchUtc(detailRow.attendanceOut)}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Requested by</span>
                      <p className="font-medium">{detailRow.requestedBy ?? '—'}</p>
                      {detailRow.requestedByEmail ? (
                        <p className="text-muted-foreground text-xs">{detailRow.requestedByEmail}</p>
                      ) : null}
                    </div>
                    {detailRow.type === 'EMPLOYEE_REQUEST' &&
                      detailRow.submittedByEmployeeName &&
                      detailRow.submittedByEmployeeName !== detailRow.requestedBy && (
                        <div className="sm:col-span-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Employee (submitter)</span>
                          <p className="font-medium">{detailRow.submittedByEmployeeName}</p>
                          {detailRow.submittedByEmployeeEmail ? (
                            <p className="text-muted-foreground text-xs">{detailRow.submittedByEmployeeEmail}</p>
                          ) : null}
                        </div>
                      )}
                    <div className="sm:col-span-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Reason</span>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border bg-background p-3 text-foreground">
                        {detailRow.reason?.trim() ? detailRow.reason : '—'}
                      </p>
                    </div>
                    {detailRow.status === 'REJECTED' && (
                      <div className="sm:col-span-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">HR rejection</span>
                        <p className="mt-1 whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-3">
                          {detailRow.hrRejectionReason?.trim() ? detailRow.hrRejectionReason : '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Attendance this month</h3>
                  {detailHeatmapLoading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading calendar…</p>
                  ) : detailHeatmap ? (
                    <AttendanceHeatmap
                      attendance={detailHeatmap.attendance.map((d) => {
                        const raw = d as AttendanceDay & {
                          inTime?: string | Date | null
                          outTime?: string | Date | null
                        }
                        const toDt = (v: string | Date | null | undefined) =>
                          v == null ? null : typeof v === 'string' ? new Date(v) : v
                        return {
                          ...raw,
                          date:
                            typeof raw.date === 'string'
                              ? new Date(raw.date)
                              : raw.date instanceof Date
                                ? raw.date
                                : new Date(raw.date as unknown as string),
                          inTime: toDt(raw.inTime ?? null),
                          outTime: toDt(raw.outTime ?? null),
                        }
                      })}
                      fromDate={detailMonthRange!.from}
                      toDate={detailMonthRange!.to}
                      leaveDays={detailHeatmap.leaveDays}
                      holidayDays={detailHeatmap.holidayDays}
                      highlightDateKeys={[detailRow.date]}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">Could not load attendance.</p>
                  )}
                </div>

                {detailRow.status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button type="button" size="sm" onClick={() => openApproveDialog(detailRow)}>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => openRejectDialog(detailRow)}>
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={approveOpen} onOpenChange={(o) => !o && closeApproveDialog()}>
        <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve normalization</DialogTitle>
            <DialogDescription>
              Review punch times for that day (UTC), then choose full or half day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {approveRow ? <NormalizationAttendanceContext row={approveRow} /> : null}
            <div className="space-y-2">
            <Label htmlFor="hr-approve-normalize-as">Normalize as</Label>
            <Select
              value={approveNormalizeAs}
              onValueChange={(v) => setApproveNormalizeAs(v as 'FULL_DAY' | 'HALF_DAY')}
            >
              <SelectTrigger id="hr-approve-normalize-as">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_DAY">Full day</SelectItem>
                <SelectItem value="HALF_DAY">Half day</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeApproveDialog} disabled={approveMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmApprove} disabled={approveMutation.isPending}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(o) => !o && closeRejectDialog()}>
        <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject normalization</DialogTitle>
            <DialogDescription>
              Check attendance for that day, then provide a rejection reason for the employee (minimum{' '}
              {MIN_REJECTION_LENGTH} characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rejectRow ? <NormalizationAttendanceContext row={rejectRow} /> : null}
            <div className="space-y-2">
            <Label htmlFor="hr-reject-remarks">Rejection reason</Label>
            <Textarea
              id="hr-reject-remarks"
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Explain why this request cannot be approved..."
              rows={4}
              className="resize-y min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              {trimmedRejectRemarks.length}/{MIN_REJECTION_LENGTH} characters minimum
              {!rejectRemarksValid && trimmedRejectRemarks.length > 0 && (
                <span className="text-destructive"> — need {MIN_REJECTION_LENGTH - trimmedRejectRemarks.length} more</span>
              )}
            </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeRejectDialog} disabled={approveMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectRemarksValid || approveMutation.isPending}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-3xl font-bold">Attendance Normalizations</h1>
        <p className="text-muted-foreground mt-1">
          Employee requests (direct to HR) and manager-submitted applications. Click a row for the full reason and a
          monthly attendance view. Approve with full or half day, or reject.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Pending shows the full HR queue (same as the badge). Use dates to narrow approved/rejected history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={statusFilter === 'PENDING' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('PENDING')}>
              Pending
            </Button>
            <Button variant={statusFilter === 'APPROVED' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('APPROVED')}>
              Approved
            </Button>
            <Button variant={statusFilter === 'REJECTED' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('REJECTED')}>
              Rejected
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">From date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-[140px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-[140px]" />
            </div>
            {(fromDate || toDate) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-0.5"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                }}
              >
                Clear dates
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Normalization requests
          </CardTitle>
          <CardDescription>
            {list.length} request(s) with status &quot;{statusFilter}&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No normalization requests found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>In (UTC)</TableHead>
                  <TableHead>Out (UTC)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Normalize as</TableHead>
                  <TableHead>Requested by</TableHead>
                  <TableHead>Reason</TableHead>
                  {statusFilter === 'REJECTED' && <TableHead>HR rejection</TableHead>}
                  <TableHead>Status</TableHead>
                  {statusFilter === 'PENDING' && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailRow(row)}
                  >
                    <TableCell className="font-medium">
                      {row.employeeName}
                      <span className="block text-xs text-muted-foreground">{row.employeeCode} · {row.employeeEmail}</span>
                    </TableCell>
                    <TableCell>{formatUtcDateKey(row.date)}</TableCell>
                    <TableCell className="tabular-nums text-sm font-mono">{formatPunchUtc(row.attendanceIn)}</TableCell>
                    <TableCell className="tabular-nums text-sm font-mono">{formatPunchUtc(row.attendanceOut)}</TableCell>
                    <TableCell>
                      {row.type === 'EMPLOYEE_REQUEST' ? 'Employee request' : 'Manager applied'}
                      {!row.attendanceIn && !row.attendanceOut && row.type === 'EMPLOYEE_REQUEST' ? (
                        <span className="block text-xs text-muted-foreground">Absent · HR direct</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.normalizeAs === 'HALF_DAY' ? 'Half Day' : row.normalizeAs === 'FULL_DAY' ? 'Full Day' : '—'}
                    </TableCell>
                    <TableCell>
                      {row.requestedBy ?? '—'}
                      {row.requestedByEmail && (
                        <span className="block text-xs text-muted-foreground">{row.requestedByEmail}</span>
                      )}
                      {row.type === 'EMPLOYEE_REQUEST' &&
                        row.submittedByEmployeeName &&
                        row.submittedByEmployeeName !== row.requestedBy && (
                          <span className="block text-xs text-muted-foreground mt-1 pt-1 border-t border-border/60">
                            Employee: {row.submittedByEmployeeName}
                            {row.submittedByEmployeeEmail ? (
                              <span className="block opacity-90">{row.submittedByEmployeeEmail}</span>
                            ) : null}
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="max-w-[min(280px,32vw)]">
                      <span className="line-clamp-2 text-sm text-muted-foreground" title={row.reason ?? undefined}>
                        {row.reason?.trim() ? row.reason : '—'}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted-foreground/80">Open row for full text</span>
                    </TableCell>
                    {statusFilter === 'REJECTED' && (
                      <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                        {row.hrRejectionReason || '—'}
                      </TableCell>
                    )}
                    <TableCell>
                      {row.status === 'PENDING' && <Badge variant="secondary">Pending</Badge>}
                      {row.status === 'APPROVED' && <Badge variant="default">Approved</Badge>}
                      {row.status === 'REJECTED' && <Badge variant="destructive">Rejected</Badge>}
                    </TableCell>
                    {statusFilter === 'PENDING' && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => openApproveDialog(row)} disabled={approveMutation.isPending}>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openRejectDialog(row)} disabled={approveMutation.isPending}>
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
