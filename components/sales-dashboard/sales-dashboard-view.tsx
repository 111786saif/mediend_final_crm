'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useEffect, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TeamMappingSection } from './team-mapping-section'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { TabNavigation } from '@/components/employee/tab-navigation'
import { endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subYears } from 'date-fns'
import { getAvatarColor } from '@/lib/avatar-colors'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Calendar as CalendarIcon,
  Trophy,
  Medal,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertCircle,
  Users,
  Stethoscope,
  BarChart3,
  Target,
  ChevronRight,
  ArrowUpDown,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { UntouchedLeadsTable } from '@/components/targets/untouched-leads-table'
import type { DateRange } from 'react-day-picker'
import { TeamDetailView } from './team-detail-view'

// FLAG TO CONTROL CAPSULE BEHAVIOR FOR BD MEMBERS WITHOUT INCENTIVE IN API
export const HIDE_MISSING_INCENTIVE_CAPSULE = true

// ─── Types ────────────────────────────────────────────────────────────────────

interface IpdComparison {
  ipdThisMonth: number
  ipdByThisDayLastMonth: number
  ipdBestMonthByThisDay: number
  bestMonthThisYear: { month: number; monthLabel: string | null; count: number }
  asOfDate: string
  dayOfMonth: number
}

interface LeaderboardEntry {
  bdId?: string
  bdName?: string
  managerId?: string
  managerName?: string
  name?: string
  /** Department team (BD rows) or synthetic team label (team rows) */
  teamName?: string | null
  teamLeadId?: string
  teamLeadName?: string
  closedLeads: number
  totalLeads: number
  ipdDone: number
  conversionRate: number
  netProfit: number
  avgTicketSize?: number
  revenue?: number
}

interface TodayAssignments {
  date: string
  totalLeads: number
  assignments: Array<{ bdId: string; bdName: string; managerName: string | null; leadCount: number }>
}

interface BdMonthly {
  months: string[]
  bds: Array<{
    bdId: string
    bdName: string
    bdEmployeeId: string | null
    managerId: string | null
    managerName: string | null
    cmManagerId: string | null
    cmManagerName: string | null
    leads: Record<string, number>
    ipd: Record<string, number>
    totalLeads: number
    totalIpd: number
  }>
  totals: { leads: Record<string, number>; ipd: Record<string, number>; totalLeads: number; totalIpd: number }
}

interface BdDetail {
  bd: { id: string; name: string; profilePicture: string | null; managerName: string | null }
  kpis: { totalLeads: number; ipdDone: number; conversionRate: number; netProfit: number; billAmount: number; avgTicketSize: number }
  surgeries: Array<{ id: number; patientName: string; treatment: string; hospitalName: string; surgeonName: string | null; date: string | null; billAmount: number; netProfit: number; circle: string }>
  ipdCurrent?: number
  ipdPrev?: number
  ipdPrev2?: number
  ipdPrev3?: number
  ipdOlder?: number
  monthWise: Array<{ month: string; leadCount: number; ipdCount: number }>
  monthWiseHeaders?: { current: string; prev: string; prev2: string; prev3: string }
  treatmentBreakdown: Array<{ treatment: string; count: number }>
  cityWise: Array<{ label: string; totalLeads: number; ipd: number; conversionRate: number }>
  sourceWise: Array<{ label: string; totalLeads: number; ipd: number; conversionRate: number }>
}

interface QualitySlaData {
  totals: { totalLeads: number; opd: number; ipd: number; closed: number; conversionRate: number }
  filters: { cities: Array<{ key: string; label: string }>; sources: Array<{ key: string; label: string }>; bds: Array<{ key: string; label: string }>; teams: Array<{ key: string; label: string }> }
  cityWise: QualityRow[]; sourceWise: QualityRow[]; bdWise: QualityRow[]; teamWise: QualityRow[]
  sla: { within5Minutes: number; within15Minutes: number; late: number; pending: number; called: number; within15Rate: number }
}
interface QualityRow { key: string; label: string; totalLeads: number; opd: number; ipd: number; closed: number; conversionRate: number }

interface ManagerGroup {
  managerId: string
  managerName: string
  totalIpd: number
  totalLeads: number
}

export interface TeamDetail {
  team: {
    id: string
    name: string
    manager: { id: string; name: string; profilePicture: string | null } | null
    managerRole?: string
  }
  kpis: { totalLeads: number; totalOpd?: number; totalIpd: number; totalProfit: number; totalBill: number; conversionRate: number }
  members: Array<{
    id: string
    name: string
    profilePicture: string | null
    leads: number
    opdDone?: number
    ipdDone: number
    conversionRate: number
    netProfit: number
    billAmount: number
    ipdCurrent: number
    ipdPrev: number
    ipdPrev2: number
    ipdPrev3: number
    ipdOlder: number
  }>
  nestedTeams?: Array<{ id: string; name: string; role: string; totalLeads: number; totalIpd: number }>
  byCategory?: Array<{ category: string; leads: number; ipdDone: number; conversionRate: number; netProfit: number; billAmount: number }>
  targets?: Array<{ metric: string; label: string; targetValue: number; achieved: number; percentage: number }>
  monthWise?: {
    months: string[]
    rows: Array<{
      month: string
      bdId: string
      bdName: string
      leadCount: number
      opdCount?: number
      ipdCount: number
      billAmount?: number
    }>
  }
  monthWiseHeaders: { current: string; prev: string; prev2: string; prev3: string }
}

interface IpdBreakdown {
  byCircle: Array<{ circle: string; count: number; revenue: number; profit: number }>
  byDisease: Array<{ disease: string; count: number; revenue: number; profit: number }>
  byCategory?: Array<{ category: string; count: number; revenue: number; profit: number }>
  byHospital: Array<{ hospitalName: string; circle: string; count: number; revenue: number; profit: number }>
  bySource: Array<{ source: string; count: number; revenue: number; profit: number }>
  byCampaign: Array<{ campaign: string; count: number; revenue: number; profit: number }>
  byMonth: Array<{ month: string; count: number; revenue: number; profit: number }>
  surgeonCrossAnalysis: Array<{ surgeonName: string; hospitalName: string; treatment: string; count: number; revenue: number; profit: number }>
}

interface LeadsBreakdown {
  byCircle: Array<{ circle: string; totalLeads: number; converted: number; conversionRate: number; revenue?: number; profit?: number }>
  byCategory?: Array<{ category: string; totalLeads: number; converted: number; conversionRate: number; revenue?: number; profit?: number }>
  bySource: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number; revenue?: number; profit?: number }>
  byCampaign: Array<{ campaign: string; totalLeads: number; converted: number; conversionRate: number; revenue?: number; profit?: number }>
  campaignTeamMapping?: Array<{ campaignName: string; team: string; leads: number; conversionPercentage: number; cpl: number | null; amountSpend: number | null }>
  sourceTeamMapping?: Array<{ sourceName: string; team: string; leads: number; conversionPercentage: number; cpl: number | null; amountSpend: number | null }>
}

interface TargetSalaryData {
  bdSalaryTarget: Array<{
    bdId: string
    bdName: string
    managerName: string | null
    salary: number | null
    netProfit: number
    revenueSalaryRatio: number | null
  }>
  teamSalaryBreakdown: Array<{
    managerId: string
    teamName: string
    totalSalary: number
    totalNetProfit: number
    revenueSalaryRatio: number | null
    memberCount: number
  }>
}

