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

export function DischargeSheetForm({
  leadId,
  patientName = '',
  surgeryDate = '',
  hospital = '',
  sumInsured = '',
  roomType = '',
  roomRent = '',
  copayPct = 0,
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
    finalAmount: '',
    // Documents
    dischargeSummaryUrl: '',
    otNotesUrl: '',
    finalBillUrl: '',
    settlementLetterUrl: '',
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
    totalFinalBill: '',
    // Deductions
    finalApprovedAmount: '',
    paidByInsured: '',
    deductionAmount: '',
    discountAmount: '',
    waivedOffAmount: '',
    otherDeduction: '',
    netSettlementAmount: '',
    remarks: '',
  })

  const [files, setFiles] = useState({
    dischargeSummary: null as { name: string; url: string } | null,
    otNotes: null as { name: string; url: string } | null,
    finalBill: null as { name: string; url: string } | null,
    settlementLetter: null as { name: string; url: string } | null,
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
      setFiles(prev => ({
        ...prev,
        [field]: { name: file.name, url: result.url }
      }))
    }
  }

  const calculateTotals = () => {
    const roomRent = parseFloat(formData.roomRentAmount) || 0
    const pharmacy = parseFloat(formData.pharmacyAmount) || 0
    const investigation = parseFloat(formData.investigationAmount) || 0
    const consumables = parseFloat(formData.consumablesAmount) || 0
    const implants = parseFloat(formData.implantsAmount) || 0
    const instruments = parseFloat(formData.instrumentsAmount) || 0

    const totalBill = roomRent + pharmacy + investigation + consumables + implants + instruments
    
    const deduction = parseFloat(formData.deductionAmount) || 0
    const discount = parseFloat(formData.discountAmount) || 0
    const waived = parseFloat(formData.waivedOffAmount) || 0
    const other = parseFloat(formData.otherDeduction) || 0
    const totalDeductions = deduction + discount + waived + other

    const finalApproved = parseFloat(formData.finalApprovedAmount) || totalBill
    const netSettlement = finalApproved - totalDeductions

    return { totalBill, totalDeductions, netSettlement }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.dischargeDate) newErrors.dischargeDate = 'Discharge date is required'
    if (!formData.finalAmount) newErrors.finalAmount = 'Final amount is required'
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
    try {
      await apiPost('/api/discharge-sheet', {
        leadId,
        dischargeDate: formData.dischargeDate,
        finalAmount: parseFloat(formData.finalAmount),
        dischargeSummaryUrl: files.dischargeSummary?.url,
        otNotesUrl: files.otNotes?.url,
        finalBillUrl: files.finalBill?.url,
        settlementLetterUrl: files.settlementLetter?.url,
        roomRentAmount: parseFloat(formData.roomRentAmount),
        pharmacyAmount: parseFloat(formData.pharmacyAmount),
        investigationAmount: parseFloat(formData.investigationAmount),
        consumablesAmount: parseFloat(formData.consumablesAmount),
        implantsAmount: formData.implantsAmount ? parseFloat(formData.implantsAmount) : 0,
        instrumentsAmount: formData.instrumentsAmount ? parseFloat(formData.instrumentsAmount) : undefined,
        otherCharges: formData.otherCharges.trim() || undefined,
        packageAmount: formData.packageAmount.trim() || undefined,
        staplerCharges: formData.staplerCharges || undefined,
        totalFinalBill: calculateTotals().totalBill,
        finalApprovedAmount: parseFloat(formData.finalApprovedAmount),
        cashOrDedPaid: formData.paidByInsured ? parseFloat(formData.paidByInsured) : 0,
        deductionAmount: formData.deductionAmount ? parseFloat(formData.deductionAmount) : 0,
        discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : 0,
        waivedOffAmount: formData.waivedOffAmount ? parseFloat(formData.waivedOffAmount) : 0,
        otherDeduction: formData.otherDeduction ? parseFloat(formData.otherDeduction) : 0,
        netSettlementAmount: calculateTotals().netSettlement,
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

  const { totalBill } = calculateTotals()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient & Discharge Info */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">Discharge Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Patient Name</Label>
            <p className="text-sm font-medium">{patientName}</p>
          </div>
          <div>
            <Label>Hospital</Label>
            <p className="text-sm font-medium">{hospital}</p>
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
          <h3 className="font-semibold flex items-center gap-2">
            📄 Documents (B)
          </h3>
          {expandedSections.documents ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.documents && (
          <div className="p-4 border-t space-y-4">
            <div>
              <Label>Discharge Summary *</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('dischargeSummary', e.target.files[0])}
                  disabled={uploading}
                />
                {errors.dischargeSummary && <p className="text-xs text-destructive mt-1">{errors.dischargeSummary}</p>}
                {files.dischargeSummary && (
                  <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-md">
                    <File className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{files.dischargeSummary.name}</span>
                    <button type="button" onClick={() => setFiles(prev => ({ ...prev, dischargeSummary: null }))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>OT Notes</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('otNotes', e.target.files[0])}
                  disabled={uploading}
                />
                {errors.otNotes && <p className="text-xs text-destructive mt-1">{errors.otNotes}</p>}
                {files.otNotes && (
                  <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-md">
                    <File className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{files.otNotes.name}</span>
                    <button type="button" onClick={() => setFiles(prev => ({ ...prev, otNotes: null }))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Final Bill Amount (₹) *</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('finalBill', e.target.files[0])}
                  disabled={uploading}
                />
                {errors.finalBill && <p className="text-xs text-destructive mt-1">{errors.finalBill}</p>}
                {files.finalBill && (
                  <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-md">
                    <File className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{files.finalBill.name}</span>
                    <button type="button" onClick={() => setFiles(prev => ({ ...prev, finalBill: null }))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Settlement Letter (Optional)</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload('settlementLetter', e.target.files[0])}
                  disabled={uploading}
                />
                {files.settlementLetter && (
                  <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-md">
                    <File className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{files.settlementLetter.name}</span>
                    <button type="button" onClick={() => setFiles(prev => ({ ...prev, settlementLetter: null }))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
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
          <h3 className="font-semibold flex items-center gap-2">
            💰 Bill Breakup (C)
          </h3>
          {expandedSections.billBreakup ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.billBreakup && (
          <div className="p-4 border-t space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Room Rent (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.roomRentAmount}
                  onChange={(e) => setFormData({ ...formData, roomRentAmount: e.target.value })}
                  required
                />
                {errors.roomRentAmount && <p className="text-xs text-destructive">{errors.roomRentAmount}</p>}
              </div>
              <div>
                <Label>Pharmacy (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.pharmacyAmount}
                  onChange={(e) => setFormData({ ...formData, pharmacyAmount: e.target.value })}
                  required
                />
                {errors.pharmacyAmount && <p className="text-xs text-destructive">{errors.pharmacyAmount}</p>}
              </div>
              <div>
                <Label>Investigation (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.investigationAmount}
                  onChange={(e) => setFormData({ ...formData, investigationAmount: e.target.value })}
                  required
                />
                {errors.investigationAmount && <p className="text-xs text-destructive">{errors.investigationAmount}</p>}
              </div>
              <div>
                <Label>Consumables (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.consumablesAmount}
                  onChange={(e) => setFormData({ ...formData, consumablesAmount: e.target.value })}
                  required
                />
                {errors.consumablesAmount && <p className="text-xs text-destructive">{errors.consumablesAmount}</p>}
              </div>
              <div>
                <Label>Implants (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.implantsAmount}
                  onChange={(e) => setFormData({ ...formData, implantsAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Instruments (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.instrumentsAmount}
                  onChange={(e) => setFormData({ ...formData, instrumentsAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Other Charges</Label>
                <Input
                  type="text"
                  value={formData.otherCharges}
                  onChange={(e) => setFormData({ ...formData, otherCharges: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Package Amount</Label>
                <Input
                  type="text"
                  value={formData.packageAmount}
                  onChange={(e) => setFormData({ ...formData, packageAmount: e.target.value })}
                  placeholder="Optional"
                />
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
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mt-3">
              <p className="text-sm"><span className="font-semibold">Total Final Bill: </span>₹{totalBill.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Deductions Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => toggleSection('deductions')}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <h3 className="font-semibold flex items-center gap-2">
            📋 Deductions & Settlement (D)
          </h3>
          {expandedSections.deductions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {expandedSections.deductions && (
          <div className="p-4 border-t space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Final Approved Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.finalApprovedAmount}
                  onChange={(e) => setFormData({ ...formData, finalApprovedAmount: e.target.value })}
                  required
                />
                {errors.finalApprovedAmount && <p className="text-xs text-destructive">{errors.finalApprovedAmount}</p>}
              </div>
              <div>
                <Label>Paid by insured (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.paidByInsured}
                  onChange={(e) => setFormData({ ...formData, paidByInsured: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Deduction (Paid by insured) (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deductionAmount}
                  onChange={(e) => setFormData({ ...formData, deductionAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.discountAmount}
                  onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Waived Off (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.waivedOffAmount}
                  onChange={(e) => setFormData({ ...formData, waivedOffAmount: e.target.value })}
                />
              </div>
              <div>
                <Label>Other Deduction (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.otherDeduction}
                  onChange={(e) => setFormData({ ...formData, otherDeduction: e.target.value })}
                />
              </div>
            </div>
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
