'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState, useMemo } from 'react'
import {
  Users,
  UserCheck,
  Wallet,
  MessageSquare,
  Clock,
  Calendar,
  AlertTriangle,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts'
import { HRDashboardRecruitmentStrip } from '@/components/hr/hr-dashboard-recruitment-strip'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface HRAnalytics {
  kpis: {
    todayStrength: number
    totalHeadcount: number
    monthlySalaryOutgo: number
    openTicketsCount: number
    avgTicketResponseHours: number | null
    pendingLeaveCount: number
    hasPayrollData: boolean
    latecomersCountToday: number
    absentCountToday: number
    newJoinersCount: number
  }
  departmentSalaryBreakdown: Array<{ departmentName: string; amount: number }>
  teamSalaryBreakdown: Array<{ teamName: string; amount: number }>
  departmentHeadcount: Array<{ departmentName: string; count: number }>
  ticketAnalytics: Array<{
    type: string
    targetRole: string | null
    totalInMonth: number
    resolvedCount: number
    avgResponseHours: number | null
    slaCompliancePercent: number | null
  }>
  latecomersToday: Array<{
    employeeId: string
    employeeName: string
    employeeCode: string
    departmentName: string
    punchTime: string
    minutesLate: number
  }>
  monthlyLateArrivals: Array<{
    employeeId: string
    employeeName: string
    employeeCode: string
    departmentName: string
    lateCount: number
  }>
  absentToday: Array<{
    employeeName: string
    employeeCode: string
    departmentName: string
  }>
  newJoiners: Array<{
    employeeName: string
    employeeCode: string
    departmentName: string
    joinDate: string
  }>
  month: number
  year: number
}

const CHART_PALETTE = ['#3b82f6', '#8b5cf6', '#6366f1', '#4f46e5', '#7c3aed', '#a855f7', '#ec4899', '#06b6d4']

const LATE_THRESHOLD_MINUTES = 11 * 60 // 11:00 AM

interface AttendanceRecord {
  employee: { id: string; employeeCode: string; user: { name: string }; department: { name: string } | null }
  date: string
  inTime: Date | string | null
  outTime: Date | string | null
  workHours: number | null
  isLate: boolean
}

interface AttendanceData {
  data: AttendanceRecord[]
  pagination: { total: number }
}

interface EmployeeItem {
  id: string
  employeeCode: string
  user: { name: string }
  department: { name: string } | null
}

function formatPunchTime(d: Date | string | null): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function getMinutesLate(inTime: Date | string | null): number {
  if (!inTime) return 0
  const d = typeof inTime === 'string' ? new Date(inTime) : inTime
  const total = d.getUTCHours() * 60 + d.getUTCMinutes()
  return Math.max(0, total - LATE_THRESHOLD_MINUTES)
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatCurrencyFull(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatHours(h: number | null) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(1)} hrs`
}

interface HRDashboardProps {
  title?: string
  description?: string
}

interface KpiCardProps {
  title: string
  value: string
  sub: string
  color: string
  icon: React.ReactNode
}

function KpiCard({ title, value, sub, color, icon }: KpiCardProps) {
  return (
    <Card className={`border-l-4 ${color} bg-card`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <CardTitle className="text-xs sm:text-sm font-medium leading-tight">{title}</CardTitle>
        <div className="shrink-0 ml-2">{icon}</div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-tight">{sub}</p>
      </CardContent>
    </Card>
  )
}

export function HRDashboard({ title = 'HR Dashboard', description = 'Strength, salary, and ticket analytics' }: HRDashboardProps) {
  const now = new Date()
  const [period, setPeriod] = useState<'thisMonth' | 'lastMonth' | 'custom'>('thisMonth')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const { month, year } = useMemo(() => {
    if (period === 'thisMonth') {
      return { month: now.getMonth() + 1, year: now.getFullYear() }
    }
    if (period === 'lastMonth') {
      const last = new Date(now.getFullYear(), now.getMonth() - 1)
      return { month: last.getMonth() + 1, year: last.getFullYear() }
    }
    return { month: selectedMonth, year: selectedYear }
  }, [period, selectedMonth, selectedYear, now])

  const todayStr = useMemo(() => {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [now])

  const monthStartStr = useMemo(() => {
    return `${year}-${String(month).padStart(2, '0')}-01`
  }, [year, month])

  const monthEndStr = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate()
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [year, month])

  const { data: analytics, isLoading: analyticsLoading } = useQuery<HRAnalytics>({
    queryKey: ['analytics', 'md', 'hr', month, year],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('month', String(month))
      params.append('year', String(year))
      return apiGet<HRAnalytics>(`/api/analytics/md/hr?${params.toString()}`)
    },
    enabled: true,
  })

  const { data: todayAttendance } = useQuery<AttendanceData>({
    queryKey: ['attendance-today', todayStr],
    queryFn: () =>
      apiGet<AttendanceData>(`/api/attendance?fromDate=${todayStr}&toDate=${todayStr}&page=1&limit=10000`),
    enabled: true,
  })

  const { data: monthAttendance } = useQuery<AttendanceData>({
    queryKey: ['attendance-month', monthStartStr, monthEndStr],
    queryFn: () =>
      apiGet<AttendanceData>(`/api/attendance?fromDate=${monthStartStr}&toDate=${monthEndStr}&page=1&limit=10000`),
    enabled: true,
  })

  const { data: employees } = useQuery<EmployeeItem[]>({
    queryKey: ['employees-all'],
    queryFn: () => apiGet<EmployeeItem[]>('/api/employees'),
    enabled: true,
  })

  const mergedAnalytics = useMemo((): HRAnalytics | null => {
    if (!analytics) return null
    const today = todayAttendance?.data ?? []
    const monthData = monthAttendance?.data ?? []
    const allEmployees = employees ?? []

    const todayStrength = today.length
    const lateToday = today.filter((r) => r.isLate)
    const presentIds = new Set(today.map((r) => r.employee.id))
    const absentToday = allEmployees
      .filter((e) => !presentIds.has(e.id))
      .map((e) => ({
        employeeName: e.user.name,
        employeeCode: e.employeeCode,
        departmentName: e.department?.name ?? 'No Department',
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))

    const latecomersToday = lateToday.map((r) => ({
      employeeId: r.employee.id,
      employeeName: r.employee.user.name,
      employeeCode: r.employee.employeeCode,
      departmentName: r.employee.department?.name ?? 'No Department',
      punchTime: formatPunchTime(r.inTime),
      minutesLate: getMinutesLate(r.inTime),
    }))

    const lateByEmployee = new Map<string, { name: string; code: string; dept: string; count: number }>()
    for (const r of monthData) {
      if (!r.isLate) continue
      const id = r.employee.id
      const existing = lateByEmployee.get(id)
      if (existing) {
        existing.count += 1
      } else {
        lateByEmployee.set(id, {
          name: r.employee.user.name,
          code: r.employee.employeeCode,
          dept: r.employee.department?.name ?? 'No Department',
          count: 1,
        })
      }
    }
    const monthlyLateArrivals = Array.from(lateByEmployee.entries())
      .map(([employeeId, v]) => ({
        employeeId,
        employeeName: v.name,
        employeeCode: v.code,
        departmentName: v.dept,
        lateCount: v.count,
      }))
      .sort((a, b) => b.lateCount - a.lateCount)

    const totalHeadcount = Math.max(allEmployees.length, analytics.kpis.totalHeadcount)

    return {
      ...analytics,
      kpis: {
        ...analytics.kpis,
        todayStrength,
        totalHeadcount,
        latecomersCountToday: latecomersToday.length,
        absentCountToday: absentToday.length,
      },
      latecomersToday,
      absentToday,
      monthlyLateArrivals,
    }
  }, [analytics, todayAttendance, monthAttendance, employees])

  const isLoading = analyticsLoading

  return (
    <div className="space-y-5 p-3 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
        </div>
        {/* Date filters - stacked on mobile */}
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as 'thisMonth' | 'lastMonth' | 'custom')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(month)}
            onValueChange={(v) => { setPeriod('custom'); setSelectedMonth(parseInt(v, 10)) }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => { setPeriod('custom'); setSelectedYear(parseInt(v, 10)) }}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => year - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-3 w-20 bg-muted rounded" /></CardHeader>
              <CardContent><div className="h-7 w-24 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : mergedAnalytics ? (
        <>
          {/* ─── KPI Cards Row 1: Today ─── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Today</p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <KpiCard
                title="Strength"
                value={`${mergedAnalytics.kpis.todayStrength} / ${mergedAnalytics.kpis.totalHeadcount}`}
                sub="Present / Total"
                color="border-l-emerald-500"
                icon={<UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />}
              />
              <KpiCard
                title="Absent Today"
                value={String(mergedAnalytics.kpis.absentCountToday)}
                sub="Not punched in"
                color="border-l-slate-400"
                icon={<UserMinus className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500 dark:text-slate-400" />}
              />
              <KpiCard
                title="Late Today"
                value={`${mergedAnalytics.kpis.latecomersCountToday}`}
                sub={`of ${mergedAnalytics.kpis.todayStrength} present`}
                color="border-l-orange-500"
                icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />}
              />
              <KpiCard
                title="Headcount"
                value={String(mergedAnalytics.kpis.totalHeadcount)}
                sub="All employees"
                color="border-l-blue-500"
                icon={<Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />}
              />
            </div>
          </div>

          {/* ─── KPI Cards Row 2: Month ─── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {MONTHS[month - 1]} {year}
            </p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                title="Monthly Salary"
                value={formatCurrency(mergedAnalytics.kpis.monthlySalaryOutgo)}
                sub={mergedAnalytics.kpis.hasPayrollData ? 'Actual payroll' : 'CTC estimate'}
                color="border-l-violet-500"
                icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400" />}
              />
              <KpiCard
                title="Open Tickets"
                value={String(mergedAnalytics.kpis.openTicketsCount)}
                sub="Support + Mental health"
                color="border-l-amber-500"
                icon={<MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />}
              />
              <KpiCard
                title="Avg Response"
                value={formatHours(mergedAnalytics.kpis.avgTicketResponseHours)}
                sub="48hr SLA target"
                color="border-l-cyan-500"
                icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-600 dark:text-cyan-400" />}
              />
              <KpiCard
                title="Pending Leaves"
                value={String(mergedAnalytics.kpis.pendingLeaveCount)}
                sub="Awaiting approval"
                color="border-l-rose-500"
                icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 dark:text-rose-400" />}
              />
              <KpiCard
                title="New Joiners"
                value={String(mergedAnalytics.kpis.newJoinersCount)}
                sub="Joined this month"
                color="border-l-teal-500"
                icon={<UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 dark:text-teal-400" />}
              />
            </div>
          </div>

          <HRDashboardRecruitmentStrip />

          {/* ─── Today's Latecomers + Absent Today ─── */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Late today */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <CardTitle className="text-base">Late Today</CardTitle>
                  <Badge variant="secondary" className="ml-auto text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30">
                    {mergedAnalytics.latecomersToday.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">Arrived after shift start + grace period</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {mergedAnalytics.latecomersToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No late arrivals today</p>
                ) : (
                  <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Dept</TableHead>
                          <TableHead className="text-xs">In</TableHead>
                          <TableHead className="text-xs text-right">Late by</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedAnalytics.latecomersToday.map((e) => (
                          <TableRow key={e.employeeId}>
                            <TableCell className="text-xs font-medium py-2">{e.employeeName}</TableCell>
                            <TableCell className="text-xs py-2 hidden sm:table-cell text-muted-foreground">{e.departmentName}</TableCell>
                            <TableCell className="text-xs py-2 font-mono">{e.punchTime}</TableCell>
                            <TableCell className="text-xs py-2 text-right">
                              <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-xs px-1">
                                {e.minutesLate}m
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Absent today */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <CardTitle className="text-base">Absent Today</CardTitle>
                  <Badge variant="secondary" className="ml-auto">
                    {mergedAnalytics.absentToday.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">No punch-in recorded today</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {mergedAnalytics.absentToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Everyone is present</p>
                ) : (
                  <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedAnalytics.absentToday.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium py-2">{e.employeeName}</TableCell>
                            <TableCell className="text-xs font-mono py-2 text-muted-foreground">{e.employeeCode}</TableCell>
                            <TableCell className="text-xs py-2 hidden sm:table-cell text-muted-foreground">{e.departmentName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Monthly Late Arrivals Chart ─── */}
          {mergedAnalytics.monthlyLateArrivals.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <CardTitle className="text-base">Monthly Late Arrivals</CardTitle>
                </div>
                <CardDescription>{MONTHS[month - 1]} {year} — days arrived late per employee</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ChartContainer
                  config={{ lateCount: { label: 'Late Days', color: '#f97316' } }}
                  className="w-full"
                  style={{ height: Math.max(180, mergedAnalytics.monthlyLateArrivals.length * 32) }}
                >
                  <BarChart
                    data={mergedAnalytics.monthlyLateArrivals}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="employeeName"
                      type="category"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="lateCount" fill="#f97316" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* ─── Salary Charts ─── */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Department salary */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-violet-500" />
                  <CardTitle className="text-base">Department Salary</CardTitle>
                </div>
                <CardDescription>
                  {mergedAnalytics.kpis.hasPayrollData ? 'Net payable' : 'CTC estimate'} — {MONTHS[month - 1]} {year}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ChartContainer
                  config={{ amount: { label: 'Amount', color: '#8b5cf6' } }}
                  className="w-full"
                  style={{ height: Math.max(160, mergedAnalytics.departmentSalaryBreakdown.length * 36) }}
                >
                  <BarChart
                    data={mergedAnalytics.departmentSalaryBreakdown}
                    layout="vertical"
                    margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      dataKey="departmentName"
                      type="category"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrencyFull(Number(v))} />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {mergedAnalytics.departmentSalaryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Team salary */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <CardTitle className="text-base">Team Salary</CardTitle>
                </div>
                <CardDescription>
                  {mergedAnalytics.kpis.hasPayrollData ? 'Net payable' : 'CTC estimate'} by department team
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ChartContainer
                  config={{ amount: { label: 'Amount', color: '#6366f1' } }}
                  className="w-full"
                  style={{ height: Math.max(160, mergedAnalytics.teamSalaryBreakdown.length * 36) }}
                >
                  <BarChart
                    data={mergedAnalytics.teamSalaryBreakdown}
                    layout="vertical"
                    margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      dataKey="teamName"
                      type="category"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrencyFull(Number(v))} />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {mergedAnalytics.teamSalaryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[(i + 2) % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Department headcount - horizontal bar (replaces pie) */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <CardTitle className="text-base">Department Headcount</CardTitle>
                </div>
                <CardDescription>Employees per department</CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-4">
                <ChartContainer
                  config={{ count: { label: 'Employees', color: '#3b82f6' } }}
                  className="w-full"
                  style={{ height: Math.max(160, mergedAnalytics.departmentHeadcount.length * 36) }}
                >
                  <BarChart
                    data={mergedAnalytics.departmentHeadcount}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="departmentName"
                      type="category"
                      width={110}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {mergedAnalytics.departmentHeadcount.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Ticket analytics */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <CardTitle className="text-base">Ticket Analytics</CardTitle>
                </div>
                <CardDescription>{MONTHS[month - 1]} {year} — 48hr SLA</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-center">Total</TableHead>
                        <TableHead className="text-xs text-center">Done</TableHead>
                        <TableHead className="text-xs text-center hidden sm:table-cell">Avg</TableHead>
                        <TableHead className="text-xs text-right">SLA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedAnalytics.ticketAnalytics.map((t) => (
                        <TableRow key={t.type}>
                          <TableCell className="text-xs font-medium py-3">{t.type}</TableCell>
                          <TableCell className="text-xs py-3 text-center">{t.totalInMonth}</TableCell>
                          <TableCell className="text-xs py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{t.resolvedCount}</TableCell>
                          <TableCell className="text-xs py-3 text-center hidden sm:table-cell text-muted-foreground">{formatHours(t.avgResponseHours)}</TableCell>
                          <TableCell className="text-xs py-3 text-right">
                            {t.slaCompliancePercent != null ? (
                              <Badge
                                variant={
                                  t.slaCompliancePercent >= 90
                                    ? 'default'
                                    : t.slaCompliancePercent >= 70
                                      ? 'secondary'
                                      : 'destructive'
                                }
                                className="text-xs"
                              >
                                {t.slaCompliancePercent.toFixed(0)}%
                              </Badge>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── New Joiners ─── */}
          {mergedAnalytics.newJoiners.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-teal-500" />
                  <CardTitle className="text-base">New Joiners</CardTitle>
                  <Badge variant="secondary" className="ml-auto text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/30">
                    {mergedAnalytics.newJoiners.length}
                  </Badge>
                </div>
                <CardDescription>Joined in {MONTHS[month - 1]} {year}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                        <TableHead className="text-xs text-right">Join Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedAnalytics.newJoiners.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium py-2">{e.employeeName}</TableCell>
                          <TableCell className="text-xs font-mono py-2 text-muted-foreground">{e.employeeCode}</TableCell>
                          <TableCell className="text-xs py-2 hidden sm:table-cell text-muted-foreground">{e.departmentName}</TableCell>
                          <TableCell className="text-xs py-2 text-right text-teal-600 dark:text-teal-400 font-medium">
                            {new Date(e.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No data available for the selected period</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
