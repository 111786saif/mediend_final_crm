'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useMemo } from 'react'
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
  netProfit?: number
  surgeryDate?: string | Date
  surgeonName?: string
  bd?: { name?: string }
  admissionRecord?: {
    admissionDate?: string
    surgeryDate?: string
    notes?: string
    ipdStatusNotes?: string
    implantConsumables?: string
    instrument?: string
  }
  plRecord?: Record<string, unknown> & {
    finalProfit?: number
    outstandingStatus?: string
    hospitalPayoutStatus?: string
    doctorPayoutStatus?: string
    mediendInvoiceStatus?: string
    doctorRemarks?: string
    costBreakdownRemarks?: string
  }
  dischargeSheet?: ({ id: string } & Record<string, unknown>) | null
  hospitalShare?: number | null
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

const DC_FIELD_KEYS = [
  'pharmacy',
  'investigation',
  'consumables',
  'anesthesia',
] as const

const DC_LABELS: Record<string, string> = {
  pharmacy: 'Pharmacy',
  investigation: 'Investigation',
  consumables: 'Consumables',
  anesthesia: 'Anesthesia',
}

function inr(v: number) {
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function PLRecordEditPage() {
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
    month: '',
    admissionDate: '',
    surgeryDate: '',
    managerName: '',
    bdmName: '',
    paymentType: '',
    status: '',
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
    actualImplantCost: '',
    actualInstrumentCost: '',
    implantPaidBy: '' as PaidBy,
    instrumentsPaidBy: '' as PaidBy,
    hospitalSharePct: '',
    hospitalShareAmount: '',
    mediendSharePct: '',
    mediendShareAmount: '',
    mediendNetProfit: '',
    mediendProfit: '',
    remarks: '',
    doctorRemarks: '',
    costBreakdownRemarks: '',
    hospitalPayoutStatus: 'PENDING',
    doctorPayoutStatus: 'PENDING',
    mediendInvoiceStatus: 'PENDING',
    hospitalAmountPending: '',
    doctorAmountPending: '',
    copayAmount: '',
    otherDeduction: '',
    collectedByHospital: '',
    collectedByMediend: '',
    discountAmount: '',
    axisTariffDeduction: '',
    axisTariffDeductionPaid: '',
    finalApprovedAmount: '',
    actualFinalAmount: '',
    netSettlementAmount: '',
  })

  const [dcChecked, setDcChecked] = useState<Record<string, boolean>>({
    pharmacy: false,
    investigation: false,
    consumables: false,
    anesthesia: false,
  })

  const [dsBillAmounts, setDsBillAmounts] = useState<Record<string, number>>({
    pharmacy: 0,
    investigation: 0,
    consumables: 0,
    anesthesia: 0,
  })

  const initialized = useRef(false)
  useEffect(() => {
    if (!record || initialized.current) return
    const pl = record.plRecord as Record<string, unknown> | undefined
    const admission = record.admissionRecord
    const ds = record.dischargeSheet as Record<string, unknown> | undefined

    const surgeryDate =
      record.surgeryDate ||
      (pl?.surgeryDate as string | Date | null | undefined) ||
      admission?.surgeryDate ||
      (ds?.surgeryDate as string | Date | null | undefined)
    const monthFromSurgery = getMonthFromDate(surgeryDate)
    const monthValue = (pl?.month ? new Date(pl.month as string).toISOString().slice(0, 10) : null) || monthFromSurgery

    const admissionFromPl = pl?.admissionDate as string | undefined
    const admissionFromLead = admission?.admissionDate
    const admissionRaw = admissionFromPl || admissionFromLead

    const dedPatient =
      pl?.cashOrDedPaid != null && Number(pl.cashOrDedPaid) !== 0
        ? String(pl.cashOrDedPaid)
        : pl?.cashPaidByPatient != null && Number(pl.cashPaidByPatient) !== 0
          ? String(pl.cashPaidByPatient)
          : ''

    const dedTotal =
      ds?.deductionAmount != null && Number(ds.deductionAmount) !== 0
        ? String(ds.deductionAmount)
        : record.deduction != null && Number(record.deduction) !== 0
          ? String(record.deduction)
          : ''

    const numVal = (v: unknown) => (v != null ? Number(v) : 0)

    const billAmts: Record<string, number> = {
      pharmacy: numVal(ds?.pharmacyAmount),
      investigation: numVal(ds?.investigationAmount),
      consumables: numVal(ds?.consumablesAmount),
      anesthesia: numVal(ds?.anesthesiaAmount),
    }
    setDsBillAmounts(billAmts)

    const timer = setTimeout(() => {
      setFormData((prev) => {
        const next = {
          ...prev,
          month: monthValue ? monthValue.slice(0, 7) : '',
          admissionDate: admissionRaw ? new Date(admissionRaw as string).toISOString().slice(0, 10) : '',
          surgeryDate: surgeryDate ? new Date(surgeryDate as string).toISOString().slice(0, 10) : '',
          managerName: (pl?.managerName as string) || '',
          bdmName: (pl?.bdmName as string) || record.bd?.name || '',
          paymentType: (pl?.paymentType as string) || (ds?.paymentType as string) || (record.flowType as string) || '',
          status: (pl?.status as string) || (ds?.status as string) || (record.caseStage as string) || '',
          paymentCollectedAt: (pl?.paymentCollectedAt as string) || '',
          totalAmount: pl?.totalAmount != null ? String(pl.totalAmount) : (ds?.finalApprovedAmount != null ? String(ds.finalApprovedAmount) : (record.settledTotal != null ? String(record.settledTotal) : (record.billAmount != null ? String(record.billAmount) : ''))),
          billAmount: pl?.billAmount != null ? String(pl.billAmount) : (record.billAmount != null ? String(record.billAmount) : ''),
          deductionAmount: dedTotal,
          cashOrDedPaid: dedPatient,
          referralAmount: pl?.referralAmount != null ? String(pl.referralAmount) : '',
          cabCharges: pl?.cabCharges != null ? String(pl.cabCharges) : '',
          dcCharges: pl?.dcCharges != null ? String(pl.dcCharges) : '',
          doctorCharges: pl?.doctorCharges != null ? String(pl.doctorCharges) : '',
          implantCost: pl?.implantCost != null ? String(pl.implantCost) : (ds?.implantCost != null ? String(ds.implantCost) : ''),
          instrumentsCost: pl?.instrumentsCost != null ? String(pl.instrumentsCost) : (ds?.instrumentsCost != null ? String(ds.instrumentsCost) : ''),
          actualImplantCost: pl?.actualImplantCost != null ? String(pl.actualImplantCost) : (pl?.implantCost != null ? String(pl.implantCost) : (ds?.implantCost != null ? String(ds.implantCost) : '')),
          actualInstrumentCost: pl?.actualInstrumentCost != null ? String(pl.actualInstrumentCost) : (pl?.instrumentsCost != null ? String(pl.instrumentsCost) : (ds?.instrumentsCost != null ? String(ds.instrumentsCost) : '')),
          implantPaidBy: ((pl?.implantPaidBy as string) || (ds?.implantPaidBy as string) || '') as PaidBy,
          instrumentsPaidBy: ((pl?.instrumentsPaidBy as string) || (ds?.instrumentsPaidBy as string) || '') as PaidBy,
          hospitalSharePct: pl?.hospitalSharePct != null ? String(pl.hospitalSharePct) : (record.hospitalShare != null ? String(record.hospitalShare) : ''),
          hospitalShareAmount: pl?.hospitalShareAmount != null ? String(pl.hospitalShareAmount) : '',
          mediendSharePct: pl?.mediendSharePct != null ? String(pl.mediendSharePct) : (record.hospitalShare != null ? String(100 - record.hospitalShare) : ''),
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
          copayAmount: ds?.copayAmount != null ? String(ds.copayAmount) : '',
          otherDeduction: ds?.otherDeduction != null ? String(ds.otherDeduction) : '',
          collectedByHospital: ds?.collectedByHospital != null ? String(ds.collectedByHospital) : '',
          collectedByMediend: ds?.collectedByMediend != null ? String(ds.collectedByMediend) : '',
          discountAmount: ds?.discountAmount != null ? String(ds.discountAmount) : '',
          axisTariffDeduction: ds?.axisTariffDeduction != null ? String(ds.axisTariffDeduction) : '',
          axisTariffDeductionPaid: ds?.axisTariffDeductionPaid != null ? String(ds.axisTariffDeductionPaid) : '',
          finalApprovedAmount: ds?.finalApprovedAmount != null ? String(ds.finalApprovedAmount) : '',
          actualFinalAmount: ds?.actualFinalAmount != null ? String(ds.actualFinalAmount) : (pl?.billAmount != null ? String(pl.billAmount) : (record.billAmount != null ? String(record.billAmount) : '')),
          netSettlementAmount: ds?.netSettlementAmount != null ? String(ds.netSettlementAmount) : '',
        }
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev
        return next
      })
      initialized.current = true
    }, 0)
    return () => clearTimeout(timer)
  }, [record])

  const computedDcTotal = useMemo(() => {
    return DC_FIELD_KEYS.reduce((sum, key) => {
      if (dcChecked[key]) return sum + (dsBillAmounts[key] || 0)
      return sum
    }, 0)
  }, [dcChecked, dsBillAmounts])

  const computedWaivedOff = useMemo(() => {
    const dedTotal = parseFloat(formData.deductionAmount) || 0
    const paid = parseFloat(formData.cashOrDedPaid) || 0
    return Math.max(dedTotal - paid, 0)
  }, [formData.deductionAmount, formData.cashOrDedPaid])

  const computedDedPaidTotal = useMemo(() => {
    return (parseFloat(formData.collectedByHospital) || 0) + (parseFloat(formData.collectedByMediend) || 0)
  }, [formData.collectedByHospital, formData.collectedByMediend])

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiPatch<Lead>(`/api/leads/${leadId}`, { plRecord: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['pl'] })
      router.push('/pl/dashboard')
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to save')
    },
  })

  const update = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent, status: 'DRAFT' | 'OUTSTANDING') => {
    e.preventDefault()
    const bill = parseFloat(formData.billAmount) || 0
    const hospPct = parseFloat(formData.hospitalSharePct) || 0
    const medPct = parseFloat(formData.mediendSharePct) || 0
    const hospAmount = bill > 0 && hospPct > 0 ? (bill * hospPct) / 100 : parseFloat(formData.hospitalShareAmount) || 0
    const medAmount = bill > 0 && medPct > 0 ? (bill * medPct) / 100 : parseFloat(formData.mediendShareAmount) || 0

    const referral = parseFloat(formData.referralAmount) || 0
    const cab = parseFloat(formData.cabCharges) || 0
    const dc = computedDcTotal || parseFloat(formData.dcCharges) || 0
    const doctor = parseFloat(formData.doctorCharges) || 0
    const implant = parseFloat(formData.implantCost) || 0
    const instruments = parseFloat(formData.instrumentsCost) || 0
    const actualImplant = parseFloat(formData.actualImplantCost) || 0
    const actualInstruments = parseFloat(formData.actualInstrumentCost) || 0

    let costs = referral + cab + dc + doctor
    if (formData.implantPaidBy !== 'HOSPITAL') costs += actualImplant
    if (formData.instrumentsPaidBy !== 'HOSPITAL') costs += actualInstruments

    const netProfit = medAmount - costs
    const mediendNet = parseFloat(formData.mediendNetProfit) || netProfit
    const mediendProfit = mediendNet - (0.1 * medAmount)

    const payload: Record<string, unknown> = {
      month: formData.month ? new Date(`${formData.month}-01`).toISOString() : undefined,
      admissionDate: formData.admissionDate ? new Date(formData.admissionDate).toISOString() : undefined,
      surgeryDate: formData.surgeryDate ? new Date(formData.surgeryDate).toISOString() : undefined,
      managerName: formData.managerName || undefined,
      bdmName: formData.bdmName || undefined,
      paymentType: formData.paymentType || undefined,
      status: formData.status || undefined,
      paymentCollectedAt: formData.paymentCollectedAt || undefined,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      billAmount: parseFloat(formData.billAmount) || 0,
      cashPaidByPatient: 0,
      cashOrDedPaid: parseFloat(formData.cashOrDedPaid) || 0,
      deductionAmount: parseFloat(formData.deductionAmount) || 0,
      waivedOffAmount: computedWaivedOff,
      referralAmount: referral,
      cabCharges: cab,
      dcCharges: dc,
      doctorCharges: doctor,
      implantCost: implant,
      instrumentsCost: instruments,
      actualImplantCost: actualImplant,
      actualInstrumentCost: actualInstruments,
      implantPaidBy: formData.implantPaidBy ? formData.implantPaidBy : null,
      instrumentsPaidBy: formData.instrumentsPaidBy ? formData.instrumentsPaidBy : null,
      hospitalSharePct: parseFloat(formData.hospitalSharePct) || undefined,
      hospitalShareAmount: hospAmount,
      mediendSharePct: parseFloat(formData.mediendSharePct) || undefined,
      mediendShareAmount: medAmount,
      mediendNetProfit: mediendNet,
      finalProfit: mediendNet,
      mediendProfit,
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
      outstandingStatus: status,
      dcChecked: Object.fromEntries(Object.entries(dcChecked).filter(([, v]) => v)),
    }
    updateMutation.mutate(payload)
  }

  const bdNotes = record?.admissionRecord?.notes || ''
  const bdIpdStatusNotes = record?.admissionRecord?.ipdStatusNotes || ''
  const bdImplantConsumables = record?.admissionRecord?.implantConsumables || ''
  const bdInstrument = record?.admissionRecord?.instrument || ''
  const leadRemarks = (record?.remarks as string) || ''
  const hasBdNotes = bdNotes || bdIpdStatusNotes || bdImplantConsumables || bdInstrument || leadRemarks

  if (loadingLead || !record) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-indigo-50/40 p-6 flex items-center justify-center dark:from-slate-950 dark:via-teal-950/20 dark:to-indigo-950/25">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/35 to-indigo-50/40 p-6 dark:from-slate-950 dark:via-teal-950/20 dark:to-indigo-950/25">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-teal-800 hover:bg-teal-100 dark:text-teal-200 dark:hover:bg-teal-950/40"
            >
              <Link href="/pl/dashboard" aria-label="Back to P/L ledger">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <nav className="text-sm text-muted-foreground">
                <Link href="/pl/dashboard" className="font-medium text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100">
                  P/L Ledger
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">Edit P/L — {record.leadRef ?? record.id}</span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5 bg-gradient-to-r from-teal-800 to-indigo-800 bg-clip-text text-transparent dark:from-teal-200 dark:to-indigo-200">
                Edit P/L record
              </h1>
            </div>
            <Badge
              variant={
                (record.plRecord?.outstandingStatus as string) === 'OUTSTANDING'
                  ? 'default'
                  : (record.plRecord?.outstandingStatus as string) === 'DRAFT'
                    ? 'secondary'
                    : 'outline'
              }
              className="text-xs capitalize"
            >
              {(record.plRecord?.outstandingStatus as string) || 'NEW'}
            </Badge>
          </div>

          {hasBdNotes && (
            <Card className="overflow-hidden border-amber-200/50 shadow-md dark:border-amber-800/40">
              <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/10 pb-2">
                <CardTitle className="text-sm text-amber-950 dark:text-amber-100">BD Notes for PL Head</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 text-sm space-y-3">
                {bdNotes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Additional Notes</p>
                    <p className="whitespace-pre-wrap">{bdNotes}</p>
                  </div>
                )}
                {bdIpdStatusNotes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">IPD Status Notes</p>
                    <p className="whitespace-pre-wrap">{bdIpdStatusNotes}</p>
                  </div>
                )}
                {bdImplantConsumables && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Implants / Consumables</p>
                    <p className="whitespace-pre-wrap">{bdImplantConsumables}</p>
                  </div>
                )}
                {bdInstrument && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Instruments</p>
                    <p className="whitespace-pre-wrap">{bdInstrument}</p>
                  </div>
                )}
                {leadRemarks && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lead Remarks</p>
                    <p className="whitespace-pre-wrap">{leadRemarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
              <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Lead ref</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-medium">{record.leadRef ?? '—'}</span>
                    {record.leadRef && <CopyLeadRefButton leadRef={String(record.leadRef)} />}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lead source</Label>
                  <p className="font-medium mt-1">{record.source ?? '—'}</p>
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
                <Label className="text-xs text-muted-foreground">Admission</Label>
                <p className="font-medium">
                  {record.admissionRecord?.admissionDate
                    ? new Date(record.admissionRecord.admissionDate).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Surgery date</Label>
                <p className="font-medium">
                  {(function () {
                    const sDate =
                      record.surgeryDate ||
                      record.admissionRecord?.surgeryDate ||
                      (record.dischargeSheet as Record<string, unknown> | null)?.surgeryDate
                    return sDate
                      ? new Date(sDate as string).toLocaleDateString()
                      : '—'
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
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
                  <Label>Payment collected at</Label>
                  <Select value={formData.paymentCollectedAt || 'unset'} onValueChange={(v) => update('paymentCollectedAt', v === 'unset' ? '' : v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">—</SelectItem>
                      <SelectItem value="Mediend">Mediend</SelectItem>
                      <SelectItem value="Hospital">Hospital</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Input type="number" step="0.01" readOnly value={computedWaivedOff.toFixed(2)} className="mt-1 bg-muted/40" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bill Breakup (from discharge sheet)</CardTitle>
                <CardDescription>Tick fields to sum them into D&amp;C charges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {DC_FIELD_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-3 py-1">
                    <Checkbox
                      id={`dc-${key}`}
                      checked={dcChecked[key]}
                      onCheckedChange={(checked) =>
                        setDcChecked((prev) => ({ ...prev, [key]: checked === true }))
                      }
                    />
                    <Label htmlFor={`dc-${key}`} className="flex-1 cursor-pointer">
                      {DC_LABELS[key]}
                    </Label>
                    <span className="text-sm font-medium w-32 text-right">
                      {dsBillAmounts[key] > 0 ? inr(dsBillAmounts[key]) : '—'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3 mt-2">
                  <span className="text-sm font-semibold">D&amp;C Total (sum of ticked fields)</span>
                  <span className="text-base font-bold">{inr(computedDcTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deductions &amp; Settlement</CardTitle>
                <CardDescription>Autofilled from discharge sheet</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Copay Amount</Label>
                  <Input type="number" step="0.01" value={formData.copayAmount} onChange={(e) => update('copayAmount', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Other Deductions</Label>
                  <Input type="number" step="0.01" value={formData.otherDeduction} onChange={(e) => update('otherDeduction', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Total Deductions</Label>
                  <Input type="number" step="0.01" value={formData.deductionAmount} onChange={(e) => update('deductionAmount', e.target.value)} className="mt-1 bg-muted/40" />
                </div>
                <div>
                  <Label>Collected by Hospital</Label>
                  <Input type="number" step="0.01" value={formData.collectedByHospital} onChange={(e) => update('collectedByHospital', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Collected by Mediend</Label>
                  <Input type="number" step="0.01" value={formData.collectedByMediend} onChange={(e) => update('collectedByMediend', e.target.value)} className="mt-1" />
                </div>
                <div className="flex items-center pt-4">
                  <span className="text-sm font-medium">Deductions Paid Total: {inr(computedDedPaidTotal)}</span>
                </div>
                <div>
                  <Label>Waived Off</Label>
                  <Input type="number" step="0.01" value={computedWaivedOff.toFixed(2)} readOnly className="mt-1 bg-muted/40" />
                </div>
                <div>
                  <Label>Hospital Discount</Label>
                  <Input type="number" step="0.01" value={formData.discountAmount} onChange={(e) => update('discountAmount', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Exxis Tariff Deduction</Label>
                  <Input type="number" step="0.01" value={formData.axisTariffDeduction} onChange={(e) => update('axisTariffDeduction', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Exxis Tariff Paid</Label>
                  <Input type="number" step="0.01" value={formData.axisTariffDeductionPaid} onChange={(e) => update('axisTariffDeductionPaid', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Final Approved Amount</Label>
                  <Input type="number" step="0.01" value={formData.finalApprovedAmount} onChange={(e) => update('finalApprovedAmount', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Actual Final Amount</Label>
                  <Input type="number" step="0.01" value={formData.actualFinalAmount} onChange={(e) => update('actualFinalAmount', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Net Settlement</Label>
                  <Input type="number" step="0.01" value={formData.netSettlementAmount} onChange={(e) => update('netSettlementAmount', e.target.value)} className="mt-1" />
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
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input type="number" step="0.01" value={formData[key as keyof typeof formData]} onChange={(e) => update(key, e.target.value)} className="mt-1" />
                  </div>
                ))}
                <div>
                  <Label>D&amp;C charges</Label>
                  <Input type="number" step="0.01" value={computedDcTotal.toFixed(2)} readOnly className="mt-1 bg-muted/40" />
                  <p className="text-[11px] text-muted-foreground mt-1">Auto: sum of ticked bill breakup fields</p>
                </div>
                <div>
                  <Label>Doctor charges</Label>
                  <Input type="number" step="0.01" value={formData.doctorCharges} onChange={(e) => update('doctorCharges', e.target.value)} className="mt-1" />
                </div>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Implant cost (estimated)</Label>
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
                    <Label>Instrument cost (estimated)</Label>
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
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Actual implant cost</Label>
                    <Input type="number" step="0.01" value={formData.actualImplantCost} onChange={(e) => update('actualImplantCost', e.target.value)} className="mt-1" />
                    <p className="text-[11px] text-muted-foreground mt-1">Used in profit calculation (overrides estimated implant cost)</p>
                  </div>
                  <div>
                    <Label>Actual instrument cost</Label>
                    <Input type="number" step="0.01" value={formData.actualInstrumentCost} onChange={(e) => update('actualInstrumentCost', e.target.value)} className="mt-1" />
                    <p className="text-[11px] text-muted-foreground mt-1">Used in profit calculation (overrides estimated instrument cost)</p>
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
                <CardDescription>Hospital share and Mediend share</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>Hospital %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.hospitalSharePct}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData((prev) => {
                        const num = parseFloat(val)
                        return {
                          ...prev,
                          hospitalSharePct: val,
                          mediendSharePct: val === '' ? '' : (!isNaN(num) ? String(Math.round((100 - num) * 100) / 100) : prev.mediendSharePct),
                        }
                      })
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Hospital Amount</Label>
                  <Input type="number" step="0.01" value={formData.hospitalShareAmount} onChange={(e) => update('hospitalShareAmount', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Mediend %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.mediendSharePct}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData((prev) => {
                        const num = parseFloat(val)
                        return {
                          ...prev,
                          mediendSharePct: val,
                          hospitalSharePct: val === '' ? '' : (!isNaN(num) ? String(Math.round((100 - num) * 100) / 100) : prev.hospitalSharePct),
                        }
                      })
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Mediend Amount</Label>
                  <Input type="number" step="0.01" value={formData.mediendShareAmount} onChange={(e) => update('mediendShareAmount', e.target.value)} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Mediend net profit</Label>
                  <Input type="number" step="0.01" value={formData.mediendNetProfit} onChange={(e) => update('mediendNetProfit', e.target.value)} className="mt-1 font-medium" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    = Mediend Share − (Referral + Cab + D&amp;C + Doctor Charges + Actual Implant* + Actual Instruments*). If actual is 0, then 0 is subtracted.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label>Mediend profit (after 10% deduction)</Label>
                  <Input type="number" step="0.01" value={formData.mediendProfit} onChange={(e) => update('mediendProfit', e.target.value)} className="mt-1 font-medium" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    = Mediend Net Profit − (10% × Mediend Share Amount)
                  </p>
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

            <div className="flex gap-3">
              <Button type="button" disabled={updateMutation.isPending} onClick={(e) => handleSubmit(e, 'DRAFT')}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Draft
              </Button>
              <Button
                type="button"
                disabled={updateMutation.isPending}
                onClick={(e) => handleSubmit(e, 'OUTSTANDING')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save & Move to Outstanding
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/pl/dashboard">Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
