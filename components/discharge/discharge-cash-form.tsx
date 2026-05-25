'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useFileUpload } from '@/hooks/use-file-upload'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { FileText, Upload, X, ChevronDown, ChevronUp, User, Building2, Calendar, Receipt } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DischargeCashFormProps {
  leadId: string
  patientName: string
  hospitalName: string
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

export function DischargeCashForm({ leadId, patientName, hospitalName, onSuccess }: DischargeCashFormProps) {
  const [formData, setFormData] = useState({
    dischargeDate: '',
    finalAmount: '',
    remarks: '',
    // Bill Breakup
    roomRentAmount: '',
    pharmacyAmount: '',
    investigationAmount: '',
    consumablesAmount: '',
    implantsAmount: '',
    instrumentsAmount: '',
    otherCharges: '',
    packageAmount: '',
    staplerCharges: '',
  })
  
  const [totalFinalBill, setTotalFinalBill] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // File uploads
  const [finalBillUrl, setFinalBillUrl] = useState('')
  const [settlementLetterUrl, setSettlementLetterUrl] = useState('')
  const [finalBillName, setFinalBillName] = useState('')
  const [settlementLetterName, setSettlementLetterName] = useState('')

  const finalBillUpload = useFileUpload()
  const settlementLetterUpload = useFileUpload()

  const handleFinalBillSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFinalBillName(file.name)
    const result = await finalBillUpload.uploadFile(file)
    if (result) setFinalBillUrl(result.url)
  }

  const handleSettlementLetterSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSettlementLetterName(file.name)
    const result = await settlementLetterUpload.uploadFile(file)
    if (result) setSettlementLetterUrl(result.url)
  }

  const set = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  // Auto-calculate totals
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
    
    // Documents validation
    if (!finalBillUrl) return 'Final Bill document is required'
    if (!settlementLetterUrl) return 'Settlement Letter is required'

    // Bill breakup validation
    if (!formData.roomRentAmount) return 'Room Rent amount is required'
    if (!formData.pharmacyAmount) return 'Pharmacy amount is required'
    if (!formData.investigationAmount) return 'Investigation amount is required'
    if (!formData.consumablesAmount) return 'Consumables amount is required'

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
        
        // Documents
        finalBillUrl,
        settlementLetterUrl,
        
        // Bill Breakup
        roomRentAmount: parseFloat(formData.roomRentAmount),
        pharmacyAmount: parseFloat(formData.pharmacyAmount),
        investigationAmount: parseFloat(formData.investigationAmount),
        consumablesAmount: parseFloat(formData.consumablesAmount),
        implantsAmount: parseFloat(formData.implantsAmount) || 0,
        instrumentsAmount: parseFloat(formData.instrumentsAmount) || 0,
        otherCharges: formData.otherCharges.trim() || undefined,
        packageAmount: formData.packageAmount.trim() || undefined,
        staplerCharges: formData.staplerCharges || undefined,
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
              <Label htmlFor="finalAmount">Final Amount (₹) <span className="text-destructive">*</span></Label>
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

      {/* Section B: Documents */}
      <Section
        title="B. Documents"
        icon={<FileText className="h-4 w-4 text-purple-600" />}
        color="border-purple-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Final Bill */}
          <div>
            <Label className="mb-2 block">Final Bill <span className="text-destructive">*</span></Label>
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

          {/* Settlement Letter */}
          <div>
            <Label className="mb-2 block">Settlement Letter <span className="text-destructive">*</span></Label>
            {settlementLetterUrl ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm flex-1 truncate">{settlementLetterName || 'Settlement Letter'}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSettlementLetterUrl('')
                    setSettlementLetterName('')
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
                  onChange={handleSettlementLetterSelect}
                  disabled={settlementLetterUpload.uploading}
                  className="flex-1"
                />
                {settlementLetterUpload.uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Section C: Bill Breakup */}
      <Section
        title="C. Bill Breakup"
        icon={<Receipt className="h-4 w-4 text-orange-600" />}
        color="border-orange-500"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="roomRentAmount">Room Rent (₹) <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="pharmacyAmount">Pharmacy (₹) <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="investigationAmount">Investigation (₹) <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="consumablesAmount">Consumables (₹) <span className="text-destructive">*</span></Label>
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
            <div>
              <Label htmlFor="otherCharges">Other Charges</Label>
              <Input
                id="otherCharges"
                type="text"
                value={formData.otherCharges}
                onChange={(e) => set('otherCharges', e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="packageAmount">Package Amount</Label>
              <Input
                id="packageAmount"
                type="text"
                value={formData.packageAmount}
                onChange={(e) => set('packageAmount', e.target.value)}
                placeholder="Optional"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="staplerCharges">Stapler Charges</Label>
              <select
                id="staplerCharges"
                value={formData.staplerCharges}
                onChange={(e) => set('staplerCharges', e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select…</option>
                <option value="INCLUDED">Included</option>
                <option value="OPEN">Open</option>
              </select>
            </div>
          </div>

          {/* Total Box */}
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
        <Label htmlFor="remarks">Remarks / Notes</Label>
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
