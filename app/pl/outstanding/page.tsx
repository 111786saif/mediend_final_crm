'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Lead } from '@/hooks/use-leads'
import { useState, useEffect, useMemo } from 'react'
import { Building2, Calendar, CheckCircle, CreditCard, FileText, X } from 'lucide-react'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { cn } from '@/lib/utils'
import {
  resolvePlRow,
  formatPlDate,
  formatPlMonth,
  formatPlRupee,
} from '@/lib/pl/resolve-pl-row'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PlOutstandingSheet } from '@/components/pl/pl-outstanding-sheet'

function generateMonthOptions() {
  const months: { key: string; label: string }[] = []
  const now = new Date()
  const startYear = 2022
  const startMonth = 0
  let y = now.getFullYear()
  let m = now.getMonth()
  while (y > startYear || (y === startYear && m >= startMonth)) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const d = new Date(y, m, 1)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ key, label })
    m--
    if (m < 0) { m = 11; y-- }
  }
  return months
}

const MONTH_OPTIONS = generateMonthOptions()

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isPendingPayout(r: Lead) {
  return (
    r.plRecord?.hospitalPayoutStatus !== 'PAID' ||
    r.plRecord?.doctorPayoutStatus !== 'PAID' ||
    r.plRecord?.mediendInvoiceStatus !== 'PAID'
  )
}

