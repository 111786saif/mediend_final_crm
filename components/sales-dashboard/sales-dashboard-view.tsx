'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { TabNavigation } from '@/components/employee/tab-navigation'
import { format } from 'date-fns'
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
  Users,
  Stethoscope,
  BarChart3,
  Target,
  ChevronRight,
  ArrowUpDown,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

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
  surgeries: Array<{ id: string; patientName: string; treatment: string; hospitalName: string; surgeonName: string | null; date: string; billAmount: number; netProfit: number; circle: string }>
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
  byMonth: Array<{ month: string; count: number; revenue: number; profit: number }>
  surgeonCrossAnalysis: Array<{ surgeonName: string; hospitalName: string; treatment: string; count: number; revenue: number; profit: number }>
}

interface LeadsBreakdown {
  byCircle: Array<{ circle: string; totalLeads: number; converted: number; conversionRate: number }>
  bySource: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number }>
  byCampaign: Array<{ campaign: string; totalLeads: number; converted: number; conversionRate: number }>
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
  return (
    <Card className={`${color} border-0`}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium opacity-75">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Date Picker ─────────────────────────────────────────────────────────────

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
                            <p className="text-xs text-muted-foreground">{format(new Date(s.date), 'dd MMM yy')}</p>
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
                      {data.targets.map((t) => (
                        <div key={t.metric} className="rounded-lg border bg-card p-3">
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

      {/* Leaderboards side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BD Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />BD Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(bdLeaderboard ?? []).slice(0, 10).map((bd, i) => {
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
              {(teamLeaderboard ?? []).slice(0, 8).map((team, i) => {
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
  const { data: bdMonthly } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'bd-monthly', dateParams],
    queryFn: () => apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly${dateParams ? '?' + dateParams : ''}`),
  })

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
  const groups = [...managerGroups.values()].sort((a, b) => b.totalIpd - a.totalIpd)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => {
          const conv = group.totalLeads > 0 ? ((group.totalIpd / group.totalLeads) * 100).toFixed(1) : '0.0'
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

  const { data: bdMonthly } = useQuery<BdMonthly>({
    queryKey: ['sales-dashboard', variant, 'bd-monthly', dateParams],
    queryFn: () => apiGet<BdMonthly>(`/api/analytics/sales-dashboard/bd-monthly${dateParams ? '?' + dateParams : ''}`),
  })

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
        {bds.map((bd, i) => (
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
          </button>
        ))}
        {bds.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No data for selected period</p>}
      </div>
    </div>
  )
}

// ─── Sources & Campaigns Tab ──────────────────────────────────────────────────

function SourceCampaignTab({ dateParams, variant }: { dateParams: string; variant: DashboardVariant }) {
  const [view, setView] = useState<'source' | 'campaign'>('source')
  const qp = dateParams ? '?' + dateParams : ''

  const { data: ipdBreakdown } = useQuery<IpdBreakdown>({
    queryKey: ['sales-dashboard', variant, 'ipd-breakdown', dateParams],
    queryFn: () => apiGet<IpdBreakdown>(`/api/analytics/sales-dashboard/ipd-breakdown${qp}`),
  })

  const { data: leadsBreakdown } = useQuery<LeadsBreakdown>({
    queryKey: ['sales-dashboard', variant, 'leads-breakdown', dateParams],
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

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'source' ? 'default' : 'outline'} onClick={() => setView('source')}>Source</Button>
        <Button size="sm" variant={view === 'campaign' ? 'default' : 'outline'} onClick={() => setView('campaign')}>Campaign</Button>
      </div>

      {/* Pie + table side by side on large screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">IPD Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <PieChart width={160} height={160} className="mx-auto">
                  <Pie data={pieData} dataKey="ipd" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
                <div className="mt-3 space-y-1.5">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-semibold tabular-nums">{d.ipd}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-muted-foreground py-8 text-sm">No data</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{view === 'source' ? 'Source' : 'Campaign'} Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{view === 'source' ? 'Source' : 'Campaign'}</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">IPD</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium max-w-[160px] truncate">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600">{r.ipd}</TableCell>
                      <TableCell className="text-right tabular-nums text-violet-600">{r.conv.toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(r.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SalesDashboardView({ variant = 'org' }: { variant?: DashboardVariant }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date())

  const [selectedBdId, setSelectedBdId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

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
            <DateRangePicker startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
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
