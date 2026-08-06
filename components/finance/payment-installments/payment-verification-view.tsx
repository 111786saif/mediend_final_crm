'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Loader2, Search } from 'lucide-react'
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
import {
  useFinancePaymentInstallments,
  useRejectPaymentInstallment,
  useVerifyPaymentInstallment,
} from '@/hooks/use-finance-payment-installments'
import { formatCurrency } from '@/lib/finance/payroll-types'
import {
  INSTALLMENT_VERIFICATION_LABEL,
  type FinancePaymentInstallmentRecord,
  type InstallmentVerificationStatus,
} from '@/lib/finance/payment-installments/types'
import { hasPermission } from '@/lib/rbac'

function statusVariant(
  status: InstallmentVerificationStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'VERIFIED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'outline'
}

export function PaymentVerificationView() {
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false

  const [statusFilter, setStatusFilter] = useState<InstallmentVerificationStatus | 'ALL'>('PENDING')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [active, setActive] = useState<FinancePaymentInstallmentRecord | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionRemarks, setRejectionRemarks] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(
    () => ({
      status: statusFilter,
      search: debouncedSearch || null,
      recipient: 'MEDIEND' as const,
    }),
    [statusFilter, debouncedSearch],
  )

  const { data, isLoading, isError, refetch } = useFinancePaymentInstallments(filters)
  const verifyMutation = useVerifyPaymentInstallment()
  const rejectMutation = useRejectPaymentInstallment()

  const rows = data?.installments ?? []
  const isPendingAction = verifyMutation.isPending || rejectMutation.isPending

  const resetDialog = () => {
    setActive(null)
    setRejectMode(false)
    setRejectionRemarks('')
  }

  const handleVerify = async () => {
    if (!active) return
    try {
      await verifyMutation.mutateAsync(active.id)
      toast.success('Payment verified')
      resetDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to verify payment')
    }
  }

  const handleReject = async () => {
    if (!active) return
    if (!rejectionRemarks.trim()) {
      toast.error('Rejection remarks are required')
      return
    }
    try {
      await rejectMutation.mutateAsync({
        id: active.id,
        rejectionRemarks: rejectionRemarks.trim(),
      })
      toast.success('Payment rejected')
      resetDialog()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject payment')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Verifications</h1>
        <p className="text-sm text-muted-foreground">
          Hospital / P&amp;L recorded MediEND receipts await Finance verification. Only verified
          amounts reduce outstanding pending.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Pending payments need Finance action.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as InstallmentVerificationStatus | 'ALL')}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search lead ref, patient, hospital, UTR…"
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
              Failed to load payments.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No{' '}
              {statusFilter === 'ALL'
                ? ''
                : `${INSTALLMENT_VERIFICATION_LABEL[statusFilter].toLowerCase()} `}
              MediEND payments found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Paid on</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.lead?.leadRef ?? (row.leadId ? '—' : 'Hospital-level')}
                    </TableCell>
                    <TableCell>{row.lead?.patientName ?? '—'}</TableCell>
                    <TableCell>{row.hospitalName ?? row.lead?.hospitalName ?? '—'}</TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell>{row.mode ?? '—'}</TableCell>
                    <TableCell>{format(new Date(row.paidOn), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{row.recordedBy.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.verificationStatus)}>
                        {INSTALLMENT_VERIFICATION_LABEL[row.verificationStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.verificationStatus === 'PENDING' && canWrite ? (
                        <Button size="sm" onClick={() => { setActive(row); setRejectMode(false) }}>
                          Review
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setActive(row); setRejectMode(false) }}
                        >
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

      <Dialog open={!!active} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {active?.verificationStatus === 'PENDING' && canWrite && !rejectMode
                ? 'Verify payment'
                : 'Payment details'}
            </DialogTitle>
            <DialogDescription>
              {active?.lead
                ? `${active.lead.leadRef ?? '—'} · ${active.lead.patientName ?? '—'}`
                : 'Hospital-level payment (no case attached)'}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Hospital</p>
                  <p className="font-medium">
                    {active.hospitalName ?? active.lead?.hospitalName ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium tabular-nums">{formatCurrency(active.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mode / Reference</p>
                  <p className="font-medium">
                    {active.mode ?? '—'}
                    {active.reference ? ` · ${active.reference}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recorded by</p>
                  <p className="font-medium">{active.recordedBy.name}</p>
                </div>
              </div>
              {active.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2">
                    {active.notes}
                  </p>
                </div>
              )}
              {active.verificationStatus === 'REJECTED' && active.rejectionRemarks && (
                <div>
                  <p className="text-xs text-muted-foreground">Rejection remarks</p>
                  <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    {active.rejectionRemarks}
                  </p>
                </div>
              )}
              {active.verificationStatus === 'PENDING' && canWrite && rejectMode && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-remarks">Rejection remarks</Label>
                  <Textarea
                    id="rejection-remarks"
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    placeholder="Explain why this payment is rejected"
                    rows={4}
                  />
                </div>
              )}
              {active.leadId ? (
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/pl/outstanding/${active.leadId}`}>Open P/L Outstanding case</Link>
                </Button>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {active?.verificationStatus === 'PENDING' && canWrite ? (
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
                  <Button variant="outline" onClick={resetDialog} disabled={isPendingAction}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => setRejectMode(true)} disabled={isPendingAction}>
                    Reject
                  </Button>
                  <Button onClick={handleVerify} disabled={isPendingAction}>
                    {verifyMutation.isPending ? 'Verifying…' : 'Verify payment'}
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" onClick={resetDialog}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PaymentVerificationView
