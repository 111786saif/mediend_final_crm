'use client'

import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Calendar, IndianRupee, Stethoscope, User } from 'lucide-react'
import { toast } from 'sonner'
import { MasterCombobox, type MasterItem } from '@/components/ui/master-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CaseStage, FlowType, LeadOpdPhase } from '@/generated/prisma/enums'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { localDateInputValue, localDateTimeToUtcIso, localTimeInputValue, localTodayInputValue } from '@/lib/local-date-time'
import { normalizeLeadSexValue } from '@/lib/lead-sex'
import { cn } from '@/lib/utils'

const SEX_OPTIONS = ['Male', 'Female', 'Other'] as const
const SURGEON_TYPE_OPTIONS = [
  'Cosmetic',
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
const OPD_MODE_OPTIONS = [
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'ONLINE', label: 'Online' },
] as const
const VALID_OPD_MODES = new Set(OPD_MODE_OPTIONS.map((option) => option.value))
const MAX_PATIENT_AGE = 120

type FormErrors = Partial<Record<
  | 'patientName'
  | 'age'
  | 'sex'
  | 'phoneNumber'
  | 'alternateNumber'
  | 'circle'
  | 'category'
  | 'treatment'
  | 'surgeonName'
  | 'surgeonType'
  | 'hospitalName'
  | 'opdChargeAmount'
  | 'opdMode'
  | 'arrivalDate'
  | 'arrivalTime',
  string
>>

function toDateInputValue(value: string | null | undefined) {
  return localDateInputValue(value)
}

function toTimeInputValue(value: string | null | undefined) {
  return localTimeInputValue(value)
}

function todayInputValue() {
  return localTodayInputValue()
}

