'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState, useEffect, useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { ColumnFilter } from '@/components/ui/column-filter'
import { usePermissions } from '@/hooks/use-permissions'
import { RESOURCE_MAP } from '@/lib/rbac/resourceMap'
import {
  BarChart3,
  DollarSign,
  Stethoscope,
  TrendingUp,
  Wallet,
  Table2,
  Calendar,
  X,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { DiseaseDistribution } from '@/components/dashboard/DiseaseDistribution'

function generateMonthOptions() {
  const months: { key: string; label: string }[] = []
  const now = new Date()
  const startYear = 2022
  const startMonth = 0
  let y = now.getFullYear()
  let m = now.getMonth()
  while (y > startYear || (y === startYear && m >= startMonth)) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const d = new Date(y, m, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ key, label })
    m--
    if (m < 0) { m = 11; y-- }
  }
  return months
}

const MONTH_OPTIONS = generateMonthOptions()

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inNumberRange(value: number, filter: unknown): boolean {
  if (filter == null) return true
  if (Array.isArray(filter) && filter.length === 2) {
    return value >= filter[0] && value <= filter[1]
  }
  if (typeof filter === 'object' && ('min' in filter || 'max' in filter)) {
    const { min, max } = filter as { min?: number | null; max?: number | null }
    if (min != null && value < min) return false
    if (max != null && value > max) return false
    return true
  }
  return true
}

export interface SurgeryDashboardData {
  surgeryCount: number
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  avgRevenuePerSurgery: number
  diseaseDistribution: { category: string; count: number; revenue: number }[]
  hospitalDistribution: { hospital: string; count: number; revenue: number }[]
  bdBreakdown: {
    bdId: string
    bdName: string
    teamName: string | null
    surgeries: number
    revenue: number
    expenses: number
    netProfit: number
  }[]
  teams: { id: string; name: string; managerName: string }[]
}

