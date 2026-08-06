'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  AttendanceHeatmap,
  type AttendanceDay as HeatmapAttendanceDay,
} from '@/components/employee/attendance-heatmap'
import { UserMinus, AlertTriangle, UserPlus, ChevronRight, ChevronLeft, ChevronDown, CalendarHeart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMDTeamOverview } from '@/hooks/use-md-team'
import type { HRDashboardFilters } from './md-hr-filter-drawer'
import type { HRAnalytics } from '@/components/hr/hr-dashboard'
import { isActiveHeadcountEmployee } from '@/lib/hrms/headcount'

interface LeaveBalanceEntry {
  employeeId: string
  employeeName: string
  employeeEmail: string
  balances: {
    leaveTypeId: string
    leaveTypeName: string
    allocated: number
    used: number
    remaining: number
  }[]
}

interface AttendanceRecord {
  employee: { id: string; employeeCode: string; user: { name: string }; department: { name: string; id?: string } | null }
  date: string
  inTime: Date | string | null
  outTime: Date | string | null
  workHours: number | null
  isLate: boolean
  status?: string
  penalty?: number
  isHalfDay?: boolean
  isNormalized?: boolean
  isPendingNormalization?: boolean
}

interface AttendanceData {
  data: AttendanceRecord[]
  pagination: { total: number }
}

