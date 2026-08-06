'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  UserCheck,
  Wallet,
  AlertTriangle,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts'
import { HRDashboardRecruitmentStrip } from '@/components/hr/hr-dashboard-recruitment-strip'
import { isActiveHeadcountEmployee } from '@/lib/hrms/headcount'

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
  /** Rolling 12 months ending at selected month; interviews from scheduled meets, hires from join dates */
  recruitmentMonthlyTrend: Array<{
    year: number
    month: number
    interviews: number
    newHires: number
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
  status?: string
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

interface HRDashboardProps {
  title?: string
  /** When omitted, a default is chosen from `audience`. */
  description?: string
  /** `md` uses a shorter default description for the leadership route. */
  audience?: 'md' | 'hr'
}

interface KpiCardProps {
  title: string
  value: string
  sub: string
  color: string
  icon: React.ReactNode
  onClick?: () => void
}

function KpiCard({ title, value, sub, color, icon, onClick }: KpiCardProps) {
  return (
    <Card
      className={cn(
        `border-l-4 ${color} bg-card`,
        onClick &&
          'cursor-pointer select-none transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 sm:pt-4 px-2.5 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-medium leading-tight">{title}</CardTitle>
        <div className="shrink-0 ml-2">{icon}</div>
      </CardHeader>
      <CardContent className="px-2.5 sm:px-4 pb-3 sm:pb-4">
        <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 leading-tight">{sub}</p>
      </CardContent>
    </Card>
  )
}

const DEFAULT_DESCRIPTION_HR = 'Headcount, attendance, payroll, and hiring'
const DEFAULT_DESCRIPTION_MD = 'Headcount, payroll, and hiring snapshot'

export function HRDashboard({
  title = 'HR Dashboard',
  description: descriptionProp,
  audience = 'hr',
}: HRDashboardProps) {
  const description =
    descriptionProp ??
    (audience === 'md' ? DEFAULT_DESCRIPTION_MD : DEFAULT_DESCRIPTION_HR)
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const [newJoinersDrawerOpen, setNewJoinersDrawerOpen] = useState(false)

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
    const allEmployees = (employees ?? []).filter((e) => isActiveHeadcountEmployee(e.status))
    const activeIds = new Set(allEmployees.map((e) => e.id))
    // Attendance APIs default to active roster; intersect once roster is loaded
    const todayRaw = todayAttendance?.data ?? []
    const monthRaw = monthAttendance?.data ?? []
    const today =
      activeIds.size > 0 ? todayRaw.filter((r) => activeIds.has(r.employee.id)) : todayRaw
    const monthData =
      activeIds.size > 0 ? monthRaw.filter((r) => activeIds.has(r.employee.id)) : monthRaw

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

    // Prefer live active roster length; never inflate with unfiltered totals
    const totalHeadcount =
      allEmployees.length > 0 ? allEmployees.length : analytics.kpis.totalHeadcount

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

  const interviewsVsHiresChartData = useMemo(() => {
    const rows = mergedAnalytics?.recruitmentMonthlyTrend ?? []
    return rows.map((r) => ({
      ...r,
      label: `${MONTHS[r.month - 1].slice(0, 3)} '${String(r.year).slice(-2)}`,
    }))
  }, [mergedAnalytics?.recruitmentMonthlyTrend])

  const isLoading = analyticsLoading

  return (
    <div className="space-y-3 sm:space-y-5 px-2 py-3 sm:px-5 sm:py-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{title}</h1>
        <p className="hidden sm:block text-muted-foreground text-sm mt-0.5">{description}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">Today</p>
            <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3">
              <KpiCard
                title="Strength"
                value={`${mergedAnalytics.kpis.todayStrength} / ${mergedAnalytics.kpis.totalHeadcount}`}
                sub="Present of total roster"
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
            </div>
          </div>

          {/* ─── KPI Cards Row 2: Month ─── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
              {MONTHS[month - 1]} {year}
            </p>
            <div className="grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-2">
              <KpiCard
                title="Monthly Salary"
                value={formatCurrency(mergedAnalytics.kpis.monthlySalaryOutgo)}
                sub={mergedAnalytics.kpis.hasPayrollData ? 'Actual payroll' : 'CTC estimate'}
                color="border-l-violet-500"
                icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400" />}
              />
              <KpiCard
                title="New Joiners"
                value={String(mergedAnalytics.kpis.newJoinersCount)}
                sub={
                  mergedAnalytics.newJoiners.length > 0
                    ? 'Joined this month — tap for list'
                    : 'Joined this month'
                }
                color="border-l-teal-500"
                icon={<UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 dark:text-teal-400" />}
                onClick={
                  mergedAnalytics.newJoiners.length > 0
                    ? () => setNewJoinersDrawerOpen(true)
                    : undefined
                }
              />
            </div>
          </div>

          <HRDashboardRecruitmentStrip />

          {audience === 'md' && interviewsVsHiresChartData.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader className="space-y-1 pb-2 px-2 sm:px-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <CardTitle className="text-base">Interviews vs new hires</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Last 12 months ending {MONTHS[month - 1]} {year} — scheduled interviews and employees who joined
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-4 pb-2">
                <div className="sm:hidden px-2 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs h-9">Month</TableHead>
                        <TableHead className="text-xs h-9 text-right">Interviews</TableHead>
                        <TableHead className="text-xs h-9 text-right">New hires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interviewsVsHiresChartData.map((row, i) => (
                        <TableRow key={`${row.year}-${row.month}-${i}`}>
                          <TableCell className="text-xs py-2 font-medium">{row.label}</TableCell>
                          <TableCell className="text-xs py-2 text-right tabular-nums">{row.interviews}</TableCell>
                          <TableCell className="text-xs py-2 text-right tabular-nums">{row.newHires}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="hidden sm:block w-full overflow-x-auto overscroll-x-contain touch-pan-x">
                  <ChartContainer
                    config={{
                      interviews: {
                        label: 'Interviews',
                        color: 'hsl(239 84% 67%)',
                      },
                      newHires: {
                        label: 'New hires',
                        color: 'hsl(173 58% 40%)',
                      },
                    }}
                    className="h-[240px] sm:h-[280px] w-full min-w-[520px] sm:min-w-0 aspect-auto mx-auto"
                  >
                    <BarChart
                      data={interviewsVsHiresChartData}
                      margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        interval={0}
                        height={36}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        tick={{ fontSize: 10 }}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-3 justify-center pt-1" />} />
                      <Bar
                        dataKey="interviews"
                        fill="var(--color-interviews)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="newHires"
                        fill="var(--color-newHires)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Today's Latecomers + Absent Today ─── */}
          <div className="grid gap-2.5 sm:gap-4 grid-cols-1 md:grid-cols-2">
            {/* Late today */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 px-2 sm:px-6">
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
              <CardHeader className="pb-2 px-2 sm:px-6">
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
              <CardHeader className="px-2 sm:px-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <CardTitle className="text-base">Monthly Late Arrivals</CardTitle>
                </div>
                <CardDescription>{MONTHS[month - 1]} {year} — days arrived late per employee</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[min(55vh,420px)] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">Dept</TableHead>
                        <TableHead className="text-xs text-right">Late days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedAnalytics.monthlyLateArrivals.map((e) => (
                        <TableRow key={e.employeeId}>
                          <TableCell className="text-xs font-medium py-2">{e.employeeName}</TableCell>
                          <TableCell className="text-xs py-2 hidden sm:table-cell text-muted-foreground">
                            {e.departmentName}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-right">
                            <Badge
                              variant="outline"
                              className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-xs px-1.5 tabular-nums"
                            >
                              {e.lateCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Salary (by department / by team) ─── */}
          <div className="grid gap-2.5 sm:gap-4 grid-cols-1 md:grid-cols-2">
            <Card className="overflow-hidden">
              <Tabs defaultValue="department" className="gap-0">
                <CardHeader className="space-y-3 px-2 sm:px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-500" />
                      <CardTitle className="text-base">Salary breakdown</CardTitle>
                    </div>
                    <TabsList className="w-full sm:w-auto shrink-0">
                      <TabsTrigger value="department">By department</TabsTrigger>
                    </TabsList>
                  </div>
                  <CardDescription>
                    {mergedAnalytics.kpis.hasPayrollData ? 'Net payable' : 'CTC estimate'} — {MONTHS[month - 1]} {year}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6 pt-0">
                  <TabsContent value="department" className="mt-0 outline-none">
                    <ChartContainer
                      config={{ amount: { label: 'Amount', color: '#8b5cf6' } }}
                      className="w-full"
                      style={{ height: Math.max(160, mergedAnalytics.departmentSalaryBreakdown.length * 36) }}
                    >
                      <BarChart
                        data={mergedAnalytics.departmentSalaryBreakdown}
                        layout="vertical"
                        margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
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
                          width={80}
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          tickFormatter={(v) =>
                            String(v).length > 14 ? `${String(v).slice(0, 12)}…` : String(v)
                          }
                        />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrencyFull(Number(v))} />} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                          {mergedAnalytics.departmentSalaryBreakdown.map((_, i) => (
                            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Department headcount - horizontal bar (replaces pie) */}
            <Card className="overflow-hidden">
              <CardHeader className="px-2 sm:px-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <CardTitle className="text-base">Department Headcount</CardTitle>
                </div>
                <CardDescription>
                  {mergedAnalytics.kpis.totalHeadcount} employees total — breakdown by department
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ChartContainer
                  config={{ count: { label: 'Employees', color: '#3b82f6' } }}
                  className="w-full"
                  style={{ height: Math.max(160, mergedAnalytics.departmentHeadcount.length * 36) }}
                >
                  <BarChart
                    data={mergedAnalytics.departmentHeadcount}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis
                      dataKey="departmentName"
                      type="category"
                      width={80}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      tickFormatter={(v) =>
                        String(v).length > 14 ? `${String(v).slice(0, 12)}…` : String(v)
                      }
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

          </div>

          <Drawer open={newJoinersDrawerOpen} onOpenChange={setNewJoinersDrawerOpen}>
            <DrawerContent className="max-h-[88vh]">
              <DrawerHeader className="text-left px-4 pb-2">
                <DrawerTitle>
                  New joiners — {MONTHS[month - 1]} {year}
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overscroll-contain px-2 pb-6 max-h-[min(70vh,520px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Code</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Department</TableHead>
                      <TableHead className="text-xs text-right">Join date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedAnalytics.newJoiners.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium py-2">{e.employeeName}</TableCell>
                        <TableCell className="text-xs font-mono py-2 text-muted-foreground">
                          {e.employeeCode}
                        </TableCell>
                        <TableCell className="text-xs py-2 hidden sm:table-cell text-muted-foreground">
                          {e.departmentName}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right text-teal-600 dark:text-teal-400 font-medium">
                          {new Date(e.joinDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
