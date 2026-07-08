'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
  INCENTIVE_STATUS_LABEL,
  INCENTIVE_STATUS_OPTIONS,
  formatIncentiveMonthYear,
  type IncentiveRecord,
} from '@/lib/incentives/types'
import {
  useCreateIncentives,
  useDeleteIncentive,
  useIncentives,
  useUpdateIncentive,
} from '@/hooks/use-incentives'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { EmployeeMultiSelect } from '@/components/incentives/employee-multi-select'

const ALL = 'all'

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'PAID') return 'default'
  if (status === 'APPROVED') return 'secondary'
  return 'outline'
}

export function IncentivesView() {
  const now = new Date()
  const { user } = useAuth()
  const canWrite = user ? hasPermission(user, 'incentive:write') : false

  const [filterMonth, setFilterMonth] = useState<string>(String(now.getMonth() + 1))
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()))
  const [filterStatus, setFilterStatus] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<IncentiveRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<IncentiveRecord | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = {
    month: filterMonth === ALL ? null : Number(filterMonth),
    year: filterYear === ALL ? null : Number(filterYear),
    status: filterStatus === ALL ? null : filterStatus,
    search: debouncedSearch || null,
  }

  const { data, isLoading, isError, refetch } = useIncentives(filters)
  const createIncentives = useCreateIncentives()
  const updateIncentive = useUpdateIncentive()
  const deleteIncentive = useDeleteIncentive()

  const records = data?.records ?? []
  const employees = data?.employees ?? []

  const yearOptions = useMemo(() => {
    const y = now.getFullYear()
    return [y - 1, y, y + 1]
  }, [now])

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
            Manage monthly employee incentives. Duplicate entries for the same employee and month are
            not allowed.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add incentive
          </Button>
        )}
      </div>

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
          <CardDescription>Search and filter by month, year, or status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {INCENTIVE_STATUS_OPTIONS.map((s) => (
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
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Incentive Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {canWrite && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
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
                      {canWrite && (
                        <TableCell className="text-right">
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
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <>
          <AddIncentiveDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            employees={employees}
            defaultMonth={filterMonth === ALL ? now.getMonth() + 1 : Number(filterMonth)}
            defaultYear={filterYear === ALL ? now.getFullYear() : Number(filterYear)}
            onSubmit={async (input) => {
              try {
                await createIncentives.mutateAsync(input)
                toast.success(`Incentive added for ${input.employeeIds.length} employee(s)`)
                setAddOpen(false)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to add incentive')
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

function AddIncentiveDialog({
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
  employees: { id: string; employeeCode: string; name: string; department: string | null; designation: string | null }[]
  defaultMonth: number
  defaultYear: number
  onSubmit: (input: {
    employeeIds: string[]
    month: number
    year: number
    amount: number
    status?: 'PENDING' | 'APPROVED' | 'PAID'
    note?: string | null
  }) => Promise<void>
  isPending: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [month, setMonth] = useState(String(defaultMonth))
  const [year, setYear] = useState(String(defaultYear))
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'PAID'>('PENDING')
  const [note, setNote] = useState('')

  const reset = () => {
    setSelectedIds([])
    setMonth(String(defaultMonth))
    setYear(String(defaultYear))
    setAmount('')
    setStatus('PENDING')
    setNote('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0) {
      toast.error('Select at least one employee')
      return
    }
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid incentive amount')
      return
    }
    await onSubmit({
      employeeIds: selectedIds,
      month: Number(month),
      year: Number(year),
      amount: parsedAmount,
      status,
      note: note.trim() || null,
    })
    reset()
  }

  const yearOptions = [defaultYear - 1, defaultYear, defaultYear + 1]

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
            <DialogTitle>Add monthly incentive</DialogTitle>
            <DialogDescription className="text-xs">
              Select employees, period, and amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Month</Label>
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

            <div className="space-y-1.5">
              <Label className="text-xs">Employees</Label>
              <EmployeeMultiSelect
                employees={employees}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                placeholder="Select employees"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-xs">
                  Amount (INR)
                </Label>
                <Input
                  id="amount"
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
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCENTIVE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {INCENTIVE_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs">
                Note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="note"
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
    status?: 'PENDING' | 'APPROVED' | 'PAID'
    month?: number
    year?: number
    note?: string | null
  }) => Promise<void>
  isPending: boolean
}) {
  const [amount, setAmount] = useState(String(record.amount))
  const [month, setMonth] = useState(String(record.month))
  const [year, setYear] = useState(String(record.year))
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'PAID'>(record.status)
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
      status,
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
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCENTIVE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INCENTIVE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
