'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const CONFIRMATION_PHRASE = 'yes reset this lead'

interface ResetPatientDialogProps {
  leadId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ResetPatientDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess,
}: ResetPatientDialogProps) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const phraseMatches = confirmation.trim().toLowerCase() === CONFIRMATION_PHRASE
  const reasonValid = reason.trim().length > 0
  const canSubmit = phraseMatches && reasonValid && !submitting

  const reset = () => {
    setReason('')
    setConfirmation('')
  }

  const handleClose = (next: boolean) => {
    if (submitting) return
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await apiPost(`/api/leads/${leadId}/reset-patient`, {
        confirmation: confirmation.trim(),
        reason: reason.trim(),
      })
      toast.success('Patient reset to Hospitals Suggested')
      reset()
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
      queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
      queryClient.invalidateQueries({ queryKey: ['stage-history', leadId] })
      queryClient.invalidateQueries({ queryKey: ['insurance-initiate-form', leadId] })
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset patient')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Reset Patient — Danger Zone
          </DialogTitle>
          <DialogDescription>
            This is a destructive action. Are you sure you want to reset this patient?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm">
            <p className="font-medium text-red-700 dark:text-red-400 mb-2">
              The reset will:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-red-800 dark:text-red-300">
              <li>Move the case back to <strong>Hospitals Suggested</strong></li>
              <li>Clear pre-auth approval / rejection state</li>
              <li>Delete the Insurance Initiate Form (if filled)</li>
              <li>Delete the Admission Record (if marked admitted)</li>
              <li>
                Remove uploaded prescriptions, investigation reports, and disease
                photos. <strong>Aadhaar, PAN, and Insurance Card are kept.</strong>
              </li>
              <li>Notify BD and Insurance Head with the reason below</li>
            </ul>
          </div>

          <div>
            <Label htmlFor="resetReason">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="resetReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you resetting this patient? (e.g. hospital unavailable, policy mismatch)"
              rows={3}
              className="mt-1 resize-none"
              disabled={submitting}
            />
          </div>

          <div>
            <Label htmlFor="resetConfirm">
              Type <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">{CONFIRMATION_PHRASE}</code> to confirm <span className="text-red-500">*</span>
            </Label>
            <Input
              id="resetConfirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
              className="mt-1 font-mono"
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Resetting...' : 'Reset Patient'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