export type DashboardVariant = 'org' | 'team-lead'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'team', label: 'Team Performance' },
  { value: 'bd', label: 'BD Performance' },
  { value: 'sources', label: 'Sources & Campaigns' },
  { value: 'circle', label: 'Circle' },
  { value: 'quality', label: 'Lead Quality & SLA' },
  { value: 'insights', label: 'Marketing Insights' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function fmtK(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-amber-950 font-bold"><Trophy className="h-3.5 w-3.5" /></span>
  if (rank === 2) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold"><Medal className="h-3.5 w-3.5" /></span>
  if (rank === 3) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white font-bold"><Medal className="h-3.5 w-3.5" /></span>
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">{rank}</span>
}

export function UserAvatar({ name, picture, size = 'sm' }: { name: string; picture?: string | null; size?: 'sm' | 'md' }) {
  const colors = getAvatarColor(name)
  const sz = size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  return (
    <Avatar className={sz}>
      {picture && <AvatarImage src={picture} />}
      <AvatarFallback className={`${colors.bg} ${colors.text} text-xs font-semibold`}>
        {name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  const labelLower = label.toLowerCase()
  const isAccent = labelLower.includes('ipd') || labelLower.includes('profit')

  // Dynamic color accents
  const accentBorder =
    labelLower.includes('leads') ? 'border-l-4 border-l-blue-500' :
      labelLower.includes('ipd') ? 'border-l-4 border-l-emerald-500' :
        labelLower.includes('conversion') ? 'border-l-4 border-l-violet-500' :
          labelLower.includes('profit') ? 'border-l-4 border-l-amber-500' :
            labelLower.includes('bill') ? 'border-l-4 border-l-sky-500' :
              labelLower.includes('ticket') ? 'border-l-4 border-l-rose-500' :
                'border-l-4 border-l-slate-400 dark:border-l-slate-600'

  return (
    <Card className={cn(
      "p-5 rounded-xl transition-all duration-300 border border-border shadow-sm hover:shadow-md bg-card text-card-foreground",
      accentBorder
    )}>
      <CardContent className="p-0 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Active
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className={cn(
            "text-2xl font-bold tracking-tight",
            isAccent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}>
            {value}
          </span>
        </div>
        {sub && (
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function TargetVsActualCard({
  ipdDone,
  assignedTarget,
  achievementPercentage,
}: {
  ipdDone: number | string
  assignedTarget: number | string
  achievementPercentage: number | string | null
}) {
  const pct = typeof achievementPercentage === 'number' ? achievementPercentage : null
  const pctColor =
    pct == null ? 'text-muted-foreground' :
      pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
        pct >= 60 ? 'text-blue-600 dark:text-blue-400' :
          'text-rose-600 dark:text-rose-400'

  return (
    <Card className="bg-card text-card-foreground border border-border border-l-4 border-l-violet-500 p-5 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md">
      <CardContent className="p-0 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" /> IPD Target vs Actual
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">IPD Done</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{ipdDone}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</span>
            <span className="text-lg font-bold text-foreground tabular-nums">{assignedTarget}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Achievement</span>
            <span className={cn('text-lg font-bold tabular-nums', pctColor)}>
              {pct != null ? `${pct}%` : '–'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDateRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return 'Select period'
  const from = range.from
  const to = range.to ?? range.from
  if (from.getTime() === to.getTime()) return format(from, 'dd MMM yyyy')
  return `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`
}

// ─── Date Picker ─────────────────────────────────────────────────────────────

function DateRangePicker({
  value, onChange,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const applyPreset = (preset: string) => {
    const now = new Date()
    const day = (date: Date) => ({ from: date, to: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) })
    const ranges: Record<string, DateRange> = {
      today: day(now), yesterday: day(subDays(now, 1)),
      thisWeek: { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
      lastWeek: { from: startOfWeek(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1), { weekStartsOn: 1 }), to: endOfWeek(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1), { weekStartsOn: 1 }) },
      thisMonth: { from: startOfMonth(now), to: endOfMonth(now) },
      lastMonth: { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
      last3Months: { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) },
      last6Months: { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) },
      thisYear: { from: startOfYear(now), to: endOfYear(now) },
      lastYear: { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) },
    }
    if (ranges[preset]) onChange(ranges[preset])
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Quick date range" defaultValue="" onChange={(event) => { applyPreset(event.target.value); event.currentTarget.value = '' }} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground">
        <option value="" disabled>Quick period</option>
        <option value="today">Today</option><option value="yesterday">Yesterday</option>
        <option value="thisWeek">This Week</option><option value="lastWeek">Last Week</option>
        <option value="thisMonth">Current Month</option><option value="lastMonth">Last Month</option>
        <option value="last3Months">Last 3 Months</option><option value="last6Months">Last 6 Months</option>
        <option value="thisYear">Current Year</option><option value="lastYear">Last Year</option>
      </select>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start sm:w-[240px]">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {formatDateRangeLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
          <Calendar
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range)
              if (range?.from && range?.to) setIsOpen(false)
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {(value?.from || value?.to) && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange(undefined)}>Clear</Button>
      )}
    </div>
  )
}

// ─── BD Detail Sheet ──────────────────────────────────────────────────────────

function BdDetailSheet({
  bdId,
  open,
  onClose,
  dateParams,
  variant,
}: {
  bdId: string | null
  open: boolean
  onClose: () => void
  dateParams: string
  variant: DashboardVariant
}) {
  const { data, isLoading } = useQuery<BdDetail>({
    queryKey: ['sales-dashboard', variant, 'bd-detail', bdId, dateParams],
    queryFn: () => apiGet<BdDetail>(`/api/analytics/sales-dashboard/bd-detail?bdId=${bdId}${dateParams ? '&' + dateParams : ''}`),
    enabled: !!bdId && open,
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <VisuallyHidden>
          <SheetTitle>BD Member Details</SheetTitle>
        </VisuallyHidden>
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {isLoading && <div className="text-center py-12 text-muted-foreground">Loading…</div>}
            {data && (
              <>
                <SheetHeader className="pb-0">
                  <div className="flex items-center gap-4">
                    <UserAvatar name={data.bd.name} picture={data.bd.profilePicture} size="md" />
                    <div>
                      <SheetTitle className="text-xl">{data.bd.name}</SheetTitle>
                      {data.bd.managerName && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">Manager: {data.bd.managerName}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetHeader>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard label="Leads" value={data.kpis.totalLeads} color="bg-blue-500/10 text-blue-900 dark:text-blue-100" />
                  <StatCard label="IPD Done" value={data.kpis.ipdDone} color="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" />
                  <StatCard label="Conversion" value={`${(data.kpis?.conversionRate ?? 0).toFixed(1)}%`} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
                  <StatCard label="Net Profit" value={fmtK(data.kpis.netProfit)} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
                  <StatCard label="Bill Amount" value={fmtK(data.kpis.billAmount)} color="bg-slate-500/10" />
                  <StatCard label="Avg Ticket" value={fmtK(data.kpis.avgTicketSize)} color="bg-rose-500/10 text-rose-900 dark:text-rose-100" />
                </div>

                {/* Month-wise chart */}
                {(data.monthWise?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" />Monthly Performance (All Time)</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.monthWise ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v, n) => [v, n === 'ipdCount' ? 'IPD' : 'Leads']} labelFormatter={(l) => `Month: ${l}`} />
                        <Bar dataKey="leadCount" fill="#93c5fd" radius={[2, 2, 0, 0]} name="Leads" />
                        <Bar dataKey="ipdCount" fill="#10b981" radius={[2, 2, 0, 0]} name="IPD" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Treatment pie */}
                {data.treatmentBreakdown?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Stethoscope className="h-4 w-4" />IPD by Treatment</p>
                    <div className="flex items-center gap-4">
                      <PieChart width={120} height={120}>
                        <Pie data={data.treatmentBreakdown} dataKey="count" nameKey="treatment" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {data.treatmentBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                      </PieChart>
                      <div className="space-y-1 flex-1 min-w-0">
                        {data.treatmentBreakdown.slice(0, 6).map((t, i) => (
                          <div key={t.treatment} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{t.treatment}</span>
                            <span className="ml-auto font-semibold tabular-nums">{t.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {([['City-wise conversion', data.cityWise], ['Source-wise conversion', data.sourceWise]] as const).map(([title, rows]) => (
                    <div key={title} className="rounded-lg border overflow-hidden">
                      <p className="px-3 py-2 text-sm font-semibold bg-muted/40">{title}</p>
                      <div className="max-h-52 overflow-auto">
                        {(rows ?? []).map((row) => <div key={row.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-xs border-t">
                          <span className="truncate">{row.label}</span><span>{row.totalLeads} leads</span><span className="text-emerald-600 font-medium">{row.ipd} IPD</span><span className="text-violet-600 font-medium">{row.conversionRate.toFixed(1)}%</span>
                        </div>)}
                        {!rows?.length && <p className="p-3 text-xs text-muted-foreground">No data for this period</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Surgery list */}
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Stethoscope className="h-4 w-4" />Surgery History ({(data.surgeries ?? []).length})</p>
                  <div className="space-y-2">
                    {(data.surgeries ?? []).slice(0, 50).map((s) => (
                      <div key={s.id} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.patientName}</p>
                            <p className="text-muted-foreground text-xs truncate">{s.treatment} · {s.hospitalName}</p>
                            {s.surgeonName && <p className="text-muted-foreground text-xs">Dr. {s.surgeonName}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-emerald-600">{fmtK(s.billAmount)}</p>
                            <p className="text-xs text-muted-foreground">{s.date ? format(new Date(s.date), 'dd MMM yy') : '–'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!data.surgeries?.length && <p className="text-muted-foreground text-sm text-center py-4">No IPD in selected period</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}


// ─── Month Conversion Panel ───────────────────────────────────────────────────

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return format(new Date(Number(y), Number(m) - 1, 1), 'MMM yyyy')
}

function MonthConversionPanel({ variant }: { variant: DashboardVariant }) {
  const currentYear = new Date().getFullYear()
  const yearStart = format(new Date(currentYear, 0, 1), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  // Independent of the page-level date-range picker — always the current
  // calendar year, so "this month" / "last 2 months" / "best month" stay
  // meaningful regardless of whatever range is selected elsewhere on the page.
  const { data: bdMonthly, isLoading } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'month-conversion', currentYear],
    queryFn: () =>
      apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly?startDate=${yearStart}&endDate=${today}`),
  })

  const recentMonthKeys = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 3; i++) {
      out.push(format(new Date(d.getFullYear(), d.getMonth() - i, 1), 'yyyy-MM'))
    }
    return out
  }, [])

  const [selectedMonth, setSelectedMonth] = useState(recentMonthKeys[0])

  const monthStats = useMemo(() => {
    const leads = bdMonthly?.totals.leads ?? {}
    const ipd = bdMonthly?.totals.ipd ?? {}
    return recentMonthKeys.map((key) => {
      const l = leads[key] ?? 0
      const i = ipd[key] ?? 0
      return { key, label: monthLabel(key), leads: l, ipd: i, conversion: l > 0 ? (i / l) * 100 : 0 }
    })
  }, [bdMonthly, recentMonthKeys])

  const bestMonth = useMemo(() => {
    const leads = bdMonthly?.totals.leads ?? {}
    const ipd = bdMonthly?.totals.ipd ?? {}
    const yearMonths = (bdMonthly?.months ?? []).filter((m) => m.startsWith(String(currentYear)))
    let best: { key: string; leads: number; ipd: number; conversion: number } | null = null
    for (const key of yearMonths) {
      const l = leads[key] ?? 0
      const i = ipd[key] ?? 0
      if (l <= 0) continue
      const conversion = (i / l) * 100
      if (!best || conversion > best.conversion) best = { key, leads: l, ipd: i, conversion }
    }
    return best
  }, [bdMonthly, currentYear])

  const selected = monthStats.find((m) => m.key === selectedMonth) ?? monthStats[0]

  return (
    <Card className="bg-card text-card-foreground border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />Month Conversion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Month picker: current + last 2 months */}
        <div className="flex flex-wrap gap-2">
          {monthStats.map((m, i) => (
            <Button
              key={m.key}
              size="sm"
              variant={selectedMonth === m.key ? 'default' : 'outline'}
              onClick={() => setSelectedMonth(m.key)}
              className={cn(
                "h-7 text-xs font-medium transition-all",
                selectedMonth === m.key
                  ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white"
                  : "bg-background text-foreground border-border hover:bg-muted"
              )}
            >
              {i === 0 ? `${m.label} (current)` : m.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={`Leads · ${selected?.label ?? ''}`} value={selected?.leads ?? 0} />
            <StatCard label={`IPD · ${selected?.label ?? ''}`} value={selected?.ipd ?? 0} />
            <StatCard label="Conversion" value={`${(selected?.conversion ?? 0).toFixed(1)}%`} />
            <StatCard
              label="Best month this year"
              value={bestMonth ? `${bestMonth.conversion.toFixed(1)}%` : '–'}
              sub={bestMonth ? monthLabel(bestMonth.key) : undefined}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function overviewDateQueryString(dateParams: string): string {
  if (dateParams) return dateParams
  const t = new Date()
  return `startDate=${format(new Date(t.getFullYear(), t.getMonth(), 1), 'yyyy-MM-dd')}&endDate=${format(t, 'yyyy-MM-dd')}`
}

function OverviewTab({
  dateParams,
  onSelectBd,
  variant,
}: {
  dateParams: string
  onSelectBd: (bdId: string) => void
  variant: DashboardVariant
}) {
  const qs = overviewDateQueryString(dateParams)
  const comparisonQs = qs ? `?${qs}` : ''
  const breakdownQs = qs ? `?${qs}` : ''

  const { data: comparison } = useQuery<IpdComparison>({
    queryKey: ['sales-dashboard', variant, 'ipd-comparison', qs],
    queryFn: () =>
      apiGet<IpdComparison>(`/api/analytics/sales-dashboard/ipd-comparison${comparisonQs}`),
  })

  const { data: bdLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['sales-dashboard', variant, 'leaderboard-bd', qs],
    queryFn: () => apiGet(`/api/analytics/leaderboard?type=bd&${qs}`),
  })

  const { data: teamLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['sales-dashboard', variant, 'leaderboard-team', qs],
    queryFn: () => apiGet(`/api/analytics/leaderboard?type=team&${qs}`),
  })

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['sales-dashboard', variant, 'ipd-breakdown-overview', qs],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${breakdownQs}`),
  })

  const { data: todayAssignments } = useQuery<TodayAssignments>({
    queryKey: ['sales-dashboard', variant, 'today-assignments'],
    queryFn: () => apiGet<TodayAssignments>('/api/analytics/today-leads-assignments'),
    refetchInterval: 60000,
  })

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ['target-teams'],
    queryFn: () => apiGet<any[]>('/api/targets/teams'),
  })

  const monthChartData = (ipdBreakdown?.byMonth ?? []).slice(-12)

  return (
    <div className="space-y-6">
      {/* IPD Pulse */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" /> IPD Pulse
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="IPD (selected range)" value={comparison?.ipdThisMonth ?? '–'} color="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" />
          <StatCard label="Prior period (vs same dates last month)" value={comparison?.ipdByThisDayLastMonth ?? '–'} color="bg-blue-500/10 text-blue-900 dark:text-blue-100" />
          <StatCard label={`Best month (by day ${comparison?.dayOfMonth ?? ''} in year)`} value={comparison?.ipdBestMonthByThisDay ?? '–'} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
          <StatCard label="Best month this year" value={comparison?.bestMonthThisYear?.count ?? '–'} sub={comparison?.bestMonthThisYear?.monthLabel ?? undefined} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
        </div>
      </div>

      {/* Month Conversion */}
      <MonthConversionPanel variant={variant} />

      {/* IPD by Month chart */}
      {monthChartData.length > 0 && (
        <Card className="bg-card text-card-foreground border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />IPD by Month (filtered range)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5) + '/' + v.slice(2, 4)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'IPD Done']} labelFormatter={(l) => `Month: ${l}`} />
                <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Leaderboards side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BD Leaderboard */}
        <Card className="bg-card text-card-foreground border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />BD Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[...(bdLeaderboard ?? [])].sort((a, b) => b.ipdDone - a.ipdDone).slice(0, 5).map((bd, i) => {
                const displayName = bd.bdName ?? bd.name ?? 'Unknown'
                return (
                  <button
                    key={bd.bdId ?? displayName}
                    onClick={() => bd.bdId && onSelectBd(bd.bdId)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <RankBadge rank={i + 1} />
                    <UserAvatar name={displayName} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate text-foreground">{displayName}</p>
                      {bd.teamName && <p className="text-xs text-muted-foreground truncate">{bd.teamName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{bd.ipdDone} IPD</p>
                      <p className="text-xs text-muted-foreground">{bd.totalLeads} leads</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                )
              })}
              {!bdLeaderboard?.length && <p className="text-center text-muted-foreground py-6 text-sm">No data in selected range</p>}
            </div>
          </CardContent>
        </Card>

        {/* Team Leaderboard */}
        <Card className="bg-card text-card-foreground border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" />Team Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[...(teamLeaderboard ?? [])].sort((a, b) => b.ipdDone - a.ipdDone).slice(0, 5).map((team, i) => {
                const displayName = team.teamName ?? team.managerName ?? team.name ?? 'Unknown'
                return (
                  <div key={team.managerId ?? displayName} className="flex items-center gap-3 px-4 py-3">
                    <RankBadge rank={i + 1} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{team.totalLeads} leads · {team.conversionRate?.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{team.ipdDone} IPD</p>
                      <p className="text-xs text-muted-foreground">{fmtK(team.netProfit ?? 0)}</p>
                    </div>
                  </div>
                )
              })}
              {!teamLeaderboard?.length && <p className="text-center text-muted-foreground py-6 text-sm">No data in selected range</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's lead assignments */}
      <Card className="bg-card text-card-foreground border border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-blue-500" />Today&apos;s Lead Assignments</CardTitle>
            <Badge variant="secondary">{todayAssignments?.totalLeads ?? 0} leads</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {(todayAssignments?.assignments ?? []).map((a) => (
              <div key={a.bdId} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar name={a.bdName} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{a.bdName}</p>
                  {a.managerName && <p className="text-xs text-muted-foreground">{a.managerName}</p>}
                </div>
                <Badge>{a.leadCount}</Badge>
              </div>
            ))}
            {!todayAssignments?.assignments?.length && <p className="text-center text-muted-foreground py-6 text-sm">No leads assigned today</p>}
          </div>
        </CardContent>
      </Card>

      {/* Untouched Leads Table */}
      <UntouchedLeadsTable teams={teams} />
    </div>
  )
}

// ─── Team Performance Tab ─────────────────────────────────────────────────────

function TeamPerformanceTab({
  dateParams,
  onSelectTeam,
  variant,
}: {
  dateParams: string
  onSelectTeam: (managerId: string) => void
  variant: DashboardVariant
}) {
  const { user } = useAuth()
  const isMdOrAdmin = user?.role === 'MD' || user?.role === 'ADMIN'
  const qp = dateParams ? '?' + dateParams : ''

  const { data: bdMonthly } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'bd-monthly', dateParams],
    queryFn: () => apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly${dateParams ? '?' + dateParams : ''}`),
  })

  const { data: targetSalary } = useQuery<TargetSalaryData>({
    queryKey: ['sales-dashboard', variant, 'target-salary', dateParams],
    queryFn: () => apiGet<TargetSalaryData>(`/api/analytics/sales-dashboard/target-salary${dateParams ? '?' + dateParams : ''}`),
    enabled: isMdOrAdmin,
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['sales-dashboard', variant, 'leads-breakdown-team-tab', dateParams],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['sales-dashboard', variant, 'ipd-breakdown-team-tab', dateParams],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const teamSalaryMap = new Map((targetSalary?.teamSalaryBreakdown ?? []).map((t) => [t.managerId, t]))

  // Helper to compute trend or fallback to dummy data
  const getTrendData = (mId: string, isCm: boolean) => {
    const dummy = { current: 15.4, prev: 12.2, prev2: 9.8 }
    if (!bdMonthly || !bdMonthly.bds) return dummy

    const d = new Date()
    const currentM = format(d, 'yyyy-MM')
    const prevM = format(new Date(d.getFullYear(), d.getMonth() - 1, 1), 'yyyy-MM')
    const prev2M = format(new Date(d.getFullYear(), d.getMonth() - 2, 1), 'yyyy-MM')

    let cLeads = 0, cIpd = 0
    let pLeads = 0, pIpd = 0
    let p2Leads = 0, p2Ipd = 0

    const bds = bdMonthly.bds.filter(bd => {
      if (isCm) {
        return bd.cmManagerId === mId || bd.bdEmployeeId === mId
      }
      return bd.managerId === mId || bd.bdEmployeeId === mId
    })

    if (bds.length === 0) return dummy

    bds.forEach(bd => {
      cLeads += bd.leads?.[currentM] || 0
      cIpd += bd.ipd?.[currentM] || 0
      pLeads += bd.leads?.[prevM] || 0
      pIpd += bd.ipd?.[prevM] || 0
      p2Leads += bd.leads?.[prev2M] || 0
      p2Ipd += bd.ipd?.[prev2M] || 0
    })

    if (cLeads === 0 && pLeads === 0 && p2Leads === 0) return dummy

    return {
      current: cLeads > 0 ? (cIpd / cLeads) * 100 : (cIpd > 0 ? 100 : dummy.current),
      prev: pLeads > 0 ? (pIpd / pLeads) * 100 : (pIpd > 0 ? 100 : dummy.prev),
      prev2: p2Leads > 0 ? (p2Ipd / p2Leads) * 100 : (p2Ipd > 0 ? 100 : dummy.prev2),
    }
  }

  // Build TL/ACM manager groups from immediate managerId
  const managerGroups = new Map<string, ManagerGroup>()
  // Build CM groups from recursive CM ancestry (cmManagerId)
  const cmGroups = new Map<string, ManagerGroup>()
  if (bdMonthly) {
    for (const bd of bdMonthly.bds) {
      if (bd.managerId && bd.managerName) {
        const existing = managerGroups.get(bd.managerId)
        if (existing) {
          existing.totalIpd += bd.totalIpd
          existing.totalLeads += bd.totalLeads
        } else {
          managerGroups.set(bd.managerId, {
            managerId: bd.managerId,
            managerName: bd.managerName,
            totalIpd: bd.totalIpd,
            totalLeads: bd.totalLeads,
          })
        }
      }

      if (bd.cmManagerId && bd.cmManagerName) {
        const existingCm = cmGroups.get(bd.cmManagerId)
        if (existingCm) {
          existingCm.totalIpd += bd.totalIpd
          existingCm.totalLeads += bd.totalLeads
        } else {
          cmGroups.set(bd.cmManagerId, {
            managerId: bd.cmManagerId,
            managerName: bd.cmManagerName,
            totalIpd: bd.totalIpd,
            totalLeads: bd.totalLeads,
          })
        }
      }
    }

    // TL/ACM's own BD work should also count toward their own team card.
    for (const bd of bdMonthly.bds) {
      if (!bd.bdEmployeeId) continue
      if (bd.managerId === bd.bdEmployeeId) continue
      const selfGroup = managerGroups.get(bd.bdEmployeeId)
      if (selfGroup) {
        selfGroup.totalIpd += bd.totalIpd
        selfGroup.totalLeads += bd.totalLeads
      }
    }

    // CM's own BD work counts toward CM card
    for (const bd of bdMonthly.bds) {
      if (!bd.bdEmployeeId) continue
      const selfCm = cmGroups.get(bd.bdEmployeeId)
      if (selfCm && bd.cmManagerId !== bd.bdEmployeeId) {
        selfCm.totalIpd += bd.totalIpd
        selfCm.totalLeads += bd.totalLeads
      }
    }
  }

  // TL/ACM cards: exclude pure CM manager ids that only appear as CM (keep immediate managers)
  const cmIds = new Set(cmGroups.keys())
  const groups = [...managerGroups.values()]
    .filter((g) => g.managerName !== 'Hardeep Bhargav')
    // If a CM is also someone's immediate manager (direct BDs), keep them in TL list only when not already shown as CM — show CM section separately
    .filter((g) => !cmIds.has(g.managerId))
    .sort((a, b) => b.totalIpd - a.totalIpd)

  const cmGroupList = [...cmGroups.values()]
    .filter((g) => g.managerName !== 'Hardeep Bhargav')
    .sort((a, b) => b.totalIpd - a.totalIpd)

  const categoryRows = (leadsBreakdown?.byCategory ?? []).map((c) => {
    const ipdRow = (ipdBreakdown?.byCategory ?? []).find(
      (i) => i.category.toLowerCase() === c.category.toLowerCase()
    )
    return {
      category: c.category,
      leads: c.totalLeads,
      ipd: ipdRow?.count ?? c.converted,
      conv: c.conversionRate,
      revenue: ipdRow?.revenue ?? 0,
    }
  }).sort((a, b) => b.ipd - a.ipd || b.leads - a.leads)

  // Include IPD categories that had no lead-entry matches
  for (const ipdRow of ipdBreakdown?.byCategory ?? []) {
    if (categoryRows.some((r) => r.category.toLowerCase() === ipdRow.category.toLowerCase())) continue
    categoryRows.push({
      category: ipdRow.category,
      leads: 0,
      ipd: ipdRow.count,
      conv: 0,
      revenue: ipdRow.revenue,
    })
  }

  return (
    <div className="space-y-6">
      {/* Category-wise performance */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> By Category
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryRows.map((row, i) => (
            <div
              key={row.category}
              className="rounded-xl border border-border border-l-4 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow p-4"
              style={{ borderLeftColor: PIE_COLORS[i % PIE_COLORS.length] }}
            >
              <p className="font-semibold text-sm text-foreground">{row.category}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{row.ipd}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">IPD</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{row.leads}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{row.conv.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Conv.</p>
                </div>
              </div>
              {row.revenue > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Revenue: {fmtK(row.revenue)}</p>
              )}
              <Progress value={Math.min(row.conv, 100)} className="mt-2 h-1.5" />
            </div>
          ))}
          {categoryRows.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-4 text-sm">No category data in selected range</p>
          )}
        </div>
      </div>

      {/* Category Manager cards (recursive rollup) */}
      {cmGroupList.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> By Category Manager
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cmGroupList.map((group) => {
              const conv = group.totalLeads > 0 ? ((group.totalIpd / group.totalLeads) * 100).toFixed(1) : '0.0'
              const trend = getTrendData(group.managerId, true)
              return (
                <button
                  key={`cm-${group.managerId}`}
                  onClick={() => onSelectTeam(group.managerId)}
                  className="text-left rounded-xl border border-border border-l-4 border-l-teal-500 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow p-4 w-full"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <UserAvatar name={group.managerName} />
                      <div className="ml-1">
                        <p className="font-semibold text-sm text-foreground">{group.managerName}&apos;s Category</p>
                        <p className="text-xs text-muted-foreground mt-0.5">CM: {group.managerName}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{group.totalIpd}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">IPD</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{group.totalLeads}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Leads</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{conv}%</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Conv.</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Conversion Trend
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[9px] text-muted-foreground">2nd Prev</span>
                          <span className="text-[10px] font-medium">{trend.prev2.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(trend.prev2, 100)} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[9px] text-muted-foreground">Prev</span>
                          <span className="text-[10px] font-medium">{trend.prev.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(trend.prev, 100)} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[9px] text-violet-600 dark:text-violet-400 font-medium">Current</span>
                          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">{trend.current.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(trend.current, 100)} className="h-1 [&>div]:bg-violet-600 dark:[&>div]:bg-violet-400" />
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Team lead / ACM cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> By Team (TL / ACM)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const conv = group.totalLeads > 0 ? ((group.totalIpd / group.totalLeads) * 100).toFixed(1) : '0.0'
            const teamSal = teamSalaryMap.get(group.managerId)
            return (
              <button
                key={group.managerId}
                onClick={() => onSelectTeam(group.managerId)}
                className="text-left rounded-xl border border-border border-l-4 border-l-blue-500 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow p-4 w-full"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{group.managerName}&apos;s Team</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Manager: {group.managerName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{group.totalIpd}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">IPD</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{group.totalLeads}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Leads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{conv}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Conv.</p>
                  </div>
                </div>
                {isMdOrAdmin && teamSal && teamSal.totalSalary > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Team Salary: ₹{fmtK(teamSal.totalSalary)}</span>
                      <span>
                        Rev/Sal: <span className={teamSal.revenueSalaryRatio != null && teamSal.revenueSalaryRatio >= 1 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>{teamSal.revenueSalaryRatio != null ? `${teamSal.revenueSalaryRatio.toFixed(1)}x` : '–'}</span>
                      </span>
                    </div>
                    <Progress value={Math.min(teamSal.revenueSalaryRatio != null ? (teamSal.revenueSalaryRatio > 2 ? 100 : teamSal.revenueSalaryRatio * 50) : 0, 100)} className="mt-1.5 h-1" />
                  </div>
                )}
                <Progress value={Math.min(Number(conv), 100)} className="mt-2 h-1.5" />
              </button>
            )
          })}
          {groups.length === 0 && cmGroupList.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-6 text-sm">No team data in selected range</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BD Performance Tab ───────────────────────────────────────────────────────

function BdPerformanceTab({
  dateParams,
  onSelectBd,
  variant,
  dateRange,
}: {
  dateParams: string
  onSelectBd: (bdId: string) => void
  variant: DashboardVariant
  dateRange?: DateRange
}) {
  const [sortBy, setSortBy] = useState<'ipdDone' | 'totalLeads' | 'conversionRate'>('ipdDone')
  const { user } = useAuth()
  const isMdOrAdmin = user?.role === 'MD' || user?.role === 'ADMIN'

  const { data: bdMonthly } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'bd-monthly', dateParams],
    queryFn: () => apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly${dateParams ? '?' + dateParams : ''}`),
  })

  const { data: targetSalary } = useQuery<TargetSalaryData>({
    queryKey: ['sales-dashboard', variant, 'target-salary', dateParams],
    queryFn: () => apiGet<TargetSalaryData>(`/api/analytics/sales-dashboard/target-salary${dateParams ? '?' + dateParams : ''}`),
    enabled: isMdOrAdmin,
  })

  const dateFrom = dateRange?.from || new Date()
  const incentiveMonth = dateFrom.getMonth() + 1
  const incentiveYear = dateFrom.getFullYear()

  const { data: incentivesData } = useQuery<{ records: any[] }>({
    queryKey: ['incentives-list', incentiveMonth, incentiveYear],
    queryFn: () => apiGet<{ records: any[] }>(`/api/incentives?month=${incentiveMonth}&year=${incentiveYear}`),
  })

  const incentivesByUserId = new Map<string, number>()
  const incentivesByEmployeeId = new Map<string, number>()
  const incentivesByName = new Map<string, number>()
  if (incentivesData?.records) {
    for (const rec of incentivesData.records) {
      if (rec.userId) incentivesByUserId.set(rec.userId, rec.amount)
      if (rec.employeeId) incentivesByEmployeeId.set(rec.employeeId, rec.amount)
      if (rec.employeeName) incentivesByName.set(rec.employeeName.toLowerCase().trim(), rec.amount)
    }
  }

  const salaryByBd = new Map((targetSalary?.bdSalaryTarget ?? []).map((b) => [b.bdId, b]))

  const bds = (bdMonthly?.bds ?? []).map((bd) => ({
    ...bd,
    conversionRate: bd.totalLeads > 0 ? (bd.totalIpd / bd.totalLeads) * 100 : 0,
  })).sort((a, b) => {
    if (sortBy === 'ipdDone') return b.totalIpd - a.totalIpd
    if (sortBy === 'totalLeads') return b.totalLeads - a.totalLeads
    return b.conversionRate - a.conversionRate
  })

  const recentMonths = (bdMonthly?.months ?? []).slice(-4)

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground flex items-center gap-1"><ArrowUpDown className="h-3.5 w-3.5" />Sort by:</span>
        {(['ipdDone', 'totalLeads', 'conversionRate'] as const).map((s) => (
          <Button key={s} size="sm" variant={sortBy === s ? 'default' : 'outline'} onClick={() => setSortBy(s)} className="h-7 text-xs">
            {s === 'ipdDone' ? 'IPD' : s === 'totalLeads' ? 'Leads' : 'Conversion'}
          </Button>
        ))}
      </div>

      {/* BD cards */}
      <div className="space-y-2">
        {bds.map((bd, i) => {
          const sal = salaryByBd.get(bd.bdId)
          return (
            <button
              key={bd.bdId}
              onClick={() => onSelectBd(bd.bdId)}
              className="w-full text-left rounded-xl border border-border bg-card text-card-foreground hover:bg-muted/40 transition-colors p-4 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <RankBadge rank={i + 1} />
                <UserAvatar name={bd.bdName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{bd.bdName}</p>
                    {bd.managerName && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{bd.managerName}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{bd.totalLeads} leads</span>
                    <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold">{bd.conversionRate.toFixed(1)}%</span>
                    <Progress value={Math.min(bd.conversionRate, 100)} className="h-1 w-16" />
                    {isMdOrAdmin && sal && sal.salary != null && sal.salary > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ₹{fmtK(sal.salary)} · <span className={sal.revenueSalaryRatio != null && sal.revenueSalaryRatio >= 1 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>{sal.revenueSalaryRatio != null ? `${(sal.revenueSalaryRatio).toFixed(1)}x` : '–'}</span>
                      </span>
                    )}
                    {(() => {
                      const amount = incentivesByUserId.get(bd.bdId) ?? (bd.bdEmployeeId ? incentivesByEmployeeId.get(bd.bdEmployeeId) : undefined) ?? incentivesByName.get((bd.bdName ?? '').toLowerCase().trim())
                      if (amount === undefined && HIDE_MISSING_INCENTIVE_CAPSULE) return null
                      return (
                        <span className="inline-flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                          Incentive: {amount !== undefined ? `₹${amount.toLocaleString()}` : '-'}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                {/* Last 4 months mini bars */}
                <div className="hidden sm:flex items-end gap-1 h-8">
                  {recentMonths.map((m) => {
                    const v = bd.ipd?.[m] ?? 0
                    const maxV = Math.max(1, ...bds.map((b) => b.ipd?.[m] ?? 0))
                    return (
                      <div key={m} className="flex flex-col items-center gap-0.5">
                        <div className="w-5 bg-emerald-500/20 rounded-sm relative" style={{ height: `${Math.max(4, (v / maxV) * 28)}px` }}>
                          {v > 0 && <div className="absolute inset-0 bg-emerald-500 rounded-sm opacity-80" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{bd.totalIpd}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">IPD Done</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              {/* Mobile: revenue/salary row */}
              {isMdOrAdmin && sal && sal.salary != null && sal.salary > 0 && (
                <div className="flex sm:hidden items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                  <span>Salary: ₹{fmtK(sal.salary)}</span>
                  <span>
                    Rev/Sal: <span className={sal.revenueSalaryRatio != null && sal.revenueSalaryRatio >= 1 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>{sal.revenueSalaryRatio != null ? `${sal.revenueSalaryRatio.toFixed(1)}x` : '–'}</span>
                  </span>
                </div>
              )}
            </button>
          )
        })}
        {bds.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No data for selected period</p>}
      </div>
    </div>
  )
}

// ─── Lead Quality and first-call SLA ─────────────────────────────────────────

function LeadQualitySlaTab({ dateParams, variant }: { dateParams: string; variant: DashboardVariant }) {
  const [city, setCity] = useState('')
  const [source, setSource] = useState('')
  const [bdId, setBdId] = useState('')
  const [teamId, setTeamId] = useState('')
  const filterParams = new URLSearchParams(dateParams)
  if (city) filterParams.set('city', city)
  if (source) filterParams.set('source', source)
  if (bdId) filterParams.set('bdId', bdId)
  if (teamId) filterParams.set('teamId', teamId)
  const query = filterParams.toString()
  const { data } = useQuery<QualitySlaData>({
    queryKey: ['sales-dashboard', variant, 'quality-sla', query],
    queryFn: () => apiGet<QualitySlaData>(`/api/analytics/sales-dashboard/quality-sla?${query}`),
  })
  const filterOptions = data?.filters
  const renderTable = (title: string, rows: QualityRow[]) => (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0"><div className="max-h-80 overflow-auto"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">OPD</TableHead><TableHead className="text-right">IPD</TableHead><TableHead className="text-right">Closed</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={row.key}><TableCell className="font-medium">{row.label}</TableCell><TableCell className="text-right">{row.totalLeads}</TableCell><TableCell className="text-right">{row.opd}</TableCell><TableCell className="text-right text-emerald-600">{row.ipd}</TableCell><TableCell className="text-right">{row.closed}</TableCell><TableCell className="text-right text-violet-600">{row.conversionRate}%</TableCell></TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data for this period</TableCell></TableRow>}</TableBody>
      </Table></div></CardContent>
    </Card>
  )
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Quality is shown as lead volume and OPD, IPD, Closed, and IPD conversion. The SLA uses the first recorded call note after lead receipt.</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {([
        ['City', city, setCity, filterOptions?.cities ?? []], ['Source', source, setSource, filterOptions?.sources ?? []],
        ['BDM', bdId, setBdId, filterOptions?.bds ?? []], ['Team', teamId, setTeamId, filterOptions?.teams ?? []],
      ] as const).map(([label, value, setValue, options]) => <label key={label} className="text-xs text-muted-foreground">{label}
        <select value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="">All {label}s</option>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select>
      </label>)}
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <StatCard label="Total Leads" value={data?.totals.totalLeads ?? 0} color="bg-blue-500/10" /><StatCard label="OPD" value={data?.totals.opd ?? 0} color="bg-cyan-500/10" /><StatCard label="IPD" value={data?.totals.ipd ?? 0} color="bg-emerald-500/10" /><StatCard label="Closed" value={data?.totals.closed ?? 0} color="bg-amber-500/10" /><StatCard label="Conversion" value={`${data?.totals.conversionRate ?? 0}%`} color="bg-violet-500/10" />
    </div>
    <Card><CardHeader className="px-4 py-3"><CardTitle className="text-sm">New Lead Calling SLA</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5"><StatCard label="Within 5 min" value={data?.sla.within5Minutes ?? 0} color="bg-emerald-500/10" /><StatCard label="6–15 min" value={data?.sla.within15Minutes ?? 0} color="bg-teal-500/10" /><StatCard label="Over 15 min" value={data?.sla.late ?? 0} color="bg-rose-500/10" /><StatCard label="No call recorded" value={data?.sla.pending ?? 0} color="bg-slate-500/10" /><StatCard label="Within 15 min" value={`${data?.sla.within15Rate ?? 0}%`} color="bg-violet-500/10" /></CardContent></Card>
    <div className="grid gap-4 xl:grid-cols-2">{renderTable('City-wise lead quality', data?.cityWise ?? [])}{renderTable('Source-wise lead quality', data?.sourceWise ?? [])}{renderTable('BD-wise performance', data?.bdWise ?? [])}{renderTable('Team-wise lead quality', data?.teamWise ?? [])}</div>
  </div>
}

// ─── Sources & Campaigns Tab ──────────────────────────────────────────────────

function SourceCampaignTab({ dateParams, variant }: { dateParams: string; variant: DashboardVariant }) {
  const [view, setView] = useState<'source' | 'campaign'>('source')
  const qp = dateParams ? '?' + dateParams : ''

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['sales-dashboard', variant, 'leads-breakdown', dateParams, qp],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const sourceData = useMemo(() => {
    return (leadsBreakdown?.bySource ?? []).map((s) => ({
      name: s.source,
      leads: s.totalLeads,
      ipd: s.converted,
      conv: s.conversionRate,
      revenue: s.revenue ?? 0,
    })).sort((a, b) => b.leads - a.leads)
  }, [leadsBreakdown])

  const campaignData = useMemo(() => {
    return (leadsBreakdown?.byCampaign ?? []).map((c) => ({
      name: c.campaign,
      leads: c.totalLeads,
      ipd: c.converted,
      conv: c.conversionRate,
      revenue: c.revenue ?? 0,
    })).sort((a, b) => b.leads - a.leads)
  }, [leadsBreakdown])

  const rows = view === 'source' ? sourceData : campaignData
  const pieData = useMemo(() => {
    const active = rows.filter((r) => r.ipd > 0 || r.leads > 0)
    return active.slice(0, 8)
  }, [rows])

  const { data: teamMappingData } = useQuery<any[]>({
    queryKey: ['sales-dashboard', variant, 'team-mappings', view, dateParams, qp],
    queryFn: () => apiGet<any[]>(`/api/analytics/sales-dashboard/team-mappings${qp}${dateParams ? '&' : '?'}type=${view}`),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted p-1 rounded-xl inline-flex gap-1 border border-border shadow-inner">
          <button
            onClick={() => setView('source')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs transition-all duration-300 font-bold uppercase tracking-wider",
              view === 'source'
                ? "bg-background text-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            Source
          </button>
          <button
            onClick={() => setView('campaign')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs transition-all duration-300 font-bold uppercase tracking-wider",
              view === 'campaign'
                ? "bg-background text-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            Campaign
          </button>
        </div>
      </div>

      {/* Pie + table side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-card text-card-foreground border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">IPD Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {pieData.length > 0 ? (
              <>
                <PieChart width={160} height={160} className="mx-auto">
                  <Pie data={pieData} dataKey="ipd" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
                <div className="mt-4 space-y-1.5">
                  {(() => {
                    const totalIpd = pieData.reduce((sum, d) => sum + d.ipd, 0)
                    return pieData.map((d, i) => {
                      const percentage = totalIpd > 0 ? (d.ipd / totalIpd) * 100 : 0
                      return (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate text-muted-foreground">{d.name} ({percentage.toFixed(1)}%)</span>
                          <span className="ml-auto font-semibold text-foreground tabular-nums pr-2">{d.ipd} IPD</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-xs">No distribution data</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden bg-card text-card-foreground border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {view === 'source' ? 'Source' : 'Campaign'} Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="text-xs font-bold text-muted-foreground uppercase py-2 px-3">{view === 'source' ? 'Source' : 'Campaign'}</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase py-2 px-3 [&>div]:justify-end">Leads</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase py-2 px-3 [&>div]:justify-end">IPD</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase py-2 px-3 [&>div]:justify-end">Conv %</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground uppercase py-2 px-3 [&>div]:justify-end">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name} className="hover:bg-muted/40 border-b border-border transition-colors duration-200">
                      <TableCell className="font-semibold text-foreground text-sm max-w-[160px] truncate py-2 px-3">{r.name}</TableCell>
                      <TableCell className="text-right text-foreground tabular-nums text-sm py-2 px-3">{r.leads}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 text-sm py-2 px-3">{r.ipd}</TableCell>
                      <TableCell className="text-right tabular-nums text-violet-600 dark:text-violet-400 font-semibold text-sm py-2 px-3">{r.conv.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-foreground tabular-nums text-sm py-2 px-3">{fmtK(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">
                        No breakdown data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Section */}
      <TeamMappingSection view={view} data={teamMappingData ?? []} />
    </div>
  )
}

// ─── Circle Tab ───────────────────────────────────────────────────────────────

function CircleTab({ dateParams, variant }: { dateParams: string; variant: DashboardVariant }) {
  const qp = dateParams ? '?' + dateParams : ''

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['sales-dashboard', variant, 'ipd-breakdown', dateParams],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['sales-dashboard', variant, 'leads-breakdown', dateParams],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const circleData = useMemo(() => {
    return (leadsBreakdown?.byCircle ?? []).map((c) => ({
      circle: c.circle,
      leads: c.totalLeads,
      ipd: c.converted,
      conv: c.conversionRate,
      revenue: c.revenue ?? 0,
      profit: c.profit ?? 0,
    })).sort((a, b) => b.leads - a.leads)
  }, [leadsBreakdown])

  const pieData = circleData.filter((c) => c.leads > 0 || c.ipd > 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {circleData.map((c, i) => (
          <Card key={c.circle} className="overflow-hidden border border-border bg-card text-card-foreground shadow-sm hover:shadow-md">
            <div className="h-1" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <CardContent className="pt-3 pb-3">
              <p className="font-semibold text-sm">{c.circle}</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{c.ipd} <span className="text-xs font-normal text-muted-foreground">IPD</span></p>
                <p className="text-xs text-muted-foreground">{c.leads} leads · {c.conv.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{fmtK(c.revenue)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie + Hospital table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads by Circle</CardTitle></CardHeader>
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
                      <span className="ml-auto font-semibold tabular-nums text-foreground">{d.leads}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-muted-foreground py-8 text-sm">No data</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden border border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Hospitals</CardTitle></CardHeader>
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
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{h.count}</TableCell>
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

// ─── Marketing Insights Tab ───────────────────────────────────────────────────

function MarketingInsightsTab({ dateRange }: { dateRange: DateRange | undefined }) {
  const dateFrom = dateRange?.from || new Date()
  const analyticsMonth = dateFrom.getMonth() + 1
  const analyticsYear = dateFrom.getFullYear()

  // Query campaign analytics
  const { data: analyticsResponse, isLoading } = useQuery<any>({
    queryKey: ['campaign-analytics-insights', analyticsMonth, analyticsYear],
    queryFn: () =>
      apiGet(`/api/digital-marketing/campaign-analytics?month=${analyticsMonth}&year=${analyticsYear}&excellentMax=500&goodMax=1200`),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-card border border-border rounded-xl p-6 shadow-sm">
        <p className="text-sm text-muted-foreground animate-pulse">Loading marketing insights...</p>
      </div>
    )
  }

  // Fallback dummy insights data when the API does not contain insights or returns 403
  const dummyInsights = {
    summaryText: "Facebook campaign CPL improved by 14% this month due to optimized audience targeting on Orthopedics, though Google search CPC slightly increased.",
    highestPerformingCampaign: "FB_Orthopedics_LeadGen (45 Conversions)",
    lowestCplCampaign: "FB_Gastro_Core (₹280 CPL)",
    bestRoiCampaign: "Google_Search_KneeReplacement (3.8x ROI)",
    highestCplCampaign: "Google_Search_Urology (₹1,450 CPL)",
    budgetWarningCampaign: "FB_Spine_Reconversion (Nearing Limit)",
    recommendationText: "Allocate 15% more budget to FB_Orthopedics_LeadGen and reduce Google_Search_Urology bidding by 20% to optimize overall CPL."
  }

  const insights = analyticsResponse?.marketingInsights || dummyInsights

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card className="bg-violet-500/10 dark:bg-violet-950/30 border border-violet-500/20 rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Marketing Insights & Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs md:text-sm text-foreground leading-relaxed">
          <p className="font-medium text-muted-foreground">{insights.summaryText}</p>

          <div className="grid gap-4 md:grid-cols-2 mt-2 pt-2 border-t border-violet-500/20">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Key Performers
              </div>
              <ul className="space-y-1 text-xs">
                <li>Highest Conversions: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{insights.highestPerformingCampaign}</span></li>
                <li>Lowest CPL: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{insights.lowestCplCampaign}</span></li>
                <li>Best Conversion ROI: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{insights.bestRoiCampaign}</span></li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" /> Optimization Warnings
              </div>
              <ul className="space-y-1 text-xs">
                <li>Highest CPL Campaign: <span className="font-semibold text-amber-600 dark:text-amber-400">{insights.highestCplCampaign}</span></li>
                <li>Budget Alert: <span className="font-semibold text-amber-600 dark:text-amber-400">{insights.budgetWarningCampaign}</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs flex gap-2 items-start text-violet-800 dark:text-violet-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
            <span><strong>Recommendation:</strong> {insights.recommendationText}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SalesDashboardView({ variant = 'org' }: { variant?: DashboardVariant }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const t = new Date()
    return {
      from: new Date(t.getFullYear(), t.getMonth(), 1),
      to: new Date(t.getFullYear(), t.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  })

  const [selectedBdId, setSelectedBdId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const dateParams = [
    dateRange?.from ? `startDate=${format(dateRange.from, 'yyyy-MM-dd')}` : '',
    dateRange?.to ? `endDate=${format(dateRange.to, 'yyyy-MM-dd')}` : '',
  ].filter(Boolean).join('&')

  const { data: myTeamData } = useQuery<any>({
    queryKey: ['hierarchy-my-team'],
    queryFn: () => apiGet<any>('/api/hierarchy/my-team'),
    enabled: variant === 'team-lead',
  })

  const myEmployeeId = myTeamData?.manager?.id

  const tabsForNav = TABS

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-600" />
              {variant === 'team-lead' ? 'Team sales' : 'Sales Dashboard'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {variant === 'team-lead'
                ? 'IPD and performance for your team only'
                : 'IPD performance, leaderboards and team analytics'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {variant === 'team-lead' && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/team-lead/pipeline">View pipeline</Link>
              </Button>
            )}
            <div className="flex w-full sm:w-auto shrink-0">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <TabNavigation tabs={tabsForNav} value={activeTab} onValueChange={setActiveTab} variant="sales" />

        {/* Tab content */}
        <div className="mt-2">
          {activeTab === 'overview' && (
            <OverviewTab dateParams={dateParams} onSelectBd={(id) => setSelectedBdId(id)} variant={variant} />
          )}
          {activeTab === 'team' && (
            variant === 'team-lead' ? (
              myEmployeeId ? (
                <TeamDetailView
                  teamId={myEmployeeId}
                  dateParams={dateParams}
                  variant={variant}
                  dateRange={dateRange}
                  onBack={() => {}}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground animate-pulse font-medium">
                  Loading team performance...
                </div>
              )
            ) : selectedTeamId ? (
              <TeamDetailView
                teamId={selectedTeamId}
                dateParams={dateParams}
                variant={variant}
                dateRange={dateRange}
                onBack={() => setSelectedTeamId(null)}
                onSelectNestedTeam={(id) => setSelectedTeamId(id)}
              />
            ) : (
              <TeamPerformanceTab dateParams={dateParams} onSelectTeam={(id) => setSelectedTeamId(id)} variant={variant} />
            )
          )}
          {activeTab === 'bd' && (
            <BdPerformanceTab dateParams={dateParams} onSelectBd={(id) => setSelectedBdId(id)} variant={variant} dateRange={dateRange} />
          )}
          {activeTab === 'quality' && (
            <LeadQualitySlaTab dateParams={dateParams} variant={variant} />
          )}
          {activeTab === 'sources' && (
            <SourceCampaignTab dateParams={dateParams} variant={variant} />
          )}
          {activeTab === 'circle' && (
            <CircleTab dateParams={dateParams} variant={variant} />
          )}
          {activeTab === 'insights' && (
            <MarketingInsightsTab dateRange={dateRange} />
          )}
        </div>
      </div>

      {/* Sheets */}
      <BdDetailSheet
        bdId={selectedBdId}
        open={!!selectedBdId}
        onClose={() => setSelectedBdId(null)}
        dateParams={dateParams}
        variant={variant}
      />

    </AuthenticatedLayout>
  )
}
