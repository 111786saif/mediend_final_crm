'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PnlLeaderboard } from '@/components/pnl/pnl-leaderboard'
import { SurgeryTeamTable, type TeamRow } from '@/components/pnl/surgery-team-table'
import type { BdRow } from '@/components/pnl/surgery-bd-table'
import { SurgeryTeamDrawer } from '@/components/pnl/surgery-team-drawer'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

type SurgeryDash = {
  diseaseDistribution: { category: string; count: number; revenue: number }[]
  hospitalDistribution: { hospital: string; count: number; revenue: number }[]
}

type PnlSurgery = {
  teamBreakdown: TeamRow[]
  cmBreakdown?: TeamRow[]
  bdBreakdown: BdRow[]
  topBds: BdRow[]
  bottomBds: BdRow[]
  topTeams: TeamRow[]
  bottomTeams: TeamRow[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  surgeryCount: number
  salesSurgeryCount?: number
  seatCostPerEmployee: number
  totalMarketingCostCpl?: number
  marketingCostPerBd?: Record<string, number>
  marketingCostPerGroup?: Record<string, number>
}

export function PnlSurgeryTab({
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
  const range = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${startYear}-${pad(startMonth)}-01`
    const end = `${endYear}-${pad(endMonth)}-${pad(new Date(endYear, endMonth, 0).getDate())}`
    return { start, end }
  }, [startMonth, startYear, endMonth, endYear])

  const rangeParams = useMemo(
    () => `startDate=${range.start}&endDate=${range.end}`,
    [range.start, range.end]
  )

  const { data: dash } = useQuery({
    queryKey: ['pl-surgery-dashboard', rangeParams],
    queryFn: () => apiGet<SurgeryDash>(`/api/analytics/pl-surgery-dashboard?${rangeParams}`),
  })

  const { data: pnl } = useQuery({
    queryKey: ['pnl-surgery', rangeParams],
    queryFn: () => apiGet<PnlSurgery>(`/api/pnl/surgery?${rangeParams}`),
  })

  const [teamOpen, setTeamOpen] = useState(false)
  const [teamSel, setTeamSel] = useState<TeamRow | null>(null)

  if (!pnl) {
    return <p className="text-muted-foreground py-8">Loading surgery P&amp;L…</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Surgeries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pnl.salesSurgeryCount ?? pnl.surgeryCount}</div>
            {pnl.salesSurgeryCount != null && pnl.salesSurgeryCount !== pnl.surgeryCount && (
              <p className="text-xs text-muted-foreground">{pnl.surgeryCount} with P&L records</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mediend share</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">
            {pnl.totalRevenue.toLocaleString('en-IN')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mediend expenses</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-rose-600">
            {pnl.totalExpenses.toLocaleString('en-IN')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Marketing (CPL)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-600">
            {(pnl.totalMarketingCostCpl ?? 0).toLocaleString('en-IN')}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{pnl.netProfit.toLocaleString('en-IN')}</CardContent>
        </Card>
      </div>

      {pnl.cmBreakdown && pnl.cmBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Manager P&amp;L</CardTitle>
            <CardDescription>
              Recursive rollup of all TL/ACM teams and BDs under each Category Manager.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <SurgeryTeamTable
              rows={pnl.cmBreakdown}
              onRowClick={(r) => {
                setTeamSel(r)
                setTeamOpen(true)
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team-wise P&amp;L (TL / ACM)</CardTitle>
          <CardDescription>
            Marketing (CPL) is allocated per BD by leads received in the range: each lead with a campaign name
            uses the CPL for that campaign and calendar month (from Campaign CPL). Team column is the sum of
            BDs in that TL/ACM recursive scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <SurgeryTeamTable
            rows={pnl.teamBreakdown}
            onRowClick={(r) => {
              setTeamSel(r)
              setTeamOpen(true)
            }}
          />
        </CardContent>
      </Card>

      {dash && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Disease mix</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ChartContainer config={{}} className="h-full w-full">
                <PieChart>
                  <Pie
                    data={dash.diseaseDistribution.slice(0, 8)}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {dash.diseaseDistribution.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={`hsl(${(i * 40) % 360} 70% 45%)`} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Hospital distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ChartContainer config={{}} className="h-full w-full">
                <BarChart data={dash.hospitalDistribution.slice(0, 12)} margin={{ top: 8, right: 8, left: 8, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hospital" angle={-35} textAnchor="end" height={80} interval={0} className="text-[10px]" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(173 58% 39%)" name="Cases" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <PnlLeaderboard
          title="Top BDs"
          variant="top"
          items={pnl.topBds.map((b) => ({
            id: b.bdId,
            name: b.bdName,
            subtitle: b.managerName,
            value: b.netProfit,
            meta: `${b.surgeries} surgeries`,
          }))}
        />
        <PnlLeaderboard
          title="Bottom BDs"
          variant="bottom"
          items={pnl.bottomBds.map((b) => ({
            id: b.bdId,
            name: b.bdName,
            subtitle: b.managerName,
            value: b.netProfit,
            meta: `${b.surgeries} surgeries`,
          }))}
        />
        <PnlLeaderboard
          title="Top teams"
          variant="top"
          items={pnl.topTeams.map((t) => ({
            id: t.groupId,
            name: t.groupName,
            value: t.netProfit,
          }))}
        />
        <PnlLeaderboard
          title="Bottom teams"
          variant="bottom"
          items={pnl.bottomTeams.map((t) => ({
            id: t.groupId,
            name: t.groupName,
            value: t.netProfit,
          }))}
        />
      </div>

      <SurgeryTeamDrawer
        open={teamOpen}
        onOpenChange={setTeamOpen}
        team={teamSel}
        seatCostPerEmployee={pnl.seatCostPerEmployee}
        bdRows={pnl.bdBreakdown}
      />
    </div>
  )
}
