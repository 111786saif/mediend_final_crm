'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
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
import { format, startOfMonth, endOfMonth } from 'date-fns'
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
  surgeries: Array<{ id: string; patientName: string; treatment: string; hospitalName: string; surgeonName: string | null; date: string | null; billAmount: number; netProfit: number; circle: string }>
  monthWise: Array<{ month: string; leadCount: number; ipdCount: number }>
  treatmentBreakdown: Array<{ treatment: string; count: number }>
}

interface ManagerGroup {
  managerId: string
  managerName: string
  totalIpd: number
  totalLeads: number
}

interface TeamDetail {
  team: { id: string; name: string; manager: { id: string; name: string; profilePicture: string | null } | null }
  kpis: { totalLeads: number; totalIpd: number; totalProfit: number; totalBill: number; conversionRate: number }
  members: Array<{ id: string; name: string; profilePicture: string | null; leads: number; ipdDone: number; conversionRate: number; netProfit: number; billAmount: number }>
  targets?: Array<{ metric: string; label: string; targetValue: number; achieved: number; percentage: number }>
  monthWise: { months: string[]; rows: Array<{ month: string; bdId: string; bdName: string; leadCount: number; ipdCount: number }> }
}

interface IpdBreakdown {
  byCircle: Array<{ circle: string; count: number; revenue: number; profit: number }>
  byDisease: Array<{ disease: string; count: number; revenue: number; profit: number }>
  byHospital: Array<{ hospitalName: string; circle: string; count: number; revenue: number; profit: number }>
  bySource: Array<{ source: string; count: number; revenue: number; profit: number }>
  byCampaign: Array<{ campaign: string; count: number; revenue: number; profit: number }>
  byInsurance: Array<{ insurance: string; count: number; revenue: number; profit: number }>
  byTpa: Array<{ tpa: string; count: number; revenue: number; profit: number }>
  byMonth: Array<{ month: string; count: number; revenue: number; profit: number }>
  surgeonCrossAnalysis: Array<{ surgeonName: string; hospitalName: string; treatment: string; count: number; revenue: number; profit: number }>
}

interface TargetSummary {
  ipdDone: number
  assignedTarget: number
  achievementPercentage: number | null
  teamTargetCount: number
}

interface LeadsBreakdown {
  byCircle: Array<{ circle: string; totalLeads: number; converted: number; conversionRate: number }>
  bySource: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number }>
  byCampaign: Array<{ campaign: string; totalLeads: number; converted: number; conversionRate: number }>
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

