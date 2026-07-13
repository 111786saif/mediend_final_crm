'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { History, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import {
  useSalaryOverrideHistory,
  useSaveSalaryOverride,
} from '@/hooks/use-sales-team-salary-override'
import type { SalesTeamCostRole } from '@/lib/sales-team-cost/types'

interface EditSalaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: SalesTeamCostRole
  month: number
  year: number
}

export function EditSalaryDialog({
  open,
  onOpenChange,
  node,
  month,
  year,
}: EditSalaryDialogProps) {
  const skipBackOnCloseRef = useRef(false)
  const save = useSaveSalaryOverride()
  const [amount, setAmount] = useState(String(node.salaryPerHead))
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(String(node.salaryPerHead))
    setReason('')
  }, [open, node.salaryPerHead])

  const closeWithoutNavigatingBack = () => {
    skipBackOnCloseRef.current = true
    onOpenChange(false)
  }

  const handleSave = async () => {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Enter a valid salary amount')
      return
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      toast.error('Reason for change is mandatory')
      return
    }
    if (parsed === node.salaryPerHead) {
      toast.error('Updated salary is the same as the current value')
      return
    }

    try {
      skipBackOnCloseRef.current = true
      await save.mutateAsync({
        employeeId: node.id,
        month,
        year,
        amount: parsed,
        reason: trimmedReason,
      })
      toast.success(`Salary override saved for ${node.name}`)
      onOpenChange(false)
    } catch (error) {
      skipBackOnCloseRef.current = false
      toast.error(error instanceof Error ? error.message : 'Failed to save salary override')
    }
  }

  const difference = Number(amount) - node.salaryPerHead
  const periodLabel = formatIncentiveMonthYear(month, year)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit Salary</DialogTitle>
          <DialogDescription>
            Override salary for <span className="font-medium text-foreground">{node.name}</span> ·{' '}
            {periodLabel}. This does not change Payroll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Payroll salary</span>
              <span className="font-medium">{formatCurrency(node.payrollSalary)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-muted-foreground">Current displayed</span>
              <span className="font-medium">{formatCurrency(node.salaryPerHead)}</span>
            </div>
            {node.salaryIsOverride && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Currently using a Sales Team Cost override
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-salary">Updated salary (INR)</Label>
            <Input
              id="override-salary"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {Number.isFinite(difference) && Number(amount) !== node.salaryPerHead && (
              <p className="text-xs text-muted-foreground">
                Difference:{' '}
                <span className={difference >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {difference >= 0 ? '+' : ''}
                  {formatCurrency(difference)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason">Reason for change</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mandatory — explain why this salary is overridden"
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeWithoutNavigatingBack}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save override'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SalaryHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  month: number
  year: number
}

export function SalaryHistoryDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  month,
  year,
}: SalaryHistoryDialogProps) {
  const skipBackOnCloseRef = useRef(false)
  const { data, isLoading, isError, refetch } = useSalaryOverrideHistory(
    employeeId,
    month,
    year,
    open,
  )
  const periodLabel = formatIncentiveMonthYear(month, year)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-3 px-4 pt-4 pb-2">
          <DialogHeader className="space-y-1">
            <DialogTitle>Salary activity log</DialogTitle>
            <DialogDescription>
              Immutable audit history for {employeeName} · {periodLabel}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Failed to load history.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </p>
          ) : (data?.history.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No salary overrides recorded for this period.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Updated by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(h.updatedAt), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(h.previousSalary)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(h.updatedSalary)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span
                          className={
                            h.difference >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }
                        >
                          {h.difference >= 0 ? '+' : ''}
                          {formatCurrency(h.difference)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-xs">{h.reason}</TableCell>
                      <TableCell className="text-xs">{h.updatedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              skipBackOnCloseRef.current = true
              onOpenChange(false)
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SalaryActionsProps {
  node: SalesTeamCostRole
  month: number
  year: number
  canWrite: boolean
}

export function SalaryActions({ node, month, year, canWrite }: SalaryActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1">
        {canWrite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3 w-3" />
            Edit Salary
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="h-3 w-3" />
          Activity log
        </Button>
        {node.salaryIsOverride && (
          <Badge variant="secondary" className="h-7 rounded-sm px-1.5 text-[10px]">
            Overridden
          </Badge>
        )}
      </div>

      {editOpen && (
        <EditSalaryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          node={node}
          month={month}
          year={year}
        />
      )}
      {historyOpen && (
        <SalaryHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          employeeId={node.id}
          employeeName={node.name}
          month={month}
          year={year}
        />
      )}
    </>
  )
}
