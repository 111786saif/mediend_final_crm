'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

interface DischargeSheet {
  id: string
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

function InputField({ label, value, onChange, type = 'text' }: { label: string; value: string | number | null | undefined; onChange?: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string | null | undefined; onChange?: (v: string) => void }) {
  const dateValue = value ? new Date(value).toISOString().split('T')[0] : ''
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-8 text-sm"
      />
    </div>
  )
}

export default function EditDischargeSheetPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.leadId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sheet, setSheet] = useState<DischargeSheet | null>(null)

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

  const handleSave = async () => {
    if (!sheet?.id) return

    setSaving(true)
    try {
      await apiPatch(`/api/discharge-sheet/${sheet.id}`, sheet)
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
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
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bill Breakup</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deductions & Settlement</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <InputField label="Remarks" value={sheet.remarks} onChange={(v) => updateField('remarks', v || null)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
