'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Megaphone, CalendarDays } from 'lucide-react'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function monthRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const startDate = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1))
  const endDate = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  return { startDate, endDate }
}

function last7Days(dateStr: string) {
  const days: string[] = []
  for (let i = 1; i <= 7; i++) {
    days.push(addDays(dateStr, -i))
  }
  return days
}

type CampaignEntry = {
  campaignName: string
  spend: number
  leadCount: number
  cpl: number | null
  id: string | null
}

type DayResponse = {
  date: string
  campaigns: CampaignEntry[]
  totalLeads: number
  totalSpend: number
  effectiveCpl: number | null
}

type RangeResponse = {
  days: { date: string; spend: number; leadCount: number; cpl: number | null }[]
  totalSpend: number
  totalLeads: number
  effectiveCpl: number | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function DailySpendPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [draftSpend, setDraftSpend] = useState<Record<string, string>>({})

  const { data: accessData, isLoading: accessLoading } = useQuery({
    queryKey: ['permissions-check', 'cpl_access'],
    queryFn: () => apiGet<{ allowed: boolean }>('/api/permissions/check?feature=cpl_access'),
    enabled: !!user,
  })
  const allowed = accessData?.allowed === true

  // Day data
  const { data: dayData, isLoading: dayLoading } = useQuery<DayResponse>({
    queryKey: ['daily-spend', selectedDate],
    queryFn: () => apiGet<DayResponse>(`/api/digital-marketing/daily-spend?date=${selectedDate}`),
    enabled: !!user && allowed,
  })

  // Month range for summary cards
  const { startDate: mStart, endDate: mEnd } = monthRange(selectedDate)
  const { data: monthData } = useQuery<RangeResponse>({
    queryKey: ['daily-spend-month', mStart, mEnd],
    queryFn: () => apiGet<RangeResponse>(`/api/digital-marketing/daily-spend?startDate=${mStart}&endDate=${mEnd}`),
    enabled: !!user && allowed,
  })

  // Year range for chart
  const selectedYear = new Date(selectedDate + 'T00:00:00').getFullYear()
  const { data: yearData, isLoading: yearLoading } = useQuery<RangeResponse>({
    queryKey: ['daily-spend-year', selectedYear],
    queryFn: () => apiGet<RangeResponse>(`/api/digital-marketing/daily-spend?startDate=${selectedYear}-01-01&endDate=${selectedYear}-12-31`),
    enabled: !!user && allowed,
  })

  const chartRows = useMemo(() => {
    if (!yearData) return []
    const byMonth = new Map<number, { spend: number; leads: number }>()
    for (const d of yearData.days) {
      const m = new Date(d.date + 'T00:00:00').getMonth() + 1
      const entry = byMonth.get(m) || { spend: 0, leads: 0 }
      entry.spend += d.spend
      entry.leads += d.leadCount
      byMonth.set(m, entry)
    }
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const entry = byMonth.get(m) || { spend: 0, leads: 0 }
      return { label: MONTHS[i], marketingCost: entry.spend, leads: entry.leads }
    })
  }, [yearData])

  const recentDays = useMemo(() => last7Days(selectedDate), [selectedDate])

  const saveMutation = useMutation({
    mutationFn: (payload: { campaignName: string; date: string; spend: number }) =>
      apiPost('/api/digital-marketing/daily-spend', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-spend', selectedDate] })
      qc.invalidateQueries({ queryKey: ['daily-spend-month'] })
      qc.invalidateQueries({ queryKey: ['daily-spend-year'] })
    },
  })

  const handleSpendSave = (campaignName: string, raw: string) => {
    const trimmed = raw.trim()
    const num = trimmed === '' ? 0 : parseFloat(trimmed)
    if (isNaN(num) || num < 0) {
      toast.error(`Invalid spend for "${campaignName}"`)
      return
    }
    // Find current value
    const current = dayData?.campaigns.find((c) => c.campaignName === campaignName)?.spend ?? 0
    if (num === current) return

    saveMutation.mutate(
      { campaignName, date: selectedDate, spend: num },
      {
        onSuccess: () => toast.success(`Saved spend for ${campaignName}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, campaignName: string) => {
    if (e.key === 'Enter') {
      const raw = draftSpend[campaignName] ?? ''
      handleSpendSave(campaignName, raw)
    }
  }

  const handleBlur = (campaignName: string) => {
    const raw = draftSpend[campaignName]
    if (raw !== undefined) {
      handleSpendSave(campaignName, raw)
    }
  }

  const selectedMonth = new Date(selectedDate + 'T00:00:00').getMonth()
  const monthLabel = MONTHS[selectedMonth]
  const isToday = selectedDate === today

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-violet-500" />
            Daily Marketing Spend
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter daily spend per campaign. CPL = spend / leads (auto-calculated).
          </p>
        </div>

        {accessLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">Checking access...</CardContent>
          </Card>
        ) : !allowed ? (
          <Card>
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                CPL access is controlled from <strong>IT Permissions</strong>. Ask IT to enable{' '}
                <strong>CPL Access</strong> for your user.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Date navigation */}
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Button variant="outline" className="min-w-[220px] gap-2 text-base font-semibold" asChild>
                  <label>
                    <CalendarDays className="h-4 w-4" />
                    {formatDateDisplay(selectedDate)}
                    <input
                      type="date"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      value={selectedDate}
                      onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    />
                  </label>
                </Button>
              </div>
              <Button variant="outline" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))} disabled={isToday}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)}>
                  Today
                </Button>
              )}
            </div>

            {/* Month summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl border-violet-200/80 bg-violet-50/50 dark:bg-violet-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>{monthLabel} {selectedYear} - Total Spend</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {monthData ? formatInr(monthData.totalSpend) : '\u2014'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50/50 dark:bg-emerald-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>{monthLabel} {selectedYear} - Total Leads</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {monthData?.totalLeads ?? '\u2014'}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-2xl border-sky-200/80 bg-sky-50/50 dark:bg-sky-950/25">
                <CardHeader className="pb-2">
                  <CardDescription>{monthLabel} {selectedYear} - Effective CPL</CardDescription>
                  <CardTitle className="text-2xl tabular-nums text-sky-800 dark:text-sky-300">
                    {monthData?.effectiveCpl != null ? formatInr(monthData.effectiveCpl) : '\u2014'}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Campaign spend table for the selected day */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Campaigns - {formatDateDisplay(selectedDate)}</CardTitle>
                <CardDescription>
                  Enter spend per campaign. CPL is auto-calculated. Press Enter or click away to save.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dayLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : !dayData?.campaigns.length ? (
                  <p className="text-sm text-muted-foreground">
                    No leads found for this date.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead className="text-right w-[100px]">Leads</TableHead>
                          <TableHead className="text-right w-[160px]">Spend (INR)</TableHead>
                          <TableHead className="text-right w-[120px]">CPL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayData.campaigns.map((c) => {
                          const draft = draftSpend[c.campaignName] ?? (c.spend > 0 ? String(c.spend) : '')
                          const parsed = parseFloat(draft.trim())
                          const displayCpl = !isNaN(parsed) && parsed >= 0 && c.leadCount > 0
                            ? Math.round((parsed / c.leadCount) * 100) / 100
                            : c.cpl
                          return (
                            <TableRow key={c.campaignName}>
                              <TableCell className="font-medium max-w-[280px] break-words">
                                {c.campaignName}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{c.leadCount}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  className="h-9 rounded-lg tabular-nums text-right ml-auto max-w-[140px]"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={draft}
                                  onChange={(e) =>
                                    setDraftSpend((d) => ({ ...d, [c.campaignName]: e.target.value }))
                                  }
                                  onKeyDown={(e) => handleKeyDown(e, c.campaignName)}
                                  onBlur={() => handleBlur(c.campaignName)}
                                />
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sky-700 dark:text-sky-300 font-medium">
                                {displayCpl != null ? formatInr(displayCpl) : '\u2014'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {/* Summary row */}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right tabular-nums">{dayData.totalLeads}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatInr(dayData.totalSpend)}</TableCell>
                          <TableCell className="text-right tabular-nums text-sky-700 dark:text-sky-300">
                            {dayData.effectiveCpl != null ? formatInr(dayData.effectiveCpl) : '\u2014'}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent 7 days */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Recent days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDays.map((dateStr) => {
                        const dayEntry = monthData?.days?.find((d) => d.date === dateStr)
                        return (
                          <TableRow
                            key={dateStr}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => { setSelectedDate(dateStr); setDraftSpend({}) }}
                          >
                            <TableCell className="font-medium">{formatDateDisplay(dateStr)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {dayEntry?.spend ? formatInr(dayEntry.spend) : '\u2014'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {dayEntry?.leadCount ?? 0}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sky-700 dark:text-sky-300">
                              {dayEntry?.cpl != null ? formatInr(dayEntry.cpl) : '\u2014'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Year overview chart */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Year overview ({selectedYear})</CardTitle>
                <CardDescription>Marketing spend by month</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {yearLoading ? (
                  <p className="text-sm text-muted-foreground">Loading chart...</p>
                ) : (
                  <ChartContainer config={{}} className="h-full w-full">
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="marketingCost" fill="hsl(263 70% 52%)" radius={[4, 4, 0, 0]} name="Marketing spend" />
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