function composeScheduleDateTime(date: string, time: string) {
  return date ? localDateTimeToUtcIso(date, time) : null
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeHospitalFieldValue(value: string | null | undefined) {
  const trimmed = value?.trim() || ''
  if (!trimmed) return ''
  const normalized = trimmed.toLowerCase()
  if (normalized === 'not specified' || normalized === 'unknown' || normalized === '—') {
    return ''
  }
  return trimmed
}

function mapOpdModeValue(value: number | null | undefined) {
  return value === 2 ? 'ONLINE' : 'OFFLINE'
}

function mapOpdModeToPayload(value: string) {
  return value === 'ONLINE' ? 2 : 1
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeIndianPhone(value: string) {
  const digits = digitsOnly(value)
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return null
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime())
}

function isValidTimeInput(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10))
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children} <span className="text-current">*</span>
    </Label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export interface OPDScheduleFormProps {
  leadId: string
  opdAppointmentId?: string | null
  opdPhase?: LeadOpdPhase
  hideContactFields?: boolean
  leadRef: string
  currentCaseStage?: CaseStage | null
  flowType?: FlowType | null
  currentStatus?: string | null
  patientName?: string | null
  age?: number | null
  sex?: string | null
  phoneNumber?: string | null
  alternateNumber?: string | null
  circle?: string | null
  city?: string | null
  area?: string | null
  category?: string | null
  treatment?: string | null
  quantityGrade?: string | null
  surgeonName?: string | null
  surgeonType?: string | null
  hospitalName?: string | null
  opdHospital?: string | null
  opdDrName?: string | null
  opdCharges?: number | null
  opdScheduleDate?: string | null
  opdMeeting?: number | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function OPDScheduleForm({
  leadId,
  opdAppointmentId = null,
  opdPhase = LeadOpdPhase.PRE,
  hideContactFields = false,
  leadRef,
  currentCaseStage,
  flowType,
  currentStatus,
  patientName = '',
  age,
  sex,
  phoneNumber = '',
  alternateNumber = '',
  circle = '',
  city = '',
  area = '',
  category = '',
  treatment = '',
  quantityGrade = '',
  surgeonName = '',
  surgeonType = '',
  hospitalName = '',
  opdHospital = '',
  opdDrName = '',
  opdCharges,
  opdScheduleDate,
  opdMeeting,
  onSuccess,
  onCancel,
}: OPDScheduleFormProps) {
  const initialHospitalName =
    normalizeHospitalFieldValue(opdHospital) || normalizeHospitalFieldValue(hospitalName)
  const initialDoctorName = opdDrName?.trim() || surgeonName?.trim() || ''
  const initialScheduleDate = opdScheduleDate || null

  const [formData, setFormData] = useState({
    patientName: patientName?.trim() || '',
    age: age != null && age > 0 ? String(age) : '',
    sex: normalizeLeadSexValue(sex),
    phoneNumber: phoneNumber?.trim() || '',
    alternateNumber: alternateNumber?.trim() || '',
    circle: circle?.trim() || '',
    city: city?.trim() || '',
    category: category?.trim() || '',
    treatment: treatment?.trim() || '',
    quantityGrade: quantityGrade?.trim() || '',
    surgeonName: initialDoctorName,
    surgeonType: surgeonType?.trim() || '',
    hospitalName: initialHospitalName,
    hospitalLocation: area?.trim() || city?.trim() || '',
    hospitalAddress: '',
    googleMapLocation: '',
    opdChargeAmount:
      typeof opdCharges === 'number' && opdCharges > 0 ? String(opdCharges) : '',
    opdMode: mapOpdModeValue(opdMeeting),
    arrivalDate: toDateInputValue(initialScheduleDate) || todayInputValue(),
    arrivalTime: toTimeInputValue(initialScheduleDate),
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const opdId = useMemo(() => `OPD-${leadRef}`, [leadRef])
  const initialNormalizedSex = useMemo(() => normalizeLeadSexValue(sex), [sex])
  const initialAgeValue = age != null && age > 0 ? String(age) : ''
  const initialScheduleDateValue = toDateInputValue(initialScheduleDate) || todayInputValue()
  const initialScheduleTimeValue = toTimeInputValue(initialScheduleDate)
  const initialOpdMode = mapOpdModeValue(opdMeeting)
  const initialChargeValue =
    typeof opdCharges === 'number' && opdCharges > 0 ? String(opdCharges) : ''

  const { data: hospitalSearchResult } = useQuery({
    queryKey: ['opd-form-hospital-master', formData.hospitalName],
    queryFn: () =>
      apiGet<{ items: MasterItem[] }>(
        `/api/masters/hospitals?search=${encodeURIComponent(formData.hospitalName.trim())}`
      ),
    enabled: formData.hospitalName.trim().length > 1,
    staleTime: 30_000,
  })

  const matchedHospital = useMemo(
    () =>
      hospitalSearchResult?.items?.find(
        (item) => item.name.trim().toLowerCase() === formData.hospitalName.trim().toLowerCase()
      ) ?? null,
    [formData.hospitalName, hospitalSearchResult]
  )

  function setField<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) {
    setFormData((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key as keyof FormErrors]) return current
      const next = { ...current }
      delete next[key as keyof FormErrors]
      return next
    })
  }

  function handleHospitalChange(value: string) {
    setFormData((current) => {
      const nextHospitalName = value
      const hospitalNameChanged = nextHospitalName.trim() !== current.hospitalName.trim()

      if (!hospitalNameChanged) {
        return {
          ...current,
          hospitalName: nextHospitalName,
        }
      }

      return {
        ...current,
        hospitalName: nextHospitalName,
        hospitalLocation: '',
        hospitalAddress: '',
        googleMapLocation: '',
      }
    })

    setErrors((current) => {
      if (!current.hospitalName) return current
      const next = { ...current }
      delete next.hospitalName
      return next
    })
  }

  function handleHospitalSelect(item: MasterItem) {
    setFormData((current) => ({
      ...current,
      hospitalName: item.name,
      hospitalLocation: '',
      hospitalAddress: item.address || '',
      googleMapLocation: item.googleMapLink || '',
    }))
    setErrors((current) => {
      if (!current.hospitalName) return current
      const next = { ...current }
      delete next.hospitalName
      return next
    })
  }

  function handleDoctorSelect(item: MasterItem) {
    setFormData((current) => ({
      ...current,
      surgeonName: item.name,
      surgeonType: current.surgeonType || item.category || '',
    }))
    setErrors((current) => {
      if (!current.surgeonName && !current.surgeonType) return current
      const next = { ...current }
      delete next.surgeonName
      delete next.surgeonType
      return next
    })
  }

  function handleCategoryChange(value: string) {
    setFormData((current) => {
      const nextCategory = value.trim()
      const categoryChanged =
        nextCategory.toLowerCase() !== current.category.trim().toLowerCase()

      return {
        ...current,
        category: value,
        treatment: categoryChanged ? '' : current.treatment,
      }
    })

    setErrors((current) => {
      if (!current.category && !current.treatment) return current
      const next = { ...current }
      delete next.category
      delete next.treatment
      return next
    })
  }

  function handleCategorySelect(item: MasterItem) {
    handleCategoryChange(item.name)
  }

  function handleTreatmentSelect(item: MasterItem) {
    setFormData((current) => ({
      ...current,
      treatment: item.name,
      category: current.category.trim() || item.category?.trim() || '',
    }))

    setErrors((current) => {
      if (!current.category && !current.treatment) return current
      const next = { ...current }
      delete next.category
      delete next.treatment
      return next
    })
  }

  function validateForm() {
    const nextErrors: FormErrors = {}
    const trimmedPatientName = formData.patientName.trim()
    const trimmedAge = formData.age.trim()
    const trimmedSex = formData.sex.trim()
    const trimmedCircle = formData.circle.trim()
    const trimmedCategory = formData.category.trim()
    const trimmedTreatment = formData.treatment.trim()
    const trimmedDoctor = formData.surgeonName.trim()
    const trimmedSurgeonType = formData.surgeonType.trim()
    const trimmedHospital = formData.hospitalName.trim()
    const trimmedCharge = formData.opdChargeAmount.trim()

    if (!trimmedPatientName) {
      nextErrors.patientName = 'Patient name is required'
    }

    if (!trimmedAge) {
      nextErrors.age = 'Age is required'
    } else if (!/^\d+$/.test(trimmedAge)) {
      nextErrors.age = 'Age must be a whole number'
    } else {
      const parsedAge = Number.parseInt(trimmedAge, 10)
      if (parsedAge <= 0 || parsedAge > MAX_PATIENT_AGE) {
        nextErrors.age = `Age must be between 1 and ${MAX_PATIENT_AGE}`
      }
    }

    const normalizedSex = normalizeLeadSexValue(trimmedSex)
    if (!normalizedSex) {
      nextErrors.sex = 'Sex is required'
    }

    if (!trimmedCircle) {
      nextErrors.circle = 'Circle is required'
    }

    if (!trimmedCategory) {
      nextErrors.category = 'Category is required'
    }

    if (!trimmedTreatment) {
      nextErrors.treatment = 'Treatment is required'
    }

    if (!trimmedDoctor) {
      nextErrors.surgeonName = 'Surgeon name is required'
    }

    if (!trimmedSurgeonType) {
      nextErrors.surgeonType = 'Surgeon type is required'
    }

    if (!trimmedHospital) {
      nextErrors.hospitalName = 'Hospital / clinic name is required'
    }

    if (trimmedCharge) {
      if (!/^\d+$/.test(trimmedCharge)) {
        nextErrors.opdChargeAmount = 'OPD charge must be a whole number'
      } else if (Number.parseInt(trimmedCharge, 10) < 0) {
        nextErrors.opdChargeAmount = 'OPD charge must be zero or more'
      }
    }

    if (!VALID_OPD_MODES.has(formData.opdMode as (typeof OPD_MODE_OPTIONS)[number]['value'])) {
      nextErrors.opdMode = 'OPD mode is required'
    }

    if (!formData.arrivalDate) {
      nextErrors.arrivalDate = 'Arrival date is required'
    } else if (!isValidDateInput(formData.arrivalDate)) {
      nextErrors.arrivalDate = 'Arrival date must be valid'
    }

    if (!formData.arrivalTime) {
      nextErrors.arrivalTime = 'Arrival time is required'
    } else if (!isValidTimeInput(formData.arrivalTime)) {
      nextErrors.arrivalTime = 'Arrival time must be valid'
    }

    return nextErrors
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error(Object.values(validationErrors)[0] ?? 'Please fill all required fields')
      return
    }
    setErrors({})

    const trimmedPatientName = formData.patientName.trim()
    const trimmedSex = formData.sex.trim()
    const trimmedHospital = formData.hospitalName.trim()
    const trimmedDoctor = formData.surgeonName.trim()

    const parsedAge =
      formData.age.trim().length > 0 ? Number.parseInt(formData.age.trim(), 10) : null

    const parsedCharge =
      formData.opdChargeAmount.trim().length > 0
        ? Number.parseInt(formData.opdChargeAmount.trim(), 10)
        : 0

    const scheduleDateTime = composeScheduleDateTime(formData.arrivalDate, formData.arrivalTime)
    const leadPayload: Record<string, string | number | null> = {}
    const shouldSyncPrimaryLeadFields = opdAppointmentId === 'legacy'

    if (trimmedPatientName !== (patientName?.trim() || '')) {
      leadPayload.patientName = trimmedPatientName
    }

    if (formData.age.trim() !== initialAgeValue && parsedAge !== null) {
      leadPayload.age = parsedAge
    }

    const normalizedSex = normalizeLeadSexValue(trimmedSex)
    if (normalizedSex !== initialNormalizedSex) {
      leadPayload.sex = normalizedSex || ''
    }

    if (formData.circle.trim() !== (circle?.trim() || '')) {
      leadPayload.circle = formData.circle.trim() || null
    }

    if (formData.category.trim() !== (category?.trim() || '')) {
      leadPayload.category = formData.category.trim() || null
    }

    if (formData.treatment.trim() !== (treatment?.trim() || '')) {
      leadPayload.treatment = formData.treatment.trim() || null
    }

    if (formData.quantityGrade.trim() !== (quantityGrade?.trim() || '')) {
      leadPayload.quantityGrade = formData.quantityGrade.trim() || null
    }

    if (trimmedDoctor !== initialDoctorName && shouldSyncPrimaryLeadFields) {
      leadPayload.surgeonName = trimmedDoctor
    }

    if (formData.surgeonType.trim() !== (surgeonType?.trim() || '')) {
      leadPayload.surgeonType = formData.surgeonType.trim() || null
    }

    if (trimmedHospital !== initialHospitalName && shouldSyncPrimaryLeadFields) {
      leadPayload.hospitalName = trimmedHospital
    }

    const opdPayload: Record<string, string | number | null> = {
      opdHospital: trimmedHospital,
      opdDrName: trimmedDoctor,
      opdCharges: parsedCharge,
      opdScheduleDate: scheduleDateTime,
      opdMeeting: mapOpdModeToPayload(formData.opdMode),
    }

    if (
      formData.opdChargeAmount.trim() === initialChargeValue &&
      formData.arrivalDate === initialScheduleDateValue &&
      formData.arrivalTime === initialScheduleTimeValue &&
      formData.opdMode === initialOpdMode &&
      trimmedDoctor === initialDoctorName &&
      trimmedHospital === initialHospitalName &&
      Object.keys(leadPayload).length === 0
    ) {
      toast.error('No OPD changes to save')
      return
    }

    setSubmitting(true)
    try {
      if (Object.keys(leadPayload).length > 0) {
        await apiPatch(`/api/leads/${leadId}`, leadPayload)
      }

      if (opdAppointmentId) {
        await apiPatch(`/api/leads/${leadId}/opds/${opdAppointmentId}`, opdPayload)
      } else {
        await apiPost(`/api/leads/${leadId}/opds`, {
          phase: opdPhase,
          ...opdPayload,
        })
      }

      toast.success('OPD form saved successfully')
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save OPD form')
    } finally {
      setSubmitting(false)
    }
  }

  const resolvedHospitalAddress = formData.hospitalAddress || matchedHospital?.address || ''
  const resolvedGoogleMapLocation =
    formData.googleMapLocation || matchedHospital?.googleMapLink || ''

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-sky-600" />
            <span>Update OPD Details</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Fields marked <span className="font-bold text-current">*</span> are required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-sky-600" />
            Patient Details
          </div>

          <div>
            <Label htmlFor="opd-id">OPD ID</Label>
            <Input id="opd-id" value={opdId} disabled className="mt-1" />
          </div>
          <div>
            <RequiredLabel htmlFor="opd-patient-name">Patient name</RequiredLabel>
            <Input
              id="opd-patient-name"
              value={formData.patientName}
              onChange={(event) => setField('patientName', event.target.value)}
              className={cn('mt-1', errors.patientName && 'border-destructive')}
            />
            <FieldError message={errors.patientName} />
          </div>
          <div>
            <RequiredLabel htmlFor="opd-age">Age</RequiredLabel>
            <Input
              id="opd-age"
              type="number"
              min={1}
              max={MAX_PATIENT_AGE}
              value={formData.age}
              onChange={(event) => setField('age', event.target.value)}
              className={cn('mt-1', errors.age && 'border-destructive')}
            />
            <FieldError message={errors.age} />
          </div>
          <div>
            <RequiredLabel htmlFor="opd-sex">Sex</RequiredLabel>
            <Select
              value={formData.sex || '__none__'}
              onValueChange={(value) => setField('sex', value === '__none__' ? '' : value)}
            >
              <SelectTrigger
                id="opd-sex"
                className={cn('mt-1', errors.sex && 'border-destructive')}
              >
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select sex</SelectItem>
                {SEX_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.sex} />
          </div>
          {!hideContactFields ? (
            <>
              <div>
                <Label htmlFor="opd-phone">Patient number</Label>
                <Input
                  id="opd-phone"
                  value={formData.phoneNumber}
                  className="mt-1"
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="opd-alt-phone">Alternative number</Label>
                <Input
                  id="opd-alt-phone"
                  value={formData.alternateNumber}
                  className="mt-1"
                  disabled
                />
              </div>
            </>
          ) : null}
          <div>
            <RequiredLabel htmlFor="opd-circle">Circle</RequiredLabel>
            <Input
              id="opd-circle"
              value={formData.circle}
              onChange={(event) => setField('circle', event.target.value)}
              className={cn('mt-1', errors.circle && 'border-destructive')}
            />
            <FieldError message={errors.circle} />
          </div>
          <div>
            <Label htmlFor="opd-city">City</Label>
            <Input
              id="opd-city"
              value={formData.city}
              onChange={(event) => setField('city', event.target.value)}
              className="mt-1"
              disabled
            />
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <Stethoscope className="h-4 w-4 text-violet-600" />
            Treatment Details
          </div>

          <MasterCombobox
            id="opd-category"
            label="Category"
            masterType="treatment-categories"
            value={formData.category}
            onChange={handleCategoryChange}
            onItemSelect={handleCategorySelect}
            placeholder="Search treatment category..."
            required
            error={errors.category}
            allowFreeText={false}
          />
          <MasterCombobox
            id="opd-treatment"
            label="Treatment"
            masterType="treatments"
            value={formData.treatment}
            onChange={(value) => setField('treatment', value)}
            onItemSelect={handleTreatmentSelect}
            queryParams={{ category: formData.category }}
            placeholder="Search treatment..."
            required
            error={errors.treatment}
            allowFreeText={false}
          />
          <div className="md:col-span-2">
            <Label htmlFor="opd-quantity-grade">Quantity / Grade</Label>
            <Input
              id="opd-quantity-grade"
              value={formData.quantityGrade}
              onChange={(event) => setField('quantityGrade', event.target.value)}
              className="mt-1"
            />
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-emerald-600" />
            Surgeon Details
          </div>

          <MasterCombobox
            id="opd-surgeon-name"
            label="Surgeon name"
            masterType="doctors"
            value={formData.surgeonName}
            onChange={(value) => setField('surgeonName', value)}
            onItemSelect={handleDoctorSelect}
            queryParams={{ availabilityDate: formData.arrivalDate, appointmentType: 'opd' }}
            required
            error={errors.surgeonName}
            allowFreeText
          />
          <div>
            <RequiredLabel htmlFor="opd-surgeon-type">Surgeon type</RequiredLabel>
            <Select
              value={formData.surgeonType || '__none__'}
              onValueChange={(value) => setField('surgeonType', value === '__none__' ? '' : value)}
            >
              <SelectTrigger
                id="opd-surgeon-type"
                className={cn('mt-1', errors.surgeonType && 'border-destructive')}
              >
                <SelectValue placeholder="Select surgeon type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select surgeon type</SelectItem>
                {SURGEON_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.surgeonType} />
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-amber-600" />
            Hospital Details
          </div>

          <div className="md:col-span-2">
            <MasterCombobox
              id="opd-hospital-name"
              label="Hospital / clinic name"
              masterType="hospitals"
              value={formData.hospitalName}
              onChange={handleHospitalChange}
              onItemSelect={handleHospitalSelect}
              required
              error={errors.hospitalName}
              allowFreeText
            />
          </div>
          <div>
            <Label htmlFor="opd-hospital-location">Location</Label>
            <Input
              id="opd-hospital-location"
              value={formData.hospitalLocation}
              onChange={(event) => setField('hospitalLocation', event.target.value)}
              className="mt-1"
              disabled
            />
          </div>
          <div>
            <Label htmlFor="opd-hospital-address">Address</Label>
            <Input
              id="opd-hospital-address"
              value={resolvedHospitalAddress}
              onChange={(event) => setField('hospitalAddress', event.target.value)}
              className="mt-1"
              disabled
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="opd-google-map">Google location</Label>
            <Input
              id="opd-google-map"
              value={resolvedGoogleMapLocation}
              onChange={(event) => setField('googleMapLocation', event.target.value)}
              className="mt-1"
              disabled
            />
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <IndianRupee className="h-4 w-4 text-rose-600" />
            OPD Charges
          </div>

          <div>
            <Label htmlFor="opd-charge-amount">Amount (₹)</Label>
            <Input
              id="opd-charge-amount"
              type="number"
              min={0}
              value={formData.opdChargeAmount}
              onChange={(event) => setField('opdChargeAmount', event.target.value)}
              className={cn('mt-1', errors.opdChargeAmount && 'border-destructive')}
            />
            <FieldError message={errors.opdChargeAmount} />
          </div>
          <div>
            <RequiredLabel htmlFor="opd-mode">Type</RequiredLabel>
            <Select value={formData.opdMode} onValueChange={(value) => setField('opdMode', value)}>
              <SelectTrigger
                id="opd-mode"
                className={cn('mt-1', errors.opdMode && 'border-destructive')}
              >
                <SelectValue placeholder="Select OPD mode" />
              </SelectTrigger>
              <SelectContent>
                {OPD_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.opdMode} />
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-cyan-600" />
            Timings
          </div>

          <div>
            <RequiredLabel htmlFor="opd-arrival-date">Arrival date</RequiredLabel>
            <Input
              id="opd-arrival-date"
              type="date"
              value={formData.arrivalDate}
              onChange={(event) => setField('arrivalDate', event.target.value)}
              className={cn('mt-1', errors.arrivalDate && 'border-destructive')}
            />
            <FieldError message={errors.arrivalDate} />
          </div>
          <div>
            <RequiredLabel htmlFor="opd-arrival-time">Arrival time</RequiredLabel>
            <Input
              id="opd-arrival-time"
              type="time"
              value={formData.arrivalTime}
              onChange={(event) => setField('arrivalTime', event.target.value)}
              className={cn('mt-1', errors.arrivalTime && 'border-destructive')}
            />
            <FieldError message={errors.arrivalTime} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Hospital address, location, and map link are autofilled from the hospital master when available.
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save OPD form'}
        </Button>
      </div>
    </form>
  )
}
