'use client'

import { useMemo, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiGet, apiPost } from '@/lib/api-client'
import { isLwbLeaveType, isSickLeaveType } from '@/lib/hrms/leave-utils'

interface TeamOption {
  id: string
  name: string
  employeeCode: string | null
  email: string
}

interface LeaveType {
  id: string
  name: string
  code: string
  maxDays: number
  isActive: boolean
}

interface PreviewBalance {
  leaveTypeId: string
  leaveTypeName: string
  allocated: number
  used: number
  remaining: number
  locked: number
  isProbation: boolean
  carryForward: number
}

interface SubordinatePreview {
  employeeId: string
  employeeName: string
  employeeEmail: string
  employeeCode: string
  probationBlocksLeave: boolean
  probationMessage: string | null
  balances: PreviewBalance[]
}

interface ManagerMarkLeavePanelProps {
  teamOptions: TeamOption[]
}

export function ManagerMarkLeavePanel({ teamOptions }: ManagerMarkLeavePanelProps) {
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [reason, setReason] = useState('')
  const [isHalfDay, setIsHalfDay] = useState(false)

  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leaveTypes', 'manager-mark'],
    queryFn: () => apiGet<LeaveType[]>('/api/leaves/types?activeOnly=true'),
  })

  const { data: preview, isLoading: previewLoading } = useQuery<SubordinatePreview>({
    queryKey: ['leaves', 'subordinate-preview', employeeId],
    queryFn: () => apiGet<SubordinatePreview>(`/api/leaves/subordinate-preview?employeeId=${employeeId}`),
    enabled: !!employeeId,
  })

  const markMutation = useMutation({
    mutationFn: (payload: {
      employeeId: string
      leaveTypeId: string
      startDate: string
      endDate: string
      reason: string
      isHalfDay?: boolean
    }) => apiPost<unknown>('/api/leaves/manager-mark', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'leaves'] })
      queryClient.invalidateQueries({ queryKey: ['hierarchy', 'my-team', 'attendance'] })
      queryClient.invalidateQueries({ queryKey: ['leaves', 'subordinate-preview', employeeId] })
      setStartDate(undefined)
      setEndDate(undefined)
      setReason('')
      setIsHalfDay(false)
      setLeaveTypeId('')
      toast.success('Leave marked and approved for team member')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to mark leave'),
  })

  const activeLeaveTypes = useMemo(() => {
    const active = leaveTypes.filter((lt) => lt.isActive)
    const hasLwb = active.some((lt) => lt.code === 'LWB' || lt.name === 'LWB')
    if (!hasLwb) {
      return [
        ...active,
        {
          id: 'lwb-default',
          name: 'LWB',
          code: 'LWB',
          maxDays: 365,
          isActive: true,
        },
      ]
    }
    return active
  }, [leaveTypes])

  // Automatically default to LWB if the employee is in probation or has no paid balances
  useEffect(() => {
    if (preview && !leaveTypeId) {
      const lwbType = activeLeaveTypes.find((lt) => isLwbLeaveType(lt))
      const hasPaidBalance = preview.balances.some((b) => !b.isProbation && b.remaining > 0)
      if ((preview.probationBlocksLeave || !hasPaidBalance) && lwbType) {
        setLeaveTypeId(lwbType.id)
      }
    }
  }, [preview, leaveTypeId, activeLeaveTypes])

  const selectedLeaveType = leaveTypeId
    ? activeLeaveTypes.find((lt) => lt.id === leaveTypeId)
    : null
  const sickOrLwbAllowsPast = selectedLeaveType
    ? isSickLeaveType(selectedLeaveType) || isLwbLeaveType(selectedLeaveType)
    : false
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const earliestSelectableStr = format(
    new Date(new Date().setFullYear(new Date().getFullYear() - 2)),
    'yyyy-MM-dd'
  )
  const startDateMinStr = sickOrLwbAllowsPast ? earliestSelectableStr : todayStr

  const singleCalendarDay =
    startDate && endDate ? format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd') : false

  const fullDayCount =
    startDate && endDate
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 0
  const effectiveDays = isHalfDay && singleCalendarDay ? 0.5 : fullDayCount

  const selectedBalance = leaveTypeId
    ? preview?.balances.find((b) => b.leaveTypeId === leaveTypeId)
    : null

  const isLwb = selectedLeaveType ? isLwbLeaveType(selectedLeaveType) : false

  const isProbation = preview?.probationBlocksLeave || false
  const probationPaidLeaveBlocked = isProbation && !isLwb

  const insufficientBalance =
    selectedBalance != null &&
    effectiveDays > 0 &&
    !isLwb &&
    selectedBalance.remaining < effectiveDays

  const canSubmit =
    !!employeeId &&
    !!leaveTypeId &&
    !!startDate &&
    !!endDate &&
    reason.trim().length > 0 &&
    !probationPaidLeaveBlocked &&
    !insufficientBalance &&
    !(isHalfDay && !singleCalendarDay) &&
    !markMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !startDate || !endDate) return
    markMutation.mutate({
      employeeId,
      leaveTypeId,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      reason: reason.trim(),
      ...(isHalfDay ? { isHalfDay: true } : {}),
    })
  }

  if (teamOptions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark leave for team member</CardTitle>
        <CardDescription>
          Records leave as approved immediately (no workflow). Paid leave (CL, SL, EL) or LWB (unpaid/salary cut) can be marked for team members.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div>
            <Label>Team member</Label>
            <Select
              value={employeeId || undefined}
              onValueChange={(v) => {
                setEmployeeId(v)
                setLeaveTypeId('')
                setStartDate(undefined)
                setEndDate(undefined)
                setIsHalfDay(false)
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {teamOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.employeeCode ? ` (${t.employeeCode})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {employeeId && previewLoading && (
            <p className="text-sm text-muted-foreground">Loading balances…</p>
          )}

          {employeeId && preview && (
            <>
              {preview.probationMessage && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-medium">Probation period</p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5 text-xs">
                    {preview.probationMessage}
                  </p>
                </div>
              )}

              {preview.probationBlocksLeave && (
                <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-blue-900 dark:text-blue-200 mb-3">
                  <p className="font-medium">Employee is on probation</p>
                  <p className="text-blue-800 dark:text-blue-300 mt-0.5 text-xs">
                    Paid leaves (CL, SL, EL) are not available. You can apply for <strong>LWB (Leave Without Pay)</strong> only.
                  </p>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{preview.employeeName}</p>
                <p className="text-muted-foreground text-xs">{preview.employeeCode} · {preview.employeeEmail}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preview.balances.map((b) => (
                    <span
                      key={b.leaveTypeId}
                      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs"
                    >
                      <span className="font-medium">{b.leaveTypeName}</span>
                      <span className="ml-1 tabular-nums text-muted-foreground">
                        {b.remaining} left
                        {b.locked > 0 ? ` · locked ${b.locked}` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Label>Leave type</Label>
                <Select
                  value={leaveTypeId || undefined}
                  onValueChange={(v) => {
                    setLeaveTypeId(v)
                    setStartDate(undefined)
                    setEndDate(undefined)
                    setIsHalfDay(false)
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLeaveTypes.map((lt) => {
                      const bal = preview.balances.find((b) => b.leaveTypeId === lt.id)
                      const isLwbItem = isLwbLeaveType(lt)
                      const suffix = isLwbItem
                        ? ' — Unpaid (Salary Cut)'
                        : bal != null
                          ? ` — ${bal.remaining} available` +
                            (bal.locked > 0 ? ` (${bal.locked} locked)` : '')
                          : ''
                      return (
                        <SelectItem key={lt.id} value={lt.id}>
                          {lt.name}
                          {suffix}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {probationPaidLeaveBlocked && (
                  <p className="text-xs text-destructive mt-1.5 font-medium">
                    Paid leave is locked during probation. Please select <strong>LWB (Unpaid / Salary Cut)</strong> to mark leave.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                    onChange={(ev) => {
                      const v = ev.target.value
                      setStartDate(v ? new Date(v + 'T12:00:00') : undefined)
                      if (isHalfDay && v) setEndDate(new Date(v + 'T12:00:00'))
                    }}
                    min={startDateMinStr}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                    onChange={(ev) => {
                      const v = ev.target.value
                      setEndDate(v ? new Date(v + 'T12:00:00') : undefined)
                    }}
                    min={startDate ? format(startDate, 'yyyy-MM-dd') : startDateMinStr}
                    disabled={isHalfDay}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="manager-half-day"
                  checked={isHalfDay}
                  onCheckedChange={(c) => {
                    const checked = c === true
                    setIsHalfDay(checked)
                    if (checked && startDate) {
                      setEndDate(startDate)
                    }
                  }}
                />
                <Label htmlFor="manager-half-day" className="text-sm font-normal cursor-pointer">
                  Half day (0.5 day)
                </Label>
              </div>

              {startDate && endDate && (
                <p className="text-sm text-muted-foreground">
                  Days: <span className="font-semibold text-foreground">{effectiveDays}</span>
                  {selectedBalance && !isLwb && (
                    <>
                      {' '}
                      (Remaining after: {Math.max(0, selectedBalance.remaining - effectiveDays)})
                    </>
                  )}
                  {isLwb && (
                    <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">
                      (Leave Without Pay — marked with salary cut)
                    </span>
                  )}
                </p>
              )}

              {insufficientBalance && (
                <p className="text-sm text-destructive">
                  Insufficient balance for {selectedBalance?.leaveTypeName}. Available: {selectedBalance?.remaining}
                </p>
              )}

              <div>
                <Label>Reason / note</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="Reason for marking leave (e.g., informed over phone / emergency)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={!canSubmit} className="w-full">
                {markMutation.isPending ? 'Marking leave…' : 'Mark leave as approved'}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
