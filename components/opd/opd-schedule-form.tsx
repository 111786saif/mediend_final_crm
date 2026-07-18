'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Calendar, IndianRupee, Stethoscope, User } from 'lucide-react'
import { toast } from 'sonner'
import { MasterCombobox, type MasterItem } from '@/components/ui/master-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiGet, apiPatch } from '@/lib/api-client'
import { normalizeLeadSexValue } from '@/lib/lead-sex'

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

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function toTimeInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toTimeString().slice(0, 5)
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function composeScheduleDateTime(date: string, time: string) {
  if (!date) return null
  return `${date}T${time || '00:00'}:00`
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function mapOpdModeValue(value: number | null | undefined) {
  return value === 2 ? 'ONLINE' : 'OFFLINE'
}

function mapOpdModeToPayload(value: string) {
  return value === 'ONLINE' ? 2 : 1
}

export interface OPDScheduleFormProps {
  leadId: string
  leadRef: string
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
  leadRef,
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
  const initialHospitalName = opdHospital?.trim() || hospitalName?.trim() || ''
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
  }

  function handleHospitalSelect(item: MasterItem) {
    setFormData((current) => ({
      ...current,
      hospitalName: item.name,
      hospitalAddress: item.address || current.hospitalAddress,
      googleMapLocation: item.googleMapLink || current.googleMapLocation,
    }))
  }

  function handleDoctorSelect(item: MasterItem) {
    setFormData((current) => ({
      ...current,
      surgeonName: item.name,
      surgeonType: current.surgeonType || item.category || '',
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const trimmedPatientName = formData.patientName.trim()
    const trimmedSex = formData.sex.trim()
    const trimmedPhone = formData.phoneNumber.trim()
    const trimmedHospital = formData.hospitalName.trim()
    const trimmedDoctor = formData.surgeonName.trim()

    if (!trimmedPatientName) {
      toast.error('Patient name is required')
      return
    }

    if (!formData.arrivalDate) {
      toast.error('Arrival date is required')
      return
    }

    if (!formData.arrivalTime) {
      toast.error('Arrival time is required')
      return
    }

    if (!trimmedHospital) {
      toast.error('Hospital / clinic name is required')
      return
    }

    if (!trimmedDoctor) {
      toast.error('Surgeon name is required')
      return
    }

    if (trimmedSex && !normalizeLeadSexValue(trimmedSex)) {
      toast.error('Sex must be Male, Female, or Other')
      return
    }

    const parsedAge =
      formData.age.trim().length > 0 ? Number.parseInt(formData.age.trim(), 10) : null
    if (formData.age.trim().length > 0 && (!Number.isFinite(parsedAge) || parsedAge < 0)) {
      toast.error('Age must be a valid number')
      return
    }

    const parsedCharge =
      formData.opdChargeAmount.trim().length > 0
        ? Number.parseInt(formData.opdChargeAmount.trim(), 10)
        : 0
    if (!Number.isFinite(parsedCharge) || parsedCharge < 0) {
      toast.error('OPD charge must be a valid amount')
      return
    }

    const scheduleDateTime = composeScheduleDateTime(formData.arrivalDate, formData.arrivalTime)
    const nextStatus = 'OPD Schedule'
    const statusNeedsUpdate = normalizeStatus(currentStatus) !== normalizeStatus(nextStatus)

    const payload: Record<string, string | number | null> = {}

    if (trimmedPatientName !== (patientName?.trim() || '')) {
      payload.patientName = trimmedPatientName
    }

    if (trimmedPhone !== (phoneNumber?.trim() || '')) {
      payload.phoneNumber = trimmedPhone || null
    }

    if (formData.alternateNumber.trim() !== (alternateNumber?.trim() || '')) {
      payload.alternateNumber = formData.alternateNumber.trim() || null
    }

    if (formData.age.trim() !== initialAgeValue && parsedAge !== null) {
      payload.age = parsedAge
    }

    const normalizedSex = normalizeLeadSexValue(trimmedSex)
    if (normalizedSex !== initialNormalizedSex) {
      payload.sex = normalizedSex || ''
    }

    if (formData.circle.trim() !== (circle?.trim() || '')) {
      payload.circle = formData.circle.trim() || null
    }

    if (formData.category.trim() !== (category?.trim() || '')) {
      payload.category = formData.category.trim() || null
    }

    if (formData.treatment.trim() !== (treatment?.trim() || '')) {
      payload.treatment = formData.treatment.trim() || null
    }

    if (formData.quantityGrade.trim() !== (quantityGrade?.trim() || '')) {
      payload.quantityGrade = formData.quantityGrade.trim() || null
    }

    if (trimmedDoctor !== initialDoctorName) {
      payload.surgeonName = trimmedDoctor
      payload.opdDrName = trimmedDoctor
    }

    if (formData.surgeonType.trim() !== (surgeonType?.trim() || '')) {
      payload.surgeonType = formData.surgeonType.trim() || null
    }

    if (trimmedHospital !== initialHospitalName) {
      payload.hospitalName = trimmedHospital
      payload.opdHospital = trimmedHospital
    }

    if (formData.opdChargeAmount.trim() !== initialChargeValue) {
      payload.opdCharges = parsedCharge
    }

    if (
      formData.arrivalDate !== initialScheduleDateValue ||
      formData.arrivalTime !== initialScheduleTimeValue
    ) {
      payload.opdScheduleDate = scheduleDateTime
    }

    if (formData.opdMode !== initialOpdMode) {
      payload.opdMeeting = mapOpdModeToPayload(formData.opdMode)
    }

    if (statusNeedsUpdate) {
      payload.status = nextStatus
      payload.requireStatusChangeRemark = 'true'
      payload.statusChangeRemark = [
        'OPD scheduled',
        `${trimmedHospital}`,
        `for ${formData.arrivalDate}${formData.arrivalTime ? ` ${formData.arrivalTime}` : ''}`,
      ].join(' ')
    }

    if (Object.keys(payload).length === 0) {
      toast.error('No OPD changes to save')
      return
    }

    setSubmitting(true)
    try {
      await apiPatch(`/api/leads/${leadId}`, payload)
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
            <Label htmlFor="opd-patient-name">Patient name</Label>
            <Input
              id="opd-patient-name"
              value={formData.patientName}
              onChange={(event) => setField('patientName', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-age">Age</Label>
            <Input
              id="opd-age"
              type="number"
              min={0}
              value={formData.age}
              onChange={(event) => setField('age', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-sex">Sex</Label>
            <Select
              value={formData.sex || '__none__'}
              onValueChange={(value) => setField('sex', value === '__none__' ? '' : value)}
            >
              <SelectTrigger id="opd-sex" className="mt-1">
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
          </div>
          <div>
            <Label htmlFor="opd-phone">Patient number</Label>
            <Input
              id="opd-phone"
              value={formData.phoneNumber}
              onChange={(event) => setField('phoneNumber', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-alt-phone">Alternative number</Label>
            <Input
              id="opd-alt-phone"
              value={formData.alternateNumber}
              onChange={(event) => setField('alternateNumber', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-circle">Circle</Label>
            <Input
              id="opd-circle"
              value={formData.circle}
              onChange={(event) => setField('circle', event.target.value)}
              className="mt-1"
            />
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

          <div>
            <Label htmlFor="opd-category">Category</Label>
            <Input
              id="opd-category"
              value={formData.category}
              onChange={(event) => setField('category', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-treatment">Treatment</Label>
            <Input
              id="opd-treatment"
              value={formData.treatment}
              onChange={(event) => setField('treatment', event.target.value)}
              className="mt-1"
            />
          </div>
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
            allowFreeText
          />
          <div>
            <Label htmlFor="opd-surgeon-type">Surgeon type</Label>
            <Select
              value={formData.surgeonType || '__none__'}
              onValueChange={(value) => setField('surgeonType', value === '__none__' ? '' : value)}
            >
              <SelectTrigger id="opd-surgeon-type" className="mt-1">
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
              onChange={(value) => setField('hospitalName', value)}
              onItemSelect={handleHospitalSelect}
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
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-mode">Type</Label>
            <Select value={formData.opdMode} onValueChange={(value) => setField('opdMode', value)}>
              <SelectTrigger id="opd-mode" className="mt-1">
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
          </div>

          <div className="md:col-span-2 mt-2 flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-cyan-600" />
            Timings
          </div>

          <div>
            <Label htmlFor="opd-arrival-date">Arrival date</Label>
            <Input
              id="opd-arrival-date"
              type="date"
              value={formData.arrivalDate}
              onChange={(event) => setField('arrivalDate', event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="opd-arrival-time">Arrival time</Label>
            <Input
              id="opd-arrival-time"
              type="time"
              value={formData.arrivalTime}
              onChange={(event) => setField('arrivalTime', event.target.value)}
              className="mt-1"
            />
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
