'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { CheckCircle, Pause, XCircle, ArrowLeft } from 'lucide-react'

interface IPDStatusHistory {
  status: string
  date: string
  reason?: string
  notes?: string
}

interface IPDMarkComponentProps {
  leadId: string
  currentStatus?: string
  statusHistory?: IPDStatusHistory[]
  onSuccess?: () => void
  onCancel?: () => void
}

type Step = 'select' | 'details'

export function IPDMarkComponent({
  leadId,
  currentStatus,
  statusHistory = [],
  onSuccess,
  onCancel,
}: IPDMarkComponentProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedStatus, setSelectedStatus] = useState<'ADMITTED_DONE' | 'IPD_DONE' | 'POSTPONED' | 'CANCELLED' | null>(null)
  const [formData, setFormData] = useState({
    reason: '',
    newSurgeryDate: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!selectedStatus) {
      newErrors.status = 'Please select an IPD status'
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
        newSurgeryDate: selectedStatus === 'POSTPONED' ? formData.newSurgeryDate : undefined,
        notes: formData.notes.trim() || undefined,
      })

      toast.success(`IPD status marked as ${selectedStatus}`)
      setStep('select')
      setSelectedStatus(null)
      setFormData({ reason: '', newSurgeryDate: '', notes: '' })
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark IPD status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const option = selectedStatus ? statusOptions.find(o => o.value === selectedStatus) : null

  // Step 2: Details form for selected status (after clicking a card)
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
              {selectedStatus === 'IPD_DONE' && (
                <div className="rounded-md border border-teal-300 bg-teal-50 dark:bg-teal-900/40 px-3 py-2 text-sm text-teal-900 dark:text-teal-100">
                  Once you confirm, this case will move to the Insurance team for the discharge sheet. Your part is done — you do not need to know or enter the discharge date.
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
              onClick={() => { setStep('select'); setErrors({}) }}
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Step 1: Select status (cards only)
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select IPD Status</h3>
        <p className="text-sm text-muted-foreground mb-4">Choose the status to update. You will fill in details on the next step.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statusOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedStatus(option.value)
                  setFormData({ reason: '', newSurgeryDate: '', notes: '' })
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
