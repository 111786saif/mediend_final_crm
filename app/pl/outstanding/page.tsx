'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Lead } from '@/hooks/use-leads'
import { useState, useEffect, useMemo } from 'react'
import { Building2, CheckCircle, CreditCard, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'

type Preset = 'today' | 'week' | 'mtd' | 'lastMonth' | 'custom'

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getRangeForPreset(preset: Preset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  if (preset === 'custom') {
    return { start: customStart || fmtYmd(now), end: customEnd || fmtYmd(now) }
  }
  if (preset === 'today') {
    return { start: fmtYmd(now), end: fmtYmd(now) }
  }
  if (preset === 'week') {
    const d = new Date(now)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return { start: fmtYmd(d), end: fmtYmd(now) }
  }
  if (preset === 'mtd') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: fmtYmd(start), end: fmtYmd(now) }
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: fmtYmd(start), end: fmtYmd(end) }
}

function isPendingPayout(r: Lead) {
  return (
    r.plRecord?.hospitalPayoutStatus !== 'PAID' ||
    r.plRecord?.doctorPayoutStatus !== 'PAID' ||
    r.plRecord?.mediendInvoiceStatus !== 'PAID'
  )
}

export default function PLOutstandingPage() {
  const router = useRouter()
  const [preset, setPreset] = useState<Preset>('mtd')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })

  useEffect(() => {
    const now = new Date()
    setCustomEnd(fmtYmd(now))
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    setCustomStart(fmtYmd(start))
  }, [])

  useEffect(() => {
    const { start, end } = getRangeForPreset(preset, customStart, customEnd)
    setDateRange({ startDate: start, endDate: end })
  }, [preset, customStart, customEnd])

  const { data: records, isLoading } = useQuery<Lead[]>({
    queryKey: ['outstanding', 'records', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      return await apiGet<Lead[]>(`/api/outstanding?${params.toString()}`)
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  })

  const totalPending = useMemo(
    () =>
      records?.reduce((sum: number, r: Lead) => {
        const plRecord = r.plRecord as { hospitalAmountPending?: number; doctorAmountPending?: number } | undefined
        const hospitalPending = plRecord?.hospitalAmountPending || 0
        const doctorPending = plRecord?.doctorAmountPending || 0
        return sum + hospitalPending + doctorPending
      }, 0) || 0,
    [records]
  )

  const pendingCases = useMemo(() => records?.filter(isPendingPayout).length || 0, [records])

  const paidCases = useMemo(
    () =>
      records?.filter(
        (r: Lead) =>
          r.plRecord?.hospitalPayoutStatus === 'PAID' &&
          r.plRecord?.doctorPayoutStatus === 'PAID' &&
          r.plRecord?.mediendInvoiceStatus === 'PAID'
      ).length || 0,
    [records]
  )

  const topHospitalsPending = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of records ?? []) {
      if (!isPendingPayout(r)) continue
      const h = (r.hospitalName?.trim() || 'Unknown') as string
      m.set(h, (m.get(h) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [records])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">P/L Outstanding</h1>
              <p className="text-muted-foreground mt-1">Payout statuses and pending amounts for discharged cases</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
                {(
                  [
                    ['today', 'Today'],
                    ['week', 'This week'],
                    ['mtd', 'MTD'],
                    ['lastMonth', 'Last month'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={preset === key ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setPreset(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[140px]" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[140px]" />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pending Amount</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalPending.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">Hospital + doctor pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Cases</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCases}</div>
                <p className="text-xs text-muted-foreground mt-1">Any payout not PAID</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paidCases}</div>
                <p className="text-xs text-muted-foreground mt-1">All three statuses PAID</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending by hospital</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {topHospitalsPending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending cases in range</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {topHospitalsPending.map(([name, count]) => (
                      <li key={name} className="flex justify-between gap-2">
                        <span className="truncate font-medium" title={name}>
                          {name}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{count} cases</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Outstanding records</CardTitle>
              <CardDescription>Click a row to edit. Lead date filter uses lead created date.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Ref</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>BDM</TableHead>
                      <TableHead>Surgery Date</TableHead>
                      <TableHead>Bill Amount</TableHead>
                      <TableHead>Net Profit</TableHead>
                      <TableHead>Hospital Payout</TableHead>
                      <TableHead>Hospital Pending</TableHead>
                      <TableHead>Doctor Payout</TableHead>
                      <TableHead>Doctor Pending</TableHead>
                      <TableHead>Invoice Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records?.map((record) => {
                      const pl = record.plRecord as Record<string, unknown> | undefined
                      const oc = record.outstandingCase as { paymentReceived?: boolean; remark2?: string | null } | undefined
                      const surgeryDate = pl?.surgeryDate || record.surgeryDate
                      const surgeryStr = surgeryDate ? new Date(surgeryDate as string).toLocaleDateString('en-IN') : '—'
                      const hospitalPending = (pl?.hospitalAmountPending as number) || 0
                      const doctorPending = (pl?.doctorAmountPending as number) || 0
                      return (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/pl/outstanding/${record.id}`)}
                        >
                          <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <span>{record.leadRef ?? '—'}</span>
                              {record.leadRef ? <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" /> : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{record.patientName ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.hospitalName ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.treatment ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{(pl?.bdmName as string) || record.bd?.name || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{surgeryStr}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {pl?.billAmount != null && Number(pl.billAmount) !== 0
                              ? `₹${Number(pl.billAmount).toLocaleString('en-IN')}`
                              : record.billAmount != null
                                ? `₹${Number(record.billAmount).toLocaleString('en-IN')}`
                                : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            ₹
                            {(
                              (record.plRecord as { finalProfit?: number; mediendNetProfit?: number } | undefined)?.finalProfit ??
                              (record.plRecord as { finalProfit?: number; mediendNetProfit?: number } | undefined)?.mediendNetProfit ??
                              record.netProfit ??
                              0
                            ).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.plRecord?.hospitalPayoutStatus === 'PAID'
                                  ? 'default'
                                  : record.plRecord?.hospitalPayoutStatus === 'PARTIAL'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {record.plRecord?.hospitalPayoutStatus || 'PENDING'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {hospitalPending > 0 ? `₹${hospitalPending.toLocaleString('en-IN')}` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.plRecord?.doctorPayoutStatus === 'PAID'
                                  ? 'default'
                                  : record.plRecord?.doctorPayoutStatus === 'PARTIAL'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {record.plRecord?.doctorPayoutStatus || 'PENDING'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            {doctorPending > 0 ? `₹${doctorPending.toLocaleString('en-IN')}` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.plRecord?.mediendInvoiceStatus === 'PAID'
                                  ? 'default'
                                  : record.plRecord?.mediendInvoiceStatus === 'SENT'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {record.plRecord?.mediendInvoiceStatus || 'PENDING'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={oc?.paymentReceived ? 'default' : 'outline'}
                              className={oc?.paymentReceived ? 'bg-green-500 hover:bg-green-600' : ''}
                            >
                              {oc?.paymentReceived ? 'Received' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <span className="text-sm text-muted-foreground truncate block" title={oc?.remark2 ?? ''}>
                              {oc?.remark2 || '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {(!records || records.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                          No outstanding records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