interface EmployeeItem {
  id: string
  employeeCode: string
  departmentId: string | null
  status?: string
  user: { name: string }
  department: { name: string; id: string } | null
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
  return Math.max(0, total - 11 * 60)
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function toHeatmapAttendance(rows: AttendanceRecord[]): HeatmapAttendanceDay[] {
  return rows.map((r) => ({
    date: new Date(r.date),
    inTime: r.inTime ? new Date(r.inTime as string) : null,
    outTime: r.outTime ? new Date(r.outTime as string) : null,
    workHours: r.workHours ?? null,
    isLate: r.isLate,
    status: r.status as HeatmapAttendanceDay['status'] | undefined,
    penalty: r.penalty,
    isHalfDay: r.isHalfDay,
    isNormalized: r.isNormalized,
    isPendingNormalization: r.isPendingNormalization,
  }))
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Exclude employee code 1000 (MD)
const MD_EMPLOYEE_CODE = '1000'

interface MdHrTodayTabProps {
  filters: HRDashboardFilters
}

export function MdHrTodayTab({ filters }: MdHrTodayTabProps) {
  const isMobile = useIsMobile()
  const [activeDrawer, setActiveDrawer] = useState<'absent' | 'late' | 'joiners' | 'leave' | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  const [heatmapEmployee, setHeatmapEmployee] = useState<{
    id: string
    name: string
    departmentName: string | null
  } | null>(null)
  const [heatmapMonth, setHeatmapMonth] = useState(() => new Date(filters.year, filters.month - 1, 1))

  const now = new Date()
  const todayStr = useMemo(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  const monthStartStr = useMemo(() => {
    return `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  }, [filters.year, filters.month])

  const monthEndStr = useMemo(() => {
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    return `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [filters.year, filters.month])

  const { data: analytics, isLoading: analyticsLoading } = useQuery<HRAnalytics>({
    queryKey: ['analytics', 'md', 'hr', filters.month, filters.year],
    queryFn: () => apiGet<HRAnalytics>(`/api/analytics/md/hr?month=${filters.month}&year=${filters.year}`),
  })

  const { data: todayAttendance } = useQuery<AttendanceData>({
    queryKey: ['attendance-today', todayStr],
    queryFn: () => apiGet<AttendanceData>(`/api/attendance?fromDate=${todayStr}&toDate=${todayStr}&page=1&limit=10000`),
  })

  const { data: monthAttendance } = useQuery<AttendanceData>({
    queryKey: ['attendance-month', monthStartStr, monthEndStr],
    queryFn: () => apiGet<AttendanceData>(`/api/attendance?fromDate=${monthStartStr}&toDate=${monthEndStr}&page=1&limit=10000`),
  })

  const { data: employees } = useQuery<EmployeeItem[]>({
    queryKey: ['employees-all'],
    queryFn: () => apiGet<EmployeeItem[]>('/api/employees'),
  })

  // Team overview for on-leave data
  const { data: teamOverview } = useMDTeamOverview()

  // Heatmap month-based dates (independent from filter month)
  const heatmapFromStr = useMemo(() => {
    return `${heatmapMonth.getFullYear()}-${String(heatmapMonth.getMonth() + 1).padStart(2, '0')}-01`
  }, [heatmapMonth])

  const heatmapToStr = useMemo(() => {
    const lastDay = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() + 1, 0).getDate()
    return `${heatmapMonth.getFullYear()}-${String(heatmapMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [heatmapMonth])

  // Heatmap data for selected employee
  const { data: heatmapAttendance } = useQuery<AttendanceData>({
    queryKey: ['md-employee-attendance-heatmap', heatmapEmployee?.id, heatmapFromStr, heatmapToStr],
    queryFn: () =>
      apiGet<AttendanceData>(
        `/api/attendance?fromDate=${heatmapFromStr}&toDate=${heatmapToStr}&employeeId=${heatmapEmployee!.id}&page=1&limit=10000`
      ),
    enabled: !!heatmapEmployee,
  })

  // Leave balance for heatmap employee
  const { data: heatmapLeaveBalance } = useQuery<{ balance: LeaveBalanceEntry }>({
    queryKey: ['md-employee-leave-balance', heatmapEmployee?.id],
    queryFn: () =>
      apiGet<{ balance: LeaveBalanceEntry }>(
        `/api/md/employee-leave-balance?employeeId=${heatmapEmployee!.id}`
      ),
    enabled: !!heatmapEmployee,
  })

  const merged = useMemo(() => {
    if (!analytics) return null
    const allEmployees = (employees ?? []).filter((e) => isActiveHeadcountEmployee(e.status))
    const activeIds = new Set(allEmployees.map((e) => e.id))
    const todayRaw = todayAttendance?.data ?? []
    const monthRaw = monthAttendance?.data ?? []
    const today =
      activeIds.size > 0 ? todayRaw.filter((r) => activeIds.has(r.employee.id)) : todayRaw
    const monthData =
      activeIds.size > 0 ? monthRaw.filter((r) => activeIds.has(r.employee.id)) : monthRaw
    const deptFilter = filters.departments.length > 0 ? new Set(filters.departments) : null

    // Exclude MD (code 1000)
    const nonMdEmployees = allEmployees.filter((e) => e.employeeCode !== MD_EMPLOYEE_CODE)

    const filteredEmployees = deptFilter
      ? nonMdEmployees.filter((e) => e.department && deptFilter.has(e.department.id))
      : nonMdEmployees

    const filteredToday = today.filter((r) => {
      if (r.employee.employeeCode === MD_EMPLOYEE_CODE) return false
      if (!deptFilter) return true
      return r.employee.department && deptFilter.has((r.employee.department as any).id || '')
    })

    const todayStrength = filteredToday.length
    const totalHeadcount =
      filteredEmployees.length > 0
        ? filteredEmployees.length
        : deptFilter
          ? 0
          : analytics.kpis.totalHeadcount

    const lateToday = filteredToday.filter((r) => r.isLate)
    const presentIds = new Set(filteredToday.map((r) => r.employee.id))

    // Build monthly late counts map for all employees
    const monthlyLateCounts = new Map<string, number>()
    const filteredMonth = monthData.filter((r) => {
      if (r.employee.employeeCode === MD_EMPLOYEE_CODE) return false
      if (!deptFilter) return true
      return r.employee.department && deptFilter.has((r.employee.department as any).id || '')
    })
    for (const r of filteredMonth) {
      if (!r.isLate) continue
      monthlyLateCounts.set(r.employee.id, (monthlyLateCounts.get(r.employee.id) ?? 0) + 1)
    }

    const absentToday = filteredEmployees
      .filter((e) => !presentIds.has(e.id))
      .map((e) => ({
        employeeId: e.id,
        employeeName: e.user.name,
        departmentName: e.department?.name ?? 'No Department',
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))

    const latecomersToday = lateToday.map((r) => ({
      employeeId: r.employee.id,
      employeeName: r.employee.user.name,
      departmentName: r.employee.department?.name ?? 'No Department',
      punchTime: formatPunchTime(r.inTime),
      minutesLate: getMinutesLate(r.inTime),
      monthlyLateCount: monthlyLateCounts.get(r.employee.id) ?? 1,
    }))

    const monthlyLateArrivals = Array.from(monthlyLateCounts.entries())
      .map(([employeeId, count]) => {
        const emp = filteredMonth.find((r) => r.employee.id === employeeId)
        return {
          employeeId,
          employeeName: emp?.employee.user.name ?? 'Unknown',
          departmentName: emp?.employee.department?.name ?? 'No Department',
          lateCount: count,
        }
      })
      .sort((a, b) => b.lateCount - a.lateCount)

    return {
      todayStrength,
      totalHeadcount,
      absentCount: absentToday.length,
      lateCount: latecomersToday.length,
      monthlySalary: analytics.kpis.monthlySalaryOutgo,
      hasPayrollData: analytics.kpis.hasPayrollData,
      newJoinersCount: analytics.kpis.newJoinersCount,
      newJoiners: analytics.newJoiners,
      absentToday,
      latecomersToday,
      monthlyLateArrivals,
    }
  }, [analytics, todayAttendance, monthAttendance, employees, filters.departments])

  const onLeaveToday = useMemo(() => {
    if (!teamOverview?.members) return []
    const deptFilter = filters.departments.length > 0 ? new Set(filters.departments) : null
    return teamOverview.members
      .filter((m) => {
        if (m.attendanceStatus !== 'leave') return false
        if (deptFilter && m.department && !deptFilter.has(m.department.id)) return false
        return true
      })
      .map((m) => ({
        employeeId: m.employeeId,
        employeeName: m.name,
        departmentName: m.department?.name ?? 'No Department',
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [teamOverview, filters.departments])

  const handleEmployeeClick = (employeeId: string, employeeName: string, departmentName: string | null) => {
    setHeatmapMonth(new Date(filters.year, filters.month - 1, 1))
    setHeatmapEmployee({ id: employeeId, name: employeeName, departmentName })
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!merged) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">No data available</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7 pb-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Strength"
          value={`${merged.todayStrength}/${merged.totalHeadcount}`}
          subValue="Present today"
          accent="emerald"
        />
        <StatCard
          label="On Leave"
          value={onLeaveToday.length}
          subValue="Approved leave"
          accent="purple"
          valueAccent
        />
        <StatCard
          label="New Joiners"
          value={merged.newJoinersCount}
          subValue={MONTHS[filters.month - 1]}
          accent="teal"
          className={merged.newJoiners.length > 0 ? 'cursor-pointer active:scale-[0.97] transition-transform' : undefined}
          onClick={merged.newJoiners.length > 0 ? () => setActiveDrawer('joiners') : undefined}
        />
      </div>

      {/* On Leave Today - Collapsible */}
      <Card className="overflow-hidden">
        <button
          type="button"
          className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          onClick={() => onLeaveToday.length > 0 && toggleSection('onLeave')}
        >
          <div className="h-9 w-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <CalendarHeart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">On Leave Today</p>
            <p className="text-xs text-muted-foreground">Approved leave</p>
          </div>
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0 text-sm font-bold tabular-nums px-2.5">
            {onLeaveToday.length}
          </Badge>
          {onLeaveToday.length > 0 && (
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expandedSections.onLeave && 'rotate-180')} />
          )}
        </button>
        {expandedSections.onLeave && onLeaveToday.length > 0 && (
          <CardContent className="px-2 sm:px-4 pb-4 pt-0 border-t">
            <ul className="space-y-0.5 max-h-[360px] overflow-y-auto overscroll-contain">
              {onLeaveToday.map((e) => (
                <li key={e.employeeId}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName)}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {getInitials(e.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Absent Today - Collapsible */}
      <Card className="overflow-hidden">
        <button
          type="button"
          className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          onClick={() => merged.absentCount > 0 && toggleSection('absent')}
        >
          <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <UserMinus className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Absent Today</p>
            <p className="text-xs text-muted-foreground">No punch-in recorded</p>
          </div>
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0 text-sm font-bold tabular-nums px-2.5">
            {merged.absentCount}
          </Badge>
          {merged.absentCount > 0 && (
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expandedSections.absent && 'rotate-180')} />
          )}
        </button>
        {expandedSections.absent && merged.absentToday.length > 0 && (
          <CardContent className="px-2 sm:px-4 pb-4 pt-0 border-t">
            <ul className="space-y-0.5 max-h-[360px] overflow-y-auto overscroll-contain">
              {merged.absentToday.map((e) => (
                <li key={e.employeeId}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName)}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {getInitials(e.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Late Today - Collapsible */}
      <Card className="overflow-hidden">
        <button
          type="button"
          className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          onClick={() => merged.lateCount > 0 && toggleSection('late')}
        >
          <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Late Today</p>
            <p className="text-xs text-muted-foreground">After shift start + grace</p>
          </div>
          <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-0 text-sm font-bold tabular-nums px-2.5">
            {merged.lateCount}
          </Badge>
          {merged.lateCount > 0 && (
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expandedSections.late && 'rotate-180')} />
          )}
        </button>
        {expandedSections.late && merged.latecomersToday.length > 0 && (
          <CardContent className="px-2 sm:px-4 pb-4 pt-0 border-t">
            <ul className="space-y-0.5 max-h-[360px] overflow-y-auto overscroll-contain">
              {merged.latecomersToday.map((e) => (
                <li key={e.employeeId}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName)}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {getInitials(e.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-mono font-medium">{e.punchTime}</p>
                        <p className="text-[10px] text-muted-foreground">{e.minutesLate}m late</p>
                      </div>
                      <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-[10px] px-1.5 tabular-nums">
                        {e.monthlyLateCount}x
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Monthly Late Arrivals - Collapsible */}
      {merged.monthlyLateArrivals.length > 0 && (
        <Card className="overflow-hidden">
          <button
            type="button"
            className="w-full text-left px-4 sm:px-6 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
            onClick={() => toggleSection('monthlyLate')}
          >
            <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Monthly Late Arrivals</p>
              <p className="text-xs text-muted-foreground">{MONTHS[filters.month - 1]} {filters.year}</p>
            </div>
            <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-0 text-sm font-bold tabular-nums px-2.5">
              {merged.monthlyLateArrivals.length}
            </Badge>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expandedSections.monthlyLate && 'rotate-180')} />
          </button>
          {expandedSections.monthlyLate && (
            <CardContent className="px-2 sm:px-4 pb-4 pt-0 border-t">
              <ul className="space-y-0.5 max-h-[min(55vh,420px)] overflow-y-auto overscroll-contain">
                {merged.monthlyLateArrivals.map((e) => (
                  <li key={e.employeeId}>
                    <button
                      type="button"
                      className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                      onClick={() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName)}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {getInitials(e.employeeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                      </div>
                      <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 text-xs px-2 py-0.5 tabular-nums shrink-0">
                        {e.lateCount} days
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Monthly Salary */}
      <StatCard
        label="Monthly Salary"
        value={formatCurrency(merged.monthlySalary)}
        subValue={merged.hasPayrollData ? 'Actual payroll' : 'CTC estimate'}
        accent="purple"
      />

      {/* Stat Card Drawers (for mobile quick view) */}
      <Drawer open={activeDrawer === 'absent'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-500" />
              Absent Today — {merged.absentCount}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-2 pb-6 max-h-[70dvh]">
            <ul className="space-y-1">
              {merged.absentToday.map((e) => (
                <li key={e.employeeId}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-3 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => {
                      setActiveDrawer(null)
                      setTimeout(() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName), 300)
                    }}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {getInitials(e.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={activeDrawer === 'late'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Late Today — {merged.lateCount}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-2 pb-6 max-h-[70dvh]">
            <ul className="space-y-1">
              {merged.latecomersToday.map((e) => (
                <li key={e.employeeId}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-3 hover:bg-muted/50 active:bg-muted/70 transition-colors flex items-center gap-3"
                    onClick={() => {
                      setActiveDrawer(null)
                      setTimeout(() => handleEmployeeClick(e.employeeId, e.employeeName, e.departmentName), 300)
                    }}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {getInitials(e.employeeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{e.punchTime}</span>
                        <span className="text-[10px] text-orange-600">({e.minutesLate}m late)</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px] px-1.5 tabular-nums shrink-0">
                      {e.monthlyLateCount}x
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>


      <Drawer open={activeDrawer === 'joiners'} onOpenChange={(open) => !open && setActiveDrawer(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-500" />
              New Joiners — {MONTHS[filters.month - 1]} {filters.year}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain px-2 pb-6 max-h-[70dvh]">
            <ul className="space-y-1">
              {merged.newJoiners.map((e, i) => (
                <li key={i} className="rounded-lg px-3 py-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                      {getInitials(e.employeeName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">{e.employeeName}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.departmentName}</p>
                  </div>
                  <span className="text-xs text-teal-600 dark:text-teal-400 font-medium shrink-0">
                    {new Date(e.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Attendance Heatmap Drawer */}
      <Drawer
        open={!!heatmapEmployee}
        onOpenChange={(open) => !open && setHeatmapEmployee(null)}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent
          className={cn(
            'mt-0 flex max-h-[100dvh] h-[100dvh] flex-col rounded-t-2xl border-0 p-0 gap-0 overflow-hidden',
            '[&>div:first-child]:hidden'
          )}
        >
          {heatmapEmployee && (
            <>
              <DrawerHeader className="shrink-0 border-b px-4 py-3 text-left space-y-1">
                <div className="flex items-center gap-3 pr-8">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-sm font-semibold">
                      {getInitials(heatmapEmployee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <DrawerTitle className="text-lg font-semibold leading-tight">
                      {heatmapEmployee.name}
                    </DrawerTitle>
                    {heatmapEmployee.departmentName && (
                      <p className="text-xs text-muted-foreground truncate">{heatmapEmployee.departmentName}</p>
                    )}
                  </div>
                </div>
                {/* Month navigation */}
                <div className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Previous month"
                    onClick={() => setHeatmapMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-sm font-semibold text-center">
                    {MONTHS[heatmapMonth.getMonth()]} {heatmapMonth.getFullYear()}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Next month"
                    onClick={() => setHeatmapMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </DrawerHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 space-y-5">
                  {/* Leave balance */}
                  {heatmapLeaveBalance?.balance?.balances && heatmapLeaveBalance.balance.balances.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Leave balance
                      </p>
                      <div className="flex gap-2">
                        {heatmapLeaveBalance.balance.balances.map((b) => (
                          <div
                            key={b.leaveTypeId}
                            className="flex-1 min-w-0 rounded-lg border bg-white dark:bg-card p-2.5 text-center"
                          >
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide truncate">
                              {b.leaveTypeName}
                            </p>
                            <p className="text-lg font-bold tabular-nums leading-none mt-1">
                              {b.remaining}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums whitespace-nowrap">
                              {b.used}/{b.allocated}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Calendar
                    </p>
                    <div className="rounded-lg border bg-card p-2 -mx-1">
                      {heatmapAttendance ? (
                        <AttendanceHeatmap
                          attendance={toHeatmapAttendance(heatmapAttendance.data)}
                          fromDate={heatmapFromStr}
                          toDate={heatmapToStr}
                          showLegend
                        />
                      ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          Loading attendance...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
                <Button variant="outline" className="w-full h-11 rounded-lg" onClick={() => setHeatmapEmployee(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
