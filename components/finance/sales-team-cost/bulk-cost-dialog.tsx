'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MONTHS, formatCurrency } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import {
  useBulkCostEmployees,
  useBulkCostEntries,
  useSaveBulkCosts,
  type BulkCostType,
} from '@/hooks/use-sales-team-bulk-costs'
import { BulkCostActivityDrawer } from '@/components/finance/sales-team-cost/bulk-cost-activity-drawer'

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)
const NONE_EMPLOYEE = '__none__'

interface BulkCostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  costType: BulkCostType
  defaultMonth: number
  defaultYear: number
  onSaved?: (period: { month: number; year: number }) => void
}

type DraftRow = {
  key: string
  id?: string
  amount: string
  remark: string
  employeeId: string | null
}

function newRow(): DraftRow {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    amount: '',
    remark: '',
    employeeId: null,
  }
}

export function BulkCostDialog({
  open,
  onOpenChange,
  costType,
  defaultMonth,
  defaultYear,
  onSaved,
}: BulkCostDialogProps) {
  const isMisc = costType === 'MISC'
  const costLabel = isMisc ? 'Misc Cost' : 'Other Cost'
  const skipBackOnCloseRef = useRef(false)

  const [month, setMonth] = useState(String(defaultMonth))
  const [year, setYear] = useState(String(defaultYear))
  const [rows, setRows] = useState<DraftRow[]>([newRow()])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [activityOpen, setActivityOpen] = useState(false)
  const hydratedKeyRef = useRef('')

  const periodMonth = Number(month)
  const periodYear = Number(year)

  const { data: empData, isLoading: loadingEmployees } = useBulkCostEmployees(open)
  const { data: entriesData, isLoading: loadingEntries } = useBulkCostEntries(
    open,
    costType,
    periodMonth,
    periodYear,
  )
  const saveCosts = useSaveBulkCosts()
  const employees = empData?.employees ?? []

  useEffect(() => {
    if (!open) return
    setMonth(String(defaultMonth))
    setYear(String(defaultYear))
    setDeletedIds([])
    setActivityOpen(false)
    hydratedKeyRef.current = ''
    setRows([newRow()])
  }, [open, defaultMonth, defaultYear, costType])

  useEffect(() => {
    if (!open || loadingEntries) return
    const key = `${costType}-${periodMonth}-${periodYear}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key

    const existing = entriesData?.entries ?? []
    if (existing.length === 0) {
      setRows([newRow()])
      return
    }

    setRows(
      existing.map((e) => ({
        key: e.id,
        id: e.id,
        amount: String(e.amount),
        remark: e.remark,
        employeeId: e.employeeId,
      })),
    )
    setDeletedIds([])
  }, [open, loadingEntries, entriesData, costType, periodMonth, periodYear])

  const runningTotal = useMemo(() => {
    return rows.reduce((sum, row) => {
      const amount = Number(row.amount)
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0)
    }, 0)
  }, [rows])

  const closeWithoutNavigatingBack = () => {
    skipBackOnCloseRef.current = true
    onOpenChange(false)
  }

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const removeRow = (key: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.key === key)
      if (target?.id) {
        setDeletedIds((ids) => (ids.includes(target.id!) ? ids : [...ids, target.id!]))
      }
      const next = prev.filter((r) => r.key !== key)
      return next.length === 0 ? [newRow()] : next
    })
  }

  const handleSave = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    const prepared: { id?: string; amount: number; remark: string; employeeId: string | null }[] =
      []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const remark = row.remark.trim()
      const amount = Number(row.amount)
      const isEmpty =
        !remark &&
        (row.amount === '' || row.amount === '0') &&
        !row.employeeId &&
        !row.id

      if (isEmpty) continue

      if (!remark) {
        toast.error(`Remark is required for entry ${i + 1}`)
        return
      }
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error(`Enter a valid amount for entry ${i + 1}`)
        return
      }
      prepared.push({
        id: row.id,
        amount,
        remark,
        employeeId: row.employeeId,
      })
    }

    if (prepared.length === 0 && deletedIds.length === 0) {
      toast.error('Add at least one entry with amount and remark')
      return
    }

    try {
      await saveCosts.mutateAsync({
        costType,
        month: periodMonth,
        year: periodYear,
        entries: prepared,
        deletedIds,
      })
      toast.success(
        prepared.length === 0
          ? `Removed ${costLabel.toLowerCase()} entries · ${formatIncentiveMonthYear(periodMonth, periodYear)}`
          : `Saved ${costLabel.toLowerCase()} · ${prepared.length} entr${prepared.length === 1 ? 'y' : 'ies'} · ${formatIncentiveMonthYear(periodMonth, periodYear)}`,
      )
      skipBackOnCloseRef.current = true
      onSaved?.({ month: periodMonth, year: periodYear })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to save ${costLabel.toLowerCase()}`)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
        <DialogContent
          className="gap-0 p-0 sm:max-w-3xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-4 px-4 pt-4 pb-2">
            <DialogHeader className="space-y-1">
              <div className="flex items-start justify-between gap-2 pr-6">
                <div>
                  <DialogTitle>Add {costLabel}</DialogTitle>
                  <DialogDescription className="text-xs">
                    Add one or more amounts with a mandatory remark. Employee is optional — amounts
                    without an employee are still included in the total cost.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setActivityOpen(true)}
                >
                  <History className="h-3.5 w-3.5" />
                  Activity
                </Button>
              </div>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Month</Label>
                <Select
                  value={month}
                  onValueChange={(v) => {
                    hydratedKeyRef.current = ''
                    setMonth(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, i) => (
                      <SelectItem key={label} value={String(i + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Select
                  value={year}
                  onValueChange={(v) => {
                    hydratedKeyRef.current = ''
                    setYear(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Running total</span>
              <span className="text-sm font-semibold">{formatCurrency(runningTotal)}</span>
            </div>

            {loadingEntries ? (
              <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading entries…
              </div>
            ) : (
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {rows.map((row, index) => (
                  <div key={row.key} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Entry {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0"
                          value={row.amount}
                          onChange={(e) => updateRow(row.key, { amount: e.target.value })}
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
                            value={row.employeeId ?? NONE_EMPLOYEE}
                            onValueChange={(v) =>
                              updateRow(row.key, {
                                employeeId: v === NONE_EMPLOYEE ? null : v,
                              })
                            }
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
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Remark <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Enter remark"
                        value={row.remark}
                        onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another entry
            </Button>
          </div>

          <DialogFooter className="gap-2 border-t px-4 py-3 sm:justify-between">
            <p className="mr-auto text-xs text-muted-foreground self-center">
              Total: <span className="font-semibold text-foreground">{formatCurrency(runningTotal)}</span>
            </p>
            <Button type="button" variant="outline" onClick={closeWithoutNavigatingBack}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveCosts.isPending || loadingEntries}
            >
              {saveCosts.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                `Save ${costLabel}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkCostActivityDrawer
        open={activityOpen}
        onOpenChange={setActivityOpen}
        costType={costType}
        month={periodMonth}
        year={periodYear}
        dashboardTotal={runningTotal}
      />
    </>
  )
}
