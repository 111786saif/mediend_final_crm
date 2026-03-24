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
  const leadId = params.leadId as string

  const { data: record, isLoading: loadingLead } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId,
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
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
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

  if (loadingLead || !record) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </ProtectedRoute>
    )
  }

  if (!record.dischargeSheet) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
          <div className="mx-auto max-w-4xl">
            <Card>
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pl/outstanding">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/pl/outstanding" className="hover:text-foreground">
                  P/L Outstanding
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">
                  Edit Outstanding — {record.leadRef ?? record.id}
                </span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5">Edit Outstanding Record</h1>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Case context</CardTitle>
                <CardDescription>Patient and case details (from lead)</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/patient/${leadId}`}>View patient</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 rounded-lg">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payout Statuses</CardTitle>
                <CardDescription>Update the payout status for hospital, doctor, and invoice</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Hospital Payout Status</Label>
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

            <Card>
              <CardHeader>
                <CardTitle>Pending Amounts</CardTitle>
                <CardDescription>Amounts still pending for hospital and doctor payouts</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Hospital Amount Pending</Label>
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

            <Card>
              <CardHeader>
                <CardTitle>Payment & Remarks</CardTitle>
                <CardDescription>Mark payment received and add follow-up notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

            <div className="flex gap-3">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Outstanding Record
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/pl/outstanding">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
