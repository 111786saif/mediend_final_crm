'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Save, RotateCcw, User, FileText, Receipt, Percent, Calculator, MessageSquare } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useFileUpload } from '@/hooks/use-file-upload'
import { DischargeFileUploadField } from '@/components/discharge/discharge-file-upload-field'

interface DischargeSheet {
  id: number
  patientName?: string | null
  admissionDate?: string | null
  surgeryDate?: string | null
  dischargeDate?: string | null
  status?: string | null
  paymentType?: string | null
  approvedOrCash?: string | null
  paymentCollectedAt?: string | null
  managerRole?: string | null
  managerName?: string | null
  bdmName?: string | null
  patientPhone?: string | null
  doctorName?: string | null
  hospitalName?: string | null
  category?: string | null
  treatment?: string | null
  circle?: string | null
  leadSource?: string | null
  totalAmount?: number | null
  billAmount?: number | null
  cashPaidByPatient?: number | null
  cashOrDedPaid?: number | null
  referralAmount?: number | null
  cabCharges?: number | null
  implantCost?: number | null
  instrumentsCost?: number | null
  dcCharges?: number | null
  doctorCharges?: number | null
  hospitalSharePct?: number | null
  hospitalShareAmount?: number | null
  mediendSharePct?: number | null
  mediendShareAmount?: number | null
  mediendNetProfit?: number | null
  remarks?: string | null
  tentativeAmount?: number | null
  copayPct?: number | null
  dischargeSummaryUrl?: string | null
  otNotesUrl?: string | null
  codesCount?: number | null
  finalBillUrl?: string | null
  finalApprovedUrl?: string | null
  deductionReceiptUrl?: string | null
  settlementLetterUrl?: string | null
  roomRentAmount?: number | null
  pharmacyAmount?: number | null
  investigationAmount?: number | null
  consumablesAmount?: number | null
  implantsAmount?: number | null
  instrumentsAmount?: number | null
  anesthesiaAmount?: number | null
  otherChargesAmount?: number | null
  totalFinalBill?: number | null
  finalApprovedAmount?: number | null
  finalAmount?: number | null
  copayAmount?: number | null
  collectedByHospital?: number | null
  collectedByMediend?: number | null
  axisTariffDeduction?: number | null
  axisTariffDeductionPaid?: number | null
  actualFinalAmount?: number | null
  deductionAmount?: number | null
  discountAmount?: number | null
  waivedOffAmount?: number | null
  settlementPart?: number | null
  tdsAmount?: number | null
  otherDeduction?: number | null
  netSettlementAmount?: number | null
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string
  value: string | number | null | undefined
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5 group">
      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider transition-colors group-focus-within:text-primary">
        {label}
      </Label>
      <Input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-xs bg-muted/20 dark:bg-muted/10 border-input hover:border-accent-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
      />
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null | undefined
  onChange?: (v: string) => void
}) {
  const dateValue = value ? new Date(value).toISOString().split('T')[0] : ''
  return (
    <div className="space-y-1.5 group">
      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider transition-colors group-focus-within:text-primary">
        {label}
      </Label>
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-9 text-xs bg-muted/20 dark:bg-muted/10 border-input hover:border-accent-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
      />
    </div>
  )
}


