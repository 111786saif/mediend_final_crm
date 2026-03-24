'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useState, useEffect } from 'react'
import {
  BarChart3,
  DollarSign,
  PieChart as PieChartIcon,
  Stethoscope,
  TrendingUp,
  Wallet,
  Table2,
} from 'lucide-react'
import Link from 'next/link'
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
  Legend,
} from 'recharts'

type Preset = 'today' | 'week' | 'mtd' | 'lastMonth' | 'custom'

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getRangeForPreset(preset: Preset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  if (preset === 'custom') {
    return { start: customStart || fmtYmd(now), end: customEnd || fmtYmd(now) }
  }
  if (preset === 'today') {
    return { start: fmtYmd(now), end: fmtYmd(now) }
  }
  if (preset === 'week') {
    const d = new Date(now)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return { start: fmtYmd(d), end: fmtYmd(now) }
  }
  if (preset === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: fmtYmd(start), end: fmtYmd(now) }
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: fmtYmd(start), end: fmtYmd(end) }
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308', '#a855f7', '#64748b']

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
  teams: { id: string; name: string; teamLead: { name: string } | null }[]
}

export default function PLSurgeryDashboardPage() {
  const [preset, setPreset] = useState<Preset>('mtd')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [teamTab, setTeamTab] = useState('all')

  useEffect(() => {
    const now = new Date()
    setCustomEnd(fmtYmd(now))
    setCustomStart(fmtYmd(new Date(now.getFullYear(), now.getMonth(), 1)))
  }, [])

  useEffect(() => {
    const { start, end } = getRangeForPreset(preset, customStart, customEnd)
    setDateRange({ startDate: start, endDate: end })
  }, [preset, customStart, customEnd])

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

  const pieData =
    data?.diseaseDistribution?.map((d) => ({
      name: d.category,
      value: d.count,
      revenue: d.revenue,
    })) ?? []

  const barData =
    data?.hospitalDistribution?.slice(0, 12).map((h) => ({
      name: h.hospital.length > 18 ? `${h.hospital.slice(0, 16)}…` : h.hospital,
      fullName: h.hospital,
      surgeries: h.count,
      revenue: h.revenue,
    })) ?? []

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">P/L Surgery dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Team-wise surgery analytics (Mediend share minus Mediend-paid expenses)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/pl/dashboard">P/L Ledger</Link>
              </Button>
              <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
                {(
                  [
                    ['today', 'Today'],
                    ['week', 'This week'],
                    ['mtd', 'MTD'],
                    ['lastMonth', 'Last month'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={preset === key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setPreset(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-[140px]"
                  />
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
              )}
            </div>
          </div>

          <Tabs value={teamTab} onValueChange={setTeamTab} className="space-y-4">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto min-h-10 w-max flex-wrap justify-start gap-1 bg-muted/50 p-1">
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  All teams
                </TabsTrigger>
                {data?.teams?.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="max-w-[200px] truncate text-xs sm:text-sm">
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
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Surgeries</CardTitle>
                        <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{data?.surgeryCount ?? 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">With P/L record in range</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mediend share</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          ₹{(data?.totalRevenue ?? 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Gross share amount</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mediend expenses</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          ₹{(data?.totalExpenses ?? 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Cab, D&amp;C, referral, etc.</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net (avg / case)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          ₹{(data?.netProfit ?? 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Avg ₹
                          {(data?.avgRevenuePerSurgery ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}{' '}
                          / surgery
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <PieChartIcon className="h-5 w-5" />
                          Disease distribution
                        </CardTitle>
                        <CardDescription>By case count</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[320px]">
                        {pieData.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-12">No data</p>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {pieData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <BarChart3 className="h-5 w-5" />
                          Hospital distribution
                        </CardTitle>
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
                              <Bar dataKey="surgeries" fill="#6366f1" name="Surgeries" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Table2 className="h-5 w-5" />
                        BD breakdown
                      </CardTitle>
                      <CardDescription>Revenue = Mediend share; net = share − Mediend expenses</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>BD</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right">Surgeries</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Expenses</TableHead>
                            <TableHead className="text-right">Net profit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data?.bdBreakdown ?? []).map((row) => (
                            <TableRow key={row.bdId}>
                              <TableCell className="font-medium">{row.bdName}</TableCell>
                              <TableCell className="text-muted-foreground">{row.teamName ?? '—'}</TableCell>
                              <TableCell className="text-right">{row.surgeries}</TableCell>
                              <TableCell className="text-right">
                                ₹{row.revenue.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{row.expenses.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ₹{row.netProfit.toLocaleString('en-IN')}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!data?.bdBreakdown || data.bdBreakdown.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No surgeries in this period
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
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
