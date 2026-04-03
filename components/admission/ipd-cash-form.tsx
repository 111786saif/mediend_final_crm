'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost, apiPatch } from '@/lib/api-client'
import { toast } from 'sonner'
import { User, MapPin, Stethoscope, Building2, Wallet, Calendar, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { MasterCombobox } from '@/components/ui/master-combobox'

const DOCTOR_TYPES = [
  'Plastic',
  'General',
  'Vascular',
  'Ophthalmology',
  'Orthopedic',
  'ENT',
  'Gynecologist',
  'Laparoscopy',
  'Urologist',
] as const

export interface IPDCashFormProps {
  leadId: string
  // Patient Information
  patientName?: string
  leadRef?: string
  age?: number
  sex?: string
  phoneNumber?: string
  alternateNumber?: string
  attendantName?: string
  attendantContactNo?: string
  circle?: string
  // Treatment & Procedure (auto-fetched from lead)
  category?: string
  treatment?: string
  quantityGrade?: string
  anesthesia?: string
  // Surgeon (auto-fetched from lead)
  surgeonName?: string
  surgeonType?: string
  // Hospital
  hospitalName?: string
  // BD info
  bdName?: string
  bdManagerName?: string
  // For re-submission (edit mode)
  initialData?: any
  isEditMode?: boolean
  onSuccess?: (admissionId?: string) => void
  onCancel?: () => void
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

function ReadOnlyField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value || '—'}</p>
    </div>
  )
}

