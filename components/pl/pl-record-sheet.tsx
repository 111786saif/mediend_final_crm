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
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useMemo } from 'react'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resolveLeadHospitalDoctor } from '@/lib/lead-display'

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
  dischargeSheet?: ({
    id: string
  } & Record<string, unknown>) | null
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

interface PlRecordSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
}

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

export function PlRecordSheet({ open, onOpenChange, leadId }: PlRecordSheetProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: record, isLoading: loadingLead } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId && open,
  })

  const [formData, setFormData] = useState({
    month: '',
    admissionDate: '',
    surgeryDate: '',
    managerName: '',
    bdmName: '',
    paymentType: '',
    cashCollectedBy: '',
    status: '',
    paymentCollectedAt: '',
    totalAmount: '',
    billAmount: '',
    deductionAmount: '',
    cashOrDedPaid: '',
    waivedOffAmount: '',
    referralAmount: '',
    cabCharges: '',
    dcCharges: '',
    doctorCharges: '',
    implantCost: '',
    instrumentsCost: '',
    implantPaidBy: '' as PaidBy,
    instrumentsPaidBy: '' as PaidBy,
    actualImplantCost: '',
    actualInstrumentCost: '',
    hospitalRecoverAmount: '',
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
    // Deductions & Settlement from discharge sheet
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
    if (!record || !open || initialized.current) return
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
          : (ds?.collectedByHospital != null || ds?.collectedByMediend != null)
            ? String(Number(ds?.collectedByHospital ?? 0) + Number(ds?.collectedByMediend ?? 0))
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
          managerName:
            (record.bd as any)?.role === 'TEAM_LEAD'
              ? (record.bd?.name || '')
              : ((pl?.managerName as string) || (ds?.managerName as string) || (record.bd as any)?.employee?.team?.teamLead?.user?.name || (record.bd as any)?.employee?.team?.department?.head?.name || ''),
          bdmName: (pl?.bdmName as string) || record.bd?.name || '',
          paymentType: (pl?.paymentType as string) || (ds?.paymentType as string) || (record.flowType as string) || '',
          cashCollectedBy: (pl?.cashCollectedBy as string) || (ds?.cashCollectedBy as string) || '',
          status: (pl?.status as string) || (ds?.status as string) || (record.caseStage as string) || '',
          paymentCollectedAt: (pl?.paymentCollectedAt as string) ||
            (() => {
              const hosp = numVal(ds?.collectedByHospital)
              const med = numVal(ds?.collectedByMediend)
              if (hosp > med) return 'Hospital'
              if (med > hosp) return 'Mediend'
              return ''
            })(),
          totalAmount: pl?.totalAmount != null ? String(pl.totalAmount) : (ds?.finalApprovedAmount != null ? String(ds.finalApprovedAmount) : (record.settledTotal != null ? String(record.settledTotal) : (record.billAmount != null ? String(record.billAmount) : ''))),
          billAmount: pl?.billAmount != null ? String(pl.billAmount) : (record.billAmount != null ? String(record.billAmount) : ''),
          deductionAmount: dedTotal,
          cashOrDedPaid: dedPatient,
          waivedOffAmount: Math.max(numVal(pl?.waivedOffAmount ?? ds?.waivedOffAmount), 0).toString(),
          referralAmount: pl?.referralAmount != null ? String(pl.referralAmount) : '',
          cabCharges: pl?.cabCharges != null ? String(pl.cabCharges) : '',
          dcCharges: pl?.dcCharges != null ? String(pl.dcCharges) : '',
          doctorCharges: pl?.doctorCharges != null ? String(pl.doctorCharges) : '',
          implantCost: pl?.implantCost != null ? String(pl.implantCost) : (ds?.implantCost != null ? String(ds.implantCost) : (ds?.implantsAmount != null ? String(ds.implantsAmount) : '')),
          instrumentsCost: pl?.instrumentsCost != null ? String(pl.instrumentsCost) : (ds?.instrumentsCost != null ? String(ds.instrumentsCost) : (ds?.instrumentsAmount != null ? String(ds.instrumentsAmount) : '')),
          actualImplantCost: pl?.actualImplantCost != null ? String(pl.actualImplantCost) : (pl?.implantCost != null ? String(pl.implantCost) : (ds?.implantCost != null ? String(ds.implantCost) : (ds?.implantsAmount != null ? String(ds.implantsAmount) : ''))),
          actualInstrumentCost: pl?.actualInstrumentCost != null ? String(pl.actualInstrumentCost) : (pl?.instrumentsCost != null ? String(pl.instrumentsCost) : (ds?.instrumentsCost != null ? String(ds.instrumentsCost) : (ds?.instrumentsAmount != null ? String(ds.instrumentsAmount) : ''))),
          hospitalRecoverAmount: pl?.hospitalRecoverAmount != null ? String(pl.hospitalRecoverAmount) : '',
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
          mediendProfit: pl?.mediendProfit != null ? String(pl.mediendProfit) : '',
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
          // Deductions & Settlement
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
  }, [record, open])

  useEffect(() => {
    if (!open) {
      initialized.current = false
    }
  }, [open])

  const computedDcTotal = useMemo(() => {
    return DC_FIELD_KEYS.reduce((sum, key) => {
      if (dcChecked[key]) return sum + (dsBillAmounts[key] || 0)
      return sum
    }, 0)
  }, [dcChecked, dsBillAmounts])

  const [hasManualOverrides, setHasManualOverrides] = useState({
    hospitalAmount: false,
    mediendAmount: false,
    mediendNetProfit: false,
    mediendProfit: false,
  })

  useEffect(() => {
    setHasManualOverrides({
      hospitalAmount: false,
      mediendAmount: false,
      mediendNetProfit: false,
      mediendProfit: false,
    })
  }, [leadId, open])

  const computedHospitalShare = useMemo(() => {
    const actualFinal = parseFloat(formData.actualFinalAmount) || 0
    const dc = computedDcTotal
    const implant = parseFloat(formData.implantCost) || 0
    const instruments = parseFloat(formData.instrumentsCost) || 0
    const hospPct = parseFloat(formData.hospitalSharePct) || 0
    const medPct = parseFloat(formData.mediendSharePct) || 0

    if (hospPct === 0 && medPct === 0) return null

    const base = actualFinal - dc - implant - instruments

    const hospitalShare = (base * hospPct) / 100 +
      (formData.implantPaidBy === 'HOSPITAL' ? implant : 0) +
      (formData.instrumentsPaidBy === 'HOSPITAL' ? instruments : 0)

    const mediendShare = (base * medPct) / 100 +
      (formData.implantPaidBy !== 'HOSPITAL' ? implant : 0) +
      (formData.instrumentsPaidBy !== 'HOSPITAL' ? instruments : 0)

    return { base, hospitalShare, mediendShare, hospPct, medPct }
  }, [
    formData.actualFinalAmount,
    formData.hospitalSharePct,
    formData.mediendSharePct,
    formData.implantCost,
    formData.instrumentsCost,
    formData.implantPaidBy,
    formData.instrumentsPaidBy,
    computedDcTotal,
  ])

  const computedMediendNetProfit = useMemo(() => {
    if (!computedHospitalShare) return null
    const { mediendShare } = computedHospitalShare
    const doctor = parseFloat(formData.doctorCharges) || 0
    const actualImplant = parseFloat(formData.actualImplantCost) || 0
    const actualInstruments = parseFloat(formData.actualInstrumentCost) || 0
    const referral = parseFloat(formData.referralAmount) || 0
    const cab = parseFloat(formData.cabCharges) || 0
    const hospitalRecover = parseFloat(formData.hospitalRecoverAmount) || 0

    let costs = doctor + referral + cab
    if (formData.implantPaidBy !== 'HOSPITAL') costs += actualImplant
    if (formData.instrumentsPaidBy !== 'HOSPITAL') costs += actualInstruments

    return mediendShare - costs - hospitalRecover
  }, [computedHospitalShare, formData])

  const computedMediendProfit = useMemo(() => {
    if (!computedHospitalShare || computedMediendNetProfit === null) return null
    const netProfit = hasManualOverrides.mediendNetProfit
      ? parseFloat(formData.mediendNetProfit) || computedMediendNetProfit
      : computedMediendNetProfit
    return netProfit - (0.1 * computedHospitalShare.mediendShare)
  }, [computedHospitalShare, computedMediendNetProfit, hasManualOverrides, formData.mediendNetProfit])

  const hospShareAmtDisplay = useMemo(() => {
    if (hasManualOverrides.hospitalAmount) return formData.hospitalShareAmount
    if (computedHospitalShare) return computedHospitalShare.hospitalShare.toFixed(2)
    return formData.hospitalShareAmount
  }, [computedHospitalShare, hasManualOverrides.hospitalAmount, formData.hospitalShareAmount])

  const medShareAmtDisplay = useMemo(() => {
    if (hasManualOverrides.mediendAmount) return formData.mediendShareAmount
    if (computedHospitalShare) return computedHospitalShare.mediendShare.toFixed(2)
    return formData.mediendShareAmount
  }, [computedHospitalShare, hasManualOverrides.mediendAmount, formData.mediendShareAmount])

  const netProfitDisplay = useMemo(() => {
    if (hasManualOverrides.mediendNetProfit) return formData.mediendNetProfit
    if (computedMediendNetProfit !== null) return computedMediendNetProfit.toFixed(2)
    return formData.mediendNetProfit
  }, [computedMediendNetProfit, hasManualOverrides.mediendNetProfit, formData.mediendNetProfit])

  const medProfitDisplay = useMemo(() => {
    if (hasManualOverrides.mediendProfit) return formData.mediendProfit
    if (computedMediendProfit !== null) return computedMediendProfit.toFixed(2)
    return formData.mediendProfit
  }, [computedMediendProfit, hasManualOverrides.mediendProfit, formData.mediendProfit])

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
      onOpenChange(false)
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
    const actualFinal = parseFloat(formData.actualFinalAmount) || 0
    const hospPct = parseFloat(formData.hospitalSharePct) || 0
    const medPct = parseFloat(formData.mediendSharePct) || 0
    const dc = computedDcTotal || parseFloat(formData.dcCharges) || 0
    const doctor = parseFloat(formData.doctorCharges) || 0
    const implant = parseFloat(formData.implantCost) || 0
    const instruments = parseFloat(formData.instrumentsCost) || 0
    const actualImplant = parseFloat(formData.actualImplantCost) || 0
    const actualInstruments = parseFloat(formData.actualInstrumentCost) || 0
    const hospitalRecover = parseFloat(formData.hospitalRecoverAmount) || 0
    const referral = parseFloat(formData.referralAmount) || 0
    const cab = parseFloat(formData.cabCharges) || 0

    const base = actualFinal - dc - implant - instruments

    const hospAmount =
      (hospPct > 0 ? (base * hospPct) / 100 : parseFloat(formData.hospitalShareAmount) || 0) +
      (formData.implantPaidBy === 'HOSPITAL' ? implant : 0) +
      (formData.instrumentsPaidBy === 'HOSPITAL' ? instruments : 0)

    const medAmount =
      (medPct > 0 ? (base * medPct) / 100 : parseFloat(formData.mediendShareAmount) || 0) +
      (formData.implantPaidBy !== 'HOSPITAL' ? implant : 0) +
      (formData.instrumentsPaidBy !== 'HOSPITAL' ? instruments : 0)

    let costs = doctor + referral + cab
    if (formData.implantPaidBy !== 'HOSPITAL') costs += actualImplant
    if (formData.instrumentsPaidBy !== 'HOSPITAL') costs += actualInstruments

    const computedNetProfit = medAmount - costs - hospitalRecover
    const mediendNet = parseFloat(formData.mediendNetProfit) || computedNetProfit
    const computedMediendProfit = mediendNet - (0.1 * medAmount)
    const mediendProfit = parseFloat(formData.mediendProfit) || computedMediendProfit

    const payload: Record<string, unknown> = {
      month: formData.month ? new Date(`${formData.month}-01`).toISOString() : undefined,
      admissionDate: formData.admissionDate ? new Date(formData.admissionDate).toISOString() : undefined,
      surgeryDate: formData.surgeryDate ? new Date(formData.surgeryDate).toISOString() : undefined,
      managerName: formData.managerName || undefined,
      bdmName: formData.bdmName || undefined,
      paymentType: formData.paymentType || undefined,
      status: formData.status || undefined,
      paymentCollectedAt: formData.paymentCollectedAt || undefined,
      cashCollectedBy: formData.cashCollectedBy || undefined,
      totalAmount: parseFloat(formData.totalAmount) || 0,
      billAmount: parseFloat(formData.billAmount) || 0,
      cashPaidByPatient: 0,
      cashOrDedPaid: parseFloat(formData.cashOrDedPaid) || 0,
      deductionAmount: parseFloat(formData.deductionAmount) || 0,
      collectedByHospital: parseFloat(formData.collectedByHospital) || 0,
      collectedByMediend: parseFloat(formData.collectedByMediend) || 0,
      waivedOffAmount: computedWaivedOff,
      referralAmount: referral,
      cabCharges: cab,
      dcCharges: dc,
      doctorCharges: doctor,
      implantCost: implant,
      instrumentsCost: instruments,
      implantPaidBy: formData.implantPaidBy ? formData.implantPaidBy : null,
      instrumentsPaidBy: formData.instrumentsPaidBy ? formData.instrumentsPaidBy : null,
      actualImplantCost: actualImplant,
      actualInstrumentCost: actualInstruments,
      hospitalRecoverAmount: hospitalRecover,
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
      actualFinalAmount: actualFinal,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[65vw] sm:max-w-[65vw] p-0 gap-0 flex flex-col">
        {loadingLead || !record ? (
          <div className="flex items-center justify-center h-full">
            <SheetTitle className="sr-only">Loading Record</SheetTitle>
            <SheetDescription className="sr-only">Please wait while the record is loading</SheetDescription>
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-xl font-bold bg-gradient-to-r from-teal-800 to-indigo-800 bg-clip-text text-transparent dark:from-teal-200 dark:to-indigo-200">
                    Edit P/L Record — {record.leadRef ?? record.id}
                  </SheetTitle>
                  <SheetDescription>Profit &amp; loss entry details</SheetDescription>
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
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-6">
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
                    <CardDescription>Patient and case details (from leasd)</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-teal-200 dark:border-teal-700"
                    onClick={() => {
                      onOpenChange(false)
                      setTimeout(() => router.push(`/patient/${leadId}`), 100)
                    }}
                  >
                    View patient
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
                    <p className="font-medium">{resolveLeadHospitalDoctor(record as unknown as Record<string, unknown>).hospital ?? '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Doctor</Label>
                    <p className="font-medium">{resolveLeadHospitalDoctor(record as unknown as Record<string, unknown>).doctor ?? '—'}</p>
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
                  <div>
                    <Label className="text-xs text-muted-foreground">Discharge date</Label>
                    <p className="font-medium">
                      {(record.dischargeSheet as Record<string, unknown> | null)?.dischargeDate
                        ? new Date((record.dischargeSheet as Record<string, unknown>).dischargeDate as string).toLocaleDateString()
                        : '—'}
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
                    <div>
                      <Label>Cash collected by</Label>
                      <Input value={formData.cashCollectedBy} onChange={(e) => update('cashCollectedBy', e.target.value)} placeholder="e.g. BD Name" className="mt-1" />
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
                    <CardTitle>Amounts</CardTitle>
                    <CardDescription>Total bill = hospital bill; approved amount = negotiated / case total</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label>Total bill</Label>
                      <Input type="number" step="0.01" value={formData.billAmount} onChange={(e) => update('billAmount', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Actual final amount</Label>
                      <Input type="number" step="0.01" value={formData.actualFinalAmount} onChange={(e) => update('actualFinalAmount', e.target.value)} className="mt-1" />
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
                        value={computedWaivedOff.toFixed(2)}
                        className="mt-1 bg-muted/40"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue split</CardTitle>
                    <CardDescription>Hospital share, Mediend share, costs &amp; net profit</CardDescription>
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
                            const nextHospPct = val
                            const nextMedPct = val === '' ? '' : (!isNaN(num) ? String(Math.round((100 - num) * 100) / 100) : prev.mediendSharePct)

                            const actualFinal = parseFloat(prev.actualFinalAmount) || 0
                            const dc = computedDcTotal
                            const implant = parseFloat(prev.implantCost) || 0
                            const instruments = parseFloat(prev.instrumentsCost) || 0
                            const base = actualFinal - dc - implant - instruments
                            const medPctNum = parseFloat(nextMedPct) || 0
                            const mediendShare = (base * medPctNum) / 100 +
                              (prev.implantPaidBy !== 'HOSPITAL' ? implant : 0) +
                              (prev.instrumentsPaidBy !== 'HOSPITAL' ? instruments : 0)

                            const shareStr = !isNaN(mediendShare) && base > 0 ? mediendShare.toFixed(2) : ''

                            return {
                              ...prev,
                              hospitalSharePct: nextHospPct,
                              mediendSharePct: nextMedPct,
                              hospitalAmountPending: shareStr || prev.hospitalAmountPending,
                            }
                          })
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Hospital Amount {computedHospitalShare && !hasManualOverrides.hospitalAmount && <span className="text-[11px] text-muted-foreground">(auto)</span>}</Label>
                      <Input type="number" step="0.01" value={hospShareAmtDisplay} onChange={(e) => { setFormData(prev => ({ ...prev, hospitalShareAmount: e.target.value })); setHasManualOverrides(p => ({ ...p, hospitalAmount: true })) }} className="mt-1" />
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
                            const nextMedPct = val
                            const nextHospPct = val === '' ? '' : (!isNaN(num) ? String(Math.round((100 - num) * 100) / 100) : prev.hospitalSharePct)

                            const actualFinal = parseFloat(prev.actualFinalAmount) || 0
                            const dc = computedDcTotal
                            const implant = parseFloat(prev.implantCost) || 0
                            const instruments = parseFloat(prev.instrumentsCost) || 0
                            const base = actualFinal - dc - implant - instruments
                            const medPctNum = parseFloat(nextMedPct) || 0
                            const mediendShare = (base * medPctNum) / 100 +
                              (prev.implantPaidBy !== 'HOSPITAL' ? implant : 0) +
                              (prev.instrumentsPaidBy !== 'HOSPITAL' ? instruments : 0)

                            const shareStr = !isNaN(mediendShare) && base > 0 ? mediendShare.toFixed(2) : ''

                            return {
                              ...prev,
                              mediendSharePct: nextMedPct,
                              hospitalSharePct: nextHospPct,
                              hospitalAmountPending: shareStr || prev.hospitalAmountPending,
                            }
                          })
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Mediend Amount {computedHospitalShare && !hasManualOverrides.mediendAmount && <span className="text-[11px] text-muted-foreground">(auto)</span>}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={medShareAmtDisplay}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData(prev => ({
                            ...prev,
                            mediendShareAmount: val,
                            hospitalAmountPending: val,
                          }))
                          setHasManualOverrides(p => ({ ...p, mediendAmount: true }))
                        }}
                        className="mt-1"
                      />
                    </div>
                  </CardContent>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-0 border-t mt-2 mx-6 px-0">
                    <div className="sm:col-span-2 text-sm font-semibold text-muted-foreground pt-3">Costs</div>
                    <div>
                      <Label>D&amp;C charges</Label>
                      <Input type="number" step="0.01" value={computedDcTotal.toFixed(2)} readOnly className="mt-1 bg-muted/40" />
                      <p className="text-[11px] text-muted-foreground mt-1">Auto: sum of ticked breakup fields</p>
                    </div>
                    <div>
                      <Label>Doctor charges</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.doctorCharges}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData((prev) => ({
                            ...prev,
                            doctorCharges: val,
                            doctorAmountPending: val,
                          }))
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Referral amount</Label>
                      <Input type="number" step="0.01" value={formData.referralAmount} onChange={(e) => update('referralAmount', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Cab charges</Label>
                      <Input type="number" step="0.01" value={formData.cabCharges} onChange={(e) => update('cabCharges', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Implant cost</Label>
                      <Input type="number" step="0.01" value={formData.implantCost} onChange={(e) => update('implantCost', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Implant paid by</Label>
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
                    <div>
                      <Label>Instrument cost</Label>
                      <Input type="number" step="0.01" value={formData.instrumentsCost} onChange={(e) => update('instrumentsCost', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Instrument paid by</Label>
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
                    <div>
                      <Label>Actual implant cost</Label>
                      <Input type="number" step="0.01" value={formData.actualImplantCost} onChange={(e) => update('actualImplantCost', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Actual instrument cost</Label>
                      <Input type="number" step="0.01" value={formData.actualInstrumentCost} onChange={(e) => update('actualInstrumentCost', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Hospital recover amount</Label>
                      <Input type="number" step="0.01" value={formData.hospitalRecoverAmount} onChange={(e) => update('hospitalRecoverAmount', e.target.value)} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Mediend net profit {computedMediendNetProfit !== null && !hasManualOverrides.mediendNetProfit && <span className="text-[11px] text-muted-foreground">(auto)</span>}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={netProfitDisplay}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, mediendNetProfit: e.target.value }))
                          setHasManualOverrides((p) => ({ ...p, mediendNetProfit: true }))
                        }}
                        className="mt-1 font-medium"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">= Mediend Share − (Doctor + Cab + Referral + Actual Implant/Instruments + Hospital Recovery). If actual is 0, then 0 is subtracted.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Mediend profit {computedMediendProfit !== null && !hasManualOverrides.mediendProfit && <span className="text-[11px] text-muted-foreground">(auto)</span>}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={medProfitDisplay}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, mediendProfit: e.target.value }))
                          setHasManualOverrides((p) => ({ ...p, mediendProfit: true }))
                        }}
                        className="mt-1 font-medium"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">= Mediend Net Profit − (10% × Mediend Share)</p>
                    </div>
                  </CardContent>
                  <CardContent className="pt-0 mx-6 px-0 border-0">
                    <div className="sm:col-span-2">
                      <Label>Doctor remarks</Label>
                      <Textarea value={formData.doctorRemarks} onChange={(e) => update('doctorRemarks', e.target.value)} placeholder="Notes about the doctor / doctor charges for this case" className="mt-1 resize-none" rows={2} />
                    </div>
                    <div className="sm:col-span-2 mt-3">
                      <Label>Cost breakdown remarks</Label>
                      <Textarea value={formData.costBreakdownRemarks} onChange={(e) => update('costBreakdownRemarks', e.target.value)} placeholder="Notes about implants / instruments / D&C / referral / cab costs" className="mt-1 resize-none" rows={2} />
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
                  <Button type="button" disabled={updateMutation.isPending} onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'DRAFT')}>
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={updateMutation.isPending}
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent, 'OUTSTANDING')}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save & Move to Outstanding
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
