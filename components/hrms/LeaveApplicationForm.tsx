'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, subYears } from 'date-fns'

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
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
    onSubmit({
      leaveTypeId: formData.leaveTypeId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      reason: formData.reason || undefined,
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
            onValueChange={(value) => setFormData({ ...formData, leaveTypeId: value })}
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
            min={earliestSelectableStr}
            max={todayStr}
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
                : earliestSelectableStr
            }
            max={todayStr}
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
        You can select today or an earlier date if you need to record leave for a day you were absent.
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
        <Label>Reason (Optional)</Label>
        <Textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Enter reason for leave..."
          rows={3}
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
            (formData.isHalfDay && !singleCalendarDay)
          }
        >
          {isLoading ? 'Submitting...' : 'Apply for Leave'}
        </Button>
      </div>
    </form>
  )
}
