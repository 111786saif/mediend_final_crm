'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Progress } from '@/components/ui/progress'
import { TabNavigation } from '@/components/employee/tab-navigation'
import { format } from 'date-fns'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Megaphone,
  BarChart3,
  Target,
  ArrowUpDown,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Users,
  Zap,
  Globe,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DmDashboardData {
  summary: {
    totalLeads: number
    totalIpd: number
    overallConversionRate: number
    totalMarketingSpend: number
    effectiveCpl: number
    costPerConversion: number
    leadsVsPriorPeriod: number
    ipdVsPriorPeriod: number
  }
  campaignsWithCpl: Array<{
    campaign: string
    leads: number
    ipd: number
    conversionRate: number
    revenue: number
    cpl: number | null
    totalCost: number
    costPerConversion: number | null
    roi: number | null
  }>
  insights: Array<{
    type: 'positive' | 'negative' | 'suggestion'
    title: string
    description: string
  }>
  monthlyTrend: Array<{
    month: string
    leads: number
    ipd: number
    conversionRate: number
    marketingSpend: number
  }>
}

interface IpdBreakdown {
  byCircle: Array<{ circle: string; count: number; revenue: number; profit: number }>
  byHospital: Array<{ hospitalName: string; circle: string; count: number; revenue: number; profit: number }>
  bySource: Array<{ source: string; count: number; revenue: number; profit: number }>
  byCampaign: Array<{ campaign: string; count: number; revenue: number; profit: number }>
  byMonth: Array<{ month: string; count: number; revenue: number; profit: number }>
}

interface LeadsBreakdown {
  byCircle: Array<{ circle: string; totalLeads: number; converted: number; conversionRate: number }>
  bySource: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number }>
  byCampaign: Array<{ campaign: string; totalLeads: number; converted: number; conversionRate: number }>
}

