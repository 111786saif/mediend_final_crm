'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiGet, apiPost } from '@/lib/api-client'

interface ResetTarget {
  number: number
  label: string
  shortLabel: string
  owner: 'BD' | 'INSURANCE'
}

interface ResetOptions {
  currentStep: {
    number: number
    label: string
    caseStage: string
  }
  targets: ResetTarget[]
}

interface ResetStepperDialogProps {
  leadId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ResetStepperDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess,
}: ResetStepperDialogProps) {
  const queryClient = useQueryClient()
  const [targetStep, setTargetStep] = useState<string>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reset-stepper-options', leadId],
    queryFn: () => apiGet<ResetOptions>(`/api/leads/${leadId}/reset-stepper`),
    enabled: open && !!leadId,
  })

  useEffect(() => {
    if (!open) {
      setTargetStep('')
      setReason('')
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (data?.targets?.length && !targetStep) {
      // Default to the most recent completed step.
      const last = data.targets[data.targets.length - 1]
      if (last) setTargetStep(String(last.number))
    }
  }, [data, targetStep])

  const selected = useMemo(
    () => data?.targets.find((t) => String(t.number) === targetStep) ?? null,
    [data, targetStep],
  )

  const stepsReverted =
    data && selected ? Math.max(0, data.currentStep.number - selected.number) : 0

  const canSubmit = !!selected && reason.trim().length > 0 && !submitting

  const handleClose = (next: boolean) => {
    if (submitting) return
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return
    setSubmitting(true)
    try {
      await apiPost(`/api/leads/${leadId}/reset-stepper`, {
        targetStep: selected.number,
        reason: reason.trim(),
      })
      toast.success(`Workflow reset to “${selected.label}”`)
      onOpenChange(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['stage-history', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['insurance-initiate-form', leadId] }),
        queryClient.invalidateQueries({ queryKey: ['reset-stepper-options', leadId] }),
      ])
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset workflow step')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <RotateCcw className="h-5 w-5" />
            Reset Workflow Step
          </DialogTitle>
          <DialogDescription>
            Move this case back to a previously completed step. Later step data will be cleared
            and must be completed again. The lead will be reassigned to the Team Lead.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading steps…
          </div>
        ) : isError ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Failed to load reset options'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !data?.targets.length ? (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No previous completed steps are available to reset to for this case.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <div className="space-y-1 text-amber-900 dark:text-amber-100">
                  <p>
                    <span className="font-medium">Current Step:</span> Step{' '}
                    {data.currentStep.number} — {data.currentStep.label}
                  </p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
                    Steps after the selected target become Pending. Approvals and documents for
                    those steps are invalidated. This action is permanently audited.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="resetToStep">
                Reset To <span className="text-red-500">*</span>
              </Label>
              <Select value={targetStep} onValueChange={setTargetStep} disabled={submitting}>
                <SelectTrigger id="resetToStep" className="mt-1">
                  <SelectValue placeholder="Select a previous step" />
                </SelectTrigger>
                <SelectContent>
                  {data.targets.map((t) => (
                    <SelectItem key={t.number} value={String(t.number)}>
                      Step {t.number}: {t.label} ({t.owner})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {stepsReverted === 0
                    ? 'Selected step will be reopened for completion.'
                    : `${stepsReverted} step${stepsReverted === 1 ? '' : 's'} will be reverted.`}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="resetStepperReason">
                Reason for Reset <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="resetStepperReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this case being reset? (required)"
                rows={4}
                className="mt-1 resize-none"
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={!canSubmit} onClick={handleSubmit}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Resetting…' : 'Confirm Reset'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
