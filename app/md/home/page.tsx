'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useBadgeCounts } from '@/hooks/use-badge-counts'
import { StatCard } from '@/components/ui/stat-card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { format, subMonths, startOfMonth } from 'date-fns'
import {
  Calendar,
  Clock,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  AlertTriangle,
  Trophy,
  MapPin,
  FileCheck,
  UserCheck,
  Briefcase,
  ArrowRight,
} from 'lucide-react'
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
  ComposedChart,
  Line,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesKpis {
  totalRevenue: number
  totalProfit: number
  totalLeads: number
  completedSurgeries: number
  conversionRate: number
  avgTicketSize: number
  avgNetProfitPerSurgery: number
}

interface CirclePerf {
  circle: string
  revenue: number
  profit: number
  surgeries: number
  leads: number
  conversionRate: number
  avgTicketSize: number
}

interface DiseasePerf {
  disease: string
  count: number
  revenue: number
  profit: number
}

interface TeamPerf {
  teamName: string
  revenue: number
  profit: number
  closedLeads: number
  totalLeads: number
  conversionRate: number
}

interface BdPerf {
  bdId: string
  bdName: string
  teamName: string
  revenue: number
  profit: number
  closedLeads: number
  totalLeads: number
  conversionRate: number
}

interface TrendItem {
  date: string
  revenue: number
  profit: number
  surgeries: number
}

interface SalesData {
  kpis: SalesKpis
  circlePerformance: CirclePerf[]
  diseasePerformance: DiseasePerf[]
  teamPerformance: TeamPerf[]
  bdPerformance: BdPerf[]
  revenueProfitTrends: TrendItem[]
}

interface HrKpis {
  todayStrength: number
  totalHeadcount: number
  monthlySalaryOutgo: number
  latecomersCountToday: number
  absentCountToday: number
  newJoinersCount: number
  pendingLeaveCount: number
  openTicketsCount: number
}

interface HrData {
  kpis: HrKpis
}

interface HeadTarget {
  head: {
    id: string
    name: string
    role: string
    profilePicture: string | null
    departmentLabel: string
  }
  activeTarget: {
    id: string
    metric: string
    targetValue: number
    periodType: string
  } | null
  achievement: {
    actual: number
    targetValue: number
    percentage: number
    metric: string
  }
}

