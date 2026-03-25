'use client'

import { useState, Fragment } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export type BdRow = {
  bdId: string
  bdName: string
  teamName: string | null
  surgeries: number
  revenue: number
  expenses: number
  netProfit: number
  leadCount?: number
  marketingCost?: number
  patients: { leadId: string; leadRef: string; patientName: string; netProfit: number }[]
}

export function SurgeryBdTable({
  rows,
  onRowClick,
}: {
  rows: BdRow[]
  onRowClick?: (row: BdRow) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const showLeads = rows.some((r) => r.leadCount != null)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>BD</TableHead>
          <TableHead>Team</TableHead>
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
        {rows.map((r) => {
          const avg = r.surgeries > 0 ? r.netProfit / r.surgeries : 0
          const isOpen = open[r.bdId]
          return (
            <Fragment key={r.bdId}>
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen((o) => ({ ...o, [r.bdId]: !o[r.bdId] }))}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className={cn(onRowClick && 'underline-offset-2 hover:underline text-left')}
                    onClick={() => onRowClick?.(r)}
                  >
                    {r.bdName}
                  </button>
                </TableCell>
                <TableCell>{r.teamName || '—'}</TableCell>
                <TableCell className="text-right">{r.surgeries}</TableCell>
                {showLeads && (
                  <>
                    <TableCell className="text-right tabular-nums">{r.leadCount ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(r.marketingCost ?? 0)}</TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">{formatInr(r.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInr(r.expenses)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatInr(r.netProfit)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{formatInr(avg)}</TableCell>
              </TableRow>
              {isOpen &&
                r.patients.map((p) => (
                  <TableRow key={p.leadId} className="bg-background">
                    <TableCell />
                    <TableCell colSpan={2} className="text-muted-foreground text-sm pl-8">
                      {p.leadRef} — {p.patientName}
                    </TableCell>
                    <TableCell
                      colSpan={showLeads ? 7 : 5}
                      className="text-right tabular-nums text-sm"
                    >
                      {formatInr(p.netProfit)}
                    </TableCell>
                  </TableRow>
                ))}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
