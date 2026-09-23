'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface MarkDischargedDialogProps {
  leadId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** YYYY-MM-DD prefill, e.g. from BD's IPD-mark discharge entry */
  defaultDate?: string
  onSuccess?: () => void
}

export function MarkDischargedDialog({
  leadId,
  open,
  onOpenChange,
  defaultDate,
  onSuccess,
}: MarkDischargedDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [dischargeDate, setDischargeDate] = useState(defaultDate || today)
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const handleClose = (next: boolean) => {
    if (submitting) return
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!dischargeDate || submitting) return
    setSubmitting(true)
    try {
      await apiPost(`/api/leads/${leadId}/mark-discharged`, { dischargeDate })
      toast.success('Patient marked discharged. Fill the sheet next.')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['discharge-sheet', leadId] })
      queryClient.invalidateQueries({ queryKey: ['stage-history', leadId] })
      queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to mark discharged')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-orange-600" />
            <DialogTitle>Mark Patient Discharged</DialogTitle>
          </div>
          <DialogDescription>
            Confirm the discharge date. Filling the full discharge sheet is a separate step
            and unlocks once this is done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="dischargeDate">Discharge Date *</Label>
          <Input
            id="dischargeDate"
            type="date"
            value={dischargeDate}
            max={today}
            onChange={(e) => setDischargeDate(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!dischargeDate || submitting}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Marking…
              </>
            ) : (
              'Mark Discharged'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
