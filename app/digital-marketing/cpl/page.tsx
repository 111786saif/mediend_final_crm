'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/protected-route'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { toast } from 'sonner'
import { Megaphone, Save } from 'lucide-react'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

type CampaignRow = {
  campaignName: string
  month: number
  year: number
  leadCount: number
  cpl: number | null
  totalCost: number
  cplId: string | null
}

type MonthResponse = {
  year: number
  month: number
  campaigns: CampaignRow[]
  summary: { totalLeads: number; totalCost: number; avgCpl: number }
}

type SummaryResponse = {
  year: number
  monthlyBreakdown: { month: number; totalLeads: number; totalMarketingCost: number }[]
}

export default function CampaignCplPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const yearNow = new Date().getFullYear()
  const monthNow = new Date().getMonth() + 1
  const [year, setYear] = useState(yearNow)
  const [month, setMonth] = useState(monthNow)
  const [draftCpl, setDraftCpl] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ['permissions-check', 'cpl_access'],
    queryFn: () => apiGet<{ allowed: boolean }>('/api/permissions/check?feature=cpl_access'),
    enabled: !!user,
  })
  const allowed = accessData?.allowed === true

  const { data: monthData, isLoading: monthLoading } = useQuery<MonthResponse>({
    queryKey: ['digital-marketing-cpl', year, month],
    queryFn: () => apiGet<MonthResponse>(`/api/digital-marketing/cpl?year=${year}&month=${month}`),
    enabled: !!user && allowed,
  })

  const { data: summaryData, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: ['digital-marketing-cpl-summary', year],
    queryFn: () => apiGet<SummaryResponse>(`/api/digital-marketing/cpl?year=${year}&summary=1`),
    enabled: !!user && allowed,
  })

  useEffect(() => {
    setDraftCpl({})
  }, [month, year])

  const chartRows = useMemo(() => {
    const rows = summaryData?.monthlyBreakdown ?? []
    return rows.map((r) => ({
      label: MONTHS[r.month - 1],
      marketingCost: r.totalMarketingCost,
      leads: r.totalLeads,
    }))
  }, [summaryData])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['digital-marketing-cpl', year, month] })
    void qc.invalidateQueries({ queryKey: ['digital-marketing-cpl-summary', year] })
  }

  const handleSave = async () => {
    if (!monthData?.campaigns.length) {
      toast.message('Nothing to save', { description: 'No campaigns with leads for this month.' })
      return
    }
    setSaving(true)
    try {
      const tasks: Promise<unknown>[] = []
      for (const c of monthData.campaigns) {
        const raw = draftCpl[c.campaignName] ?? (c.cpl != null ? String(c.cpl) : '')
        const trimmed = raw.trim()
        const num = trimmed === '' ? 0 : parseFloat(trimmed)
        if (Number.isNaN(num) || num < 0) {
          toast.error(`Invalid CPL for “${c.campaignName}”`)
          setSaving(false)
          return
        }
        const prev = c.cpl
        if (prev === num) continue
        if (prev == null && num === 0) continue
        tasks.push(
          apiPost('/api/digital-marketing/cpl', {
            campaignName: c.campaignName,
            month,
            year,
            cpl: num,
          })
        )
      }
      if (tasks.length === 0) {
        toast.message('Nothing to save', { description: 'No CPL changes.' })
        setSaving(false)
        return
      }
      await Promise.all(tasks)
      toast.success('Saved')
      setDraftCpl({})
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="h-7 w-7 text-violet-500" />
              Campaign CPL
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Set cost per lead by campaign. Lead counts use <code className="text-xs">leadDate</code> in the
              selected month. Totals = CPL × leads where CPL is set.
            </p>
          </div>
        </div>

        {accessLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">Checking access…</CardContent>
          </Card>
        ) : !allowed ? (
          <Card>
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                CPL access is controlled from <strong>IT Permissions</strong>. Ask IT to enable{' '}
                <strong>CPL Access</strong> for your user (MD and Admin have access by default).
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl border-violet-200/80 bg-violet-50/50 dark:bg-violet-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>
                    Leads ({MONTHS[month - 1]} {year})
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {monthLoading ? '—' : monthData?.summary.totalLeads ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>Marketing cost (month)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums text-emerald-800 dark:text-emerald-300">
                    {monthLoading ? '—' : formatInr(monthData?.summary.totalCost ?? 0)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-2xl border-sky-200/80 bg-sky-50/50 dark:bg-sky-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>Effective CPL (month)</CardDescription>
                  <CardTitle className="text-2xl tabular-nums text-sky-800 dark:text-sky-300">
                    {monthLoading
                      ? '—'
                      : monthData && monthData.summary.totalLeads > 0
                        ? formatInr(monthData.summary.avgCpl)
                        : '—'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Campaigns</CardTitle>
                  <CardDescription>
                    Distinct <code className="text-xs">campaignName</code> from leads in this month. Enter CPL and
                    save.
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
                  <Button
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => void handleSave()}
                    disabled={saving || monthLoading}
                  >
                    <Save className="h-4 w-4" />
                    Save CPL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {monthLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !monthData?.campaigns.length ? (
                  <p className="text-sm text-muted-foreground">
                    No leads with a campaign name for this month (using lead date).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead className="text-right w-[100px]">Leads</TableHead>
                          <TableHead className="text-right w-[140px]">CPL (INR)</TableHead>
                          <TableHead className="text-right w-[140px]">Total cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthData.campaigns.map((c) => {
                          const draft =
                            draftCpl[c.campaignName] ?? (c.cpl != null ? String(c.cpl) : '')
                          const parsed = parseFloat(draft.trim())
                          const cplNum = draft.trim() === '' || Number.isNaN(parsed) ? null : parsed
                          const displayCost =
                            cplNum != null && cplNum >= 0 ? cplNum * c.leadCount : c.totalCost
                          return (
                            <TableRow key={c.campaignName}>
                              <TableCell className="font-medium max-w-[280px] break-words">
                                {c.campaignName}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{c.leadCount}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  className="h-9 rounded-lg tabular-nums text-right ml-auto max-w-[120px]"
                                  inputMode="decimal"
                                  placeholder="—"
                                  value={draft}
                                  onChange={(e) =>
                                    setDraftCpl((d) => ({ ...d, [c.campaignName]: e.target.value }))
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-emerald-700">
                                {formatInr(displayCost)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Year overview ({year})</CardTitle>
                <CardDescription>Marketing cost by month (CPL × leads, only where CPL is set)</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {summaryLoading ? (
                  <p className="text-sm text-muted-foreground">Loading chart…</p>
                ) : (
                  <ChartContainer config={{}} className="h-full w-full">
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="marketingCost"
                        fill="hsl(263 70% 52%)"
                        radius={[4, 4, 0, 0]}
                        name="Marketing cost"
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
