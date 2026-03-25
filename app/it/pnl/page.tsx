'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PnlSummary = {
  totalRevenue: number
  totalCost: number
  netProfit: number
  chartSeries: { monthKey: string; revenue: number; cost: number; net: number }[]
  projects: { projectId: string; name: string; clientName: string | null; status: string; monthly: Record<string, { revenue: number; cost: number; net: number }> }[]
}

export default function ItPnlOverviewPage() {
  const { user } = useAuth()
  const can = user && hasPermission(user, 'it:pnl:read')
  const now = new Date()
  const [sm, setSm] = useState(now.getMonth() + 1)
  const [sy, setSy] = useState(now.getFullYear())
  const [em, setEm] = useState(now.getMonth() + 1)
  const [ey, setEy] = useState(now.getFullYear())

  const q = useMemo(() => `startMonth=${sm}&startYear=${sy}&endMonth=${em}&endYear=${ey}`, [sm, sy, em, ey])

  const { data, isLoading } = useQuery({
    queryKey: ['it-pnl-summary', q],
    queryFn: () => apiGet<PnlSummary>(`/api/it/pnl-summary?${q}`),
    enabled: !!can,
  })

  const stackData =
    data?.chartSeries.map((c) => ({
      label: c.monthKey.replace('-', '/'),
      revenue: c.revenue,
      cost: c.cost,
    })) ?? []

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">IT P&amp;L</h1>
            <p className="text-muted-foreground">Project bookings vs resource cost</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/it/pnl/projects">Projects</Link></Button>
            <Button asChild variant="outline"><Link href="/it/pnl/resources">Resources</Link></Button>
          </div>
        </div>

        {!can ? (
          <Card><CardContent className="pt-6">No access</CardContent></Card>
        ) : isLoading || !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl">
              <div><Label className="text-xs">From</Label><div className="flex gap-1"><Input className="h-9 w-14" type="number" value={sm} onChange={(e) => setSm(parseInt(e.target.value, 10) || 1)} /><Input className="h-9 w-20" type="number" value={sy} onChange={(e) => setSy(parseInt(e.target.value, 10))} /></div></div>
              <div><Label className="text-xs">To</Label><div className="flex gap-1"><Input className="h-9 w-14" type="number" value={em} onChange={(e) => setEm(parseInt(e.target.value, 10) || 1)} /><Input className="h-9 w-20" type="number" value={ey} onChange={(e) => setEy(parseInt(e.target.value, 10))} /></div></div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardHeader className="pb-2"><CardDescription>Revenue (bookings)</CardDescription></CardHeader>
                <CardContent className="text-2xl font-bold text-emerald-700">{data.totalRevenue.toLocaleString('en-IN')}</CardContent>
              </Card>
              <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
                <CardHeader className="pb-2"><CardDescription>Resource cost</CardDescription></CardHeader>
                <CardContent className="text-2xl font-bold text-rose-700">{data.totalCost.toLocaleString('en-IN')}</CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2"><CardDescription>Net</CardDescription></CardHeader>
                <CardContent className="text-2xl font-bold">{data.netProfit.toLocaleString('en-IN')}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Projects</CardDescription></CardHeader>
                <CardContent className="text-2xl font-bold">{data.projects.length}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Revenue vs cost</CardTitle></CardHeader>
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

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.projects.map((p) => {
                const net = Object.values(p.monthly).reduce((s, m) => s + m.net, 0)
                return (
                  <Card key={p.projectId}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge>{p.status}</Badge>
                      </div>
                      <CardDescription>{p.clientName || '—'}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>Period net: <span className="font-semibold">{net.toLocaleString('en-IN')}</span></p>
                      <Button size="sm" variant="link" className="p-0 h-auto" asChild>
                        <Link href={`/it/pnl/projects/${p.projectId}`}>Open</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
