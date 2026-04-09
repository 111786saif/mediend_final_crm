'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { Building2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HRAnalytics } from '@/components/hr/hr-dashboard'
import type { HRDashboardFilters } from './md-hr-filter-drawer'

const CHART_PALETTE = ['#3b82f6', '#8b5cf6', '#6366f1', '#4f46e5', '#7c3aed', '#a855f7', '#ec4899', '#06b6d4']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatCurrencyFull(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

interface EmployeeItem {
  id: string
  employeeCode: string
  departmentId: string | null
  user: { name: string }
  department: { name: string; id: string } | null
}

interface MdHrDepartmentsTabProps {
  filters: HRDashboardFilters
}

export function MdHrDepartmentsTab({ filters }: MdHrDepartmentsTabProps) {
  const isMobile = useIsMobile()
  const [selectedDept, setSelectedDept] = useState<string | null>(null)

  const { data: analytics, isLoading } = useQuery<HRAnalytics>({
    queryKey: ['analytics', 'md', 'hr', filters.month, filters.year],
    queryFn: () => apiGet<HRAnalytics>(`/api/analytics/md/hr?month=${filters.month}&year=${filters.year}`),
  })

  const { data: employees = [] } = useQuery<EmployeeItem[]>({
    queryKey: ['employees-all'],
    queryFn: () => apiGet<EmployeeItem[]>('/api/employees'),
  })

  const deptFilter = filters.departments.length > 0 ? new Set(filters.departments) : null

  const headcountData = useMemo(() => {
    if (!analytics) return []
    return analytics.departmentHeadcount
      .filter((d) => !deptFilter || deptFilter.has(d.departmentName))
      .sort((a, b) => b.count - a.count)
  }, [analytics, deptFilter])

  const salaryData = useMemo(() => {
    if (!analytics) return []
    return analytics.departmentSalaryBreakdown
      .filter((d) => !deptFilter || deptFilter.has(d.departmentName))
      .sort((a, b) => b.amount - a.amount)
  }, [analytics, deptFilter])

  // Combined department list
  const departmentList = useMemo(() => {
    const headcountMap = new Map(headcountData.map((d) => [d.departmentName, d.count]))
    const salaryMap = new Map(salaryData.map((d) => [d.departmentName, d.amount]))
    const allNames = new Set([...headcountMap.keys(), ...salaryMap.keys()])
    return Array.from(allNames)
      .map((name) => ({
        name,
        count: headcountMap.get(name) ?? 0,
        salary: salaryMap.get(name) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [headcountData, salaryData])

  const selectedDeptEmployees = useMemo(() => {
    if (!selectedDept) return []
    return employees
      .filter((e) => e.department?.name === selectedDept)
      .sort((a, b) => a.user.name.localeCompare(b.user.name))
  }, [selectedDept, employees])

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">No data available</CardContent>
      </Card>
    )
  }

  const totalHeadcount = headcountData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-5 sm:space-y-7 pb-8">
      {/* Department List (shown first on mobile for better touch interaction) */}
      <Card>
        <CardHeader className="px-4 sm:px-6 pb-3">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Departments</CardTitle>
            <Badge variant="secondary" className="ml-auto">{totalHeadcount} employees</Badge>
          </div>
          <CardDescription>{MONTHS[filters.month - 1]} {filters.year}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <div className="space-y-2">
            {departmentList.map((dept, i) => (
              <button
                key={dept.name}
                type="button"
                className="w-full text-left rounded-xl border bg-card px-4 py-3.5 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all flex items-center gap-3 min-h-[52px]"
                onClick={() => setSelectedDept(dept.name)}
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{dept.name}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{dept.count}</p>
                    <p className="text-xs text-muted-foreground">people</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium tabular-nums">{formatCurrency(dept.salary)}</p>
                    <p className="text-xs text-muted-foreground">salary</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Headcount Chart */}
      {headcountData.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <CardTitle className="text-lg">Headcount by Department</CardTitle>
            </div>
            <CardDescription>{totalHeadcount} employees total</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ChartContainer
              config={{ count: { label: 'Employees', color: '#3b82f6' } }}
              className="w-full"
              style={{ height: Math.max(180, headcountData.length * 40) }}
            >
              <BarChart
                data={headcountData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="departmentName"
                  type="category"
                  width={90}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 12)}…` : String(v))}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {headcountData.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Salary Chart */}
      {salaryData.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              <CardTitle className="text-lg">Salary by Department</CardTitle>
            </div>
            <CardDescription>
              {analytics.kpis.hasPayrollData ? 'Net payable' : 'CTC estimate'} — {MONTHS[filters.month - 1]} {filters.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ChartContainer
              config={{ amount: { label: 'Amount', color: '#8b5cf6' } }}
              className="w-full"
              style={{ height: Math.max(180, salaryData.length * 40) }}
            >
              <BarChart
                data={salaryData}
                layout="vertical"
                margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="departmentName"
                  type="category"
                  width={90}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 12)}…` : String(v))}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrencyFull(Number(v))} />} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {salaryData.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Department Detail Drawer */}
      <Drawer open={!!selectedDept} onOpenChange={(open) => !open && setSelectedDept(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              {selectedDept ?? 'Department'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selectedDept && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-2xl font-bold">{selectedDeptEmployees.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Employees</p>
                  </div>
                  <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-2xl font-bold">
                      {formatCurrency(departmentList.find((d) => d.name === selectedDept)?.salary ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Salary</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Team members
                  </p>
                  {selectedDeptEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No employees</p>
                  ) : (
                    <div className="overflow-y-auto max-h-[50dvh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm">Name</TableHead>
                            <TableHead className="text-sm">Code</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDeptEmployees.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="text-sm font-medium py-3">{e.user.name}</TableCell>
                              <TableCell className="text-sm py-3 font-mono text-muted-foreground">{e.employeeCode}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
