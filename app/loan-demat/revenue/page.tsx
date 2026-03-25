'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProtectedRoute } from '@/components/protected-route'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RevenueRow {
  id: string
  month: number
  year: number
  amount: number
  description: string | null
  notes: string | null
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export default function LoanDematRevenuePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const canAccess = user && (hasPermission(user, 'loan-demat:write') || hasPermission(user, 'loan-demat:read'))
  const canWrite = user && hasPermission(user, 'loan-demat:write')

  const yearNow = new Date().getFullYear()
  const [year, setYear] = useState(yearNow)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RevenueRow | null>(null)
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: yearNow,
    amount: '',
    description: '',
    notes: '',
  })

  const { data: rows = [], isLoading } = useQuery<RevenueRow[]>({
    queryKey: ['loan-demat-revenue', year],
    queryFn: () => apiGet<RevenueRow[]>(`/api/loan-demat/revenue?year=${year}`),
    enabled: !!canAccess,
  })

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        month: form.month,
        year: form.year,
        amount: parseFloat(form.amount) || 0,
        description: form.description || null,
        notes: form.notes || null,
      }
      if (editing) {
        return apiPatch<RevenueRow>('/api/loan-demat/revenue', { id: editing.id, ...payload })
      }
      return apiPost<RevenueRow>('/api/loan-demat/revenue', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan-demat-revenue'] })
      toast.success(editing ? 'Updated' : 'Added')
      setDialogOpen(false)
      setEditing(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/loan-demat/revenue?id=${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan-demat-revenue'] })
      toast.success('Deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openNew = () => {
    setEditing(null)
    setForm({
      month: new Date().getMonth() + 1,
      year,
      amount: '',
      description: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (r: RevenueRow) => {
    setEditing(r)
    setForm({
      month: r.month,
      year: r.year,
      amount: String(r.amount),
      description: r.description || '',
      notes: r.notes || '',
    })
    setDialogOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-7 w-7 text-violet-500" />
              Loan & Demat Revenue
            </h1>
            <p className="text-muted-foreground">Record revenue booked for Loan & Demat</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[yearNow - 1, yearNow, yearNow + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canWrite && (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                Add revenue
              </Button>
            )}
          </div>
        </div>

        {!canAccess ? (
          <Card>
            <CardContent className="pt-6">You don&apos;t have access to this page.</CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-background">
              <CardHeader>
                <CardTitle className="text-violet-700 dark:text-violet-300">Total ({year})</CardTitle>
                <CardDescription>Sum of all entries this year</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">{formatInr(total)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="text-muted-foreground">No entries for {year}.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        {canWrite && <TableHead className="w-[100px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {MONTHS[r.month - 1]} {r.year}
                          </TableCell>
                          <TableCell>{r.description || '—'}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">{formatInr(r.amount)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {r.notes || '—'}
                          </TableCell>
                          {canWrite && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('Delete this entry?')) deleteMutation.mutate(r.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit revenue' : 'Add revenue'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Month</Label>
                      <Select
                        value={String(form.month)}
                        onValueChange={(v) => setForm((f) => ({ ...f, month: parseInt(v, 10) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={m} value={String(i + 1)}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Input
                        type="number"
                        value={form.year}
                        onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value, 10) || yearNow }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Amount (INR)</Label>
                    <Input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
