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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { toast } from 'sonner'
type RevRow = {
  id: string
  month: number
  year: number
  amount: number
  description: string | null
}

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

  const years = useMemo(() => {
    const ys: number[] = []
    for (let y = startYear; y <= endYear; y++) ys.push(y)
    return ys
  }, [startYear, endYear])

  const apiPath = mode === 'LOAN_DEMAT' ? '/api/loan-demat/revenue' : '/api/pnl/google-ads'

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

  const total = rows?.reduce((s, r) => s + r.amount, 0) ?? 0

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: '', description: '' })

  const save = useMutation({
    mutationFn: () =>
      apiPost(apiPath, {
        month: form.month,
        year: form.year,
        amount: parseFloat(form.amount) || 0,
        description: form.description || null,
      }),
    onSuccess: () => {
      toast.success('Saved')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['dept-revenue'] })
      qc.invalidateQueries({ queryKey: ['pnl-overview'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const title = mode === 'LOAN_DEMAT' ? 'Loan & Demat' : 'Google Ads'

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-card dark:from-emerald-950/30">
        <CardHeader>
          <CardTitle>Total revenue ({title})</CardTitle>
          <CardDescription>Across selected years in range</CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-bold text-emerald-700 tabular-nums">{formatInr(total)}</CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Monthly revenue</CardTitle>
            <CardDescription>Aggregated by month</CardDescription>
          </div>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
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
                  <Label>Amount</Label>
                  <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <DialogFooter>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
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
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
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
                    onChanged={() => {
                      qc.invalidateQueries({ queryKey: ['dept-revenue'] })
                      qc.invalidateQueries({ queryKey: ['pnl-overview'] })
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
  onChanged,
}: {
  row: RevRow
  apiPath: string
  canEdit: boolean
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

  return (
    <TableRow>
      <TableCell>{row.month}</TableCell>
      <TableCell>{row.year}</TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <Input className="h-8 w-32 text-right inline-block" value={amount} onChange={(e) => setAmount(e.target.value)} />
        ) : (
          formatInr(row.amount)
        )}
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[200px] truncate">{row.description || '—'}</TableCell>
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