export default function EditDischargeSheetPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.leadId as string

  const queryClient = useQueryClient()
  const { uploadFile, uploading: isUploadingFile } = useFileUpload()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sheet, setSheet] = useState<DischargeSheet | null>(null)

  const handleReset = () => {
    if (!sheet) return
    setSheet({
      id: sheet.id,
      patientName: sheet.patientName || null,
      patientPhone: sheet.patientPhone || null,
      hospitalName: sheet.hospitalName || null,
      doctorName: sheet.doctorName || null,
      treatment: sheet.treatment || null,
      category: sheet.category || null,
      circle: sheet.circle || null,
      bdmName: sheet.bdmName || null,
      managerName: sheet.managerName || null,
      admissionDate: null,
      surgeryDate: null,
      dischargeDate: null,
      status: null,
      paymentType: null,
      approvedOrCash: null,
      paymentCollectedAt: null,
      totalAmount: null,
      billAmount: null,
      cashPaidByPatient: null,
      cashOrDedPaid: null,
      referralAmount: null,
      cabCharges: null,
      implantCost: null,
      instrumentsCost: null,
      dcCharges: null,
      doctorCharges: null,
      hospitalSharePct: null,
      hospitalShareAmount: null,
      mediendSharePct: null,
      mediendShareAmount: null,
      mediendNetProfit: null,
      remarks: null,
      tentativeAmount: null,
      copayPct: null,
      dischargeSummaryUrl: null,
      otNotesUrl: null,
      codesCount: null,
      finalBillUrl: null,
      finalApprovedUrl: null,
      deductionReceiptUrl: null,
      settlementLetterUrl: null,
      roomRentAmount: null,
      pharmacyAmount: null,
      investigationAmount: null,
      consumablesAmount: null,
      implantsAmount: null,
      instrumentsAmount: null,
      anesthesiaAmount: null,
      otherChargesAmount: null,
      totalFinalBill: null,
      finalApprovedAmount: null,
      finalAmount: null,
      copayAmount: null,
      collectedByHospital: null,
      collectedByMediend: null,
      axisTariffDeduction: null,
      axisTariffDeductionPaid: null,
      actualFinalAmount: null,
      deductionAmount: null,
      discountAmount: null,
      waivedOffAmount: null,
      settlementPart: null,
      tdsAmount: null,
      otherDeduction: null,
      netSettlementAmount: null,
    })
    toast.success('Form fields reset to empty')
  }

  const handleFileUpload = async (field: keyof DischargeSheet, file: File) => {
    const result = await uploadFile(file)
    if (result) {
      updateField(field, result.url)
    }
  }

  useEffect(() => {
    async function fetchSheet() {
      try {
        const result = await apiGet<DischargeSheet | DischargeSheet[] | null>(`/api/discharge-sheet?leadId=${leadId}`)
        const data = Array.isArray(result) ? result[0] : result
        if (data) {
          setSheet(data)
        } else {
          toast.error('Discharge sheet not found')
          router.push(`/patient/${leadId}`)
        }
      } catch {
        toast.error('Failed to load discharge sheet')
        router.push(`/patient/${leadId}`)
      } finally {
        setLoading(false)
      }
    }
    fetchSheet()
  }, [leadId, router])

  const updateField = <K extends keyof DischargeSheet>(key: K, value: DischargeSheet[K] | null) => {
    setSheet((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const stripNulls = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = value
      }
    }
    return result
  }

  const handleSave = async () => {
    if (!sheet?.id) return

    setSaving(true)
    try {
      await apiPatch(`/api/discharge-sheet/${sheet.id}`, stripNulls(sheet as unknown as Record<string, unknown>))
      await queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      await queryClient.invalidateQueries({ queryKey: ['lead-discharge-info', leadId] })
      toast.success('Discharge sheet updated')
      const isCash = sheet.paymentType === 'CASH' || sheet.approvedOrCash === 'CASH'
      router.push(`/patient/${leadId}/${isCash ? 'discharge-cash' : 'discharge'}`)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sheet) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Discharge sheet not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const isCash = sheet.paymentType === 'CASH' || sheet.approvedOrCash === 'CASH'
              router.push(`/patient/${leadId}/${isCash ? 'discharge-cash' : 'discharge'}`)
            }}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="flex-1 text-lg font-semibold">Edit Discharge Sheet</h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive mr-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Fields
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <User className="h-4 w-4 text-primary shrink-0" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <InputField label="Patient Name" value={sheet.patientName} onChange={(v) => updateField('patientName', v)} />
            <InputField label="Patient Phone" value={sheet.patientPhone} onChange={(v) => updateField('patientPhone', v)} />
            <InputField label="Hospital" value={sheet.hospitalName} onChange={(v) => updateField('hospitalName', v)} />
            <InputField label="Doctor" value={sheet.doctorName} onChange={(v) => updateField('doctorName', v)} />
            <InputField label="Treatment" value={sheet.treatment} onChange={(v) => updateField('treatment', v)} />
            <InputField label="Category" value={sheet.category} onChange={(v) => updateField('category', v)} />
            <InputField label="Circle" value={sheet.circle} onChange={(v) => updateField('circle', v)} />
            <InputField label="BDM" value={sheet.bdmName} onChange={(v) => updateField('bdmName', v)} />
            <InputField label="Manager" value={sheet.managerName} onChange={(v) => updateField('managerName', v)} />
            <DateField label="Admission Date" value={sheet.admissionDate} onChange={(v) => updateField('admissionDate', v || null)} />
            <DateField label="Surgery Date" value={sheet.surgeryDate} onChange={(v) => updateField('surgeryDate', v || null)} />
            <DateField label="Discharge Date" value={sheet.dischargeDate} onChange={(v) => updateField('dischargeDate', v || null)} />
            <InputField label="Status" value={sheet.status} onChange={(v) => updateField('status', v || null)} />
            <InputField label="Payment Type" value={sheet.paymentType} onChange={(v) => updateField('paymentType', v || null)} />
            <InputField label="Approved/Cash" value={sheet.approvedOrCash} onChange={(v) => updateField('approvedOrCash', v || null)} />
            <InputField label="Payment Collected At" value={sheet.paymentCollectedAt} onChange={(v) => updateField('paymentCollectedAt', v || null)} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Receipt className="h-4 w-4 text-primary shrink-0" />
              Bill Breakup
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <InputField label="Room Rent" value={sheet.roomRentAmount} onChange={(v) => updateField('roomRentAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Pharmacy" value={sheet.pharmacyAmount} onChange={(v) => updateField('pharmacyAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Investigation" value={sheet.investigationAmount} onChange={(v) => updateField('investigationAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Consumables" value={sheet.consumablesAmount} onChange={(v) => updateField('consumablesAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Implants" value={sheet.implantsAmount} onChange={(v) => updateField('implantsAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Instruments" value={sheet.instrumentsAmount} onChange={(v) => updateField('instrumentsAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Anesthesia" value={sheet.anesthesiaAmount} onChange={(v) => updateField('anesthesiaAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Other Charges" value={sheet.otherChargesAmount} onChange={(v) => updateField('otherChargesAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Total Final Bill" value={sheet.totalFinalBill} onChange={(v) => updateField('totalFinalBill', parseFloat(v) || null)} type="number" />
            <InputField label="Final Amount" value={sheet.finalAmount} onChange={(v) => updateField('finalAmount', v ? parseFloat(v) : null)} type="number" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Percent className="h-4 w-4 text-primary shrink-0" />
              Deductions & Settlement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <InputField label="Copay %" value={sheet.copayPct} onChange={(v) => updateField('copayPct', parseFloat(v) || null)} type="number" />
            <InputField label="Copay Amount" value={sheet.copayAmount} onChange={(v) => updateField('copayAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Other Deduction" value={sheet.otherDeduction} onChange={(v) => updateField('otherDeduction', parseFloat(v) || null)} type="number" />
            <InputField label="Total Deductions" value={sheet.deductionAmount} onChange={(v) => updateField('deductionAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Collected by Hospital" value={sheet.collectedByHospital} onChange={(v) => updateField('collectedByHospital', parseFloat(v) || null)} type="number" />
            <InputField label="Collected by Mediend" value={sheet.collectedByMediend} onChange={(v) => updateField('collectedByMediend', parseFloat(v) || null)} type="number" />
            <InputField label="Exxis Tarrif Deduction" value={sheet.axisTariffDeduction} onChange={(v) => updateField('axisTariffDeduction', parseFloat(v) || null)} type="number" />
            <InputField label="Exxis Tarrif Paid" value={sheet.axisTariffDeductionPaid} onChange={(v) => updateField('axisTariffDeductionPaid', parseFloat(v) || null)} type="number" />
            <InputField label="Discount" value={sheet.discountAmount} onChange={(v) => updateField('discountAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Waived Off" value={sheet.waivedOffAmount} onChange={(v) => updateField('waivedOffAmount', parseFloat(v) || null)} type="number" />
            <InputField label="TDS" value={sheet.tdsAmount} onChange={(v) => updateField('tdsAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Settlement Part" value={sheet.settlementPart} onChange={(v) => updateField('settlementPart', parseFloat(v) || null)} type="number" />
            <InputField label="Final Approved" value={sheet.finalApprovedAmount} onChange={(v) => updateField('finalApprovedAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Actual Final" value={sheet.actualFinalAmount} onChange={(v) => updateField('actualFinalAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Net Settlement" value={sheet.netSettlementAmount} onChange={(v) => updateField('netSettlementAmount', parseFloat(v) || null)} type="number" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Calculator className="h-4 w-4 text-primary shrink-0" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <InputField label="Total Amount" value={sheet.totalAmount} onChange={(v) => updateField('totalAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Bill Amount" value={sheet.billAmount} onChange={(v) => updateField('billAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Cash Paid by Patient" value={sheet.cashPaidByPatient} onChange={(v) => updateField('cashPaidByPatient', parseFloat(v) || null)} type="number" />
            <InputField label="Cash/Ded Paid" value={sheet.cashOrDedPaid} onChange={(v) => updateField('cashOrDedPaid', parseFloat(v) || null)} type="number" />
            <InputField label="Hospital Share %" value={sheet.hospitalSharePct} onChange={(v) => updateField('hospitalSharePct', parseFloat(v) || null)} type="number" />
            <InputField label="Hospital Share Amt" value={sheet.hospitalShareAmount} onChange={(v) => updateField('hospitalShareAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Mediend Share %" value={sheet.mediendSharePct} onChange={(v) => updateField('mediendSharePct', parseFloat(v) || null)} type="number" />
            <InputField label="Mediend Share Amt" value={sheet.mediendShareAmount} onChange={(v) => updateField('mediendShareAmount', parseFloat(v) || null)} type="number" />
            <InputField label="Mediend Net Profit" value={sheet.mediendNetProfit} onChange={(v) => updateField('mediendNetProfit', parseFloat(v) || null)} type="number" />
            <InputField label="Referral Amount" value={sheet.referralAmount} onChange={(v) => updateField('referralAmount', parseFloat(v) || null)} type="number" />
            <InputField label="CAB Charges" value={sheet.cabCharges} onChange={(v) => updateField('cabCharges', parseFloat(v) || null)} type="number" />
            <InputField label="Implant Cost" value={sheet.implantCost} onChange={(v) => updateField('implantCost', parseFloat(v) || null)} type="number" />
            <InputField label="Instruments Cost" value={sheet.instrumentsCost} onChange={(v) => updateField('instrumentsCost', parseFloat(v) || null)} type="number" />
            <InputField label="DC Charges" value={sheet.dcCharges} onChange={(v) => updateField('dcCharges', parseFloat(v) || null)} type="number" />
            <InputField label="Doctor Charges" value={sheet.doctorCharges} onChange={(v) => updateField('doctorCharges', parseFloat(v) || null)} type="number" />
            <InputField label="Tentative Amount" value={sheet.tentativeAmount} onChange={(v) => updateField('tentativeAmount', parseFloat(v) || null)} type="number" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <DischargeFileUploadField
              label="Discharge Summary"
              url={sheet.dischargeSummaryUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('dischargeSummaryUrl', file)}
              onClear={() => updateField('dischargeSummaryUrl', null)}
            />
            <DischargeFileUploadField
              label="Final Bill"
              url={sheet.finalBillUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('finalBillUrl', file)}
              onClear={() => updateField('finalBillUrl', null)}
            />
            <DischargeFileUploadField
              label="Approved Letter"
              url={sheet.finalApprovedUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('finalApprovedUrl', file)}
              onClear={() => updateField('finalApprovedUrl', null)}
            />
            <DischargeFileUploadField
              label="OT Notes"
              url={sheet.otNotesUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('otNotesUrl', file)}
              onClear={() => updateField('otNotesUrl', null)}
            />
            <DischargeFileUploadField
              label="Deduction Receipt"
              url={sheet.deductionReceiptUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('deductionReceiptUrl', file)}
              onClear={() => updateField('deductionReceiptUrl', null)}
            />
            <DischargeFileUploadField
              label="Settlement Letter"
              url={sheet.settlementLetterUrl}
              uploading={isUploadingFile}
              onPick={(file) => handleFileUpload('settlementLetterUrl', file)}
              onClear={() => updateField('settlementLetterUrl', null)}
            />
            <InputField
              label="Codes Count"
              value={sheet.codesCount}
              onChange={(v) => updateField('codesCount', parseInt(v) || null)}
              type="number"
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-muted-foreground/10 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-muted/10 pb-3.5 pl-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
              Remarks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <InputField label="Remarks" value={sheet.remarks} onChange={(v) => updateField('remarks', v || null)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
