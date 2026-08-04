'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Pencil, Search, Trash2, Upload, UserPlus, X, CheckCircle2, Banknote } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { formatCurrency, MONTHS } from '@/lib/finance/payroll-types'
import {
  INCENTIVE_STATUS_LABEL,
  formatIncentiveMonthYear,
  getIncentivePeriodForCreation,
  type IncentiveRecord,
  type IncentiveEmployeeOption,
} from '@/lib/incentives/types'
import {
  canApproveIncentives,
  canCreateIncentives,
  canPayIncentives,
} from '@/lib/incentives/permissions'
import {
  useBulkApproveIncentives,
  useBulkPayIncentives,
  useCreateIncentives,
  useDeleteIncentive,
  useIncentives,
  useUpdateIncentive,
} from '@/hooks/use-incentives'
import { useAuth } from '@/hooks/use-auth'
import { EmployeeMultiSelect } from '@/components/incentives/employee-multi-select'

const ALL = 'all'

const STATUS_FILTER_OPTIONS = ['PENDING', 'APPROVED', 'PAID'] as const
const EMPTY_RECORDS: IncentiveRecord[] = []
const EMPTY_EMPLOYEES: IncentiveEmployeeOption[] = []

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'PAID') return 'default'
  if (status === 'APPROVED') return 'secondary'
  return 'outline'
}

