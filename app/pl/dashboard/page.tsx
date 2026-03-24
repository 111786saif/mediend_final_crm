'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Lead } from '@/hooks/use-leads'
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle,
  Users,
  Calendar,
  Activity,
  CheckCircle2,
  Settings2,
  LayoutDashboard,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { getPhoneDisplay } from '@/lib/phone-utils'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'

const LS_COLUMNS = 'pl-ledger-column-visibility'

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

type PipelineStats = {
  admitted: number
  surgeryScheduled: number
  ipdDone: number
  discharged: number
}

const DEFAULT_COLS: Record<string, boolean> = {
  month: true,
  manager: true,
  bdm: true,
  patient: true,
  phone: true,
  category: true,
  treatment: true,
  circle: false,
  doctor: true,
  hospital: true,
  admissionDate: true,
  surgeryDate: true,
  paymentType: true,
  status: true,
  totalBill: true,
  approvedAmount: true,
  deductionPatient: true,
  implant: true,
  implantPaidBy: true,
  instruments: true,
  instrumentsPaidBy: true,
  cab: true,
  dc: true,
  doctorCharges: true,
  referral: true,
  hospitalSharePct: true,
  hospitalShareAmt: true,
  mediendSharePct: true,
  mediendShareAmt: true,
  netProfit: true,
  remarks: true,
  hospPayout: true,
  docPayout: true,
  invoice: true,
}

function loadColVisibility(): Record<string, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_COLS }
  try {
    const raw = localStorage.getItem(LS_COLUMNS)
    if (!raw) return { ...DEFAULT_COLS }
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { ...DEFAULT_COLS, ...parsed }
  } catch {
    return { ...DEFAULT_COLS }
  }
}

