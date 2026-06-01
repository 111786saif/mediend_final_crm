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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import Link from 'next/link'

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
  netProfit?: number
  surgeryDate?: string | Date
  surgeonName?: string
  bd?: { name?: string }
  admissionRecord?: { admissionDate?: string }
  plRecord?: Record<string, unknown> & {
    finalProfit?: number
    hospitalPayoutStatus?: string
    doctorPayoutStatus?: string
    mediendInvoiceStatus?: string
    doctorRemarks?: string
    costBreakdownRemarks?: string
  }
  dischargeSheet?: ({ id: string } & Record<string, unknown>) | null
  [key: string]: unknown
}

function getMonthFromDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

type PaidBy = '' | 'MEDIEND' | 'HOSPITAL'

interface PlRecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
}

export function PlRecordSheet({ open, onOpenChange, leadId }: PlRecordSheetProps) {
  const queryClient = useQueryClient()

  const { data: record, isLoading: loadingLead } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId && open,
  })

  const [formData, setFormData] = useState({
    month: '',
    admissionDate: '',
    surgeryDate: '',
    managerRole: '',
    managerName: '',
    bdmName: '',
    paymentType: '',
    status: '',
    approvedOrCash: '',
    paymentCollectedAt: '',
    totalAmount: '',
    billAmount: '',
    deductionAmount: '',
    cashOrDedPaid: '',
    referralAmount: '',
    cabCharges: '',
    dcCharges: '',
    doctorCharges: '',
    implantCost: '',
    instrumentsCost: '',
    implantPaidBy: '' as PaidBy,
    instrumentsPaidBy: '' as PaidBy,
    hospitalSharePct: '',
    hospitalShareAmount: '',
    mediendSharePct: '',
    mediendShareAmount: '',
    mediendNetProfit: '',
    remarks: '',
    doctorRemarks: '',
    costBreakdownRemarks: '',
    hospitalPayoutStatus: 'PENDING',
    doctorPayoutStatus: 'PENDING',
    mediendInvoiceStatus: 'PENDING',
    hospitalAmountPending: '',
    doctorAmountPending: '',
  })

  const initialized = useRef(false)
  useEffect(() => {
    if (!record || !open || initialized.current) return
    const pl = record.plRecord as Record<string, unknown> | undefined
    const surgeryDate = record.surgeryDate || (pl?.surgeryDate as string | Date | null | undefined)
    const monthFromSurgery = getMonthFromDate(surgeryDate)
    const monthValue = (pl?.month ? new Date(pl.month as string).toISOString().slice(0, 10) : null) || monthFromSurgery

    const admissionFromPl = pl?.admissionDate as string | undefined
    const admissionFromLead = record.admissionRecord?.admissionDate
    const admissionRaw = admissionFromPl || admissionFromLead

    const dedPatient =
      pl?.cashOrDedPaid != null && Number(pl.cashOrDedPaid) !== 0
        ? String(pl.cashOrDedPaid)
        : pl?.cashPaidByPatient != null && Number(pl.cashPaidByPatient) !== 0
          ? String(pl.cashPaidByPatient)
          : ''

    const ds = record.dischargeSheet as Record<string, unknown> | undefined
    const dedTotal =
      ds?.deductionAmount != null && Number(ds.deductionAmount) !== 0
        ? String(ds.deductionAmount)
        : record.deduction != null && Number(record.deduction) !== 0
          ? String(record.deduction)
          : ''

    const timer = setTimeout(() => {
      setFormData((prev) => {
        const next = {
          ...prev,
          month: monthValue ? monthValue.slice(0, 7) : '',
          admissionDate: admissionRaw ? new Date(admissionRaw as string).toISOString().slice(0, 10) : '',
          surgeryDate: surgeryDate ? new Date(surgeryDate as string).toISOString().slice(0, 10) : '',
          managerRole: (pl?.managerRole as string) || '',
          managerName: (pl?.managerName as string) || '',
          bdmName: (pl?.bdmName as string) || record.bd?.name || '',
          paymentType: (pl?.paymentType as string) || '',
          status: (pl?.status as string) || '',
          approvedOrCash: (pl?.approvedOrCash as string) ?? '',
          paymentCollectedAt: (pl?.paymentCollectedAt as string) || '',
          totalAmount: pl?.totalAmount != null ? String(pl.totalAmount) : '',
          billAmount: pl?.billAmount != null ? String(pl.billAmount) : (record.billAmount != null ? String(record.billAmount) : ''),
          deductionAmount: dedTotal,
          cashOrDedPaid: dedPatient,
          referralAmount: pl?.referralAmount != null ? String(pl.referralAmount) : '',
          cabCharges: pl?.cabCharges != null ? String(pl.cabCharges) : '',
          dcCharges: pl?.dcCharges != null ? String(pl.dcCharges) : '',
          doctorCharges: pl?.doctorCharges != null ? String(pl.doctorCharges) : '',
          implantCost: pl?.implantCost != null ? String(pl.implantCost) : '',
          instrumentsCost: pl?.instrumentsCost != null ? String(pl.instrumentsCost) : '',
          implantPaidBy: ((pl?.implantPaidBy as string) || '') as PaidBy,
          instrumentsPaidBy: ((pl?.instrumentsPaidBy as string) || '') as PaidBy,
          hospitalSharePct: pl?.hospitalSharePct != null ? String(pl.hospitalSharePct) : '',
          hospitalShareAmount: pl?.hospitalShareAmount != null ? String(pl.hospitalShareAmount) : '',
          mediendSharePct: pl?.mediendSharePct != null ? String(pl.mediendSharePct) : '',
          mediendShareAmount: pl?.mediendShareAmount != null ? String(pl.mediendShareAmount) : '',
          mediendNetProfit:
            pl?.mediendNetProfit != null
              ? String(pl.mediendNetProfit)
              : record.plRecord?.finalProfit != null
                ? String(record.plRecord.finalProfit)
                : record.netProfit != null
                  ? String(record.netProfit)
                  : '',
          remarks: (pl?.remarks as string) || '',
          doctorRemarks:
            (pl?.doctorRemarks as string) || (ds?.doctorRemarks as string) || '',
          costBreakdownRemarks:
            (pl?.costBreakdownRemarks as string) ||
            (ds?.costBreakdownRemarks as string) ||
            '',
          hospitalPayoutStatus: (record.plRecord?.hospitalPayoutStatus as string) || 'PENDING',
          doctorPayoutStatus: (record.plRecord?.doctorPayoutStatus as string) || 'PENDING',
          mediendInvoiceStatus: (record.plRecord?.mediendInvoiceStatus as string) || 'PENDING',
          hospitalAmountPending:
            pl?.hospitalAmountPending != null ? String(pl.hospitalAmountPending) : '',
          doctorAmountPending: pl?.doctorAmountPending != null ? String(pl.doctorAmountPending) : '',
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
      return apiPatch<Lead>(`/api/leads/${leadId}`, { plRecord: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['pl'] })
      toast.success('P/L record saved')
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to save')
    },
  })

  const update = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const bill = parseFloat(formData.billAmount) || 0
    const hospPct = parseFloat(formData.hospitalSharePct) || 0
    const medPct = parseFloat(formData.mediendSharePct) || 0
    const hospAmount = bill > 0 && hospPct > 0 ? (bill * hospPct) / 100 : parseFloat(formData.hospitalShareAmount) || 0
    const medAmount = bill > 0 && medPct > 0 ? (bill * medPct) / 100 : parseFloat(formData.mediendShareAmount) || 0

    const referral = parseFloat(formData.referralAmount) || 0
    const cab = parseFloat(formData.cabCharges) || 0
    const dc = parseFloat(formData.dcCharges) || 0
    const doctor = parseFloat(formData.doctorCharges) || 0
    const implant = parseFloat(formData.implantCost) || 0
    const instruments = parseFloat(formData.instrumentsCost) || 0

    let costs = referral + cab + dc + doctor
    if (formData.implantPaidBy !== 'HOSPITAL') costs += implant
    if (formData.instrumentsPaidBy !== 'HOSPITAL') costs += instruments

    const netProfit = medAmount - costs
    const mediendNet = parseFloat(formData.mediendNetProfit) || netProfit

    const payload: Record<string, unknown> = {
      month: formData.month ? new Date(`${formData.month}-01`).toISOString() : undefined,
      admissionDate: formData.admissionDate ? new Date(formData.admissionDate).toISOString() : undefined,
      surgeryDate: formData.surgeryDate ? new Date(formData.surgeryDate).toISOString() : undefined,
      managerRole: formData.managerRole || undefined,
      managerName: formData.managerName || undefined,
      bdmName: formData.bdmName || undefined,
      paymentType: formData.paymentType || undefined,
      status: formData.status || undefined,
      approvedOrCash: formData.approvedOrCash || undefined,
      paymentCollectedAt: formData.paymentCollectedAt || undefined,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      billAmount: parseFloat(formData.billAmount) || 0,
      cashPaidByPatient: 0,
      cashOrDedPaid: parseFloat(formData.cashOrDedPaid) || 0,
      deductionAmount: parseFloat(formData.deductionAmount) || 0,
      waivedOffAmount: Math.max(
        (parseFloat(formData.deductionAmount) || 0) - (parseFloat(formData.cashOrDedPaid) || 0),
        0
      ),
      referralAmount: referral,
      cabCharges: cab,
      dcCharges: dc,
      doctorCharges: doctor,
      implantCost: implant,
      instrumentsCost: instruments,
      implantPaidBy: formData.implantPaidBy ? formData.implantPaidBy : null,
      instrumentsPaidBy: formData.instrumentsPaidBy ? formData.instrumentsPaidBy : null,
      hospitalSharePct: parseFloat(formData.hospitalSharePct) || undefined,
      hospitalShareAmount: hospAmount,
      mediendSharePct: parseFloat(formData.mediendSharePct) || undefined,
      mediendShareAmount: medAmount,
      mediendNetProfit: mediendNet,
      finalProfit: mediendNet,
      remarks: formData.remarks || undefined,
      doctorRemarks: formData.doctorRemarks || null,
      costBreakdownRemarks: formData.costBreakdownRemarks || null,
      hospitalPayoutStatus: formData.hospitalPayoutStatus,
      doctorPayoutStatus: formData.doctorPayoutStatus,
      mediendInvoiceStatus: formData.mediendInvoiceStatus,
      hospitalAmountPending: parseFloat(formData.hospitalAmountPending) || 0,
      doctorAmountPending: parseFloat(formData.doctorAmountPending) || 0,
      closedAt:
        formData.hospitalPayoutStatus === 'PAID' && formData.doctorPayoutStatus === 'PAID'
          ? new Date().toISOString()
          : undefined,
    }
    updateMutation.mutate(payload)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[65vw] sm:max-w-[65vw] p-0 gap-0 overflow-hidden">
        {loadingLead || !record ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <SheetTitle className="text-xl font-bold bg-gradient-to-r from-teal-800 to-indigo-800 bg-clip-text text-transparent dark:from-teal-200 dark:to-indigo-200">
                Edit P/L Record — {record.leadRef ?? record.id}
              </SheetTitle>
              <SheetDescription>Profit &amp; loss entry details</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-6">
                <Card className="overflow-hidden border-teal-200/50 shadow-md dark:border-teal-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-gradient-to-r from-teal-500/10 to-indigo-500/10">
                    <div>
                      <CardTitle className="text-teal-950 dark:text-teal-100">Case context</CardTitle>
                      <CardDescription>Patient and case details (from lead)</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild className="border-teal-200 dark:border-teal-700">
                      <Link href={`/patient/${leadId}`}>View patient</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gradient-to-br from-teal-50/40 to-indigo-50/25 dark:from-teal-950/20 dark:to-indigo-950/15 rounded-b-lg">
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Lead ref</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="font-medium">{record.leadRef ?? '—'}</span>
                        {record.leadRef && <CopyLeadRefButton leadRef={String(record.leadRef)} />}
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
                      <Label className="text-xs text-muted-foreground">Admission (lead)</Label>
                      <p className="font-medium">
                        {record.admissionRecord?.admissionDate
                          ? new Date(record.admissionRecord.admissionDate).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Surgery date (lead)</Label>
                      <p className="font-medium">
                        {record.surgeryDate ? new Date(record.surgeryDate as string).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Reporting &amp; people</CardTitle>
                      <CardDescription>Month is prefilled from surgery date when available</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <Label>Reporting month</Label>
                        <Input type="month" value={formData.month} onChange={(e) => update('month', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Admission date</Label>
                        <Input type="date" value={formData.admissionDate} onChange={(e) => update('admissionDate', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Surgery date</Label>
                        <Input type="date" value={formData.surgeryDate} onChange={(e) => update('surgeryDate', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Manager role</Label>
                        <Input value={formData.managerRole} onChange={(e) => update('managerRole', e.target.value)} placeholder="ATL / TL / ACM / CM / SCM" className="mt-1" />
                      </div>
                      <div>
                        <Label>Manager name</Label>
                        <Input value={formData.managerName} onChange={(e) => update('managerName', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>BDM name</Label>
                        <Input value={formData.bdmName} onChange={(e) => update('bdmName', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Payment type</Label>
                        <Input value={formData.paymentType} onChange={(e) => update('paymentType', e.target.value)} placeholder="e.g. Cashless" className="mt-1" />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Input value={formData.status} onChange={(e) => update('status', e.target.value)} placeholder="e.g. IPD Done" className="mt-1" />
                      </div>
                      <div>
                        <Label>Approved / Cash</Label>
                        <Input value={formData.approvedOrCash} onChange={(e) => update('approvedOrCash', e.target.value)} className="mt-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Payment collected at</Label>
                        <Input value={formData.paymentCollectedAt} onChange={(e) => update('paymentCollectedAt', e.target.value)} placeholder="e.g. Collected By Hospital" className="mt-1" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Amounts</CardTitle>
                      <CardDescription>Total bill = hospital bill; approved amount = negotiated / case total</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <Label>Total bill</Label>
                        <Input type="number" step="0.01" value={formData.billAmount} onChange={(e) => update('billAmount', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Approved amount</Label>
                        <Input type="number" step="0.01" value={formData.totalAmount} onChange={(e) => update('totalAmount', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Total deduction</Label>
                        <Input type="number" step="0.01" value={formData.deductionAmount} onChange={(e) => update('deductionAmount', e.target.value)} placeholder="0.00" className="mt-1" />
                      </div>
                      <div>
                        <Label>Deduction paid by patient</Label>
                        <Input type="number" step="0.01" value={formData.cashOrDedPaid} onChange={(e) => update('cashOrDedPaid', e.target.value)} placeholder="0.00" className="mt-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Waived off (auto = total − paid by patient)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          readOnly
                          value={Math.max(
                            (parseFloat(formData.deductionAmount) || 0) - (parseFloat(formData.cashOrDedPaid) || 0),
                            0
                          ).toFixed(2)}
                          className="mt-1 bg-muted/40"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cost breakdown</CardTitle>
                      <CardDescription>Who pays implant / instruments affects Mediend net (hospital = excluded from Mediend costs)</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: 'referralAmount', label: 'Referral amount' },
                        { key: 'cabCharges', label: 'Cab charges' },
                        { key: 'dcCharges', label: 'D&C charges' },
                        { key: 'doctorCharges', label: 'Doctor charges' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <Label>{label}</Label>
                          <Input type="number" step="0.01" value={formData[key as keyof typeof formData]} onChange={(e) => update(key, e.target.value)} className="mt-1" />
                        </div>
                      ))}
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Implant cost</Label>
                          <Input type="number" step="0.01" value={formData.implantCost} onChange={(e) => update('implantCost', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Paid by</Label>
                          <Select value={formData.implantPaidBy || 'unset'} onValueChange={(v) => update('implantPaidBy', v === 'unset' ? '' : v)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Default: Mediend" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unset">Not set (Mediend)</SelectItem>
                              <SelectItem value="MEDIEND">Mediend</SelectItem>
                              <SelectItem value="HOSPITAL">Hospital</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Instrument cost</Label>
                          <Input type="number" step="0.01" value={formData.instrumentsCost} onChange={(e) => update('instrumentsCost', e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Paid by</Label>
                          <Select value={formData.instrumentsPaidBy || 'unset'} onValueChange={(v) => update('instrumentsPaidBy', v === 'unset' ? '' : v)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Default: Mediend" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unset">Not set (Mediend)</SelectItem>
                              <SelectItem value="MEDIEND">Mediend</SelectItem>
                              <SelectItem value="HOSPITAL">Hospital</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Doctor remarks</Label>
                        <Textarea value={formData.doctorRemarks} onChange={(e) => update('doctorRemarks', e.target.value)} placeholder="Notes about the doctor / doctor charges for this case" className="mt-1 resize-none" rows={2} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Cost breakdown remarks</Label>
                        <Textarea value={formData.costBreakdownRemarks} onChange={(e) => update('costBreakdownRemarks', e.target.value)} placeholder="Notes about implants / instruments / D&C / referral / cab costs" className="mt-1 resize-none" rows={2} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Revenue split</CardTitle>
                      <CardDescription>MediEND share (collected from hospital as partner) and final net profit</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <Label>MediEND share %</Label>
                        <Input type="number" step="0.01" value={formData.hospitalSharePct} onChange={(e) => update('hospitalSharePct', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>MediEND share amount</Label>
                        <Input type="number" step="0.01" value={formData.hospitalShareAmount} onChange={(e) => update('hospitalShareAmount', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>MediEND net %</Label>
                        <Input type="number" step="0.01" value={formData.mediendSharePct} onChange={(e) => update('mediendSharePct', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>MediEND net amount</Label>
                        <Input type="number" step="0.01" value={formData.mediendShareAmount} onChange={(e) => update('mediendShareAmount', e.target.value)} className="mt-1" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Mediend net profit</Label>
                        <Input type="number" step="0.01" value={formData.mediendNetProfit} onChange={(e) => update('mediendNetProfit', e.target.value)} className="mt-1 font-medium" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Payout &amp; invoice</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label>MediEND payout</Label>
                        <Select value={formData.hospitalPayoutStatus} onValueChange={(v) => update('hospitalPayoutStatus', v)}>
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
                        <Label>Doctor payout</Label>
                        <Select value={formData.doctorPayoutStatus} onValueChange={(v) => update('doctorPayoutStatus', v)}>
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
                        <Label>Mediend invoice</Label>
                        <Select value={formData.mediendInvoiceStatus} onValueChange={(v) => update('mediendInvoiceStatus', v)}>
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
                      <div>
                        <Label>MediEND amount pending</Label>
                        <Input type="number" step="0.01" value={formData.hospitalAmountPending} onChange={(e) => update('hospitalAmountPending', e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Doctor amount pending</Label>
                        <Input type="number" step="0.01" value={formData.doctorAmountPending} onChange={(e) => update('doctorAmountPending', e.target.value)} className="mt-1" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Remarks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Remarks</Label>
                        <Input value={formData.remarks} onChange={(e) => update('remarks', e.target.value)} className="mt-1" />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-3 pb-4">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save P/L record
                    </Button>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
