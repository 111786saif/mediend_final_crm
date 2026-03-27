'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState, useMemo } from 'react'
import { Calendar, Clock, AlertCircle, RefreshCw, Search, ChevronLeft, ChevronRight, Users, UserCheck, UserX, CalendarOff } from 'lucide-react'
import { format, eachDayOfInterval } from 'date-fns'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { AttendanceHeatmap, type AttendanceDay } from '@/components/employee/attendance-heatmap'

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  employeeCode: string
  user: {
    id: string
    name: string
    email: string
  }
  department: {
    id: string
    name: string
  } | null
}

interface AttendanceRecord {
  employee: {
    id: string
    employeeCode: string
    user: {
      id: string
      name: string
      email: string
    }
    department: {
      id: string
      name: string
    } | null
  }
  date: string
  inTime: Date | null
  outTime: Date | null
  workHours: number | null
  isLate: boolean
}

interface AttendanceData {
  data: AttendanceRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface LeaveRequestItem {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  days?: number
  isUnpaid?: boolean
}

interface LeaveData {
  data: LeaveRequestItem[]
  pagination: { total: number }
}

const COLORS = {
  onTime: '#22c55e',
  late: '#ef4444',
  present: '#3b82f6',
  absent: '#94a3b8',
}

export function AttendanceTab() {
  const [fromDate, setFromDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [departmentId, setDepartmentId] = useState<string>('all')
  const [employeeId, setEmployeeId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [heatmapEmployeeId, setHeatmapEmployeeId] = useState<string>('all')
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false)
  const [syncFromDate, setSyncFromDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [syncToDate, setSyncToDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const { data: todayAttendanceData } = useQuery<AttendanceData>({
    queryKey: ['attendance-today', todayStr, departmentId],
    queryFn: () => {
      const params = new URLSearchParams({
        fromDate: todayStr,
        toDate: todayStr,
        page: '1',
        limit: '10000',
      })
      if (departmentId && departmentId !== 'all') params.set('departmentId', departmentId)
      return apiGet<AttendanceData>(`/api/attendance?${params.toString()}`)
    },
  })

  const { data: approvedLeavesData } = useQuery<LeaveData>({
    queryKey: ['leaves-approved'],
    queryFn: () => apiGet<LeaveData>('/api/leaves?status=APPROVED&limit=1000'),
  })

  const { data: holidaysData = [] } = useQuery<{ id: string; date: string; name: string; type: string }[]>({
    queryKey: ['holidays', fromDate, toDate],
    queryFn: () => {
      const [y, m, d] = fromDate.split('-').map(Number)
      const year = new Date(y, m - 1, d).getFullYear()
      return apiGet<{ id: string; date: string; name: string; type: string }[]>(`/api/holidays?year=${year}`)
    },
  })

  const heatmapHolidayDays = useMemo(() => {
    if (!holidaysData.length) return []
    const [fromY, fromM, fromD] = fromDate.split('-').map(Number)
    const [toY, toM, toD] = toDate.split('-').map(Number)
    const rangeStart = new Date(fromY, fromM - 1, fromD)
    const rangeEnd = new Date(toY, toM - 1, toD)
    return holidaysData
      .filter((h) => {
        const [y, m, d] = h.date.split('-').map(Number)
        const dObj = new Date(y, m - 1, d)
        return dObj >= rangeStart && dObj <= rangeEnd
      })
      .map((h) => ({ date: h.date, name: h.name }))
  }, [holidaysData, fromDate, toDate])

  const { data: departments } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiGet<Department[]>('/api/departments'),
  })

  const queryClient = useQueryClient()

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees', departmentId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (departmentId && departmentId !== 'all') {
        params.set('departmentId', departmentId)
      }
      return apiGet<Employee[]>(`/api/employees?${params.toString()}`)
    },
    enabled: true,
  })

  const { data: allAttendanceData } = useQuery<AttendanceData>({
    queryKey: ['attendance-all', fromDate, toDate, departmentId, employeeId, search],
    queryFn: () => {
      const params = new URLSearchParams({
        fromDate,
        toDate,
        page: '1',
        limit: '10000',
      })
      if (departmentId && departmentId !== 'all') {
        params.set('departmentId', departmentId)
      }
      if (employeeId && employeeId !== 'all') {
        params.set('employeeId', employeeId)
      }
      if (search) {
        params.set('search', search)
      }
      return apiGet<AttendanceData>(`/api/attendance?${params.toString()}`)
    },
  })

  const { data: attendanceData, isLoading, refetch } = useQuery<AttendanceData>({
    queryKey: ['attendance', fromDate, toDate, departmentId, employeeId, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        fromDate,
        toDate,
        page: page.toString(),
        limit: '30',
      })
      if (departmentId && departmentId !== 'all') {
        params.set('departmentId', departmentId)
      }
      if (employeeId && employeeId !== 'all') {
        params.set('employeeId', employeeId)
      }
      if (search) {
        params.set('search', search)
      }
      return apiGet<AttendanceData>(`/api/attendance?${params.toString()}`)
    },
  })

  const syncAttendanceMutation = useMutation({
    mutationFn: (data: { fromDate: string; toDate: string }) =>
      apiPost<{ processed: number; skipped: number }>('/api/attendance/sync', data),
    onSuccess: (data) => {
      toast.success(`Synced ${data.processed} records. Skipped ${data.skipped}.`)
      setIsSyncDialogOpen(false)
      refetch()
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance-all'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync attendance')
    },
  })

  const dailyTrendData = useMemo(() => {
    if (!allAttendanceData?.data) return []
    const dateMap = new Map<string, { onTime: number; late: number }>()
    allAttendanceData.data.forEach(record => {
      const dateKey = record.date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { onTime: 0, late: 0 })
      }
      const stats = dateMap.get(dateKey)!
      if (record.isLate) {
        stats.late++
      } else {
        stats.onTime++
      }
    })
    return Array.from(dateMap.entries())
      .map(([date, stats]) => {
        const [y, m, d] = date.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        return {
          date: format(dateObj, 'dd'),
          fullDate: format(dateObj, 'MMM dd'),
          onTime: stats.onTime,
          late: stats.late,
          total: stats.onTime + stats.late,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allAttendanceData])

  const pieData = useMemo(() => {
    if (!allAttendanceData?.data) return []
    const onTime = allAttendanceData.data.filter(r => !r.isLate).length
    const late = allAttendanceData.data.filter(r => r.isLate).length
    if (onTime === 0 && late === 0) return []
    return [
      { name: 'On Time', value: onTime, color: COLORS.onTime },
      { name: 'Late', value: late, color: COLORS.late },
    ]
  }, [allAttendanceData])

  const onLeaveTodayCount = useMemo(() => {
    if (!approvedLeavesData?.data) return 0
    const employeesOnLeave = new Set<string>()
    approvedLeavesData.data.forEach((lr) => {
      const start = typeof lr.startDate === 'string' ? lr.startDate.slice(0, 10) : format(new Date(lr.startDate), 'yyyy-MM-dd')
      const end = typeof lr.endDate === 'string' ? lr.endDate.slice(0, 10) : format(new Date(lr.endDate), 'yyyy-MM-dd')
      if (start <= todayStr && end >= todayStr) {
        employeesOnLeave.add(lr.employeeId)
      }
    })
    return employeesOnLeave.size
  }, [approvedLeavesData, todayStr])

  const heatmapAttendanceDays = useMemo((): AttendanceDay[] => {
    if (!allAttendanceData?.data || !heatmapEmployeeId || heatmapEmployeeId === 'all') return []
    const records = allAttendanceData.data.filter((r) => r.employee.id === heatmapEmployeeId)
    return records.map((r) => {
      const [y, m, d] = r.date.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      const inTime = r.inTime ? (typeof r.inTime === 'string' ? new Date(r.inTime) : r.inTime) : null
      const outTime = r.outTime ? (typeof r.outTime === 'string' ? new Date(r.outTime) : r.outTime) : null
      return {
        date,
        inTime,
        outTime,
        isLate: r.isLate,
        status: r.isLate ? ('late' as const) : ('on-time' as const),
      }
    })
  }, [allAttendanceData, heatmapEmployeeId])

  const heatmapLeaveDays = useMemo(() => {
    if (!approvedLeavesData?.data || !heatmapEmployeeId || heatmapEmployeeId === 'all') return []
    const days: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[] = []
    approvedLeavesData.data
      .filter((lr) => lr.employeeId === heatmapEmployeeId)
      .forEach((lr) => {
        const start = typeof lr.startDate === 'string' ? new Date(lr.startDate.slice(0, 10)) : new Date(lr.startDate)
        const end = typeof lr.endDate === 'string' ? new Date(lr.endDate.slice(0, 10)) : new Date(lr.endDate)
        const sameCalendarDay =
          start.getFullYear() === end.getFullYear() &&
          start.getMonth() === end.getMonth() &&
          start.getDate() === end.getDate()
        const isHalfDayLeave = sameCalendarDay && lr.days === 0.5
        const range = eachDayOfInterval({ start, end })
        range.forEach((d) => {
          days.push({
            date: format(d, 'yyyy-MM-dd'),
            isUnpaid: lr.isUnpaid ?? false,
            ...(isHalfDayLeave ? { isHalfDay: true } : {}),
          })
        })
      })
    return days
  }, [approvedLeavesData, heatmapEmployeeId])

  const formatTime = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return 'N/A'
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj)
  }

  const getNormalizedOutTime = (record: AttendanceRecord): Date | null => {
    if (!record.outTime || !record.inTime) return record.outTime
    const inTime = typeof record.inTime === 'string' ? new Date(record.inTime) : record.inTime
    const outTime = typeof record.outTime === 'string' ? new Date(record.outTime) : record.outTime
    const diffMs = Math.abs(outTime.getTime() - inTime.getTime())
    if (diffMs < 60000) return null
    return record.outTime
  }

  const formatDate = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    return format(new Date(y, m - 1, d), 'PPP')
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleEmployeeChange = (value: string) => {
    setEmployeeId(value)
    setPage(1)
  }

  const todayRecords = todayAttendanceData?.data ?? []
  const presentToday = todayRecords.length
  const lateToday = todayRecords.filter((r) => r.isLate).length
  const periodLate = allAttendanceData?.data.filter((r) => r.isLate).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Monitoring</h1>
          <p className="text-muted-foreground mt-1">Monitor employee attendance across departments</p>
        </div>
        <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Attendance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Attendance from Biometric</DialogTitle>
              <DialogDescription>Fetch attendance data from biometric machine</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={syncFromDate}
                    onChange={(e) => setSyncFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={syncToDate}
                    onChange={(e) => setSyncToDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    syncAttendanceMutation.mutate({
                      fromDate: syncFromDate,
                      toDate: syncToDate,
                    })
                  }}
                  disabled={syncAttendanceMutation.isPending}
                >
                  {syncAttendanceMutation.isPending ? 'Syncing...' : 'Sync'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentToday}</div>
            <p className="text-xs text-muted-foreground">Punched in today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Today</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lateToday}</div>
            <p className="text-xs text-muted-foreground">Late arrivals today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave Today</CardTitle>
            <CalendarOff className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{onLeaveTodayCount}</div>
            <p className="text-xs text-muted-foreground">Approved leave today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Arrivals (Period)</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodLate}</div>
            <p className="text-xs text-muted-foreground">In selected date range</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Daily Attendance Trend</CardTitle>
            <CardDescription>On Time vs Late arrivals per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border rounded-lg shadow-lg p-3">
                              <p className="font-medium mb-1">{payload[0]?.payload?.fullDate}</p>
                              <p className="text-sm text-green-600">On Time: {payload[0]?.value}</p>
                              <p className="text-sm text-red-600">Late: {payload[1]?.value}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="onTime" fill={COLORS.onTime} radius={[4, 4, 0, 0]} name="On Time" />
                    <Bar dataKey="late" fill={COLORS.late} radius={[4, 4, 0, 0]} name="Late" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No attendance data for this period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Punctuality Distribution</CardTitle>
            <CardDescription>Overall on-time vs late ratio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-sm">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Attendance Heatmap</CardTitle>
                <CardDescription>
                  {heatmapEmployeeId === 'all'
                    ? 'Select an employee to view attendance heatmap'
                    : 'View attendance pattern for selected employee'}
                </CardDescription>
              </div>
              <Select value={heatmapEmployeeId} onValueChange={setHeatmapEmployeeId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.user.name} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {heatmapEmployeeId === 'all' ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Select an employee to view attendance heatmap
              </div>
            ) : heatmapAttendanceDays.length > 0 ? (
              <AttendanceHeatmap
                attendance={heatmapAttendanceDays}
                fromDate={fromDate}
                toDate={toDate}
                leaveDays={heatmapLeaveDays}
                holidayDays={heatmapHolidayDays}
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No attendance data for selected employee
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value)
                  setEmployeeId('all')
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={handleEmployeeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.user.name} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>
            Showing {attendanceData?.data.length || 0} of {attendanceData?.pagination.total || 0} records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Exit Time</TableHead>
                    <TableHead>Work Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData?.data.map((record, index) => (
                    <TableRow key={`${record.employee.id}-${record.date}-${index}`}>
                      <TableCell className="font-medium">
                        {record.employee.user.name}
                        <br />
                        <span className="text-xs text-muted-foreground">{record.employee.employeeCode}</span>
                      </TableCell>
                      <TableCell>{record.employee.department?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(record.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(record.inTime)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(getNormalizedOutTime(record))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const normalizedOutTime = getNormalizedOutTime(record)
                          if (!normalizedOutTime || !record.inTime) return 'N/A'
                          if (record.workHours !== null && record.workHours > 0) {
                            return `${record.workHours.toFixed(2)} hours`
                          }
                          return 'N/A'
                        })()}
                      </TableCell>
                      <TableCell>
                        {record.isLate ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertCircle className="h-3 w-3" />
                            Late
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500 hover:bg-green-600 w-fit">On Time</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!attendanceData?.data || attendanceData.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {attendanceData && attendanceData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {attendanceData.pagination.page} of {attendanceData.pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(attendanceData.pagination.totalPages, p + 1))}
                      disabled={page >= attendanceData.pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
