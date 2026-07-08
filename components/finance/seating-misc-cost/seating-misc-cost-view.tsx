'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { History, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { formatCurrency, MONTHS } from '@/lib/finance/payroll-types'
import {
  formatSeatingMiscMonthYear,
  SEATING_MISC_STATUS_LABEL,
  SEATING_MISC_STATUS_OPTIONS,
  type SeatingMiscCostRow,
} from '@/lib/finance/seating-misc-cost/types'
import {
  useCreateSeatingMiscCost,
  useDeleteSeatingMiscCost,
  useSeatingMiscCost,
  useSeatingMiscCostHistory,
  useUpdateSeatingMiscCost,
} from '@/hooks/use-seating-misc-cost'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'

const ALL = 'all'

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' {
  if (status === 'PAID') return 'default'
  if (status === 'APPROVED') return 'secondary'
  return 'outline'
}

export function SeatingMiscCostView() {
  const now = new Date()
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'finance:write') : false

  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1))
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [addRow, setAddRow] = useState<SeatingMiscCostRow | null>(null)
  const [editRow, setEditRow] = useState<SeatingMiscCostRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<SeatingMiscCostRow | null>(null)
  const [historyRow, setHistoryRow] = useState<SeatingMiscCostRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(
    () => ({
      month: Number(filterMonth),
      year: Number(filterYear),
      search: debouncedSearch || null,
      departmentId: departmentFilter,
    }),
    [filterMonth, filterYear, debouncedSearch, departmentFilter],
  )

  const { data, isLoading, isError, refetch } = useSeatingMiscCost(filters)
  const createCost = useCreateSeatingMiscCost()
  const updateCost = useUpdateSeatingMiscCost()
  const deleteCost = useDeleteSeatingMiscCost()

  const rows = data?.rows ?? []
  const departments = data?.departments ?? []
  const periodLabel = formatSeatingMiscMonthYear(filters.month, filters.year)

  const stats = useMemo(() => {
    const withRecord = rows.filter((r) => r.recordId)
    return {
      totalRecords: withRecord.length,
      totalSeating: withRecord.reduce((s, r) => s + (r.seatingCost ?? 0), 0),
      totalMisc: withRecord.reduce((s, r) => s + (r.miscCost ?? 0), 0),
      totalEmployees: rows.length,
    }
  }, [rows])

  const yearOptions = useMemo(() => {
    const y = now.getFullYear()
    return [y - 1, y, y + 1]
  }, [now])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seating & Misc Cost</h1>
          <p className="text-sm text-muted-foreground">
            Manage monthly seating and misc costs. Seating is sourced from Master Seating Cost; one
            record per employee per month.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total seating cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSeating)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total misc cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalMisc)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly costs — {periodLabel}</CardTitle>
          <CardDescription>Search and filter active employees</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or employee ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full lg:w-[160px]">
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
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full lg:w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
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
                    <TableHead className="text-right">Misc Cost</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
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
                        {row.seatingCost != null ? (
                          formatCurrency(row.seatingCost)
                        ) : row.masterSeatingAmount != null ? (
                          <span className="text-muted-foreground" title="Master seating available">
                            {formatCurrency(row.masterSeatingAmount)}*
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.miscCost != null ? formatCurrency(row.miscCost) : '—'}
                      </TableCell>
                      <TableCell>{MONTHS[row.month - 1]}</TableCell>
                      <TableCell>{row.year}</TableCell>
                      <TableCell>
                        {row.status ? (
                          <Badge variant={statusVariant(row.status)}>
                            {SEATING_MISC_STATUS_LABEL[row.status]}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not set</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {row.recordId ? (
                            <>
                              {canWrite && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setEditRow(row)}
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
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setHistoryRow(row)}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            canWrite && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => setAddRow(row)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">* Master seating amount (not yet assigned for this month)</p>
        </CardContent>
      </Card>

      {addRow && (
        <AddCostDialog
          open={!!addRow}
          onOpenChange={(open) => !open && setAddRow(null)}
          row={addRow}
          onSubmit={async (input) => {
            await createCost.mutateAsync(input)
            toast.success(`Cost saved for ${addRow.employeeName}`)
            setAddRow(null)
          }}
          isPending={createCost.isPending}
        />
      )}

      {editRow?.recordId && (
        <EditCostDialog
          open={!!editRow}
          onOpenChange={(open) => !open && setEditRow(null)}
          row={editRow}
          onSubmit={async (input) => {
            await updateCost.mutateAsync({ id: editRow.recordId!, ...input })
            toast.success('Cost updated')
            setEditRow(null)
          }}
          isPending={updateCost.isPending}
        />
      )}

      <AlertDialog open={!!deleteRow} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete monthly cost?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the cost record for <strong>{deleteRow?.employeeName}</strong> (
              {deleteRow && formatSeatingMiscMonthYear(deleteRow.month, deleteRow.year)})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteRow?.recordId) return
                try {
                  await deleteCost.mutateAsync(deleteRow.recordId)
                  toast.success('Record deleted')
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

      {historyRow?.recordId && (
        <HistoryDialog
          open={!!historyRow}
          onOpenChange={(open) => !open && setHistoryRow(null)}
          recordId={historyRow.recordId}
          employeeName={historyRow.employeeName}
        />
      )}
    </div>
  )
}

function AddCostDialog({
  open,
  onOpenChange,
  row,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SeatingMiscCostRow
  onSubmit: (input: {
    employeeIds: string[]
    month: number
    year: number
    miscCost: number
    status?: 'PENDING' | 'APPROVED' | 'PAID'
    remarks?: string | null
  }) => Promise<void>
  isPending: boolean
}) {
  const [miscCost, setMiscCost] = useState('0')
  const [status, setStatus] = useState<string>('PENDING')
  const [remarks, setRemarks] = useState('')
  const skipBackOnCloseRef = useRef(false)

  useEffect(() => {
    if (open) {
      setMiscCost('0')
      setStatus('PENDING')
      setRemarks('')
    }
  }, [open, row.employeeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedMisc = Number(miscCost)
    if (Number.isNaN(parsedMisc) || parsedMisc < 0) {
      toast.error('Enter a valid misc cost')
      return
    }
    skipBackOnCloseRef.current = true
    try {
      await onSubmit({
        employeeIds: [row.employeeId],
        month: row.month,
        year: row.year,
        miscCost: parsedMisc,
        status: status as 'PENDING' | 'APPROVED' | 'PAID',
        remarks: remarks.trim() || null,
      })
    } catch (err) {
      skipBackOnCloseRef.current = false
      toast.error(err instanceof Error ? err.message : 'Failed to add cost')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
            <DialogTitle>Add monthly cost</DialogTitle>
            <DialogDescription className="text-xs">
              {formatSeatingMiscMonthYear(row.month, row.year)} — seating cost is applied from Master
              Seating Cost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employee name</Label>
              <Input className="h-9 bg-muted/40" value={row.employeeName} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Employee ID</Label>
              <Input className="h-9 bg-muted/40" value={row.employeeCode} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Seating cost (from master)</Label>
              <Input
                className="h-9 bg-muted/40"
                value={
                  row.masterSeatingAmount != null
                    ? formatCurrency(row.masterSeatingAmount)
                    : 'Not configured (₹0)'
                }
                readOnly
              />
              {row.masterSeatingAmount == null && (
                <p className="text-[10px] text-muted-foreground">
                  Set Master Seating Cost for this employee to apply a seating amount.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="misc-cost" className="text-xs">
                Misc cost (INR)
              </Label>
              <Input
                id="misc-cost"
                type="number"
                min="0"
                step="0.01"
                className="h-9"
                value={miscCost}
                onChange={(e) => setMiscCost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEATING_MISC_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEATING_MISC_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="text-xs">
                Remarks <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="min-h-0 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditCostDialog({
  open,
  onOpenChange,
  row,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: SeatingMiscCostRow
  onSubmit: (input: {
    miscCost?: number
    status?: 'PENDING' | 'APPROVED' | 'PAID'
    remarks?: string | null
    refreshSeatingFromMaster?: boolean
  }) => Promise<void>
  isPending: boolean
}) {
  const [miscCost, setMiscCost] = useState(String(row.miscCost ?? 0))
  const [status, setStatus] = useState(row.status ?? 'PENDING')
  const [remarks, setRemarks] = useState(row.remarks ?? '')
  const [refreshMaster, setRefreshMaster] = useState(false)
  const skipBackOnCloseRef = useRef(false)

  useEffect(() => {
    if (open) {
      setMiscCost(String(row.miscCost ?? 0))
      setStatus(row.status ?? 'PENDING')
      setRemarks(row.remarks ?? '')
      setRefreshMaster(false)
    }
  }, [open, row])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedMisc = Number(miscCost)
    if (Number.isNaN(parsedMisc) || parsedMisc < 0) {
      toast.error('Enter a valid misc cost')
      return
    }
    skipBackOnCloseRef.current = true
    try {
      await onSubmit({
        miscCost: parsedMisc,
        status: status as 'PENDING' | 'APPROVED' | 'PAID',
        remarks: remarks.trim() || null,
        refreshSeatingFromMaster: refreshMaster,
      })
    } catch (err) {
      skipBackOnCloseRef.current = false
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
            <DialogTitle>Edit monthly cost</DialogTitle>
            <DialogDescription className="text-xs">
              {row.employeeName} · {formatSeatingMiscMonthYear(row.month, row.year)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Seating cost (from master)</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {formatCurrency(row.seatingCost ?? 0)}
                {row.masterSeatingAmount != null && row.masterSeatingAmount !== row.seatingCost && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (master: {formatCurrency(row.masterSeatingAmount)})
                  </span>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={refreshMaster}
                  onChange={(e) => setRefreshMaster(e.target.checked)}
                />
                Refresh seating from current master amount
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-misc" className="text-xs">
                Misc cost (INR)
              </Label>
              <Input
                id="edit-misc"
                type="number"
                min="0"
                step="0.01"
                className="h-9"
                value={miscCost}
                onChange={(e) => setMiscCost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEATING_MISC_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEATING_MISC_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-remarks" className="text-xs">
                Remarks
              </Label>
              <Textarea
                id="edit-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="min-h-0 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function HistoryDialog({
  open,
  onOpenChange,
  recordId,
  employeeName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string
  employeeName: string
}) {
  const { data, isLoading } = useSeatingMiscCostHistory(recordId, open)
  const history = data?.history ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change history</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ul className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {history.map((h) => (
              <li key={h.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{h.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(h.changedAt), 'dd MMM yyyy, h:mm a')}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span>Seating: {formatCurrency(h.seatingCost)}</span>
                  <span>Misc: {formatCurrency(h.miscCost)}</span>
                  <span>Status: {SEATING_MISC_STATUS_LABEL[h.status]}</span>
                  <span>By: {h.changedBy}</span>
                </div>
                {h.remarks && (
                  <p className="mt-2 text-xs text-muted-foreground">{h.remarks}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function SeatingMiscCostPageContent() {
  return (
    <AuthenticatedLayout>
      <SeatingMiscCostView />
    </AuthenticatedLayout>
  )
}