export default function PLLedgerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [preset, setPreset] = useState<Preset>('mtd')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(DEFAULT_COLS)

  useEffect(() => {
    setVisibleCols(loadColVisibility())
  }, [])

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

  const persistCols = useCallback((next: Record<string, boolean>) => {
    setVisibleCols(next)
    try {
      localStorage.setItem(LS_COLUMNS, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCol = useCallback(
    (id: string) => {
      if (id === 'leadRef') return
      persistCols({ ...visibleCols, [id]: !visibleCols[id] })
    },
    [visibleCols, persistCols]
  )

  const { data: records, isLoading } = useQuery<Lead[]>({
    queryKey: ['pl', 'records', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        pipelineStage: 'PL,COMPLETED',
        dateField: 'surgery',
      })
      const leads = await apiGet<Lead[]>(`/api/leads?${params.toString()}`)
      return leads.map((lead: Lead) => ({
        ...lead,
        plRecord: lead.plRecord || {
          finalProfit: lead.netProfit || 0,
          hospitalPayoutStatus: 'PENDING',
          doctorPayoutStatus: 'PENDING',
          mediendInvoiceStatus: 'PENDING',
        },
      }))
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  })

  const { data: pipelineStats } = useQuery<PipelineStats>({
    queryKey: ['pl', 'pipeline-stats', dateRange],
    queryFn: () =>
      apiGet<PipelineStats>(
        `/api/analytics/pl-pipeline-stats?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      ),
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  })

  const totalProfit =
    records?.reduce((sum: number, r: Lead) => sum + (r.plRecord?.finalProfit ?? r.plRecord?.mediendNetProfit ?? 0), 0) || 0
  const avgTicketSize = records && records.length > 0 ? totalProfit / records.length : 0
  const pendingPayouts =
    records?.filter(
      (r: Lead) =>
        r.plRecord?.hospitalPayoutStatus === 'PENDING' || r.plRecord?.doctorPayoutStatus === 'PENDING'
    ).length || 0

  const visibleCount = useMemo(() => 1 + Object.values(visibleCols).filter(Boolean).length, [visibleCols])

  const rupee = (n: number | null | undefined) =>
    n != null && Number(n) !== 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">P/L Ledger</h1>
              <p className="text-muted-foreground mt-1">Profit &amp; loss entries by surgery date</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/pl/surgery-dashboard" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Surgery dashboard
                </Link>
              </Button>
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
                    variant={preset === key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8"
                    onClick={() => setPreset(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-[140px]"
                  />
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-[min(70vh,420px)] overflow-y-auto">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked disabled>
                    Lead ref (always on)
                  </DropdownMenuCheckboxItem>
                  {[
                    ['month', 'Month'],
                    ['manager', 'Manager'],
                    ['bdm', 'BDM'],
                    ['patient', 'Patient'],
                    ['phone', 'Phone'],
                    ['category', 'Category'],
                    ['treatment', 'Treatment'],
                    ['circle', 'Circle'],
                    ['doctor', 'Doctor'],
                    ['hospital', 'Hospital'],
                    ['admissionDate', 'Admission date'],
                    ['surgeryDate', 'Surgery date'],
                    ['paymentType', 'Payment type'],
                    ['status', 'Status'],
                    ['totalBill', 'Total bill'],
                    ['approvedAmount', 'Approved amount'],
                    ['deductionPatient', 'Deduction (patient)'],
                    ['implant', 'Implant cost'],
                    ['implantPaidBy', 'Implant paid by'],
                    ['instruments', 'Instrument cost'],
                    ['instrumentsPaidBy', 'Instruments paid by'],
                    ['cab', 'Cab'],
                    ['dc', 'D&C'],
                    ['doctorCharges', 'Doctor charges'],
                    ['referral', 'Referral'],
                    ['hospitalSharePct', 'Hospital share %'],
                    ['hospitalShareAmt', 'Hospital share'],
                    ['mediendSharePct', 'Mediend share %'],
                    ['mediendShareAmt', 'Mediend share'],
                    ['netProfit', 'Net profit'],
                    ['remarks', 'Remarks'],
                    ['hospPayout', 'Hospital payout'],
                    ['docPayout', 'Doctor payout'],
                    ['invoice', 'Invoice'],
                  ].map(([id, label]) => (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={visibleCols[id] ?? false}
                      onCheckedChange={() => toggleCol(id)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admitted</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pipelineStats?.admitted ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">By admission date</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Surgeries scheduled</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pipelineStats?.surgeryScheduled ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">Expected surgery date</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IPD done</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pipelineStats?.ipdDone ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">Status update in range</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discharged</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pipelineStats?.discharged ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-1">Discharge date</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total net profit</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{totalProfit.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground mt-1">In filtered rows</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg ticket size</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{avgTicketSize.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average per case</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending payouts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPayouts}</div>
                <p className="text-xs text-muted-foreground mt-1">Hospital or doctor pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total cases</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{records?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">P/L rows in period</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>P/L records</CardTitle>
              <CardDescription>Click a row to edit. Filtered by surgery date (lead or P/L record).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Lead ref</TableHead>
                      {visibleCols.month && <TableHead>Month</TableHead>}
                      {visibleCols.manager && <TableHead>Manager</TableHead>}
                      {visibleCols.bdm && <TableHead>BDM</TableHead>}
                      {visibleCols.patient && <TableHead>Patient</TableHead>}
                      {visibleCols.phone && <TableHead>Phone</TableHead>}
                      {visibleCols.category && <TableHead>Category</TableHead>}
                      {visibleCols.treatment && <TableHead>Treatment</TableHead>}
                      {visibleCols.circle && <TableHead>Circle</TableHead>}
                      {visibleCols.doctor && <TableHead>Doctor</TableHead>}
                      {visibleCols.hospital && <TableHead>Hospital</TableHead>}
                      {visibleCols.admissionDate && <TableHead>Admission</TableHead>}
                      {visibleCols.surgeryDate && <TableHead>Surgery</TableHead>}
                      {visibleCols.paymentType && <TableHead>Payment</TableHead>}
                      {visibleCols.status && <TableHead>Status</TableHead>}
                      {visibleCols.totalBill && <TableHead>Total bill</TableHead>}
                      {visibleCols.approvedAmount && <TableHead>Approved amount</TableHead>}
                      {visibleCols.deductionPatient && <TableHead>Deduction (patient)</TableHead>}
                      {visibleCols.implant && <TableHead>Implant</TableHead>}
                      {visibleCols.implantPaidBy && <TableHead>Implant by</TableHead>}
                      {visibleCols.instruments && <TableHead>Instruments</TableHead>}
                      {visibleCols.instrumentsPaidBy && <TableHead>Instr. by</TableHead>}
                      {visibleCols.cab && <TableHead>Cab</TableHead>}
                      {visibleCols.dc && <TableHead>D&amp;C</TableHead>}
                      {visibleCols.doctorCharges && <TableHead>Dr charges</TableHead>}
                      {visibleCols.referral && <TableHead>Referral</TableHead>}
                      {visibleCols.hospitalSharePct && <TableHead>Hosp %</TableHead>}
                      {visibleCols.hospitalShareAmt && <TableHead>Hosp share</TableHead>}
                      {visibleCols.mediendSharePct && <TableHead>Med %</TableHead>}
                      {visibleCols.mediendShareAmt && <TableHead>Mediend share</TableHead>}
                      {visibleCols.netProfit && <TableHead>Net profit</TableHead>}
                      {visibleCols.remarks && <TableHead>Remarks</TableHead>}
                      {visibleCols.hospPayout && <TableHead>Hosp payout</TableHead>}
                      {visibleCols.docPayout && <TableHead>Dr payout</TableHead>}
                      {visibleCols.invoice && <TableHead>Invoice</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records?.map((record) => {
                      const pl = record.plRecord as Record<string, unknown> | undefined
                      const admissionRecord = record.admissionRecord as { admissionDate?: string } | undefined
                      const month = pl?.month
                        ? new Date(pl.month as string).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                        : '—'
                      const surgeryDate = pl?.surgeryDate || record.surgeryDate
                      const surgeryStr = surgeryDate ? new Date(surgeryDate as string).toLocaleDateString('en-IN') : '—'
                      const admissionPl = pl?.admissionDate as string | undefined
                      const admissionStr = admissionPl
                        ? new Date(admissionPl).toLocaleDateString('en-IN')
                        : admissionRecord?.admissionDate
                          ? new Date(admissionRecord.admissionDate).toLocaleDateString('en-IN')
                          : '—'
                      const paidBy = (v: unknown) => (v === 'HOSPITAL' ? 'Hospital' : v === 'MEDIEND' ? 'Mediend' : '—')

                      return (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer hover:bg-muted/60"
                          onClick={() => router.push(`/pl/record/${record.id}`)}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-0.5">
                              <span className="truncate max-w-[120px]" title={String(record.leadRef ?? '')}>
                                {record.leadRef ?? '—'}
                              </span>
                              {record.leadRef && (
                                <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" />
                              )}
                            </div>
                          </TableCell>
                          {visibleCols.month && <TableCell className="whitespace-nowrap">{month}</TableCell>}
                          {visibleCols.manager && (
                            <TableCell className="whitespace-nowrap">{(pl?.managerName as string) || '—'}</TableCell>
                          )}
                          {visibleCols.bdm && (
                            <TableCell className="whitespace-nowrap">
                              {((pl?.bdmName as string) || record.bd?.name || '—') as string}
                            </TableCell>
                          )}
                          {visibleCols.patient && (
                            <TableCell className="whitespace-nowrap">{record.patientName || '—'}</TableCell>
                          )}
                          {visibleCols.phone && (
                            <TableCell className="whitespace-nowrap">
                              {getPhoneDisplay(
                                record.phoneNumber,
                                canViewPhoneNumber(user ? { role: user.role } : null)
                              )}
                            </TableCell>
                          )}
                          {visibleCols.category && (
                            <TableCell className="whitespace-nowrap">{String(record.category || '') || '—'}</TableCell>
                          )}
                          {visibleCols.treatment && (
                            <TableCell className="whitespace-nowrap">{String(record.treatment || '') || '—'}</TableCell>
                          )}
                          {visibleCols.circle && (
                            <TableCell className="whitespace-nowrap">{String(record.circle || '') || '—'}</TableCell>
                          )}
                          {visibleCols.doctor && (
                            <TableCell className="whitespace-nowrap">
                              {String((pl?.doctorName as string) || (record as { surgeonName?: string }).surgeonName || '') ||
                                '—'}
                            </TableCell>
                          )}
                          {visibleCols.hospital && (
                            <TableCell className="whitespace-nowrap">
                              {record.hospitalName || (pl?.hospitalName as string) || '—'}
                            </TableCell>
                          )}
                          {visibleCols.admissionDate && (
                            <TableCell className="whitespace-nowrap">{admissionStr}</TableCell>
                          )}
                          {visibleCols.surgeryDate && (
                            <TableCell className="whitespace-nowrap">{surgeryStr}</TableCell>
                          )}
                          {visibleCols.paymentType && (
                            <TableCell className="whitespace-nowrap">{(pl?.paymentType as string) || '—'}</TableCell>
                          )}
                          {visibleCols.status && (
                            <TableCell className="whitespace-nowrap">{(pl?.status as string) || '—'}</TableCell>
                          )}
                          {visibleCols.totalBill && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(
                                pl?.billAmount != null ? Number(pl.billAmount) : record.billAmount != null ? Number(record.billAmount) : null
                              )}
                            </TableCell>
                          )}
                          {visibleCols.approvedAmount && (
                            <TableCell className="whitespace-nowrap">
                              {pl?.totalAmount != null && Number(pl.totalAmount) !== 0
                                ? rupee(Number(pl.totalAmount))
                                : pl?.approvedOrCash != null && String(pl.approvedOrCash).trim() !== ''
                                  ? String(pl.approvedOrCash)
                                  : '—'}
                            </TableCell>
                          )}
                          {visibleCols.deductionPatient && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.cashOrDedPaid != null ? Number(pl.cashOrDedPaid) : null)}
                            </TableCell>
                          )}
                          {visibleCols.implant && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.implantCost != null ? Number(pl.implantCost) : null)}
                            </TableCell>
                          )}
                          {visibleCols.implantPaidBy && (
                            <TableCell className="whitespace-nowrap">{paidBy(pl?.implantPaidBy)}</TableCell>
                          )}
                          {visibleCols.instruments && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.instrumentsCost != null ? Number(pl.instrumentsCost) : null)}
                            </TableCell>
                          )}
                          {visibleCols.instrumentsPaidBy && (
                            <TableCell className="whitespace-nowrap">{paidBy(pl?.instrumentsPaidBy)}</TableCell>
                          )}
                          {visibleCols.cab && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.cabCharges != null ? Number(pl.cabCharges) : null)}
                            </TableCell>
                          )}
                          {visibleCols.dc && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.dcCharges != null ? Number(pl.dcCharges) : null)}
                            </TableCell>
                          )}
                          {visibleCols.doctorCharges && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.doctorCharges != null ? Number(pl.doctorCharges) : null)}
                            </TableCell>
                          )}
                          {visibleCols.referral && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.referralAmount != null ? Number(pl.referralAmount) : null)}
                            </TableCell>
                          )}
                          {visibleCols.hospitalSharePct && (
                            <TableCell className="whitespace-nowrap">
                              {pl?.hospitalSharePct != null ? `${pl.hospitalSharePct}%` : '—'}
                            </TableCell>
                          )}
                          {visibleCols.hospitalShareAmt && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.hospitalShareAmount != null ? Number(pl.hospitalShareAmount) : null)}
                            </TableCell>
                          )}
                          {visibleCols.mediendSharePct && (
                            <TableCell className="whitespace-nowrap">
                              {pl?.mediendSharePct != null ? `${pl.mediendSharePct}%` : '—'}
                            </TableCell>
                          )}
                          {visibleCols.mediendShareAmt && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.mediendShareAmount != null ? Number(pl.mediendShareAmount) : null)}
                            </TableCell>
                          )}
                          {visibleCols.netProfit && (
                            <TableCell className="whitespace-nowrap font-medium">
                              ₹
                              {(
                                record.plRecord?.finalProfit ??
                                record.plRecord?.mediendNetProfit ??
                                record.netProfit ??
                                0
                              ).toLocaleString('en-IN')}
                            </TableCell>
                          )}
                          {visibleCols.remarks && (
                            <TableCell
                              className="whitespace-nowrap max-w-[120px] truncate"
                              title={(pl?.remarks as string) || ''}
                            >
                              {(pl?.remarks as string) || '—'}
                            </TableCell>
                          )}
                          {visibleCols.hospPayout && (
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
                          )}
                          {visibleCols.docPayout && (
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
                          )}
                          {visibleCols.invoice && (
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
                          )}
                        </TableRow>
                      )
                    })}
                    {(!records || records.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8">
                          No P/L records found
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
