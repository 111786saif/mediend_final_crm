'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ProtectedRoute } from '@/components/protected-route'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import { formatPlDate, formatPlMonth, formatPlRupee } from '@/lib/pl/resolve-pl-row'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import {
  useCreatePlInvoiceRequest,
  usePlInvoiceRequests,
} from '@/hooks/use-invoice-requests'
import {
  INVOICE_REQUEST_STATUS_LABEL,
  type InvoiceRequestRecord,
  type InvoiceRequestStatus,
} from '@/lib/finance/invoice-request/types'

type HospitalCase = {
  leadId: string
  leadRef: string | null
  patientName: string | null
  doctorName: string | null
  surgeryDate: string | null
  month: string | null
  status: string | null
  billAmount: number | null
  mediendShareAmount: number | null
  hospitalAmountPending: number | null
  mediendInvoiceStatus: string | null
  mediendReceived: number
}

type HospitalDetail = {
  name: string
  kpis: {
    totalCases: number
    amountReceived: number
    pendingOutstanding: number
    mediendShare: number
  }
  cases: HospitalCase[]
}

function invoiceRequestBadgeVariant(
  status: InvoiceRequestStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'VERIFIED') return 'default'
  if (status === 'REJECTED') return 'destructive'
  return 'outline'
}

export default function HospitalDetailPage() {
  const params = useParams()
  const search = useSearchParams()
  const { user } = useAuth()
  const canRequestInvoice = user ? hasPermission(user, 'pl:write') : false

  const rawName = params.name as string
  const name = decodeURIComponent(rawName)
  const startDate = search.get('startDate')
  const endDate = search.get('endDate')

  const [requestCase, setRequestCase] = useState<HospitalCase | null>(null)
  const [requestRemarks, setRequestRemarks] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')

  const { data, isLoading } = useQuery<HospitalDetail>({
    queryKey: ['hospitals', name, startDate, endDate],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (startDate && endDate) {
        qs.set('startDate', startDate)
        qs.set('endDate', endDate)
      }
      const tail = qs.toString()
      return apiGet<HospitalDetail>(
        `/api/hospitals/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`,
      )
    },
    enabled: !!name,
  })

  const { data: invoiceData, isLoading: invoicesLoading } = usePlInvoiceRequests(
    {
      hospitalName: name,
      status: 'ALL',
      latestPerLead: true,
    },
    !!name,
  )

  const invoiceByLeadId = useMemo(() => {
    const map = new Map<string, InvoiceRequestRecord>()
    for (const req of invoiceData?.requests ?? []) {
      map.set(req.leadId, req)
    }
    return map
  }, [invoiceData?.requests])

  const createInvoice = useCreatePlInvoiceRequest()

  const openRequestDialog = (c: HospitalCase, e: React.MouseEvent) => {
    e.stopPropagation()
    setRequestCase(c)
    setRequestRemarks('')
    setInvoiceNumber('')
    setInvoiceAmount(
      c.mediendShareAmount != null && c.mediendShareAmount > 0
        ? String(c.mediendShareAmount)
        : '',
    )
  }

  const closeRequestDialog = () => {
    setRequestCase(null)
    setRequestRemarks('')
    setInvoiceNumber('')
    setInvoiceAmount('')
  }

  const handleSubmitRequest = async () => {
    if (!requestCase) return
    const amount = invoiceAmount.trim() ? Number(invoiceAmount) : undefined
    if (amount != null && (Number.isNaN(amount) || amount < 0)) {
      toast.error('Invoice amount must be a valid number')
      return
    }

    try {
      await createInvoice.mutateAsync({
        leadId: requestCase.leadId,
        requestRemarks: requestRemarks.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceAmount: amount,
      })
      toast.success('Invoice request submitted to Finance')
      closeRequestDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit invoice request')
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/35 to-indigo-50/35 p-6 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="text-sky-800 dark:text-sky-200">
              <Link href="/hospitals" aria-label="Back to hospital list">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/hospitals" className="font-medium hover:text-foreground">
                  Hospital List
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{name}</span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5 flex items-center gap-2 bg-gradient-to-r from-sky-800 to-indigo-800 bg-clip-text text-transparent dark:from-sky-200 dark:to-indigo-200">
                <Building2 className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                {name}
              </h1>
              {startDate && endDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Filtered: {startDate} → {endDate}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <KpiTile label="Cases" value={data?.kpis.totalCases ?? 0} />
            <KpiTile label="Amount received" value={formatPlRupee(data?.kpis.amountReceived ?? null)} />
            <KpiTile label="Pending outstanding" value={formatPlRupee(data?.kpis.pendingOutstanding ?? null)} />
            <KpiTile label="Total MediEND share" value={formatPlRupee(data?.kpis.mediendShare ?? null)} />
          </div>

          <Card className="overflow-hidden border-sky-200/50 shadow-md dark:border-sky-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-sky-500/10 to-indigo-500/8">
              <CardTitle className="text-sky-950 dark:text-sky-100">Cases</CardTitle>
              <CardDescription>
                Click a case to open its outstanding record. Use Invoice to request PDF from Finance.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sky-50/40 hover:bg-sky-50/40 dark:bg-sky-950/20">
                    <TableHead>Lead Ref</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Surgery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">MediEND share</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !data?.cases?.length ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No cases yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cases.map((c) => {
                      const invoiceReq = invoiceByLeadId.get(c.leadId)
                      return (
                        <TableRow
                          key={c.leadId}
                          className="cursor-pointer hover:bg-sky-50/30 dark:hover:bg-sky-950/15"
                          onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                        >
                          <TableCell className="whitespace-nowrap">{c.leadRef ?? '—'}</TableCell>
                          <TableCell>{c.patientName ?? '—'}</TableCell>
                          <TableCell>{c.doctorName ?? '—'}</TableCell>
                          <TableCell>{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                          <TableCell>
                            {formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}
                          </TableCell>
                          <TableCell>{c.status ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.billAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.mediendShareAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.mediendReceived || null)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.hospitalAmountPending)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <InvoiceCell
                              caseRow={c}
                              invoiceReq={invoiceReq}
                              invoicesLoading={invoicesLoading}
                              canRequest={canRequestInvoice}
                              requesting={
                                createInvoice.isPending && requestCase?.leadId === c.leadId
                              }
                              onRequest={(e) => openRequestDialog(c, e)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!requestCase} onOpenChange={(open) => !open && closeRequestDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Invoice</DialogTitle>
            <DialogDescription>
              {requestCase?.leadRef ?? 'Case'} · {requestCase?.patientName ?? 'Patient'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-number">Invoice number (optional)</Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount">Invoice amount (optional)</Label>
              <Input
                id="invoice-amount"
                type="number"
                min={0}
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-remarks">Remarks (optional)</Label>
              <Textarea
                id="request-remarks"
                value={requestRemarks}
                onChange={(e) => setRequestRemarks(e.target.value)}
                placeholder="Notes for Finance"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRequestDialog} disabled={createInvoice.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

function InvoiceCell({
  caseRow,
  invoiceReq,
  invoicesLoading,
  canRequest,
  requesting,
  onRequest,
}: {
  caseRow: HospitalCase
  invoiceReq?: InvoiceRequestRecord
  invoicesLoading: boolean
  canRequest: boolean
  requesting: boolean
  onRequest: (e: React.MouseEvent) => void
}) {
  if (invoicesLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  if (invoiceReq) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Badge variant={invoiceRequestBadgeVariant(invoiceReq.status)}>
          {INVOICE_REQUEST_STATUS_LABEL[invoiceReq.status]}
        </Badge>

        {invoiceReq.status === 'VERIFIED' && invoiceReq.invoicePdfUrl && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
            <a href={invoiceReq.invoicePdfUrl} target="_blank" rel="noreferrer">
              <FileText className="mr-1 h-3.5 w-3.5" />
              File
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}

        {invoiceReq.status === 'REJECTED' && canRequest && (
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={onRequest}>
            Re-request
          </Button>
        )}

        {invoiceReq.status === 'REJECTED' && invoiceReq.rejectionRemarks && (
          <p className="max-w-[160px] text-[10px] text-muted-foreground line-clamp-2">
            {invoiceReq.rejectionRemarks}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge
        variant={
          caseRow.mediendInvoiceStatus === 'PAID'
            ? 'default'
            : caseRow.mediendInvoiceStatus === 'SENT'
              ? 'secondary'
              : 'outline'
        }
      >
        {caseRow.mediendInvoiceStatus ?? 'PENDING'}
      </Badge>
      {canRequest && (
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onRequest}
          disabled={requesting}
        >
          {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Request'}
        </Button>
      )}
    </div>
  )
}

function KpiTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="border-sky-200/40 dark:border-sky-800/30">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
