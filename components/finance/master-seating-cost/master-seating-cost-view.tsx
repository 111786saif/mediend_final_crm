'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Armchair, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/finance/payroll-types'
import type { MasterSeatingCostRow } from '@/lib/finance/master-seating-cost/types'
import {
  useCreateMasterSeatingCost,
  useDeleteMasterSeatingCost,
  useMasterSeatingCost,
  useUpdateMasterSeatingCost,
} from '@/hooks/use-master-seating-cost'

const ALL = 'all'

type FormMode = { type: 'add'; row: MasterSeatingCostRow } | { type: 'edit'; row: MasterSeatingCostRow }

export function MasterSeatingCostView() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [deleteRow, setDeleteRow] = useState<MasterSeatingCostRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, refetch } = useMasterSeatingCost({
    search: debouncedSearch || null,
    departmentId: departmentFilter,
  })

  const createCost = useCreateMasterSeatingCost()
  const updateCost = useUpdateMasterSeatingCost()
  const deleteCost = useDeleteMasterSeatingCost()

  const rows = data?.rows ?? []
  const departments = data?.departments ?? []

  const stats = useMemo(() => {
    const withCost = rows.filter((r) => r.amount != null)
    return {
      totalEmployees: rows.length,
      configured: withCost.length,
      totalAmount: withCost.reduce((s, r) => s + (r.amount ?? 0), 0),
    }
  }, [rows])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master Seating Cost</h1>
        <p className="text-sm text-muted-foreground">
          Fixed seating cost per active employee. One record per employee — not monthly.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.configured}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total seating cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Armchair className="h-5 w-5" />
            Employee seating costs
          </CardTitle>
          <CardDescription>Search and filter by department</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee ID, department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Failed to load data.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No active employees match your filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Seating Cost</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium">{row.employeeName}</TableCell>
                      <TableCell>{row.employeeCode}</TableCell>
                      <TableCell>{row.department ?? '—'}</TableCell>
                      <TableCell>{row.designation ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {row.amount != null ? (
                          formatCurrency(row.amount)
                        ) : (
                          <Badge variant="outline">Not set</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.updatedAt
                          ? format(new Date(row.updatedAt), 'dd MMM yyyy, h:mm a')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {row.seatingCostId ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setFormMode({ type: 'edit', row })}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteRow(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() => setFormMode({ type: 'add', row })}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {formMode && (
        <SeatingCostDialog
          open={!!formMode}
          onOpenChange={(open) => !open && setFormMode(null)}
          mode={formMode.type}
          row={formMode.row}
          onSubmit={async (amount, note) => {
            try {
              if (formMode.type === 'add') {
                await createCost.mutateAsync({
                  employeeId: formMode.row.employeeId,
                  amount,
                  note,
                })
                toast.success('Seating cost added')
              } else if (formMode.row.seatingCostId) {
                await updateCost.mutateAsync({
                  id: formMode.row.seatingCostId,
                  amount,
                  note,
                })
                toast.success('Seating cost updated')
              }
              setFormMode(null)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to save')
            }
          }}
          isPending={createCost.isPending || updateCost.isPending}
        />
      )}

      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete seating cost?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the seating cost record for <strong>{deleteRow?.employeeName}</strong>? The
              employee will show as &quot;Not set&quot; until a new cost is added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteRow?.seatingCostId) return
                try {
                  await deleteCost.mutateAsync(deleteRow.seatingCostId)
                  toast.success('Seating cost deleted')
                  setDeleteRow(null)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete')
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SeatingCostDialog({
  open,
  onOpenChange,
  mode,
  row,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  row: MasterSeatingCostRow
  onSubmit: (amount: number, note: string | null) => Promise<void>
  isPending: boolean
}) {
  const [amount, setAmount] = useState(row.amount != null ? String(row.amount) : '')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(row.amount != null ? String(row.amount) : '')
      setNote('')
    }
  }, [open, row])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid seating cost amount')
      return
    }
    await onSubmit(parsed, note.trim() || null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
            <DialogTitle>{mode === 'add' ? 'Add seating cost' : 'Edit seating cost'}</DialogTitle>
            <DialogDescription className="text-xs">
              {row.employeeName} · {row.employeeCode}
              {row.department ? ` · ${row.department}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="seating-amount" className="text-xs">
                Seating cost (INR) — fixed amount
              </Label>
              <Input
                id="seating-amount"
                type="number"
                min="1"
                step="0.01"
                className="h-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seating-note" className="text-xs">
                Note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="seating-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="min-h-0 resize-none"
                placeholder="Desk location, allocation details…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function MasterSeatingCostPageContent() {
  return (
    <AuthenticatedLayout>
      <MasterSeatingCostView />
    </AuthenticatedLayout>
  )
}
