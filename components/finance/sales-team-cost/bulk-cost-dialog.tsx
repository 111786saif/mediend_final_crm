'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmployeeMultiSelect, type EmployeeOption } from '@/components/incentives/employee-multi-select'
import { MONTHS } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import {
  useBulkCostEmployees,
  useSaveBulkCosts,
  type BulkCostType,
} from '@/hooks/use-sales-team-bulk-costs'

const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)

interface BulkCostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  costType: BulkCostType
  defaultMonth: number
  defaultYear: number
  onSaved?: (period: { month: number; year: number }) => void
}

type DraftRow = {
  employeeId: string
  employeeName: string
  employeeCode: string
  amount: string
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
  const amountHeader = isMisc ? 'Misc Cost' : 'Other Cost'
  const skipBackOnCloseRef = useRef(false)

  const [month, setMonth] = useState(String(defaultMonth))
  const [year, setYear] = useState(String(defaultYear))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [rows, setRows] = useState<DraftRow[]>([])

  const { data, isLoading } = useBulkCostEmployees(open)
  const saveCosts = useSaveBulkCosts()
  const employees = data?.employees ?? []

  useEffect(() => {
    if (!open) return
    setMonth(String(defaultMonth))
    setYear(String(defaultYear))
    setSelectedIds([])
    setRows([])
  }, [open, defaultMonth, defaultYear, costType])

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeOption>()
    for (const emp of employees) map.set(emp.id, emp)
    return map
  }, [employees])

  const closeWithoutNavigatingBack = () => {
    skipBackOnCloseRef.current = true
    onOpenChange(false)
  }

  const handleAddEmployees = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one employee')
      return
    }

    const existing = new Set(rows.map((r) => r.employeeId))
    const added: DraftRow[] = []
    for (const id of selectedIds) {
      if (existing.has(id)) continue
      const emp = employeeMap.get(id)
      if (!emp) continue
      added.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        amount: '0',
      })
    }

    if (added.length === 0) {
      toast.message('Selected employees are already in the table')
      return
    }

    setRows((prev) => [...prev, ...added])
    setSelectedIds([])
  }

  const updateAmount = (employeeId: string, amount: string) => {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, amount } : r)))
  }

  const removeRow = (employeeId: string) => {
    setRows((prev) => prev.filter((r) => r.employeeId !== employeeId))
  }

  const handleSave = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (rows.length === 0) {
      toast.error('Add at least one employee')
      return
    }

    const entries: { employeeId: string; amount: number }[] = []
    for (const row of rows) {
      const amount = Number(row.amount)
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error(`Enter a valid ${costLabel.toLowerCase()} for ${row.employeeName}`)
        return
      }
      entries.push({ employeeId: row.employeeId, amount })
    }

    const savedMonth = Number(month)
    const savedYear = Number(year)

    try {
      await saveCosts.mutateAsync({
        costType,
        month: savedMonth,
        year: savedYear,
        entries,
      })
      toast.success(
        `Saved ${costLabel.toLowerCase()} for ${entries.length} employee${entries.length === 1 ? '' : 's'} · ${formatIncentiveMonthYear(savedMonth, savedYear)}`,
      )
      // Skip history.back() before parent state updates, so the dialog close
      // does not navigate away to the previous page (e.g. doctors).
      skipBackOnCloseRef.current = true
      onSaved?.({ month: savedMonth, year: savedYear })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to save ${costLabel.toLowerCase()}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4 px-4 pt-4 pb-2">
          <DialogHeader className="space-y-1">
            <DialogTitle>Add {costLabel}</DialogTitle>
            <DialogDescription className="text-xs">
              Select month, year, and employees, then enter {costLabel.toLowerCase()} amounts and save
              together.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Month</Label>
              <Select value={month} onValueChange={setMonth}>
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
              <Select value={year} onValueChange={setYear}>
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

          <div className="space-y-1.5">
            <Label className="text-xs">Employees</Label>
            {isLoading ? (
              <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees…
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <EmployeeMultiSelect
                    employees={employees}
                    selectedIds={selectedIds}
                    onChange={setSelectedIds}
                    placeholder="Select employees"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleAddEmployees}>
                  Add
                </Button>
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead className="w-[160px] text-right">{amountHeader}</TableHead>
                    <TableHead className="w-[72px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <div className="font-medium">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{row.employeeCode}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 text-right"
                          value={row.amount}
                          onChange={(e) => updateAmount(row.employeeId, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => removeRow(row.employeeId)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
          <Button type="button" variant="outline" onClick={closeWithoutNavigatingBack}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveCosts.isPending || rows.length === 0}
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
  )
}
