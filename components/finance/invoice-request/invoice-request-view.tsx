'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ExternalLink, FileText, Loader2, Search, Upload } from 'lucide-react'
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
  useApproveInvoiceRequest,
  useInvoiceRequests,
  useRejectInvoiceRequest,
} from '@/hooks/use-invoice-requests'
import { formatCurrency } from '@/lib/finance/payroll-types'
import {
  INVOICE_REQUEST_STATUS_LABEL,
  type InvoiceRequestRecord,
  type InvoiceRequestStatus,
} from '@/lib/finance/invoice-request/types'
import {
  INVOICE_ATTACHMENT_ACCEPT,
  isInvoiceImageUrl,
} from '@/lib/finance/invoice-request/attachments'
import { hasPermission } from '@/lib/rbac'
import { useInvoiceRequestActivity } from '@/hooks/use-doctor-payoff-requests'
import { RequestActivityLogPanel } from '@/components/recent-activity-log'

function statusVariant(status: InvoiceRequestStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'VERIFIED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'outline'
}

export function InvoiceRequestView() {
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false

  const [statusFilter, setStatusFilter] = useState<InvoiceRequestStatus>('PENDING')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reviewRequest, setReviewRequest] = useState<InvoiceRequestRecord | null>(null)
  const [financeRemarks, setFinanceRemarks] = useState('')
  const [rejectionRemarks, setRejectionRemarks] = useState('')
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null)
  const [rejectMode, setRejectMode] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(
    () => ({ status: statusFilter, search: debouncedSearch || null }),
    [statusFilter, debouncedSearch],
  )

  const { data, isLoading, isError, refetch } = useInvoiceRequests(filters)
  const { data: activityData } = useInvoiceRequestActivity({ limit: 20 })
  const approveMutation = useApproveInvoiceRequest()
  const rejectMutation = useRejectInvoiceRequest()

  const { uploadFile, uploading } = useFileUpload({
    endpoint: '/api/finance/invoice-requests/upload',
  })

  const resetReviewDialog = () => {
    setReviewRequest(null)
    setFinanceRemarks('')
    setRejectionRemarks('')
    setUploadedFile(null)
    setRejectMode(false)
  }

  const openReview = (request: InvoiceRequestRecord) => {
    setReviewRequest(request)
    setFinanceRemarks('')
    setRejectionRemarks('')
    setUploadedFile(null)
    setRejectMode(false)
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
      toast.error('Please upload the invoice file (PDF or image) before approving')
      return
    }
    try {
      await approveMutation.mutateAsync({
        id: reviewRequest.id,
        invoicePdfUrl: uploadedFile.url,
        invoicePdfName: uploadedFile.name,
        financeRemarks: financeRemarks.trim() || undefined,
      })
      toast.success('Invoice request verified')
      resetReviewDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve request')
    }
  }

  const handleReject = async () => {
    if (!reviewRequest) return
    if (!rejectionRemarks.trim()) {
      toast.error('Rejection remarks are required')
      return
    }
    try {
      await rejectMutation.mutateAsync({
        id: reviewRequest.id,
        rejectionRemarks: rejectionRemarks.trim(),
      })
      toast.success('Invoice request rejected')
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
        <h1 className="text-2xl font-bold tracking-tight">Invoice Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review pending invoice requests submitted by the P/L team. Upload the invoice file (PDF or
          image), add remarks, and verify or reject each request.
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
            onValueChange={(v) => setStatusFilter(v as InvoiceRequestStatus)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search lead ref, patient, hospital, invoice no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Failed to load invoice requests.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No {INVOICE_REQUEST_STATUS_LABEL[statusFilter].toLowerCase()} invoice requests found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.lead.leadRef}</TableCell>
                    <TableCell>{req.lead.patientName}</TableCell>
                    <TableCell>{req.lead.hospitalName}</TableCell>
                    <TableCell>{req.requestedBy.name}</TableCell>
                    <TableCell>{format(new Date(req.createdAt), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(req.status)}>
                        {INVOICE_REQUEST_STATUS_LABEL[req.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'PENDING' && canWrite ? (
                        <Button size="sm" onClick={() => openReview(req)}>
                          Review
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openReview(req)}>
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RequestActivityLogPanel
        title="Invoice Request Activity Log"
        items={activityData?.items ?? []}
        emptyMessage="No invoice request activity yet"
        variant="light"
      />

      <Dialog open={!!reviewRequest} onOpenChange={(open) => !open && resetReviewDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewRequest?.status === 'PENDING' && canWrite && !rejectMode
                ? 'Review Invoice Request'
                : 'Invoice Request Details'}
            </DialogTitle>
            <DialogDescription>
              {reviewRequest?.lead.leadRef} · {reviewRequest?.lead.patientName}
            </DialogDescription>
          </DialogHeader>

          {reviewRequest && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Hospital</p>
                  <p className="font-medium">{reviewRequest.lead.hospitalName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment</p>
                  <p className="font-medium">{reviewRequest.lead.treatment ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requested by</p>
                  <p className="font-medium">{reviewRequest.requestedBy.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusVariant(reviewRequest.status)}>
                    {INVOICE_REQUEST_STATUS_LABEL[reviewRequest.status]}
                  </Badge>
                </div>
              </div>

              {reviewRequest.requestRemarks && (
                <div>
                  <p className="text-xs text-muted-foreground">P/L request remarks</p>
                  <p className="mt-1 rounded-md border bg-muted/30 p-2">{reviewRequest.requestRemarks}</p>
                </div>
              )}

              {(reviewRequest.invoiceNumber || reviewRequest.invoiceAmount != null) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {reviewRequest.invoiceNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice number</p>
                      <p className="font-medium">{reviewRequest.invoiceNumber}</p>
                    </div>
                  )}
                  {reviewRequest.invoiceAmount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice amount</p>
                      <p className="font-medium">{formatCurrency(reviewRequest.invoiceAmount)}</p>
                    </div>
                  )}
                </div>
              )}

              {reviewRequest.status === 'VERIFIED' && reviewRequest.invoicePdfUrl && (
                <div className="rounded-md border p-3 space-y-3">
                  {isInvoiceImageUrl(reviewRequest.invoicePdfUrl) ||
                  isInvoiceImageUrl(reviewRequest.invoicePdfName) ? (
                    <div className="space-y-2">
                      <img
                        src={reviewRequest.invoicePdfUrl}
                        alt={reviewRequest.invoicePdfName ?? 'Invoice image'}
                        className="max-h-64 w-full rounded-md border object-contain bg-muted/20"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {reviewRequest.invoicePdfName ?? 'Invoice file'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={reviewRequest.invoicePdfUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Open file
                      </Link>
                    </Button>
                  </div>
                  {reviewRequest.financeRemarks && (
                    <p className="text-muted-foreground">{reviewRequest.financeRemarks}</p>
                  )}
                </div>
              )}

              {reviewRequest.status === 'REJECTED' && reviewRequest.rejectionRemarks && (
                <div>
                  <p className="text-xs text-muted-foreground">Rejection remarks</p>
                  <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    {reviewRequest.rejectionRemarks}
                  </p>
                </div>
              )}

              {reviewRequest.status === 'PENDING' && canWrite && (
                <>
                  {!rejectMode ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-file">Invoice file (PDF or image)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="invoice-file"
                            type="file"
                            accept={INVOICE_ATTACHMENT_ACCEPT}
                            onChange={(e) => handleFileSelect(e.target.files?.[0])}
                            disabled={uploading || isPendingAction}
                          />
                          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        {uploadedFile && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Upload className="h-3.5 w-3.5" />
                              Ready: {uploadedFile.name}
                            </p>
                            {isInvoiceImageUrl(uploadedFile.url) ||
                            isInvoiceImageUrl(uploadedFile.name) ? (
                              <img
                                src={uploadedFile.url}
                                alt={uploadedFile.name}
                                className="max-h-40 w-full rounded-md border object-contain bg-muted/20"
                              />
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="finance-remarks">Finance remarks (optional)</Label>
                        <Textarea
                          id="finance-remarks"
                          value={financeRemarks}
                          onChange={(e) => setFinanceRemarks(e.target.value)}
                          placeholder="Add any notes for the P/L team"
                          rows={3}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="rejection-remarks">Rejection remarks</Label>
                      <Textarea
                        id="rejection-remarks"
                        value={rejectionRemarks}
                        onChange={(e) => setRejectionRemarks(e.target.value)}
                        placeholder="Explain why this request is rejected"
                        rows={4}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {reviewRequest?.status === 'PENDING' && canWrite ? (
              rejectMode ? (
                <>
                  <Button variant="outline" onClick={() => setRejectMode(false)} disabled={isPendingAction}>
                    Back
                  </Button>
                  <Button variant="destructive" onClick={handleReject} disabled={isPendingAction}>
                    {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={resetReviewDialog} disabled={isPendingAction}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => setRejectMode(true)} disabled={isPendingAction}>
                    Reject
                  </Button>
                  <Button onClick={handleApprove} disabled={isPendingAction || uploading}>
                    {approveMutation.isPending ? 'Verifying…' : 'Approve & Verify'}
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" onClick={resetReviewDialog}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InvoiceRequestView
