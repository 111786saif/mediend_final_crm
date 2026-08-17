'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ColumnFilter } from '@/components/ui/column-filter'
import { DataTable } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TableFooter,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import {
  getDischargeSheetFillStatus,
  getDischargeSheetFillStatusBadgeClass,
  getDischargeSheetFillStatusLabel,
  type DischargeSheetFillStatus,
} from '@/lib/insurance/discharge-sheet-status'
import {
  formatPlDate,
  formatPlMonth,
  formatPlRupee,
  resolvePlRow,
} from '@/lib/pl/resolve-pl-row'
import { getStatusBadgeClass } from '@/lib/pl/status-colors'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const LS_COLUMNS = 'insurance-dashboard-column-visibility-v1'

function generateMonthOptions() {
  const months: { key: string; label: string }[] = []
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth()
  while (y > 2022 || (y === 2022 && m >= 0)) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    months.push({
      key,
      label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    })
    m--
    if (m < 0) {
      m = 11
      y--
    }
  }
  return months
}

const MONTH_OPTIONS = generateMonthOptions()

const INSURANCE_TABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'actions', label: 'Actions' },
  { id: 'month', label: 'Month' },
  { id: 'leadReceived', label: 'Lead Received (Insurance)' },
  { id: 'manager', label: 'Manager' },
  { id: 'bdm', label: 'BDM' },
  { id: 'patient', label: 'Patient' },
  { id: 'category', label: 'Category' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'circle', label: 'Circle' },
  { id: 'doctor', label: 'Doctor' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'admissionDate', label: 'Admission date' },
  { id: 'surgeryDate', label: 'Surgery date' },
  { id: 'dischargeDate', label: 'Discharge date' },
  { id: 'paymentType', label: 'Payment type' },
  { id: 'dischargeSheetFillStatus', label: 'Filled Discharge Sheet Status' },
  { id: 'status', label: 'Status' },
  { id: 'totalBill', label: 'Total bill' },
  { id: 'approvedAmount', label: 'Approved amount' },
  { id: 'deductionTotal', label: 'Total Deduction' },
  { id: 'deductionPatient', label: 'Deduction Paid by Patient' },
  { id: 'deductionWaived', label: 'Waived Off' },
  { id: 'amountPaid', label: 'Amount paid' },
]

const DEFAULT_COLS: Record<string, boolean> = Object.fromEntries(
  INSURANCE_TABLE_COLUMNS.map(({ id }) => [id, id !== 'circle']),
)

function loadColVisibility(): Record<string, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_COLS }
  try {
    const raw = localStorage.getItem(LS_COLUMNS)
    if (!raw) return { ...DEFAULT_COLS }
    const parsed = JSON.parse(raw) as Record<string, boolean>
    const merged: Record<string, boolean> = { ...DEFAULT_COLS }
    for (const key of Object.keys(DEFAULT_COLS)) {
      if (key in parsed) merged[key] = Boolean(parsed[key])
    }
    return merged
  } catch {
    return { ...DEFAULT_COLS }
  }
}

export type InsuranceTableLead = Record<string, unknown> & {
  id: string
  leadRef?: string | null
  dischargeSheet?: Record<string, unknown> | null
}