export function IPDCashForm({
  leadId,
  patientName = '',
  leadRef = '',
  age,
  sex = '',
  phoneNumber = '',
  alternateNumber = '',
  attendantName = '',
  attendantContactNo = '',
  circle = '',
  category = '',
  treatment = '',
  quantityGrade = '',
  anesthesia = '',
  surgeonName = '',
  surgeonType = '',
  hospitalName = '',
  bdName = '',
  bdManagerName = '',
  initialData,
  isEditMode = false,
  onSuccess,
  onCancel,
}: IPDCashFormProps) {
  const [formData, setFormData] = useState({
    // Patient info (prefilled, editable)
    patientName: patientName || '',
    age: age != null ? String(age) : '',
    sex: sex || '',
    circle: circle || '',
    // Treatment (prefilled, editable)
    category: category || '',
    treatment: treatment || '',
    quantityGrade: quantityGrade,
    anesthesia: anesthesia,
    // Surgeon (prefilled, editable)
    surgeonName: surgeonName || '',
    surgeonType: surgeonType,
    // Hospital (prefilled, editable)
    hospitalName: hospitalName || '',
    // Alternate contact (editable)
    alternateContactName: attendantName,
    alternateContactNumber: alternateNumber,
    admissionDate: '',
    admissionTime: '',
    surgeryDate: '',
    surgeryTime: '',
    hospitalAddress: '',
    googleMapLocation: '',
    // Implants & Consumables
    implantText: '',
    implantAmount: '',
    instrumentText: '',
    instrumentAmount: '',
    consumablesText: '',
    consumablesAmount: '',
    notes: '',
    // Cash Flow Financials
    modeOfPayment: 'Cash', // Cash or EMI
    discount: '',
    copay: '',
    deduction: '',
    approvedAmount: '', // Approved / Cash Package
    collectedAmount: '', // Cash / Deduction Collected
    collectedByMediend: '',
    collectedByHospital: '',
    finalBillAmount: '',
    // EMI specific
    emiAmount: '',
    processingFee: '',
    gst: '',
    subventionFee: '', // Auto-calculated
    finalEmiAmount: '',
  })

  // Pre-fill data if in edit mode
  useEffect(() => {
    if (initialData && isEditMode) {
      setFormData(prev => ({
        ...prev,
        admissionDate: initialData.admissionDate ? new Date(initialData.admissionDate).toISOString().split('T')[0] : '',
        admissionTime: initialData.admissionTime || '',
        surgeryDate: initialData.surgeryDate ? new Date(initialData.surgeryDate).toISOString().split('T')[0] : '',
        surgeryTime: initialData.surgeryTime || '',
        hospitalAddress: initialData.hospitalAddress || '',
        googleMapLocation: initialData.googleMapLocation || '',
        notes: initialData.notes || '',
        collectedByMediend: initialData.collectedByMediend != null ? String(initialData.collectedByMediend) : '',
        collectedByHospital: initialData.collectedByHospital != null ? String(initialData.collectedByHospital) : '',
      }))
    }
  }, [initialData, isEditMode])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (key: string, value: string) => {
    setFormData((prev) => {
      const newState = { ...prev, [key]: value }
      
      // Auto-calculate Subvention Fee = Processing Fee + GST
      if (key === 'processingFee' || key === 'gst') {
        const pf = parseFloat(key === 'processingFee' ? value : prev.processingFee) || 0
        const gst = parseFloat(key === 'gst' ? value : prev.gst) || 0
        newState.subventionFee = (pf + gst).toString()
      }

      return newState
    })
  }

  // Calculate Settled Amount (Sum of Package/Approved)
  // Wait, requirement says: "Settled (Sum of Package/Approved)"
  // It seems Settled = Approved Amount? Or implies something else?
  // Let's assume Settled = Approved Amount for now as per "Settled (Sum of Package/Approved)" text.
  // Actually, usually Settled = Collected + Pending? 
  // Let's stick to the prompt: "Settled (Sum of Package/Approved)"
  const settledAmount = formData.approvedAmount

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.admissionDate) e.admissionDate = 'Required'
    if (!formData.admissionTime.trim()) e.admissionTime = 'Required'
    if (!formData.surgeryDate) e.surgeryDate = 'Required'
    if (!formData.surgeryTime.trim()) e.surgeryTime = 'Required'
    
    // Financial validation
    if (!formData.finalBillAmount) e.finalBillAmount = 'Required'
    if (!formData.approvedAmount) e.approvedAmount = 'Required'
    
    if (formData.modeOfPayment === 'EMI') {
      if (!formData.emiAmount) e.emiAmount = 'Required'
      if (!formData.finalEmiAmount) e.finalEmiAmount = 'Required'
    }

    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error('Please fill all required fields')
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      // Combine implant/instrument/consumables
      const implantConsumables = [
        formData.implantText && `Implants: ${formData.implantText}${formData.implantAmount ? ` (₹${formData.implantAmount})` : ''}`,
        formData.consumablesText && `Consumables: ${formData.consumablesText}${formData.consumablesAmount ? ` (₹${formData.consumablesAmount})` : ''}`,
      ].filter(Boolean).join('\n') || undefined

      const instrument = [
        formData.instrumentText && `Instruments: ${formData.instrumentText}${formData.instrumentAmount ? ` (₹${formData.instrumentAmount})` : ''}`,
      ].filter(Boolean).join('\n') || undefined

      const payload = {
        admissionDate: formData.admissionDate,
        admissionTime: formData.admissionTime.trim(),
        admittingHospital: formData.hospitalName.trim() || 'N/A',
        hospitalAddress: formData.hospitalAddress.trim() || 'N/A',
        googleMapLocation: formData.googleMapLocation.trim() || undefined,
        surgeryDate: formData.surgeryDate,
        surgeryTime: formData.surgeryTime.trim(),
        instrument,
        implantConsumables,
        notes: formData.notes.trim() || undefined,
        quantityGrade: formData.quantityGrade?.trim() || undefined,
        anesthesia: formData.anesthesia?.trim() || undefined,
        surgeonType: formData.surgeonType?.trim() || undefined,
        alternateContactName: formData.alternateContactName?.trim() || undefined,
        alternateContactNumber: formData.alternateContactNumber?.trim() || undefined,
        
        // Cash specific fields
        modeOfPayment: formData.modeOfPayment,
        discount: parseFloat(formData.discount) || 0,
        copay: parseFloat(formData.copay) || 0,
        deduction: parseFloat(formData.deduction) || 0,
        approvedAmount: parseFloat(formData.approvedAmount) || 0,
        collectedAmount: parseFloat(formData.collectedAmount) || 0,
        collectedByMediend: parseFloat(formData.collectedByMediend) || 0,
        collectedByHospital: parseFloat(formData.collectedByHospital) || 0,
        finalBillAmount: parseFloat(formData.finalBillAmount) || 0,
        
        // EMI specific
        emiAmount: parseFloat(formData.emiAmount) || 0,
        processingFee: parseFloat(formData.processingFee) || 0,
        gst: parseFloat(formData.gst) || 0,
        subventionFee: parseFloat(formData.subventionFee) || 0,
        finalEmiAmount: parseFloat(formData.finalEmiAmount) || 0,
      }

      let response;
      if (isEditMode) {
        response = await apiPatch<{ id: string }>(`/api/leads/${leadId}/initiate-cash`, payload)
        toast.success('IPD Cash details updated successfully')
      } else {
        response = await apiPost<{ id: string }>(`/api/leads/${leadId}/initiate-cash`, payload)
        toast.success('IPD Cash details saved successfully')
      }
      
      onSuccess?.(response?.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save IPD details')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Section 1: Patient Information */}
      <Section
        title="1. Patient Information"
        icon={<User className="h-4 w-4 text-blue-600" />}
        color="border-blue-500"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            <div>
              <Label htmlFor="patientName">Patient Name</Label>
              <Input
                id="patientName"
                value={formData.patientName}
                onChange={(e) => set('patientName', e.target.value)}
                placeholder="Patient name"
                className="mt-1"
              />
            </div>
            <ReadOnlyField label="Patient ID / Ref" value={leadRef} />
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={0}
                value={formData.age}
                onChange={(e) => set('age', e.target.value)}
                placeholder="Age"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sex">Gender</Label>
              <Input
                id="sex"
                value={formData.sex}
                onChange={(e) => set('sex', e.target.value)}
                placeholder="e.g. Male, Female"
                className="mt-1"
              />
            </div>
          </div>

          {/* Alternate Contact — editable inputs */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alternate Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="alternateContactName">Alternate Contact Name</Label>
                <Input
                  id="alternateContactName"
                  value={formData.alternateContactName}
                  onChange={(e) => set('alternateContactName', e.target.value)}
                  placeholder="Name of alternate contact person"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="alternateContactNumber">Alternate Contact Number</Label>
                <Input
                  id="alternateContactNumber"
                  value={formData.alternateContactNumber}
                  onChange={(e) => set('alternateContactNumber', e.target.value)}
                  placeholder="Phone number"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <div>
              <Label htmlFor="circle">Circle</Label>
              <Input
                id="circle"
                value={formData.circle}
                onChange={(e) => set('circle', e.target.value)}
                placeholder="Circle"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: Treatment & Procedure */}
      <Section
        title="2. Treatment & Procedure Details"
        icon={<Stethoscope className="h-4 w-4 text-purple-600" />}
        color="border-purple-500"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="Category"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="treatment">Treatment Name</Label>
              <Input
                id="treatment"
                value={formData.treatment}
                onChange={(e) => set('treatment', e.target.value)}
                placeholder="Treatment name"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantityGrade">Quantity / Grade</Label>
              <Input
                id="quantityGrade"
                value={formData.quantityGrade}
                onChange={(e) => set('quantityGrade', e.target.value)}
                placeholder="e.g. Grade 1, Quantity 2"
                className="mt-1"
              />
            </div>
            <div>
              <MasterCombobox
                id="anesthesia"
                label="Type of Anaesthesia"
                masterType="anesthesia"
                value={formData.anesthesia}
                onChange={(v) => set('anesthesia', v)}
                placeholder="Search or type anaesthesia type"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: Surgeon Details */}
      <Section
        title="3. Surgeon Details"
        icon={<User className="h-4 w-4 text-teal-600" />}
        color="border-teal-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <MasterCombobox
              id="surgeonName"
              label="Surgeon Name"
              masterType="doctors"
              value={formData.surgeonName}
              onChange={(v) => set('surgeonName', v)}
              placeholder="Search or type surgeon name"
            />
          </div>
          <div>
            <Label htmlFor="surgeonType">Doctor Type</Label>
            <Select value={formData.surgeonType} onValueChange={(v) => set('surgeonType', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select doctor type" />
              </SelectTrigger>
              <SelectContent>
                {DOCTOR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* Section 4: Hospital / Clinic Details */}
      <Section
        title="4. Hospital / Clinic Details"
        icon={<Building2 className="h-4 w-4 text-orange-600" />}
        color="border-orange-500"
      >
        <div className="space-y-4">
          <div>
            <MasterCombobox
              id="hospitalName"
              label="Hospital / Clinic Name"
              masterType="hospitals"
              value={formData.hospitalName}
              onChange={(v) => set('hospitalName', v)}
              placeholder="Search or type hospital name"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hospitalAddress">Address</Label>
              <Input
                id="hospitalAddress"
                value={formData.hospitalAddress}
                onChange={(e) => set('hospitalAddress', e.target.value)}
                placeholder="Full hospital address (optional)"
                className={errors.hospitalAddress ? 'mt-1 border-destructive' : 'mt-1'}
              />
              {errors.hospitalAddress && <p className="text-xs text-destructive mt-1">{errors.hospitalAddress}</p>}
            </div>
            <div>
              <Label htmlFor="googleMapLocation">Google Map Link</Label>
              <Input
                id="googleMapLocation"
                value={formData.googleMapLocation}
                onChange={(e) => set('googleMapLocation', e.target.value)}
                placeholder="Paste Google Maps link (optional)"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Section 5: Payment & Billing Details (New for Cash Flow) */}
      <Section
        title="5. Payment & Billing Details"
        icon={<Wallet className="h-4 w-4 text-green-600" />}
        color="border-green-500"
      >
        <div className="space-y-4">
          {/* Mode of Payment */}
          <div>
            <Label htmlFor="modeOfPayment">Mode of Payment</Label>
            <Select
              value={formData.modeOfPayment}
              onValueChange={(val) => set('modeOfPayment', val)}
            >
              <SelectTrigger className="mt-1 w-full md:w-1/2">
                <SelectValue placeholder="Select Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="EMI">EMI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Common Financial Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="approvedAmount">Approved / Cash Package <span className="text-destructive">*</span></Label>
              <Input
                id="approvedAmount"
                type="number"
                min="0"
                value={formData.approvedAmount}
                onChange={(e) => set('approvedAmount', e.target.value)}
                placeholder="₹ Amount"
                className={`mt-1 ${errors.approvedAmount ? 'border-destructive' : ''}`}
              />
              {errors.approvedAmount && <p className="text-xs text-destructive mt-1">{errors.approvedAmount}</p>}
            </div>
            <div>
              <Label htmlFor="collectedAmount">Cash / Deduction Collected</Label>
              <Input
                id="collectedAmount"
                type="number"
                min="0"
                value={formData.collectedAmount}
                onChange={(e) => set('collectedAmount', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="finalBillAmount">Final Bill Amount <span className="text-destructive">*</span></Label>
              <Input
                id="finalBillAmount"
                type="number"
                min="0"
                value={formData.finalBillAmount}
                onChange={(e) => set('finalBillAmount', e.target.value)}
                placeholder="₹ Amount"
                className={`mt-1 ${errors.finalBillAmount ? 'border-destructive' : ''}`}
              />
              {errors.finalBillAmount && <p className="text-xs text-destructive mt-1">{errors.finalBillAmount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="collectedByMediend">Collected by Mediend (amount)</Label>
              <Input
                id="collectedByMediend"
                type="number"
                min="0"
                value={formData.collectedByMediend}
                onChange={(e) => set('collectedByMediend', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collectedByHospital">Collected by Hospital (amount)</Label>
              <Input
                id="collectedByHospital"
                type="number"
                min="0"
                value={formData.collectedByHospital}
                onChange={(e) => set('collectedByHospital', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="discount">Discount</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                value={formData.discount}
                onChange={(e) => set('discount', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="copay">Copay</Label>
              <Input
                id="copay"
                type="number"
                min="0"
                value={formData.copay}
                onChange={(e) => set('copay', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="deduction">Deduction</Label>
              <Input
                id="deduction"
                type="number"
                min="0"
                value={formData.deduction}
                onChange={(e) => set('deduction', e.target.value)}
                placeholder="₹ Amount"
                className="mt-1"
              />
            </div>
          </div>

          {/* Settled Amount Display */}
          <div className="bg-muted p-3 rounded-md">
             <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Settled (Sum of Package/Approved)</span>
                <span className="font-bold text-lg">₹ {Number(settledAmount || 0).toLocaleString('en-IN')}</span>
             </div>
          </div>

          {/* Conditional EMI Fields */}
          {formData.modeOfPayment === 'EMI' && (
            <div className="border-t pt-4 mt-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-md">
              <p className="text-sm font-semibold mb-3 text-blue-600">EMI Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <Label htmlFor="emiAmount">Overall EMI Amount <span className="text-destructive">*</span></Label>
                    <Input
                      id="emiAmount"
                      type="number"
                      min="0"
                      value={formData.emiAmount}
                      onChange={(e) => set('emiAmount', e.target.value)}
                      placeholder="₹ Amount"
                      className={`mt-1 ${errors.emiAmount ? 'border-destructive' : ''}`}
                    />
                    {errors.emiAmount && <p className="text-xs text-destructive mt-1">{errors.emiAmount}</p>}
                 </div>
                 <div>
                    <Label htmlFor="processingFee">Processing Fee</Label>
                    <Input
                      id="processingFee"
                      type="number"
                      min="0"
                      value={formData.processingFee}
                      onChange={(e) => set('processingFee', e.target.value)}
                      placeholder="₹ Amount"
                      className="mt-1"
                    />
                 </div>
                 <div>
                    <Label htmlFor="gst">GST</Label>
                    <Input
                      id="gst"
                      type="number"
                      min="0"
                      value={formData.gst}
                      onChange={(e) => set('gst', e.target.value)}
                      placeholder="₹ Amount"
                      className="mt-1"
                    />
                 </div>
                 <div>
                    <Label htmlFor="subventionFee">Subvention Fee (PF + GST)</Label>
                    <Input
                      id="subventionFee"
                      type="number"
                      value={formData.subventionFee}
                      readOnly
                      className="mt-1 bg-muted"
                    />
                 </div>
                 <div>
                    <Label htmlFor="finalEmiAmount">Final Amount <span className="text-destructive">*</span></Label>
                    <Input
                      id="finalEmiAmount"
                      type="number"
                      min="0"
                      value={formData.finalEmiAmount}
                      onChange={(e) => set('finalEmiAmount', e.target.value)}
                      placeholder="₹ Amount"
                      className={`mt-1 ${errors.finalEmiAmount ? 'border-destructive' : ''}`}
                    />
                    {errors.finalEmiAmount && <p className="text-xs text-destructive mt-1">{errors.finalEmiAmount}</p>}
                 </div>
              </div>
            </div>
          )}

        </div>
      </Section>

      {/* Section 6: Admission & Surgery Timeline */}
      <Section
        title="6. Admission & Surgery Timeline"
        icon={<Calendar className="h-4 w-4 text-red-600" />}
        color="border-red-500"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Admission</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="admissionDate">
                  Arrival Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admissionDate"
                  type="date"
                  value={formData.admissionDate}
                  onChange={(e) => set('admissionDate', e.target.value)}
                  className={`mt-1 ${errors.admissionDate ? 'border-destructive' : ''}`}
                />
                {errors.admissionDate && <p className="text-xs text-destructive mt-1">{errors.admissionDate}</p>}
              </div>
              <div>
                <Label htmlFor="admissionTime">
                  Arrival Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admissionTime"
                  type="time"
                  value={formData.admissionTime}
                  onChange={(e) => set('admissionTime', e.target.value)}
                  className={`mt-1 ${errors.admissionTime ? 'border-destructive' : ''}`}
                />
                {errors.admissionTime && <p className="text-xs text-destructive mt-1">{errors.admissionTime}</p>}
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Surgery</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="surgeryDate">
                  Surgery Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="surgeryDate"
                  type="date"
                  value={formData.surgeryDate}
                  onChange={(e) => set('surgeryDate', e.target.value)}
                  className={`mt-1 ${errors.surgeryDate ? 'border-destructive' : ''}`}
                />
                {errors.surgeryDate && <p className="text-xs text-destructive mt-1">{errors.surgeryDate}</p>}
              </div>
              <div>
                <Label htmlFor="surgeryTime">
                  Surgery Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="surgeryTime"
                  type="time"
                  value={formData.surgeryTime}
                  onChange={(e) => set('surgeryTime', e.target.value)}
                  className={`mt-1 ${errors.surgeryTime ? 'border-destructive' : ''}`}
                />
                {errors.surgeryTime && <p className="text-xs text-destructive mt-1">{errors.surgeryTime}</p>}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 7: Implants, Instruments & Consumables */}
      <Section
        title="7. Implants, Instruments & Consumables"
        icon={<Package className="h-4 w-4 text-indigo-600" />}
        color="border-indigo-500"
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Implants row */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Implants</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <Input
                id="implantText"
                value={formData.implantText}
                onChange={(e) => set('implantText', e.target.value)}
                placeholder="Implant description"
              />
              <Input
                id="implantAmount"
                value={formData.implantAmount}
                onChange={(e) => set('implantAmount', e.target.value)}
                placeholder="Amount (₹)"
                type="number"
                min="0"
              />
            </div>
          </div>

          {/* Instruments row */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Instruments</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <Input
                id="instrumentText"
                value={formData.instrumentText}
                onChange={(e) => set('instrumentText', e.target.value)}
                placeholder="Instrument description"
              />
              <Input
                id="instrumentAmount"
                value={formData.instrumentAmount}
                onChange={(e) => set('instrumentAmount', e.target.value)}
                placeholder="Amount (₹)"
                type="number"
                min="0"
              />
            </div>
          </div>

          {/* Consumables row */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consumables</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <Input
                id="consumablesText"
                value={formData.consumablesText}
                onChange={(e) => set('consumablesText', e.target.value)}
                placeholder="Consumables description"
              />
              <Input
                id="consumablesAmount"
                value={formData.consumablesAmount}
                onChange={(e) => set('consumablesAmount', e.target.value)}
                placeholder="Amount (₹)"
                type="number"
                min="0"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* BD Info & Notes */}
      <Card className="border-l-4 border-gray-400">
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <ReadOnlyField label="Name of BD" value={bdName} />
            <ReadOnlyField label="BD Manager" value={bdManagerName} />
          </div>
          <div className="border-t pt-3">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any additional information..."
              rows={2}
              className="mt-1 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : (isEditMode ? 'Update Cash Details' : 'Submit for Insurance Review')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Fields marked <span className="text-destructive font-bold">*</span> are required
        </p>
      </div>
    </form>
  )
}
