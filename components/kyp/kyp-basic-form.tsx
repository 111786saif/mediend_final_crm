'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useFileUpload } from '@/hooks/use-file-upload'
import { apiGet, apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { File } from 'lucide-react'
import { differenceInYears, format, isValid, parse } from 'date-fns'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import CITIES from '@/data/indian-cities'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'
import { validateAadhaar, validatePAN } from '@/lib/validations'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function parseDobString(s: string): Date | undefined {
  if (!s?.trim()) return undefined
  const d = parse(s.trim(), 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

function ageFromDobString(dobStr: string): number | undefined {
  const birth = parseDobString(dobStr)
  if (!birth) return undefined
  return differenceInYears(new Date(), birth)
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** Prefill when editing Card Details before hospitals are suggested (KYP_BASIC_COMPLETE). */
export type KYPBasicPrefill = {
  kypId: string
  location: string
  area: string
  patientName: string
  phone: string
  dob: string
  sex: string
  disease: string
  insuranceType: string
  remark: string
  insuranceName: string
  doctorName: string
  aadhar: string
  pan: string
  insuranceFiles: { name: string; url: string }[]
  aadharFiles: { name: string; url: string }[]
  panFiles: { name: string; url: string }[]
}

export function parseOtherFilesForInsurance(
  otherFiles: unknown,
  insuranceCardFileUrl: string | null | undefined
): { name: string; url: string }[] {
  const arr = Array.isArray(otherFiles) ? otherFiles : []
  const out: { name: string; url: string }[] = []
  for (const p of arr) {
    const url = typeof p === 'string' ? p : (p as { url?: string })?.url
    if (!url) continue
    const name =
      typeof p === 'object' && p && typeof (p as { name?: string }).name === 'string' && (p as { name: string }).name.trim()
        ? (p as { name: string }).name.trim()
        : 'Document'
    out.push({ name, url })
  }
  const seen = new Set<string>()
  const unique = out.filter((x) => {
    if (seen.has(x.url)) return false
    seen.add(x.url)
    return true
  })
  if (unique.length > 0) return unique
  if (insuranceCardFileUrl?.trim()) return [{ name: 'Document', url: insuranceCardFileUrl.trim() }]
  return []
}

export function parseJsonFileList(raw: unknown): { name: string; url: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { name: string; url: string }[] = []
  for (const p of raw) {
    const url = typeof p === 'string' ? p : (p as { url?: string })?.url
    if (!url || typeof url !== 'string') continue
    const name =
      typeof p === 'object' && p && typeof (p as { name?: string }).name === 'string' && (p as { name: string }).name.trim()
        ? (p as { name: string }).name.trim()
        : 'Document'
    out.push({ name, url })
  }
  return out
}

interface KYPBasicFormProps {
  leadId: string
  initialPatientName?: string
  initialPhone?: string
  initialDob?: string
  initialSex?: string
  initialCity?: string
  initialTreatment?: string
  /** When set, form fields and files are hydrated for resubmit (KYP_BASIC_COMPLETE). */
  prefill?: KYPBasicPrefill | null
  isEditMode?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

export function KYPBasicForm({
  leadId,
  initialPatientName = '',
  initialPhone = '',
  initialDob = '',
  initialSex = '',
  initialCity = '',
  initialTreatment = '',
  prefill = null,
  isEditMode = false,
  onSuccess,
  onCancel,
}: KYPBasicFormProps) {
  const { user } = useAuth()
  const canViewPhone = canViewPhoneNumber(user)
  const [formData, setFormData] = useState({
    location: initialCity,
    area: '',
    patientName: initialPatientName,
    phone: initialPhone,
    dob: initialDob,
    sex: initialSex,
    disease: initialTreatment,
    insuranceType: '',
    remark: '',
    insuranceName: '',
    doctorName: '',
    aadhar: '',
    pan: '',
  })
  const [insuranceFiles, setInsuranceFiles] = useState<{ name: string; url: string }[]>([])
  const [aadharFiles, setAadharFiles] = useState<{ name: string; url: string }[]>([])
  const [panFiles, setPanFiles] = useState<{ name: string; url: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dobPopoverOpen, setDobPopoverOpen] = useState(false)
  const { uploadFile, uploading } = useFileUpload({
    maxFileSizeBytes: KYP_UPLOAD_MAX_BYTES,
  })

  useEffect(() => {
    if (!prefill) return
    setFormData({
      location: prefill.location,
      area: prefill.area,
      patientName: prefill.patientName,
      phone: prefill.phone,
      dob: prefill.dob,
      sex: prefill.sex,
      disease: prefill.disease,
      insuranceType: prefill.insuranceType,
      remark: prefill.remark,
      insuranceName: prefill.insuranceName,
      doctorName: prefill.doctorName,
      aadhar: prefill.aadhar,
      pan: prefill.pan,
    })
    setInsuranceFiles([...prefill.insuranceFiles])
    setAadharFiles([...prefill.aadharFiles])
    setPanFiles([...prefill.panFiles])
    setErrors({})
  }, [prefill?.kypId])

  // Fuzzy search function - checks if search term is contained in the city name
  // Case insensitive and handles partial matches (e.g., "DEL" matches "West Delhi")
  const fuzzyMatch = (city: string, searchTerm: string): boolean => {
    const cityLower = city.toLowerCase()
    const searchLower = searchTerm.toLowerCase()
    return cityLower.includes(searchLower)
  }

  // Filter cities based on search input with fuzzy matching
  const filteredCities = useMemo(() => {
    if (!formData.location.trim()) return []
    return CITIES.filter((city) => fuzzyMatch(city, formData.location)).slice(0, 10)
  }, [formData.location])

  const debouncedInsuranceSearch = useDebouncedValue(formData.insuranceName, 250)
  const debouncedDoctorSearch = useDebouncedValue(formData.doctorName, 250)

  const { data: tpaSuggestData } = useQuery({
    queryKey: ['masters', 'tpas', 'kyp-suggest', debouncedInsuranceSearch],
    queryFn: () =>
      apiGet<{ items: { id: string; name: string }[] }>(
        `/api/masters/tpas?search=${encodeURIComponent(debouncedInsuranceSearch.trim())}`
      ),
    enabled: debouncedInsuranceSearch.trim().length >= 1,
    staleTime: 30_000,
  })

  const { data: doctorSuggestData } = useQuery({
    queryKey: ['masters', 'doctors', 'kyp-suggest', debouncedDoctorSearch],
    queryFn: () =>
      apiGet<{ items: { id: string; name: string }[] }>(
        `/api/masters/doctors?search=${encodeURIComponent(debouncedDoctorSearch.trim())}`
      ),
    enabled: debouncedDoctorSearch.trim().length >= 1,
    staleTime: 30_000,
  })

  const tpaSuggestions = useMemo(() => (tpaSuggestData?.items ?? []).slice(0, 25), [tpaSuggestData])

  const doctorSuggestions = useMemo(
    () => (doctorSuggestData?.items ?? []).slice(0, 25),
    [doctorSuggestData]
  )

  const computedAge = useMemo(() => ageFromDobString(formData.dob), [formData.dob])

  const handleInsuranceCardsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await uploadFile(file)
      if (result) {
        setInsuranceFiles(prev => [...prev, { name: file.name, url: result.url }])
      }
    }
  }

  const handleAadharChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await uploadFile(file)
      if (result) {
        setAadharFiles((prev) => [...prev, { name: file.name, url: result.url }])
      }
    }
    e.target.value = ''
  }

  const handlePanChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await uploadFile(file)
      if (result) {
        setPanFiles((prev) => [...prev, { name: file.name, url: result.url }])
      }
    }
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (insuranceFiles.length === 0) {
      newErrors.insurance = 'At least one insurance card upload is required'
    }
    if (!formData.location.trim()) {
      newErrors.location = 'City is required'
    }
    if (!formData.area.trim()) {
      newErrors.area = 'Area is required'
    }
    if (!formData.disease.trim()) {
      newErrors.disease = 'Disease/Treatment is required'
    }
    if (!formData.doctorName.trim()) {
      newErrors.doctorName = 'Surgeon/Doctor Name is required'
    }
    if (!formData.insuranceType) {
      newErrors.insuranceType = 'Insurance Type is required'
    }
    if (!formData.dob?.trim()) {
      newErrors.dob = 'Date of Birth is required'
    }

    if (formData.aadhar && !validateAadhaar(formData.aadhar)) {
      newErrors.aadhar = 'Invalid Aadhaar (12 digits starting with 2-9)'
    }

    if (formData.pan && !validatePAN(formData.pan)) {
      newErrors.pan = 'Invalid PAN format'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error('Please fix the errors in the form')
      return
    }

    setErrors({})
    try {
      await apiPost('/api/kyp/submit', {
        leadId,
        patientName: formData.patientName.trim(),
        phone: formData.phone.trim(),
        age: computedAge,
        dateOfBirth: formData.dob?.trim() || undefined,
        sex: formData.sex,
        location: formData.location.trim(),
        area: formData.area.trim(),
        disease: formData.disease.trim(),
        insuranceType: formData.insuranceType,
        insuranceName: formData.insuranceName.trim(),
        doctorName: formData.doctorName.trim(),
        aadhar: formData.aadhar.trim(),
        pan: formData.pan.trim(),
        insuranceCardFiles: insuranceFiles,
        aadharFiles: aadharFiles.length > 0 ? aadharFiles : undefined,
        panFiles: panFiles.length > 0 ? panFiles : undefined,
        remark: formData.remark.trim() || undefined,
      })
      toast.success(
        isEditMode
          ? 'Card Details saved.'
          : 'Card Details submitted. Insurance will suggest hospitals.'
      )
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit KYP')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 ">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="patientName">Patient Name *</Label>
          <Input
            id="patientName"
            value={formData.patientName}
            onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            placeholder="Enter patient name"
            required
          />
        </div>
        {canViewPhone && (
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Optional"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">City *</Label>
          <Combobox
            value={formData.location || ''}
            onValueChange={(value) => {
              if (value) {
                setFormData({ ...formData, location: value })
              }
            }}
          >
            <ComboboxInput
              placeholder="Search city or enter manually"
              className={cn("w-full")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                setFormData({ ...formData, location: e.target.value })
              }
              value={formData.location}
            />
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
            {formData.location.trim() && (
              <ComboboxContent>
                <ComboboxList>
                  {filteredCities.length > 0 ? (
                    filteredCities.map((city) => (
                      <ComboboxItem key={city} value={city}>
                        {city}
                      </ComboboxItem>
                    ))
                  ) : (
                    <ComboboxEmpty>
                      No cities found. You can enter manually.
                    </ComboboxEmpty>
                  )}
                </ComboboxList>
              </ComboboxContent>
            )}
          </Combobox>
        </div>
        <div>
          <Label htmlFor="area">Area *</Label>
          <Input
            id="area"
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            placeholder="Enter area"
            required
          />
          {errors.area && <p className="text-xs text-destructive mt-1">{errors.area}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="insuranceName">Insurance Name</Label>
          <Combobox
            value={formData.insuranceName || ''}
            onValueChange={(value) => {
              if (value) {
                setFormData({ ...formData, insuranceName: value })
              }
            }}
          >
            <ComboboxInput
              id="insuranceName"
              placeholder="Search TPA master or type any insurer name"
              className={cn('w-full')}
              value={formData.insuranceName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, insuranceName: e.target.value })
              }
            />
            {formData.insuranceName.trim() && (
              <ComboboxContent>
                <ComboboxList>
                  {tpaSuggestions.length > 0 ? (
                    tpaSuggestions.map((item) => (
                      <ComboboxItem key={item.id} value={item.name}>
                        {item.name}
                      </ComboboxItem>
                    ))
                  ) : (
                    <ComboboxEmpty>No TPA matches. Keep typing to use your own text.</ComboboxEmpty>
                  )}
                </ComboboxList>
              </ComboboxContent>
            )}
          </Combobox>
        </div>
        <div>
          <Label htmlFor="doctorName">
            Surgeon/Doctor Name <span className="text-destructive">*</span>
          </Label>
          <Combobox
            value={formData.doctorName || ''}
            onValueChange={(value) => {
              if (value) {
                setFormData({ ...formData, doctorName: value })
              }
            }}
          >
            <ComboboxInput
              id="doctorName"
              placeholder="Search doctor master or type any name"
              className={cn('w-full', errors.doctorName && 'border-destructive')}
              value={formData.doctorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, doctorName: e.target.value })
              }
            />
            {formData.doctorName.trim() && (
              <ComboboxContent>
                <ComboboxList>
                  {doctorSuggestions.length > 0 ? (
                    doctorSuggestions.map((item) => (
                      <ComboboxItem key={item.id} value={item.name}>
                        {item.name}
                      </ComboboxItem>
                    ))
                  ) : (
                    <ComboboxEmpty>No doctor matches. Keep typing to use your own text.</ComboboxEmpty>
                  )}
                </ComboboxList>
              </ComboboxContent>
            )}
          </Combobox>
          {errors.doctorName && (
            <p className="text-xs text-destructive mt-1">{errors.doctorName}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="disease">Disease/Treatment *</Label>
          <Textarea
            id="disease"
            value={formData.disease}
            onChange={(e) => setFormData({ ...formData, disease: e.target.value })}
            placeholder="Describe the disease or treatment needed"
            required
          />
          {errors.disease && <p className="text-xs text-destructive mt-1">{errors.disease}</p>}
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="insuranceType">Insurance Type *</Label>
            <select
              id="insuranceType"
              value={formData.insuranceType}
              onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
              required
            >
              <option value="">Select insurance type</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GROUP_CORPORATE">Group/Corporate</option>
            </select>
            {errors.insuranceType && <p className="text-xs text-destructive mt-1">{errors.insuranceType}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth *</Label>
          <Popover open={dobPopoverOpen} onOpenChange={setDobPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                id="dob"
                className={cn(
                  'w-full justify-start font-normal',
                  !formData.dob && 'text-muted-foreground',
                  errors.dob && 'border-destructive'
                )}
              >
                {(() => {
                  const d = parseDobString(formData.dob)
                  return d ? format(d, 'dd MMM yyyy') : 'Select date'
                })()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDobString(formData.dob)}
                defaultMonth={parseDobString(formData.dob) ?? new Date()}
                captionLayout="dropdown"
                fromYear={1920}
                toYear={new Date().getFullYear()}
                onSelect={(date) => {
                  if (date) {
                    setFormData((prev) => ({ ...prev, dob: format(date, 'yyyy-MM-dd') }))
                  }
                  setDobPopoverOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
          {errors.dob && <p className="text-xs text-destructive mt-1">{errors.dob}</p>}
        </div>
        <div>
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            readOnly
            tabIndex={-1}
            value={computedAge !== undefined ? String(computedAge) : ''}
            placeholder="From date of birth"
            className="bg-muted"
          />
        </div>
        <div>
          <Label htmlFor="sex">Gender</Label>
          <select
            id="sex"
            value={formData.sex}
            onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
            className="w-full px-3 py-2 border border-input bg-background rounded-md"
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="aadhar">Aadhaar Number</Label>
          <Input
            id="aadhar"
            value={formData.aadhar}
            onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
            placeholder="Optional"
          />
          {errors.aadhar && <p className="text-xs text-destructive mt-1">{errors.aadhar}</p>}
        </div>
        <div>
          <Label htmlFor="pan">PAN Number</Label>
          <Input
            id="pan"
            value={formData.pan}
            onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
            placeholder="Optional"
          />
          {errors.pan && <p className="text-xs text-destructive mt-1">{errors.pan}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Insurance Cards (Multiple) *</Label>
          <p className="text-muted-foreground text-xs mt-0.5 mb-1">
            PDF or image, up to 20 MB per file.
          </p>
          <div className="mt-2">
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleInsuranceCardsChange}
            />
            {errors.insurance && <p className="text-xs text-destructive mt-1">{errors.insurance}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {insuranceFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md">
                  <File className="h-4 w-4" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => setInsuranceFiles(prev => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Aadhaar (front &amp; back — multiple)</Label>
            <p className="text-muted-foreground text-xs mt-0.5 mb-1">Optional. Upload one or two files.</p>
            <div className="mt-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleAadharChange}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {aadharFiles.map((file, index) => (
                  <div
                    key={`${file.url}-${index}`}
                    className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md"
                  >
                    <File className="h-4 w-4 shrink-0" />
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive shrink-0"
                      onClick={() => setAadharFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>PAN (front &amp; back — multiple)</Label>
            <p className="text-muted-foreground text-xs mt-0.5 mb-1">
              Optional. Up to 20 MB per file.
            </p>
            <div className="mt-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handlePanChange}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {panFiles.map((file, index) => (
                  <div
                    key={`${file.url}-${index}`}
                    className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md"
                  >
                    <File className="h-4 w-4 shrink-0" />
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive shrink-0"
                      onClick={() => setPanFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="remark">Notes</Label>
        <Textarea
          id="remark"
          value={formData.remark}
          onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
          placeholder="Optional notes"
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
          {uploading ? 'Uploading...' : isEditMode ? 'Save changes' : 'Submit Card Details'}
        </Button>
      </div>
    </form>
  )
}
