'use client'

import { useState, useCallback } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Lock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { PnlExpenseCategoryDetail } from '@/components/pnl/types'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function PnlDepartmentTable({
  monthKeys,
  departmentKey,
  revenueCategoryId,
  revenueLabel,
  revenueAmounts,
  revenueAutoFilled,
  expenseCategories,
  canWrite,
  onCellSave,
  onAddExpenseCategory,
  allEditable,
}: {
  monthKeys: string[]
  departmentKey: string
  revenueCategoryId: string
  revenueLabel: string
  revenueAmounts: Record<string, number>
  revenueAutoFilled: Record<string, boolean>
  expenseCategories: PnlExpenseCategoryDetail[]
  canWrite: boolean
  onCellSave: (categoryId: string, monthKey: string, month: number, year: number, amount: number) => Promise<void>
  onAddExpenseCategory: (name: string, deptKey: string) => Promise<void>
  allEditable?: boolean
}) {
  const [editing, setEditing] = useState<{ catId: string; key: string; value: string } | null>(null)
  const [expOpen, setExpOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const saveEdit = useCallback(async () => {
    if (!editing) return
    const [ys, ms] = editing.key.split('-').map(Number)
    const amt = parseFloat(editing.value.replace(/,/g, '')) || 0
    await onCellSave(editing.catId, editing.key, ms, ys, amt)
    setEditing(null)
  }, [editing, onCellSave])

  const sumKeys = (amounts: Record<string, number>) =>
    monthKeys.reduce((s, k) => s + (amounts[k] || 0), 0)

  const totalRev = sumKeys(revenueAmounts)
  const totalExp = expenseCategories.reduce((s, c) => s + sumKeys(c.amounts), 0)

  return (
    <div className="space-y-4 overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[200px] font-semibold">Category</TableHead>
            {monthKeys.map((k) => (
              <TableHead key={k} className="text-right min-w-[100px]">
                {k.replace('-', '/')}
              </TableHead>
            ))}
            <TableHead className="text-right font-semibold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={monthKeys.length + 2} className="bg-emerald-100/80 dark:bg-emerald-950/40 font-semibold text-emerald-800 dark:text-emerald-200">
              Revenue
            </TableCell>
          </TableRow>
          <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/20">
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {revenueLabel}
                {!allEditable && revenueAutoFilled[monthKeys[0]] !== false && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Lock className="h-3 w-3 mr-1" /> auto
                  </Badge>
                )}
              </div>
            </TableCell>
            {monthKeys.map((k) => {
              const v = revenueAmounts[k] || 0
              const auto = revenueAutoFilled[k]
              const isEditing = editing?.catId === revenueCategoryId && editing?.key === k
              return (
                <TableCell key={k} className="text-right">
                  {isEditing ? (
                    <Input
                      className="h-8 text-right"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onBlur={() => void saveEdit()}
                      onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        'w-full text-right tabular-nums',
                        canWrite && (allEditable || !auto) && 'hover:underline cursor-pointer'
                      )}
                      disabled={!canWrite || (!allEditable && auto)}
                      onClick={() => {
                        if (!canWrite || (!allEditable && auto)) return
                        setEditing({ catId: revenueCategoryId, key: k, value: String(Math.round(v)) })
                      }}
                    >
                      {formatInr(v)}
                    </button>
                  )}
                </TableCell>
              )
            })}
            <TableCell className="text-right font-medium tabular-nums">{formatInr(totalRev)}</TableCell>
          </TableRow>

          <TableRow>
            <TableCell colSpan={monthKeys.length + 2} className="bg-rose-100/80 dark:bg-rose-950/40 font-semibold text-rose-800 dark:text-rose-200">
              Expenses
            </TableCell>
          </TableRow>
          {expenseCategories.map((c) => (
            <TableRow key={c.categoryId} className="bg-rose-50/50 dark:bg-rose-950/20">
              <TableCell className="font-medium">
                <div className="flex flex-col gap-0.5">
                  <span>{c.name}</span>
                  {c.sourceKey === 'SEAT_COST' && c.seatCostHint && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Auto: headcount × seat rate →{' '}
                      {formatInr(monthKeys.reduce((s, k) => s + (c.seatCostHint![k] || 0), 0) / Math.max(monthKeys.length, 1))}{' '}
                      / mo avg
                    </span>
                  )}
                  {c.sourceKey === 'SALARY' && departmentKey === 'IT' && c.salaryHint && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      IT resource cost hint (period):{' '}
                      {formatInr(monthKeys.reduce((s, k) => s + (c.salaryHint![k] || 0), 0))}
                    </span>
                  )}
                </div>
              </TableCell>
              {monthKeys.map((k) => {
                const v = c.amounts[k] || 0
                const auto = c.isAutoFilled[k]
                const isEditing = editing?.catId === c.categoryId && editing?.key === k
                return (
                  <TableCell key={k} className="text-right">
                    {isEditing ? (
                      <Input
                        className="h-8 text-right"
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onBlur={() => void saveEdit()}
                        onKeyDown={(e) => e.key === 'Enter' && void saveEdit()}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          'w-full text-right tabular-nums',
                          canWrite && !(c.sourceKey && auto) && 'hover:underline cursor-pointer'
                        )}
                        disabled={!canWrite}
                        onClick={() => {
                          if (!canWrite) return
                          setEditing({ catId: c.categoryId, key: k, value: String(Math.round(v)) })
                        }}
                      >
                        {formatInr(v)}
                      </button>
                    )}
                  </TableCell>
                )
              })}
              <TableCell className="text-right font-medium tabular-nums">
                {formatInr(sumKeys(c.amounts))}
              </TableCell>
            </TableRow>
          ))}
          {canWrite && !allEditable && (
            <TableRow>
              <TableCell colSpan={monthKeys.length + 2}>
                <Dialog open={expOpen} onOpenChange={setExpOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-rose-700 border-rose-200">
                      <Plus className="h-4 w-4 mr-1" /> Add expense row
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New expense line</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={async () => {
                          await onAddExpenseCategory(newName, departmentKey)
                          setNewName('')
                          setExpOpen(false)
                        }}
                      >
                        Add
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          )}
          <TableRow className="bg-rose-100/90 dark:bg-rose-900/30 font-bold">
            <TableCell>Total expenses</TableCell>
            {monthKeys.map((k) => (
              <TableCell key={k} className="text-right tabular-nums">
                {formatInr(expenseCategories.reduce((s, c) => s + (c.amounts[k] || 0), 0))}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums">{formatInr(totalExp)}</TableCell>
          </TableRow>
          <TableRow className="border-t-2 bg-background font-bold">
            <TableCell>Net P&amp;L</TableCell>
            {monthKeys.map((k) => {
              const rev = revenueAmounts[k] || 0
              const exp = expenseCategories.reduce((s, c) => s + (c.amounts[k] || 0), 0)
              const net = rev - exp
              return (
                <TableCell
                  key={k}
                  className={cn('text-right tabular-nums', net >= 0 ? 'text-emerald-600' : 'text-rose-600')}
                >
                  {formatInr(net)}
                </TableCell>
              )
            })}
            <TableCell
              className={cn(
                'text-right tabular-nums',
                totalRev - totalExp >= 0 ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {formatInr(totalRev - totalExp)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
