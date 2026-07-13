'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Search, Upload, ExternalLink, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useFileUpload } from '@/hooks/use-file-upload'
import {
  useApproveDoctorPayoffRequest,
  useDoctorPayoffActivity,
  useDoctorPayoffRequests,
  useRejectDoctorPayoffRequest,
} from '@/hooks/use-doctor-payoff-requests'
import { formatCurrency } from '@/lib/finance/payroll-types'
import {
  DOCTOR_PAYOFF_STATUS_LABEL,
  type DoctorPayoffRequestRecord,
  type DoctorPayoffRequestStatus,
} from '@/lib/finance/doctor-payoff/types'
import { INVOICE_ATTACHMENT_ACCEPT } from '@/lib/finance/invoice-request/attachments'
import { hasPermission } from '@/lib/rbac'
import { RequestActivityLogPanel } from '@/components/recent-activity-log'

function statusVariant(
  status: DoctorPayoffRequestStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'outline'
}

export function DoctorPayoffRequestView() {
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false

  const [statusFilter, setStatusFilter] = useState<DoctorPayoffRequestStatus | 'ALL'>('PENDING')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reviewRequest, setReviewRequest] = useState<DoctorPayoffRequestRecord | null>(null)
  const [financeRemarks, setFinanceRemarks] = useState('')
  const [rejectionRemarks, setRejectionRemarks] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(
    () => ({ status: statusFilter, search: debouncedSearch || null }),
    [statusFilter, debouncedSearch]
  )

  const { data, isLoading, isError, refetch } = useDoctorPayoffRequests(filters)
  const { data: activityData } = useDoctorPayoffActivity({ limit: 20 })
  const approveMutation = useApproveDoctorPayoffRequest()
  const rejectMutation = useRejectDoctorPayoffRequest()
  const { uploadFile, uploading } = useFileUpload({
    endpoint: '/api/finance/doctor-payoff-requests/upload',
  })

  const resetReviewDialog = () => {
    setReviewRequest(null)
    setFinanceRemarks('')
    setRejectionRemarks('')
    setRejectMode(false)
    setUploadedFile(null)
  }

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return
    const result = await uploadFile(file)
    if (result?.url) {
      setUploadedFile({ url: result.url, name: file.name })
    }
  }

  const handleApprove = async () => {
    if (!reviewRequest) return
    if (!uploadedFile?.url) {
      toast.error('Please upload a verification document before approving')
      return
    }
    try {
      await approveMutation.mutateAsync({
        id: reviewRequest.id,
        verificationDocUrl: uploadedFile.url,
        verificationDocName: uploadedFile.name,
        financeRemarks: financeRemarks.trim() || undefined,
      })
      toast.success('Doctor payoff request approved')
      resetReviewDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve request')
    }
  }

  const handleReject = async () => {
    if (!reviewRequest) return
    if (!rejectionRemarks.trim()) {
      toast.error('Rejection remark is required')
      return
    }
    try {
      await rejectMutation.mutateAsync({
        id: reviewRequest.id,
        rejectionRemarks: rejectionRemarks.trim(),
      })
      toast.success('Doctor payoff request rejected')
      resetReviewDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject request')
    }
  }

  const requests = data?.requests ?? []
  const isPendingAction = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Doctor Payoff Requests</h1>
        <p className="text-sm text-muted-foreground">
          View, verify, approve, or reject doctor payoff requests submitted from the Doctor List.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Pending requests need Finance action.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DoctorPayoffRequestStatus | 'ALL')}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search doctor, hospital, remarks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor Name</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead className="text-right">Request Amount</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-[100px]">Document</TableHead>
                {canWrite && <TableHead className="w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-destructive">
                    Failed to load requests
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No doctor payoff requests found
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((row) => {
                  const remarks =
                    row.status === 'REJECTED'
                      ? row.rejectionRemarks
                      : row.status === 'APPROVED'
                        ? row.financeRemarks || row.requestRemarks
                        : row.requestRemarks
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.doctorName}</TableCell>
                      <TableCell>{row.hospitalName || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.requestAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(row.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {DOCTOR_PAYOFF_STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {remarks || '—'}
                      </TableCell>
                      <TableCell>
                        {row.verificationDocUrl ? (
                          <a
                            href={row.verificationDocUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          {row.status === 'PENDING' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReviewRequest(row)
                                setRejectMode(false)
                              }}
                            >
                              Review
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RequestActivityLogPanel
        title="Doctor Payoff Activity Log"
        items={activityData?.items ?? []}
        emptyMessage="No payoff request activity yet"
        variant="light"
      />

      <Dialog
        open={!!reviewRequest}
        onOpenChange={(open) => {
          if (!open) resetReviewDialog()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Doctor Payoff Request</DialogTitle>
            <DialogDescription>
              {reviewRequest
                ? `${reviewRequest.doctorName} · ${reviewRequest.hospitalName || 'No hospital'} · ${formatCurrency(reviewRequest.requestAmount)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {reviewRequest && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Requested by:</span>{' '}
                  {reviewRequest.requestedBy.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Request date:</span>{' '}
                  {format(new Date(reviewRequest.createdAt), 'dd MMM yyyy, HH:mm')}
                </p>
                {reviewRequest.requestRemarks && (
                  <p className="whitespace-pre-wrap">
                    <span className="text-muted-foreground">Request remarks:</span>{' '}
                    {reviewRequest.requestRemarks}
                  </p>
                )}
              </div>

              {!rejectMode ? (
                <>
                  <div>
                    <Label>Verification document *</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <label className="inline-flex">
                        <input
                          type="file"
                          className="sr-only"
                          accept={INVOICE_ATTACHMENT_ACCEPT}
                          disabled={uploading || isPendingAction}
                          onChange={(e) => {
                            void handleFileSelect(e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                          <span>
                            {uploading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            Upload PDF / image
                          </span>
                        </Button>
                      </label>
                      {uploadedFile && (
                        <a
                          href={uploadedFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {uploadedFile.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="finance-remarks">Finance remarks (optional)</Label>
                    <Textarea
                      id="finance-remarks"
                      value={financeRemarks}
                      onChange={(e) => setFinanceRemarks(e.target.value)}
                      placeholder="Verification / approval notes"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="rejection-remarks">Rejection remark *</Label>
                  <Textarea
                    id="rejection-remarks"
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Reason for rejection (required)"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!rejectMode ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setRejectMode(true)}
                  disabled={isPendingAction || uploading}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={isPendingAction || uploading}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Approve
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectMode(false)}
                  disabled={isPendingAction}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleReject()}
                  disabled={isPendingAction}
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Confirm Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DoctorPayoffRequestView
