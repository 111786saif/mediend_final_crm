'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PaymentInstallmentsCard } from '@/components/pl/payment-installments-card'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions, PermissionLevel } from '@/hooks/use-permissions'
import { hasPermission } from '@/lib/rbac'

interface Lead {
  id: string
  leadRef?: string
  patientName?: string
  phoneNumber?: string
  hospitalName?: string
  treatment?: string
  category?: string
  circle?: string
  source?: string
  billAmount?: number
  surgeryDate?: string | Date
  bd?: { name?: string }
  dischargeSheet?: { id: string } | null
  outstandingCase?: {
    paymentReceived?: boolean
    remark2?: string | null
  } | null
  plRecord?: Record<string, unknown> & {
    hospitalPayoutStatus?: string
    doctorPayoutStatus?: string
    mediendInvoiceStatus?: string
    hospitalAmountPending?: number
    doctorAmountPending?: number
  }
  [key: string]: unknown
}

export default function PLOutstandingEditPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { hasAccess } = usePermissions()
  const canWrite = user ? (hasAccess('insurance_pl.pl_ledger', PermissionLevel.READ_WRITE) || hasPermission(user, 'pl:write')) : false
  const leadId = params.leadId as string

  const {
    data: record,
    isLoading: loadingLead,
    isError,
    error,
    refetch,
  } = useQuery<Lead>({
    queryKey: ['outstanding-detail', leadId],
    queryFn: () => apiGet<Lead>(`/api/outstanding/${leadId}`),
    enabled: !!leadId,
    retry: 1,
  })

  const [formData, setFormData] = useState({
    hospitalPayoutStatus: 'PENDING',
    doctorPayoutStatus: 'PENDING',
    mediendInvoiceStatus: 'PENDING',
    hospitalAmountPending: '',
    doctorAmountPending: '',
    paymentReceived: false,
    remark2: '',
  })

  const initialized = useRef(false)
  useEffect(() => {
    if (!record || initialized.current) return
    const pl = record.plRecord as Record<string, unknown> | undefined

    const timer = setTimeout(() => {
      setFormData((prev) => {
        const oc = record.outstandingCase
        const next = {
          ...prev,
          hospitalPayoutStatus: (pl?.hospitalPayoutStatus as string) || 'PENDING',
          doctorPayoutStatus: (pl?.doctorPayoutStatus as string) || 'PENDING',
          mediendInvoiceStatus: (pl?.mediendInvoiceStatus as string) || 'PENDING',
          hospitalAmountPending: pl?.hospitalAmountPending != null ? String(pl.hospitalAmountPending) : '',
          doctorAmountPending: pl?.doctorAmountPending != null ? String(pl.doctorAmountPending) : '',
          paymentReceived: oc?.paymentReceived ?? false,
          remark2: oc?.remark2 ?? '',
        }
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev
        return next
      })
      initialized.current = true
    }, 0)
    return () => clearTimeout(timer)
  }, [record])

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiPatch<Lead>(`/api/outstanding/${leadId}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-detail', leadId] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
      toast.success('Outstanding record updated')
      router.push('/pl/outstanding')
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to update')
    },
  })

  const update = (key: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [key]: key === 'paymentReceived' ? (value === 'true' || value === true) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      hospitalPayoutStatus: formData.hospitalPayoutStatus,
      doctorPayoutStatus: formData.doctorPayoutStatus,
      mediendInvoiceStatus: formData.mediendInvoiceStatus,
      hospitalAmountPending: parseFloat(formData.hospitalAmountPending) || 0,
      doctorAmountPending: parseFloat(formData.doctorAmountPending) || 0,
      paymentReceived: formData.paymentReceived,
      remark2: formData.remark2.trim() || null,
    }
    updateMutation.mutate(payload)
  }

  if (loadingLead) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/40 p-6 flex items-center justify-center dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 dark:text-amber-400" />
        </div>
      </ProtectedRoute>
    )
  }

  if (isError || !record) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/40 p-6 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900">
          <div className="mx-auto max-w-4xl">
            <Card className="border-amber-200/60 shadow-md dark:border-amber-800/40">
              <CardHeader>
                <CardTitle>Unable to open outstanding record</CardTitle>
                <CardDescription>
                  {error instanceof Error ? error.message : 'Failed to load this case.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pl/outstanding">Back to P/L Outstanding</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!record.dischargeSheet) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/40 p-6 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900">
          <div className="mx-auto max-w-4xl">
            <Card className="border-amber-200/60 shadow-md dark:border-amber-800/40">
              <CardHeader>
                <CardTitle>No Discharge Sheet</CardTitle>
                <CardDescription>This case does not have a discharge sheet yet.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <Link href="/pl/outstanding">Back to P/L Outstanding</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/35 to-violet-50/30 p-6 dark:from-slate-950 dark:via-amber-950/20 dark:to-violet-950/15">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              <Link href="/pl/outstanding">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/pl/outstanding" className="font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100">
                  P/L Outstanding
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">
                  {canWrite ? 'Edit Outstanding' : 'Outstanding'} — {record.leadRef ?? record.id}
                </span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5 bg-gradient-to-r from-amber-800 to-violet-800 bg-clip-text text-transparent dark:from-amber-200 dark:to-violet-200">
                {canWrite ? 'Edit Outstanding Record' : 'Outstanding Record'}
              </h1>
            </div>
          </div>

          <Card className="overflow-hidden border-violet-200/50 shadow-md dark:border-violet-800/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-gradient-to-r from-violet-500/10 to-amber-500/8">
              <div>
                <CardTitle className="text-violet-950 dark:text-violet-100">Case context</CardTitle>
                <CardDescription>Patient and case details (from lead)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DischargeSummaryDialog
                  leadId={leadId}
                  preloaded={(record.dischargeSheet as never) ?? null}
                />
                <Button variant="outline" size="sm" asChild className="border-violet-200 dark:border-violet-700">
                  <Link href={`/patient/${leadId}`}>View patient</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gradient-to-br from-violet-50/40 to-amber-50/20 dark:from-violet-950/20 dark:to-amber-950/10 rounded-b-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Lead Ref</Label>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="font-medium">{record.leadRef ?? '—'}</p>
                  {record.leadRef ? <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" /> : null}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Patient</Label>
                <p className="font-medium">{record.patientName ?? '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hospital</Label>
                <p className="font-medium">{record.hospitalName ?? '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Treatment</Label>
                <p className="font-medium">{record.treatment ?? '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Surgery date</Label>
                <p className="font-medium">
                  {record.surgeryDate ? new Date(record.surgeryDate as string).toLocaleDateString() : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={(e) => { if (!canWrite) { e.preventDefault(); return } handleSubmit(e) }} className="space-y-6">
            <Card className="overflow-hidden border-teal-200/50 shadow-sm dark:border-teal-800/35">
              <CardHeader className="border-b bg-gradient-to-r from-teal-500/10 to-cyan-500/8">
                <CardTitle className="text-teal-950 dark:text-teal-100">Payout Statuses</CardTitle>
                <CardDescription>
                  {canWrite
                    ? 'Update the payout status for MediEND, doctor, and invoice'
                    : 'Current payout status for MediEND, doctor, and invoice'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>MediEND Payout Status</Label>
                  {canWrite ? (
                    <Select value={formData.hospitalPayoutStatus} onValueChange={(value) => update('hospitalPayoutStatus', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 font-medium">{formData.hospitalPayoutStatus}</p>
                  )}
                </div>
                <div>
                  <Label>Doctor Payout Status</Label>
                  {canWrite ? (
                    <Select value={formData.doctorPayoutStatus} onValueChange={(value) => update('doctorPayoutStatus', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 font-medium">{formData.doctorPayoutStatus}</p>
                  )}
                </div>
                <div>
                  <Label>Mediend Invoice Status</Label>
                  {canWrite ? (
                    <Select value={formData.mediendInvoiceStatus} onValueChange={(value) => update('mediendInvoiceStatus', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">PENDING</SelectItem>
                        <SelectItem value="SENT">SENT</SelectItem>
                        <SelectItem value="PAID">PAID</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 font-medium">{formData.mediendInvoiceStatus}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-amber-200/50 shadow-sm dark:border-amber-800/35">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-orange-500/8">
                <CardTitle className="text-amber-950 dark:text-amber-100">Pending Amounts</CardTitle>
                <CardDescription>Amounts still pending for MediEND and doctor payouts (auto-updated by installments below)</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>MediEND Amount Pending</Label>
                  {canWrite ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.hospitalAmountPending}
                      onChange={(e) => update('hospitalAmountPending', e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 font-medium tabular-nums">{formData.hospitalAmountPending || '0.00'}</p>
                  )}
                </div>
                <div>
                  <Label>Doctor Amount Pending</Label>
                  {canWrite ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.doctorAmountPending}
                      onChange={(e) => update('doctorAmountPending', e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 font-medium tabular-nums">{formData.doctorAmountPending || '0.00'}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-emerald-200/50 shadow-sm dark:border-emerald-800/35">
              <CardHeader className="border-b bg-gradient-to-r from-emerald-500/10 to-green-500/8">
                <CardTitle className="text-emerald-950 dark:text-emerald-100">Payment & Remarks</CardTitle>
                <CardDescription>
                  {canWrite ? 'Mark payment received and add follow-up notes' : 'Payment status and follow-up notes'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canWrite ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="paymentReceived"
                      checked={formData.paymentReceived}
                      onChange={(e) => update('paymentReceived', e.target.checked)}
                      className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                    />
                    <Label htmlFor="paymentReceived" className="cursor-pointer">
                      Payment Received
                    </Label>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">Payment Received</Label>
                    <p className="mt-1 font-medium">{formData.paymentReceived ? 'Received' : 'Pending'}</p>
                  </div>
                )}
                <div>
                  <Label>Follow-up Remarks (remark2)</Label>
                  {canWrite ? (
                    <Textarea
                      value={formData.remark2}
                      onChange={(e) => update('remark2', e.target.value)}
                      placeholder="Enter follow-up notes..."
                      className="mt-1 resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{formData.remark2 || '—'}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <PaymentInstallmentsCard leadId={leadId} canWrite={canWrite} />

            <div className="flex gap-3">
              {canWrite && (
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-700 hover:to-indigo-700"
                >
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Outstanding Record
                </Button>
              )}
              <Button type="button" variant="outline" asChild className="border-violet-200 dark:border-violet-700">
                <Link href="/pl/outstanding">{canWrite ? 'Cancel' : 'Back'}</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