interface HomeMeet {
  id: string
  title: string
  scheduledAt: string
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink: string | null
  module: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatMetricValue(metric: string, value: number, target: number) {
  if (metric === 'REVENUE' || metric === 'NET_PROFIT' || metric === 'BILL_AMOUNT') {
    return `${formatCurrency(value)} / ${formatCurrency(target)}`
  }
  return `${value} / ${target}`
}

function getMetricLabel(metric: string) {
  switch (metric) {
    case 'IPD_DONE': return 'IPD Done'
    case 'HEAD_COUNT': return 'New Hires'
    case 'LEADS_GENERATED': return 'Leads'
    case 'REVENUE': return 'Revenue'
    case 'NET_PROFIT': return 'Net Profit'
    case 'SURGERIES_DONE': return 'Surgeries'
    case 'BILL_AMOUNT': return 'Bill Amount'
    default: return metric
  }
}

// ─── Morning Briefing ────────────────────────────────────────────────────────

function MorningBriefing({
  firstName,
  salesKpis,
  badgeCounts,
  meetsCount,
}: {
  firstName: string
  salesKpis?: SalesKpis
  badgeCounts: Record<string, number> | undefined
  meetsCount: number
}) {
  const totalApprovals =
    (badgeCounts?.pendingFinanceApprovals ?? 0) +
    (badgeCounts?.pendingTaskReviews ?? 0) +
    (badgeCounts?.pendingMDApprovals ?? 0) +
    (badgeCounts?.pendingDueDateApprovals ?? 0)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-purple-500/5 p-5 md:p-6 shadow-sm">
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight mt-1">
              {getGreeting()}, {firstName}
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Command Center
          </div>
        </div>

        {salesKpis && (
          <p className="text-sm text-muted-foreground mt-2">
            <span className="font-semibold text-foreground">{salesKpis.completedSurgeries}</span> surgeries completed
            {' · '}
            <span className="font-semibold text-foreground">{formatCurrency(salesKpis.totalRevenue)}</span> revenue this month
            {' · '}
            <span className="font-semibold text-foreground">{(salesKpis.conversionRate).toFixed(1)}%</span> conversion
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {totalApprovals > 0 && (
            <Link
              href="/md/approvals"
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium px-3 py-1"
            >
              <FileCheck className="h-3 w-3" />
              {totalApprovals} pending approvals
            </Link>
          )}
          {(badgeCounts?.myOverdueTasks ?? 0) > 0 && (
            <Link
              href="/md/tasks"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium px-3 py-1"
            >
              <AlertTriangle className="h-3 w-3" />
              {badgeCounts?.myOverdueTasks} overdue tasks
            </Link>
          )}
          {meetsCount > 0 && (
            <Link
              href="/meets"
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1"
            >
              <Calendar className="h-3 w-3" />
              {meetsCount} meetings today
            </Link>
          )}
          {(badgeCounts?.unreadMessages ?? 0) > 0 && (
            <Link
              href="/md/anonymous-messages"
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium px-3 py-1"
            >
              {badgeCounts?.unreadMessages} unread messages
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Revenue & Surgery Trend Chart ───────────────────────────────────────────

function RevenueTrendChart({ trends }: { trends: TrendItem[] }) {
  const monthlyData = useMemo(() => {
    const grouped: Record<string, { month: string; revenue: number; surgeries: number }> = {}
    for (const t of trends) {
      const key = t.date.slice(0, 7) // YYYY-MM
      if (!grouped[key]) {
        grouped[key] = { month: key, revenue: 0, surgeries: 0 }
      }
      grouped[key].revenue += t.revenue
      grouped[key].surgeries += t.surgeries
    }
    return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month))
  }, [trends])

  if (monthlyData.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-10">No trend data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => {
            const [, m] = v.split('-')
            const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return months[parseInt(m)] || v
          }}
        />
        <YAxis
          yAxisId="revenue"
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
        />
        <YAxis
          yAxisId="surgeries"
          orientation="right"
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
          formatter={(v: number, name: string) =>
            name === 'Revenue' ? [`₹${(v / 100000).toFixed(1)}L`, name] : [v, name]
          }
          labelFormatter={(l) => {
            const [y, m] = l.split('-')
            const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            return `${months[parseInt(m)]} ${y}`
          }}
        />
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3, fill: '#3b82f6' }}
          name="Revenue"
        />
        <Line
          yAxisId="surgeries"
          type="monotone"
          dataKey="surgeries"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3, fill: '#8b5cf6' }}
          name="Surgeries"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Circle Performance Chart ────────────────────────────────────────────────

