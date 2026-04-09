'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiPatch } from '@/lib/api-client'
import { toast } from 'sonner'

export type EmployeeActionType = 'START_PIP' | 'START_NOTICE' | 'TERMINATE' | 'REACTIVATE' | 'ABSCOND'

export interface EmployeeActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  action: EmployeeActionType
  onSuccess: () => void
}

const QUICK_DAYS = [30, 60, 90]

export function EmployeeActionDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  action,
  onSuccess,
}: EmployeeActionDialogProps) {
  const [days, setDays] = useState<number>(30)
  const [finalWorkingDay, setFinalWorkingDay] = useState('')
  const [terminationReason, setTerminationReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const isDaysAction = action === 'START_PIP' || action === 'START_NOTICE'
  const isTerminate = action === 'TERMINATE'
  const isReactivate = action === 'REACTIVATE'
  const isAbscond = action === 'ABSCOND'

  const handleSubmit = async () => {
    if (isDaysAction && (!days || days < 1)) {
      toast.error('Please enter a valid number of days')
      return
    }
    if (isTerminate) {
      if (!finalWorkingDay) {
        toast.error('Please select the final working day')
        return
      }
      const d = new Date(finalWorkingDay)
      if (isNaN(d.getTime())) {
        toast.error('Invalid date')
        return
      }
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = { action }
      if (isDaysAction) body.days = days
      if (isTerminate) {
        body.finalWorkingDay = new Date(finalWorkingDay).toISOString()
        if (terminationReason.trim()) body.terminationReason = terminationReason.trim()
      }
      if (isAbscond && note.trim()) body.note = note.trim()

      await apiPatch(`/api/employees/${employeeId}/status`, body)
      toast.success(
        action === 'START_PIP'
          ? `PIP started for ${days} days`
          : action === 'START_NOTICE'
            ? `Notice period started for ${days} days`
            : action === 'TERMINATE'
              ? 'Employee terminated'
              : action === 'ABSCOND'
                ? 'Employee marked as absconded'
                : 'Employee reactivated'
      )
      onSuccess()
      onOpenChange(false)
      setDays(30)
      setFinalWorkingDay('')
      setTerminationReason('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setLoading(false)
    }
  }

  const title =
    action === 'START_PIP'
      ? 'Start PIP'
      : action === 'START_NOTICE'
        ? 'Start Notice Period'
        : action === 'TERMINATE'
          ? 'Terminate Employee'
          : action === 'ABSCOND'
            ? 'Mark as Absconded'
            : 'Reactivate Employee'

  const description =
    action === 'START_PIP'
      ? `Put ${employeeName} on a Performance Improvement Plan.`
      : action === 'START_NOTICE'
        ? `Put ${employeeName} on notice period. Final working day will be set automatically.`
        : action === 'TERMINATE'
          ? `Record ${employeeName}'s termination. This will set status to Inactive.`
          : action === 'ABSCOND'
            ? `Mark ${employeeName} as absconded. No FNF will be processed.`
            : `Clear PIP/Notice/Termination status and set ${employeeName} back to Active.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isDaysAction && (
          <div className="space-y-4 py-4">
            <div>
              <Label>Number of days</Label>
              <div className="mt-2 flex gap-2">
                {QUICK_DAYS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={days === d ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDays(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10) || 0)}
                className="mt-2 max-w-[120px]"
              />
            </div>
          </div>
        )}

        {isReactivate && (
          <p className="text-sm text-muted-foreground py-4">
            This will clear all PIP, notice period, and termination data and set the employee back to Active status.
          </p>
        )}

        {isTerminate && (
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="finalWorkingDay">Final working day</Label>
              <Input
                id="finalWorkingDay"
                type="date"
                value={finalWorkingDay}
                onChange={(e) => setFinalWorkingDay(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="terminationReason">Reason (optional)</Label>
              <Textarea
                id="terminationReason"
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="e.g. Resignation, Performance, etc."
                rows={3}
                className="mt-2 resize-none"
              />
            </div>
          </div>
        )}

        {isAbscond && (
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="abscondNote">Note</Label>
              <Textarea
                id="abscondNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Absent since 3rd April without any communication..."
                rows={3}
                className="mt-2 resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
