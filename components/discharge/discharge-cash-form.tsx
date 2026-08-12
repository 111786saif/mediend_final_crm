'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useFileUpload } from '@/hooks/use-file-upload'
import { apiPost } from '@/lib/api-client'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { toast } from 'sonner'
import { FileText, X, ChevronDown, ChevronUp, User, Building2, Calendar, Receipt, Banknote } from 'lucide-react'

interface DischargeCashFormProps {
  leadId: string
  patientName: string
  hospitalName: string
  approvedAmount?: number
  finalBillAmount?: number
  modeOfPayment?: string
  onSuccess?: () => void
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  color: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

function Section({ title, icon, color, children, collapsible = false, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader
        className={`pb-3 ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">{icon}{title}</span>
          {collapsible && (open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
        </CardTitle>
      </CardHeader>
      {(!collapsible || open) && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

export function DischargeCashForm({
  leadId,
  patientName,
  hospitalName,
  approvedAmount,
  finalBillAmount,
  modeOfPayment,
  onSuccess,
}: DischargeCashFormProps) {
  const [formData, setFormData] = useState({
    dischargeDate: '',
    finalAmount: finalBillAmount != null ? String(finalBillAmount) : '',
    remarks: '',
    roomRentAmount: '',
    pharmacyAmount: '',
    investigationAmount: '',
    consumablesAmount: '',
    implantsAmount: '',
    instrumentsAmount: '',
  })

  const [totalFinalBill, setTotalFinalBill] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [finalBillUrl, setFinalBillUrl] = useState('')
  const [finalBillName, setFinalBillName] = useState('')

  const finalBillUpload = useFileUpload()

  const handleFinalBillSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFinalBillName(file.name)
    const result = await finalBillUpload.uploadFile(file)
    if (result) setFinalBillUrl(result.url)
  }

  const set = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    const total =
      (parseFloat(formData.roomRentAmount) || 0) +
      (parseFloat(formData.pharmacyAmount) || 0) +
      (parseFloat(formData.investigationAmount) || 0) +
      (parseFloat(formData.consumablesAmount) || 0) +
      (parseFloat(formData.implantsAmount) || 0) +
      (parseFloat(formData.instrumentsAmount) || 0)

    setTotalFinalBill(total)
  }, [
    formData.roomRentAmount,
    formData.pharmacyAmount,
    formData.investigationAmount,
    formData.consumablesAmount,
    formData.implantsAmount,
    formData.instrumentsAmount,
  ])

  const validate = () => {
    if (!formData.dischargeDate) return 'Discharge Date is required'
    if (!formData.finalAmount) return 'Final Amount is required'
    if (!finalBillUrl) return 'Final Bill document is required'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const error = validate()
    if (error) {
      toast.error(error)
      return
    }

    setSubmitting(true)
    try {
      await apiPost('/api/discharge-sheet-cash', {
        leadId,
        dischargeDate: formData.dischargeDate,
        finalAmount: parseFloat(formData.finalAmount),
        remarks: formData.remarks,
        finalBillUrl,
        settlementLetterUrl: '',
        roomRentAmount: parseFloat(formData.roomRentAmount) || 0,
        pharmacyAmount: parseFloat(formData.pharmacyAmount) || 0,
        investigationAmount: parseFloat(formData.investigationAmount) || 0,
        consumablesAmount: parseFloat(formData.consumablesAmount) || 0,
        implantsAmount: parseFloat(formData.implantsAmount) || 0,
        instrumentsAmount: parseFloat(formData.instrumentsAmount) || 0,
        totalFinalBill,
      })

      toast.success('Discharge sheet created successfully')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create discharge sheet')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Section A: Patient & Discharge Info */}
      <Section
        title="A. Patient & Discharge Info"
        icon={<User className="h-4 w-4 text-blue-600" />}
        color="border-blue-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Patient Name</Label>
              <div className="p-2 bg-muted rounded-md text-sm font-medium">{patientName}</div>
            </div>
            <div>
              <Label>Hospital</Label>
              <div className="p-2 bg-muted rounded-md text-sm font-medium">{hospitalName}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dischargeDate">Discharge Date <span className="text-destructive">*</span></Label>
              <Input
                id="dischargeDate"
                type="date"
                value={formData.dischargeDate}
                onChange={(e) => set('dischargeDate', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="finalAmount">Final Bill Amount (₹) <span className="text-destructive">*</span></Label>
              <Input
                id="finalAmount"
                type="number"
                min="0"
                value={formData.finalAmount}
                onChange={(e) => set('finalAmount', e.target.value)}
                placeholder="₹"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Section B: Financial Overview (autofilled from IPD cash form) */}
      <Section
        title="B. Financial Overview"
        icon={<Banknote className="h-4 w-4 text-green-600" />}
        color="border-green-500"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label>Approved / Package</Label>
            <div className="p-2 bg-muted rounded-md text-sm font-medium">
              ₹ {approvedAmount != null ? approvedAmount.toLocaleString('en-IN') : '—'}
            </div>
          </div>
          <div>
            <Label>Final Bill (from IPD)</Label>
            <div className="p-2 bg-muted rounded-md text-sm font-medium">
              ₹ {finalBillAmount != null ? finalBillAmount.toLocaleString('en-IN') : '—'}
            </div>
          </div>
          <div>
            <Label>Mode of Payment</Label>
            <div className="p-2 bg-muted rounded-md text-sm font-medium">
              {normalizeModeOfPaymentLabel(modeOfPayment) || '—'}
            </div>
          </div>
        </div>
      </Section>

      {/* Section C: Final Bill Document */}
      <Section
        title="C. Final Bill Document"
        icon={<FileText className="h-4 w-4 text-purple-600" />}
        color="border-purple-500"
      >
        <div>
          <Label className="mb-2 block">Upload Final Bill <span className="text-destructive">*</span></Label>
          {finalBillUrl ? (
            <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm flex-1 truncate">{finalBillName || 'Final Bill'}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setFinalBillUrl('')
                  setFinalBillName('')
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFinalBillSelect}
                disabled={finalBillUpload.uploading}
                className="flex-1"
              />
              {finalBillUpload.uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
            </div>
          )}
        </div>
      </Section>

      {/* Section D: Bill Breakup (Optional) */}
      <Section
        title="D. Bill Breakup (Optional)"
        icon={<Receipt className="h-4 w-4 text-orange-600" />}
        color="border-orange-500"
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="roomRentAmount">Room Rent (₹)</Label>
              <Input
                id="roomRentAmount"
                type="number"
                min="0"
                value={formData.roomRentAmount}
                onChange={(e) => set('roomRentAmount', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pharmacyAmount">Pharmacy (₹)</Label>
              <Input
                id="pharmacyAmount"
                type="number"
                min="0"
                value={formData.pharmacyAmount}
                onChange={(e) => set('pharmacyAmount', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="investigationAmount">Investigation (₹)</Label>
              <Input
                id="investigationAmount"
                type="number"
                min="0"
                value={formData.investigationAmount}
                onChange={(e) => set('investigationAmount', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="consumablesAmount">Consumables (₹)</Label>
              <Input
                id="consumablesAmount"
                type="number"
                min="0"
                value={formData.consumablesAmount}
                onChange={(e) => set('consumablesAmount', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="implantsAmount">Implants (₹)</Label>
              <Input
                id="implantsAmount"
                type="number"
                min="0"
                value={formData.implantsAmount}
                onChange={(e) => set('implantsAmount', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="instrumentsAmount">Instruments (₹)</Label>
              <Input
                id="instrumentsAmount"
                type="number"
                min="0"
                value={formData.instrumentsAmount}
                onChange={(e) => set('instrumentsAmount', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md border border-orange-200 dark:border-orange-800 flex justify-between items-center">
            <span className="font-semibold text-orange-800 dark:text-orange-200">Total Final Bill</span>
            <span className="text-xl font-bold text-orange-900 dark:text-orange-100">
              ₹ {totalFinalBill.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </Section>

      {/* Remarks */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Notes (Optional)</Label>
        <Textarea
          id="remarks"
          value={formData.remarks}
          onChange={(e) => set('remarks', e.target.value)}
          placeholder="Any additional notes..."
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={submitting} className="w-full md:w-auto">
          {submitting ? 'Creating Discharge Sheet...' : 'Create Discharge Sheet'}
        </Button>
      </div>
    </form>
  )
}
