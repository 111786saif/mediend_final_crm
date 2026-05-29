'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import { formatPlDate, formatPlMonth, formatPlRupee } from '@/lib/pl/resolve-pl-row'

type HospitalDetail = {
  name: string
  kpis: {
    totalCases: number
    amountReceived: number
    pendingOutstanding: number
    mediendShare: number
  }
  cases: Array<{
    leadId: string
    leadRef: string | null
    patientName: string | null
    doctorName: string | null
    surgeryDate: string | null
    month: string | null
    status: string | null
    billAmount: number | null
    mediendShareAmount: number | null
    hospitalAmountPending: number | null
    mediendInvoiceStatus: string | null
    mediendReceived: number
  }>
}

export default function HospitalDetailPage() {
  const params = useParams()
  const search = useSearchParams()
  const rawName = params.name as string
  const name = decodeURIComponent(rawName)
  const startDate = search.get('startDate')
  const endDate = search.get('endDate')

  const { data, isLoading } = useQuery<HospitalDetail>({
    queryKey: ['hospitals', name, startDate, endDate],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (startDate && endDate) {
        qs.set('startDate', startDate)
        qs.set('endDate', endDate)
      }
      const tail = qs.toString()
      return apiGet<HospitalDetail>(
        `/api/hospitals/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`
      )
    },
    enabled: !!name,
  })

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/35 to-indigo-50/35 p-6 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="text-sky-800 dark:text-sky-200">
              <Link href="/hospitals" aria-label="Back to hospital list">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/hospitals" className="font-medium hover:text-foreground">
                  Hospital List
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{name}</span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5 flex items-center gap-2 bg-gradient-to-r from-sky-800 to-indigo-800 bg-clip-text text-transparent dark:from-sky-200 dark:to-indigo-200">
                <Building2 className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                {name}
              </h1>
              {startDate && endDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Filtered: {startDate} → {endDate}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <KpiTile label="Cases" value={data?.kpis.totalCases ?? 0} />
            <KpiTile label="Amount received" value={formatPlRupee(data?.kpis.amountReceived ?? null)} />
            <KpiTile label="Pending outstanding" value={formatPlRupee(data?.kpis.pendingOutstanding ?? null)} />
            <KpiTile label="Total MediEND share" value={formatPlRupee(data?.kpis.mediendShare ?? null)} />
          </div>

          <Card className="overflow-hidden border-sky-200/50 shadow-md dark:border-sky-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-sky-500/10 to-indigo-500/8">
              <CardTitle className="text-sky-950 dark:text-sky-100">Cases</CardTitle>
              <CardDescription>Click a case to open its outstanding record</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sky-50/40 hover:bg-sky-50/40 dark:bg-sky-950/20">
                    <TableHead>Lead Ref</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Surgery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">MediEND share</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !data?.cases?.length ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No cases yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cases.map((c) => (
                      <TableRow
                        key={c.leadId}
                        className="cursor-pointer hover:bg-sky-50/30 dark:hover:bg-sky-950/15"
                        onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                      >
                        <TableCell className="whitespace-nowrap">{c.leadRef ?? '—'}</TableCell>
                        <TableCell>{c.patientName ?? '—'}</TableCell>
                        <TableCell>{c.doctorName ?? '—'}</TableCell>
                        <TableCell>{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                        <TableCell>{formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}</TableCell>
                        <TableCell>{c.status ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.billAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.mediendShareAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.mediendReceived || null)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.hospitalAmountPending)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.mediendInvoiceStatus === 'PAID'
                                ? 'default'
                                : c.mediendInvoiceStatus === 'SENT'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {c.mediendInvoiceStatus ?? 'PENDING'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function KpiTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="border-sky-200/40 dark:border-sky-800/30">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
