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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useState } from 'react'
import { UserCheck, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { format, subMonths } from 'date-fns'

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
  requestedBy: string | null
  requestedByEmail: string | null
  /** Who filed the request (employee); may differ from requestedBy when that column shows the approving manager */
  submittedByEmployeeName?: string | null
  submittedByEmployeeEmail?: string | null
  approvedBy: string | null
}

interface HRNormalizationsResponse {
  list: NormalizationRow[]
}

const MIN_REJECTION_LENGTH = 15

export function NormalizationsTab() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [fromDate, setFromDate] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectRowId, setRejectRowId] = useState<string | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')

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
    }: {
      id: string
      status: 'APPROVED' | 'REJECTED'
      remarks?: string
    }) =>
      apiPatch(`/api/attendance/normalize/${id}/approve`, {
        status,
        ...(status === 'REJECTED' && remarks != null ? { remarks } : {}),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'normalizations'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'attendance'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'normalize', 'team'] })
      toast.success(variables.status === 'APPROVED' ? 'Normalization approved' : 'Normalization rejected')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update'),
  })

  const openRejectDialog = (id: string) => {
    setRejectRowId(id)
    setRejectRemarks('')
    setRejectOpen(true)
  }

  const closeRejectDialog = () => {
    setRejectOpen(false)
    setRejectRowId(null)
    setRejectRemarks('')
  }

  const trimmedRejectRemarks = rejectRemarks.trim()
  const rejectRemarksValid = trimmedRejectRemarks.length >= MIN_REJECTION_LENGTH

  const confirmReject = () => {
    if (!rejectRowId || !rejectRemarksValid) return
    approveMutation.mutate(
      { id: rejectRowId, status: 'REJECTED', remarks: trimmedRejectRemarks },
      { onSuccess: () => closeRejectDialog() }
    )
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-6">
      <Dialog open={rejectOpen} onOpenChange={(o) => !o && closeRejectDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject normalization</DialogTitle>
            <DialogDescription>
              Provide a reason for the employee and their manager (minimum {MIN_REJECTION_LENGTH} characters).
            </DialogDescription>
          </DialogHeader>
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
          Manager and employee normalization requests (manager-approved). Approve or reject to finalize.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Show requests by status and date range</CardDescription>
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
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.employeeName}
                      <span className="block text-xs text-muted-foreground">{row.employeeCode} · {row.employeeEmail}</span>
                    </TableCell>
                    <TableCell>{format(new Date(row.date), 'PPP')}</TableCell>
                    <TableCell>
                      {row.type === 'EMPLOYEE_REQUEST' ? 'Employee Request' : 'Manager'}
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
                    <TableCell className="max-w-[200px] truncate">{row.reason || '—'}</TableCell>
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
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approveMutation.mutate({ id: row.id, status: 'APPROVED' })} disabled={approveMutation.isPending}>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openRejectDialog(row.id)} disabled={approveMutation.isPending}>
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