function CircleChart({ circles }: { circles: CirclePerf[] }) {
  const top = useMemo(() => [...circles].sort((a, b) => b.revenue - a.revenue).slice(0, 6), [circles])

  if (top.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-10">No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
        <YAxis type="category" dataKey="circle" tick={{ fontSize: 10 }} width={80} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [`₹${(v / 100000).toFixed(1)}L`, 'Revenue']}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
          {top.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Surgery Type Mix ────────────────────────────────────────────────────────

function SurgeryMixChart({ diseases }: { diseases: DiseasePerf[] }) {
  const top = useMemo(() => [...diseases].sort((a, b) => b.revenue - a.revenue).slice(0, 6), [diseases])

  if (top.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-10">No data</div>
  }

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={top}
            dataKey="revenue"
            nameKey="disease"
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={35}
          >
            {top.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number) => [`₹${(v / 100000).toFixed(1)}L`, 'Revenue']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
        {top.map((d, i) => (
          <span key={d.disease} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            {d.disease}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Data Highlights ─────────────────────────────────────────────────────────

function DataHighlights({
  circles,
  teams,
  bds,
  diseases,
}: {
  circles: CirclePerf[]
  teams: TeamPerf[]
  bds: BdPerf[]
  diseases: DiseasePerf[]
}) {
  const highlights: { icon: React.ReactNode; title: string; text: string; color: string; href?: string }[] = []

  // Top circle
  const topCircle = [...circles].sort((a, b) => b.revenue - a.revenue)[0]
  if (topCircle) {
    highlights.push({
      icon: <MapPin className="h-4 w-4" />,
      title: 'Top Circle',
      text: `${topCircle.circle} — ${formatCurrency(topCircle.revenue)} revenue, ${topCircle.surgeries} surgeries`,
      color: 'text-blue-600 dark:text-blue-400',
      href: '/md/sales',
    })
  }

  // Top BD
  const topBd = [...bds].sort((a, b) => b.revenue - a.revenue)[0]
  if (topBd) {
    highlights.push({
      icon: <Trophy className="h-4 w-4" />,
      title: 'Top BD Performer',
      text: `${topBd.bdName} (${topBd.teamName}) — ${formatCurrency(topBd.revenue)}, ${topBd.closedLeads} closed`,
      color: 'text-emerald-600 dark:text-emerald-400',
      href: '/md/sales',
    })
  }

  // Best converting team
  const bestTeam = [...teams].filter(t => t.totalLeads > 0).sort((a, b) => b.conversionRate - a.conversionRate)[0]
  if (bestTeam) {
    highlights.push({
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'Best Conversion',
      text: `${bestTeam.teamName} — ${bestTeam.conversionRate.toFixed(1)}% conversion, ${formatCurrency(bestTeam.revenue)} revenue`,
      color: 'text-purple-600 dark:text-purple-400',
      href: '/md/sales',
    })
  }

  // Loss-making treatment
  const lossDiseases = diseases.filter(d => d.profit < 0)
  if (lossDiseases.length > 0) {
    const worst = lossDiseases.sort((a, b) => a.profit - b.profit)[0]
    highlights.push({
      icon: <TrendingDown className="h-4 w-4" />,
      title: 'Negative Margin Alert',
      text: `${worst.disease} — ${formatCurrency(worst.profit)} profit on ${worst.count} cases`,
      color: 'text-red-600 dark:text-red-400',
      href: '/md/pnl',
    })
  }

  if (highlights.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Data Highlights
        </h3>
      </div>
      <div className="divide-y divide-border max-h-[340px] overflow-y-auto">
        {highlights.map((h, i) => (
          <div key={i} className="px-4 py-3">
            <div className={`flex items-center gap-2 text-xs font-semibold ${h.color} mb-1`}>
              {h.icon}
              {h.title}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{h.text}</p>
            {h.href && (
              <Link href={h.href} className="text-[10px] text-primary font-medium hover:underline mt-1 inline-flex items-center gap-0.5">
                View details <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pending Approvals Card ──────────────────────────────────────────────────

function PendingApprovalsCard({ badgeCounts }: { badgeCounts: Record<string, number> | undefined }) {
  const items = [
    { label: 'Finance approvals', count: badgeCounts?.pendingFinanceApprovals ?? 0, href: '/md/approvals', color: 'bg-amber-500' },
    { label: 'Task reviews', count: badgeCounts?.pendingTaskReviews ?? 0, href: '/md/tasks#approval', color: 'bg-blue-500' },
    { label: 'MD approvals', count: badgeCounts?.pendingMDApprovals ?? 0, href: '/md/md-approvals', color: 'bg-purple-500' },
    { label: 'Due date requests', count: badgeCounts?.pendingDueDateApprovals ?? 0, href: '/md/tasks#approval', color: 'bg-orange-500' },
    { label: 'Leave requests', count: badgeCounts?.pendingLeaveApprovals ?? 0, href: '/md/attendance', color: 'bg-teal-500' },
  ]

  const total = items.reduce((s, i) => s + i.count, 0)

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-primary" />
          Pending Approvals
        </h3>
        {total > 0 && (
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{total}</span>
        )}
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className={`text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full text-white px-1.5 ${item.count > 0 ? item.color : 'bg-muted-foreground/30'}`}>
              {item.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Department Head Targets ─────────────────────────────────────────────────

function DeptHeadTargets({ targets }: { targets: HeadTarget[] }) {
  const active = targets.filter((t) => t.activeTarget && t.achievement.targetValue > 0)
  if (active.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Dept Head Targets
        </h3>
        <Link href="/md/targets" className="text-xs font-medium text-primary hover:underline">View all</Link>
      </div>
      <div className="divide-y divide-border">
        {active.map((t) => {
          const pct = Math.min(t.achievement.percentage, 100)
          const isGood = pct >= 75
          const isWarning = pct >= 40 && pct < 75
          return (
            <div key={t.head.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <p className="text-xs font-semibold">{t.head.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.head.departmentLabel} · {getMetricLabel(t.achievement.metric)}</p>
                </div>
                <span className={`text-xs font-bold ${isGood ? 'text-emerald-600 dark:text-emerald-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.achievement.percentage.toFixed(0)}%
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatMetricValue(t.achievement.metric, t.achievement.actual, t.achievement.targetValue)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Today's Meetings ────────────────────────────────────────────────────────

function TodaysMeetsSection({ meets }: { meets: HomeMeet[] }) {
  if (meets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground shadow-sm">
        No meetings scheduled for today.{' '}
        <Link href="/meets" className="text-primary font-medium hover:underline">
          View all meets
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Today&apos;s Meets
        </h3>
        <Link href="/meets" className="text-xs font-medium text-primary hover:underline">All meets</Link>
      </div>
      <ul className="divide-y divide-border max-h-[240px] overflow-y-auto">
        {meets.map((m) => (
          <li key={m.id} className="px-4 py-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{m.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {format(new Date(m.scheduledAt), 'h:mm a')}
                {m.module === 'INTERVIEW' && <span className="text-violet-600 dark:text-violet-400"> · Interview</span>}
                {m.module === 'MD_APPOINTMENT' && <span className="text-amber-600 dark:text-amber-400"> · MD</span>}
              </p>
            </div>
            {m.meetLink && (
              <Button size="sm" className="h-7 rounded-lg text-[10px] shrink-0" asChild>
                <a href={m.meetLink} target="_blank" rel="noreferrer">
                  Join <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── HR Pulse ────────────────────────────────────────────────────────────────

function HRPulseCard({ hrKpis }: { hrKpis: HrKpis }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          HR Pulse
        </h3>
        <Link href="/md/hr" className="text-xs font-medium text-primary hover:underline">View HR</Link>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {hrKpis.todayStrength}<span className="text-xs font-normal text-muted-foreground"> / {hrKpis.totalHeadcount}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">Present Today</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{hrKpis.absentCountToday}</p>
          <p className="text-[10px] text-muted-foreground">Absent</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{hrKpis.latecomersCountToday}</p>
          <p className="text-[10px] text-muted-foreground">Late Today</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{hrKpis.newJoinersCount}</p>
          <p className="text-[10px] text-muted-foreground">New Joiners</p>
        </div>
      </div>
      <div className="px-4 pb-3 flex gap-2">
        <Link
          href="/md/attendance"
          className="flex-1 text-center text-[10px] font-medium text-primary bg-primary/5 rounded-lg py-1.5 hover:bg-primary/10 transition-colors"
        >
          Attendance
        </Link>
        <Link
          href="/md/leave-balances"
          className="flex-1 text-center text-[10px] font-medium text-primary bg-primary/5 rounded-lg py-1.5 hover:bg-primary/10 transition-colors"
        >
          Leaves ({hrKpis.pendingLeaveCount})
        </Link>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ''}`} />
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">
      <Skeleton className="h-[140px] rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[80px]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-3 h-[340px]" />
        <Skeleton className="lg:col-span-2 h-[340px]" />
      </div>
    </div>
  )
}

// ─── Chart Card Wrapper ──────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MDHomePage() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const { data: badgeCounts } = useBadgeCounts()

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')

  // 6-month range for trend chart
  const trendStart = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd')

  // Sales data — current month for KPIs
  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData>({
    queryKey: ['md-home-sales', monthStart, monthEnd],
    queryFn: () => apiGet<SalesData>(`/api/analytics/md/sales?startDate=${monthStart}&endDate=${monthEnd}`),
    staleTime: 5 * 60 * 1000,
  })

  // Sales data — 6 months for trend chart
  const { data: trendData } = useQuery<SalesData>({
    queryKey: ['md-home-sales-trend', trendStart, monthEnd],
    queryFn: () => apiGet<SalesData>(`/api/analytics/md/sales?startDate=${trendStart}&endDate=${monthEnd}`),
    staleTime: 5 * 60 * 1000,
  })

  // HR data
  const { data: hrData, isLoading: hrLoading } = useQuery<HrData>({
    queryKey: ['md-home-hr'],
    queryFn: () => apiGet<HrData>('/api/analytics/md/hr'),
    staleTime: 5 * 60 * 1000,
  })

  // Meets
  const { data: meets = [] } = useQuery<HomeMeet[]>({
    queryKey: ['meets-today-md-home'],
    queryFn: () => apiGet<HomeMeet[]>('/api/meets?today=true'),
  })

  // Head targets
  const { data: headTargets = [] } = useQuery<HeadTarget[]>({
    queryKey: ['md-home-head-targets'],
    queryFn: () => apiGet<HeadTarget[]>('/api/md/head-targets'),
    staleTime: 5 * 60 * 1000,
  })

  if (salesLoading && hrLoading) {
    return <PageSkeleton />
  }

  const kpis = salesData?.kpis

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto w-full">
      {/* Morning Briefing */}
      <MorningBriefing
        firstName={firstName}
        salesKpis={kpis}
        badgeCounts={badgeCounts as Record<string, number> | undefined}
        meetsCount={meets.length}
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Revenue (Month)"
          value={kpis ? formatCurrency(kpis.totalRevenue) : '—'}
          accent="blue"
          valueAccent
          href="/md/sales"
        />
        <StatCard
          label="Surgeries"
          value={kpis?.completedSurgeries ?? '—'}
          accent="green"
          valueAccent
          href="/md/sales"
        />
        <StatCard
          label="Avg Ticket Size"
          value={kpis ? formatCurrency(kpis.avgTicketSize) : '—'}
          accent="orange"
          href="/md/pnl"
        />
        <StatCard
          label="Conversion Rate"
          value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : '—'}
          accent="purple"
          href="/md/sales"
        />
        <StatCard
          label="Team Size"
          value={hrData?.kpis.totalHeadcount ?? '—'}
          accent="teal"
          href="/md/hr"
        />
        <StatCard
          label="Active Circles"
          value={salesData?.circlePerformance.length ?? '—'}
          accent="amber"
          href="/md/sales"
        />
      </div>

      {/* Charts + Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Charts */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <ChartCard title="Revenue & Surgery Trend (6M)">
            {trendData?.revenueProfitTrends ? (
              <RevenueTrendChart trends={trendData.revenueProfitTrends} />
            ) : (
              <Skeleton className="h-[240px]" />
            )}
          </ChartCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChartCard title="Circle Performance">
              {salesData?.circlePerformance ? (
                <CircleChart circles={salesData.circlePerformance} />
              ) : (
                <Skeleton className="h-[180px]" />
              )}
            </ChartCard>
            <ChartCard title="Surgery Type Mix">
              {salesData?.diseasePerformance ? (
                <SurgeryMixChart diseases={salesData.diseasePerformance} />
              ) : (
                <Skeleton className="h-[180px]" />
              )}
            </ChartCard>
          </div>
        </div>

        {/* Right: Highlights + Approvals */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {salesData && (
            <DataHighlights
              circles={salesData.circlePerformance}
              teams={salesData.teamPerformance}
              bds={salesData.bdPerformance}
              diseases={salesData.diseasePerformance}
            />
          )}
          <PendingApprovalsCard badgeCounts={badgeCounts as Record<string, number> | undefined} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DeptHeadTargets targets={headTargets} />
        <TodaysMeetsSection meets={meets} />
        {hrData && <HRPulseCard hrKpis={hrData.kpis} />}
      </div>
    </div>
  )
}