export default function PLOutstandingPage() {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })

  useEffect(() => {
    if (selectedMonths.length === 0) {
      setDateRange({ startDate: '', endDate: '' })
      return
    }
    const sorted = selectedMonths.slice().sort()
    const start = `${sorted[0]}-01`
    const [y, m] = sorted[sorted.length - 1].split('-').map(Number)
    const endTemp = new Date(y, m, 0)
    const end = endTemp.toISOString().split('T')[0]
    setDateRange({ startDate: start, endDate: end })
  }, [selectedMonths])

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

  const [bdFilter, setBdFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')

  const [sheetLeadId, setSheetLeadId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filterOptions = useMemo(() => {
    const bds = new Set<string>()
    const hospitals = new Set<string>()
    const doctors = new Set<string>()
    for (const r of records ?? []) {
      const resolved = resolvePlRow(r as unknown as Record<string, unknown>)
      if (resolved.bdm) bds.add(resolved.bdm)
      if (resolved.hospital) hospitals.add(resolved.hospital)
      if (resolved.doctor) doctors.add(resolved.doctor)
    }
    return {
      bds: Array.from(bds).sort((a, b) => a.localeCompare(b)),
      hospitals: Array.from(hospitals).sort((a, b) => a.localeCompare(b)),
      doctors: Array.from(doctors).sort((a, b) => a.localeCompare(b)),
    }
  }, [records])

  const filteredRecords = useMemo(() => {
    if (!records) return [] as Lead[]
    if (bdFilter === 'all' && hospitalFilter === 'all' && doctorFilter === 'all') return records
    return records.filter((r) => {
      const resolved = resolvePlRow(r as unknown as Record<string, unknown>)
      if (bdFilter !== 'all' && resolved.bdm !== bdFilter) return false
      if (hospitalFilter !== 'all' && resolved.hospital !== hospitalFilter) return false
      if (doctorFilter !== 'all' && resolved.doctor !== doctorFilter) return false
      return true
    })
  }, [records, bdFilter, hospitalFilter, doctorFilter])

  const activeFilterCount =
    (bdFilter !== 'all' ? 1 : 0) +
    (hospitalFilter !== 'all' ? 1 : 0) +
    (doctorFilter !== 'all' ? 1 : 0)

  const clearFilters = () => {
    setBdFilter('all')
    setHospitalFilter('all')
    setDoctorFilter('all')
  }

  const totalPending = useMemo(
    () =>
      filteredRecords.reduce((sum: number, r: Lead) => {
        const plRecord = r.plRecord as { hospitalAmountPending?: number; doctorAmountPending?: number } | undefined
        const hospitalPending = plRecord?.hospitalAmountPending || 0
        const doctorPending = plRecord?.doctorAmountPending || 0
        return sum + hospitalPending + doctorPending
      }, 0),
    [filteredRecords]
  )

  const pendingCases = useMemo(() => filteredRecords.filter(isPendingPayout).length, [filteredRecords])

  const paidCases = useMemo(
    () =>
      filteredRecords.filter(
        (r: Lead) =>
          r.plRecord?.hospitalPayoutStatus === 'PAID' &&
          r.plRecord?.doctorPayoutStatus === 'PAID' &&
          r.plRecord?.mediendInvoiceStatus === 'PAID'
      ).length,
    [filteredRecords]
  )

  const topHospitalsPending = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filteredRecords) {
      if (!isPendingPayout(r)) continue
      const h = (r.hospitalName?.trim() || 'Unknown') as string
      m.set(h, (m.get(h) ?? 0) + 1)
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredRecords])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/40 to-orange-50/50 p-6 dark:from-slate-950 dark:via-amber-950/25 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-1.5 rounded-full bg-gradient-to-b from-amber-500 to-orange-600 shadow-sm" aria-hidden />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-800 via-orange-700 to-amber-900 bg-clip-text text-transparent dark:from-amber-200 dark:via-orange-200 dark:to-amber-100">
                    P/L Outstanding
                  </h1>
                  <p className="text-muted-foreground mt-1">Payout statuses and pending amounts for discharged cases</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-slate-300 bg-background/90">
                    <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Months {selectedMonths.length > 0 && `(${selectedMonths.length})`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 max-h-[min(70vh,420px)] overflow-y-auto">
                  <DropdownMenuLabel>Select months</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={selectedMonths.length === MONTH_OPTIONS.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedMonths(MONTH_OPTIONS.map((m) => m.key))
                      else setSelectedMonths([])
                    }}
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {MONTH_OPTIONS.map((m) => (
                    <DropdownMenuCheckboxItem
                      key={m.key}
                      checked={selectedMonths.includes(m.key)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedMonths((prev) => [...prev, m.key])
                        else setSelectedMonths((prev) => prev.filter((k) => k !== m.key))
                      }}
                    >
                      {m.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedMonths.length > 0 && selectedMonths.length < MONTH_OPTIONS.length && (
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setSelectedMonths([currentMonthKey()])}>
                  <X className="h-3 w-3" />Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={bdFilter} onValueChange={setBdFilter}>
              <SelectTrigger className="h-9 w-[180px] bg-background">
                <SelectValue placeholder="BD" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BDs</SelectItem>
                {filterOptions.bds.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
              <SelectTrigger className="h-9 w-[220px] bg-background">
                <SelectValue placeholder="Hospital" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hospitals</SelectItem>
                {filterOptions.hospitals.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="h-9 w-[200px] bg-background">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {filterOptions.doctors.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                Clear filters ({activeFilterCount})
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredRecords.length} of {records?.length ?? 0} rows
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-amber-500',
                'bg-gradient-to-br from-amber-50/90 to-card dark:from-amber-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-900/90 dark:text-amber-100/90">Total Pending Amount</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <CreditCard className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-50">
                  ₹{totalPending.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1">Hospital + doctor pending</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-orange-500',
                'bg-gradient-to-br from-orange-50/90 to-card dark:from-orange-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-orange-900/90 dark:text-orange-100/90">Pending Cases</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-700 dark:text-orange-300">
                  <FileText className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-orange-950 dark:text-orange-50">{pendingCases}</div>
                <p className="text-xs text-orange-800/70 dark:text-orange-200/70 mt-1">Any payout not PAID</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-emerald-500',
                'bg-gradient-to-br from-emerald-50/90 to-card dark:from-emerald-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900/90 dark:text-emerald-100/90">Fully Paid</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">{paidCases}</div>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1">All three statuses PAID</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-sky-500',
                'bg-gradient-to-br from-sky-50/90 to-card dark:from-sky-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-sky-900/90 dark:text-sky-100/90">Pending by hospital</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                  <Building2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {topHospitalsPending.length === 0 ? (
                  <p className="text-sm text-sky-800/60 dark:text-sky-200/60">No pending cases in range</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {topHospitalsPending.map(([name, count]) => (
                      <li key={name} className="flex justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-sky-500/10">
                        <span className="truncate font-medium text-sky-950 dark:text-sky-50" title={name}>
                          {name}
                        </span>
                        <span className="shrink-0 font-medium text-sky-700 dark:text-sky-300">{count} cases</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-violet-200/50 shadow-lg dark:border-violet-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-violet-500/12 via-fuchsia-500/8 to-transparent pb-4">
              <CardTitle className="text-lg text-violet-950 dark:text-violet-100">Outstanding records</CardTitle>
              <CardDescription>Click a row to edit. Lead date filter uses lead created date.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-violet-200/40 bg-violet-50/50 hover:bg-violet-50/50 dark:border-violet-800/30 dark:bg-violet-950/25">
                      <TableHead>Lead Ref</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Lead Received (Insurance)</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>BDM</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Admission</TableHead>
                      <TableHead>Surgery</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Bill</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead>Total Deduction</TableHead>
                      <TableHead>Deduction Paid by Patient</TableHead>
                      <TableHead>Waived Off</TableHead>
                      <TableHead>Net Profit</TableHead>
                      <TableHead>MediEND Payout</TableHead>
                      <TableHead>MediEND Pending</TableHead>
                      <TableHead>Doctor Payout</TableHead>
                      <TableHead>Doctor Pending</TableHead>
                      <TableHead>Invoice Status</TableHead>
                      <TableHead>Payment Received</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const pl = record.plRecord as Record<string, unknown> | undefined
                      const oc = record.outstandingCase as { paymentReceived?: boolean; remark2?: string | null } | undefined
                      const resolved = resolvePlRow(record as unknown as Record<string, unknown>)
                      const hospitalPending = (pl?.hospitalAmountPending as number) || 0
                      const doctorPending = (pl?.doctorAmountPending as number) || 0
                      return (
                        <TableRow
                          key={record.id}
                          className={cn(
                            'cursor-pointer border-b border-transparent transition-colors',
                            'hover:bg-amber-50/60 dark:hover:bg-amber-950/20',
                            isPendingPayout(record) && 'bg-amber-50/25 dark:bg-amber-950/10'
                          )}
                          onClick={() => { setSheetLeadId(record.id); setSheetOpen(true) }}
                        >
                          <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <span>{record.leadRef ?? '—'}</span>
                              {record.leadRef ? <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" /> : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {record.dischargeSheet ? (
                              <DischargeSummaryDialog
                                leadId={record.id}
                                preloaded={record.dischargeSheet as never}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlMonth(resolved.month)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatPlDate(resolved.leadReceivedFromInsuranceAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.manager ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.bdm ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.patient ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.category ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.treatment ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.doctor ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.hospital ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlDate(resolved.admission)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlDate(resolved.surgery)}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.paymentType ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{resolved.status ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.totalBill)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.approvedAmount)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionTotal)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionPaidByPatient)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionWaived)}</TableCell>
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
                    {filteredRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={28} className="text-center text-muted-foreground py-8">
                          {records?.length ? 'No rows match your filters' : 'No outstanding records found'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <PlOutstandingSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            leadId={sheetLeadId ?? ''}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}
