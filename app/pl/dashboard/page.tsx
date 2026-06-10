'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  X,
  ReceiptText,
} from 'lucide-react'
import Link from 'next/link'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { cn } from '@/lib/utils'
import {
  resolvePlRow,
  formatPlDate,
  formatPlMonth,
  formatPlRupee,
} from '@/lib/pl/resolve-pl-row'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PlRecordSheet } from '@/components/pl/pl-record-sheet'
import { PlPatientDrawer } from '@/components/pl/pl-patient-drawer'
import { PendingPayoutsDrawer } from '@/components/pl/pending-payouts-drawer'

const LS_COLUMNS = 'pl-ledger-column-visibility'

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

type PipelineStats = {
  admitted: number
  surgeryScheduled: number
  ipdDone: number
  discharged: number
}

const DEFAULT_COLS: Record<string, boolean> = {
  actions: true,
  month: true,
  leadReceived: true,
  manager: true,
  bdm: true,
  patient: true,
  category: true,
  treatment: true,
  circle: false,
  doctor: true,
  hospital: true,
  admissionDate: true,
  surgeryDate: true,
  paymentType: true,
  outstandingStatus: true,
  status: true,
  totalBill: true,
  approvedAmount: true,
  deductionTotal: true,
  deductionPatient: true,
  deductionWaived: true,
  amountPaid: true,
  hospitalSharePct: true,
  hospitalShareAmt: true,
  doctorCharges: true,
  implant: true,
  implantPaidBy: true,
  instruments: true,
  instrumentsPaidBy: true,
  dc: true,
  cab: true,
  referral: true,
  mediendSharePct: true,
  mediendShareAmt: true,
  netProfit: true,
  mediendProfit: false,
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
    // Only keep keys that are still part of DEFAULT_COLS — drops stale entries
    // like `phone` from older saved state.
    const merged: Record<string, boolean> = { ...DEFAULT_COLS }
    for (const key of Object.keys(DEFAULT_COLS)) {
      if (key in parsed) merged[key] = Boolean(parsed[key])
    }
    return merged
  } catch {
    return { ...DEFAULT_COLS }
  }
}

