'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ItProjectDrawer } from '@/components/pnl/it-project-drawer'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

type ItSummary = {
  totalRevenue: number
  totalCost: number
  netProfit: number
  projects: {
    projectId: string
    name: string
    clientName: string | null
    status: string
    monthly: Record<string, { revenue: number; cost: number; net: number }>
  }[]
}

export function PnlItTab({
  startMonth,
  startYear,
  endMonth,
  endYear,
}: {
  startMonth: number
  startYear: number
  endMonth: number
  endYear: number
}) {
  const params = useMemo(
    () => `startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`,
    [startMonth, startYear, endMonth, endYear]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['it-pnl-summary', params],
    queryFn: () => apiGet<ItSummary>(`/api/it/pnl-summary?${params}`),
  })

  const [projOpen, setProjOpen] = useState(false)
  const [projId, setProjId] = useState<string | null>(null)

  if (isLoading || !data) {
    return <p className="text-muted-foreground py-8">Loading IT P&amp;L…</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue (booked)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{formatInr(data.totalRevenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resource cost</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-rose-600">{formatInr(data.totalCost)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net P&amp;L</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatInr(data.netProfit)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active projects</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.projects.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project-wise</CardTitle>
          <CardDescription>Click a project for resources &amp; bookings</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.projects.map((p) => {
                let rev = 0
                let cost = 0
                for (const v of Object.values(p.monthly)) {
                  rev += v.revenue
                  cost += v.cost
                }
                const net = rev - cost
                return (
                  <TableRow
                    key={p.projectId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setProjId(p.projectId)
                      setProjOpen(true)
                    }}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.clientName || '—'}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(rev)}</TableCell>
                    <TableCell className="text-right tabular-nums text-rose-700">{formatInr(cost)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatInr(net)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ItProjectDrawer open={projOpen} onOpenChange={setProjOpen} projectId={projId} />
    </div>
  )
}
