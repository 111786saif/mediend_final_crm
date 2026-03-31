'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProtectedRoute } from '@/components/protected-route'
import { toast } from 'sonner'
import { Plus, Pencil, Landmark, Store, Save, PieChart } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

type Vendor = {
  id: string
  name: string
  isActive: boolean
  sortOrder: number
}

type RevenueRow = {
  id: string
  month: number
  year: number
  amount: number
  description: string | null
  notes: string | null
  vendorId: string | null
  vendor: { id: string; name: string } | null
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const CHART_COLORS = [
  'hsl(263 70% 52%)',
  'hsl(199 89% 48%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(346 77% 50%)',
  'hsl(280 65% 48%)',
]

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function LoanDematRevenuePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const canAccess =
    user && (hasPermission(user, 'loan-demat:write') || hasPermission(user, 'loan-demat:read'))
  const canWrite = user && hasPermission(user, 'loan-demat:write')

  const yearNow = new Date().getFullYear()
  const monthNow = new Date().getMonth() + 1
  const [year, setYear] = useState(yearNow)
  const [month, setMonth] = useState(monthNow)
  const [mainTab, setMainTab] = useState('pnl')

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  const [amountDialogOpen, setAmountDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<RevenueRow | null>(null)
  const [amountForm, setAmountForm] = useState({ amount: '', notes: '' })

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['loan-demat-vendors'],
    queryFn: () => apiGet<Vendor[]>('/api/loan-demat/vendors?activeOnly=false'),
    enabled: !!canAccess,
  })

  const activeVendors = useMemo(
    () => [...vendors].filter((v) => v.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [vendors]
  )

  const { data: rows = [], isLoading: rowsLoading } = useQuery<RevenueRow[]>({
    queryKey: ['loan-demat-revenue', year],
    queryFn: () => apiGet<RevenueRow[]>(`/api/loan-demat/revenue?year=${year}`),
    enabled: !!canAccess,
  })

  const monthRows = useMemo(
    () => rows.filter((r) => r.month === month && r.year === year),
    [rows, month, year]
  )

  const amountByVendorId = useMemo(() => {
    const m = new Map<string, RevenueRow>()
    for (const r of monthRows) {
      if (r.vendorId) m.set(r.vendorId, r)
    }
    return m
  }, [monthRows])

  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraftAmounts({})
  }, [month, year])

  const totalYear = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows])
  const totalMonth = useMemo(() => monthRows.reduce((s, r) => s + (r.amount || 0), 0), [monthRows])

  const vendorTotalsYear = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const key = r.vendor?.name || 'Unassigned / legacy'
      m.set(key, (m.get(key) || 0) + (r.amount || 0))
    }
    return Array.from(m.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [rows])

  const stackedVendorKeys = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) s.add(r.vendor?.name || 'Unassigned / legacy')
    return Array.from(s).sort()
  }, [rows])

  const stackedByMonth = useMemo(() => {
    const keys = stackedVendorKeys
    const byKey = new Map<string, Record<string, number | string> & { label: string; sort: number }>()
    for (const r of rows) {
      const label = `${MONTHS[r.month - 1]} ${r.year}`
      const sort = r.year * 100 + r.month
      const k = `${r.year}-${r.month}`
      if (!byKey.has(k)) {
        const base: Record<string, number | string> = { label, sort }
        for (const vn of keys) base[vn] = 0
        byKey.set(k, base as Record<string, number | string> & { label: string; sort: number })
      }
      const row = byKey.get(k)!
      const vn = r.vendor?.name || 'Unassigned / legacy'
      row[vn] = ((row[vn] as number) || 0) + r.amount
    }
    return Array.from(byKey.values()).sort((a, b) => (a.sort as number) - (b.sort as number))
  }, [rows, stackedVendorKeys])

  /** Net revenue by calendar month for the selected year (all vendors combined). */
  const monthlyNetChartData = useMemo(() => {
    const byMonth = new Map<number, number>()
    for (const r of rows) {
      if (r.year !== year) continue
      byMonth.set(r.month, (byMonth.get(r.month) || 0) + r.amount)
    }
    return MONTHS.map((name, i) => ({
      label: name,
      amount: byMonth.get(i + 1) || 0,
    }))
  }, [rows, year])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['loan-demat-revenue'] })
    qc.invalidateQueries({ queryKey: ['loan-demat-vendors'] })
    qc.invalidateQueries({ queryKey: ['dept-revenue'] })
    qc.invalidateQueries({ queryKey: ['pnl-overview'] })
  }

  const createVendorMut = useMutation({
    mutationFn: () => apiPost<Vendor>('/api/loan-demat/vendors', { name: vendorName.trim() }),
    onSuccess: () => {
      toast.success('Vendor added')
      setVendorDialogOpen(false)
      setVendorName('')
      invalidateAll()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchVendorMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; isActive?: boolean }) =>
      apiPatch(`/api/loan-demat/vendors/${id}`, data),
    onSuccess: () => {
      toast.success('Vendor updated')
      setEditingVendor(null)
      setVendorDialogOpen(false)
      setVendorName('')
      invalidateAll()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchRowMut = useMutation({
    mutationFn: (vars: { id: string; amount: number; notes: string | null }) =>
      apiPatch<RevenueRow>('/api/loan-demat/revenue', {
        id: vars.id,
        amount: vars.amount,
        notes: vars.notes,
      }),
    onSuccess: () => {
      toast.success('Updated')
      setAmountDialogOpen(false)
      setEditingRow(null)
      invalidateAll()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveMonthGrid = () => {
    const tasks: Promise<unknown>[] = []
    for (const v of activeVendors) {
      const existing = amountByVendorId.get(v.id)
      const raw = draftAmounts[v.id] ?? (existing ? String(existing.amount) : '')
      const trimmed = raw.trim()
      if (trimmed === '') {
        if (existing) tasks.push(apiDelete(`/api/loan-demat/revenue?id=${existing.id}`))
        continue
      }
      const num = parseFloat(trimmed)
      if (Number.isNaN(num)) {
        toast.error(`Invalid amount for ${v.name}`)
        return
      }
      const prev = existing != null ? Number(existing.amount) : null
      if (prev != null && !Number.isNaN(prev) && Math.abs(num - prev) < 1e-9) continue
      tasks.push(
        apiPost('/api/loan-demat/revenue', {
          month,
          year,
          vendorId: v.id,
          amount: num,
          notes: existing?.notes ?? null,
        })
      )
    }
    if (tasks.length === 0) {
      toast.message('Nothing to save', { description: 'No changes to apply.' })
      return
    }
    Promise.all(tasks)
      .then(() => {
        toast.success('Saved')
        setDraftAmounts({})
        invalidateAll()
      })
      .catch((e: Error) => toast.error(e.message))
  }

  const openEditRow = (r: RevenueRow) => {
    setEditingRow(r)
    setAmountForm({ amount: String(r.amount), notes: r.notes || '' })
    setAmountDialogOpen(true)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-7 w-7 text-violet-500" />
              Loan &amp; Demat revenue
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Vendors and per-month amounts feed the same totals as Company P&amp;L.
            </p>
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px] rounded-xl">
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
        </div>

        {!canAccess ? (
          <Card>
            <CardContent className="pt-6">You don&apos;t have access to this page.</CardContent>
          </Card>
        ) : (
          <>
            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
              <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 rounded-2xl bg-muted/50 p-1.5 sm:w-auto sm:inline-flex">
                <TabsTrigger value="pnl" className="rounded-xl gap-2 px-4 py-2.5 data-[state=active]:shadow-sm">
                  <PieChart className="h-4 w-4 shrink-0" />
                  P&amp;L
                </TabsTrigger>
                <TabsTrigger value="vendors" className="rounded-xl gap-2 px-4 py-2.5 data-[state=active]:shadow-sm">
                  <Store className="h-4 w-4 shrink-0" />
                  Vendors
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pnl" className="mt-6 space-y-10 outline-none focus-visible:ring-0">
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Net revenue</h2>
                    <p className="text-sm text-muted-foreground">
                      Combined Loan &amp; Demat revenue — same roll-up as Company P&amp;L.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/25">
                      <CardHeader className="pb-2">
                        <CardDescription>Total ({year})</CardDescription>
                        <CardTitle className="text-2xl tabular-nums text-emerald-800 dark:text-emerald-300">
                          {formatInr(totalYear)}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="rounded-2xl border-sky-200/80 bg-sky-50/50 dark:bg-sky-950/25">
                      <CardHeader className="pb-2">
                        <CardDescription>
                          {MONTHS[month - 1]} {year}
                        </CardDescription>
                        <CardTitle className="text-2xl tabular-nums text-sky-800 dark:text-sky-300">
                          {formatInr(totalMonth)}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <Card id="loan-demat-monthly-entry" className="rounded-2xl border-primary/20 shadow-sm ring-1 ring-primary/10">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">Enter monthly revenue</CardTitle>
                        <CardDescription>
                          {canWrite
                            ? 'Pick year and month, type an amount for each vendor, then Save. Vendors are managed in the Vendors tab.'
                            : 'Read-only. You need Loan & Demat write access to enter amounts.'}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                          <SelectTrigger className="w-[120px] rounded-xl">
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
                        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
                          <SelectTrigger className="w-[140px] rounded-xl">
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
                        {canWrite && (
                          <Button size="sm" className="rounded-xl gap-1" onClick={saveMonthGrid}>
                            <Save className="h-4 w-4" />
                            Save revenue
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeVendors.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            You need at least one <strong className="text-foreground">active</strong> vendor before you
                            can record revenue.
                          </p>
                          {canWrite && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-xl"
                              onClick={() => {
                                setMainTab('vendors')
                                setVendorName('')
                                setVendorDialogOpen(true)
                              }}
                            >
                              <Store className="h-4 w-4 mr-2" />
                              Add vendor
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border bg-card">
                          <div className="flex border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="flex-1 min-w-0">Vendor</span>
                            <span className="w-[min(100%,12rem)] shrink-0 text-right sm:w-44">Revenue (INR)</span>
                          </div>
                          <ul className="divide-y">
                            {activeVendors.map((v) => {
                              const existing = amountByVendorId.get(v.id)
                              const draft =
                                draftAmounts[v.id] ?? (existing ? String(existing.amount) : '')
                              return (
                                <li key={v.id} className="flex items-center gap-4 px-4 py-3">
                                  <span className="flex-1 min-w-0 font-medium leading-snug">{v.name}</span>
                                  <div className="w-[min(100%,12rem)] shrink-0 sm:w-44">
                                    {canWrite ? (
                                      <Input
                                        className="h-10 rounded-lg tabular-nums text-right"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={draft}
                                        onChange={(e) =>
                                          setDraftAmounts((d) => ({ ...d, [v.id]: e.target.value }))
                                        }
                                      />
                                    ) : (
                                      <p className="text-right tabular-nums text-sm">
                                        {existing ? formatInr(existing.amount) : '—'}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Net by month ({year})</CardTitle>
                      <CardDescription>All vendors summed per month</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                      <ChartContainer config={{}} className="h-full w-full">
                        <BarChart data={monthlyNetChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="amount" fill="hsl(173 58% 39%)" radius={[4, 4, 0, 0]} name="Revenue" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-4 border-t border-border pt-10">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">Vendor-wise</h2>
                    <p className="text-sm text-muted-foreground">
                      Breakdowns below use the same figures as{' '}
                      <a href="#loan-demat-monthly-entry" className="font-medium text-primary underline-offset-4 hover:underline">
                        monthly revenue entry
                      </a>
                      .
                    </p>
                  </div>

            {stackedByMonth.length > 0 && stackedVendorKeys.length > 0 && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Monthly mix (by vendor)</CardTitle>
                  <CardDescription>Same data as Company P&amp;L Loan &amp; Demat tab</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ChartContainer config={{}} className="h-full w-full">
                    <BarChart data={stackedByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      {stackedVendorKeys.map((vn, i) => (
                        <Bar
                          key={vn}
                          dataKey={vn}
                          stackId="a"
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          radius={i === stackedVendorKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {vendorTotalsYear.length > 0 && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Vendor totals ({year})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorTotalsYear.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-emerald-700">
                              {formatInr(row.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>All entries ({year})</CardTitle>
                <CardDescription>Flat ledger including legacy rows without a vendor</CardDescription>
              </CardHeader>
              <CardContent>
                {rowsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                ) : rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No entries for {year}.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                          {canWrite && <TableHead className="w-[88px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              {MONTHS[r.month - 1]} {r.year}
                            </TableCell>
                            <TableCell>{r.vendor?.name || '—'}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatInr(r.amount)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                              {r.notes || '—'}
                            </TableCell>
                            {canWrite && (
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRow(r)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
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
                </section>
              </TabsContent>

              <TabsContent value="vendors" className="mt-6 outline-none focus-visible:ring-0">
                <Card className="rounded-2xl border-violet-200/80 shadow-sm">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-violet-600" />
                      <div>
                        <CardTitle className="text-base">Vendors</CardTitle>
                        <CardDescription>Create partners before entering monthly revenue</CardDescription>
                      </div>
                    </div>
                    {canWrite && (
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                          setVendorName('')
                          setVendorDialogOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add vendor
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {vendorsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading vendors…</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Status</TableHead>
                              {canWrite && <TableHead className="w-[120px]" />}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {vendors.map((v) => (
                              <TableRow key={v.id}>
                                <TableCell className="font-medium">{v.name}</TableCell>
                                <TableCell>
                                  <Badge variant={v.isActive ? 'default' : 'secondary'} className="rounded-full">
                                    {v.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                {canWrite && (
                                  <TableCell className="text-right space-x-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() => {
                                        setEditingVendor(v)
                                        setVendorName(v.name)
                                        setVendorDialogOpen(true)
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-muted-foreground"
                                      onClick={() =>
                                        patchVendorMut.mutate({ id: v.id, isActive: !v.isActive })
                                      }
                                    >
                                      {v.isActive ? 'Deactivate' : 'Activate'}
                                    </Button>
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
              </TabsContent>
            </Tabs>

            <Dialog
              open={vendorDialogOpen}
              onOpenChange={(o) => {
                setVendorDialogOpen(o)
                if (!o) {
                  setEditingVendor(null)
                  setVendorName('')
                }
              }}
            >
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{editingVendor ? 'Edit vendor' : 'New vendor'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label>Name</Label>
                  <Input
                    className="rounded-xl"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Vendor A"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" className="rounded-xl" onClick={() => setVendorDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl"
                    disabled={
                      !vendorName.trim() ||
                      createVendorMut.isPending ||
                      patchVendorMut.isPending
                    }
                    onClick={() => {
                      if (editingVendor) {
                        patchVendorMut.mutate({ id: editingVendor.id, name: vendorName.trim() })
                      } else {
                        createVendorMut.mutate()
                      }
                    }}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={amountDialogOpen}
              onOpenChange={(o) => {
                setAmountDialogOpen(o)
                if (!o) setEditingRow(null)
              }}
            >
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Edit ledger entry</DialogTitle>
                  {editingRow?.vendor?.name && (
                    <p className="text-sm text-muted-foreground pt-1">{editingRow.vendor.name}</p>
                  )}
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Amount (INR)</Label>
                    <Input
                      className="rounded-xl mt-1 tabular-nums"
                      type="number"
                      value={amountForm.amount}
                      onChange={(e) => setAmountForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      className="rounded-xl mt-1 min-h-[72px]"
                      value={amountForm.notes}
                      onChange={(e) => setAmountForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" className="rounded-xl" onClick={() => setAmountDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl"
                    disabled={!editingRow || patchRowMut.isPending}
                    onClick={() => {
                      if (!editingRow) return
                      patchRowMut.mutate({
                        id: editingRow.id,
                        amount: parseFloat(amountForm.amount) || 0,
                        notes: amountForm.notes.trim() || null,
                      })
                    }}
                  >
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
