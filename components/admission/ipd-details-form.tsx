'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { User, MapPin, Stethoscope, Building2, Shield, Calendar, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { MasterCombobox } from '@/components/ui/master-combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

export interface IPDDetailsFormProps {
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
  // Insurance & Billing (from KYP/PreAuth)
  insuranceName?: string
  insuranceType?: string
  tpa?: string
  sumInsured?: string | number
  copay?: string | number
  capping?: string | number
  roomType?: string
  roomRent?: string | number
  // BD info
  bdName?: string
  bdManagerName?: string
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

export function IPDDetailsForm({
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
  insuranceName = '',
  insuranceType = '',
  tpa: tpaProp = '',
  sumInsured,
  copay,
  capping,
  roomType = '',
  roomRent,
  bdName = '',
  bdManagerName = '',
  onSuccess,
  onCancel,
}: IPDDetailsFormProps) {
  const [formData, setFormData] = useState({
    // Patient info (prefilled, editable)
    patientName: patientName,
    leadRef: leadRef,
    age: age != null ? String(age) : '',
    sex: sex,
    circle: circle,
    // Alternate contact (editable)
    alternateContactName: attendantName,
    alternateContactNumber: alternateNumber,
    // Treatment (prefilled, editable)
    treatment: treatment,
    quantityGrade: quantityGrade,
    anesthesia: anesthesia,
    // Surgeon (prefilled, editable)
    surgeonName: surgeonName,
    surgeonType: surgeonType,
    // Hospital (prefilled, editable)
    hospitalName: hospitalName,
    hospitalAddress: '',
    googleMapLocation: '',
    // Insurance (prefilled, editable)
    insuranceType: insuranceType,
    insuranceName: insuranceName,
    copay: copay != null ? String(copay) : '',
    sumInsured: sumInsured != null ? String(sumInsured) : '',
    roomType: roomType,
    capping: capping != null ? String(capping) : '',
    tpa: tpaProp,
    // BD info (prefilled, editable)
    bdName: bdName,
    bdManagerName: bdManagerName,
    // Admission & Surgery timeline
    admissionDate: '',
    admissionTime: '',
    surgeryDate: '',
    surgeryTime: '',
    // Implants & Consumables
    implantText: '',
    implantAmount: '',
    instrumentText: '',
    instrumentAmount: '',
    consumablesText: '',
    consumablesAmount: '',
    notes: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.admissionDate) e.admissionDate = 'Required'
    if (!formData.admissionTime.trim()) e.admissionTime = 'Required'
    if (!formData.surgeryDate) e.surgeryDate = 'Required'
    if (!formData.surgeryTime.trim()) e.surgeryTime = 'Required'
    const tpaVal = (formData.tpa ?? '').toString().trim()
    if (!tpaVal) e.tpa = 'Required'
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
      // Combine implant/instrument/consumables into legacy fields
      const implantConsumables = [
        formData.implantText && `Implants: ${formData.implantText}${formData.implantAmount ? ` (₹${formData.implantAmount})` : ''}`,
        formData.consumablesText && `Consumables: ${formData.consumablesText}${formData.consumablesAmount ? ` (₹${formData.consumablesAmount})` : ''}`,
      ].filter(Boolean).join('\n') || undefined

      const instrument = [
        formData.instrumentText && `Instruments: ${formData.instrumentText}${formData.instrumentAmount ? ` (₹${formData.instrumentAmount})` : ''}`,
      ].filter(Boolean).join('\n') || undefined

      const response = await apiPost<{ id: string }>(`/api/leads/${leadId}/initiate`, {
        admissionDate: formData.admissionDate,
        admissionTime: formData.admissionTime.trim(),
        admittingHospital: formData.hospitalName.trim() || undefined,
        hospitalAddress: formData.hospitalAddress.trim() || 'N/A',
        googleMapLocation: formData.googleMapLocation.trim() || undefined,
        surgeryDate: formData.surgeryDate,
        surgeryTime: formData.surgeryTime.trim(),
        tpa: formData.tpa.toString().trim(),
        instrument,
        implantConsumables,
        notes: formData.notes.trim() || undefined,
        quantityGrade: formData.quantityGrade.trim() || undefined,
        anesthesia: formData.anesthesia.trim() || undefined,
        surgeonName: formData.surgeonName.trim() || undefined,
        surgeonType: formData.surgeonType.trim() || undefined,
        alternateContactName: formData.alternateContactName.trim() || undefined,
        alternateContactNumber: formData.alternateContactNumber.trim() || undefined,
        patientName: formData.patientName.trim() || undefined,
        insuranceName: formData.insuranceName.trim() || undefined,
        insuranceType: formData.insuranceType.trim() || undefined,
        copay: formData.copay.trim() || undefined,
        sumInsured: formData.sumInsured.trim() || undefined,
        roomType: formData.roomType.trim() || undefined,
        capping: formData.capping.trim() || undefined,
        bdName: formData.bdName.trim() || undefined,
        bdManagerName: formData.bdManagerName.trim() || undefined,
        age: formData.age.trim() || undefined,
        sex: formData.sex.trim() || undefined,
      })
      toast.success('IPD details saved successfully')
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="patientName">Patient Name</Label>
              <Input id="patientName" value={formData.patientName} onChange={(e) => set('patientName', e.target.value)} placeholder="Patient name" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="leadRef">Patient ID / Ref</Label>
              <Input id="leadRef" value={formData.leadRef} onChange={(e) => set('leadRef', e.target.value)} placeholder="Patient ID" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" value={formData.age} onChange={(e) => set('age', e.target.value)} placeholder="Age" className="mt-1" type="number" />
            </div>
            <div>
              <Label htmlFor="sex">Gender</Label>
              <Input id="sex" value={formData.sex} onChange={(e) => set('sex', e.target.value)} placeholder="Gender" className="mt-1" />
            </div>
          </div>

          {/* Alternate Contact */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alternate Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="alternateContactName">Alternate Contact Name</Label>
                <Input id="alternateContactName" value={formData.alternateContactName} onChange={(e) => set('alternateContactName', e.target.value)} placeholder="Name of alternate contact person" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="alternateContactNumber">Alternate Contact Number</Label>
                <Input id="alternateContactNumber" value={formData.alternateContactNumber} onChange={(e) => set('alternateContactNumber', e.target.value)} placeholder="Phone number" className="mt-1" />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <div>
              <Label htmlFor="circle">Circle</Label>
              <Input id="circle" value={formData.circle} onChange={(e) => set('circle', e.target.value)} placeholder="Circle" className="mt-1" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="treatment">Treatment Name</Label>
              <Input id="treatment" value={formData.treatment} onChange={(e) => set('treatment', e.target.value)} placeholder="Treatment name" className="mt-1" />
            </div>
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

      {/* Section 3: Surgeon Details — Auto-fetched */}
      <Section
        title="3. Surgeon Details"
        icon={<User className="h-4 w-4 text-teal-600" />}
        color="border-teal-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="surgeonName">Surgeon Name</Label>
            <Input id="surgeonName" value={formData.surgeonName} onChange={(e) => set('surgeonName', e.target.value)} placeholder="Surgeon name" className="mt-1" />
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
              onItemSelect={(item) => {
                if (item.address && !formData.hospitalAddress) set('hospitalAddress', item.address)
                if (item.googleMapLink && !formData.googleMapLocation) set('googleMapLocation', item.googleMapLink)
              }}
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

      {/* Section 5: Insurance & Billing — Auto-fetched */}
      <Section
        title="5. Insurance & Billing Details"
        icon={<Shield className="h-4 w-4 text-green-600" />}
        color="border-green-500"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="insuranceType">Insurance Type</Label>
              <Input id="insuranceType" value={formData.insuranceType} onChange={(e) => set('insuranceType', e.target.value)} placeholder="Insurance type" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="insuranceName">Insurance Company</Label>
              <Input id="insuranceName" value={formData.insuranceName} onChange={(e) => set('insuranceName', e.target.value)} placeholder="Insurance company name" className="mt-1" />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Financial Details</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="copay">Co-pay %</Label>
                <Input id="copay" value={formData.copay} onChange={(e) => set('copay', e.target.value)} placeholder="Co-pay %" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="sumInsured">Sum Insured</Label>
                <Input id="sumInsured" value={formData.sumInsured} onChange={(e) => set('sumInsured', e.target.value)} placeholder="Sum insured (₹)" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="roomType">Room Type</Label>
                <Input id="roomType" value={formData.roomType} onChange={(e) => set('roomType', e.target.value)} placeholder="Room type" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="capping">Capping</Label>
                <Input id="capping" value={formData.capping} onChange={(e) => set('capping', e.target.value)} placeholder="Capping amount" className="mt-1" />
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <div>
              <Label htmlFor="tpa">TPA Name <span className="text-destructive">*</span></Label>
              <Input id="tpa" value={formData.tpa} onChange={(e) => set('tpa', e.target.value)} placeholder="TPA name" className={`mt-1 ${errors.tpa ? 'border-destructive' : ''}`} />
              {errors.tpa && <p className="text-xs text-destructive mt-1">{errors.tpa}</p>}
            </div>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bdName">Name of BD</Label>
              <Input id="bdName" value={formData.bdName} onChange={(e) => set('bdName', e.target.value)} placeholder="BD name" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bdManagerName">BD Manager</Label>
              <Input id="bdManagerName" value={formData.bdManagerName} onChange={(e) => set('bdManagerName', e.target.value)} placeholder="BD manager name" className="mt-1" />
            </div>
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
            {submitting ? 'Saving...' : 'Save IPD Details & Mark Scheduled'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Fields marked <span className="text-destructive font-bold">*</span> are required
        </p>
      </div>
    </form>
  )
}
