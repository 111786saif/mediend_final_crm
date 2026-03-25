'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

type ProjectDetail = {
  id: string
  name: string
  clientName: string | null
  status: string
  resources: {
    id: string
    resourceType: string
    allocationPercent: number
    monthlyCost: number
    oneTimeCost: number
    employee?: { user?: { name: string } | null } | null
    freelancer?: { name: string } | null
  }[]
  bookings: { month: number; year: number; amount: number }[]
}

export function ItProjectDrawer({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['it-project', projectId],
    queryFn: () => apiGet<ProjectDetail>(`/api/it/projects/${projectId}`),
    enabled: open && !!projectId,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        {!projectId ? null : isLoading || !data ? (
          <p className="text-muted-foreground p-6">Loading…</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{data.name}</SheetTitle>
              <SheetDescription>
                {data.clientName || 'Client'} · <Badge variant="outline">{data.status}</Badge>
              </SheetDescription>
            </SheetHeader>

            <h4 className="font-semibold mt-6 mb-2">Resources</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Alloc %</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.employee?.user?.name || r.freelancer?.name || '—'}
                    </TableCell>
                    <TableCell>{r.resourceType}</TableCell>
                    <TableCell className="text-right">{r.allocationPercent}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(r.monthlyCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <h4 className="font-semibold mt-6 mb-2">Monthly bookings</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bookings.map((b, i) => (
                  <TableRow key={`${b.year}-${b.month}-${i}`}>
                    <TableCell>
                      {b.month}/{b.year}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(b.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
