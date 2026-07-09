'use client'

import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PlOutstandingSheet } from '@/components/pl/pl-outstanding-sheet'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ColumnFilter } from '@/components/ui/column-filter'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import {
  formatPlDate,
  formatPlMonth,
  formatPlRupee,
  resolvePlRow,
} from '@/lib/pl/resolve-pl-row'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { Building2, Calendar, CheckCircle, ChevronLeft, ChevronRight, CreditCard, FileText, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const PAGE_SIZE = 100

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

  // Filter states
  const [managerFilter, setManagerFilter] = useState<string[]>([])
  const [bdmFilter, setBdmFilter] = useState<string[]>([])
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [hospitalTotalAmountFilter, setHospitalTotalAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [hospitalOutstandingAmountFilter, setHospitalOutstandingAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorPayoutAmountFilter, setDoctorPayoutAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorOutstandingAmountFilter, setDoctorOutstandingAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string[]>([])
  const [mediendPayoutFilter, setMediendPayoutFilter] = useState<string[]>([])
  const [doctorPayoutFilter, setDoctorPayoutFilter] = useState<string[]>([])
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string[]>([])
  const [paymentReceivedFilter, setPaymentReceivedFilter] = useState<boolean | null>(null)

  const [leadRefFilter, setLeadRefFilter] = useState<string>('')
  const [patientFilter, setPatientFilter] = useState<string>('')
  const [treatmentFilter, setTreatmentFilter] = useState<string>('')

  const [leadReceivedFilter, setLeadReceivedFilter] = useState<string[]>([])
  const [admissionDateFilter, setAdmissionDateFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])

  const [totalBillFilter, setTotalBillFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [approvedAmountFilter, setApprovedAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [deductionTotalFilter, setDeductionTotalFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [deductionPaidFilter, setDeductionPaidFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [waivedOffFilter, setWaivedOffFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [netProfitFilter, setNetProfitFilter] = useState<{ min: number | null; max: number | null } | null>(null)

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
    queryKey: ['outstanding', 'filter-config'],
    queryFn: () => apiGet('/api/outstanding/filter-config'),
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      managers: find('manager')?.options || [],
      bdms: find('bdm')?.options || [],
      doctors: find('doctor')?.options || [],
      hospitals: find('hospital')?.options || [],
      statuses: find('status')?.options || [],
      categories: find('category')?.options || [],
      paymentTypes: find('paymentType')?.options || [],
      mediendPayouts: find('mediendPayout')?.options || [],
      doctorPayouts: find('doctorPayout')?.options || [],
      invoiceStatuses: find('invoiceStatus')?.options || [],

      hospitalTotalBounds: { min: find('hospitalTotalAmount')?.min ?? 0, max: find('hospitalTotalAmount')?.max ?? 0 },
      hospitalOutstandingBounds: { min: find('hospitalOutstandingAmount')?.min ?? 0, max: find('hospitalOutstandingAmount')?.max ?? 0 },
      doctorPayoutBounds: { min: find('doctorPayoutAmount')?.min ?? 0, max: find('doctorPayoutAmount')?.max ?? 0 },
      doctorOutstandingBounds: { min: find('doctorOutstandingAmount')?.min ?? 0, max: find('doctorOutstandingAmount')?.max ?? 0 },

      totalBillBounds: { min: find('totalBill')?.min ?? 0, max: find('totalBill')?.max ?? 0 },
      approvedBounds: { min: find('approvedAmount')?.min ?? 0, max: find('approvedAmount')?.max ?? 0 },
      deductionTotalBounds: { min: find('deductionTotal')?.min ?? 0, max: find('deductionTotal')?.max ?? 0 },
      deductionPaidBounds: { min: find('deductionPaid')?.min ?? 0, max: find('deductionPaid')?.max ?? 0 },
      waivedBounds: { min: find('waivedOff')?.min ?? 0, max: find('waivedOff')?.max ?? 0 },
      netProfitBounds: { min: find('netProfit')?.min ?? 0, max: find('netProfit')?.max ?? 0 },
    }
  }, [filterConfig])

  const { data: records, isLoading } = useQuery<Lead[]>({
    queryKey: [
      'outstanding', 'records', dateRange,
      managerFilter, bdmFilter, doctorFilter, hospitalFilter, statusFilter,
      hospitalTotalAmountFilter, hospitalOutstandingAmountFilter,
      doctorPayoutAmountFilter, doctorOutstandingAmountFilter,
      categoryFilter, paymentTypeFilter, mediendPayoutFilter, doctorPayoutFilter,
      invoiceStatusFilter, paymentReceivedFilter,
      leadRefFilter, patientFilter, treatmentFilter,
      leadReceivedFilter, admissionDateFilter, surgeryDateFilter,
      totalBillFilter, approvedAmountFilter, deductionTotalFilter,
      deductionPaidFilter, waivedOffFilter, netProfitFilter,
    ],
    queryFn: async () => {
      const filters = []
      // multiSelect
      if (managerFilter.length > 0) filters.push({ field: 'manager', operator: 'in', value: managerFilter })
      if (bdmFilter.length > 0) filters.push({ field: 'bdm', operator: 'in', value: bdmFilter })
      if (doctorFilter.length > 0) filters.push({ field: 'doctor', operator: 'in', value: doctorFilter })
      if (hospitalFilter.length > 0) filters.push({ field: 'hospital', operator: 'in', value: hospitalFilter })
      if (statusFilter.length > 0) filters.push({ field: 'status', operator: 'in', value: statusFilter })
      if (categoryFilter.length > 0) filters.push({ field: 'category', operator: 'in', value: categoryFilter })
      if (paymentTypeFilter.length > 0) filters.push({ field: 'paymentType', operator: 'in', value: paymentTypeFilter })
      if (mediendPayoutFilter.length > 0) filters.push({ field: 'mediendPayout', operator: 'in', value: mediendPayoutFilter })
      if (doctorPayoutFilter.length > 0) filters.push({ field: 'doctorPayout', operator: 'in', value: doctorPayoutFilter })
      if (invoiceStatusFilter.length > 0) filters.push({ field: 'invoiceStatus', operator: 'in', value: invoiceStatusFilter })

      // boolean
      if (paymentReceivedFilter !== null) filters.push({ field: 'paymentReceived', operator: 'equals', value: paymentReceivedFilter })

      // search
      if (leadRefFilter.trim()) filters.push({ field: 'leadRef', operator: 'contains', value: leadRefFilter })
      if (patientFilter.trim()) filters.push({ field: 'patient', operator: 'contains', value: patientFilter })
      if (treatmentFilter.trim()) filters.push({ field: 'treatment', operator: 'contains', value: treatmentFilter })

      // dateRange
      if (leadReceivedFilter.length === 2 && leadReceivedFilter[0]) {
        filters.push({ field: 'leadReceived', operator: 'between', value: leadReceivedFilter })
      }
      if (admissionDateFilter.length === 2 && admissionDateFilter[0]) {
        filters.push({ field: 'admissionDate', operator: 'between', value: admissionDateFilter })
      }
      if (surgeryDateFilter.length === 2 && surgeryDateFilter[0]) {
        filters.push({ field: 'surgeryDate', operator: 'between', value: surgeryDateFilter })
      }

      // numberRange
      if (hospitalTotalAmountFilter && (hospitalTotalAmountFilter.min != null || hospitalTotalAmountFilter.max != null)) {
        filters.push({ field: 'hospitalTotalAmount', operator: 'between', value: hospitalTotalAmountFilter })
      }
      if (hospitalOutstandingAmountFilter && (hospitalOutstandingAmountFilter.min != null || hospitalOutstandingAmountFilter.max != null)) {
        filters.push({ field: 'hospitalOutstandingAmount', operator: 'between', value: hospitalOutstandingAmountFilter })
      }
      if (doctorPayoutAmountFilter && (doctorPayoutAmountFilter.min != null || doctorPayoutAmountFilter.max != null)) {
        filters.push({ field: 'doctorPayoutAmount', operator: 'between', value: doctorPayoutAmountFilter })
      }
      if (doctorOutstandingAmountFilter && (doctorOutstandingAmountFilter.min != null || doctorOutstandingAmountFilter.max != null)) {
        filters.push({ field: 'doctorOutstandingAmount', operator: 'between', value: doctorOutstandingAmountFilter })
      }
      if (totalBillFilter && (totalBillFilter.min != null || totalBillFilter.max != null)) {
        filters.push({ field: 'totalBill', operator: 'between', value: totalBillFilter })
      }
      if (approvedAmountFilter && (approvedAmountFilter.min != null || approvedAmountFilter.max != null)) {
        filters.push({ field: 'approvedAmount', operator: 'between', value: approvedAmountFilter })
      }
      if (deductionTotalFilter && (deductionTotalFilter.min != null || deductionTotalFilter.max != null)) {
        filters.push({ field: 'deductionTotal', operator: 'between', value: deductionTotalFilter })
      }
      if (deductionPaidFilter && (deductionPaidFilter.min != null || deductionPaidFilter.max != null)) {
        filters.push({ field: 'deductionPaid', operator: 'between', value: deductionPaidFilter })
      }
      if (waivedOffFilter && (waivedOffFilter.min != null || waivedOffFilter.max != null)) {
        filters.push({ field: 'waivedOff', operator: 'between', value: waivedOffFilter })
      }
      if (netProfitFilter && (netProfitFilter.min != null || netProfitFilter.max != null)) {
        filters.push({ field: 'netProfit', operator: 'between', value: netProfitFilter })
      }

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      if (filters.length > 0) {
        params.set('filters', JSON.stringify(filters))
      }
      return await apiGet<Lead[]>(`/api/outstanding?${params.toString()}`)
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
  })

  const [page, setPage] = useState(1)
  const [sheetLeadId, setSheetLeadId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filteredRecords = useMemo(() => records ?? [], [records])

  const activeFilterCount =
    managerFilter.length +
    bdmFilter.length +
    doctorFilter.length +
    hospitalFilter.length +
    statusFilter.length +
    categoryFilter.length +
    paymentTypeFilter.length +
    mediendPayoutFilter.length +
    doctorPayoutFilter.length +
    invoiceStatusFilter.length +
    (paymentReceivedFilter !== null ? 1 : 0) +
    (leadRefFilter.trim() ? 1 : 0) +
    (patientFilter.trim() ? 1 : 0) +
    (treatmentFilter.trim() ? 1 : 0) +
    (leadReceivedFilter.length > 0 ? 1 : 0) +
    (admissionDateFilter.length > 0 ? 1 : 0) +
    (surgeryDateFilter.length > 0 ? 1 : 0) +
    (hospitalTotalAmountFilter ? 1 : 0) +
    (hospitalOutstandingAmountFilter ? 1 : 0) +
    (doctorPayoutAmountFilter ? 1 : 0) +
    (doctorOutstandingAmountFilter ? 1 : 0) +
    (totalBillFilter ? 1 : 0) +
    (approvedAmountFilter ? 1 : 0) +
    (deductionTotalFilter ? 1 : 0) +
    (deductionPaidFilter ? 1 : 0) +
    (waivedOffFilter ? 1 : 0) +
    (netProfitFilter ? 1 : 0)

  const clearFilters = () => {
    setManagerFilter([])
    setBdmFilter([])
    setDoctorFilter([])
    setHospitalFilter([])
    setStatusFilter([])
    setCategoryFilter([])
    setPaymentTypeFilter([])
    setMediendPayoutFilter([])
    setDoctorPayoutFilter([])
    setInvoiceStatusFilter([])
    setPaymentReceivedFilter(null)
    setLeadRefFilter('')
    setPatientFilter('')
    setTreatmentFilter('')
    setLeadReceivedFilter([])
    setAdmissionDateFilter([])
    setSurgeryDateFilter([])
    setHospitalTotalAmountFilter(null)
    setHospitalOutstandingAmountFilter(null)
    setDoctorPayoutAmountFilter(null)
    setDoctorOutstandingAmountFilter(null)
    setTotalBillFilter(null)
    setApprovedAmountFilter(null)
    setDeductionTotalFilter(null)
    setDeductionPaidFilter(null)
    setWaivedOffFilter(null)
    setNetProfitFilter(null)
    setPage(1)
  }

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE)
  const paginatedRecords = useMemo(
    () => filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRecords, page]
  )

  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages))
  }, [totalPages, page])

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

  const columns = useMemo<ColumnDef<Lead>[]>(() => [
    {
      id: 'leadRef',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
          <span>Lead Ref</span>
          <ColumnFilter
            type="search"
            value={leadRefFilter}
            onChange={(val) => { setLeadRefFilter(val); setPage(1) }}
            placeholder="Search Lead Ref..."
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <span>{row.original.leadRef ?? '—'}</span>
          {row.original.leadRef ? <CopyLeadRefButton leadRef={String(row.original.leadRef)} className="h-7 w-7" /> : null}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {row.original.dischargeSheet ? (
            <DischargeSummaryDialog
              leadId={row.original.id}
              preloaded={row.original.dischargeSheet as never}
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      )
    },
    {
      id: 'month',
      header: 'Month',
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlMonth(resolved.month)}</div>
      }
    },
    {
      id: 'leadReceived',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Lead Received (Insurance)</span>
          <ColumnFilter
            type="dateRange"
            value={leadReceivedFilter}
            onChange={(val) => { setLeadReceivedFilter(val); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlDate(resolved.leadReceivedFromInsuranceAt)}</div>
      }
    },
    {
      id: 'manager',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Manager</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.managers}
            value={managerFilter}
            onChange={(selected) => { setManagerFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.manager ?? '—'}</div>
      }
    },
    {
      id: 'bdm',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>BDM</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.bdms}
            value={bdmFilter}
            onChange={(selected) => { setBdmFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.bdm ?? '—'}</div>
      }
    },
    {
      id: 'patient',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Patient</span>
          <ColumnFilter
            type="search"
            value={patientFilter}
            onChange={(val) => { setPatientFilter(val); setPage(1) }}
            placeholder="Search patient..."
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.patient ?? '—'}</div>
      }
    },
    {
      id: 'category',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
          <span>Category</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.categories}
            value={categoryFilter}
            onChange={(selected) => { setCategoryFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.category ?? '—'}</div>
      }
    },
    {
      id: 'treatment',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Treatment</span>
          <ColumnFilter
            type="search"
            value={treatmentFilter}
            onChange={(val) => { setTreatmentFilter(val); setPage(1) }}
            placeholder="Search treatment..."
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.treatment ?? '—'}</div>
      }
    },
    {
      id: 'doctor',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <span>Doctor</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.doctors}
            value={doctorFilter}
            onChange={(selected) => { setDoctorFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.doctor ?? '—'}</div>
      }
    },
    {
      id: 'hospital',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[200px]">
          <span>Hospital</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.hospitals}
            value={hospitalFilter}
            onChange={(selected) => { setHospitalFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.hospital ?? '—'}</div>
      }
    },
    {
      id: 'admission',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Admission</span>
          <ColumnFilter
            type="dateRange"
            value={admissionDateFilter}
            onChange={(val) => { setAdmissionDateFilter(val); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlDate(resolved.admission)}</div>
      }
    },
    {
      id: 'surgery',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Surgery</span>
          <ColumnFilter
            type="dateRange"
            value={surgeryDateFilter}
            onChange={(val) => { setSurgeryDateFilter(val); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlDate(resolved.surgery)}</div>
      }
    },
    {
      id: 'paymentType',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Payment</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.paymentTypes}
            value={paymentTypeFilter}
            onChange={(selected) => { setPaymentTypeFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.paymentType ?? '—'}</div>
      }
    },
    {
      id: 'status',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Status</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.statuses}
            value={statusFilter}
            onChange={(selected) => { setStatusFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{resolved.status ?? '—'}</div>
      }
    },
    {
      id: 'totalBill',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Total Bill</span>
          <ColumnFilter
            type="numberRange"
            value={totalBillFilter}
            onChange={(val) => { setTotalBillFilter(val); setPage(1) }}
            min={filterOptions.totalBillBounds.min}
            max={filterOptions.totalBillBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlRupee(resolved.totalBill)}</div>
      }
    },
    {
      id: 'approved',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Approved</span>
          <ColumnFilter
            type="numberRange"
            value={approvedAmountFilter}
            onChange={(val) => { setApprovedAmountFilter(val); setPage(1) }}
            min={filterOptions.approvedBounds.min}
            max={filterOptions.approvedBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlRupee(resolved.approvedAmount)}</div>
      }
    },
    {
      id: 'deductionTotal',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Total Deduction</span>
          <ColumnFilter
            type="numberRange"
            value={deductionTotalFilter}
            onChange={(val) => { setDeductionTotalFilter(val); setPage(1) }}
            min={filterOptions.deductionTotalBounds.min}
            max={filterOptions.deductionTotalBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlRupee(resolved.deductionTotal)}</div>
      }
    },
    {
      id: 'deductionPaid',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Deduction Paid by Patient</span>
          <ColumnFilter
            type="numberRange"
            value={deductionPaidFilter}
            onChange={(val) => { setDeductionPaidFilter(val); setPage(1) }}
            min={filterOptions.deductionPaidBounds.min}
            max={filterOptions.deductionPaidBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlRupee(resolved.deductionPaidByPatient)}</div>
      }
    },
    {
      id: 'waivedOff',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Waived Off</span>
          <ColumnFilter
            type="numberRange"
            value={waivedOffFilter}
            onChange={(val) => { setWaivedOffFilter(val); setPage(1) }}
            min={filterOptions.waivedBounds.min}
            max={filterOptions.waivedBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const resolved = resolvePlRow(row.original as unknown as Record<string, unknown>)
        return <div className="whitespace-nowrap">{formatPlRupee(resolved.deductionWaived)}</div>
      }
    },
    {
      id: 'netProfit',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
          <span>Net Profit</span>
          <ColumnFilter
            type="numberRange"
            value={netProfitFilter}
            onChange={(val) => { setNetProfitFilter(val); setPage(1) }}
            min={filterOptions.netProfitBounds.min}
            max={filterOptions.netProfitBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        return (
          <div className="whitespace-nowrap font-medium">
            ₹
            {(
              (row.original.plRecord as { finalProfit?: number; mediendNetProfit?: number } | undefined)?.finalProfit ??
              (row.original.plRecord as { finalProfit?: number; mediendNetProfit?: number } | undefined)?.mediendNetProfit ??
              row.original.netProfit ??
              0
            ).toLocaleString('en-IN')}
          </div>
        )
      }
    },
    {
      id: 'hospitalTotalAmount',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <span>Hospital Total Amount</span>
          <ColumnFilter
            type="numberRange"
            value={hospitalTotalAmountFilter}
            onChange={(val) => { setHospitalTotalAmountFilter(val); setPage(1) }}
            min={filterOptions.hospitalTotalBounds.min}
            max={filterOptions.hospitalTotalBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {formatPlRupee(row.original.dischargeSheet?.hospitalShareAmount ?? row.original.plRecord?.hospitalShareAmount ?? 0)}
        </div>
      )
    },
    {
      id: 'hospitalOutstandingAmount',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <span>Hospital Outstanding Amount</span>
          <ColumnFilter
            type="numberRange"
            value={hospitalOutstandingAmountFilter}
            onChange={(val) => { setHospitalOutstandingAmountFilter(val); setPage(1) }}
            min={filterOptions.hospitalOutstandingBounds.min}
            max={filterOptions.hospitalOutstandingBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const hospitalPending = (row.original.plRecord as Record<string, unknown>)?.hospitalAmountPending as number || 0
        return (
          <div className="whitespace-nowrap font-medium text-red-600 dark:text-red-400">
            {hospitalPending > 0 ? `₹${hospitalPending.toLocaleString('en-IN')}` : '—'}
          </div>
        )
      }
    },
    {
      id: 'doctorPayoutAmount',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <span>Doctor Payout Amount</span>
          <ColumnFilter
            type="numberRange"
            value={doctorPayoutAmountFilter}
            onChange={(val) => { setDoctorPayoutAmountFilter(val); setPage(1) }}
            min={filterOptions.doctorPayoutBounds.min}
            max={filterOptions.doctorPayoutBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {formatPlRupee(row.original.dischargeSheet?.doctorCharges ?? row.original.plRecord?.doctorCharges ?? 0)}
        </div>
      )
    },
    {
      id: 'doctorOutstandingAmount',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[180px]">
          <span>Doctor Outstanding Amount</span>
          <ColumnFilter
            type="numberRange"
            value={doctorOutstandingAmountFilter}
            onChange={(val) => { setDoctorOutstandingAmountFilter(val); setPage(1) }}
            min={filterOptions.doctorOutstandingBounds.min}
            max={filterOptions.doctorOutstandingBounds.max}
          />
        </div>
      ),
      cell: ({ row }) => {
        const doctorPending = (row.original.plRecord as Record<string, unknown>)?.doctorAmountPending as number || 0
        return (
          <div className="whitespace-nowrap font-medium text-red-600 dark:text-red-400">
            {doctorPending > 0 ? `₹${doctorPending.toLocaleString('en-IN')}` : '—'}
          </div>
        )
      }
    },
    {
      id: 'mediendPayout',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>MediEND Payout</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.mediendPayouts}
            value={mediendPayoutFilter}
            onChange={(selected) => { setMediendPayoutFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div>
          <Badge
            variant={
              row.original.plRecord?.hospitalPayoutStatus === 'PAID'
                ? 'default'
                : row.original.plRecord?.hospitalPayoutStatus === 'PARTIAL'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {row.original.plRecord?.hospitalPayoutStatus || 'PENDING'}
          </Badge>
        </div>
      )
    },
    {
      id: 'mediendPending',
      header: 'MediEND Pending',
      cell: ({ row }) => {
        const hospitalPending = (row.original.plRecord as Record<string, unknown>)?.hospitalAmountPending as number || 0
        return (
          <div className="whitespace-nowrap font-medium">
            {hospitalPending > 0 ? `₹${hospitalPending.toLocaleString('en-IN')}` : '—'}
          </div>
        )
      }
    },
    {
      id: 'doctorPayout',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Doctor Payout</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.doctorPayouts}
            value={doctorPayoutFilter}
            onChange={(selected) => { setDoctorPayoutFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div>
          <Badge
            variant={
              row.original.plRecord?.doctorPayoutStatus === 'PAID'
                ? 'default'
                : row.original.plRecord?.doctorPayoutStatus === 'PARTIAL'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {row.original.plRecord?.doctorPayoutStatus || 'PENDING'}
          </Badge>
        </div>
      )
    },
    {
      id: 'doctorPending',
      header: 'Doctor Pending',
      cell: ({ row }) => {
        const doctorPending = (row.original.plRecord as Record<string, unknown>)?.doctorAmountPending as number || 0
        return (
          <div className="whitespace-nowrap font-medium">
            {doctorPending > 0 ? `₹${doctorPending.toLocaleString('en-IN')}` : '—'}
          </div>
        )
      }
    },
    {
      id: 'invoiceStatus',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Invoice Status</span>
          <ColumnFilter
            type="multiSelect"
            options={filterOptions.invoiceStatuses}
            value={invoiceStatusFilter}
            onChange={(selected) => { setInvoiceStatusFilter(selected); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div>
          <Badge
            variant={
              row.original.plRecord?.mediendInvoiceStatus === 'PAID'
                ? 'default'
                : row.original.plRecord?.mediendInvoiceStatus === 'SENT'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {row.original.plRecord?.mediendInvoiceStatus || 'PENDING'}
          </Badge>
        </div>
      )
    },
    {
      id: 'paymentReceived',
      header: () => (
        <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[150px]">
          <span>Payment Received</span>
          <ColumnFilter
            type="boolean"
            value={paymentReceivedFilter}
            onChange={(val) => { setPaymentReceivedFilter(val); setPage(1) }}
          />
        </div>
      ),
      cell: ({ row }) => {
        const oc = row.original.outstandingCase as { paymentReceived?: boolean; remark2?: string | null } | undefined
        return (
          <div>
            <Badge
              variant={oc?.paymentReceived ? 'default' : 'outline'}
              className={oc?.paymentReceived ? 'bg-green-500 hover:bg-green-600' : ''}
            >
              {oc?.paymentReceived ? 'Received' : 'Pending'}
            </Badge>
          </div>
        )
      }
    },
    {
      id: 'remarks',
      header: 'Remarks',
      cell: ({ row }) => {
        const oc = row.original.outstandingCase as { paymentReceived?: boolean; remark2?: string | null } | undefined
        return (
          <div className="max-w-[160px]">
            <span className="text-sm text-muted-foreground truncate block" title={oc?.remark2 ?? ''}>
              {oc?.remark2 || '—'}
            </span>
          </div>
        )
      }
    }
  ], [
    filterOptions,
    leadRefFilter, leadReceivedFilter, managerFilter, bdmFilter, patientFilter,
    categoryFilter, treatmentFilter, doctorFilter, hospitalFilter,
    admissionDateFilter, surgeryDateFilter, paymentTypeFilter, statusFilter,
    totalBillFilter, approvedAmountFilter, deductionTotalFilter, deductionPaidFilter,
    waivedOffFilter, netProfitFilter, hospitalTotalAmountFilter, hospitalOutstandingAmountFilter,
    doctorPayoutAmountFilter, doctorOutstandingAmountFilter, mediendPayoutFilter,
    doctorPayoutFilter, invoiceStatusFilter, paymentReceivedFilter, setPage
  ]);



  return (
    <ProtectedRoute>
      <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-amber-50/40 to-orange-50/50 p-6 dark:from-slate-950 dark:via-amber-950/25 dark:to-slate-900">
        <div className="mx-auto max-w-6xl w-full space-y-6">
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
              <CardDescription>Click a row to edit. Filtered by discharge date.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <DataTable
                  columns={columns}
                  data={paginatedRecords}
                  enablePagination={false}
                  onRowClick={(row) => { setSheetLeadId(row.id); setSheetOpen(true) }}
                />
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({filteredRecords.length} rows)
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
