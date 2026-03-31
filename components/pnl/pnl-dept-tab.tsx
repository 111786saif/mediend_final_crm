'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { toast } from 'sonner'

type RevRow = {
  id: string
  month: number
  year: number
  amount: number
  description: string | null
  notes?: string | null
  vendorId?: string | null
  vendor?: { id: string; name: string } | null
}

type Vendor = { id: string; name: string; isActive: boolean }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STACK_COLORS = [
  'hsl(263 70% 52%)',
  'hsl(199 89% 48%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(346 77% 50%)',
  'hsl(280 65% 48%)',
]

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function PnlDeptTab({
  mode,
  startYear,
  endYear,
  canEdit,
}: {
  mode: 'LOAN_DEMAT' | 'GOOGLE_ADS'
  startYear: number
  endYear: number
  canEdit: boolean
}) {
  const qc = useQueryClient()
  const isLoan = mode === 'LOAN_DEMAT'

  const years = useMemo(() => {
    const ys: number[] = []
    for (let y = startYear; y <= endYear; y++) ys.push(y)
    return ys
  }, [startYear, endYear])

  const apiPath = isLoan ? '/api/loan-demat/revenue' : '/api/pnl/google-ads'

  const { data: rows, isLoading } = useQuery({
    queryKey: ['dept-revenue', mode, years.join(',')],
    queryFn: async () => {
      const all: RevRow[] = []
      for (const y of years) {
        const chunk = await apiGet<RevRow[]>(`${apiPath}?year=${y}`)
        all.push(...chunk)
      }
      return all.sort((a, b) => b.year - a.year || b.month - a.month)
    },
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['loan-demat-vendors', 'pnl-tab'],
    queryFn: () => apiGet<Vendor[]>('/api/loan-demat/vendors'),
    enabled: isLoan,
  })

  const activeVendors = useMemo(
    () => vendors.filter((v) => v.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [vendors]
  )

  const chartData = useMemo(() => {
    if (!rows) return []
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = `${r.year}-${r.month}`
      map.set(k, (map.get(k) || 0) + r.amount)
    }
    return Array.from(map.entries())
      .map(([k, v]) => {
        const [ys, ms] = k.split('-').map(Number)
        return { label: `${ms}/${ys}`, amount: v, sort: ys * 100 + ms }
      })
      .sort((a, b) => a.sort - b.sort)
  }, [rows])

  const stackedVendorKeys = useMemo(() => {
    if (!isLoan || !rows) return [] as string[]
    const s = new Set<string>()
    for (const r of rows) s.add(r.vendor?.name || 'Unassigned / legacy')
    return Array.from(s).sort()
  }, [isLoan, rows])

  const stackedByMonth = useMemo(() => {
    if (!isLoan || !rows || stackedVendorKeys.length === 0) return []
    const keys = stackedVendorKeys
    const byKey = new Map<string, Record<string, number | string> & { label: string; sort: number }>()
    for (const r of rows) {
      const label = `${MONTHS_SHORT[r.month - 1]} ${r.year}`
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
  }, [isLoan, rows, stackedVendorKeys])

  const vendorTotals = useMemo(() => {
    if (!isLoan || !rows) return []
    const m = new Map<string, number>()
    for (const r of rows) {
      const key = r.vendor?.name || 'Unassigned / legacy'
      m.set(key, (m.get(key) || 0) + r.amount)
    }
    return Array.from(m.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [isLoan, rows])

  const total = rows?.reduce((s, r) => s + r.amount, 0) ?? 0

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: '',
    description: '',
    vendorId: '',
  })

  const save = useMutation({
    mutationFn: () => {
      if (isLoan) {
        if (!form.vendorId) throw new Error('Select a vendor')
        return apiPost(apiPath, {
          month: form.month,
          year: form.year,
          amount: parseFloat(form.amount) || 0,
          vendorId: form.vendorId,
          description: form.description || null,
        })
      }
      return apiPost(apiPath, {
        month: form.month,
        year: form.year,
        amount: parseFloat(form.amount) || 0,
        description: form.description || null,
      })
    },
    onSuccess: () => {
      toast.success('Saved')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['dept-revenue'] })
      qc.invalidateQueries({ queryKey: ['pnl-overview'] })
      qc.invalidateQueries({ queryKey: ['loan-demat-revenue'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const title = isLoan ? 'Loan & Demat' : 'Google Ads'

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-card dark:from-emerald-950/30">
        <CardHeader>
          <CardTitle>Total revenue ({title})</CardTitle>
          <CardDescription>Across selected years in range</CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-bold text-emerald-700 tabular-nums">{formatInr(total)}</CardContent>
      </Card>

      {isLoan && vendorTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By vendor (period)</CardTitle>
            <CardDescription>Matches vendor-wise entries on Loan &amp; Demat revenue page</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorTotals.map((v) => (
                  <TableRow key={v.name}>
                    <TableCell>{v.name}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatInr(v.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Monthly revenue</CardTitle>
            <CardDescription>Aggregated by month</CardDescription>
          </div>
          {canEdit && (
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o)
                if (o) {
                  setForm({
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    amount: '',
                    description: '',
                    vendorId: activeVendors[0]?.id ?? '',
                  })
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>Add entry</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add {title} revenue</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label>Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: parseInt(e.target.value, 10) }))}
                  />
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value, 10) }))}
                  />
                  {isLoan && (
                    <>
                      <Label>Vendor</Label>
                      <Select
                        value={form.vendorId}
                        onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeVendors.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Label>Amount</Label>
                  <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  {!isLoan && (
                    <>
                      <Label>Description</Label>
                      <Input
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => save.mutate()}
                    disabled={save.isPending || (isLoan && (!form.vendorId || activeVendors.length === 0))}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="h-[280px]">
          {chartData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data</p>
          ) : (
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="amount" fill="hsl(173 58% 39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {isLoan && stackedByMonth.length > 0 && stackedVendorKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly mix by vendor</CardTitle>
            <CardDescription>Stacked view of the same underlying rows</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={{}} className="h-full w-full">
              <BarChart data={stackedByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                {stackedVendorKeys.map((vn, i) => (
                  <Bar
                    key={vn}
                    dataKey={vn}
                    stackId="a"
                    fill={STACK_COLORS[i % STACK_COLORS.length]}
                    radius={i === stackedVendorKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading || !rows ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Year</TableHead>
                  {isLoan && <TableHead>Vendor</TableHead>}
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>{isLoan ? 'Notes / description' : 'Description'}</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <DeptRowEditor
                    key={r.id}
                    row={r}
                    apiPath={apiPath}
                    canEdit={canEdit}
                    isLoan={isLoan}
                    onChanged={() => {
                      qc.invalidateQueries({ queryKey: ['dept-revenue'] })
                      qc.invalidateQueries({ queryKey: ['pnl-overview'] })
                      qc.invalidateQueries({ queryKey: ['loan-demat-revenue'] })
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DeptRowEditor({
  row,
  apiPath,
  canEdit,
  isLoan,
  onChanged,
}: {
  row: RevRow
  apiPath: string
  canEdit: boolean
  isLoan: boolean
  onChanged: () => void
}) {
  const [amount, setAmount] = useState(String(row.amount))
  const save = useMutation({
    mutationFn: () => apiPatch(apiPath, { id: row.id, amount: parseFloat(amount) || 0 }),
    onSuccess: () => {
      toast.success('Updated')
      onChanged()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const desc = isLoan ? row.notes || row.description : row.description

  return (
    <TableRow>
      <TableCell>{row.month}</TableCell>
      <TableCell>{row.year}</TableCell>
      {isLoan && <TableCell className="text-muted-foreground">{row.vendor?.name || '—'}</TableCell>}
      <TableCell className="text-right">
        {canEdit ? (
          <Input className="h-8 w-32 text-right inline-block" value={amount} onChange={(e) => setAmount(e.target.value)} />
        ) : (
          formatInr(row.amount)
        )}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[220px] truncate">{desc || '—'}</TableCell>
      {canEdit && (
        <TableCell>
          <Button size="sm" variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}
