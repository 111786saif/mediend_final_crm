'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useMemo } from 'react'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PaymentInstallmentsCard } from '@/components/pl/payment-installments-card'
import { resolvePlRow } from '@/lib/pl/resolve-pl-row'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

interface PlOutstandingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
}

export function PlOutstandingSheet({ open, onOpenChange, leadId }: PlOutstandingSheetProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: record, isLoading: loadingLead } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId && open,
  })

  const resolved = useMemo(() => {
    return record ? resolvePlRow(record as unknown as Record<string, unknown>) : null
  }, [record])

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
    if (!record || !open || initialized.current) return
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
  }, [record, open])

  useEffect(() => {
    if (!open) {
      initialized.current = false
    }
  }, [open])

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiPatch<Lead>(`/api/outstanding/${leadId}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
      toast.success('Outstanding record updated')
      onOpenChange(false)
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

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[65vw] sm:max-w-[65vw] p-0 gap-0 flex flex-col">
        {loadingLead || !record ? (
          <div className="flex items-center justify-center h-full">
            <SheetTitle className="sr-only">Loading Record</SheetTitle>
            <SheetDescription className="sr-only">Please wait while the record is loading</SheetDescription>
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : !record.dischargeSheet ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <SheetTitle className="sr-only">No Discharge Sheet</SheetTitle>
            <SheetDescription className="sr-only">This case does not have a discharge sheet yet</SheetDescription>
            <p className="text-muted-foreground text-center">This case does not have a discharge sheet yet.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <SheetTitle className="text-xl font-bold bg-gradient-to-r from-amber-800 to-violet-800 bg-clip-text text-transparent dark:from-amber-200 dark:to-violet-200">
                Edit Outstanding — {record.leadRef ?? record.id}
              </SheetTitle>
              <SheetDescription>Payout statuses and pending amounts</SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-violet-200 dark:border-violet-700"
                      onClick={() => {
                        onOpenChange(false)
                        setTimeout(() => router.push(`/patient/${leadId}`), 100)
                      }}
                    >
                      View patient
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 bg-gradient-to-br from-violet-50/40 to-amber-50/20 dark:from-violet-950/20 dark:to-amber-950/10 rounded-b-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Lead Ref</Label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="font-medium">{record.leadRef ?? '—'}</p>
                      {record.leadRef ? <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" /> : null}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Patient</Label>
                    <p className="font-medium">{resolved?.patient ?? record.patientName ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hospital</Label>
                    <p className="font-medium">{resolved?.hospital ?? record.hospitalName ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Doctor</Label>
                    <p className="font-medium">{resolved?.doctor ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Treatment</Label>
                    <p className="font-medium">{resolved?.treatment ?? record.treatment ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Surgery date</Label>
                    <p className="font-medium">
                      {record.surgeryDate ? new Date(record.surgeryDate as string).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="overflow-hidden border-teal-200/50 shadow-sm dark:border-teal-800/35">
                  <CardHeader className="border-b bg-gradient-to-r from-teal-500/10 to-cyan-500/8">
                    <CardTitle className="text-teal-950 dark:text-teal-100">Payout Statuses</CardTitle>
                    <CardDescription>Update the payout status for MediEND, doctor, and invoice</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>MediEND Payout Status</Label>
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
                    </div>
                    <div>
                      <Label>Doctor Payout Status</Label>
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
                    </div>
                    <div>
                      <Label>Mediend Invoice Status</Label>
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
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.hospitalAmountPending}
                        onChange={(e) => update('hospitalAmountPending', e.target.value)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Doctor Amount Pending</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.doctorAmountPending}
                        onChange={(e) => update('doctorAmountPending', e.target.value)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-emerald-200/50 shadow-sm dark:border-emerald-800/35">
                  <CardHeader className="border-b bg-gradient-to-r from-emerald-500/10 to-green-500/8">
                    <CardTitle className="text-emerald-950 dark:text-emerald-100">Payment & Remarks</CardTitle>
                    <CardDescription>Mark payment received and add follow-up notes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="payRecvSheet"
                        checked={formData.paymentReceived}
                        onChange={(e) => update('paymentReceived', e.target.checked)}
                        className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                      />
                      <Label htmlFor="payRecvSheet" className="cursor-pointer">
                        Payment Received
                      </Label>
                    </div>
                    <div>
                      <Label>Follow-up Remarks (remark2)</Label>
                      <Textarea
                        value={formData.remark2}
                        onChange={(e) => update('remark2', e.target.value)}
                        placeholder="Enter follow-up notes..."
                        className="mt-1 resize-none"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <PaymentInstallmentsCard
                  leadId={leadId}
                  doctorName={resolved?.doctor}
                  hospitalName={resolved?.hospital}
                />

                <div className="flex gap-3 pb-4">
                  <Button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-700 hover:to-indigo-700"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Outstanding Record
                  </Button>
                  <Button type="button" variant="outline" className="border-violet-200 dark:border-violet-700" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
