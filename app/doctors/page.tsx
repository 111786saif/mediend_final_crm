'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Stethoscope,
  Search,
  Users,
  Activity,
  ReceiptText,
  UserCheck,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { ColumnFilter } from '@/components/ui/column-filter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import { formatPlRupee } from '@/lib/pl/resolve-pl-row'

type Doctor = {
  name: string
  totalCases: number
  totalBill: number
  totalPayable: number
  amountPaid: number
  amountPending: number
  doctorShare: number
  mediendShare: number
}

type Preset = 'all' | 'mtd' | 'lastMonth' | 'qtd' | 'ytd' | 'custom'

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0]
}

function rangeForPreset(p: Preset, customStart: string, customEnd: string) {
  if (p === 'all') return { start: '', end: '' }
  const now = new Date()
  if (p === 'custom') {
    return { start: customStart || '', end: customEnd || '' }
  }
  if (p === 'mtd') {
    return { start: fmtYmd(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmtYmd(now) }
  }
  if (p === 'lastMonth') {
    return {
      start: fmtYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: fmtYmd(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  if (p === 'qtd') {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    return { start: fmtYmd(qStart), end: fmtYmd(now) }
  }
  return { start: fmtYmd(new Date(now.getFullYear(), 0, 1)), end: fmtYmd(now) }
}

export default function DoctorsListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [preset, setPreset] = useState<Preset>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    const now = new Date()
    setCustomEnd(fmtYmd(now))
    setCustomStart(fmtYmd(new Date(now.getFullYear(), now.getMonth(), 1)))
  }, [])

  useEffect(() => {
    setDateRange(rangeForPreset(preset, customStart, customEnd))
  }, [preset, customStart, customEnd])

  // Filter states
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [totalCasesFilter, setTotalCasesFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [totalBillFilter, setTotalBillFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [totalPayableFilter, setTotalPayableFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [amountPaidFilter, setAmountPaidFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [amountPendingFilter, setAmountPendingFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorShareFilter, setDoctorShareFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [mediendShareFilter, setMediendShareFilter] = useState<{ min: number | null; max: number | null } | null>(null)

  const { data: filterConfig } = useQuery<{
    filters: Array<{
      field: string
      label: string
      filterType: string
      filterable: boolean
      options?: Array<{ label: string; value: string }>
      min?: number
      max?: number
    }>
  }>({
    queryKey: ['doctors', 'list', 'filter-config'],
    queryFn: () => apiGet('/api/doctors/filter-config'),
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      doctors: find('doctor')?.options || [],
      casesBounds: { min: find('totalCases')?.min ?? 0, max: find('totalCases')?.max ?? 0 },
      billBounds: { min: find('totalBill')?.min ?? 0, max: find('totalBill')?.max ?? 0 },
      payableBounds: { min: find('totalPayable')?.min ?? 0, max: find('totalPayable')?.max ?? 0 },
      paidBounds: { min: find('amountPaid')?.min ?? 0, max: find('amountPaid')?.max ?? 0 },
      pendingBounds: { min: find('amountPending')?.min ?? 0, max: find('amountPending')?.max ?? 0 },
      doctorShareBounds: { min: find('doctorShare')?.min ?? 0, max: find('doctorShare')?.max ?? 0 },
      mediendShareBounds: { min: find('mediendShare')?.min ?? 0, max: find('mediendShare')?.max ?? 0 },
    }
  }, [filterConfig])

  const { data, isLoading } = useQuery<Doctor[]>({
    queryKey: [
      'doctors', 'list', dateRange,
      doctorFilter, totalCasesFilter, totalBillFilter, totalPayableFilter,
      amountPaidFilter, amountPendingFilter, doctorShareFilter, mediendShareFilter,
    ],
    queryFn: () => {
      const filters = []
      if (doctorFilter.length > 0) filters.push({ field: 'doctor', operator: 'in', value: doctorFilter })
      if (totalCasesFilter && (totalCasesFilter.min != null || totalCasesFilter.max != null)) {
        filters.push({ field: 'totalCases', operator: 'between', value: totalCasesFilter })
      }
      if (totalBillFilter && (totalBillFilter.min != null || totalBillFilter.max != null)) {
        filters.push({ field: 'totalBill', operator: 'between', value: totalBillFilter })
      }
      if (totalPayableFilter && (totalPayableFilter.min != null || totalPayableFilter.max != null)) {
        filters.push({ field: 'totalPayable', operator: 'between', value: totalPayableFilter })
      }
      if (amountPaidFilter && (amountPaidFilter.min != null || amountPaidFilter.max != null)) {
        filters.push({ field: 'amountPaid', operator: 'between', value: amountPaidFilter })
      }
      if (amountPendingFilter && (amountPendingFilter.min != null || amountPendingFilter.max != null)) {
        filters.push({ field: 'amountPending', operator: 'between', value: amountPendingFilter })
      }
      if (doctorShareFilter && (doctorShareFilter.min != null || doctorShareFilter.max != null)) {
        filters.push({ field: 'doctorShare', operator: 'between', value: doctorShareFilter })
      }
      if (mediendShareFilter && (mediendShareFilter.min != null || mediendShareFilter.max != null)) {
        filters.push({ field: 'mediendShare', operator: 'between', value: mediendShareFilter })
      }

      const params = new URLSearchParams()
      if (dateRange.start && dateRange.end) {
        params.set('startDate', dateRange.start)
        params.set('endDate', dateRange.end)
      }
      if (filters.length > 0) {
        params.set('filters', JSON.stringify(filters))
      }
      const qs = params.toString()
      return apiGet<Doctor[]>(`/api/doctors${qs ? `?${qs}` : ''}`)
    },
  })

  const activeFilterCount =
    doctorFilter.length +
    (totalCasesFilter ? 1 : 0) +
    (totalBillFilter ? 1 : 0) +
    (totalPayableFilter ? 1 : 0) +
    (amountPaidFilter ? 1 : 0) +
    (amountPendingFilter ? 1 : 0) +
    (doctorShareFilter ? 1 : 0) +
    (mediendShareFilter ? 1 : 0)

  const clearFilters = () => {
    setDoctorFilter([])
    setTotalCasesFilter(null)
    setTotalBillFilter(null)
    setTotalPayableFilter(null)
    setAmountPaidFilter(null)
    setAmountPendingFilter(null)
    setDoctorShareFilter(null)
    setMediendShareFilter(null)
  }

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return q ? data.filter((d) => d.name.toLowerCase().includes(q)) : data
  }, [data, search])

  const kpis = useMemo(() => {
    const totalDoctors = rows.length
    const totalCases = rows.reduce((sum, d) => sum + (d.totalCases || 0), 0)
    const totalBill = rows.reduce((sum, d) => sum + (d.totalBill || 0), 0)
    const totalPayable = rows.reduce((sum, d) => sum + (d.totalPayable || 0), 0)
    const amountPaid = rows.reduce((sum, d) => sum + (d.amountPaid || 0), 0)
    const amountPending = rows.reduce((sum, d) => sum + (d.amountPending || 0), 0)
    const doctorShare = rows.reduce((sum, d) => sum + (d.doctorShare || 0), 0)
    const mediendShare = rows.reduce((sum, d) => sum + (d.mediendShare || 0), 0)
    return { totalDoctors, totalCases, totalBill, totalPayable, amountPaid, amountPending, doctorShare, mediendShare }
  }, [rows])

  const renderCellAmount = (value: number | null, colorClass?: string) => {
    if (value == null || value === 0) {
      return <span className="text-slate-300 dark:text-slate-700">—</span>
    }
    return <span className={colorClass}>{formatPlRupee(value)}</span>
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/40 to-teal-50/40 p-6 dark:from-slate-950 dark:via-cyan-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-1.5 rounded-full bg-gradient-to-b from-cyan-500 to-teal-600 shadow-sm" aria-hidden />
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-800 via-teal-700 to-cyan-900 bg-clip-text text-transparent dark:from-cyan-200 dark:via-teal-200 dark:to-cyan-100">
                  Doctor List
                </h1>
                <p className="text-muted-foreground mt-1">
                  All doctors with case totals, payable, paid and pending amounts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 rounded-lg border border-cyan-200/60 bg-cyan-50/80 p-1 shadow-sm dark:border-cyan-800/40 dark:bg-cyan-950/30">
                {(
                  [
                    ['all', 'All time'],
                    ['mtd', 'MTD'],
                    ['lastMonth', 'Last month'],
                    ['qtd', 'QTD'],
                    ['ytd', 'YTD'],
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
                <div className="flex items-center gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[140px]" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[140px]" />
                </div>
              )}
            </div>
          </div>

          {/* KPI Dashboard Summary */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <KpiTile
              label="Total Doctors"
              value={kpis.totalDoctors}
              icon={Users}
              className="border-cyan-200/50 dark:border-cyan-800/30"
            />
            <KpiTile
              label="Total Cases"
              value={kpis.totalCases}
              icon={Activity}
              className="border-cyan-200/50 dark:border-cyan-800/30"
            />
            <KpiTile
              label="Total Bill"
              value={formatPlRupee(kpis.totalBill)}
              icon={ReceiptText}
              className="border-cyan-200/50 dark:border-cyan-800/30"
            />
            <KpiTile
              label="Doctor Share"
              value={formatPlRupee(kpis.doctorShare)}
              icon={UserCheck}
              className="border-cyan-200/50 dark:border-cyan-800/30"
            />
            <KpiTile
              label="MediEND Share"
              value={formatPlRupee(kpis.mediendShare)}
              icon={TrendingUp}
              className="border-cyan-200/50 dark:border-cyan-800/30"
            />
            <KpiTile
              label="Pending Payouts"
              value={formatPlRupee(kpis.amountPending)}
              icon={AlertCircle}
              className={`border-cyan-200/50 dark:border-cyan-800/30 ${
                kpis.amountPending > 0 ? 'bg-rose-50/50 dark:bg-rose-950/10' : ''
              }`}
            />
          </div>

          <Card className="overflow-hidden border-cyan-200/50 shadow-md dark:border-cyan-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-cyan-500/10 to-teal-500/8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                        Doctors
                      </h2>
                      {activeFilterCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium px-2 py-0"
                          onClick={clearFilters}
                        >
                          Clear Filters ({activeFilterCount})
                        </Button>
                      )}
                    </div>
                    <span className="text-xs font-normal text-muted-foreground flex items-center gap-1.5 leading-none">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                      Click a row for case-level details
                    </span>
                  </div>
                </div>
                <div className="relative w-full sm:w-[260px]">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by doctor name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table className="[&_td]:px-[20px] [&_th]:px-[20px]">
                <TableHeader>
                  <TableRow className="bg-slate-100/85 hover:bg-slate-100/85 dark:bg-slate-900/60 border-b border-cyan-100 dark:border-cyan-950/40">
                    <TableHead className="w-[280px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Doctor</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.doctors}
                          value={doctorFilter}
                          onChange={setDoctorFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Cases</span>
                        <ColumnFilter
                          type="numberRange"
                          value={totalCasesFilter}
                          onChange={setTotalCasesFilter}
                          min={filterOptions.casesBounds.min}
                          max={filterOptions.casesBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Total Bill</span>
                        <ColumnFilter
                          type="numberRange"
                          value={totalBillFilter}
                          onChange={setTotalBillFilter}
                          min={filterOptions.billBounds.min}
                          max={filterOptions.billBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Total Payable</span>
                        <ColumnFilter
                          type="numberRange"
                          value={totalPayableFilter}
                          onChange={setTotalPayableFilter}
                          min={filterOptions.payableBounds.min}
                          max={filterOptions.payableBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Paid</span>
                        <ColumnFilter
                          type="numberRange"
                          value={amountPaidFilter}
                          onChange={setAmountPaidFilter}
                          min={filterOptions.paidBounds.min}
                          max={filterOptions.paidBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Pending</span>
                        <ColumnFilter
                          type="numberRange"
                          value={amountPendingFilter}
                          onChange={setAmountPendingFilter}
                          min={filterOptions.pendingBounds.min}
                          max={filterOptions.pendingBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Doctor Share</span>
                        <ColumnFilter
                          type="numberRange"
                          value={doctorShareFilter}
                          onChange={setDoctorShareFilter}
                          min={filterOptions.doctorShareBounds.min}
                          max={filterOptions.doctorShareBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[160px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">MediEND Share</span>
                        <ColumnFilter
                          type="numberRange"
                          value={mediendShareFilter}
                          onChange={setMediendShareFilter}
                          min={filterOptions.mediendShareBounds.min}
                          max={filterOptions.mediendShareBounds.max}
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No doctors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((d) => {
                      const nameParts = d.name.trim().split(/\s+/)
                      const initials = nameParts.length >= 2 
                        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                        : d.name.substring(0, 2).toUpperCase()

                      return (
                        <TableRow
                          key={d.name}
                          className="cursor-pointer transition-colors duration-150 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/10 border-b border-cyan-100/40 dark:border-cyan-950/30"
                          onClick={() => {
                            const qs = dateRange.start && dateRange.end
                              ? `?startDate=${dateRange.start}&endDate=${dateRange.end}`
                              : ''
                            router.push(`/doctors/${encodeURIComponent(d.name)}${qs}`)
                          }}
                        >
                          <TableCell className="py-3 font-medium">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/10 to-teal-500/10 text-cyan-700 dark:text-cyan-400 text-xs font-bold border border-cyan-500/20 shadow-sm shrink-0">
                                {initials}
                              </div>
                              <span className="text-slate-900 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400">
                                {d.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                            {d.totalCases}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {renderCellAmount(d.totalBill)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                            {renderCellAmount(d.totalPayable)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                            {renderCellAmount(d.amountPaid)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                            {renderCellAmount(d.amountPending)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">
                            {renderCellAmount(d.doctorShare)}
                          </TableCell>
                          <TableCell className="text-right pr-4 tabular-nums text-slate-600 dark:text-slate-400">
                            {renderCellAmount(d.mediendShare)}
                          </TableCell>
                        </TableRow>
                      )
                    })
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

function KpiTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: React.ReactNode
  icon: any
  className?: string
}) {
  return (
    <Card className={`overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md bg-white dark:bg-slate-900 ${className}`}>
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </span>
          <div className="rounded-md bg-slate-50 dark:bg-slate-950 p-1 text-cyan-600 dark:text-cyan-400">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
