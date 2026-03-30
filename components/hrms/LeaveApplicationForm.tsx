'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, subYears } from 'date-fns'
import { toast } from 'sonner'
import { isClElPastBackdateGraceActive, isSickLeaveType } from '@/lib/hrms/leave-utils'

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
  code?: string | null
}

interface BalanceForType {
  leaveTypeId: string
  remaining: number
  allocated: number
  locked?: number
  isProbation?: boolean
}

interface LeaveApplicationFormProps {
  leaveTypes: LeaveType[]
  balances?: BalanceForType[]
  onSubmit: (data: {
    leaveTypeId: string
    startDate: Date
    endDate: Date
    reason?: string
    isHalfDay?: boolean
  }) => void
  isLoading?: boolean
}

export function LeaveApplicationForm({
  leaveTypes,
  balances = [],
  onSubmit,
  isLoading = false,
}: LeaveApplicationFormProps) {
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    reason: '',
    isHalfDay: false,
  })

  const singleCalendarDay = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return false
    return format(formData.startDate, 'yyyy-MM-dd') === format(formData.endDate, 'yyyy-MM-dd')
  }, [formData.startDate, formData.endDate])

  const calculateFullDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const diffTime = formData.endDate.getTime() - formData.startDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays + 1
  }

  const fullDayCount = formData.startDate && formData.endDate ? calculateFullDays() : 0
  const effectiveDays =
    formData.isHalfDay && singleCalendarDay ? 0.5 : fullDayCount

  const selectedBalance = formData.leaveTypeId
    ? balances.find((b) => b.leaveTypeId === formData.leaveTypeId)
    : null
  const wouldBeUnpaid =
    selectedBalance &&
    effectiveDays > 0 &&
    effectiveDays > selectedBalance.remaining

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.leaveTypeId || !formData.startDate || !formData.endDate) {
      return
    }
    if (formData.isHalfDay && !singleCalendarDay) {
      return
    }
    const lt = activeLeaveTypes.find((x) => x.id === formData.leaveTypeId)
    if (lt && !isSickLeaveType(lt) && !isClElPastBackdateGraceActive()) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const s = new Date(formData.startDate)
      s.setHours(0, 0, 0, 0)
      const en = new Date(formData.endDate)
      en.setHours(0, 0, 0, 0)
      if (s < todayStart || en < todayStart) {
        toast.error('CL and EL cannot be applied for past dates. Use Sick Leave (SL).')
        return
      }
    }
    const reasonTrimmed = formData.reason.trim()
    if (!reasonTrimmed) {
      toast.error('Please enter a reason for your leave request')
      return
    }
    onSubmit({
      leaveTypeId: formData.leaveTypeId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      reason: reasonTrimmed,
      ...(formData.isHalfDay && singleCalendarDay ? { isHalfDay: true } : {}),
    })
    setFormData({
      leaveTypeId: '',
      startDate: undefined,
      endDate: undefined,
      reason: '',
      isHalfDay: false,
    })
  }

  const activeLeaveTypes = leaveTypes?.filter((lt) => lt.isActive) || []

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const earliestSelectableStr = format(subYears(new Date(), 2), 'yyyy-MM-dd')

  const selectedLeaveType = formData.leaveTypeId
    ? activeLeaveTypes.find((lt) => lt.id === formData.leaveTypeId)
    : null
  const sickAllowsPast = selectedLeaveType ? isSickLeaveType(selectedLeaveType) : false
  const startDateMinStr = sickAllowsPast ? earliestSelectableStr : todayStr

  const clElPastInvalid = useMemo(() => {
    if (!selectedLeaveType || !formData.startDate || !formData.endDate) return false
    if (isSickLeaveType(selectedLeaveType)) return false
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    const s = new Date(formData.startDate)
    s.setHours(0, 0, 0, 0)
    const e = new Date(formData.endDate)
    e.setHours(0, 0, 0, 0)
    return s < t || e < t
  }, [selectedLeaveType, formData.startDate, formData.endDate])

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Leave Type</Label>
        {activeLeaveTypes.length === 0 ? (
          <div className="text-sm text-muted-foreground p-3 bg-muted rounded border">
            No leave types available. Please contact HR to set up leave types.
          </div>
        ) : (
          <Select
            value={formData.leaveTypeId}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                leaveTypeId: value,
                startDate: undefined,
                endDate: undefined,
                isHalfDay: false,
              }))
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select leave type" />
            </SelectTrigger>
            <SelectContent>
              {activeLeaveTypes.map((leaveType) => {
                const bal = balances.find((b) => b.leaveTypeId === leaveType.id)
                const suffix =
                  bal != null
                    ? ` — ${bal.remaining} available` +
                      (bal.locked != null && bal.locked > 0 ? ` (${bal.locked} locked)` : '')
                    : ''
                return (
                  <SelectItem key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                    {suffix}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value + 'T12:00:00')
                setFormData((prev) => ({
                  ...prev,
                  startDate: d,
                  endDate: prev.isHalfDay ? d : prev.endDate,
                }))
              }
            }}
            required
            min={startDateMinStr}
          />
        </div>

        <div>
          <Label>End Date</Label>
          <Input
            type="date"
            value={formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value + 'T12:00:00')
                setFormData((prev) => ({
                  ...prev,
                  endDate: d,
                  isHalfDay:
                    prev.isHalfDay && format(prev.startDate ?? d, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'),
                }))
              }
            }}
            required
            disabled={formData.isHalfDay}
            min={
              formData.startDate
                ? format(formData.startDate, 'yyyy-MM-dd')
                : startDateMinStr
            }
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
        <Checkbox
          id="leave-half-day"
          checked={formData.isHalfDay}
          disabled={!formData.startDate}
          onCheckedChange={(checked) => {
            const on = checked === true
            setFormData((prev) => {
              if (!prev.startDate) return prev
              if (on) {
                return {
                  ...prev,
                  isHalfDay: true,
                  endDate: prev.startDate,
                }
              }
              return { ...prev, isHalfDay: false }
            })
          }}
        />
        <div className="grid gap-1 leading-none">
          <Label htmlFor="leave-half-day" className="text-sm font-medium cursor-pointer">
            Half day (0.5 day)
          </Label>
          <p className="text-xs text-muted-foreground">
            Only for a single calendar day. Uses 0.5 from your leave balance.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {sickAllowsPast
          ? 'Sick leave (SL) can be applied for past, today, or future dates (within policy limits).'
          : 'Choose start and end dates; the system validates them for your leave type and balance.'}
      </p>

      {formData.startDate && formData.endDate && (
        <div>
          <Label>Total</Label>
          <Input
            value={
              formData.isHalfDay && singleCalendarDay
                ? '0.5 day'
                : `${fullDayCount} day${fullDayCount === 1 ? '' : 's'}`
            }
            disabled
          />
        </div>
      )}

      {wouldBeUnpaid && selectedBalance && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
          You have {selectedBalance.remaining} day(s) remaining.{' '}
          {(effectiveDays - selectedBalance.remaining).toFixed(1).replace(/\.0$/, '')} day(s) will be
          marked as unpaid leave.
        </div>
      )}

      <div>
        <Label>Reason (required)</Label>
        <Textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Enter reason for leave..."
          rows={3}
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={
            isLoading ||
            !formData.leaveTypeId ||
            !formData.startDate ||
            !formData.endDate ||
            !formData.reason.trim() ||
            (formData.isHalfDay && !singleCalendarDay) ||
            clElPastInvalid
          }
        >
          {isLoading ? 'Submitting...' : 'Apply for Leave'}
        </Button>
      </div>
    </form>
  )
}
