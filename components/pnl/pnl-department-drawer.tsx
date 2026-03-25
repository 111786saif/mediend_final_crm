'use client'

import { useQueryClient } from '@tanstack/react-query'
import { apiPatch, apiPost } from '@/lib/api-client'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PnlDepartmentTable } from '@/components/pnl/pnl-department-table'
import type { PnlDepartmentOverview, PnlOverviewData } from '@/components/pnl/types'
import { toast } from 'sonner'
import { useState } from 'react'

export function PnlDepartmentDrawer({
  open,
  onOpenChange,
  department,
  overview,
  canWrite,
  queryKeyPrefix,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  department: PnlDepartmentOverview | null
  overview: PnlOverviewData | null
  canWrite: boolean
  queryKeyPrefix: string
}) {
  const qc = useQueryClient()
  const [seatEdit, setSeatEdit] = useState('')

  const deptKey = department?.key
  const revCat = overview?.revenueCategories.find((c) => c.sourceKey === deptKey)

  const saveCell = async (
    categoryId: string,
    _monthKey: string,
    month: number,
    year: number,
    amount: number
  ) => {
    await apiPost('/api/pnl/entries', { categoryId, month, year, amount, isAutoFilled: false })
    await qc.invalidateQueries({ queryKey: [queryKeyPrefix] })
    toast.success('Saved')
  }

  const addExpense = async (name: string, dk: string) => {
    if (!name.trim()) return
    await apiPost('/api/pnl/categories', {
      name: name.trim(),
      type: 'EXPENSE',
      departmentKey: dk,
    })
    await qc.invalidateQueries({ queryKey: [queryKeyPrefix] })
    toast.success('Expense line added')
  }

  const applySeatRate = async () => {
    const v = parseFloat(seatEdit)
    if (!Number.isFinite(v) || v < 0) {
      toast.error('Invalid amount')
      return
    }
    await apiPatch('/api/pnl/config', { seatCostPerEmployee: v })
    await qc.invalidateQueries({ queryKey: [queryKeyPrefix] })
    toast.success('Seat cost per employee updated')
    setSeatEdit('')
  }

  if (!department || !overview || !revCat) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{department.name} — P&amp;L detail</SheetTitle>
          <SheetDescription>
            Revenue is auto-filled from operations. Edit expenses; seat cost defaults from headcount × rate.
          </SheetDescription>
        </SheetHeader>

        {canWrite && (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Seat cost / employee / month (₹)</Label>
              <div className="flex gap-2">
                <Input
                  className="h-9 w-32"
                  placeholder={String(overview.seatCostPerEmployee)}
                  value={seatEdit}
                  onChange={(e) => setSeatEdit(e.target.value)}
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => void applySeatRate()}>
                  Apply
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
              Headcount ({department.key}): {department.headcount} — affects seat cost hints.
            </p>
          </div>
        )}

        <div className="mt-6">
          <PnlDepartmentTable
            monthKeys={overview.monthKeys}
            departmentKey={department.key}
            revenueCategoryId={revCat.categoryId}
            revenueLabel={revCat.name}
            revenueAmounts={revCat.amounts}
            revenueAutoFilled={revCat.isAutoFilled}
            expenseCategories={department.expenseCategories}
            canWrite={canWrite}
            onCellSave={saveCell}
            onAddExpenseCategory={addExpense}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
