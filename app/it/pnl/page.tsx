'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useTabPermissions } from '@/hooks/use-tab-permissions'
import { PermissionsGuard } from '@/components/permissions-guard'
import { canReadItPnl } from '@/lib/pnl/auth-it-pnl'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ItPnlProjectsPanel } from '@/components/it/it-pnl-projects-panel'
import { ItPnlResourcesPanel } from '@/components/it/it-pnl-resources-panel'
import { LayoutDashboard, Briefcase, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type PnlSummary = {
  totalRevenue: number
  totalCost: number
  netProfit: number
  chartSeries: { monthKey: string; revenue: number; cost: number; net: number }[]
  projects: {
    projectId: string
    name: string
    clientName: string | null
    status: string
    monthly: Record<string, { revenue: number; cost: number; net: number }>
  }[]
}

const TAB_VALUES = ['overview', 'projects', 'resources'] as const
type TabValue = (typeof TAB_VALUES)[number]

function isTabValue(v: string | null): v is TabValue {
  return v !== null && TAB_VALUES.includes(v as TabValue)
}

function ItPnlPageInner() {
  const { user } = useAuth()
  const can = user && canReadItPnl(user)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const [tab, setTab] = useState<TabValue>('overview')

  const staticTabs = useMemo(
    () => [
      { value: 'overview', label: 'Overview', icon: LayoutDashboard, perm: 'main.it_pnl.overview' },
      { value: 'projects', label: 'Projects', icon: Briefcase, perm: 'main.it_pnl.projects' },
      { value: 'resources', label: 'Resources', icon: Users, perm: 'main.it_pnl.resources' },
    ],
    []
  )

  const { allowedTabs, isLoading: isPermsLoading, hasAccess } = useTabPermissions(staticTabs, tab, setTab)

  useEffect(() => {
    if (isTabValue(tabParam) && allowedTabs.some((t) => t.value === tabParam)) {
      setTab(tabParam)
    }
  }, [tabParam, allowedTabs])

  const setTabAndUrl = useCallback(
    (value: string) => {
      const v = isTabValue(value) ? value : 'overview'
      setTab(v)
      const params = new URLSearchParams(searchParams.toString())
      if (v === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', v)
      }
      const q = params.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const now = new Date()
  const [sm, setSm] = useState(now.getMonth() + 1)
  const [sy, setSy] = useState(now.getFullYear())
  const [em, setEm] = useState(now.getMonth() + 1)
  const [ey, setEy] = useState(now.getFullYear())

  const q = useMemo(() => `startMonth=${sm}&startYear=${sy}&endMonth=${em}&endYear=${ey}`, [sm, sy, em, ey])

  const { data, isLoading } = useQuery({
    queryKey: ['it-pnl-summary', q],
    queryFn: () => apiGet<PnlSummary>(`/api/it/pnl-summary?${q}`),
    enabled: !!can && tab === 'overview' && allowedTabs.some((t) => t.value === 'overview'),
  })

  const stackData =
    data?.chartSeries.map((c) => ({
      label: c.monthKey.replace('-', '/'),
      revenue: c.revenue,
      cost: c.cost,
    })) ?? []


  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 w-full min-w-0 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              IT P&amp;L
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Overview, projects, and resources in one place
            </p>
          </div>
        </div>

        <PermissionsGuard
          isLoading={isPermsLoading}
          hasAccess={!!can && allowedTabs.length > 0}
          resourceName="IT P&L"
          variant="card"
        >
          <Tabs value={tab} onValueChange={setTabAndUrl} className="w-full space-y-6">
            <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 rounded-2xl bg-muted/50 p-1.5 md:inline-flex md:w-auto">
              {allowedTabs.map((t) => {
                const Icon = t.icon
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className={cn(
                      'rounded-xl gap-2 px-4 py-2.5 data-[state=active]:shadow-md',
                      'data-[state=active]:bg-background data-[state=active]:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-6 outline-none focus-visible:ring-0">
              {isLoading || !data ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-28 rounded-2xl bg-muted/70 animate-pulse" />
                    ))}
                  </div>
                  <div className="h-[300px] rounded-2xl bg-muted/50 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
                    <div>
                      <Label className="text-xs">From</Label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          className="h-9 w-14 rounded-lg"
                          type="number"
                          value={sm}
                          onChange={(e) => setSm(parseInt(e.target.value, 10) || 1)}
                        />
                        <Input
                          className="h-9 w-20 rounded-lg"
                          type="number"
                          value={sy}
                          onChange={(e) => setSy(parseInt(e.target.value, 10))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">To</Label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          className="h-9 w-14 rounded-lg"
                          type="number"
                          value={em}
                          onChange={(e) => setEm(parseInt(e.target.value, 10) || 1)}
                        />
                        <Input
                          className="h-9 w-20 rounded-lg"
                          type="number"
                          value={ey}
                          onChange={(e) => setEy(parseInt(e.target.value, 10))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <Card className="rounded-2xl border-emerald-200/80 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm transition-transform hover:scale-[1.01]">
                      <CardHeader className="pb-2">
                        <CardDescription>Revenue (bookings)</CardDescription>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {data.totalRevenue.toLocaleString('en-IN')}
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-rose-200/80 bg-rose-50 dark:bg-rose-950/30 shadow-sm transition-transform hover:scale-[1.01]">
                      <CardHeader className="pb-2">
                        <CardDescription>Resource cost</CardDescription>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                        {data.totalCost.toLocaleString('en-IN')}
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border-blue-200/80 bg-blue-50 dark:bg-blue-950/30 shadow-sm transition-transform hover:scale-[1.01]">
                      <CardHeader className="pb-2">
                        <CardDescription>Net</CardDescription>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold tabular-nums">
                        {data.netProfit.toLocaleString('en-IN')}
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl border shadow-sm transition-transform hover:scale-[1.01]">
                      <CardHeader className="pb-2">
                        <CardDescription>Projects</CardDescription>
                      </CardHeader>
                      <CardContent className="text-2xl font-bold">{data.projects.length}</CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl shadow-sm overflow-hidden">
                    <CardHeader>
                      <CardTitle>Revenue vs cost</CardTitle>
                      <CardDescription>Stacked by month for the selected range</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ChartContainer config={{}} className="h-full w-full">
                        <BarChart data={stackData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Bar dataKey="revenue" stackId="a" fill="hsl(142 76% 36%)" name="Revenue" />
                          <Bar dataKey="cost" stackId="a" fill="hsl(346 77% 49%)" name="Cost" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Project snapshot</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data.projects.map((p) => {
                        const net = Object.values(p.monthly).reduce((s, m: any) => s + (m?.net ?? 0), 0) as number
                        return (
                          <Card
                            key={p.projectId}
                            className="rounded-2xl border transition-all duration-200 hover:shadow-md hover:border-sky-300/50"
                          >
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-start gap-2">
                                <CardTitle className="text-base">{p.name}</CardTitle>
                                <Badge variant="secondary" className="rounded-full shrink-0">
                                  {p.status}
                                </Badge>
                              </div>
                              <CardDescription>{p.clientName || '—'}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                              <p>
                                Period net:{' '}
                                <span className="font-semibold tabular-nums">
                                  {net.toLocaleString('en-IN')}
                                </span>
                              </p>
                              <Button size="sm" variant="outline" className="rounded-xl w-full" asChild>
                                <Link href={`/it/pnl/projects/${p.projectId}`}>Open project</Link>
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-0 outline-none focus-visible:ring-0">
              <ItPnlProjectsPanel />
            </TabsContent>

            <TabsContent value="resources" className="mt-0 outline-none focus-visible:ring-0">
              <ItPnlResourcesPanel />
            </TabsContent>
          </Tabs>
        </PermissionsGuard>
      </div>
    </ProtectedRoute>
  )
}

export default function ItPnlOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 md:p-8 space-y-4">
          <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-12 w-full max-w-md rounded-xl bg-muted animate-pulse" />
          <div className="h-64 rounded-2xl bg-muted/60 animate-pulse" />
        </div>
      }
    >
      <ItPnlPageInner />
    </Suspense>
  )
}
