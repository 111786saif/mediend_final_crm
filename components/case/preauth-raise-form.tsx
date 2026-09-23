'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MultiStepForm } from '@/components/forms/multi-step-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Upload, X, FileText, ExternalLink, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface RoomTypeOption {
  name: string
  rent: string
}

export interface HospitalSuggestionItem {
  id: string
  hospitalName: string
  tentativeBill?: number | null
  roomRentGeneral?: number | null
  roomRentSingle?: number | null
  roomRentDeluxe?: number | null
  roomRentSemiPrivate?: number | null
  notes?: string | null
}

interface FilePreview {
  name: string
  url: string
}

export interface PreAuthRaiseFormProps {
  leadId: number
  leadData?: {
    patientName?: string | null
    age?: number | null
    sex?: string | null
    treatment?: string | null
    tpa?: string | null
    surgeonName?: string | null
  }
  initialData?: {
    requestedHospitalName?: string
    requestedRoomType?: string
    diseaseDescription?: string
    diseaseImages?: Array<{ name: string; url: string }>
    hospitalSuggestions?: string[]
    roomTypes?: RoomTypeOption[]
    suggestedHospitals?: HospitalSuggestionItem[]
    // Prescription & investigation files
    prescriptionFiles?: Array<{ name: string; url: string }>
    investigationFileUrls?: Array<{ name: string; url: string }>
    notes?: string
    expectedAdmissionDate?: string
    expectedSurgeryDate?: string
  }
  // KYP submission data for auto-fills
  kypData?: {
    disease?: string | null
    surgeonName?: string | null
    doctorName?: string | null
    insuranceType?: string | null
    aadhar?: string | null
    pan?: string | null
    aadharFileUrl?: string | null
    panFileUrl?: string | null
    aadharFiles?: Array<{ name: string; url: string }> | null
    panFiles?: Array<{ name: string; url: string }> | null
    prescriptionFileUrl?: string | null
    location?: string | null
    area?: string | null
  }
  // Pre-auth insurance data for auto-fills
  preAuthMeta?: {
    sumInsured?: string | null
    balanceInsured?: string | null
    copay?: string | null
    capping?: string | number | null
    roomRent?: string | null
    insurance?: string | null
    tpa?: string | null
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function PreAuthRaiseForm({
  leadId,
  leadData,
  initialData,
  kypData,
  preAuthMeta,
  onSuccess,
  onCancel,
}: PreAuthRaiseFormProps) {
  const router = useRouter()
  const { uploadFile, uploading: isUploading } = useFileUpload({ folder: 'preauth' })

  const suggestedHospitals = initialData?.suggestedHospitals ?? []
  const legacyHospitals = initialData?.hospitalSuggestions ?? []
  const legacyRoomTypes = initialData?.roomTypes ?? []
  const hasSuggestedCards = suggestedHospitals.length > 0

  // Aadhar / PAN pre-fills from KYP. Prefer multi-file arrays; fall back to legacy single-url fields.
  const initialAadharFiles: FilePreview[] =
    kypData?.aadharFiles && kypData.aadharFiles.length > 0
      ? kypData.aadharFiles
      : kypData?.aadharFileUrl
        ? [{ name: 'Existing Aadhar', url: kypData.aadharFileUrl }]
        : []
  const initialPanFiles: FilePreview[] =
    kypData?.panFiles && kypData.panFiles.length > 0
      ? kypData.panFiles
      : kypData?.panFileUrl
        ? [{ name: 'Existing PAN', url: kypData.panFileUrl }]
        : []

  const [formData, setFormData] = useState({
    requestedHospitalName: initialData?.requestedHospitalName || '',
    requestedRoomType: initialData?.requestedRoomType || '',
    diseaseDescription: initialData?.diseaseDescription || kypData?.disease || '',
    notes: initialData?.notes || '',
    diseaseImages: (initialData?.diseaseImages || []) as FilePreview[],
    prescriptionFiles: (initialData?.prescriptionFiles || []) as FilePreview[],
    investigationFileUrls: (initialData?.investigationFileUrls || []) as FilePreview[],
    expectedAdmissionDate: initialData?.expectedAdmissionDate || '',
    expectedSurgeryDate: initialData?.expectedSurgeryDate || '',
    // Aadhaar / PAN numbers
    aadhar: initialData?.diseaseDescription ? (kypData?.aadhar || '') : (kypData?.aadhar || ''),
    pan: initialData?.diseaseDescription ? (kypData?.pan || '') : (kypData?.pan || ''),
    // Aadhaar / PAN files (multi)
    aadharFiles: initialAadharFiles,
    panFiles: initialPanFiles,
  })
  
  // Update aadhar/pan if kypData changes or on initial load
  useState(() => {
    if (kypData?.aadhar && !formData.aadhar) formData.aadhar = kypData.aadhar;
    if (kypData?.pan && !formData.pan) formData.pan = kypData.pan;
  })

  // Generic file upload helper
  const uploadSingleFile = async (
    file: File,
    onDone: (url: string, name: string) => void
  ) => {
    try {
      const result = await uploadFile(file)
      if (!result) return
      onDone(result.url, file.name)
      toast.success('File uploaded successfully')
    } catch {
      toast.error('Failed to upload file')
    }
  }

  const uploadMultipleFile = async (
    file: File,
    field: 'prescriptionFiles' | 'investigationFileUrls' | 'diseaseImages' | 'aadharFiles' | 'panFiles'
  ) => {
    try {
      const result = await uploadFile(file)
      if (!result) return
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], { name: file.name, url: result.url }],
      }))
      toast.success('File uploaded successfully')
    } catch {
      toast.error('Failed to upload file')
    }
  }

  const removeMultipleFile = (
    field: 'prescriptionFiles' | 'investigationFileUrls' | 'diseaseImages' | 'aadharFiles' | 'panFiles',
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const hospitalNameForSubmit = formData.requestedHospitalName

  const handleSubmit = async () => {
    if (!hospitalNameForSubmit) {
      toast.error('Hospital name is required')
      return
    }
    if (!formData.requestedRoomType?.trim()) {
      toast.error('Room type is required')
      return
    }
    if (!formData.diseaseDescription.trim()) {
      toast.error('Disease description is required')
      return
    }
    if (!formData.expectedAdmissionDate) {
      toast.error('Date of Admission is required')
      return
    }
    if (!formData.expectedSurgeryDate) {
      toast.error('Date of Surgery is required')
      return
    }
    if (formData.aadharFiles.length === 0) {
      toast.error('At least one Aadhar Card upload is required')
      return
    }
    if (formData.panFiles.length === 0) {
      toast.error('At least one PAN Card upload is required')
      return
    }
    if (formData.prescriptionFiles.length === 0) {
      toast.error('At least one Prescription upload is required')
      return
    }

    try {
      const response = await fetch(`/api/leads/${leadId}/raise-preauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedHospitalName: hospitalNameForSubmit,
          requestedRoomType: formData.requestedRoomType || undefined,
          diseaseDescription: formData.diseaseDescription,
          notes: formData.notes || undefined,
          aadhar: formData.aadhar || undefined,
          pan: formData.pan || undefined,
          aadharFiles: formData.aadharFiles,
          panFiles: formData.panFiles,
          aadharFileUrl: formData.aadharFiles[0]?.url || undefined,
          panFileUrl: formData.panFiles[0]?.url || undefined,
          prescriptionFiles: formData.prescriptionFiles,
          investigationFileUrls: formData.investigationFileUrls,
          diseaseImages: formData.diseaseImages,
          expectedAdmissionDate: formData.expectedAdmissionDate,
          expectedSurgeryDate: formData.expectedSurgeryDate,
          isNewHospitalRequest: false,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to raise pre-auth')
      }

      toast.success('Pre-auth raised successfully')
      onSuccess?.()
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to raise pre-auth'
      )
    }
  }

  const selectedHospitalCard =
    hasSuggestedCards && formData.requestedHospitalName
      ? suggestedHospitals.find((h) => h.hospitalName === formData.requestedHospitalName)
      : null

  const roomOptionsFromCard = selectedHospitalCard
    ? [
        ...(selectedHospitalCard.roomRentGeneral != null
          ? [{ name: 'General', rent: String(selectedHospitalCard.roomRentGeneral) }]
          : []),
        ...(selectedHospitalCard.roomRentSingle != null
          ? [{ name: 'Single', rent: String(selectedHospitalCard.roomRentSingle) }]
          : []),
        ...(selectedHospitalCard.roomRentDeluxe != null
          ? [{ name: 'Deluxe', rent: String(selectedHospitalCard.roomRentDeluxe) }]
          : []),
        ...(selectedHospitalCard.roomRentSemiPrivate != null
          ? [{ name: 'Semi-Private', rent: String(selectedHospitalCard.roomRentSemiPrivate) }]
          : []),
      ]
    : []

  // ─── Auto-fill info chips ────────────────────────────────────────────────────
  const AutoFillBadge = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    )
  }

  const hasAutoFills =
    kypData?.disease ||
    kypData?.surgeonName ||
    kypData?.doctorName ||
    kypData?.insuranceType ||
    preAuthMeta?.insurance ||
    preAuthMeta?.sumInsured ||
    preAuthMeta?.balanceInsured ||
    preAuthMeta?.copay ||
    preAuthMeta?.capping ||
    preAuthMeta?.roomRent ||
    kypData?.area ||
    kypData?.location

  // ─── File upload row UI ──────────────────────────────────────────────────────
  const FileUploadRow = ({
    id,
    label,
    required,
    existingUrl,
    currentUrl,
    currentName,
    accept,
    onUpload,
    onClear,
  }: {
    id: string
    label: string
    required?: boolean
    existingUrl?: string | null
    currentUrl: string
    currentName: string
    accept?: string
    onUpload: (file: File) => void
    onClear: () => void
  }) => {
    const hasFile = !!currentUrl
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {hasFile ? (
          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{currentName}</span>
            {existingUrl && currentUrl === existingUrl && (
              <a href={existingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </a>
            )}
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <input
              type="file"
              id={id}
              accept={accept || 'image/*,.pdf'}
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => document.getElementById(id)?.click()}
              disabled={isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading…' : `Upload ${label}`}
            </Button>
          </>
        )}
      </div>
    )
  }

  // ─── Multi-file upload row UI ────────────────────────────────────────────────
  const MultiFileUploadRow = ({
    id,
    label,
    required,
    files,
    accept,
    onAdd,
    onRemove,
  }: {
    id: string
    label: string
    required?: boolean
    files: FilePreview[]
    accept?: string
    onAdd: (file: File) => void
    onRemove: (index: number) => void
  }) => (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm truncate flex-1 hover:underline"
              >
                {f.name}
              </a>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        type="file"
        id={id}
        accept={accept || 'image/*,.pdf'}
        className="hidden"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAdd(file)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => document.getElementById(id)?.click()}
        disabled={isUploading}
      >
        <Upload className="w-4 h-4 mr-2" />
        {isUploading ? 'Uploading…' : `Add ${label}`}
      </Button>
    </div>
  )

  // ─── Steps ───────────────────────────────────────────────────────────────────
  const steps = [
    {
      id: 'hospital',
      title: 'Hospital & Timeline',
      description: 'Select hospital, room type, and admission/surgery dates',
      component: (
        <div className="space-y-5">
          {/* Auto-fill summary */}
          {hasAutoFills && (
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Auto-filled from previous steps
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <AutoFillBadge label="Disease / Treatment" value={kypData?.disease} />
                <AutoFillBadge label="Surgeon Name" value={kypData?.surgeonName} />
                <AutoFillBadge label="Doctor Name" value={kypData?.doctorName} />
                <AutoFillBadge label="Insurance Name" value={preAuthMeta?.insurance} />
                <AutoFillBadge label="Insurance Type" value={kypData?.insuranceType} />
                <AutoFillBadge label="Sum Insured" value={preAuthMeta?.sumInsured ? `₹${preAuthMeta.sumInsured}` : undefined} />
                <AutoFillBadge label="Balance Insured" value={preAuthMeta?.balanceInsured ? `₹${preAuthMeta.balanceInsured}` : undefined} />
                <AutoFillBadge label="Copay" value={preAuthMeta?.copay ? `${preAuthMeta.copay}%` : undefined} />
                <AutoFillBadge label="Capping" value={preAuthMeta?.capping != null && preAuthMeta.capping !== '' ? (typeof preAuthMeta.capping === 'string' && !Number.isNaN(Number(preAuthMeta.capping)) ? `₹${Number(preAuthMeta.capping).toLocaleString('en-IN')}` : String(preAuthMeta.capping)) : undefined} />
                <AutoFillBadge label="Room Rent" value={preAuthMeta?.roomRent ? `₹${preAuthMeta.roomRent}` : undefined} />
                <AutoFillBadge label="Area" value={kypData?.area} />
                <AutoFillBadge label="City" value={kypData?.location} />
              </div>
            </div>
          )}

          {/* Hospital selection */}
          <div className="space-y-2">
            <Label>Choose Hospital <span className="text-red-500">*</span></Label>
            {hasSuggestedCards ? (
              <div className="grid gap-2">
                {suggestedHospitals.map((h) => (
                  <div
                    key={h.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        requestedHospitalName: h.hospitalName,
                        requestedRoomType: '',
                      }))
                    }
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      setFormData((prev) => ({
                        ...prev,
                        requestedHospitalName: h.hospitalName,
                        requestedRoomType: '',
                      }))
                    }
                    className={`rounded-lg border-2 p-4 text-left transition-colors cursor-pointer ${
                      formData.requestedHospitalName === h.hospitalName
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{h.hospitalName}</span>
                      {formData.requestedHospitalName === h.hospitalName && (
                        <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      )}
                    </div>
                    {(h.tentativeBill != null ||
                      h.roomRentGeneral != null ||
                      h.roomRentSingle != null ||
                      h.roomRentDeluxe != null ||
                      h.roomRentSemiPrivate != null) && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {h.tentativeBill != null && (
                          <span>Tentative bill: ₹{h.tentativeBill}</span>
                        )}
                        {(h.roomRentGeneral != null ||
                          h.roomRentSingle != null ||
                          h.roomRentDeluxe != null ||
                          h.roomRentSemiPrivate != null) && (
                          <span className="ml-2">
                            Room:{' '}
                            {[
                              h.roomRentGeneral != null && `General ₹${h.roomRentGeneral}`,
                              h.roomRentSingle != null && `Single ₹${h.roomRentSingle}`,
                              h.roomRentDeluxe != null && `Deluxe ₹${h.roomRentDeluxe}`,
                              h.roomRentSemiPrivate != null && `Semi-Private ₹${h.roomRentSemiPrivate}`,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    {h.notes && (
                      <div className="mt-1 text-sm text-muted-foreground">{h.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : legacyHospitals.length > 0 ? (
              <Select
                value={formData.requestedHospitalName}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, requestedHospitalName: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hospital" />
                </SelectTrigger>
                <SelectContent>
                  {legacyHospitals.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.requestedHospitalName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requestedHospitalName: e.target.value,
                  }))
                }
                placeholder="Enter hospital name"
              />
            )}
          </div>

          {/* Room type — shown when a hospital card is selected */}
          {(hasSuggestedCards ? selectedHospitalCard : true) && (
            <div>
              <Label htmlFor="roomType">
                Room Type <span className="text-red-500">*</span>
              </Label>
              {roomOptionsFromCard.length > 0 ? (
                <Select
                  value={formData.requestedRoomType}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, requestedRoomType: v }))
                  }
                >
                  <SelectTrigger id="roomType" className="mt-1">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptionsFromCard.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                        {r.rent ? ` – ₹${r.rent}/day` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : legacyRoomTypes.length > 0 ? (
                <Select
                  value={formData.requestedRoomType}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, requestedRoomType: v }))
                  }
                >
                  <SelectTrigger id="roomType" className="mt-1">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {legacyRoomTypes.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                        {r.rent ? ` – ₹${r.rent}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="roomType"
                  value={formData.requestedRoomType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      requestedRoomType: e.target.value,
                    }))
                  }
                  placeholder="e.g. General, Single AC, Deluxe"
                  className="mt-1"
                />
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="admissionDate">
                Date of Admission <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admissionDate"
                type="date"
                value={formData.expectedAdmissionDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expectedAdmissionDate: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="surgeryDate">
                Date of Surgery <span className="text-red-500">*</span>
              </Label>
              <Input
                id="surgeryDate"
                type="date"
                value={formData.expectedSurgeryDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expectedSurgeryDate: e.target.value,
                  }))
                }
                className="mt-1"
              />
            </div>
          </div>
          {formData.expectedAdmissionDate &&
            formData.expectedSurgeryDate &&
            formData.expectedAdmissionDate > formData.expectedSurgeryDate && (
              <p className="text-sm text-destructive">
                Admission date must be on or before surgery date.
              </p>
            )}
        </div>
      ),
      validate: () => {
        return (
          formData.requestedHospitalName.length > 0 &&
          (roomOptionsFromCard.length === 0 || formData.requestedRoomType.length > 0)
        )
      },
    },

    {
      id: 'documents',
      title: 'Documents & Medical Details',
      description: 'Upload required documents and provide disease information',
      component: (
        <div className="space-y-5">
          {/* Aadhaar Number */}
          <div className="space-y-1">
            <Label htmlFor="aadhar-number">Aadhaar Number</Label>
            <Input
              id="aadhar-number"
              value={formData.aadhar}
              onChange={(e) => setFormData(prev => ({ ...prev, aadhar: e.target.value }))}
              placeholder="Enter 12-digit Aadhaar number"
            />
          </div>

          {/* Aadhaar Files (multiple) */}
          <MultiFileUploadRow
            id="aadhar-upload"
            label="Aadhar Card"
            required
            files={formData.aadharFiles}
            onAdd={(file) => uploadMultipleFile(file, 'aadharFiles')}
            onRemove={(i) => removeMultipleFile('aadharFiles', i)}
          />

          {/* PAN Number */}
          <div className="space-y-1">
            <Label htmlFor="pan-number">PAN Number</Label>
            <Input
              id="pan-number"
              value={formData.pan}
              onChange={(e) => setFormData(prev => ({ ...prev, pan: e.target.value }))}
              placeholder="Enter 10-digit PAN number"
            />
          </div>

          {/* PAN Files (multiple) */}
          <MultiFileUploadRow
            id="pan-upload"
            label="PAN Card"
            required
            files={formData.panFiles}
            onAdd={(file) => uploadMultipleFile(file, 'panFiles')}
            onRemove={(i) => removeMultipleFile('panFiles', i)}
          />

          {/* Prescription (multiple) */}
          <MultiFileUploadRow
            id="prescription-upload"
            label="Prescription"
            required
            files={formData.prescriptionFiles}
            onAdd={(file) => uploadMultipleFile(file, 'prescriptionFiles')}
            onRemove={(i) => removeMultipleFile('prescriptionFiles', i)}
          />

          {/* Investigation (multiple, optional) */}
          <MultiFileUploadRow
            id="investigation-upload"
            label="Investigation Reports"
            files={formData.investigationFileUrls}
            onAdd={(file) => uploadMultipleFile(file, 'investigationFileUrls')}
            onRemove={(i) => removeMultipleFile('investigationFileUrls', i)}
          />

          {/* Disease description */}
          <div>
            <Label htmlFor="diseaseDescription">
              Disease Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="diseaseDescription"
              value={formData.diseaseDescription}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  diseaseDescription: e.target.value,
                }))
              }
              placeholder="Describe the disease, symptoms, and treatment required"
              rows={4}
              className="mt-1"
            />
          </div>

          {/* Disease images (optional) */}
          <MultiFileUploadRow
            id="disease-images-upload"
            label="Disease Images (optional)"
            files={formData.diseaseImages}
            accept="image/*"
            onAdd={(file) => uploadMultipleFile(file, 'diseaseImages')}
            onRemove={(i) => removeMultipleFile('diseaseImages', i)}
          />

          {/* Notes for Insurance */}
          <div>
            <Label htmlFor="notes">Notes for Insurance (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Additional information for Insurance team"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
      ),
      validate: () =>
        formData.aadharFiles.length > 0 &&
        formData.panFiles.length > 0 &&
        formData.prescriptionFiles.length > 0 &&
        formData.diseaseDescription.trim().length > 0,
    },

    {
      id: 'review',
      title: 'Review & Submit',
      description: 'Review all information before submitting',
      component: (
        <div className="space-y-5">
          {/* Patient summary */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Patient Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Patient Name</span>
                <p className="font-medium">{leadData?.patientName || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Age</span>
                <p className="font-medium">{leadData?.age != null ? leadData.age : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sex</span>
                <p className="font-medium">{leadData?.sex || '—'}</p>
              </div>
            </div>
          </div>

          {/* Hospital & Timeline summary */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Hospital & Timeline</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Hospital</span>
                <p className="font-medium">{hospitalNameForSubmit}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Room Type</span>
                <p className="font-medium">{formData.requestedRoomType || '—'}</p>
              </div>
              {preAuthMeta?.roomRent && (
                <div>
                  <span className="text-muted-foreground">Room Rent</span>
                  <p className="font-medium">₹{preAuthMeta.roomRent}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Admission Date</span>
                <p className="font-medium">{formData.expectedAdmissionDate || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Surgery Date</span>
                <p className="font-medium">{formData.expectedSurgeryDate || '—'}</p>
              </div>
            </div>
          </div>

          {/* Treatment & Surgeon */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Treatment & Surgeon</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Treatment</span>
                <p className="font-medium">{leadData?.treatment || kypData?.disease || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Surgeon</span>
                <p className="font-medium">{leadData?.surgeonName || kypData?.surgeonName || '—'}</p>
              </div>
            </div>
          </div>

          {/* Documents summary */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Documents</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Aadhar Card: {formData.aadharFiles.length} file(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>PAN Card: {formData.panFiles.length} file(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Prescriptions: {formData.prescriptionFiles.length} file(s)</span>
              </div>
              {formData.investigationFileUrls.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Investigation Reports: {formData.investigationFileUrls.length} file(s)</span>
                </div>
              )}
            </div>
          </div>

          {/* Medical & Insurance Details */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Medical & Insurance Details</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Disease</span>
                <p className="font-medium">{formData.diseaseDescription.slice(0, 60)}{formData.diseaseDescription.length > 60 ? '…' : ''}</p>
              </div>
              {preAuthMeta?.tpa && (
                <div>
                  <span className="text-muted-foreground">TPA</span>
                  <p className="font-medium">{preAuthMeta.tpa}</p>
                </div>
              )}
              {preAuthMeta?.insurance && (
                <div>
                  <span className="text-muted-foreground">Insurance Name</span>
                  <p className="font-medium">{preAuthMeta.insurance}</p>
                </div>
              )}
              {preAuthMeta?.sumInsured && (
                <div>
                  <span className="text-muted-foreground">Sum Insured</span>
                  <p className="font-medium">₹{preAuthMeta.sumInsured}</p>
                </div>
              )}
              {preAuthMeta?.copay && (
                <div>
                  <span className="text-muted-foreground">Copay</span>
                  <p className="font-medium">{preAuthMeta.copay}%</p>
                </div>
              )}
            </div>
            {formData.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Notes for Insurance</span>
                <p className="text-sm whitespace-pre-wrap mt-0.5">{formData.notes}</p>
              </div>
            )}
          </div>
        </div>
      ),
    },
  ]

  return (
    <MultiStepForm
      steps={steps}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  )
}
