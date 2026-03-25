'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BdRow } from '@/components/pnl/surgery-bd-table'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

export function SurgeryBdDrawer({
  open,
  onOpenChange,
  bd,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bd: BdRow | null
}) {
  if (!bd) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{bd.bdName}</SheetTitle>
          <SheetDescription>
            {bd.teamName || 'Unassigned'} · {bd.surgeries} surgeries
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-4 pb-6 space-y-3 text-sm">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Revenue</span>
              <span className="tabular-nums font-medium text-emerald-700">{formatInr(bd.revenue)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Expenses</span>
              <span className="tabular-nums text-rose-700">{formatInr(bd.expenses)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Net P&amp;L</span>
              <span className="tabular-nums">{formatInr(bd.netProfit)}</span>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="font-semibold mb-2">Cases</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bd.patients.map((p) => (
                  <TableRow key={p.leadId}>
                    <TableCell className="font-mono text-xs">{p.leadRef}</TableCell>
                    <TableCell>{p.patientName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(p.netProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
