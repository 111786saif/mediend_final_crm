'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api-client'
import { localDateInputValue, localDateTimeToUtcIso } from '@/lib/local-date-time'
import { useFileUpload } from '@/hooks/use-file-upload'
import { toast } from 'sonner'
import { CheckCircle, Pause, XCircle, ArrowLeft, File } from 'lucide-react'

interface IPDStatusHistory {
  status: string
  date: string
  reason?: string
  notes?: string
}

interface AadharFile {
  name: string
  url: string
}

interface IPDMarkComponentProps {
  leadId: string
  isCashFlow?: boolean
  currentStatus?: string
  statusHistory?: IPDStatusHistory[]
  defaultSurgeryDate?: string | null
  defaultPatientName?: string
  existingAadharFiles?: AadharFile[]
  onSuccess?: () => void
  onCancel?: () => void
}

type Step = 'select' | 'details'
type IpdStatus = 'ADMITTED_DONE' | 'IPD_DONE' | 'POSTPONED' | 'CANCELLED'

const PATIENT_DETAIL_STATUSES = new Set<IpdStatus>(['ADMITTED_DONE', 'IPD_DONE'])

function formatDateInput(value: string | Date | null | undefined): string {
  return localDateInputValue(value)
}

function PatientDetailsFields({
  aadharRequired,
  patientName,
  onPatientNameChange,
  aadharFiles,
  onAadharUpload,
  onRemoveAadhar,
  uploading,
  errors,
}: {
  aadharRequired: boolean
  patientName: string
  onPatientNameChange: (value: string) => void
  aadharFiles: AadharFile[]
  onAadharUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAadhar: (index: number) => void
  uploading: boolean
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">Patient details</p>
      <div>
        <Label htmlFor="ipdPatientName">Patient Name *</Label>
        <Input
          id="ipdPatientName"
          value={patientName}
          onChange={(e) => onPatientNameChange(e.target.value)}
          placeholder="Enter patient name"
          required
          className="mt-1"
        />
        {errors.patientName && <p className="text-xs text-destructive mt-1">{errors.patientName}</p>}
      </div>
      <div>
        <Label htmlFor="ipdAadharUpload">
          Aadhaar Document
          {aadharRequired ? ' *' : ' (Optional)'}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-1">Upload PDF or image (JPG, PNG).</p>
        <Input
          id="ipdAadharUpload"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={onAadharUpload}
          disabled={uploading}
          className="mt-1"
        />
        {errors.aadharDocument && (
          <p className="text-xs text-destructive mt-1">{errors.aadharDocument}</p>
        )}
        {aadharFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {aadharFiles.map((file, index) => (
              <div
                key={`${file.url}-${index}`}
                className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm"
              >
                <File className="h-4 w-4 shrink-0" />
                <button
                  type="button"
                  className="max-w-[140px] truncate underline-offset-2 hover:underline"
                  onClick={() => window.open(file.url, '_blank')}
                >
                  {file.name}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0 text-destructive"
                  onClick={() => onRemoveAadhar(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function IPDMarkComponent({
  leadId,
  isCashFlow = false,
  defaultSurgeryDate,
  defaultPatientName = '',
  existingAadharFiles = [],
  onSuccess,
  onCancel,
}: IPDMarkComponentProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedStatus, setSelectedStatus] = useState<IpdStatus | null>(null)
  const [patientName, setPatientName] = useState(defaultPatientName)
  const [aadharFiles, setAadharFiles] = useState<AadharFile[]>(existingAadharFiles)
  const [formData, setFormData] = useState({
    reason: '',
    newSurgeryDate: '',
    surgeryDate: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { uploadFile, uploading } = useFileUpload({ folder: 'ipd-mark' })

  const statusOptions = [
    {
      value: 'ADMITTED_DONE' as const,
      label: 'Admitted',
      icon: CheckCircle,
      color: 'bg-green-100 dark:bg-green-900 border-green-300',
      description: 'Patient has been admitted',
    },
    {
      value: 'IPD_DONE' as const,
      label: 'Surgery Done',
      icon: CheckCircle,
      color: 'bg-teal-100 dark:bg-teal-900 border-teal-300',
      description: 'Surgery complete — hands the case to Insurance for discharge. Your work is done.',
    },
    {
      value: 'POSTPONED' as const,
      label: 'Postponed',
      icon: Pause,
      color: 'bg-yellow-100 dark:bg-yellow-900 ',
      description: 'Surgery has been postponed to a later date',
    },
    {
      value: 'CANCELLED' as const,
      label: 'Cancelled',
      icon: XCircle,
      color: 'bg-red-100 dark:bg-red-900 border-red-300',
      description: 'Surgery has been cancelled',
    },
  ]

  const requiresPatientDetails = selectedStatus != null && PATIENT_DETAIL_STATUSES.has(selectedStatus)
  const requiresAadharDocument =
    selectedStatus === 'ADMITTED_DONE' ||
    (selectedStatus === 'IPD_DONE' && !isCashFlow)

  const handleAadharUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = await uploadFile(file)
    if (result?.url) {
      setAadharFiles((prev) => [...prev, { name: file.name, url: result.url }])
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!selectedStatus) {
      newErrors.status = 'Please select an IPD status'
    }

    if (requiresPatientDetails) {
      if (!patientName.trim()) newErrors.patientName = 'Patient name is required'
      if (requiresAadharDocument && aadharFiles.length === 0) {
        newErrors.aadharDocument = 'Aadhaar document upload is required'
      }
    }

    if (selectedStatus === 'IPD_DONE') {
      if (!formData.surgeryDate) newErrors.surgeryDate = 'Surgery date is required when marking surgery done'
    }

    if (selectedStatus === 'POSTPONED') {
      if (!formData.reason.trim()) newErrors.reason = 'Reason for postponement is required'
      if (!formData.newSurgeryDate) newErrors.newSurgeryDate = 'New surgery date is required'
    }

    if (selectedStatus === 'CANCELLED') {
      if (!formData.reason.trim()) newErrors.reason = 'Reason for cancellation is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors')
      return
    }

    setIsSubmitting(true)
    try {
      await apiPost(`/api/leads/${leadId}/ipd-mark`, {
        status: selectedStatus,
        reason: formData.reason.trim() || undefined,
        newSurgeryDate:
          selectedStatus === 'POSTPONED'
            ? localDateTimeToUtcIso(formData.newSurgeryDate)
            : undefined,
        surgeryDate:
          selectedStatus === 'IPD_DONE'
            ? localDateTimeToUtcIso(formData.surgeryDate)
            : undefined,
        notes: formData.notes.trim() || undefined,
        ...(requiresPatientDetails
          ? {
              patientName: patientName.trim(),
              aadharDocumentUrl: aadharFiles[0]?.url,
              aadharFiles,
            }
          : {}),
      })

      toast.success(`IPD status marked as ${selectedStatus}`)
      setStep('select')
      setSelectedStatus(null)
      setPatientName(defaultPatientName)
      setAadharFiles(existingAadharFiles)
      setFormData({ reason: '', newSurgeryDate: '', surgeryDate: '', notes: '' })
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark IPD status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const option = selectedStatus ? statusOptions.find((o) => o.value === selectedStatus) : null

  const patientDetailsBlock = requiresPatientDetails ? (
              <PatientDetailsFields
                aadharRequired={requiresAadharDocument}
                patientName={patientName}
                onPatientNameChange={setPatientName}
                aadharFiles={aadharFiles}
      onAadharUpload={handleAadharUpload}
      onRemoveAadhar={(index) => setAadharFiles((prev) => prev.filter((_, i) => i !== index))}
      uploading={uploading}
      errors={errors}
    />
  ) : null

  if (step === 'details' && selectedStatus && option) {
    const Icon = option.icon
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep('select')
              setErrors({})
            }}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <div className={`p-4 rounded-lg border-2 ${option.color} border-current`}>
          <div className="flex items-center gap-2 mb-4">
            <Icon className="h-5 w-5 shrink-0" />
            <h3 className="text-lg font-semibold">{option.label}</h3>
          </div>

          {(selectedStatus === 'ADMITTED_DONE' || selectedStatus === 'IPD_DONE') && (
            <div className="space-y-4">
              {patientDetailsBlock}
              {selectedStatus === 'IPD_DONE' && (
                <>
                  <div className="rounded-md border border-teal-300 bg-teal-50 dark:bg-teal-900/40 px-3 py-2 text-sm text-teal-900 dark:text-teal-100">
                    Once you confirm, this case will move to the Insurance team for the discharge sheet. Your part is done — you do not need to know or enter the discharge date.
                  </div>
                  <div>
                    <Label htmlFor="surgeryDate">Surgery Date *</Label>
                    <Input
                      id="surgeryDate"
                      type="date"
                      value={formData.surgeryDate}
                      onChange={(e) => setFormData({ ...formData, surgeryDate: e.target.value })}
                      required
                      className="mt-1"
                    />
                    {errors.surgeryDate && <p className="text-xs text-destructive mt-1">{errors.surgeryDate}</p>}
                  </div>
                </>
              )}
              {selectedStatus === 'ADMITTED_DONE' && (
                <div className="rounded-md border border-green-300 bg-green-50 dark:bg-green-900/40 px-3 py-2 text-sm text-green-900 dark:text-green-100">
                  Marking this patient as admitted.
                </div>
              )}
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any remarks or observations"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {selectedStatus === 'POSTPONED' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Postponement *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain why surgery is being postponed"
                  required
                  rows={2}
                  className="mt-1"
                />
                {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason}</p>}
              </div>
              <div>
                <Label htmlFor="newSurgeryDate">New Surgery Date *</Label>
                <Input
                  id="newSurgeryDate"
                  type="date"
                  value={formData.newSurgeryDate}
                  onChange={(e) => setFormData({ ...formData, newSurgeryDate: e.target.value })}
                  required
                  className="mt-1"
                />
                {errors.newSurgeryDate && <p className="text-xs text-destructive mt-1">{errors.newSurgeryDate}</p>}
              </div>
              <div>
                <Label htmlFor="notes2">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {selectedStatus === 'CANCELLED' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cancelReason">Reason for Cancellation *</Label>
                <Textarea
                  id="cancelReason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain why surgery is being cancelled"
                  required
                  rows={2}
                  className="mt-1"
                />
                {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason}</p>}
              </div>
              <div>
                <Label htmlFor="cancelNotes">Additional Notes (Optional)</Label>
                <Textarea
                  id="cancelNotes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information"
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep('select')
                setErrors({})
              }}
            >
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Updating...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select IPD Status</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isCashFlow
                  ? 'Choose the status to update. Admitted requires patient name and Aadhaar document. Surgery Done requires patient name; Aadhaar is optional.'
                  : 'Choose the status to update. Admitted and Surgery Done require patient name and Aadhaar document.'}
              </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedStatus(option.value)
                  setPatientName(defaultPatientName)
                  setAadharFiles(existingAadharFiles)
                  setFormData({
                    reason: '',
                    newSurgeryDate: '',
                    surgeryDate: option.value === 'IPD_DONE' ? formatDateInput(defaultSurgeryDate) : '',
                    notes: '',
                  })
                  setErrors({})
                  setStep('details')
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedStatus === option.value
                    ? `${option.color} border-current`
                    : `${option.color} border-transparent hover:border-current`
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