interface IpdComparison {
  ipdThisMonth: number
  ipdByThisDayLastMonth: number
  ipdBestMonthByThisDay: number
  bestMonthThisYear: { month: number; monthLabel: string | null; count: number }
  asOfDate: string
  dayOfMonth: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'sources', label: 'Sources' },
  { value: 'circles', label: 'Circles' },
  { value: 'trends', label: 'Trends' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function fmtK(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}

function StatCard({ label, value, sub, color, change }: { label: string; value: string | number; sub?: string; color: string; change?: number }) {
  return (
    <Card className={`${color} border-0`}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium opacity-75">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-2xl font-bold">{value}</p>
          {change !== undefined && change !== 0 && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${change > 0 ? 'bg-emerald-500/20 text-emerald-700' : 'bg-red-500/20 text-red-700'}`}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change).toFixed(0)}%
            </span>
          )}
        </div>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

function DateRangePicker({
  startDate, endDate, setStartDate, setEndDate
}: {
  startDate: Date | undefined
  endDate: Date | undefined
  setStartDate: (d: Date | undefined) => void
  setEndDate: (d: Date | undefined) => void
}) {
  const [isStartOpen, setIsStartOpen] = useState(false)
  const [isEndOpen, setIsEndOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">From</span>
      <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-[120px] justify-start">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {startDate ? format(startDate, 'dd MMM yy') : 'Pick'}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-auto p-0">
          <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setIsStartOpen(false) }} />
        </DialogContent>
      </Dialog>
      <span className="text-sm text-muted-foreground">To</span>
      <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-[120px] justify-start">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {endDate ? format(endDate, 'dd MMM yy') : 'Pick'}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-auto p-0">
          <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndOpen(false) }} />
        </DialogContent>
      </Dialog>
      {(startDate || endDate) && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setStartDate(undefined); setEndDate(undefined) }}>Clear</Button>
      )}
    </div>
  )
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: DmDashboardData['insights'][0] }) {
  const config = {
    positive: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', icon: <CheckCircle className="h-4 w-4 text-emerald-600" /> },
    negative: { border: 'border-l-red-500', bg: 'bg-red-500/5', icon: <AlertTriangle className="h-4 w-4 text-red-600" /> },
    suggestion: { border: 'border-l-amber-500', bg: 'bg-amber-500/5', icon: <Lightbulb className="h-4 w-4 text-amber-600" /> },
  }
  const c = config[insight.type]
  return (
    <div className={`rounded-lg border-l-4 ${c.border} ${c.bg} p-3`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{c.icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-sm">{insight.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ dateParams }: { dateParams: string }) {
  const qp = dateParams ? '?' + dateParams : ''

  const { data: dm } = useQuery<DmDashboardData>({
    queryKey: ['dm-dashboard', dateParams],
    queryFn: () => apiGet<DmDashboardData>(`/api/analytics/digital-marketing/dashboard${qp}`),
  })

  const { data: comparison } = useQuery<IpdComparison>({
    queryKey: ['dm-ipd-comparison', dateParams],
    queryFn: () => apiGet<IpdComparison>(`/api/analytics/sales-dashboard/ipd-comparison${qp}`),
  })

  const s = dm?.summary

  // Top 5 campaigns & sources quick summary
  const topCampaigns = (dm?.campaignsWithCpl ?? []).slice(0, 5)
  const maxCampaignLeads = Math.max(1, ...topCampaigns.map((c) => c.leads))

  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Leads" value={s?.totalLeads ?? '–'} color="bg-blue-500/10 text-blue-900 dark:text-blue-100" change={s?.leadsVsPriorPeriod} />
        <StatCard label="IPD Done" value={s?.totalIpd ?? '–'} color="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" change={s?.ipdVsPriorPeriod} />
        <StatCard label="Conversion Rate" value={s ? `${s.overallConversionRate.toFixed(1)}%` : '–'} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
        <StatCard label="Marketing Spend" value={s ? fmtK(s.totalMarketingSpend) : '–'} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
        <StatCard label="Effective CPL" value={s ? fmtK(s.effectiveCpl) : '–'} color="bg-sky-500/10 text-sky-900 dark:text-sky-100" />
        <StatCard label="Cost / Conversion" value={s ? fmtK(s.costPerConversion) : '–'} color="bg-rose-500/10 text-rose-900 dark:text-rose-100" />
      </div>

      {/* IPD Pulse */}
      {comparison && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" /> IPD Pulse
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="IPD (selected range)" value={comparison.ipdThisMonth} color="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" />
            <StatCard label="Same dates last month" value={comparison.ipdByThisDayLastMonth} color="bg-blue-500/10 text-blue-900 dark:text-blue-100" />
            <StatCard label={`Best month (by day ${comparison.dayOfMonth})`} value={comparison.ipdBestMonthByThisDay} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
            <StatCard label="Best month this year" value={comparison.bestMonthThisYear?.count ?? '–'} sub={comparison.bestMonthThisYear?.monthLabel ?? undefined} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
          </div>
        </div>
      )}

      {/* Lead Funnel */}
      {s && s.totalLeads > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Lead Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Total Leads', value: s.totalLeads, color: 'bg-blue-500' },
                { label: 'In Pipeline', value: s.totalLeads - s.totalIpd, color: 'bg-amber-500' },
                { label: 'Converted (IPD)', value: s.totalIpd, color: 'bg-emerald-500' },
              ].map((item) => {
                const pct = (item.value / s.totalLeads) * 100
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">{item.label}</span>
                    <div className="flex-1 relative h-7 rounded-full bg-muted overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${item.color} rounded-full transition-all`} style={{ width: `${Math.max(pct, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{item.value}</span>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {(dm?.insights ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> Marketing Insights
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {dm!.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Top Campaigns & Sources quick view */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-violet-500" /> Top Campaigns</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-6" asChild>
                <Link href="/digital-marketing/cpl">Manage CPL <ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCampaigns.map((c, i) => (
              <div key={c.campaign} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.campaign}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(c.leads / maxCampaignLeads) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{c.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{c.leads}</p>
                  <p className="text-[10px] text-muted-foreground">{c.ipd} IPD</p>
                </div>
              </div>
            ))}
            {topCampaigns.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">No campaign data</p>}
          </CardContent>
        </Card>

        {/* Monthly trend mini chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-500" /> Monthly Leads & IPD</CardTitle>
          </CardHeader>
          <CardContent>
            {(dm?.monthlyTrend ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dm!.monthlyTrend.slice(-12)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5) + '/' + v.slice(2, 4)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, n: string) => [v, n === 'leads' ? 'Leads' : 'IPD']} labelFormatter={(l) => `Month: ${l}`} />
                  <Bar dataKey="leads" fill="#93c5fd" radius={[2, 2, 0, 0]} name="Leads" />
                  <Bar dataKey="ipd" fill="#10b981" radius={[2, 2, 0, 0]} name="IPD" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8 text-sm">No trend data</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab({ dateParams }: { dateParams: string }) {
  const [sortBy, setSortBy] = useState<'leads' | 'ipd' | 'conversionRate' | 'roi'>('leads')
  const qp = dateParams ? '?' + dateParams : ''

  const { data: dm } = useQuery<DmDashboardData>({
    queryKey: ['dm-dashboard', dateParams],
    queryFn: () => apiGet<DmDashboardData>(`/api/analytics/digital-marketing/dashboard${qp}`),
  })

  const campaigns = [...(dm?.campaignsWithCpl ?? [])].sort((a, b) => {
    if (sortBy === 'leads') return b.leads - a.leads
    if (sortBy === 'ipd') return b.ipd - a.ipd
    if (sortBy === 'conversionRate') return b.conversionRate - a.conversionRate
    return (b.roi ?? -Infinity) - (a.roi ?? -Infinity)
  })

  const chartData = campaigns.slice(0, 15).map((c) => ({
    name: c.campaign.length > 20 ? c.campaign.slice(0, 18) + '…' : c.campaign,
    leads: c.leads,
    ipd: c.ipd,
  }))

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 60, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={0} height={80} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#93c5fd" radius={[2, 2, 0, 0]} name="Leads" />
                <Bar dataKey="ipd" fill="#10b981" radius={[2, 2, 0, 0]} name="IPD" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3.5 w-3.5" />Sort by:</span>
        {(['leads', 'ipd', 'conversionRate', 'roi'] as const).map((s) => (
          <Button key={s} size="sm" variant={sortBy === s ? 'default' : 'outline'} onClick={() => setSortBy(s)} className="h-7 text-xs">
            {s === 'leads' ? 'Leads' : s === 'ipd' ? 'IPD' : s === 'conversionRate' ? 'Conversion' : 'ROI'}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" asChild>
          <Link href="/digital-marketing/cpl"><DollarSign className="h-3 w-3 mr-1" />Manage CPL</Link>
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Campaign</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">IPD</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Cost/Conv</TableHead>
                  <TableHead className="text-right">ROI %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.campaign}>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.campaign}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.leads}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{c.ipd}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={c.conversionRate >= 10 ? 'text-emerald-600 font-semibold' : c.conversionRate < 3 ? 'text-red-500' : ''}>
                        {c.conversionRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(c.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.cpl !== null ? fmt(c.cpl) : <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.totalCost > 0 ? fmtK(c.totalCost) : <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.costPerConversion !== null ? fmt(c.costPerConversion) : <span className="text-muted-foreground">–</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.roi !== null ? (
                        <span className={c.roi > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
                          {c.roi.toFixed(0)}%
                        </span>
                      ) : <span className="text-muted-foreground">–</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No campaign data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sources Tab ──────────────────────────────────────────────────────────────

function SourcesTab({ dateParams }: { dateParams: string }) {
  const qp = dateParams ? '?' + dateParams : ''

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['dm-ipd-breakdown', dateParams],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['dm-leads-breakdown', dateParams],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const sourceData = (ipdBreakdown?.bySource ?? []).map((s) => {
    const leadsRow = (leadsBreakdown?.bySource ?? []).find((l) => l.source === s.source)
    return { name: s.source, ipd: s.count, leads: leadsRow?.totalLeads ?? 0, revenue: s.revenue, conv: leadsRow ? (s.count / leadsRow.totalLeads) * 100 : 0 }
  }).sort((a, b) => b.ipd - a.ipd)

  // Add sources that have leads but no IPD
  const ipdSourceNames = new Set(sourceData.map((s) => s.name))
  const leadsOnlySources = (leadsBreakdown?.bySource ?? [])
    .filter((l) => !ipdSourceNames.has(l.source))
    .map((l) => ({ name: l.source, ipd: 0, leads: l.totalLeads, revenue: 0, conv: 0 }))
  const allSources = [...sourceData, ...leadsOnlySources].sort((a, b) => b.leads - a.leads)

  const pieData = allSources.filter((r) => r.leads > 0).slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Lead Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <PieChart width={160} height={160} className="mx-auto">
                  <Pie data={pieData} dataKey="leads" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} />
                </PieChart>
                <div className="mt-3 space-y-1.5">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-semibold tabular-nums">{d.leads}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-muted-foreground py-8 text-sm">No data</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Source Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">IPD</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSources.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium max-w-[160px] truncate">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{r.ipd}</TableCell>
                      <TableCell className="text-right tabular-nums text-violet-600">{r.conv.toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {allSources.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Circles Tab ──────────────────────────────────────────────────────────────

function CirclesTab({ dateParams }: { dateParams: string }) {
  const qp = dateParams ? '?' + dateParams : ''

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['dm-ipd-breakdown', dateParams],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['dm-leads-breakdown', dateParams],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const circleData = (ipdBreakdown?.byCircle ?? []).map((c) => {
    const leadsRow = (leadsBreakdown?.byCircle ?? []).find((l) => l.circle === c.circle)
    return { circle: c.circle, ipd: c.count, leads: leadsRow?.totalLeads ?? 0, revenue: c.revenue, profit: c.profit, conv: leadsRow && leadsRow.totalLeads > 0 ? (c.count / leadsRow.totalLeads) * 100 : 0 }
  }).sort((a, b) => b.ipd - a.ipd)

  const pieData = circleData.filter((c) => c.leads > 0)

  return (
    <div className="space-y-6">
      {/* Circle summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {circleData.map((c, i) => (
          <Card key={c.circle} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <CardContent className="pt-3 pb-3">
              <p className="font-semibold text-sm">{c.circle}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xl font-bold text-emerald-600">{c.ipd} <span className="text-xs font-normal text-muted-foreground">IPD</span></p>
                <p className="text-xs text-muted-foreground">{c.leads} leads · {c.conv.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{fmtK(c.revenue)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie + Hospital table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Leads by Circle</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <PieChart width={160} height={160} className="mx-auto">
                  <Pie data={pieData} dataKey="leads" nameKey="circle" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
                <div className="mt-3 space-y-1.5">
                  {pieData.map((d, i) => (
                    <div key={d.circle} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.circle}</span>
                      <span className="ml-auto font-semibold tabular-nums">{d.leads}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-muted-foreground py-8 text-sm">No data</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Hospitals</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Circle</TableHead>
                    <TableHead className="text-right">IPD</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ipdBreakdown?.byHospital ?? []).slice(0, 20).map((h) => (
                    <TableRow key={`${h.hospitalName}-${h.circle}`}>
                      <TableCell className="font-medium max-w-[160px] truncate">{h.hospitalName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{h.circle}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{h.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(h.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {!ipdBreakdown?.byHospital?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Trends Tab ───────────────────────────────────────────────────────────────

function TrendsTab({ dateParams }: { dateParams: string }) {
  const qp = dateParams ? '?' + dateParams : ''

  const { data: dm } = useQuery<DmDashboardData>({
    queryKey: ['dm-dashboard', dateParams],
    queryFn: () => apiGet<DmDashboardData>(`/api/analytics/digital-marketing/dashboard${qp}`),
  })

  const trend = (dm?.monthlyTrend ?? []).slice(-12)

  return (
    <div className="space-y-6">
      {/* Leads & IPD Line chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Leads & Conversion Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 5, right: 30, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5) + '/' + v.slice(2, 4)} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number, n: string) => [n === 'conversionRate' ? `${v.toFixed(1)}%` : v, n === 'leads' ? 'Leads' : n === 'ipd' ? 'IPD' : 'Conversion %']} labelFormatter={(l) => `Month: ${l}`} />
                <Legend formatter={(v) => v === 'leads' ? 'Leads' : v === 'ipd' ? 'IPD' : 'Conversion %'} />
                <Line yAxisId="left" type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="left" type="monotone" dataKey="ipd" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-8 text-sm">No trend data</p>}
        </CardContent>
      </Card>

      {/* Marketing Spend Area chart */}
      {trend.some((t) => t.marketingSpend > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Marketing Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5) + '/' + v.slice(2, 4)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                <Tooltip formatter={(v: number) => [fmtK(v), 'Spend']} labelFormatter={(l) => `Month: ${l}`} />
                <Area type="monotone" dataKey="marketingSpend" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly summary table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">IPD</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Cost/Conv</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trend.map((t) => {
                  const cpl = t.leads > 0 && t.marketingSpend > 0 ? t.marketingSpend / t.leads : null
                  const cpc = t.ipd > 0 && t.marketingSpend > 0 ? t.marketingSpend / t.ipd : null
                  return (
                    <TableRow key={t.month}>
                      <TableCell className="font-medium">{t.month}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.leads}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{t.ipd}</TableCell>
                      <TableCell className="text-right tabular-nums text-violet-600">{t.conversionRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{t.marketingSpend > 0 ? fmtK(t.marketingSpend) : <span className="text-muted-foreground">–</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{cpl !== null ? fmt(cpl) : <span className="text-muted-foreground">–</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{cpc !== null ? fmt(cpc) : <span className="text-muted-foreground">–</span>}</TableCell>
                    </TableRow>
                  )
                })}
                {trend.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DigitalMarketingDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date())

  const dateParams = [
    startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '',
    endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '',
  ].filter(Boolean).join('&')

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-violet-600" />
              Digital Marketing
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lead performance, campaign ROI, and marketing insights
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/digital-marketing/cpl">Manage CPL</Link>
            </Button>
            <DateRangePicker startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
          </div>
        </div>

        {/* Tabs */}
        <TabNavigation tabs={TABS} value={activeTab} onValueChange={setActiveTab} variant="digital-marketing" />

        {/* Tab content */}
        <div className="mt-2">
          {activeTab === 'overview' && <OverviewTab dateParams={dateParams} />}
          {activeTab === 'campaigns' && <CampaignsTab dateParams={dateParams} />}
          {activeTab === 'sources' && <SourcesTab dateParams={dateParams} />}
          {activeTab === 'circles' && <CirclesTab dateParams={dateParams} />}
          {activeTab === 'trends' && <TrendsTab dateParams={dateParams} />}
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