export default function PLLedgerPage() {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' })
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(DEFAULT_COLS)

  useEffect(() => {
    setVisibleCols(loadColVisibility())
  }, [])

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
        caseStage: 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING',
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

  const [sheetLeadId, setSheetLeadId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [payoutsDrawerOpen, setPayoutsDrawerOpen] = useState(false)

  const [patientDrawerOpen, setPatientDrawerOpen] = useState(false)
  const [patientDrawerTitle, setPatientDrawerTitle] = useState('')
  const [patientDrawerStage, setPatientDrawerStage] = useState('')
  const [patientDrawerDateField, setPatientDrawerDateField] = useState<'surgery' | 'admission' | 'discharge'>('surgery')

  const [bdFilter, setBdFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [outstandingFilter, setOutstandingFilter] = useState('all')

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

  const activeFilterCount =
    (bdFilter !== 'all' ? 1 : 0) +
    (hospitalFilter !== 'all' ? 1 : 0) +
    (doctorFilter !== 'all' ? 1 : 0) +
    (outstandingFilter !== 'all' ? 1 : 0)

  const clearFilters = () => {
    setBdFilter('all')
    setHospitalFilter('all')
    setDoctorFilter('all')
    setOutstandingFilter('all')
  }

  const tableRecords = useMemo(
    () =>
      records?.filter((r) => {
        if (!(r as Lead).dischargeSheet) return false
        if (activeFilterCount === 0) return true
        const resolved = resolvePlRow(r as unknown as Record<string, unknown>)
        if (bdFilter !== 'all' && resolved.bdm !== bdFilter) return false
        if (hospitalFilter !== 'all' && resolved.hospital !== hospitalFilter) return false
        if (doctorFilter !== 'all' && resolved.doctor !== doctorFilter) return false
        const pl = (r as Lead).plRecord as Record<string, unknown> | undefined
        const ostStatus = (pl?.outstandingStatus as string) || 'NEW'
        if (outstandingFilter !== 'all' && ostStatus !== outstandingFilter) return false
        return true
      }),
    [records, bdFilter, hospitalFilter, doctorFilter, outstandingFilter, activeFilterCount]
  )

  const pendingPayoutRecords = useMemo(
    () =>
      tableRecords?.filter(
        (r) =>
          r.plRecord?.hospitalPayoutStatus === 'PENDING' ||
          r.plRecord?.doctorPayoutStatus === 'PENDING'
      ) ?? [],
    [tableRecords]
  )

  const visibleCount = useMemo(() => 1 + Object.values(visibleCols).filter(Boolean).length, [visibleCols])

  const columnTotals = useMemo(() => {
    const records = tableRecords ?? []
    const sum = (fn: (r: Lead) => number) => records.reduce((acc, r) => acc + (fn(r) || 0), 0)
    const plFn = (key: string) => (r: Lead) => {
      const pl = r.plRecord as Record<string, unknown> | undefined
      return pl?.[key] != null ? Number(pl[key]) : 0
    }
    const resolvedFn = (fn: (resolved: ReturnType<typeof resolvePlRow>) => number | null) => (r: Lead) =>
      fn(resolvePlRow(r as unknown as Record<string, unknown>)) ?? 0
    return {
      totalBill: sum(plFn('billAmount')),
      approvedAmount: sum(plFn('totalAmount')),
      deductionTotal: sum(resolvedFn((x) => x.deductionTotal)),
      deductionPatient: sum(resolvedFn((x) => x.deductionPaidByPatient)),
      deductionWaived: sum(resolvedFn((x) => x.deductionWaived)),
      amountPaid: sum(resolvedFn((x) => (x.approvedAmount ?? 0) + (x.deductionPaidByPatient ?? 0))),
      hospitalShareAmt: sum(plFn('hospitalShareAmount')),
      doctorCharges: sum(plFn('doctorCharges')),
      implant: sum(plFn('implantCost')),
      instruments: sum(plFn('instrumentsCost')),
      dc: sum(plFn('dcCharges')),
      cab: sum(plFn('cabCharges')),
      referral: sum(plFn('referralAmount')),
      mediendShareAmt: sum(plFn('mediendShareAmount')),
      netProfit: sum((r) => r.plRecord?.finalProfit ?? r.plRecord?.mediendNetProfit ?? 0),
      mediendProfit: sum(plFn('mediendProfit')),
    }
  }, [tableRecords])

  const rupee = (n: number | null | undefined) =>
    n != null && Number(n) !== 0 ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/35 to-indigo-50/45 p-6 dark:from-slate-950 dark:via-teal-950/20 dark:to-indigo-950/25">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 inline-flex h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-teal-500 to-indigo-600 shadow-sm"
                aria-hidden
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-800 via-cyan-800 to-indigo-800 bg-clip-text text-transparent dark:from-teal-200 dark:via-cyan-200 dark:to-indigo-200">
                  P/L Ledger
                </h1>
                <p className="text-muted-foreground mt-1">Profit &amp; loss entries by surgery date</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-950/60"
              >
                <Link href="/pl/surgery-dashboard" className="gap-2">
                  <LayoutDashboard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Surgery dashboard
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-300 bg-background/90 dark:border-slate-600"
                  >
                    <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
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
                        if (checked) {
                          setSelectedMonths((prev) => [...prev, m.key])
                        } else {
                          setSelectedMonths((prev) => prev.filter((k) => k !== m.key))
                        }
                      }}
                    >
                      {m.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedMonths.length > 0 && selectedMonths.length < MONTH_OPTIONS.length && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setSelectedMonths([currentMonthKey()])}
                >
                  <X className="h-3 w-3" />
                  Reset
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-300 bg-background/90 dark:border-slate-600"
                  >
                    <Settings2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
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
                    ['actions', 'Actions'],
                    ['month', 'Month'],
                    ['leadReceived', 'Lead Received (Insurance)'],
                    ['manager', 'Manager'],
                    ['bdm', 'BDM'],
                    ['patient', 'Patient'],
                    ['category', 'Category'],
                    ['treatment', 'Treatment'],
                    ['circle', 'Circle'],
                    ['doctor', 'Doctor'],
                    ['hospital', 'Hospital'],
                    ['admissionDate', 'Admission date'],
                    ['surgeryDate', 'Surgery date'],
                    ['paymentType', 'Payment type'],
                    ['outstandingStatus', 'PL Status'],
                    ['status', 'Status'],
                    ['totalBill', 'Total bill'],
                    ['approvedAmount', 'Approved amount'],
                    ['deductionTotal', 'Total Deduction'],
                    ['deductionPatient', 'Deduction Paid by Patient'],
                    ['deductionWaived', 'Waived Off'],
                    ['amountPaid', 'Amount paid'],
                    ['hospitalSharePct', 'MediEND %'],
                    ['hospitalShareAmt', 'MediEND share'],
                    ['doctorCharges', 'Doctor fee'],
                    ['implant', 'Implant'],
                    ['implantPaidBy', 'Implant by'],
                    ['instruments', 'Instrument'],
                    ['instrumentsPaidBy', 'Instrument by'],
                    ['dc', 'D&C'],
                    ['cab', 'Cab'],
                    ['referral', 'Referral'],
                    ['mediendSharePct', 'MediEND Net %'],
                    ['mediendShareAmt', 'MediEND Net'],
                    ['netProfit', 'Net profit'],
                    ['mediendProfit', 'Mediend Profit'],
                    ['remarks', 'Remarks'],
                    ['hospPayout', 'MediEND payout'],
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
            <Select value={outstandingFilter} onValueChange={setOutstandingFilter}>
              <SelectTrigger className="h-9 w-[180px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="OUTSTANDING">Outstanding</SelectItem>
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                Clear filters ({activeFilterCount})
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {tableRecords?.length ?? 0} of {records?.length ?? 0} rows
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-indigo-500 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
                'bg-gradient-to-br from-indigo-50/90 to-card dark:from-indigo-950/35 dark:to-card'
              )}
              onClick={() => {
                setPatientDrawerTitle('Admitted Patients')
                setPatientDrawerStage('ADMITTED,INITIATED')
                setPatientDrawerDateField('admission')
                setPatientDrawerOpen(true)
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-indigo-900/90 dark:text-indigo-100/90">Admitted</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-indigo-950 dark:text-indigo-50">
                  {pipelineStats?.admitted ?? '—'}
                </div>
                <p className="text-xs text-indigo-800/70 dark:text-indigo-200/70 mt-1">By admission date</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-violet-500',
                'bg-gradient-to-br from-violet-50/90 to-card dark:from-violet-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-violet-900/90 dark:text-violet-100/90">ATS</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                  <ReceiptText className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-violet-950 dark:text-violet-50">
                  {tableRecords && tableRecords.length > 0
                    ? `₹${Math.round(columnTotals.amountPaid / tableRecords.length).toLocaleString('en-IN')}`
                    : '—'}
                </div>
                <p className="text-xs text-violet-800/70 dark:text-violet-200/70 mt-1">Amount paid per case</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
                'bg-gradient-to-br from-cyan-50/90 to-card dark:from-cyan-950/35 dark:to-card'
              )}
              onClick={() => {
                setPatientDrawerTitle('IPD Done')
                setPatientDrawerStage('IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING')
                setPatientDrawerDateField('surgery')
                setPatientDrawerOpen(true)
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyan-900/90 dark:text-cyan-100/90">IPD done</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  <Activity className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-cyan-950 dark:text-cyan-50">
                  {records?.length ?? '—'}
                </div>
                <p className="text-xs text-cyan-800/70 dark:text-cyan-200/70 mt-1">Status update in range</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-emerald-500 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
                'bg-gradient-to-br from-emerald-50/90 to-card dark:from-emerald-950/35 dark:to-card'
              )}
              onClick={() => {
                setPatientDrawerTitle('Discharged Patients')
                setPatientDrawerStage('DISCHARGED,CASH_DISCHARGED')
                setPatientDrawerDateField('discharge')
                setPatientDrawerOpen(true)
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900/90 dark:text-emerald-100/90">Discharged</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
                  {pipelineStats?.discharged ?? '—'}
                </div>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1">Discharge date</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-emerald-600',
                'bg-gradient-to-br from-emerald-50/90 to-card dark:from-emerald-950/40 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-900/90 dark:text-emerald-100/90">Total net profit</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
                  ₹{totalProfit.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1">In filtered rows</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-teal-500',
                'bg-gradient-to-br from-teal-50/90 to-card dark:from-teal-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-teal-900/90 dark:text-teal-100/90">Avg ticket size</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-teal-950 dark:text-teal-50">
                  ₹{avgTicketSize.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-teal-800/70 dark:text-teal-200/70 mt-1">Average per case</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-amber-500 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
                'bg-gradient-to-br from-amber-50/90 to-card dark:from-amber-950/35 dark:to-card'
              )}
              onClick={() => setPayoutsDrawerOpen(true)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-900/90 dark:text-amber-100/90">Pending payouts</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <FileText className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-50">{pendingPayouts}</div>
                <p className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1">Hospital or doctor pending</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'overflow-hidden border-0 shadow-md border-l-4 border-l-blue-500',
                'bg-gradient-to-br from-blue-50/90 to-card dark:from-blue-950/35 dark:to-card'
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900/90 dark:text-blue-100/90">Total cases</CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  <CheckCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-blue-950 dark:text-blue-50">{tableRecords?.length || 0}</div>
                <p className="text-xs text-blue-800/70 dark:text-blue-200/70 mt-1">Rows in table</p>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-teal-200/50 shadow-lg dark:border-teal-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-teal-500/12 via-indigo-500/10 to-transparent pb-4">
              <CardTitle className="text-lg text-teal-950 dark:text-teal-100">P/L records</CardTitle>
              <CardDescription>Click a row to edit. Filtered by surgery date (lead or P/L record).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-teal-200/50 bg-teal-50/60 hover:bg-teal-50/60 dark:border-teal-800/35 dark:bg-teal-950/30">
                      <TableHead className="min-w-[140px] font-semibold text-teal-950 dark:text-teal-100">Lead ref</TableHead>
                      {visibleCols.actions && <TableHead>Actions</TableHead>}
                      {visibleCols.month && <TableHead>Month</TableHead>}
                      {visibleCols.leadReceived && <TableHead>Lead Received (Insurance)</TableHead>}
                      {visibleCols.manager && <TableHead>Manager</TableHead>}
                      {visibleCols.bdm && <TableHead>BDM</TableHead>}
                      {visibleCols.patient && <TableHead>Patient</TableHead>}
                      {visibleCols.category && <TableHead>Category</TableHead>}
                      {visibleCols.treatment && <TableHead>Treatment</TableHead>}
                      {visibleCols.circle && <TableHead>Circle</TableHead>}
                      {visibleCols.doctor && <TableHead>Doctor</TableHead>}
                      {visibleCols.hospital && <TableHead>Hospital</TableHead>}
                      {visibleCols.admissionDate && <TableHead>Admission</TableHead>}
                      {visibleCols.surgeryDate && <TableHead>Surgery</TableHead>}
                      {visibleCols.paymentType && <TableHead>Payment</TableHead>}
                      {visibleCols.outstandingStatus && <TableHead>PL Status</TableHead>}
                      {visibleCols.status && <TableHead>Status</TableHead>}
                      {visibleCols.totalBill && <TableHead>Total bill</TableHead>}
                      {visibleCols.approvedAmount && <TableHead>Approved amount</TableHead>}
                      {visibleCols.deductionTotal && <TableHead>Total Deduction</TableHead>}
                      {visibleCols.deductionPatient && <TableHead>Deduction Paid by Patient</TableHead>}
                      {visibleCols.deductionWaived && <TableHead>Waived Off</TableHead>}
                      {visibleCols.amountPaid && <TableHead>Amount paid</TableHead>}
                      {visibleCols.hospitalSharePct && <TableHead>MediEND %</TableHead>}
                      {visibleCols.hospitalShareAmt && <TableHead>MediEND share</TableHead>}
                      {visibleCols.doctorCharges && <TableHead>Doctor fee</TableHead>}
                      {visibleCols.implant && <TableHead>Implant</TableHead>}
                      {visibleCols.implantPaidBy && <TableHead>Implant by</TableHead>}
                      {visibleCols.instruments && <TableHead>Instrument</TableHead>}
                      {visibleCols.instrumentsPaidBy && <TableHead>Instr. by</TableHead>}
                      {visibleCols.dc && <TableHead>D&amp;C</TableHead>}
                      {visibleCols.cab && <TableHead>Cab</TableHead>}
                      {visibleCols.referral && <TableHead>Referral</TableHead>}
                      {visibleCols.mediendSharePct && <TableHead>MediEND Net %</TableHead>}
                      {visibleCols.mediendShareAmt && <TableHead>MediEND Net</TableHead>}
                      {visibleCols.netProfit && <TableHead>Net profit</TableHead>}
                      {visibleCols.mediendProfit && <TableHead>Mediend Profit</TableHead>}
                      {visibleCols.remarks && <TableHead>Remarks</TableHead>}
                      {visibleCols.hospPayout && <TableHead>MediEND payout</TableHead>}
                      {visibleCols.docPayout && <TableHead>Dr payout</TableHead>}
                      {visibleCols.invoice && <TableHead>Invoice</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRecords?.map((record) => {
                      const pl = record.plRecord as Record<string, unknown> | undefined
                      const resolved = resolvePlRow(record as unknown as Record<string, unknown>)
                      const paidBy = (v: unknown) => (v === 'HOSPITAL' ? 'Hospital' : v === 'MEDIEND' ? 'Mediend' : '—')

                      return (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer border-b border-slate-100/80 transition-colors hover:bg-teal-50/50 dark:border-slate-800/50 dark:hover:bg-teal-950/20"
                          onClick={() => { setSheetLeadId(record.id); setSheetOpen(true) }}
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
                          {visibleCols.actions && (
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
                          )}
                          {visibleCols.month && (
                            <TableCell className="whitespace-nowrap">{formatPlMonth(resolved.month)}</TableCell>
                          )}
                          {visibleCols.leadReceived && (
                            <TableCell className="whitespace-nowrap">
                              {formatPlDate(resolved.leadReceivedFromInsuranceAt)}
                            </TableCell>
                          )}
                          {visibleCols.manager && (
                            <TableCell className="whitespace-nowrap">{resolved.manager ?? '—'}</TableCell>
                          )}
                          {visibleCols.bdm && (
                            <TableCell className="whitespace-nowrap">{resolved.bdm ?? '—'}</TableCell>
                          )}
                          {visibleCols.patient && (
                            <TableCell className="whitespace-nowrap">{resolved.patient ?? '—'}</TableCell>
                          )}
                          {visibleCols.category && (
                            <TableCell className="whitespace-nowrap">{resolved.category ?? '—'}</TableCell>
                          )}
                          {visibleCols.treatment && (
                            <TableCell className="whitespace-nowrap">{resolved.treatment ?? '—'}</TableCell>
                          )}
                          {visibleCols.circle && (
                            <TableCell className="whitespace-nowrap">{String(record.circle || '') || '—'}</TableCell>
                          )}
                          {visibleCols.doctor && (
                            <TableCell className="whitespace-nowrap">{resolved.doctor ?? '—'}</TableCell>
                          )}
                          {visibleCols.hospital && (
                            <TableCell className="whitespace-nowrap">{resolved.hospital ?? '—'}</TableCell>
                          )}
                          {visibleCols.admissionDate && (
                            <TableCell className="whitespace-nowrap">{formatPlDate(resolved.admission)}</TableCell>
                          )}
                          {visibleCols.surgeryDate && (
                            <TableCell className="whitespace-nowrap">{formatPlDate(resolved.surgery)}</TableCell>
                          )}
                          {visibleCols.paymentType && (
                            <TableCell className="whitespace-nowrap">{resolved.paymentType ?? '—'}</TableCell>
                          )}
                          {visibleCols.outstandingStatus && (
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  (pl?.outstandingStatus as string) === 'OUTSTANDING'
                                    ? 'default'
                                    : (pl?.outstandingStatus as string) === 'DRAFT'
                                      ? 'secondary'
                                      : 'outline'
                                }
                                className="text-xs"
                              >
                                {(pl?.outstandingStatus as string) || 'NEW'}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleCols.status && (
                            <TableCell className="whitespace-nowrap">{resolved.status ?? '—'}</TableCell>
                          )}
                          {visibleCols.totalBill && (
                            <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.totalBill)}</TableCell>
                          )}
                          {visibleCols.approvedAmount && (
                            <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.approvedAmount)}</TableCell>
                          )}
                          {visibleCols.deductionTotal && (
                            <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionTotal)}</TableCell>
                          )}
                          {visibleCols.deductionPatient && (
                            <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionPaidByPatient)}</TableCell>
                          )}
                          {visibleCols.deductionWaived && (
                            <TableCell className="whitespace-nowrap">{formatPlRupee(resolved.deductionWaived)}</TableCell>
                          )}
                          {visibleCols.amountPaid && (
                            <TableCell className="whitespace-nowrap">
                              {formatPlRupee(
                                (resolved.approvedAmount ?? 0) + (resolved.deductionPaidByPatient ?? 0) || null
                              )}
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
                          {visibleCols.doctorCharges && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.doctorCharges != null ? Number(pl.doctorCharges) : null)}
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
                          {visibleCols.dc && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.dcCharges != null ? Number(pl.dcCharges) : null)}
                            </TableCell>
                          )}
                          {visibleCols.cab && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.cabCharges != null ? Number(pl.cabCharges) : null)}
                            </TableCell>
                          )}
                          {visibleCols.referral && (
                            <TableCell className="whitespace-nowrap">
                              {rupee(pl?.referralAmount != null ? Number(pl.referralAmount) : null)}
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
                          {visibleCols.mediendProfit && (
                            <TableCell className="whitespace-nowrap font-medium">
                              {record.plRecord?.mediendProfit != null
                                ? `₹${Number(record.plRecord.mediendProfit).toLocaleString('en-IN')}`
                                : '—'}
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
                    {(!tableRecords || tableRecords.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={visibleCount} className="text-center text-muted-foreground py-8">
                          No P/L records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {tableRecords && tableRecords.length > 0 && (
                    <TableFooter>
                      <TableRow className="border-t-2 border-teal-200/70 bg-teal-50/70 font-semibold dark:border-teal-800/50 dark:bg-teal-950/40">
                        <TableCell className="whitespace-nowrap">Total ({tableRecords.length})</TableCell>
                        {visibleCols.actions && <TableCell>—</TableCell>}
                        {visibleCols.month && <TableCell>—</TableCell>}
                        {visibleCols.leadReceived && <TableCell>—</TableCell>}
                        {visibleCols.manager && <TableCell>—</TableCell>}
                        {visibleCols.bdm && <TableCell>—</TableCell>}
                        {visibleCols.patient && <TableCell>—</TableCell>}
                        {visibleCols.category && <TableCell>—</TableCell>}
                        {visibleCols.treatment && <TableCell>—</TableCell>}
                        {visibleCols.circle && <TableCell>—</TableCell>}
                        {visibleCols.doctor && <TableCell>—</TableCell>}
                        {visibleCols.hospital && <TableCell>—</TableCell>}
                        {visibleCols.admissionDate && <TableCell>—</TableCell>}
                        {visibleCols.surgeryDate && <TableCell>—</TableCell>}
                        {visibleCols.paymentType && <TableCell>—</TableCell>}
                        {visibleCols.outstandingStatus && <TableCell>—</TableCell>}
                        {visibleCols.status && <TableCell>—</TableCell>}
                        {visibleCols.totalBill && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.totalBill)}</TableCell>}
                        {visibleCols.approvedAmount && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.approvedAmount)}</TableCell>}
                        {visibleCols.deductionTotal && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.deductionTotal)}</TableCell>}
                        {visibleCols.deductionPatient && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.deductionPatient)}</TableCell>}
                        {visibleCols.deductionWaived && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.deductionWaived)}</TableCell>}
                        {visibleCols.amountPaid && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.amountPaid)}</TableCell>}
                        {visibleCols.hospitalSharePct && <TableCell>—</TableCell>}
                        {visibleCols.hospitalShareAmt && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.hospitalShareAmt)}</TableCell>}
                        {visibleCols.doctorCharges && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.doctorCharges)}</TableCell>}
                        {visibleCols.implant && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.implant)}</TableCell>}
                        {visibleCols.implantPaidBy && <TableCell>—</TableCell>}
                        {visibleCols.instruments && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.instruments)}</TableCell>}
                        {visibleCols.instrumentsPaidBy && <TableCell>—</TableCell>}
                        {visibleCols.dc && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.dc)}</TableCell>}
                        {visibleCols.cab && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.cab)}</TableCell>}
                        {visibleCols.referral && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.referral)}</TableCell>}
                        {visibleCols.mediendSharePct && <TableCell>—</TableCell>}
                        {visibleCols.mediendShareAmt && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.mediendShareAmt)}</TableCell>}
                        {visibleCols.netProfit && <TableCell className="whitespace-nowrap font-medium">{formatPlRupee(columnTotals.netProfit)}</TableCell>}
                        {visibleCols.mediendProfit && <TableCell className="whitespace-nowrap font-medium">{formatPlRupee(columnTotals.mediendProfit)}</TableCell>}
                        {visibleCols.remarks && <TableCell>—</TableCell>}
                        {visibleCols.hospPayout && <TableCell>—</TableCell>}
                        {visibleCols.docPayout && <TableCell>—</TableCell>}
                        {visibleCols.invoice && <TableCell>—</TableCell>}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              )}
            </CardContent>
          </Card>

          <PlRecordSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            leadId={sheetLeadId ?? ''}
          />

          <PlPatientDrawer
            open={patientDrawerOpen}
            onOpenChange={setPatientDrawerOpen}
            title={patientDrawerTitle}
            stageFilter={patientDrawerStage}
            dateField={patientDrawerDateField}
            startDate={dateRange.startDate || undefined}
            endDate={dateRange.endDate || undefined}
          />

          <PendingPayoutsDrawer
            open={payoutsDrawerOpen}
            onOpenChange={setPayoutsDrawerOpen}
            records={pendingPayoutRecords}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}
