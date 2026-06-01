'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useFileUpload } from '@/hooks/use-file-upload'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, File, X } from 'lucide-react'

interface DischargeSheetFormProps {
  leadId: string
  patientName?: string
  surgeryDate?: string
  hospital?: string
  sumInsured?: string
  roomType?: string
  roomRent?: string
  copayPct?: number
  doctorName?: string
  /** Prefill from IPD mark when BD selected Discharged; YYYY-MM-DD, still editable */
  initialDischargeDate?: string
  onSuccess?: () => void
  onCancel?: () => void
}

type UploadedFile = { name: string; url: string } | null

/** Reusable single-file upload field (pdf/image). */
function FileField({
  label,
  required,
  file,
  uploading,
  error,
  onPick,
  onClear,
}: {
  label: string
  required?: boolean
  file: UploadedFile
  uploading: boolean
  error?: string
  onPick: (f: File) => void
  onClear: () => void
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <div className="mt-2">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        {file && (
          <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-md">
            <File className="h-4 w-4" />
            <span className="text-sm flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={onClear}
              className="text-destructive hover:bg-destructive/10 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function DischargeSheetForm({
  leadId,
  patientName = '',
  hospital = '',
  doctorName = '',
  initialDischargeDate = '',
  onSuccess,
  onCancel,
}: DischargeSheetFormProps) {
  const { uploadFile, uploading } = useFileUpload()
  const [expandedSections, setExpandedSections] = useState({
    documents: true,
    billBreakup: true,
    deductions: true,
  })

  const [formData, setFormData] = useState({
    dischargeDate: initialDischargeDate,
    finalAmount: '', // top anchor — Other Charges balances the breakup to this
    // Bill Breakup
    roomRentAmount: '',
    pharmacyAmount: '',
    investigationAmount: '',
    consumablesAmount: '',
    implantsAmount: '',
    instrumentsAmount: '',
    staplerCharges: '',
    anesthesiaAmount: '',
    packageAmount: '', // informational — excluded from total
    // Deductions & Settlement
    finalApprovedAmount: '',
    copayAmount: '',
    otherDeduction: '',
    collectedByHospital: '',
    collectedByMediend: '',
    discountAmount: '', // hospital discount
    axisTariffDeduction: '',
    axisTariffDeductionPaid: '',
    remarks: '',
  })

  const [files, setFiles] = useState({
    dischargeSummary: null as UploadedFile,
    otNotes: null as UploadedFile,
    finalApproved: null as UploadedFile,
    deductionReceipt: null as UploadedFile,
    finalBill: null as UploadedFile,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const hasAppliedInitialDischargeDate = useRef(false)

  useEffect(() => {
    if (initialDischargeDate && !hasAppliedInitialDischargeDate.current) {
      hasAppliedInitialDischargeDate.current = true
      setFormData(prev => ({ ...prev, dischargeDate: initialDischargeDate }))
    }
  }, [initialDischargeDate])

  const handleFileUpload = async (field: keyof typeof files, file: File) => {
    const result = await uploadFile(file)
    if (result) {
      setFiles(prev => ({ ...prev, [field]: { name: file.name, url: result.url } }))
    }
  }

  const num = (v: string) => parseFloat(v) || 0

  const computeBill = () => {
    const finalBill = num(formData.finalAmount)
    const lineItems =
      num(formData.roomRentAmount) +
      num(formData.pharmacyAmount) +
      num(formData.investigationAmount) +
      num(formData.consumablesAmount) +
      num(formData.implantsAmount) +
      num(formData.instrumentsAmount) +
      num(formData.anesthesiaAmount)
    const otherCharges = finalBill - lineItems // stapler (select) & package excluded
    const grandTotal = lineItems + otherCharges // === finalBill by construction
    return { finalBill, lineItems, otherCharges, grandTotal }
  }

  const computeDeductions = () => {
    const deductionTotal = num(formData.copayAmount) + num(formData.otherDeduction)
    const deductionPaidTotal = num(formData.collectedByHospital) + num(formData.collectedByMediend)
    const waiveOff = deductionTotal - deductionPaidTotal
    const actualFinalAmount =
      num(formData.finalApprovedAmount) + deductionPaidTotal + num(formData.axisTariffDeductionPaid)
    return { deductionTotal, deductionPaidTotal, waiveOff, actualFinalAmount }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.dischargeDate) newErrors.dischargeDate = 'Discharge date is required'
    if (!formData.finalAmount) newErrors.finalAmount = 'Final bill amount is required'
    if (!files.dischargeSummary) newErrors.dischargeSummary = 'Discharge summary is required'
    if (!files.finalBill) newErrors.finalBill = 'Final bill is required'
    if (!formData.roomRentAmount) newErrors.roomRentAmount = 'Room rent amount is required'
    if (!formData.pharmacyAmount) newErrors.pharmacyAmount = 'Pharmacy amount is required'
    if (!formData.investigationAmount) newErrors.investigationAmount = 'Investigation amount is required'
    if (!formData.consumablesAmount) newErrors.consumablesAmount = 'Consumables amount is required'
    if (!formData.finalApprovedAmount) newErrors.finalApprovedAmount = 'Final approved amount is required'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Please fix the errors')
      return
    }

    setErrors({})
    const bill = computeBill()
    const ded = computeDeductions()
    try {
      await apiPost('/api/discharge-sheet', {
        leadId,
        dischargeDate: formData.dischargeDate,
        finalAmount: bill.finalBill,
        dischargeSummaryUrl: files.dischargeSummary?.url,
        otNotesUrl: files.otNotes?.url,
        finalBillUrl: files.finalBill?.url,
        finalApprovedUrl: files.finalApproved?.url,
        deductionReceiptUrl: files.deductionReceipt?.url,
        // Bill Breakup
        roomRentAmount: num(formData.roomRentAmount),
        pharmacyAmount: num(formData.pharmacyAmount),
        investigationAmount: num(formData.investigationAmount),
        consumablesAmount: num(formData.consumablesAmount),
        implantsAmount: formData.implantsAmount ? num(formData.implantsAmount) : 0,
        instrumentsAmount: formData.instrumentsAmount ? num(formData.instrumentsAmount) : undefined,
        anesthesiaAmount: num(formData.anesthesiaAmount),
        otherChargesAmount: bill.otherCharges,
        packageAmount: formData.packageAmount.trim() || undefined,
        staplerCharges: formData.staplerCharges || undefined,
        totalFinalBill: bill.grandTotal, // === finalBill
        // Deductions & Settlement
        finalApprovedAmount: num(formData.finalApprovedAmount),
        copayAmount: num(formData.copayAmount),
        otherDeduction: num(formData.otherDeduction),
        collectedByHospital: num(formData.collectedByHospital),
        collectedByMediend: num(formData.collectedByMediend),
        discountAmount: num(formData.discountAmount),
        axisTariffDeduction: num(formData.axisTariffDeduction),
        axisTariffDeductionPaid: num(formData.axisTariffDeductionPaid),
        // Derived totals (server recomputes — these are for convenience)
        deductionAmount: ded.deductionTotal,
        cashOrDedPaid: ded.deductionPaidTotal,
        waivedOffAmount: ded.waiveOff,
        actualFinalAmount: ded.actualFinalAmount,
        netSettlementAmount: ded.actualFinalAmount,
        remarks: formData.remarks.trim() || undefined,
      })
      toast.success('Discharge sheet submitted successfully')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit discharge sheet')
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const bill = computeBill()
  const ded = computeDeductions()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient & Discharge Info */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Discharge Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Patient Name</Label>
            <p className="text-sm font-medium">{patientName || '—'}</p>
          </div>
          <div>
            <Label>Hospital</Label>
            <p className="text-sm font-medium">{hospital || '—'}</p>
          </div>
          <div>
            <Label>Doctor Name</Label>
            <p className="text-sm font-medium">{doctorName || '—'}</p>
          </div>
          <div>
            <Label htmlFor="dischargeDate">Discharge Date *</Label>
            <Input
              id="dischargeDate"
              type="date"
              value={formData.dischargeDate}
              onChange={(e) => setFormData({ ...formData, dischargeDate: e.target.value })}
              required
            />
            {errors.dischargeDate && <p className="text-xs text-destructive mt-1">{errors.dischargeDate}</p>}
          </div>
          <div>
            <Label htmlFor="finalAmount">Final Bill Amount (₹) *</Label>
            <Input
              id="finalAmount"
              type="number"
              step="0.01"
              value={formData.finalAmount}
              onChange={(e) => setFormData({ ...formData, finalAmount: e.target.value })}
              placeholder="0"
              required
            />
            {errors.finalAmount && <p className="text-xs text-destructive mt-1">{errors.finalAmount}</p>}
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => toggleSection('documents')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <h3 className="font-semibold flex items-center gap-2">📄 Documents (B)</h3>
          {expandedSections.documents ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.documents && (
          <div className="p-4 border-t space-y-4">
            <FileField
              label="Discharge Summary"
              required
              file={files.dischargeSummary}
              uploading={uploading}
              error={errors.dischargeSummary}
              onPick={(f) => handleFileUpload('dischargeSummary', f)}
              onClear={() => setFiles(prev => ({ ...prev, dischargeSummary: null }))}
            />
            <FileField
              label="OT Notes"
              file={files.otNotes}
              uploading={uploading}
              onPick={(f) => handleFileUpload('otNotes', f)}
              onClear={() => setFiles(prev => ({ ...prev, otNotes: null }))}
            />
          </div>
        )}
      </div>

      {/* Bill Breakup Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => toggleSection('billBreakup')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <h3 className="font-semibold flex items-center gap-2">💰 Bill Breakup (C)</h3>
          {expandedSections.billBreakup ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.billBreakup && (
          <div className="p-4 border-t space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Room Rent (₹) *</Label>
                <Input type="number" step="0.01" value={formData.roomRentAmount}
                  onChange={(e) => setFormData({ ...formData, roomRentAmount: e.target.value })} required />
                {errors.roomRentAmount && <p className="text-xs text-destructive">{errors.roomRentAmount}</p>}
              </div>
              <div>
                <Label>Pharmacy (₹) *</Label>
                <Input type="number" step="0.01" value={formData.pharmacyAmount}
                  onChange={(e) => setFormData({ ...formData, pharmacyAmount: e.target.value })} required />
                {errors.pharmacyAmount && <p className="text-xs text-destructive">{errors.pharmacyAmount}</p>}
              </div>
              <div>
                <Label>Investigation (₹) *</Label>
                <Input type="number" step="0.01" value={formData.investigationAmount}
                  onChange={(e) => setFormData({ ...formData, investigationAmount: e.target.value })} required />
                {errors.investigationAmount && <p className="text-xs text-destructive">{errors.investigationAmount}</p>}
              </div>
              <div>
                <Label>Consumables (₹) *</Label>
                <Input type="number" step="0.01" value={formData.consumablesAmount}
                  onChange={(e) => setFormData({ ...formData, consumablesAmount: e.target.value })} required />
                {errors.consumablesAmount && <p className="text-xs text-destructive">{errors.consumablesAmount}</p>}
              </div>
              <div>
                <Label>Implants (₹)</Label>
                <Input type="number" step="0.01" value={formData.implantsAmount}
                  onChange={(e) => setFormData({ ...formData, implantsAmount: e.target.value })} />
              </div>
              <div>
                <Label>Instruments (₹)</Label>
                <Input type="number" step="0.01" value={formData.instrumentsAmount}
                  onChange={(e) => setFormData({ ...formData, instrumentsAmount: e.target.value })} />
              </div>
              <div>
                <Label>Stapler Charges</Label>
                <select
                  value={formData.staplerCharges}
                  onChange={(e) => setFormData({ ...formData, staplerCharges: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select…</option>
                  <option value="INCLUDED">Included</option>
                  <option value="OPEN">Open</option>
                </select>
              </div>
              <div>
                <Label>Anesthesia (₹)</Label>
                <Input type="number" step="0.01" value={formData.anesthesiaAmount}
                  onChange={(e) => setFormData({ ...formData, anesthesiaAmount: e.target.value })} />
              </div>
              <div>
                <Label>Other Charges (₹)</Label>
                <Input
                  type="number"
                  value={bill.otherCharges.toFixed(2)}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Auto = Final Bill − line items</p>
              </div>
              <div>
                <Label>Package Amount (₹)</Label>
                <Input type="number" step="0.01" value={formData.packageAmount}
                  onChange={(e) => setFormData({ ...formData, packageAmount: e.target.value })} placeholder="Optional" />
                <p className="text-[11px] text-muted-foreground mt-1">Excluded from total</p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Total Final Bill</span>
              <span className="text-sm font-semibold">{inr(bill.grandTotal)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Matches the Final Bill Amount entered above.</p>
          </div>
        )}
      </div>

      {/* Deductions & Settlement Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => toggleSection('deductions')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <h3 className="font-semibold flex items-center gap-2">📋 Deductions & Settlement (D)</h3>
          {expandedSections.deductions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.deductions && (
          <div className="p-4 border-t space-y-4">
            {/* 1. Final Approved Amount */}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="font-semibold">Final Approved Amount</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Amount (₹) *</Label>
                  <Input type="number" step="0.01" value={formData.finalApprovedAmount}
                    onChange={(e) => setFormData({ ...formData, finalApprovedAmount: e.target.value })} required />
                  {errors.finalApprovedAmount && <p className="text-xs text-destructive">{errors.finalApprovedAmount}</p>}
                </div>
                <FileField
                  label="Approval Letter"
                  file={files.finalApproved}
                  uploading={uploading}
                  onPick={(f) => handleFileUpload('finalApproved', f)}
                  onClear={() => setFiles(prev => ({ ...prev, finalApproved: null }))}
                />
              </div>
            </div>

            {/* 2. Deductions */}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="font-semibold">Deductions</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Copay (₹)</Label>
                  <Input type="number" step="0.01" value={formData.copayAmount}
                    onChange={(e) => setFormData({ ...formData, copayAmount: e.target.value })} />
                </div>
                <div>
                  <Label>Other Deductions (₹)</Label>
                  <Input type="number" step="0.01" value={formData.otherDeduction}
                    onChange={(e) => setFormData({ ...formData, otherDeduction: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Deductions</span>
                <span className="font-medium">{inr(ded.deductionTotal)}</span>
              </div>
            </div>

            {/* 3. Deductions Paid */}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="font-semibold">Deductions Paid</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Collected by Hospital (₹)</Label>
                  <Input type="number" step="0.01" value={formData.collectedByHospital}
                    onChange={(e) => setFormData({ ...formData, collectedByHospital: e.target.value })} />
                </div>
                <div>
                  <Label>Collected by Mediend (₹)</Label>
                  <Input type="number" step="0.01" value={formData.collectedByMediend}
                    onChange={(e) => setFormData({ ...formData, collectedByMediend: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-medium">{inr(ded.deductionPaidTotal)}</span>
              </div>
              <FileField
                label="Receipt"
                file={files.deductionReceipt}
                uploading={uploading}
                onPick={(f) => handleFileUpload('deductionReceipt', f)}
                onClear={() => setFiles(prev => ({ ...prev, deductionReceipt: null }))}
              />
            </div>

            {/* 4. Hospital Discount & Waive Off */}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="font-semibold">Hospital Discount &amp; Waive Off</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hospital Discount (₹)</Label>
                  <Input type="number" step="0.01" value={formData.discountAmount}
                    onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })} />
                </div>
                <div>
                  <Label>Waive Off (₹)</Label>
                  <Input type="number" value={ded.waiveOff.toFixed(2)} readOnly className="bg-muted/50 cursor-not-allowed" />
                  <p className="text-[11px] text-muted-foreground mt-1">Auto = Deductions − Deductions Paid</p>
                </div>
              </div>
            </div>

            {/* 5. Exxis Tarrif */}
            <div className="border rounded-md p-3 space-y-3">
              <Label className="font-semibold">Exxis Tarrif</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Deduction (₹)</Label>
                  <Input type="number" step="0.01" value={formData.axisTariffDeduction}
                    onChange={(e) => setFormData({ ...formData, axisTariffDeduction: e.target.value })} />
                </div>
                <div>
                  <Label>Deduction Paid (₹)</Label>
                  <Input type="number" step="0.01" value={formData.axisTariffDeductionPaid}
                    onChange={(e) => setFormData({ ...formData, axisTariffDeductionPaid: e.target.value })} />
                </div>
              </div>
            </div>

            {/* 6. Actual Final Amount */}
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded flex items-center justify-between">
              <span className="text-sm font-semibold">Actual Final Amount</span>
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">{inr(ded.actualFinalAmount)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">
              = Final Approved + Deductions Paid + Exxis Tarrif Deduction Paid
            </p>

            {/* 7. Final Bill upload */}
            <FileField
              label="Final Bill"
              required
              file={files.finalBill}
              uploading={uploading}
              error={errors.finalBill}
              onPick={(f) => handleFileUpload('finalBill', f)}
              onClear={() => setFiles(prev => ({ ...prev, finalBill: null }))}
            />
          </div>
        )}
      </div>

      {/* Remarks */}
      <div>
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea
          id="remarks"
          value={formData.remarks}
          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          placeholder="Any additional remarks"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Submit Discharge Sheet'}
        </Button>
      </div>
    </form>
  )
}
