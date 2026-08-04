'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { History, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import {
  useBulkCostActivity,
  useBulkCostEmployees,
  useBulkCostEntries,
  useSaveBulkCosts,
  type BulkCostType,
} from '@/hooks/use-sales-team-bulk-costs'
import type { BulkCostEntryDto } from '@/lib/sales-team-cost/bulk-cost-entries'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { cn } from '@/lib/utils'

const NONE_EMPLOYEE = '__none__'

interface BulkCostActivityDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  costType: BulkCostType
  month: number
  year: number
  /** Same Misc/Other total shown on the Sales Team Cost breakdown card. */
  dashboardTotal?: number
}

function actionStyles(action: string) {
  const a = action.toUpperCase()
  if (a === 'CREATE') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  if (a === 'UPDATE') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  if (a === 'DELETE') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
  return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
}

export function BulkCostActivityDrawer({
  open,
  onOpenChange,
  costType,
  month,
  year,
  dashboardTotal,
}: BulkCostActivityDrawerProps) {
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false
  const costLabel = costType === 'MISC' ? 'Misc Cost' : 'Other Cost'
  const skipBackOnCloseRef = useRef(false)
  const [historyScope, setHistoryScope] = useState<'month' | 'all'>('month')
  const [editEntry, setEditEntry] = useState<BulkCostEntryDto | null>(null)

  const { data: entriesData, isLoading: loadingEntries } = useBulkCostEntries(
    open,
    costType,
    month,
    year,
  )
  const { data: activityData, isLoading: loadingActivity } = useBulkCostActivity(
    open,
    costType,
    historyScope === 'month' ? month : undefined,
    historyScope === 'month' ? year : undefined,
  )

  const entries = entriesData?.entries ?? []
  const activity = activityData?.activity ?? []
  const entriesTotal = useMemo(
    () => entries.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0),
    [entries],
  )
  const displayTotal = dashboardTotal ?? entriesTotal

  const isLoading = loadingEntries || loadingActivity

  const handleOpenChange = (next: boolean) => {
    if (!next) skipBackOnCloseRef.current = true
    onOpenChange(next)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
        <SheetContent
          side="right"
          className="z-[100] flex w-full flex-col gap-0 p-0 sm:max-w-md"
          overlayClassName="z-[100]"
        >
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              {costLabel} Activity
            </SheetTitle>
            <SheetDescription className="text-xs">
              Current bulk entries for {formatIncentiveMonthYear(month, year)}. Edit here — Add creates
              new entries only.
            </SheetDescription>
          </SheetHeader>

          <div className="border-b bg-muted/40 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Total · {formatIncentiveMonthYear(month, year)}
                </p>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {isLoading && dashboardTotal == null ? '…' : formatCurrency(displayTotal)}
                </p>
                {dashboardTotal != null && Math.round(dashboardTotal) !== Math.round(entriesTotal) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Bulk entries: {formatCurrency(entriesTotal)}
                  </p>
                )}
              </div>
              <p className="pb-1 text-xs text-muted-foreground">
                {isLoading ? '—' : `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Current entries
                    </h3>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(entriesTotal)}
                    </span>
                  </div>
                  {entries.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                      No bulk {costLabel.toLowerCase()} entries for this month
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {entries.map((entry) => (
                        <li key={entry.id} className="rounded-lg border bg-card p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium tabular-nums">{formatCurrency(entry.amount)}</p>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(entry.createdAt), 'dd MMM yyyy')}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            {entry.remark}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Employee: {entry.employeeName ?? '— (unassigned)'}
                          </p>
                          {canWrite && (
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => setEditEntry(entry)}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Change history
                    </h3>
                    <div className="flex rounded-md border p-0.5">
                      <Button
                        type="button"
                        variant={historyScope === 'month' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setHistoryScope('month')}
                      >
                        This month
                      </Button>
                      <Button
                        type="button"
                        variant={historyScope === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setHistoryScope('all')}
                      >
                        All history
                      </Button>
                    </div>
                  </div>

                  {activity.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                      {historyScope === 'month'
                        ? 'No changes logged for this month yet'
                        : 'No change history yet'}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {activity.map((item) => (
                        <li key={item.id} className="rounded-lg border bg-card p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                actionStyles(item.action),
                              )}
                            >
                              {item.action}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(item.changedAt), 'dd MMM yyyy, h:mm a')}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1">
                            <p className="font-medium">{formatCurrency(item.amount)}</p>
                            {historyScope === 'all' && (
                              <p className="text-[11px] text-muted-foreground">
                                {formatIncentiveMonthYear(item.month, item.year)}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                              {item.remark}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Employee: {item.employeeName ?? '— (unassigned)'}
                            </p>
                            {item.action === 'UPDATE' && (
                              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                Previous: {formatCurrency(item.previousAmount ?? 0)}
                                {item.previousRemark ? ` · ${item.previousRemark}` : ''}
                                {item.previousEmployeeName != null || item.previousEmployeeId != null
                                  ? ` · ${item.previousEmployeeName ?? 'unassigned'}`
                                  : ''}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground">By {item.changedBy}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EditBulkCostEntryDialog
        open={!!editEntry}
        entry={editEntry}
        costType={costType}
        month={month}
        year={year}
        costLabel={costLabel}
        onOpenChange={(next) => !next && setEditEntry(null)}
        onSaved={() => setEditEntry(null)}
      />
    </>
  )
}

function EditBulkCostEntryDialog({
  open,
  entry,
  costType,
  month,
  year,
  costLabel,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  entry: BulkCostEntryDto | null
  costType: BulkCostType
  month: number
  year: number
  costLabel: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [remark, setRemark] = useState('')
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const { data: empData, isLoading: loadingEmployees } = useBulkCostEmployees(open)
  const saveCosts = useSaveBulkCosts()
  const employees = empData?.employees ?? []

  useEffect(() => {
    if (!open || !entry) return
    setAmount(String(entry.amount))
    setRemark(entry.remark)
    setEmployeeId(entry.employeeId)
  }, [open, entry])

  const handleSave = async () => {
    if (!entry) return
    const parsed = Number(amount)
    const trimmed = remark.trim()
    if (!trimmed) {
      toast.error('Remark is required')
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    try {
      await saveCosts.mutateAsync({
        costType,
        month,
        year,
        entries: [
          {
            id: entry.id,
            amount: parsed,
            remark: trimmed,
            employeeId,
          },
        ],
      })
      toast.success(`${costLabel} entry updated`)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update entry')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {costLabel}</DialogTitle>
          <DialogDescription>
            Update this entry for {formatIncentiveMonthYear(month, year)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Employee <span className="text-muted-foreground">(optional)</span>
            </Label>
            {loadingEmployees ? (
              <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : (
              <Select
                value={employeeId ?? NONE_EMPLOYEE}
                onValueChange={(v) => setEmployeeId(v === NONE_EMPLOYEE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_EMPLOYEE}>No employee</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Remark <span className="text-destructive">*</span>
            </Label>
            <Textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveCosts.isPending}>
            {saveCosts.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
