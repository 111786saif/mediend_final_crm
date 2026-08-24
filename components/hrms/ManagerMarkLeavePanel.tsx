'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
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
import { format } from 'date-fns'
import { toast } from 'sonner'
import { isLwbLeaveType, isSickLeaveType } from '@/lib/hrms/leave-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TeamOption {
  id: string
  name: string
  email: string
  employeeCode?: string
}

interface LeaveType {
  id: string
  name: string
  maxDays: number
  isActive: boolean
  code?: string | null
}

interface PreviewBalance {
  leaveTypeId: string
  leaveTypeName: string
  allocated: number
  used: number
  remaining: number
  locked: number
  isProbation: boolean
  carryForward: boolean
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
    !preview?.probationBlocksLeave &&
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

          {preview?.probationBlocksLeave && preview.probationMessage && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
              <p className="font-medium text-destructive">Leave not available</p>
              <p className="text-destructive/90 mt-1">{preview.probationMessage}</p>
            </div>
          )}

          {employeeId && preview && !preview.probationBlocksLeave && (
            <>
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
                      const isLwb = isLwbLeaveType(lt)
                      const suffix = isLwb
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
                    disabled={isHalfDay}
                    min={startDate ? format(startDate, 'yyyy-MM-dd') : startDateMinStr}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                <Checkbox
                  id="mgr-leave-half"
                  checked={isHalfDay}
                  disabled={!startDate}
                  onCheckedChange={(c) => {
                    const on = c === true
                    if (!startDate) return
                    setIsHalfDay(on)
                    if (on) setEndDate(startDate)
                  }}
                />
                <div>
                  <Label htmlFor="mgr-leave-half" className="text-sm cursor-pointer">
                    Half day (0.5)
                  </Label>
                  <p className="text-xs text-muted-foreground">Single calendar day only.</p>
                </div>
              </div>

              {insufficientBalance && selectedBalance && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
                  <p className="font-medium text-destructive">Insufficient balance</p>
                  <p className="text-destructive/90 mt-1">
                    {selectedBalance.leaveTypeName}: {selectedBalance.remaining} day(s) available,{' '}
                    {effectiveDays} requested. Reduce dates or pick another type.
                  </p>
                </div>
              )}

              <div>
                <Label>Reason (required)</Label>
                <Textarea
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  className="mt-1"
                  rows={3}
                  placeholder="Why you are recording this leave…"
                  required
                />
              </div>

              <Button type="submit" disabled={!canSubmit}>
                {markMutation.isPending ? 'Saving…' : 'Mark leave (approved)'}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