type InsurancePatientTableProps = {
  leads: InsuranceTableLead[]
  /** When set, column filters are also applied to these leads for KPI callbacks. */
  kpiLeads?: InsuranceTableLead[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick: (lead: InsuranceTableLead) => void
  renderActions?: (lead: InsuranceTableLead) => React.ReactNode
  onFilteredLeadsChange?: (leads: InsuranceTableLead[]) => void
}

function matchesDateRange(value: unknown, range: string[]): boolean {
  if (range.length !== 2 || !range[0]) return true
  if (value == null) return false
  const d = value instanceof Date ? value : new Date(value as string)
  if (Number.isNaN(d.getTime())) return false
  const from = new Date(range[0])
  const to = new Date(range[1] || range[0])
  to.setHours(23, 59, 59, 999)
  return d >= from && d <= to
}

function matchesNumberRange(value: unknown, range: { min: number | null; max: number | null } | null): boolean {
  if (!range || (range.min == null && range.max == null)) return true
  if (value == null || value === '') return false
  const n = Number(value)
  if (Number.isNaN(n)) return false
  if (range.min != null && n < range.min) return false
  if (range.max != null && n > range.max) return false
  return true
}

function TruncatedTextCell({ text, className }: { text: string | null | undefined; className?: string }) {
  const value = text?.trim() || ''
  if (!value) return <>—</>

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block max-w-[180px] truncate', className)} title={value}>
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-normal break-words text-left">
        {value}
      </TooltipContent>
    </Tooltip>
  )
}

function applyInsuranceTableFilters(
  leads: InsuranceTableLead[],
  filters: {
    tableMonthFilter: string[]
    bdFilter: string[]
    managerFilter: string[]
    hospitalFilter: string[]
    doctorFilter: string[]
    categoryFilter: string[]
    circleFilter: string[]
    paymentTypeFilter: string[]
    sheetFillFilter: string[]
    statusFilter: string[]
    patientFilter: string
    treatmentFilter: string
    admissionDateFilter: string[]
    surgeryDateFilter: string[]
    dischargeDateFilter: string[]
    totalBillFilter: { min: number | null; max: number | null } | null
    approvedAmountFilter: { min: number | null; max: number | null } | null
  },
) {
  return leads.filter((row) => {
    const resolved = resolvePlRow(row)
    const fillStatus = getDischargeSheetFillStatus(row)

    if (filters.tableMonthFilter.length > 0) {
      const rowMonth = resolved.month
      if (!rowMonth) return false
      const key = `${rowMonth.getFullYear()}-${String(rowMonth.getMonth() + 1).padStart(2, '0')}`
      if (!filters.tableMonthFilter.includes(key)) return false
    }

    if (filters.bdFilter.length > 0 && (!resolved.bdm || !filters.bdFilter.includes(resolved.bdm))) return false
    if (filters.managerFilter.length > 0 && (!resolved.manager || !filters.managerFilter.includes(resolved.manager))) return false
    if (filters.hospitalFilter.length > 0 && (!resolved.hospital || !filters.hospitalFilter.includes(resolved.hospital))) {
      return false
    }
    if (filters.doctorFilter.length > 0 && (!resolved.doctor || !filters.doctorFilter.includes(resolved.doctor))) return false
    if (filters.categoryFilter.length > 0 && (!resolved.category || !filters.categoryFilter.includes(resolved.category))) {
      return false
    }
    if (filters.circleFilter.length > 0) {
      const circle = row.circle as string | null | undefined
      if (!circle || !filters.circleFilter.includes(circle)) return false
    }
    if (
      filters.paymentTypeFilter.length > 0 &&
      (!resolved.paymentType || !filters.paymentTypeFilter.includes(resolved.paymentType))
    ) {
      return false
    }
    if (filters.sheetFillFilter.length > 0 && !filters.sheetFillFilter.includes(fillStatus)) return false
    if (
      filters.statusFilter.length > 0 &&
      (!resolved.status || !filters.statusFilter.includes(resolved.status))
    ) {
      return false
    }

    if (filters.patientFilter.trim()) {
      const q = filters.patientFilter.trim().toLowerCase()
      if (!(resolved.patient || '').toLowerCase().includes(q)) return false
    }
    if (filters.treatmentFilter.trim()) {
      const q = filters.treatmentFilter.trim().toLowerCase()
      if (!(resolved.treatment || '').toLowerCase().includes(q)) return false
    }

    if (!matchesDateRange(resolved.admission, filters.admissionDateFilter)) return false
    if (!matchesDateRange(resolved.surgery, filters.surgeryDateFilter)) return false
    if (!matchesDateRange(resolved.discharge, filters.dischargeDateFilter)) return false
    if (!matchesNumberRange(resolved.totalBill, filters.totalBillFilter)) return false
    if (!matchesNumberRange(resolved.approvedAmount, filters.approvedAmountFilter)) return false

    return true
  })
}

