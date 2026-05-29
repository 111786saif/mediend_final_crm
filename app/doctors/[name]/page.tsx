'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Stethoscope } from 'lucide-react'
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

type DoctorDetail = {
  name: string
  kpis: {
    totalCases: number
    totalBill: number
    totalPayable: number
    amountPaid: number
    amountPending: number
    doctorShare: number
    mediendShare: number
  }
  cases: Array<{
    leadId: string
    leadRef: string | null
    patientName: string | null
    hospitalName: string | null
    surgeryDate: string | null
    month: string | null
    status: string | null
    billAmount: number | null
    doctorCharges: number | null
    doctorAmountPending: number | null
    doctorPayoutStatus: string | null
    doctorPaid: number
    mediendShareAmount: number | null
  }>
}

export default function DoctorDetailPage() {
  const params = useParams()
  const search = useSearchParams()
  const rawName = params.name as string
  const name = decodeURIComponent(rawName)
  const startDate = search.get('startDate')
  const endDate = search.get('endDate')

  const { data, isLoading } = useQuery<DoctorDetail>({
    queryKey: ['doctors', name, startDate, endDate],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (startDate && endDate) {
        qs.set('startDate', startDate)
        qs.set('endDate', endDate)
      }
      const tail = qs.toString()
      return apiGet<DoctorDetail>(
        `/api/doctors/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`
      )
    },
    enabled: !!name,
  })

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/35 to-teal-50/35 p-6 dark:from-slate-950 dark:via-cyan-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="text-cyan-800 dark:text-cyan-200">
              <Link href="/doctors" aria-label="Back to doctor list">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <nav className="text-sm text-muted-foreground">
                <Link href="/doctors" className="font-medium hover:text-foreground">
                  Doctor List
                </Link>
                <span className="mx-2">/</span>
                <span className="text-foreground">{name}</span>
              </nav>
              <h1 className="text-2xl font-bold mt-0.5 flex items-center gap-2 bg-gradient-to-r from-cyan-800 to-teal-800 bg-clip-text text-transparent dark:from-cyan-200 dark:to-teal-200">
                <Stethoscope className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                {name}
              </h1>
              {startDate && endDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Filtered: {startDate} → {endDate}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <KpiTile label="Cases" value={data?.kpis.totalCases ?? 0} />
            <KpiTile label="Total bill" value={formatPlRupee(data?.kpis.totalBill ?? null)} />
            <KpiTile label="Total payable" value={formatPlRupee(data?.kpis.totalPayable ?? null)} />
            <KpiTile label="Paid" value={formatPlRupee(data?.kpis.amountPaid ?? null)} />
            <KpiTile label="Pending" value={formatPlRupee(data?.kpis.amountPending ?? null)} />
            <KpiTile label="Doctor share" value={formatPlRupee(data?.kpis.doctorShare ?? null)} />
            <KpiTile label="MediEND share" value={formatPlRupee(data?.kpis.mediendShare ?? null)} />
          </div>

          <Card className="overflow-hidden border-cyan-200/50 shadow-md dark:border-cyan-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-cyan-500/10 to-teal-500/8">
              <CardTitle className="text-cyan-950 dark:text-cyan-100">Cases</CardTitle>
              <CardDescription>Click a case to open its outstanding record</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-cyan-50/40 hover:bg-cyan-50/40 dark:bg-cyan-950/20">
                    <TableHead>Lead Ref</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Surgery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead className="text-right">Doctor charges</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Payout</TableHead>
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
                        className="cursor-pointer hover:bg-cyan-50/30 dark:hover:bg-cyan-950/15"
                        onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                      >
                        <TableCell className="whitespace-nowrap">{c.leadRef ?? '—'}</TableCell>
                        <TableCell>{c.patientName ?? '—'}</TableCell>
                        <TableCell>{c.hospitalName ?? '—'}</TableCell>
                        <TableCell>{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                        <TableCell>{formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}</TableCell>
                        <TableCell>{c.status ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.billAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.doctorCharges)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.doctorPaid || null)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPlRupee(c.doctorAmountPending)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.doctorPayoutStatus === 'PAID'
                                ? 'default'
                                : c.doctorPayoutStatus === 'PARTIAL'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {c.doctorPayoutStatus ?? 'PENDING'}
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
    <Card className="border-cyan-200/40 dark:border-cyan-800/30">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