export default function PLSurgeryDashboardPage() {
  const { hasAccess, permissions } = usePermissions()
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [teamTab, setTeamTab] = useState('all')

  // Per-column filter state
  const [bdFilter, setBdFilter] = useState<string[]>([])
  const [teamFilter, setTeamFilter] = useState<string[]>([])
  const [surgeriesFilter, setSurgeriesFilter] = useState<[number, number] | undefined>()
  const [revenueFilter, setRevenueFilter] = useState<[number, number] | undefined>()
  const [expensesFilter, setExpensesFilter] = useState<[number, number] | undefined>()
  const [netProfitFilter, setNetProfitFilter] = useState<[number, number] | undefined>()

  const defaultMonthKey = currentMonthKey()
  const monthsChanged =
    selectedMonths.length !== 1 || selectedMonths[0] !== defaultMonthKey
  const activeFilterCount =
    bdFilter.length +
    teamFilter.length +
    (surgeriesFilter ? 1 : 0) +
    (revenueFilter ? 1 : 0) +
    (expensesFilter ? 1 : 0) +
    (netProfitFilter ? 1 : 0) +
    (teamTab !== 'all' ? 1 : 0)

  const clearFilters = () => {
    setBdFilter([])
    setTeamFilter([])
    setSurgeriesFilter(undefined)
    setRevenueFilter(undefined)
    setExpensesFilter(undefined)
    setNetProfitFilter(undefined)
    setTeamTab('all')
  }

  const handleReset = () => {
    setSelectedMonths([defaultMonthKey])
    clearFilters()
  }

  useEffect(() => {
    if (selectedMonths.length === 0) {
      setDateRange({ startDate: '', endDate: '' })
      return
    }
    const sorted = selectedMonths.slice().sort()
    const start = `${sorted[0]}-01`
    const [y, m] = sorted[sorted.length - 1].split('-').map(Number)
    const endTemp = new Date(y, m, 0)
    const end = endTemp.toISOString().split('T')[0]
    setDateRange({ startDate: start, endDate: end })
  }, [selectedMonths])

  const { data, isLoading } = useQuery<SurgeryDashboardData>({
    queryKey: ['pl', 'surgery-dashboard', dateRange, teamTab],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      if (teamTab !== 'all') params.set('teamId', teamTab)
      return apiGet<SurgeryDashboardData>(`/api/analytics/pl-surgery-dashboard?${params.toString()}`)
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  })

  const diseaseDistributionInput = useMemo(
    () =>
      (data?.diseaseDistribution ?? []).map((row) => ({
        category: row.category,
        count: row.count,
      })),
    [data?.diseaseDistribution],
  )

  const barData =
    data?.hospitalDistribution?.slice(0, 12).map((h) => ({
      name: h.hospital.length > 18 ? `${h.hospital.slice(0, 16)}…` : h.hospital,
      fullName: h.hospital,
      surgeries: h.count,
      revenue: h.revenue,
    })) ?? []

  // Compute filter options (unique values + numeric bounds) from raw data
  const filterOptions = useMemo(() => {
    const breakdown = data?.bdBreakdown ?? []

    let minSurgeries = 0, maxSurgeries = 0
    let minRevenue = 0, maxRevenue = 0
    let minExpenses = 0, maxExpenses = 0
    let minNetProfit = 0, maxNetProfit = 0

    if (breakdown.length > 0) {
      minSurgeries = Math.min(...breakdown.map((r) => r.surgeries))
      maxSurgeries = Math.max(...breakdown.map((r) => r.surgeries))
      minRevenue = Math.min(...breakdown.map((r) => r.revenue))
      maxRevenue = Math.max(...breakdown.map((r) => r.revenue))
      minExpenses = Math.min(...breakdown.map((r) => r.expenses))
      maxExpenses = Math.max(...breakdown.map((r) => r.expenses))
      minNetProfit = Math.min(...breakdown.map((r) => r.netProfit))
      maxNetProfit = Math.max(...breakdown.map((r) => r.netProfit))
    }

    return {
      bd: Array.from(new Set(breakdown.map((r) => r.bdName).filter(Boolean))).sort() as string[],
      team: Array.from(new Set(breakdown.map((r) => r.teamName ?? '—').filter(Boolean))).sort() as string[],
      surgeriesBounds: { min: minSurgeries, max: maxSurgeries },
      revenueBounds: { min: minRevenue, max: maxRevenue },
      expensesBounds: { min: minExpenses, max: maxExpenses },
      netProfitBounds: { min: minNetProfit, max: maxNetProfit },
    }
  }, [data])

  // Apply all active filters client-side
  const filteredBdBreakdown = useMemo(() => {
    let rows = data?.bdBreakdown ?? []

    if (bdFilter.length > 0) {
      rows = rows.filter((r) => bdFilter.includes(r.bdName))
    }
    if (teamFilter.length > 0) {
      rows = rows.filter((r) => teamFilter.includes(r.teamName ?? '—'))
    }
    if (surgeriesFilter) {
      rows = rows.filter((r) => inNumberRange(r.surgeries, surgeriesFilter))
    }
    if (revenueFilter) {
      rows = rows.filter((r) => inNumberRange(r.revenue, revenueFilter))
    }
    if (expensesFilter) {
      rows = rows.filter((r) => inNumberRange(r.expenses, expensesFilter))
    }
    if (netProfitFilter) {
      rows = rows.filter((r) => inNumberRange(r.netProfit, netProfitFilter))
    }

    return rows
  }, [data, bdFilter, teamFilter, surgeriesFilter, revenueFilter, expensesFilter, netProfitFilter])

  // TanStack ColumnDef array — filters live inside each header renderer
  const columns = useMemo<ColumnDef<SurgeryDashboardData['bdBreakdown'][number]>[]>(() => {
    const cols: ColumnDef<SurgeryDashboardData['bdBreakdown'][number]>[] = [
      {
        id: 'bdName',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">BD</span>
            <ColumnFilter
              type="multiSelect"
              options={filterOptions.bd}
              value={bdFilter}
              onChange={(val) => setBdFilter(val as string[])}
            />
          </div>
        ),
        cell: ({ row }) => <div className="font-medium">{row.original.bdName}</div>,
      },
      {
        id: 'teamName',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Team Leader</span>
            <ColumnFilter
              type="multiSelect"
              options={filterOptions.team}
              value={teamFilter}
              onChange={(val) => setTeamFilter(val as string[])}
            />
          </div>
        ),
        cell: ({ row }) => <div className="text-muted-foreground">{row.original.teamName ?? '—'}</div>,
      },
      {
        id: 'surgeries',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[120px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Surgeries</span>
            <ColumnFilter
              type="numberRange"
              value={surgeriesFilter}
              onChange={(val) => setSurgeriesFilter(val as [number, number] | undefined)}
              min={filterOptions.surgeriesBounds.min}
              max={filterOptions.surgeriesBounds.max}
            />
          </div>
        ),
        cell: ({ row }) => <div className="text-right">{row.original.surgeries}</div>,
      },
      {
        id: 'revenue',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Revenue</span>
            <ColumnFilter
              type="numberRange"
              value={revenueFilter}
              onChange={(val) => setRevenueFilter(val as [number, number] | undefined)}
              min={filterOptions.revenueBounds.min}
              max={filterOptions.revenueBounds.max}
            />
          </div>
        ),
        cell: ({ row }) => <div className="text-right">₹{row.original.revenue.toLocaleString('en-IN')}</div>,
      },
      {
        id: 'expenses',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Expenses</span>
            <ColumnFilter
              type="numberRange"
              value={expensesFilter}
              onChange={(val) => setExpensesFilter(val as [number, number] | undefined)}
              min={filterOptions.expensesBounds.min}
              max={filterOptions.expensesBounds.max}
            />
          </div>
        ),
        cell: ({ row }) => <div className="text-right">₹{row.original.expenses.toLocaleString('en-IN')}</div>,
      },
      {
        id: 'netProfit',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Net Profit</span>
            <ColumnFilter
              type="numberRange"
              value={netProfitFilter}
              onChange={(val) => setNetProfitFilter(val as [number, number] | undefined)}
              min={filterOptions.netProfitBounds.min}
              max={filterOptions.netProfitBounds.max}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            ₹{row.original.netProfit.toLocaleString('en-IN')}
          </div>
        ),
      },
    ];

    return cols.filter((col) => {
      let colId = col.id
      if (colId === 'bdName') colId = 'bd'
      if (colId === 'teamName') colId = 'team_leader'
      if (!colId) return true
      const resourceKey = `insurance_pl.pl_surgery.table.dischargeSheet.column.${colId}`
      if (resourceKey in RESOURCE_MAP && resourceKey in permissions) {
        return hasAccess(resourceKey, 'READ')
      }
      return true
    })
  }, [
    filterOptions,
    bdFilter,
    teamFilter,
    surgeriesFilter,
    revenueFilter,
    expensesFilter,
    netProfitFilter,
    hasAccess,
    permissions
  ])

  return (
    <ProtectedRoute>
      <div className="min-h-screen w-full min-w-0 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50/45 p-6 dark:from-slate-950 dark:via-indigo-950/25 dark:to-violet-950/20">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 inline-flex h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 shadow-sm"
                aria-hidden
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-800 via-violet-800 to-purple-800 bg-clip-text text-transparent dark:from-indigo-200 dark:via-violet-200 dark:to-purple-200">
                  P&L Surgery dashboard
                </h1>
                <p className="text-muted-foreground mt-1">
                  Team-wise surgery analytics (Mediend share minus Mediend-paid expenses)
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/pl/dashboard">P&L Ledger</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-slate-300 bg-background/90">
                    <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Months {selectedMonths.length > 0 && `(${selectedMonths.length})`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 max-h-[min(70vh,420px)] overflow-y-auto">
                  <DropdownMenuLabel>Select months</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={selectedMonths.length === MONTH_OPTIONS.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedMonths(MONTH_OPTIONS.map((m) => m.key))
                      else setSelectedMonths([])
                    }}
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {MONTH_OPTIONS.map((m) => (
                    <DropdownMenuCheckboxItem
                      key={m.key}
                      checked={selectedMonths.includes(m.key)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedMonths((prev) => [...prev, m.key])
                        else setSelectedMonths((prev) => prev.filter((k) => k !== m.key))
                      }}
                    >
                      {m.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {(monthsChanged || activeFilterCount > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10"
                  onClick={handleReset}
                >
                  <X className="h-3 w-3" />
                  Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={teamTab} onValueChange={setTeamTab} className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto min-h-10 w-max flex-wrap justify-start gap-1 border border-indigo-200/50 bg-indigo-50/60 p-1 dark:border-indigo-800/40 dark:bg-indigo-950/40">
                <TabsTrigger value="all" className="text-xs sm:text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                  All teams
                </TabsTrigger>
                {data?.teams?.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                    {t.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value={teamTab} className="mt-0 space-y-6">
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">Loading…</div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className={cn('overflow-hidden border-0 shadow-md border-l-4 border-l-violet-500', 'bg-gradient-to-br from-violet-50/90 to-card dark:from-violet-950/35 dark:to-card')}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-violet-900/90 dark:text-violet-100/90">Surgeries</CardTitle>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300"><Stethoscope className="h-4 w-4" /></div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-violet-950 dark:text-violet-50">{data?.surgeryCount ?? 0}</div>
                        <p className="text-xs text-violet-800/70 dark:text-violet-200/70 mt-1">With P&L record in range</p>
                      </CardContent>
                    </Card>
                    <Card className={cn('overflow-hidden border-0 shadow-md border-l-4 border-l-emerald-500', 'bg-gradient-to-br from-emerald-50/90 to-card dark:from-emerald-950/35 dark:to-card')}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-900/90 dark:text-emerald-100/90">Mediend share</CardTitle>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><DollarSign className="h-4 w-4" /></div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">₹{(data?.totalRevenue ?? 0).toLocaleString('en-IN')}</div>
                        <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1">Gross share amount</p>
                      </CardContent>
                    </Card>
                    <Card className={cn('overflow-hidden border-0 shadow-md border-l-4 border-l-orange-500', 'bg-gradient-to-br from-orange-50/90 to-card dark:from-orange-950/35 dark:to-card')}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-900/90 dark:text-orange-100/90">Mediend expenses</CardTitle>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-700 dark:text-orange-300"><Wallet className="h-4 w-4" /></div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-orange-950 dark:text-orange-50">₹{(data?.totalExpenses ?? 0).toLocaleString('en-IN')}</div>
                        <p className="text-xs text-orange-800/70 dark:text-orange-200/70 mt-1">Cab, D&C, referral, etc.</p>
                      </CardContent>
                    </Card>
                    <Card className={cn('overflow-hidden border-0 shadow-md border-l-4 border-l-indigo-600', 'bg-gradient-to-br from-indigo-50/90 to-card dark:from-indigo-950/40 dark:to-card')}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-900/90 dark:text-indigo-100/90">Net profit</CardTitle>
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"><TrendingUp className="h-4 w-4" /></div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums text-indigo-950 dark:text-indigo-50">₹{(data?.netProfit ?? 0).toLocaleString('en-IN')}</div>
                        <p className="text-xs text-indigo-800/70 dark:text-indigo-200/70 mt-1">Avg ₹{(data?.avgRevenuePerSurgery ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / surgery</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <DiseaseDistribution
                      data={diseaseDistributionInput}
                      loading={isLoading}
                    />

                    <Card className="overflow-hidden border-indigo-200/50 shadow-md dark:border-indigo-800/35">
                      <CardHeader className="border-b bg-gradient-to-r from-indigo-500/12 via-blue-500/8 to-transparent">
                        <CardTitle className="flex items-center gap-2 text-lg text-indigo-950 dark:text-indigo-100"><BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />Hospital distribution</CardTitle>
                        <CardDescription>Surgeries per hospital</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[320px]">
                        {barData.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-12">No data</p>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                              <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} interval={0} fontSize={11} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="surgeries" fill="#4f46e5" name="Surgeries" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="min-w-0 w-full overflow-hidden border-violet-200/50 shadow-lg dark:border-violet-800/40">
                    <CardHeader className="border-b bg-gradient-to-r from-violet-500/12 via-indigo-500/8 to-transparent">
                      <CardTitle className="flex items-center gap-2 text-lg text-violet-950 dark:text-violet-100"><Table2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />BD Breakdown</CardTitle>
                      <CardDescription>Revenue = Mediend share; net = share − Mediend expenses</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <DataTable
                        columns={columns}
                        data={filteredBdBreakdown}
                        enablePagination={false}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}