export function InsurancePatientTable({
  leads,
  kpiLeads,
  isLoading = false,
  emptyMessage = 'No cases found',
  onRowClick,
  renderActions,
  onFilteredLeadsChange,
}: InsurancePatientTableProps) {
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(DEFAULT_COLS)
  const [tableMonthFilter, setTableMonthFilter] = useState<string[]>([])
  const [bdFilter, setBdFilter] = useState<string[]>([])
  const [managerFilter, setManagerFilter] = useState<string[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([])
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [circleFilter, setCircleFilter] = useState<string[]>([])
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string[]>([])
  const [sheetFillFilter, setSheetFillFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [treatmentFilter, setTreatmentFilter] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [admissionDateFilter, setAdmissionDateFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])
  const [dischargeDateFilter, setDischargeDateFilter] = useState<string[]>([])
  const [totalBillFilter, setTotalBillFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [approvedAmountFilter, setApprovedAmountFilter] = useState<{ min: number | null; max: number | null } | null>(
    null,
  )

  useEffect(() => {
    setVisibleCols(loadColVisibility())
  }, [])

  const persistCols = useCallback((updaterOrValue: Record<string, boolean> | ((old: Record<string, boolean>) => Record<string, boolean>)) => {
    setVisibleCols((prev) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue
      try {
        localStorage.setItem(LS_COLUMNS, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const toggleCol = useCallback(
    (id: string) => {
      persistCols((prev) => ({ ...prev, [id]: !prev[id] }))
    },
    [persistCols],
  )

  const { data: filterConfig } = useQuery<{
    filters: Array<{
      field: string
      options?: Array<{ label: string; value: string }>
      min?: number
      max?: number
    }>
  }>({
    queryKey: ['insurance', 'table-filter-config'],
    queryFn: () => apiGet('/api/leads/filter-config'),
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      bds: find('bdm')?.options || [],
      managers: find('manager')?.options || [],
      hospitals: find('hospital')?.options || [],
      doctors: find('doctor')?.options || [],
      categories: find('category')?.options || [],
      circles: find('circle')?.options || [],
      paymentTypes: find('paymentType')?.options || [],
      totalBillBounds: { min: find('totalBill')?.min ?? 0, max: find('totalBill')?.max ?? 0 },
      approvedAmountBounds: { min: find('approvedAmount')?.min ?? 0, max: find('approvedAmount')?.max ?? 0 },
    }
  }, [filterConfig])

  const sheetFillOptions = useMemo(
    () => [
      { label: 'Not started', value: 'NOT_STARTED' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Filled', value: 'FILLED' },
    ],
    [],
  )

  const statusOptions = useMemo(() => {
    const values = new Set<string>()
    for (const row of leads) {
      const status = resolvePlRow(row).status
      if (status) values.add(status)
    }
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value }))
  }, [leads])

  const filteredLeads = useMemo(() => {
    return applyInsuranceTableFilters(leads, {
      tableMonthFilter,
      bdFilter,
      managerFilter,
      hospitalFilter,
      doctorFilter,
      categoryFilter,
      circleFilter,
      paymentTypeFilter,
      sheetFillFilter,
      statusFilter,
      patientFilter,
      treatmentFilter,
      admissionDateFilter,
      surgeryDateFilter,
      dischargeDateFilter,
      totalBillFilter,
      approvedAmountFilter,
    })
  }, [
    leads,
    tableMonthFilter,
    bdFilter,
    managerFilter,
    hospitalFilter,
    doctorFilter,
    categoryFilter,
    circleFilter,
    paymentTypeFilter,
    sheetFillFilter,
    statusFilter,
    patientFilter,
    treatmentFilter,
    admissionDateFilter,
    surgeryDateFilter,
    dischargeDateFilter,
    totalBillFilter,
    approvedAmountFilter,
  ])

  const filteredKpiLeads = useMemo(() => {
    const source = kpiLeads ?? leads
    return applyInsuranceTableFilters(source, {
      tableMonthFilter,
      bdFilter,
      managerFilter,
      hospitalFilter,
      doctorFilter,
      categoryFilter,
      circleFilter,
      paymentTypeFilter,
      sheetFillFilter,
      statusFilter,
      patientFilter,
      treatmentFilter,
      admissionDateFilter,
      surgeryDateFilter,
      dischargeDateFilter,
      totalBillFilter,
      approvedAmountFilter,
    })
  }, [
    kpiLeads,
    leads,
    tableMonthFilter,
    bdFilter,
    managerFilter,
    hospitalFilter,
    doctorFilter,
    categoryFilter,
    circleFilter,
    paymentTypeFilter,
    sheetFillFilter,
    statusFilter,
    patientFilter,
    treatmentFilter,
    admissionDateFilter,
    surgeryDateFilter,
    dischargeDateFilter,
    totalBillFilter,
    approvedAmountFilter,
  ])

  useEffect(() => {
    onFilteredLeadsChange?.(filteredKpiLeads)
  }, [filteredKpiLeads, onFilteredLeadsChange])

  const columns = useMemo<ColumnDef<InsuranceTableLead>[]>(
    () => [
      {
        id: 'leadRef',
        header: 'Lead ref',
        accessorKey: 'leadRef',
        cell: ({ row }) => {
          const record = row.original
          return (
            <div className="flex items-center gap-0.5">
              <span className="truncate max-w-[120px]" title={String(record.leadRef ?? '')}>
                {record.leadRef ?? '—'}
              </span>
              {record.leadRef && <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" />}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const record = row.original
          return (
            <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {record.dischargeSheet ? (
                <DischargeSummaryDialog leadId={record.id} preloaded={record.dischargeSheet as never} />
              ) : null}
              {renderActions?.(record)}
            </div>
          )
        },
      },
      {
        id: 'month',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Month</span>
            <ColumnFilter
              options={MONTH_OPTIONS.map((m) => ({ label: m.label, value: m.key }))}
              value={tableMonthFilter}
              onChange={setTableMonthFilter}
              type="multiSelect"
            />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).month,
        cell: ({ getValue }) => formatPlMonth(getValue() as Date | null),
      },
      {
        id: 'leadReceived',
        header: 'Lead Received (Insurance)',
        accessorFn: (row) => resolvePlRow(row).leadReceivedFromInsuranceAt,
        cell: ({ getValue }) => formatPlDate(getValue() as Date | null),
      },
      {
        id: 'manager',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Manager</span>
            <ColumnFilter options={filterOptions.managers} value={managerFilter} onChange={setManagerFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).manager,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'bdm',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>BDM</span>
            <ColumnFilter options={filterOptions.bds} value={bdFilter} onChange={setBdFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).bdm,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'patient',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Patient</span>
            <ColumnFilter value={patientFilter} onChange={setPatientFilter} type="search" placeholder="Search patient..." />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).patient,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'category',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Category</span>
            <ColumnFilter options={filterOptions.categories} value={categoryFilter} onChange={setCategoryFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).category,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'treatment',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Treatment</span>
            <ColumnFilter value={treatmentFilter} onChange={setTreatmentFilter} type="search" placeholder="Search treatment..." />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).treatment,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'circle',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Circle</span>
            <ColumnFilter options={filterOptions.circles} value={circleFilter} onChange={setCircleFilter} type="multiSelect" />
          </div>
        ),
        accessorKey: 'circle',
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'doctor',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Doctor</span>
            <ColumnFilter options={filterOptions.doctors} value={doctorFilter} onChange={setDoctorFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).doctor,
        cell: ({ getValue }) => <TruncatedTextCell text={getValue() as string} />,
      },
      {
        id: 'hospital',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Hospital</span>
            <ColumnFilter options={filterOptions.hospitals} value={hospitalFilter} onChange={setHospitalFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).hospital,
        cell: ({ getValue }) => <TruncatedTextCell text={getValue() as string} />,
      },
      {
        id: 'admissionDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Admission</span>
            <ColumnFilter value={admissionDateFilter} onChange={setAdmissionDateFilter} type="dateRange" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).admission,
        cell: ({ getValue }) => formatPlDate(getValue() as Date | null),
      },
      {
        id: 'surgeryDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Surgery date</span>
            <ColumnFilter value={surgeryDateFilter} onChange={setSurgeryDateFilter} type="dateRange" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).surgery,
        cell: ({ getValue }) => formatPlDate(getValue() as Date | null),
      },
      {
        id: 'dischargeDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Discharge date</span>
            <ColumnFilter value={dischargeDateFilter} onChange={setDischargeDateFilter} type="dateRange" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).discharge,
        cell: ({ getValue }) => formatPlDate(getValue() as Date | null),
      },
      {
        id: 'paymentType',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Payment</span>
            <ColumnFilter options={filterOptions.paymentTypes} value={paymentTypeFilter} onChange={setPaymentTypeFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).paymentType,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'dischargeSheetFillStatus',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Filled Discharge Sheet Status</span>
            <ColumnFilter options={sheetFillOptions} value={sheetFillFilter} onChange={setSheetFillFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => getDischargeSheetFillStatus(row),
        cell: ({ getValue }) => {
          const status = getValue() as DischargeSheetFillStatus
          return (
            <Badge variant="outline" className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', getDischargeSheetFillStatusBadgeClass(status))}>
              {getDischargeSheetFillStatusLabel(status)}
            </Badge>
          )
        },
      },
      {
        id: 'status',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Status</span>
            <ColumnFilter options={statusOptions} value={statusFilter} onChange={setStatusFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).status,
        cell: ({ getValue }) => {
          const val = getValue() as string
          if (!val) return '—'
          return (
            <Badge variant="outline" className={cn('max-w-[160px] truncate text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', getStatusBadgeClass(val, 'case'))}>
              {val}
            </Badge>
          )
        },
      },
      {
        id: 'totalBill',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Total bill</span>
            <ColumnFilter value={totalBillFilter} onChange={setTotalBillFilter} type="numberRange" min={filterOptions.totalBillBounds.min} max={filterOptions.totalBillBounds.max} />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).totalBill,
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
      {
        id: 'approvedAmount',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Approved amount</span>
            <ColumnFilter value={approvedAmountFilter} onChange={setApprovedAmountFilter} type="numberRange" min={filterOptions.approvedAmountBounds.min} max={filterOptions.approvedAmountBounds.max} />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row).approvedAmount,
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
      {
        id: 'deductionTotal',
        header: 'Total Deduction',
        accessorFn: (row) => resolvePlRow(row).deductionTotal,
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
      {
        id: 'deductionPatient',
        header: 'Deduction Paid by Patient',
        accessorFn: (row) => resolvePlRow(row).deductionPaidByPatient,
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
      {
        id: 'deductionWaived',
        header: 'Waived Off',
        accessorFn: (row) => resolvePlRow(row).deductionWaived,
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
      {
        id: 'amountPaid',
        header: 'Amount paid',
        accessorFn: (row) => {
          const res = resolvePlRow(row)
          return (res.approvedAmount ?? 0) + (res.deductionPaidByPatient ?? 0) || null
        },
        cell: ({ getValue }) => formatPlRupee(getValue() as number | null),
      },
    ],
    [
      filterOptions,
      tableMonthFilter,
      bdFilter,
      managerFilter,
      hospitalFilter,
      doctorFilter,
      categoryFilter,
      circleFilter,
      paymentTypeFilter,
      sheetFillFilter,
      sheetFillOptions,
      statusFilter,
      statusOptions,
      patientFilter,
      treatmentFilter,
      admissionDateFilter,
      surgeryDateFilter,
      dischargeDateFilter,
      totalBillFilter,
      approvedAmountFilter,
      renderActions,
    ],
  )

  const columnVisibility = useMemo(() => {
    const vis: Record<string, boolean> = { leadRef: true }
    for (const { id } of INSURANCE_TABLE_COLUMNS) {
      vis[id] = visibleCols[id] ?? DEFAULT_COLS[id] ?? true
    }
    return vis
  }, [visibleCols])

  // ── Totals for numerical columns ─────────────────────────────────────────
  const NUMERIC_COLUMN_IDS = ['totalBill', 'approvedAmount', 'deductionTotal', 'deductionPatient', 'deductionWaived', 'amountPaid'] as const

  const totals = useMemo(() => {
    const sums: Record<string, number> = {
      totalBill: 0,
      approvedAmount: 0,
      deductionTotal: 0,
      deductionPatient: 0,
      deductionWaived: 0,
      amountPaid: 0,
    }
    for (const row of filteredLeads) {
      const res = resolvePlRow(row)
      if (res.totalBill != null) sums.totalBill += res.totalBill
      if (res.approvedAmount != null) sums.approvedAmount += res.approvedAmount
      if (res.deductionTotal != null) sums.deductionTotal += res.deductionTotal
      if (res.deductionPaidByPatient != null) sums.deductionPatient += res.deductionPaidByPatient
      if (res.deductionWaived != null) sums.deductionWaived += res.deductionWaived
      const amountPaid = (res.approvedAmount ?? 0) + (res.deductionPaidByPatient ?? 0)
      if (amountPaid) sums.amountPaid += amountPaid
    }
    return sums
  }, [filteredLeads])

  // Build ordered list of visible column IDs to align footer cells correctly
  const ALL_COL_IDS = ['leadRef', ...INSURANCE_TABLE_COLUMNS.map(c => c.id)]
  const visibleColIds = ALL_COL_IDS.filter(id => columnVisibility[id] !== false)

  const totalsFooter = filteredLeads.length > 0 ? (
    <TableFooter className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-t-2 border-border">
      <TableRow className="hover:bg-transparent">
        {visibleColIds.map((colId, idx) => {
          const isNumeric = (NUMERIC_COLUMN_IDS as readonly string[]).includes(colId)
          // Show "Total" label in the first cell
          if (idx === 0) {
            return (
              <TableCell key={colId} className="px-4 py-3 text-sm font-bold text-foreground whitespace-nowrap">
                Total ({filteredLeads.length})
              </TableCell>
            )
          }
          if (isNumeric) {
            return (
              <TableCell key={colId} className="px-4 py-3 text-sm font-bold text-foreground whitespace-nowrap">
                {formatPlRupee(totals[colId] || null)}
              </TableCell>
            )
          }
          return <TableCell key={colId} className="px-4 py-3" />
        })}
      </TableRow>
    </TableFooter>
  ) : undefined

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2">
        <span className="text-xs text-muted-foreground">
          {filteredLeads.length} of {leads.length} case{leads.length !== 1 ? 's' : ''}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked disabled>
              Lead ref (always on)
            </DropdownMenuCheckboxItem>
            {INSURANCE_TABLE_COLUMNS.map(({ id, label }) => (
              <DropdownMenuCheckboxItem key={id} checked={visibleCols[id] ?? DEFAULT_COLS[id]} onCheckedChange={() => toggleCol(id)}>
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <DataTable
        columns={columns}
        data={filteredLeads}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={(updater) => {
          const next = typeof updater === 'function' ? updater(columnVisibility) : updater
          const merged = { ...visibleCols }
          for (const { id } of INSURANCE_TABLE_COLUMNS) {
            if (id in next) merged[id] = Boolean(next[id])
          }
          persistCols(merged)
        }}
        footer={totalsFooter}
      />
    </div>
  )
}