export function IncentivesView() {
  const earnedPeriod = useMemo(() => getIncentivePeriodForCreation(new Date()), [])
  const { user } = useAuth()
  const canCreate = user ? canCreateIncentives(user) : false
  const canApprove = user ? canApproveIncentives(user) : false
  const canPay = user ? canPayIncentives(user) : false
  const isFinanceWorkflow = canApprove || canPay

  const [filterMonth, setFilterMonth] = useState<string>(String(earnedPeriod.month))
  const [filterYear, setFilterYear] = useState<string>(String(earnedPeriod.year))
  const [filterStatus, setFilterStatus] = useState<string>(isFinanceWorkflow ? 'PENDING' : ALL)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [queuedEmployees, setQueuedEmployees] = useState<IncentiveEmployeeOption[]>([])
  const [editRecord, setEditRecord] = useState<IncentiveRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<IncentiveRecord | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(
    () => ({
      month: filterMonth === ALL ? null : Number(filterMonth),
      year: filterYear === ALL ? null : Number(filterYear),
      status: filterStatus === ALL ? null : filterStatus,
      search: debouncedSearch || null,
    }),
    [filterMonth, filterYear, filterStatus, debouncedSearch],
  )

  const { data, isLoading, isError, refetch } = useIncentives(filters)
  const createIncentives = useCreateIncentives()
  const updateIncentive = useUpdateIncentive()
  const deleteIncentive = useDeleteIncentive()
  const bulkApprove = useBulkApproveIncentives()
  const bulkPay = useBulkPayIncentives()

  // Stable empty fallbacks — `?? []` creates a new array every render and can
  // infinite-loop effects that depend on `records` (React #185 in production).
  const records = data?.records ?? EMPTY_RECORDS
  const employees = data?.employees ?? EMPTY_EMPLOYEES

  useEffect(() => {
    setSelectedIds((prev) => (prev.length === 0 ? prev : []))
  }, [filterMonth, filterYear, filterStatus, debouncedSearch])

  const selectableRecords = useMemo(
    () =>
      records.filter((r) =>
        (canApprove && r.status === 'PENDING') || (canPay && r.status === 'APPROVED'),
      ),
    [records, canApprove, canPay],
  )

  const allSelectableSelected =
    selectableRecords.length > 0 &&
    selectableRecords.every((r) => selectedIds.includes(r.id))

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectableRecords.map((r) => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1]
  }, [])

  const totalAmount = useMemo(
    () => records.reduce((sum, r) => sum + r.amount, 0),
    [records],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incentive</h1>
          <p className="text-sm text-muted-foreground">
            {canCreate
              ? 'Managers upload incentives as Pending for the previous month. Finance approves and marks them Paid.'
              : isFinanceWorkflow
                ? 'Review pending incentives, approve in bulk, then mark approved records as paid.'
                : 'View monthly employee incentives.'}
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" onClick={() => setAddEmployeeOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add employee
            </Button>
            <Button
              onClick={() => setUploadOpen(true)}
              disabled={queuedEmployees.length === 0}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload incentive
              {queuedEmployees.length > 0 && (
                <Badge variant="secondary" className="ml-1 rounded-sm px-1.5 py-0 text-xs">
                  {queuedEmployees.length}
                </Badge>
              )}
            </Button>
          </div>
        )}
      </div>

      {canCreate && queuedEmployees.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Employees ready for upload</CardTitle>
                <CardDescription>
                  {queuedEmployees.length} employee{queuedEmployees.length === 1 ? '' : 's'} added.
                  Click Upload incentive to enter amounts.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setQueuedEmployees([])}
              >
                Clear all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {queuedEmployees.map((emp) => (
                <Badge key={emp.id} variant="outline" className="gap-1 py-1 pl-2 pr-1">
                  <span>{emp.name}</span>
                  <span className="text-muted-foreground">· {emp.employeeCode}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
                    onClick={() =>
                      setQueuedEmployees((prev) => prev.filter((e) => e.id !== emp.id))
                    }
                    aria-label={`Remove ${emp.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total incentive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incentive records</CardTitle>
          <CardDescription>
            Search and filter by month, year, or status
            {canCreate && (
              <span className="block mt-1">
                New uploads are recorded for{' '}
                <strong>{formatIncentiveMonthYear(earnedPeriod.month, earnedPeriod.year)}</strong>{' '}
                (previous month).
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(canApprove || canPay) && records.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {canApprove && (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={
                    selectedIds.length === 0 ||
                    !records.some((r) => selectedIds.includes(r.id) && r.status === 'PENDING') ||
                    bulkApprove.isPending
                  }
                  onClick={async () => {
                    const ids = records
                      .filter((r) => selectedIds.includes(r.id) && r.status === 'PENDING')
                      .map((r) => r.id)
                    if (ids.length === 0) return
                    try {
                      await bulkApprove.mutateAsync(ids)
                      toast.success(`Approved ${ids.length} incentive(s)`)
                      setSelectedIds([])
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to approve')
                    }
                  }}
                >
                  {bulkApprove.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve selected
                </Button>
              )}
              {canPay && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  disabled={
                    selectedIds.length === 0 ||
                    !records.some((r) => selectedIds.includes(r.id) && r.status === 'APPROVED') ||
                    bulkPay.isPending
                  }
                  onClick={async () => {
                    const ids = records
                      .filter((r) => selectedIds.includes(r.id) && r.status === 'APPROVED')
                      .map((r) => r.id)
                    if (ids.length === 0) return
                    try {
                      await bulkPay.mutateAsync(ids)
                      toast.success(`Marked ${ids.length} incentive(s) as paid`)
                      setSelectedIds([])
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to mark as paid')
                    }
                  }}
                >
                  {bulkPay.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Mark selected as paid
                </Button>
              )}
              {selectedIds.length > 0 && (
                <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee ID, department…"
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
                <SelectItem value={ALL}>All months</SelectItem>
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
                <SelectItem value={ALL}>All years</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {INCENTIVE_STATUS_LABEL[s]}
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
              Failed to load incentives.{' '}
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No incentive records found for the selected filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(canApprove || canPay) && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelectableSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all eligible rows"
                          disabled={selectableRecords.length === 0}
                        />
                      </TableHead>
                    )}
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Incentive Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {canCreate && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const isSelectable =
                      (canApprove && record.status === 'PENDING') ||
                      (canPay && record.status === 'APPROVED')
                    const canEditRow = canCreate && record.status === 'PENDING'

                    return (
                    <TableRow key={record.id}>
                      {(canApprove || canPay) && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(record.id)}
                            onCheckedChange={() => toggleSelect(record.id)}
                            disabled={!isSelectable}
                            aria-label={`Select ${record.employeeName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{record.employeeName}</TableCell>
                      <TableCell>{record.employeeCode}</TableCell>
                      <TableCell>{record.department ?? '—'}</TableCell>
                      <TableCell>{record.designation ?? '—'}</TableCell>
                      <TableCell>{formatIncentiveMonthYear(record.month, record.year)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(record.status)}>
                          {INCENTIVE_STATUS_LABEL[record.status]}
                        </Badge>
                      </TableCell>
                      {canCreate && (
                        <TableCell className="text-right">
                          {canEditRow ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditRecord(record)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteRecord(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canCreate && (
        <>
          <AddEmployeeDialog
            open={addEmployeeOpen}
            onOpenChange={setAddEmployeeOpen}
            employees={employees.filter((e) => !queuedEmployees.some((q) => q.id === e.id))}
            onAdd={(selected) => {
              if (selected.length === 0) {
                toast.error('Select at least one employee')
                return
              }
              setQueuedEmployees((prev) => [...prev, ...selected])
              toast.success(`Added ${selected.length} employee(s) for incentive upload`)
              setAddEmployeeOpen(false)
            }}
          />

          <UploadIncentiveDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            employees={queuedEmployees}
            defaultMonth={filterMonth === ALL ? earnedPeriod.month : Number(filterMonth)}
            defaultYear={filterYear === ALL ? earnedPeriod.year : Number(filterYear)}
            onSubmit={async (input) => {
              try {
                await createIncentives.mutateAsync(input)
                toast.success(`Incentive added for ${input.entries!.length} employee(s) as Pending`)
                setQueuedEmployees([])
                setUploadOpen(false)
                setFilterStatus('PENDING')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to upload incentives')
              }
            }}
            isPending={createIncentives.isPending}
          />

          {editRecord && (
            <EditIncentiveDialog
              open={!!editRecord}
              onOpenChange={(open) => !open && setEditRecord(null)}
              record={editRecord}
              onSubmit={async (input) => {
                try {
                  await updateIncentive.mutateAsync({ id: editRecord.id, ...input })
                  toast.success('Incentive updated')
                  setEditRecord(null)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to update incentive')
                }
              }}
              isPending={updateIncentive.isPending}
            />
          )}

          <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete incentive?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the incentive record for{' '}
                  <strong>{deleteRecord?.employeeName}</strong> (
                  {deleteRecord && formatIncentiveMonthYear(deleteRecord.month, deleteRecord.year)}).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleteRecord) return
                    try {
                      await deleteIncentive.mutateAsync(deleteRecord.id)
                      toast.success('Incentive deleted')
                      setDeleteRecord(null)
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
        </>
      )}
    </div>
  )
}

function AddEmployeeDialog({
  open,
  onOpenChange,
  employees,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: IncentiveEmployeeOption[]
  onAdd: (selected: IncentiveEmployeeOption[]) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const reset = () => setSelectedIds([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selected = employees.filter((e) => selectedIds.includes(e.id))
    onAdd(selected)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
            <DialogTitle>Add employees for incentive</DialogTitle>
            <DialogDescription className="text-xs">
              Select employees to include in the next incentive upload.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employees</Label>
              <EmployeeMultiSelect
                employees={employees}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                placeholder="Search and select employees"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={selectedIds.length === 0}>
              Add to list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UploadIncentiveDialog({
  open,
  onOpenChange,
  employees,
  defaultMonth,
  defaultYear,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: IncentiveEmployeeOption[]
  defaultMonth: number
  defaultYear: number
  onSubmit: (input: {
    entries: { employeeId: string; amount: number }[]
    month: number
    year: number
    note?: string | null
  }) => Promise<void>
  isPending: boolean
}) {
  const [month, setMonth] = useState(String(defaultMonth))
  const [year, setYear] = useState(String(defaultYear))
  const [note, setNote] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const employeeIdsKey = useMemo(() => employees.map((e) => e.id).join(','), [employees])

  useEffect(() => {
    if (!open) return
    setMonth(String(defaultMonth))
    setYear(String(defaultYear))
    setNote('')
    setAmounts(
      Object.fromEntries(
        employeeIdsKey
          ? employeeIdsKey.split(',').map((id) => [id, ''])
          : [],
      ),
    )
  }, [open, defaultMonth, defaultYear, employeeIdsKey])

  const yearOptions = [defaultYear - 1, defaultYear, defaultYear + 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const entries: { employeeId: string; amount: number }[] = []

    for (const emp of employees) {
      const parsed = Number(amounts[emp.id])
      if (!parsed || parsed <= 0) {
        toast.error(`Enter a valid amount for ${emp.name}`)
        return
      }
      entries.push({ employeeId: emp.id, amount: parsed })
    }

    await onSubmit({
      entries,
      month: Number(month),
      year: Number(year),
      note: note.trim() || null,
    })
  }

  const totalAmount = employees.reduce((sum, emp) => sum + (Number(amounts[emp.id]) || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
            <DialogTitle>Upload incentive</DialogTitle>
            <DialogDescription className="text-xs">
              Enter the incentive amount for each employee. Records are saved as Pending for{' '}
              {formatIncentiveMonthYear(Number(month), Number(year))}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Incentive month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
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
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="w-[180px] text-right">Incentive amount (INR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="font-medium">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {emp.employeeCode}
                          {emp.department ? ` · ${emp.department}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          className="h-9 text-right"
                          placeholder="0"
                          value={amounts[emp.id] ?? ''}
                          onChange={(e) =>
                            setAmounts((prev) => ({ ...prev, [emp.id]: e.target.value }))
                          }
                          required
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-note" className="text-xs">
                Note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="upload-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="min-h-0 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t px-4 py-3 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending || employees.length === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit all incentives
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditIncentiveDialog({
  open,
  onOpenChange,
  record,
  onSubmit,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: IncentiveRecord
  onSubmit: (input: {
    amount?: number
    month?: number
    year?: number
    note?: string | null
  }) => Promise<void>
  isPending: boolean
}) {
  const [amount, setAmount] = useState(String(record.amount))
  const [month, setMonth] = useState(String(record.month))
  const [year, setYear] = useState(String(record.year))
  const [note, setNote] = useState(record.note ?? '')

  const yearOptions = [record.year - 1, record.year, record.year + 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    await onSubmit({
      amount: parsedAmount,
      month: Number(month),
      year: Number(year),
      note: note.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit incentive</DialogTitle>
            <DialogDescription>
              {record.employeeName} ({record.employeeCode})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-amount">Incentive amount (INR)</Label>
              <Input
                id="edit-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Badge variant={statusVariant(record.status)} className="w-fit">
                {INCENTIVE_STATUS_LABEL[record.status]}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Status changes are handled by Finance (approve / paid).
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-note">Note</Label>
              <Textarea id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated {format(new Date(record.updatedAt), 'dd MMM yyyy, h:mm a')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function IncentivesPageContent() {
  return (
    <AuthenticatedLayout>
      <IncentivesView />
    </AuthenticatedLayout>
  )
}
