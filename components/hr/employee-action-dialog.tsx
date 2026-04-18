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

export type EmployeeActionType =
  | 'START_PIP'
  | 'START_NOTICE'
  | 'TERMINATE'
  | 'FNF_PROCESS'
  | 'REACTIVATE'
  | 'ABSCOND'

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
  const [fnfDeadline, setFnfDeadline] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const isDaysAction = action === 'START_PIP' || action === 'START_NOTICE'
  const isTerminate = action === 'TERMINATE'
  const isFnfProcess = action === 'FNF_PROCESS'
  const isReactivate = action === 'REACTIVATE'
  const isAbscond = action === 'ABSCOND'
  const noteRequired = isFnfProcess

  const reset = () => {
    setDays(30)
    setFinalWorkingDay('')
    setFnfDeadline('')
    setNote('')
  }

  const handleSubmit = async () => {
    if (isDaysAction && (!days || days < 1)) {
      toast.error('Please enter a valid number of days')
      return
    }
    if (isTerminate || isFnfProcess) {
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
    if (isFnfProcess) {
      if (!fnfDeadline) {
        toast.error('Please select the FnF deadline')
        return
      }
      const fwd = new Date(finalWorkingDay)
      const fnfd = new Date(fnfDeadline)
      if (isNaN(fnfd.getTime())) {
        toast.error('Invalid FnF deadline')
        return
      }
      if (fnfd < fwd) {
        toast.error('FnF deadline must be on or after the final working day')
        return
      }
    }
    if (noteRequired && !note.trim()) {
      toast.error('Please add a note')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = { action }
      if (isDaysAction) body.days = days
      if (isTerminate || isFnfProcess) {
        body.finalWorkingDay = new Date(finalWorkingDay).toISOString()
      }
      if (isFnfProcess) {
        body.fnfDeadline = new Date(fnfDeadline).toISOString()
      }
      if (note.trim()) body.note = note.trim()

      await apiPatch(`/api/employees/${employeeId}/status`, body)
      toast.success(
        action === 'START_PIP'
          ? `PIP started for ${days} days`
          : action === 'START_NOTICE'
            ? `Notice period started for ${days} days`
            : action === 'TERMINATE'
              ? 'Employee terminated'
              : action === 'FNF_PROCESS'
                ? 'FnF process started'
                : action === 'ABSCOND'
                  ? 'Employee marked as absconded'
                  : 'Employee reactivated'
      )
      onSuccess()
      onOpenChange(false)
      reset()
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
          : action === 'FNF_PROCESS'
            ? 'Start FnF Process'
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
          : action === 'FNF_PROCESS'
            ? `Record ${employeeName}'s termination and the full-and-final settlement deadline.`
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

        <div className="space-y-4 py-4">
          {isDaysAction && (
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
          )}

          {(isTerminate || isFnfProcess) && (
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
          )}

          {isFnfProcess && (
            <div>
              <Label htmlFor="fnfDeadline">FnF settlement deadline</Label>
              <Input
                id="fnfDeadline"
                type="date"
                value={fnfDeadline}
                onChange={(e) => setFnfDeadline(e.target.value)}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Must be on or after the final working day.
              </p>
            </div>
          )}

          {!isReactivate && (
            <div>
              <Label htmlFor="actionNote">
                Note{noteRequired ? '' : ' (optional)'}
              </Label>
              <Textarea
                id="actionNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isAbscond
                    ? 'e.g. Absent since 3rd April without any communication...'
                    : isFnfProcess
                      ? 'e.g. Settlement scope, pending dues, exit checklist owner...'
                      : isTerminate
                        ? 'e.g. Resignation, performance, etc.'
                        : 'Reason or context for this action...'
                }
                rows={3}
                className="mt-2 resize-none"
              />
            </div>
          )}

          {isReactivate && (
            <p className="text-sm text-muted-foreground">
              This will clear all PIP, notice period, termination, and FnF data and set the employee
              back to Active status.
            </p>
          )}
        </div>

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
