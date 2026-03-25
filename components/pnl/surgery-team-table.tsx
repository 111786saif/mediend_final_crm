'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trophy, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export type TeamRow = {
  teamId: string
  teamName: string
  teamLeadName: string | null
  surgeries: number
  revenue: number
  expenses: number
  netProfit: number
  memberCount?: number
  seatCost?: number
  leadCount?: number
  marketingCost?: number
  diseaseDistribution?: { label: string; count: number; revenue: number }[]
  circleDistribution?: { label: string; count: number }[]
  hospitalDistribution?: { label: string; count: number }[]
}

export function SurgeryTeamTable({
  rows,
  onRowClick,
}: {
  rows: TeamRow[]
  onRowClick?: (row: TeamRow) => void
}) {
  const sorted = [...rows].sort((a, b) => b.netProfit - a.netProfit)
  const topId = sorted[0]?.teamId
  const bottomId = sorted[sorted.length - 1]?.teamId

  const showLeads = sorted.some((r) => r.leadCount != null)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead>Team lead</TableHead>
          <TableHead className="text-right">Surgeries</TableHead>
          {showLeads && (
            <>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Mktg cost</TableHead>
            </>
          )}
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Expenses</TableHead>
          <TableHead className="text-right">Net P&amp;L</TableHead>
          <TableHead className="text-right">Avg / case</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => {
          const avg = r.surgeries > 0 ? r.netProfit / r.surgeries : 0
          const isTop = r.teamId === topId && sorted.length > 1
          const isBottom = r.teamId === bottomId && sorted.length > 1 && r.teamId !== topId
          return (
            <TableRow
              key={r.teamId}
              className={cn(
                onRowClick && 'cursor-pointer hover:bg-muted/60',
                isTop && 'bg-amber-50/90 dark:bg-amber-950/25',
                isBottom && 'bg-orange-50/60 dark:bg-orange-950/20'
              )}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="font-medium">
                {isTop && <Trophy className="inline h-4 w-4 text-amber-500 mr-1" />}
                {isBottom && <TrendingDown className="inline h-4 w-4 text-orange-500 mr-1" />}
                {r.teamName}
              </TableCell>
              <TableCell>{r.teamLeadName || '—'}</TableCell>
              <TableCell className="text-right">{r.surgeries}</TableCell>
              {showLeads && (
                <>
                  <TableCell className="text-right tabular-nums">{r.leadCount ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInr(r.marketingCost ?? 0)}</TableCell>
                </>
              )}
              <TableCell className="text-right tabular-nums">{formatInr(r.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums text-rose-600">{formatInr(r.expenses)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-emerald-700">{formatInr(r.netProfit)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{formatInr(avg)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