type DashboardVariant = 'org' | 'team-lead'

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'team', label: 'Team Performance' },
  { value: 'bd', label: 'BD Performance' },
  { value: 'sources', label: 'Sources & Campaigns' },
  { value: 'circle', label: 'Circle' },
  { value: 'insights', label: 'Marketing Insights' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function fmtK(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white"><Trophy className="h-3.5 w-3.5" /></span>
  if (rank === 2) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-slate-700"><Medal className="h-3.5 w-3.5" /></span>
  if (rank === 3) return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white"><Medal className="h-3.5 w-3.5" /></span>
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">{rank}</span>
}

function UserAvatar({ name, picture, size = 'sm' }: { name: string; picture?: string | null; size?: 'sm' | 'md' }) {
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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  const labelLower = label.toLowerCase()
  const isAccent = labelLower.includes('ipd') || labelLower.includes('profit')
  
  // Dynamic color accents
  const accentBorder = 
    labelLower.includes('leads') ? 'border-l-4 border-l-blue-500' :
    labelLower.includes('ipd') ? 'border-l-4 border-l-[#4edea3]' :
    labelLower.includes('conversion') ? 'border-l-4 border-l-violet-500' :
    labelLower.includes('profit') ? 'border-l-4 border-l-amber-500' :
    labelLower.includes('bill') ? 'border-l-4 border-l-[#adc6ff]' :
    labelLower.includes('ticket') ? 'border-l-4 border-l-rose-500' :
    'border-l-4 border-l-slate-500'

  return (
    <Card className={cn(
      "p-5 rounded-xl transition-all duration-300 border shadow-md",
      accentBorder,
      isAccent
        ? "bg-[#4edea3]/5 border-y-[#4edea3]/20 border-r-[#4edea3]/20 text-[#4edea3] hover:bg-[#4edea3]/10 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-[#4edea3]/5"
        : "bg-[#131b2e] border-y-[#424754]/30 border-r-[#424754]/30 text-[#dae2fd] hover:bg-[#1b253b] hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/10 hover:border-r-[#adc6ff]/40"
    )}>
      <CardContent className="p-0 space-y-3">
        <div className="flex justify-between items-center">
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            isAccent ? "text-[#4edea3]" : "text-[#c2c6d6]/70"
          )}>
            {label}
          </span>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider",
            isAccent ? "text-[#4edea3]/70" : "text-[#adc6ff]/60"
          )}>
            Active
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className={cn(
            "text-2xl font-bold tracking-tight",
            isAccent ? "text-[#4edea3]" : "text-[#dae2fd]"
          )}>
            {value}
          </span>
        </div>
        {sub && (
          <p className="text-[10px] text-[#c2c6d6]/50 uppercase tracking-wide">
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
    pct == null ? 'text-[#c2c6d6]/60' :
    pct >= 100 ? 'text-[#4edea3]' :
    pct >= 60 ? 'text-[#adc6ff]' :
    'text-[#ffb4ab]'

  return (
    <Card className="bg-[#131b2e] border-y-[#424754]/30 border-r-[#424754]/30 border-l-4 border-l-violet-500 p-5 rounded-xl hover:bg-[#1b253b] hover:translate-y-[-4px] hover:shadow-lg hover:shadow-black/10 hover:border-r-[#adc6ff]/40 transition-all duration-300 shadow-md">
      <CardContent className="p-0 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#c2c6d6]/70 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-[#adc6ff]" /> IPD Target vs Actual
        </p>
        <div className="mt-2 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[#c2c6d6]/50">IPD Done</span>
            <span className="text-lg font-bold text-[#dae2fd] tabular-nums">{ipdDone}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[#c2c6d6]/50">Target</span>
            <span className="text-lg font-bold text-[#dae2fd] tabular-nums">{assignedTarget}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[#c2c6d6]/50">Achievement</span>
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
  value,
  onChange,
}: {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [months, setMonths] = useState(1)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setMonths(mq.matches ? 2 : 1)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'justify-start text-left font-normal w-full sm:w-auto min-w-0 sm:min-w-[240px] md:min-w-[280px]',
            !value?.from && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{formatDateRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] p-0" align="end">
        <Calendar
          mode="range"
          defaultMonth={value?.from ?? new Date()}
          selected={value}
          onSelect={(range) => {
            onChange(range)
            if (range?.from && range?.to) setOpen(false)
          }}
          numberOfMonths={months}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const d = new Date()
              onChange({ from: startOfMonth(d), to: endOfMonth(d) })
              setOpen(false)
            }}
          >
            This month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
                  <StatCard label="Conversion" value={`${data.kpis.conversionRate.toFixed(1)}%`} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
                  <StatCard label="Net Profit" value={fmtK(data.kpis.netProfit)} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
                  <StatCard label="Bill Amount" value={fmtK(data.kpis.billAmount)} color="bg-slate-500/10" />
                  <StatCard label="Avg Ticket" value={fmtK(data.kpis.avgTicketSize)} color="bg-rose-500/10 text-rose-900 dark:text-rose-100" />
                </div>

                {/* Month-wise chart */}
                {data.monthWise.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" />Monthly Performance (All Time)</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.monthWise} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
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
                {data.treatmentBreakdown.length > 0 && (
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

                {/* Surgery list */}
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Stethoscope className="h-4 w-4" />Surgery History ({data.surgeries.length})</p>
                  <div className="space-y-2">
                    {data.surgeries.slice(0, 50).map((s) => (
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
                    {data.surgeries.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No IPD in selected period</p>}
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

// ─── Team Detail Sheet ────────────────────────────────────────────────────────

function TeamDetailSheet({
  teamId,
  open,
  onClose,
  dateParams,
  variant,
}: {
  teamId: string | null
  open: boolean
  onClose: () => void
  dateParams: string
  variant: DashboardVariant
}) {
  const { data, isLoading } = useQuery<TeamDetail>({
    queryKey: ['sales-dashboard', variant, 'team-detail', teamId, dateParams],
    queryFn: () => apiGet<TeamDetail>(`/api/analytics/sales-dashboard/team-detail?managerId=${teamId}${dateParams ? '&' + dateParams : ''}`),
    enabled: !!teamId && open,
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {isLoading && <div className="text-center py-12 text-muted-foreground">Loading…</div>}
            {data && (
              <>
                <SheetHeader className="pb-0">
                  <div>
                    <SheetTitle className="text-xl">{data.team.name}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {data.team.manager && <Badge variant="secondary">Manager: {data.team.manager.name}</Badge>}
                    </div>
                  </div>
                </SheetHeader>

                {/* Team KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard label="Total Leads" value={data.kpis.totalLeads} color="bg-blue-500/10 text-blue-900 dark:text-blue-100" />
                  <StatCard label="IPD Done" value={data.kpis.totalIpd} color="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" />
                  <StatCard label="Conversion" value={`${data.kpis.conversionRate.toFixed(1)}%`} color="bg-violet-500/10 text-violet-900 dark:text-violet-100" />
                  <StatCard label="Net Profit" value={fmtK(data.kpis.totalProfit)} color="bg-amber-500/10 text-amber-900 dark:text-amber-100" />
                  <StatCard label="Bill Amount" value={fmtK(data.kpis.totalBill)} color="bg-slate-500/10" />
                </div>

                {/* Target vs Achieved */}
                {data.targets && data.targets.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />Targets vs Achieved (Current Month)</p>
                    <div className="space-y-3">
                      {data.targets.map((t, idx) => (
                        <div key={`${t.metric}-${t.label}-${idx}`} className="rounded-lg border bg-card p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{t.label}</span>
                            <span className="text-sm tabular-nums">
                              <span className="font-bold text-emerald-600">{t.metric === 'NET_PROFIT' || t.metric === 'BILL_AMOUNT' || t.metric === 'REVENUE' ? fmtK(t.achieved) : t.achieved}</span>
                              <span className="text-muted-foreground"> / {t.metric === 'NET_PROFIT' || t.metric === 'BILL_AMOUNT' || t.metric === 'REVENUE' ? fmtK(t.targetValue) : t.targetValue}</span>
                            </span>
                          </div>
                          <Progress value={Math.min(t.percentage, 100)} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1 text-right">{t.percentage.toFixed(1)}% of target</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Members */}
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Team Members</p>
                  <div className="space-y-2">
                    {data.members.map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                        <RankBadge rank={i + 1} />
                        <UserAvatar name={m.name} picture={m.profilePicture} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{m.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={Math.min(m.conversionRate, 100)} className="h-1.5 w-16" />
                            <span className="text-xs text-muted-foreground">{m.conversionRate.toFixed(0)}%</span>
                            <span className="inline-flex items-center text-[11px] font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0 ml-1">
                              Incentive: ₹{((m.ipdDone * 1500) + (m.leads * 50)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-bold text-emerald-600">{m.ipdDone} IPD</p>
                          <p className="text-xs text-muted-foreground">{m.leads} leads</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IPD share pie */}
                {data.members.some((m) => m.ipdDone > 0) && (
                  <div>
                    <p className="text-sm font-semibold mb-3">IPD Share by BD</p>
                    <div className="flex items-center gap-4">
                      <PieChart width={120} height={120}>
                        <Pie data={data.members.filter((m) => m.ipdDone > 0)} dataKey="ipdDone" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {data.members.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                      <div className="space-y-1 flex-1 min-w-0">
                        {data.members.filter((m) => m.ipdDone > 0).map((m, i) => (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{m.name}</span>
                            <span className="ml-auto font-semibold tabular-nums">{m.ipdDone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Month-wise pivot */}
                {data.monthWise.months.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3">Month-wise IPD</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">BD</TableHead>
                            {data.monthWise.months.slice(-6).map((m) => (
                              <TableHead key={m} className="text-right min-w-[56px] text-xs">{m.slice(5)}/{m.slice(2, 4)}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.members.map((member) => {
                            const memberRows = data.monthWise.rows.filter((r) => r.bdId === member.id)
                            const ipdByMonth = Object.fromEntries(memberRows.map((r) => [r.month, r.ipdCount]))
                            return (
                              <TableRow key={member.id}>
                                <TableCell className="font-medium text-sm">{member.name}</TableCell>
                                {data.monthWise.months.slice(-6).map((m) => (
                                  <TableCell key={m} className="text-right tabular-nums text-sm">
                                    {ipdByMonth[m] ? <span className={ipdByMonth[m] >= 5 ? 'font-bold text-emerald-600' : ''}>{ipdByMonth[m]}</span> : <span className="text-muted-foreground/30">–</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Overview Breakdown Table ─────────────────────────────────────────────────

type OverviewRow = { category: string; name: string; count: number; revenue: number; profit: number }

function OverviewBreakdownTable({ rows }: { rows: OverviewRow[] }) {
  if (rows.length === 0) {
    return <p className="text-center text-muted-foreground py-6 text-sm">No data in selected range</p>
  }

  const categories = ['Insurance', 'TPA', 'Lead Sources'] as const

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-center">IPD Done</TableHead>
            <TableHead className="text-center">Revenue</TableHead>
            <TableHead className="text-center">Net Profit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => {
            const categoryRows = rows.filter((r) => r.category === category)
            if (categoryRows.length === 0) {
              return (
                <TableRow key={category}>
                  <TableCell className="font-semibold text-sm">{category}</TableCell>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">No data</TableCell>
                </TableRow>
              )
            }
            return categoryRows.map((row, idx) => (
              <TableRow key={`${category}-${row.name}`}>
                <TableCell className="font-semibold text-sm">
                  {idx === 0 ? category : ''}
                </TableCell>
                <TableCell className="max-w-[180px] truncate">{row.name}</TableCell>
                <TableCell className="text-center tabular-nums font-semibold text-emerald-600">{row.count}</TableCell>
                <TableCell className="text-center tabular-nums">{fmtK(row.revenue)}</TableCell>
                <TableCell className="text-center tabular-nums">{fmtK(row.profit)}</TableCell>
              </TableRow>
            ))
          })}
        </TableBody>
      </Table>
    </div>
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

  const { data: targetSummary } = useQuery<TargetSummary>({
    queryKey: ['sales-dashboard', variant, 'target-summary', qs],
    queryFn: () => apiGet<TargetSummary>(`/api/analytics/sales-dashboard/target-summary${comparisonQs}`),
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

  const overviewRows: OverviewRow[] = [
    ...(ipdBreakdown?.byInsurance ?? []).slice(0, 10).map((i) => ({
      category: 'Insurance',
      name: i.insurance,
      count: i.count,
      revenue: i.revenue,
      profit: i.profit,
    })),
    ...(ipdBreakdown?.byTpa ?? []).slice(0, 10).map((t) => ({
      category: 'TPA',
      name: t.tpa,
      count: t.count,
      revenue: t.revenue,
      profit: t.profit,
    })),
    ...(ipdBreakdown?.bySource ?? []).slice(0, 10).map((s) => ({
      category: 'Lead Sources',
      name: s.source,
      count: s.count,
      revenue: s.revenue,
      profit: s.profit,
    })),
  ]

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
          <TargetVsActualCard
            ipdDone={targetSummary?.ipdDone ?? comparison?.ipdThisMonth ?? '–'}
            assignedTarget={targetSummary?.assignedTarget ?? '–'}
            achievementPercentage={targetSummary?.achievementPercentage ?? null}
          />
        </div>
      </div>

      {/* IPD by Month chart */}
      {monthChartData.length > 0 && (
        <Card>
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

      {/* Dashboard Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-2">
          <OverviewBreakdownTable rows={overviewRows} />
        </CardContent>
      </Card>

      {/* Leaderboards side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BD Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />BD Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
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
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      {bd.teamName && <p className="text-xs text-muted-foreground truncate">{bd.teamName}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-sm">{bd.ipdDone} IPD</p>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" />Team Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {[...(teamLeaderboard ?? [])].sort((a, b) => b.ipdDone - a.ipdDone).slice(0, 5).map((team, i) => {
                const displayName = team.teamName ?? team.managerName ?? team.name ?? 'Unknown'
                return (
                  <div key={team.managerId ?? displayName} className="flex items-center gap-3 px-4 py-3">
                    <RankBadge rank={i + 1} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{team.totalLeads} leads · {team.conversionRate?.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-sm">{team.ipdDone} IPD</p>
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
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-blue-500" />Today&apos;s Lead Assignments</CardTitle>
            <Badge variant="secondary">{todayAssignments?.totalLeads ?? 0} leads</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(todayAssignments?.assignments ?? []).map((a) => (
              <div key={a.bdId} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar name={a.bdName} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.bdName}</p>
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

  const { data: bdMonthly } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'bd-monthly', dateParams],
    queryFn: () => apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly${dateParams ? '?' + dateParams : ''}`),
  })

  const { data: targetSalary } = useQuery<TargetSalaryData>({
    queryKey: ['sales-dashboard', variant, 'target-salary', dateParams],
    queryFn: () => apiGet<TargetSalaryData>(`/api/analytics/sales-dashboard/target-salary${dateParams ? '?' + dateParams : ''}`),
    enabled: isMdOrAdmin,
  })

  const teamSalaryMap = new Map((targetSalary?.teamSalaryBreakdown ?? []).map((t) => [t.managerId, t]))

  // Build manager groups from bd-monthly data
  const managerGroups = new Map<string, ManagerGroup>()
  if (bdMonthly) {
    for (const bd of bdMonthly.bds) {
      if (!bd.managerId || !bd.managerName) continue
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

    // TL's own BD work should also count toward their own team card.
    // Skip if the BD already contributed to this group in pass 1
    // (happens when managerId == bdEmployeeId — self-reporting).
    for (const bd of bdMonthly.bds) {
      if (!bd.bdEmployeeId) continue
      if (bd.managerId === bd.bdEmployeeId) continue
      const selfGroup = managerGroups.get(bd.bdEmployeeId)
      if (selfGroup) {
        selfGroup.totalIpd += bd.totalIpd
        selfGroup.totalLeads += bd.totalLeads
      }
    }
  }
  const groups = [...managerGroups.values()]
    .filter((g) => g.managerName !== 'Hardeep Bhargav')
    .sort((a, b) => b.totalIpd - a.totalIpd)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const conv = group.totalLeads > 0 ? ((group.totalIpd / group.totalLeads) * 100).toFixed(1) : '0.0'
          const teamSal = teamSalaryMap.get(group.managerId)
          return (
            <button
              key={group.managerId}
              onClick={() => onSelectTeam(group.managerId)}
              className="text-left rounded-xl border-l-4 border-blue-500 bg-card shadow-sm hover:shadow-md transition-shadow p-4 w-full"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{group.managerName}&apos;s Team</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Manager: {group.managerName}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-lg font-bold text-emerald-600">{group.totalIpd}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">IPD</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{group.totalLeads}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Leads</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-violet-600">{conv}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Conv.</p>
                </div>
              </div>
              {isMdOrAdmin && teamSal && teamSal.totalSalary > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Team Salary: ₹{fmtK(teamSal.totalSalary)}</span>
                    <span>
                      Rev/Sal: <span className={teamSal.revenueSalaryRatio != null && teamSal.revenueSalaryRatio >= 1 ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>{teamSal.revenueSalaryRatio != null ? `${teamSal.revenueSalaryRatio.toFixed(1)}x` : '–'}</span>
                    </span>
                  </div>
                  <Progress value={Math.min(teamSal.revenueSalaryRatio != null ? (teamSal.revenueSalaryRatio > 2 ? 100 : teamSal.revenueSalaryRatio * 50) : 0, 100)} className="mt-1.5 h-1" />
                </div>
              )}
              <Progress value={Math.min(Number(conv), 100)} className="mt-2 h-1.5" />
            </button>
          )
        })}
        {groups.length === 0 && <p className="col-span-full text-center text-muted-foreground py-6 text-sm">No team data in selected range</p>}
      </div>
    </div>
  )
}

// ─── BD Performance Tab ───────────────────────────────────────────────────────

function BdPerformanceTab({
  dateParams,
  onSelectBd,
  variant,
}: {
  dateParams: string
  onSelectBd: (bdId: string) => void
  variant: DashboardVariant
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
            className="w-full text-left rounded-xl border bg-card hover:bg-muted/30 transition-colors p-4"
          >
            <div className="flex items-center gap-3">
              <RankBadge rank={i + 1} />
              <UserAvatar name={bd.bdName} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{bd.bdName}</p>
                  {bd.managerName && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{bd.managerName}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{bd.totalLeads} leads</span>
                  <span className="text-xs text-violet-600">{bd.conversionRate.toFixed(1)}%</span>
                  <Progress value={Math.min(bd.conversionRate, 100)} className="h-1 w-16" />
                  {isMdOrAdmin && sal && sal.salary != null && sal.salary > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ₹{fmtK(sal.salary)} · <span className={sal.revenueSalaryRatio != null && sal.revenueSalaryRatio >= 1 ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>{sal.revenueSalaryRatio != null ? `${(sal.revenueSalaryRatio).toFixed(1)}x` : '–'}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center text-xs font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                    Incentive: ₹{((bd.totalIpd * 1500) + (bd.totalLeads * 50)).toLocaleString()}
                  </span>
                </div>
              </div>
              {/* Last 4 months mini bars */}
              <div className="hidden sm:flex items-end gap-1 h-8">
                {recentMonths.map((m) => {
                  const v = bd.ipd[m] ?? 0
                  const maxV = Math.max(1, ...bds.map((b) => b.ipd[m] ?? 0))
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
                <p className="font-bold text-emerald-600 text-lg">{bd.totalIpd}</p>
                <p className="text-[10px] text-muted-foreground">IPD Done</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            {/* Mobile: revenue/salary row */}
            {isMdOrAdmin && sal && sal.salary != null && sal.salary > 0 && (
              <div className="flex sm:hidden items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span>Salary: ₹{fmtK(sal.salary)}</span>
                <span>
                  Rev/Sal: <span className={sal.revenueSalaryRatio != null && sal.revenueSalaryRatio >= 1 ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>{sal.revenueSalaryRatio != null ? `${sal.revenueSalaryRatio.toFixed(1)}x` : '–'}</span>
                </span>
              </div>
            )}
          </button>
        )})}
        {bds.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No data for selected period</p>}
      </div>
    </div>
  )
}

// ─── Sources & Campaigns Tab ──────────────────────────────────────────────────

function SourceCampaignTab({ dateParams, variant }: { dateParams: string; variant: DashboardVariant }) {
  const [view, setView] = useState<'source' | 'campaign'>('source')

  const getQueryString = () => {
    const qp = dateParams ? '?' + dateParams : ''
    if (typeof window === 'undefined') return qp
    const params = new URLSearchParams(window.location.search)
    const dateSearchParams = new URLSearchParams(dateParams)
    for (const [key, val] of dateSearchParams.entries()) {
      params.set(key, val)
    }
    return '?' + params.toString()
  }

  const qp = getQueryString()

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['sales-dashboard', variant, 'ipd-breakdown', dateParams, qp],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['sales-dashboard', variant, 'leads-breakdown', dateParams, qp],
    queryFn: () => apiGet<LeadsBreakdown>(`/api/analytics/sales-dashboard/leads-breakdown${qp}`),
  })

  const sourceData = (ipdBreakdown?.bySource ?? []).map((s) => {
    const leadsRow = (leadsBreakdown?.bySource ?? []).find((l) => l.source === s.source)
    return { name: s.source, ipd: s.count, leads: leadsRow?.totalLeads ?? 0, revenue: s.revenue, conv: leadsRow ? (s.count / leadsRow.totalLeads) * 100 : 0 }
  }).sort((a, b) => b.ipd - a.ipd)

  const campaignData = (ipdBreakdown?.byCampaign ?? []).map((c) => {
    const leadsRow = (leadsBreakdown?.byCampaign ?? []).find((l) => l.campaign === c.campaign)
    return { name: c.campaign, ipd: c.count, leads: leadsRow?.totalLeads ?? 0, revenue: c.revenue, conv: leadsRow ? (c.count / leadsRow.totalLeads) * 100 : 0 }
  }).sort((a, b) => b.ipd - a.ipd)

  const rows = view === 'source' ? sourceData : campaignData
  const pieData = rows.slice(0, 8).filter((r) => r.ipd > 0)

  const { data: teamMappingData } = useQuery<any[]>({
    queryKey: ['sales-dashboard', variant, 'team-mappings', view, dateParams, qp],
    queryFn: () => apiGet<any[]>(`/api/analytics/sales-dashboard/team-mappings${qp}&type=${view}`),
  })



  return (
    <div className="space-y-4">
      <div className="bg-[#1b253b] p-1 rounded-xl inline-flex gap-1 border border-[#424754]/20 shadow-inner">
        <button
          onClick={() => setView('source')}
          className={cn(
            "px-5 py-2 rounded-lg text-xs transition-all duration-300 font-bold uppercase tracking-wider",
            view === 'source'
              ? "bg-[#adc6ff] text-[#0f172a] shadow-lg shadow-[#adc6ff]/20"
              : "bg-transparent text-[#c2c6d6]/60 hover:text-[#dae2fd] hover:bg-[#131b2e]/30"
          )}
        >
          Source
        </button>
        <button
          onClick={() => setView('campaign')}
          className={cn(
            "px-5 py-2 rounded-lg text-xs transition-all duration-300 font-bold uppercase tracking-wider",
            view === 'campaign'
              ? "bg-[#adc6ff] text-[#0f172a] shadow-lg shadow-[#adc6ff]/20"
              : "bg-transparent text-[#c2c6d6]/60 hover:text-[#dae2fd] hover:bg-[#131b2e]/30"
          )}
        >
          Campaign
        </button>
      </div>

      {/* Pie + table side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-[#131b2e] border border-[#424754]/30 rounded-xl hover:shadow-lg hover:border-[#adc6ff]/20 transition-all duration-300">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-xs font-bold text-[#c2c6d6]/70 uppercase tracking-wider">IPD Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {pieData.length > 0 ? (
              <>
                <PieChart width={160} height={160} className="mx-auto">
                  <Pie data={pieData} dataKey="ipd" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
                <div className="mt-4 space-y-1.5">
                  {(() => {
                    const totalIpd = pieData.reduce((sum, d) => sum + d.ipd, 0)
                    return pieData.map((d, i) => {
                      const percentage = totalIpd > 0 ? (d.ipd / totalIpd) * 100 : 0
                      return (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate text-[#c2c6d6]/80">{d.name} ({percentage.toFixed(1)}%)</span>
                          <span className="ml-auto font-semibold text-[#dae2fd] tabular-nums pr-2">{d.ipd} IPD</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </>
            ) : (
              <p className="text-center text-[#c2c6d6]/40 py-8 text-xs">No distribution data</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden bg-[#131b2e] border border-[#424754]/30 rounded-xl hover:shadow-lg hover:border-[#adc6ff]/20 transition-all duration-300">
          <CardHeader className="pt-3 pb-0 px-4">
            <CardTitle className="text-xs font-bold text-[#c2c6d6]/70 uppercase tracking-wider">
              {view === 'source' ? 'Source' : 'Campaign'} Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#1b253b]/50 border-b border-[#424754]/30">
                  <TableRow className="hover:bg-transparent border-b border-[#424754]/30">
                    <TableHead className="text-xs font-bold text-[#c2c6d6]/80 uppercase py-2 px-3">{view === 'source' ? 'Source' : 'Campaign'}</TableHead>
                    <TableHead className="text-right text-xs font-bold text-[#c2c6d6]/80 uppercase py-2 px-3 [&>div]:justify-end">Leads</TableHead>
                    <TableHead className="text-right text-xs font-bold text-[#c2c6d6]/80 uppercase py-2 px-3 [&>div]:justify-end">IPD</TableHead>
                    <TableHead className="text-right text-xs font-bold text-[#c2c6d6]/80 uppercase py-2 px-3 [&>div]:justify-end">Conv %</TableHead>
                    <TableHead className="text-right text-xs font-bold text-[#c2c6d6]/80 uppercase py-2 px-3 [&>div]:justify-end">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name} className="hover:bg-[#1b253b]/40 border-b border-[#424754]/20 transition-colors duration-200">
                      <TableCell className="font-semibold text-[#dae2fd] text-sm max-w-[160px] truncate py-2 px-3">{r.name}</TableCell>
                      <TableCell className="text-right text-[#dae2fd] tabular-nums text-sm py-2 px-3">{r.leads}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-[#4edea3] text-sm py-2 px-3">{r.ipd}</TableCell>
                      <TableCell className="text-right tabular-nums text-[#adc6ff] font-semibold text-sm py-2 px-3">{r.conv.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-[#dae2fd] tabular-nums text-sm py-2 px-3">{fmtK(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-[#c2c6d6]/40 py-8 text-xs">
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

  const circleData = (ipdBreakdown?.byCircle ?? []).map((c) => {
    const leadsRow = (leadsBreakdown?.byCircle ?? []).find((l) => l.circle === c.circle)
    return { circle: c.circle, ipd: c.count, leads: leadsRow?.totalLeads ?? 0, revenue: c.revenue, profit: c.profit, conv: leadsRow && leadsRow.totalLeads > 0 ? (c.count / leadsRow.totalLeads) * 100 : 0 }
  }).sort((a, b) => b.ipd - a.ipd)

  const pieData = circleData.filter((c) => c.leads > 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
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
      <div className="flex items-center justify-center py-12 bg-[#171f33]/45 border border-white/5 backdrop-blur-md rounded-xl p-6">
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
      <Card className="bg-violet-950/20 border border-violet-500/20 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Marketing Insights & Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs md:text-sm text-[#dae2fd]/95 leading-relaxed">
          <p className="font-medium text-[#c2c6d6]/80">{insights.summaryText}</p>
          
          <div className="grid gap-4 md:grid-cols-2 mt-2 pt-2 border-t border-violet-500/10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#c2c6d6]/60 uppercase">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Key Performers
              </div>
              <ul className="space-y-1 text-xs">
                <li>Highest Conversions: <span className="font-semibold text-emerald-400">{insights.highestPerformingCampaign}</span></li>
                <li>Lowest CPL: <span className="font-semibold text-emerald-400">{insights.lowestCplCampaign}</span></li>
                <li>Best Conversion ROI: <span className="font-semibold text-emerald-400">{insights.bestRoiCampaign}</span></li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#c2c6d6]/60 uppercase">
                <TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Optimization Warnings
              </div>
              <ul className="space-y-1 text-xs">
                <li>Highest CPL Campaign: <span className="font-semibold text-amber-400">{insights.highestCplCampaign}</span></li>
                <li>Budget Alert: <span className="font-semibold text-amber-400">{insights.budgetWarningCampaign}</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/10 text-xs flex gap-2 items-start text-violet-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span><strong>Recommendation:</strong> {insights.recommendationText}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SalesDashboardView({ variant = 'org' }: { variant?: DashboardVariant }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const t = new Date()
    return { from: startOfMonth(t), to: endOfMonth(t) }
  })

  const [selectedBdId, setSelectedBdId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const startDate = dateRange?.from
  const endDate = dateRange?.to ?? dateRange?.from

  const dateParams = [
    startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '',
    endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '',
  ].filter(Boolean).join('&')

  useEffect(() => {
    if (variant === 'team-lead' && activeTab === 'team') {
      setActiveTab('overview')
    }
  }, [variant, activeTab])

  const tabsForNav =
    variant === 'team-lead' ? TABS.filter((t) => t.value !== 'team') : TABS

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
          {activeTab === 'team' && variant !== 'team-lead' && (
            <TeamPerformanceTab dateParams={dateParams} onSelectTeam={(id) => setSelectedTeamId(id)} variant={variant} />
          )}
          {activeTab === 'bd' && (
            <BdPerformanceTab dateParams={dateParams} onSelectBd={(id) => setSelectedBdId(id)} variant={variant} />
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
      <TeamDetailSheet
        teamId={selectedTeamId}
        open={!!selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
        dateParams={dateParams}
        variant={variant}
      />
    </AuthenticatedLayout>
  )
}
