'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { TeamRow } from '@/components/pnl/surgery-team-table'
import type { BdRow } from '@/components/pnl/surgery-bd-table'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function SurgeryTeamDrawer({
  open,
  onOpenChange,
  team,
  seatCostPerEmployee,
  bdRows,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  team: TeamRow | null
  seatCostPerEmployee: number
  bdRows: BdRow[]
}) {
  if (!team) return null
  const bdsInTeam = bdRows.filter((b) => b.managerName === team.managerName || (team.groupId === 'unassigned' && !b.managerName))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{team.groupName}</SheetTitle>
          <SheetDescription>Team P&amp;L drill-down</SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4 pb-6 space-y-3 text-sm">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <p>
              <span className="text-muted-foreground">Manager:</span> {team.managerName || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Team members:</span> {team.memberCount ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Seat cost @ {formatInr(seatCostPerEmployee)} / head:</span>{' '}
              <span className="font-medium tabular-nums">{formatInr(team.seatCost ?? 0)}</span>
            </p>
            {team.leadCount != null && (
              <p>
                <span className="text-muted-foreground">Leads (range):</span>{' '}
                <span className="font-medium tabular-nums">{team.leadCount}</span>
              </p>
            )}
            {team.marketingCost != null && (
              <p>
                <span className="text-muted-foreground">Allocated marketing:</span>{' '}
                <span className="font-medium tabular-nums">{formatInr(team.marketingCost)}</span>
              </p>
            )}
          </div>

          {(team.diseaseDistribution?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold">Disease mix</h4>
              <div className="h-[200px] w-full">
                <ChartContainer config={{}} className="h-full w-full">
                  <PieChart>
                    <Pie
                      data={team.diseaseDistribution!.slice(0, 8)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                    >
                      {team.diseaseDistribution!.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={`hsl(${(i * 47) % 360} 65% 48%)`} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>
          )}

          {(team.circleDistribution?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold">Circle</h4>
              <div className="h-[200px] w-full overflow-x-auto">
                <ChartContainer config={{}} className="h-full min-w-[280px]">
                  <BarChart
                    data={team.circleDistribution!.slice(0, 10)}
                    margin={{ top: 8, right: 8, left: 8, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-30} textAnchor="end" height={56} interval={0} className="text-[10px]" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(221 83% 53%)" name="Leads/cases" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}

          {(team.hospitalDistribution?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="font-semibold">Hospital</h4>
              <div className="h-[200px] w-full overflow-x-auto">
                <ChartContainer config={{}} className="h-full min-w-[280px]">
                  <BarChart
                    data={team.hospitalDistribution!.slice(0, 10)}
                    margin={{ top: 8, right: 8, left: 8, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-30} textAnchor="end" height={56} interval={0} className="text-[10px]" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(173 58% 39%)" name="Cases" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}

          <h4 className="font-semibold pt-2">BDs on this team</h4>
          <div className="rounded-lg border bg-card p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BD</TableHead>
                  <TableHead className="text-right">Net P&amp;L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bdsInTeam.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No BD rows for this team in range
                    </TableCell>
                  </TableRow>
                ) : (
                  bdsInTeam.map((b) => (
                    <TableRow key={b.bdId}>
                      <TableCell>{b.bdName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(b.netProfit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
