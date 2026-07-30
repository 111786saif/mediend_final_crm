'use client'

import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { cn } from '@/lib/utils'
import { DischargeSummaryDialog } from '@/components/pl/discharge-summary-dialog'
import { PendingPayoutsDrawer } from '@/components/pl/pending-payouts-drawer'
import { PlPatientDrawer } from '@/components/pl/pl-patient-drawer'
import { PlRecordSheet } from '@/components/pl/pl-record-sheet'
import { ProtectedRoute } from '@/components/protected-route'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { ColumnFilter } from '@/components/ui/column-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { usePermissions } from '@/hooks/use-permissions'
import { RESOURCE_MAP } from '@/lib/rbac/resourceMap'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  formatPlDate,
  formatPlMonth,
  formatPlRupee,
  resolvePlRow,
} from '@/lib/pl/resolve-pl-row'
import { getStatusBadgeClass } from '@/lib/pl/status-colors'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Calendar,
  CheckCircle,
  CheckCircle2,
  DollarSign,
  Download,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  TrendingUp,
  Users,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  postponed?: number
  cancelled?: number
  posted?: number
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
  actualImplantCost: true,
  actualInstrumentCost: true,
  hospitalRecoverAmount: true,
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
  const { user } = useAuth()
  const { hasAccess, permissions } = usePermissions()
  const [selectedMonths, setSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [monthsMenuOpen, setMonthsMenuOpen] = useState(false)
  const [tempSelectedMonths, setTempSelectedMonths] = useState<string[]>([currentMonthKey()])
  const [monthsSearchQuery, setMonthsSearchQuery] = useState('')
  const [tableMonthFilter, setTableMonthFilter] = useState<string[]>([])
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

  const handleMonthsMenuOpenChange = (open: boolean) => {
    setMonthsMenuOpen(open)
    if (open) {
      setTempSelectedMonths(selectedMonths)
      setMonthsSearchQuery('')
    }
  }

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
      if (id === 'leadRef') return
      persistCols((prev) => ({ ...prev, [id]: !prev[id] }))
    },
    [persistCols]
  )

  const [bdFilter, setBdFilter] = useState<string[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([])
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [outstandingFilter, setOutstandingFilter] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [circleFilter, setCircleFilter] = useState<string[]>([])
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string[]>([])
  const [hospPayoutFilter, setHospPayoutFilter] = useState<string[]>([])
  const [docPayoutFilter, setDocPayoutFilter] = useState<string[]>([])
  const [invoiceFilter, setInvoiceFilter] = useState<string[]>([])
  const [treatmentFilter, setTreatmentFilter] = useState<string>('')
  const [patientFilter, setPatientFilter] = useState<string>('')
  const [admissionDateFilter, setAdmissionDateFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])
  const [totalBillFilter, setTotalBillFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [approvedAmountFilter, setApprovedAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [hospitalShareAmtFilter, setHospitalShareAmtFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorChargesFilter, setDoctorChargesFilter] = useState<{ min: number | null; max: number | null } | null>(null)
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
    queryKey: ['pl', 'filter-config'],
    queryFn: () => apiGet('/api/leads/filter-config'),
    staleTime: 5 * 60 * 1000, // cache 5 min — options rarely change
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      bds: find('bdm')?.options || [],
      hospitals: find('hospital')?.options || [],
      doctors: find('doctor')?.options || [],
      managers: find('manager')?.options || [],
      categories: find('category')?.options || [],
      circles: find('circle')?.options || [],
      paymentTypes: find('paymentType')?.options || [],
      hospPayouts: find('hospPayout')?.options || [],
      docPayouts: find('docPayout')?.options || [],
      invoices: find('invoice')?.options || [],
      totalBillBounds: { min: find('totalBill')?.min ?? 0, max: find('totalBill')?.max ?? 0 },
      approvedAmountBounds: { min: find('approvedAmount')?.min ?? 0, max: find('approvedAmount')?.max ?? 0 },
      hospitalShareAmtBounds: { min: find('hospitalShareAmt')?.min ?? 0, max: find('hospitalShareAmt')?.max ?? 0 },
      doctorChargesBounds: { min: find('doctorCharges')?.min ?? 0, max: find('doctorCharges')?.max ?? 0 },
      netProfitBounds: { min: find('netProfit')?.min ?? 0, max: find('netProfit')?.max ?? 0 },
    }
  }, [filterConfig])

  const { data: records, isLoading } = useQuery<Lead[]>({
    queryKey: [
      'pl', 'records', dateRange,
      bdFilter, hospitalFilter, doctorFilter, outstandingFilter,
      categoryFilter, circleFilter, paymentTypeFilter,
      hospPayoutFilter, docPayoutFilter, invoiceFilter,
      treatmentFilter, patientFilter,
      admissionDateFilter, surgeryDateFilter,
      totalBillFilter, approvedAmountFilter, hospitalShareAmtFilter,
      doctorChargesFilter, netProfitFilter,
    ],
    queryFn: async () => {
      const filters: Array<{ field: string; operator: string; value: unknown }> = []

      // multiSelect filters
      if (bdFilter.length > 0) filters.push({ field: 'bdm', operator: 'in', value: bdFilter })
      if (hospitalFilter.length > 0) filters.push({ field: 'hospital', operator: 'in', value: hospitalFilter })
      if (doctorFilter.length > 0) filters.push({ field: 'doctor', operator: 'in', value: doctorFilter })
      if (outstandingFilter.length > 0) filters.push({ field: 'outstandingStatus', operator: 'in', value: outstandingFilter })
      if (categoryFilter.length > 0) filters.push({ field: 'category', operator: 'in', value: categoryFilter })
      if (circleFilter.length > 0) filters.push({ field: 'circle', operator: 'in', value: circleFilter })
      if (paymentTypeFilter.length > 0) filters.push({ field: 'paymentType', operator: 'in', value: paymentTypeFilter })
      if (hospPayoutFilter.length > 0) filters.push({ field: 'hospPayout', operator: 'in', value: hospPayoutFilter })
      if (docPayoutFilter.length > 0) filters.push({ field: 'docPayout', operator: 'in', value: docPayoutFilter })
      if (invoiceFilter.length > 0) filters.push({ field: 'invoice', operator: 'in', value: invoiceFilter })

      // search filters
      if (treatmentFilter.trim()) filters.push({ field: 'treatment', operator: 'contains', value: treatmentFilter })
      if (patientFilter.trim()) filters.push({ field: 'patient', operator: 'contains', value: patientFilter })

      // dateRange filters
      if (admissionDateFilter.length === 2 && admissionDateFilter[0])
        filters.push({ field: 'admissionDate', operator: 'between', value: admissionDateFilter })
      if (surgeryDateFilter.length === 2 && surgeryDateFilter[0])
        filters.push({ field: 'surgeryDate', operator: 'between', value: surgeryDateFilter })

      // numberRange filters
      if (totalBillFilter && (totalBillFilter.min != null || totalBillFilter.max != null))
        filters.push({ field: 'totalBill', operator: 'between', value: totalBillFilter })
      if (approvedAmountFilter && (approvedAmountFilter.min != null || approvedAmountFilter.max != null))
        filters.push({ field: 'approvedAmount', operator: 'between', value: approvedAmountFilter })
      if (hospitalShareAmtFilter && (hospitalShareAmtFilter.min != null || hospitalShareAmtFilter.max != null))
        filters.push({ field: 'hospitalShareAmt', operator: 'between', value: hospitalShareAmtFilter })
      if (doctorChargesFilter && (doctorChargesFilter.min != null || doctorChargesFilter.max != null))
        filters.push({ field: 'doctorCharges', operator: 'between', value: doctorChargesFilter })
      if (netProfitFilter && (netProfitFilter.min != null || netProfitFilter.max != null))
        filters.push({ field: 'netProfit', operator: 'between', value: netProfitFilter })

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        caseStage: 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING',
        dateField: 'surgery',
      })
      if (filters.length > 0) {
        params.set('filters', JSON.stringify(filters))
      }
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
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const activeFilterCount =
    bdFilter.length + hospitalFilter.length + doctorFilter.length + outstandingFilter.length +
    categoryFilter.length + circleFilter.length + paymentTypeFilter.length +
    hospPayoutFilter.length + docPayoutFilter.length + invoiceFilter.length +
    tableMonthFilter.length +
    (treatmentFilter.trim() ? 1 : 0) + (patientFilter.trim() ? 1 : 0) +
    (admissionDateFilter.length > 0 ? 1 : 0) + (surgeryDateFilter.length > 0 ? 1 : 0) +
    (totalBillFilter ? 1 : 0) + (approvedAmountFilter ? 1 : 0) +
    (hospitalShareAmtFilter ? 1 : 0) + (doctorChargesFilter ? 1 : 0) + (netProfitFilter ? 1 : 0) +
    (selectedStage ? 1 : 0)

  const clearFilters = () => {
    setBdFilter([])
    setHospitalFilter([])
    setDoctorFilter([])
    setOutstandingFilter([])
    setCategoryFilter([])
    setCircleFilter([])
    setPaymentTypeFilter([])
    setHospPayoutFilter([])
    setDocPayoutFilter([])
    setInvoiceFilter([])
    setTableMonthFilter([])
    setTreatmentFilter('')
    setPatientFilter('')
    setAdmissionDateFilter([])
    setSurgeryDateFilter([])
    setTotalBillFilter(null)
    setApprovedAmountFilter(null)
    setHospitalShareAmtFilter(null)
    setDoctorChargesFilter(null)
    setNetProfitFilter(null)
    setSelectedStage(null)
  }

  const tableRecords = useMemo(
    () =>
      records?.filter((r) => {
        // Show rows that have either: insurance discharge sheet OR cash case P/L record
        const hasInsuranceDs = !!(r as Lead).dischargeSheet;
        const isCashCase = r.caseStage?.toString().startsWith('CASH_');
        const hasPlData = !!(r as Lead).plRecord;

        if (selectedStage) {
          const stage = r.caseStage?.toString() || ''
          if (selectedStage === 'admitted') {
            if (stage !== 'ADMITTED') return false
          } else if (selectedStage === 'ipd_done') {
            if (stage !== 'IPD_DONE' && stage !== 'CASH_IPD_DONE' && stage !== 'DISCHARGED' && stage !== 'CASH_DISCHARGED' && stage !== 'PL_PENDING' && stage !== 'OUTSTANDING') return false
          } else if (selectedStage === 'discharged') {
            if (stage !== 'DISCHARGED' && stage !== 'CASH_DISCHARGED') return false
          } else if (selectedStage === 'scheduled') {
            if (stage !== 'PREAUTH_COMPLETE' && stage !== 'INITIATED') return false
          } else if (selectedStage === 'posted') {
            if (stage !== 'INITIATED') return false
          } else if (selectedStage === 'cancelled') {
            if (stage !== 'CANCELLED') return false
          }
        } else {
          if (!hasInsuranceDs && !(isCashCase && hasPlData)) return false
        }

        if (tableMonthFilter.length > 0) {
          const resolved = resolvePlRow(r as unknown as Record<string, unknown>)
          const rowMonth = resolved.month
          if (!rowMonth) return false
          const y = rowMonth.getFullYear()
          const m = String(rowMonth.getMonth() + 1).padStart(2, '0')
          const rowMonthKey = `${y}-${m}`
          if (!tableMonthFilter.includes(rowMonthKey)) return false
        }

        return true
      }),
    [records, selectedStage, tableMonthFilter]
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

  const totalMediendShare = useMemo(() => {
    return (
      tableRecords?.reduce((sum: number, r: Lead) => {
        const pl = r.plRecord as Record<string, unknown> | undefined
        const share = pl?.hospitalShareAmount != null
          ? Number(pl.hospitalShareAmount)
          : ((r as any).hospitalShare || 0)
        return sum + share
      }, 0) || 0
    )
  }, [tableRecords])

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
      actualImplantCost: sum(plFn('actualImplantCost')),
      actualInstrumentCost: sum(plFn('actualInstrumentCost')),
      hospitalRecoverAmount: sum(plFn('hospitalRecoverAmount')),
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

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!tableRecords || tableRecords.length === 0) {
      toast.error('No data to export')
      return
    }

    const dataToExport = tableRecords.map((record) => {
      const resolved = resolvePlRow(record as unknown as Record<string, unknown>)
      const pl = record.plRecord as Record<string, any> | undefined

      return {
        'Lead Ref': record.leadRef ?? '—',
        'Month': resolved.month ? resolved.month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
        'Lead Received (Insurance)': resolved.leadReceivedFromInsuranceAt ? resolved.leadReceivedFromInsuranceAt.toLocaleDateString('en-IN') : '—',
        'Manager': resolved.manager ?? '—',
        'BDM': resolved.bdm ?? '—',
        'Patient': resolved.patient ?? '—',
        'Category': resolved.category ?? '—',
        'Treatment': resolved.treatment ?? '—',
        'Circle': record.circle ?? '—',
        'Doctor': resolved.doctor ?? '—',
        'Hospital': resolved.hospital ?? '—',
        'Admission Date': resolved.admission ? resolved.admission.toLocaleDateString('en-IN') : '—',
        'Surgery Date': resolved.surgery ? resolved.surgery.toLocaleDateString('en-IN') : '—',
        'Payment Type': resolved.paymentType ?? '—',
        'PL Status': pl?.outstandingStatus ?? 'NEW',
        'Status': resolved.status ?? '—',
        'Total Bill': resolved.totalBill ?? 0,
        'Approved Amount': resolved.approvedAmount ?? 0,
        'Total Deduction': resolved.deductionTotal ?? 0,
        'Deduction Paid by Patient': resolved.deductionPaidByPatient ?? 0,
        'Waived Off': resolved.deductionWaived ?? 0,
        'Amount Paid': (resolved.approvedAmount ?? 0) + (resolved.deductionPaidByPatient ?? 0),
        'MediEND %': pl?.hospitalSharePct ?? '—',
        'MediEND Share': pl?.hospitalShareAmount ?? 0,
        'Doctor Fee': pl?.doctorCharges ?? 0,
        'Implant': pl?.implantCost ?? 0,
        'Implant By': pl?.implantPaidBy ?? '—',
        'Instrument': pl?.instrumentsCost ?? 0,
        'Instrument By': pl?.instrumentsPaidBy ?? '—',
        'Actual Implant': pl?.actualImplantCost ?? 0,
        'Actual Instrument': pl?.actualInstrumentCost ?? 0,
        'Hospital Recover': pl?.hospitalRecoverAmount ?? 0,
        'D&C': pl?.dcCharges ?? 0,
        'Cab': pl?.cabCharges ?? 0,
        'Referral': pl?.referralAmount ?? 0,
        'MediEND Net %': pl?.mediendSharePct ?? '—',
        'MediEND Net': pl?.mediendShareAmount ?? 0,
        'Net Profit': record.plRecord?.finalProfit ?? record.plRecord?.mediendNetProfit ?? record.netProfit ?? 0,
        'Mediend Profit': pl?.mediendProfit ?? 0,
        'Remarks': pl?.remarks ?? '',
        'MediEND Payout': pl?.hospitalPayoutStatus ?? 'PENDING',
        'Doctor Payout': pl?.doctorPayoutStatus ?? 'PENDING',
        'Invoice Status': pl?.mediendInvoiceStatus ?? 'PENDING',
      }
    })

    if (format === 'csv') {
      const headers = Object.keys(dataToExport[0])
      const csvRows = [
        headers.join(','),
        ...dataToExport.map((row) =>
          headers
            .map((fieldName) => {
              const val = row[fieldName as keyof typeof row]
              const stringVal = val === null || val === undefined ? '' : String(val)
              const escaped = stringVal.replace(/"/g, '""')
              if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
                return `"${escaped}"`
              }
              return escaped
            })
            .join(',')
        ),
      ]
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `pl_ledger_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      import('xlsx').then((XLSX) => {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PL Ledger')
        XLSX.writeFile(workbook, `pl_ledger_${new Date().toISOString().split('T')[0]}.xlsx`)
      }).catch((err) => {
        toast.error('Failed to export to Excel: ' + err.message)
      })
    }
  }

  const columns = useMemo<ColumnDef<any>[]>(() => {
    const paidBy = (v: unknown) => (v === 'HOSPITAL' ? 'Hospital' : v === 'MEDIEND' ? 'Mediend' : '—')
    const cols: ColumnDef<any>[] = [
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
              {record.leadRef && (
                <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-7 w-7" />
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const record = row.original
          return record.dischargeSheet ? (
            <div onClick={(e) => e.stopPropagation()}>
              <DischargeSummaryDialog
                leadId={record.id}
                preloaded={record.dischargeSheet as never}
              />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
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
        accessorFn: (row) => resolvePlRow(row as any).month,
        cell: ({ getValue }) => formatPlMonth(getValue() as any),
      },
      {
        id: 'leadReceived',
        header: 'Lead Received (Insurance)',
        accessorFn: (row) => resolvePlRow(row as any).leadReceivedFromInsuranceAt,
        cell: ({ getValue }) => formatPlDate(getValue() as any),
      },
      {
        id: 'manager',
        header: 'Manager',
        accessorFn: (row) => resolvePlRow(row as any).manager,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'bdm',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>BDM</span>
            <ColumnFilter
              options={filterOptions.bds}
              value={bdFilter}
              onChange={setBdFilter}
              type="multiSelect"
            />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).bdm,
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
        accessorFn: (row) => resolvePlRow(row as any).patient,
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
        accessorFn: (row) => resolvePlRow(row as any).category,
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
        accessorFn: (row) => resolvePlRow(row as any).treatment,
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
            <ColumnFilter
              options={filterOptions.doctors}
              value={doctorFilter}
              onChange={setDoctorFilter}
              type="multiSelect"
            />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).doctor,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'hospital',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Hospital</span>
            <ColumnFilter
              options={filterOptions.hospitals}
              value={hospitalFilter}
              onChange={setHospitalFilter}
              type="multiSelect"
            />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).hospital,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'admissionDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Admission</span>
            <ColumnFilter value={admissionDateFilter} onChange={setAdmissionDateFilter} type="dateRange" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).admission,
        cell: ({ getValue }) => formatPlDate(getValue() as any),
      },
      {
        id: 'surgeryDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Surgery</span>
            <ColumnFilter value={surgeryDateFilter} onChange={setSurgeryDateFilter} type="dateRange" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).surgery,
        cell: ({ getValue }) => formatPlDate(getValue() as any),
      },
      {
        id: 'paymentType',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Payment</span>
            <ColumnFilter options={filterOptions.paymentTypes} value={paymentTypeFilter} onChange={setPaymentTypeFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).paymentType,
        cell: ({ getValue }) => (getValue() as string) || '—',
      },
      {
        id: 'outstandingStatus',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>PL Status</span>
            <ColumnFilter
              options={[
                { label: 'New', value: 'NEW' },
                { label: 'Draft', value: 'DRAFT' },
                { label: 'Outstanding', value: 'OUTSTANDING' }
              ]}
              value={outstandingFilter}
              onChange={setOutstandingFilter}
              type="multiSelect"
            />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.outstandingStatus || 'NEW',
        cell: ({ getValue }) => {
          const val = getValue() as string
          if (!val) return '—'
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getStatusBadgeClass(val, 'case'))}
            >
              {val}
            </Badge>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => resolvePlRow(row as any).status,
        cell: ({ getValue }) => {
          const val = getValue() as string
          if (!val) return '—'
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getStatusBadgeClass(val, 'case'))}
            >
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
        accessorFn: (row) => resolvePlRow(row as any).totalBill,
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'approvedAmount',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Approved amount</span>
            <ColumnFilter value={approvedAmountFilter} onChange={setApprovedAmountFilter} type="numberRange" min={filterOptions.approvedAmountBounds.min} max={filterOptions.approvedAmountBounds.max} />
          </div>
        ),
        accessorFn: (row) => resolvePlRow(row as any).approvedAmount,
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'deductionTotal',
        header: 'Total Deduction',
        accessorFn: (row) => resolvePlRow(row as any).deductionTotal,
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'deductionPatient',
        header: 'Deduction Paid by Patient',
        accessorFn: (row) => resolvePlRow(row as any).deductionPaidByPatient,
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'deductionWaived',
        header: 'Waived Off',
        accessorFn: (row) => resolvePlRow(row as any).deductionWaived,
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'amountPaid',
        header: 'Amount paid',
        accessorFn: (row) => {
          const res = resolvePlRow(row as any)
          return (res.approvedAmount ?? 0) + (res.deductionPaidByPatient ?? 0) || null
        },
        cell: ({ getValue }) => formatPlRupee(getValue() as any),
      },
      {
        id: 'hospitalSharePct',
        header: 'MediEND %',
        accessorFn: (row) => row.plRecord?.hospitalSharePct,
        cell: ({ getValue }) => getValue() != null ? `${getValue()}%` : '—',
      },
      {
        id: 'hospitalShareAmt',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>MediEND share</span>
            <ColumnFilter value={hospitalShareAmtFilter} onChange={setHospitalShareAmtFilter} type="numberRange" min={filterOptions.hospitalShareAmtBounds.min} max={filterOptions.hospitalShareAmtBounds.max} />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.hospitalShareAmount != null ? Number(row.plRecord.hospitalShareAmount) : ((row as any).hospitalShare || null),
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'doctorCharges',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Doctor fee</span>
            <ColumnFilter value={doctorChargesFilter} onChange={setDoctorChargesFilter} type="numberRange" min={filterOptions.doctorChargesBounds.min} max={filterOptions.doctorChargesBounds.max} />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.doctorCharges != null ? Number(row.plRecord.doctorCharges) : ((row as any).doctorShare || null),
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'implant',
        header: 'Implant',
        accessorFn: (row) => row.plRecord?.implantCost != null ? Number(row.plRecord.implantCost) : ((row as any).implantAmount || null),
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'implantPaidBy',
        header: 'Implant by',
        accessorFn: (row) => row.plRecord?.implantPaidBy,
        cell: ({ getValue }) => paidBy(getValue()),
      },
      {
        id: 'instruments',
        header: 'Instrument',
        accessorFn: (row) => row.plRecord?.instrumentsCost != null ? Number(row.plRecord.instrumentsCost) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'instrumentsPaidBy',
        header: 'Instr. by',
        accessorFn: (row) => row.plRecord?.instrumentsPaidBy,
        cell: ({ getValue }) => paidBy(getValue()),
      },
      {
        id: 'actualImplantCost',
        header: 'Actual Implant',
        accessorFn: (row) => row.plRecord?.actualImplantCost != null ? Number(row.plRecord.actualImplantCost) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'actualInstrumentCost',
        header: 'Actual Instrument',
        accessorFn: (row) => row.plRecord?.actualInstrumentCost != null ? Number(row.plRecord.actualInstrumentCost) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'hospitalRecoverAmount',
        header: 'Hospital Recover',
        accessorFn: (row) => row.plRecord?.hospitalRecoverAmount != null ? Number(row.plRecord.hospitalRecoverAmount) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'dc',
        header: 'D&C',
        accessorFn: (row) => row.plRecord?.dcCharges != null ? Number(row.plRecord.dcCharges) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'cab',
        header: 'Cab',
        accessorFn: (row) => row.plRecord?.cabCharges != null ? Number(row.plRecord.cabCharges) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'referral',
        header: 'Referral',
        accessorFn: (row) => row.plRecord?.referralAmount != null ? Number(row.plRecord.referralAmount) : null,
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'mediendSharePct',
        header: 'MediEND Net %',
        accessorFn: (row) => row.plRecord?.mediendSharePct,
        cell: ({ getValue }) => getValue() != null ? `${getValue()}%` : '—',
      },
      {
        id: 'mediendShareAmt',
        header: 'MediEND Net',
        accessorFn: (row) => row.plRecord?.mediendShareAmount != null ? Number(row.plRecord.mediendShareAmount) : ((row as any).mediendProfit || null),
        cell: ({ getValue }) => rupee(getValue() as any),
      },
      {
        id: 'netProfit',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Net profit</span>
            <ColumnFilter value={netProfitFilter} onChange={setNetProfitFilter} type="numberRange" min={filterOptions.netProfitBounds.min} max={filterOptions.netProfitBounds.max} />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.finalProfit ?? row.plRecord?.mediendNetProfit ?? row.netProfit ?? 0,
        cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN')}`,
      },
      {
        id: 'mediendProfit',
        header: 'Mediend Profit',
        accessorFn: (row) => (row.plRecord as any)?.mediendProfit != null ? Number((row.plRecord as any).mediendProfit) : ((row as any).mediendProfit ? Number((row as any).mediendProfit) : null),
        cell: ({ getValue }) => getValue() != null ? `₹${(getValue() as number).toLocaleString('en-IN')}` : '—',
      },
      {
        id: 'remarks',
        header: 'Remarks',
        accessorFn: (row) => row.plRecord?.remarks,
        cell: ({ getValue }) => (
          <span className="truncate max-w-[120px] block" title={String(getValue() || '')}>
            {(getValue() as string) || '—'}
          </span>
        ),
      },
      {
        id: 'hospPayout',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>MediEND payout</span>
            <ColumnFilter options={filterOptions.hospPayouts} value={hospPayoutFilter} onChange={setHospPayoutFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.hospitalPayoutStatus || 'PENDING',
        cell: ({ getValue }) => {
          const val = getValue() as string
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getStatusBadgeClass(val, 'payout'))}
            >
              {val}
            </Badge>
          )
        },
      },
      {
        id: 'docPayout',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Dr payout</span>
            <ColumnFilter options={filterOptions.docPayouts} value={docPayoutFilter} onChange={setDocPayoutFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.doctorPayoutStatus || 'PENDING',
        cell: ({ getValue }) => {
          const val = getValue() as string
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getStatusBadgeClass(val, 'payout'))}
            >
              {val}
            </Badge>
          )
        },
      },
      {
        id: 'invoice',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap">
            <span>Invoice</span>
            <ColumnFilter options={filterOptions.invoices} value={invoiceFilter} onChange={setInvoiceFilter} type="multiSelect" />
          </div>
        ),
        accessorFn: (row) => row.plRecord?.mediendInvoiceStatus || 'PENDING',
        cell: ({ getValue }) => {
          const val = getValue() as string
          return (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", getStatusBadgeClass(val, 'payout'))}
            >
              {val}
            </Badge>
          )
        },
      },
    ]

    return cols.filter((col) => {
      let colId = col.id || (col as any).accessorKey
      if (!colId) return true

      // Handle special mappings to match resourceMap.ts
      if (colId === 'leadReceived') colId = 'lead_received'
      else if (colId === 'admissionDate') colId = 'admission_date'
      else if (colId === 'surgeryDate') colId = 'surgery_date'
      else if (colId === 'paymentType') colId = 'payment_type'
      else if (colId === 'outstandingStatus') colId = 'outstanding_status'
      else if (colId === 'totalBill') colId = 'total_bill'
      else if (colId === 'approvedAmount') colId = 'approved_amount'
      else if (colId === 'deductionTotal') colId = 'deduction_total'
      else if (colId === 'deductionPatient') colId = 'deduction_patient'
      else if (colId === 'deductionWaived') colId = 'deduction_waived'
      else if (colId === 'amountPaid') colId = 'amount_paid'
      else if (colId === 'hospitalSharePct') colId = 'hospital_share_pct'
      else if (colId === 'hospitalShareAmt') colId = 'hospital_share_amt'
      else if (colId === 'doctorCharges') colId = 'doctor_charges'
      else if (colId === 'implantPaidBy') colId = 'implant_paid_by'
      else if (colId === 'instrumentsPaidBy') colId = 'instruments_paid_by'
      else if (colId === 'actualImplantCost') colId = 'actual_implant_cost'
      else if (colId === 'actualInstrumentCost') colId = 'actual_instrument_cost'
      else if (colId === 'hospitalRecoverAmount') colId = 'hospital_recover_amount'
      else if (colId === 'mediendSharePct') colId = 'mediend_share_pct'
      else if (colId === 'mediendShareAmt') colId = 'mediend_share_amt'
      else if (colId === 'netProfit') colId = 'net_profit'
      else if (colId === 'mediendProfit') colId = 'mediend_profit'
      else if (colId === 'hospPayout') colId = 'hosp_payout'
      else if (colId === 'docPayout') colId = 'doc_payout'

      const resourceKey = `insurance_pl.pl_ledger.table.dischargeSheet.column.${colId}`
      if (resourceKey in RESOURCE_MAP && resourceKey in permissions) {
        return hasAccess(resourceKey, 'READ')
      }
      return true
    })
  }, [
    filterOptions,
    bdFilter,
    patientFilter,
    categoryFilter,
    treatmentFilter,
    circleFilter,
    doctorFilter,
    hospitalFilter,
    admissionDateFilter,
    surgeryDateFilter,
    paymentTypeFilter,
    outstandingFilter,
    totalBillFilter,
    approvedAmountFilter,
    hospitalShareAmtFilter,
    doctorChargesFilter,
    netProfitFilter,
    hospPayoutFilter,
    docPayoutFilter,
    invoiceFilter,
    hasAccess,
    permissions
  ])

  return (
    <ProtectedRoute>
      <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gradient-to-br from-slate-50 via-teal-50/35 to-indigo-50/45 p-6 dark:from-slate-950 dark:via-teal-950/20 dark:to-indigo-950/25">
        <div className="w-full min-w-0 space-y-6">
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
              <DropdownMenu open={monthsMenuOpen} onOpenChange={handleMonthsMenuOpenChange}>
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
                <DropdownMenuContent align="end" className="w-56 p-2 z-50">
                  <div className="flex flex-col gap-2">
                    <Input
                      type="text"
                      placeholder="Search months..."
                      value={monthsSearchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonthsSearchQuery(e.target.value)}
                      className="h-8 text-xs px-2"
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation()}
                    />
                    <div className="max-h-48 overflow-y-auto border rounded-md">
                      <DropdownMenuCheckboxItem
                        checked={tempSelectedMonths.length === MONTH_OPTIONS.length}
                        onCheckedChange={(checked) => {
                          if (checked) setTempSelectedMonths(MONTH_OPTIONS.map((m) => m.key))
                          else setTempSelectedMonths([])
                        }}
                        onSelect={(e: Event) => e.preventDefault()}
                      >
                        All
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {MONTH_OPTIONS.filter((m) =>
                        m.label.toLowerCase().includes(monthsSearchQuery.toLowerCase())
                      ).map((m) => (
                        <DropdownMenuCheckboxItem
                          key={m.key}
                          checked={tempSelectedMonths.includes(m.key)}
                          onCheckedChange={(checked) => {
                            setTempSelectedMonths((prev) =>
                              checked ? [...prev, m.key] : prev.filter((k) => k !== m.key)
                            )
                          }}
                          onSelect={(e: Event) => e.preventDefault()}
                        >
                          {m.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTempSelectedMonths([])
                          setSelectedMonths([])
                          setMonthsMenuOpen(false)
                        }}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedMonths(tempSelectedMonths)
                          setMonthsMenuOpen(false)
                        }}
                        className="h-7 px-2.5 text-xs font-medium"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {(selectedMonths.length !== 1 || selectedMonths[0] !== currentMonthKey() || activeFilterCount > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-500/10"
                  onClick={() => {
                    setSelectedMonths([currentMonthKey()])
                    clearFilters()
                  }}
                >
                  <X className="h-3 w-3" />
                  Reset {activeFilterCount > 0 && `(${activeFilterCount})`}
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
                    ['actualImplantCost', 'Actual Implant'],
                    ['actualInstrumentCost', 'Actual Instrument'],
                    ['hospitalRecoverAmount', 'Hospital Recover'],
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

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground ml-auto">
              {tableRecords?.length ?? 0} of {records?.length ?? 0} rows
            </span>
          </div>

          <div className="flex flex-wrap gap-3 w-full">
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'admitted'
                  ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/40"
                  : "border-indigo-100 bg-white hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-slate-900 dark:hover:border-indigo-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'admitted' ? null : 'admitted')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  Admitted
                </span>
                {selectedStage === 'admitted' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/25 text-indigo-700 hover:bg-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    <Users className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-indigo-950 dark:text-indigo-50">
                  {pipelineStats?.admitted ?? '—'}
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">By admission date</p>
              </div>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'ipd_done'
                  ? "border-cyan-500 ring-2 ring-cyan-500/30 bg-cyan-50/50 dark:bg-cyan-950/40"
                  : "border-cyan-100 bg-white hover:border-cyan-300 dark:border-cyan-900/50 dark:bg-slate-900 dark:hover:border-cyan-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'ipd_done' ? null : 'ipd_done')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                  IPD done
                </span>
                {selectedStage === 'ipd_done' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/25 text-cyan-700 hover:bg-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                    <Activity className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-cyan-950 dark:text-cyan-50">
                  {records?.length ?? '—'}
                </div>
                <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-0.5">Status update in range</p>
              </div>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'discharged'
                  ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/40"
                  : "border-emerald-100 bg-white hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-slate-900 dark:hover:border-emerald-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'discharged' ? null : 'discharged')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                  Discharged
                </span>
                {selectedStage === 'discharged' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-700 hover:bg-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
                  {pipelineStats?.discharged ?? '—'}
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Discharge date</p>
              </div>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'scheduled'
                  ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/40"
                  : "border-blue-100 bg-white hover:border-blue-300 dark:border-blue-900/50 dark:bg-slate-900 dark:hover:border-blue-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'scheduled' ? null : 'scheduled')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                  IPD Scheduled
                </span>
                {selectedStage === 'scheduled' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/25 text-blue-700 hover:bg-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    <Calendar className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-blue-950 dark:text-blue-50">
                  {pipelineStats?.surgeryScheduled ?? '—'}
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">By surgery date</p>
              </div>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'posted'
                  ? "border-sky-500 ring-2 ring-sky-500/30 bg-sky-50/50 dark:bg-sky-950/40"
                  : "border-sky-100 bg-white hover:border-sky-300 dark:border-sky-900/50 dark:bg-slate-900 dark:hover:border-sky-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'posted' ? null : 'posted')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-300">
                  Posted
                </span>
                {selectedStage === 'posted' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/25 text-sky-700 hover:bg-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                    <Calendar className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-sky-950 dark:text-sky-50">
                  {pipelineStats?.posted ?? '—'}
                </div>
                <p className="text-xs text-sky-700 dark:text-sky-400 mt-0.5">By surgery date</p>
              </div>
            </Card>
            <Card
              className={cn(
                "overflow-hidden border transition-all hover:-translate-y-0.5 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px] cursor-pointer",
                selectedStage === 'cancelled'
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/50 dark:bg-rose-950/40"
                  : "border-rose-100 bg-white hover:border-rose-300 dark:border-rose-900/50 dark:bg-slate-900 dark:hover:border-rose-800"
              )}
              onClick={() => {
                setSelectedStage(prev => prev === 'cancelled' ? null : 'cancelled')
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                  Cancelled
                </span>
                {selectedStage === 'cancelled' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStage(null)
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/25 text-rose-700 hover:bg-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/30 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    <X className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-rose-950 dark:text-rose-50">
                  {pipelineStats?.cancelled ?? '—'}
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">Cancelled status</p>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3 w-full">
            <Card
              className="overflow-hidden border border-violet-100 bg-white hover:border-violet-300 dark:border-violet-900/50 dark:bg-slate-900 dark:hover:border-violet-800 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                  ATS
                </span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                  <ReceiptText className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-violet-950 dark:text-violet-50">
                  {tableRecords && tableRecords.length > 0
                    ? `₹${Math.round(columnTotals.amountPaid / tableRecords.length).toLocaleString('en-IN')}`
                    : '—'}
                </div>
                <p className="text-xs text-violet-700 dark:text-violet-400 mt-0.5">Amount paid per case</p>
              </div>
            </Card>
            <Card
              className="overflow-hidden border border-emerald-100 bg-white hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-slate-900 dark:hover:border-emerald-800 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                  Total net profit
                </span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <DollarSign className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
                  ₹{totalProfit.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">In filtered rows</p>
              </div>
            </Card>
            <Card
              className="overflow-hidden border border-teal-100 bg-white hover:border-teal-300 dark:border-teal-900/50 dark:bg-slate-900 dark:hover:border-teal-800 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-300">
                  Avg ticket size
                </span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                  <TrendingUp className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-teal-950 dark:text-teal-50">
                  ₹{avgTicketSize.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-teal-700 dark:text-teal-400 mt-0.5">Average per case</p>
              </div>
            </Card>
            <Card
              className="overflow-hidden border border-blue-100 bg-white hover:border-blue-300 dark:border-blue-900/50 dark:bg-slate-900 dark:hover:border-blue-800 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                  Total cases
                </span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  <CheckCircle className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-blue-950 dark:text-blue-50">{tableRecords?.length || 0}</div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Rows in table</p>
              </div>
            </Card>
            <Card
              className="overflow-hidden border border-indigo-100 bg-white hover:border-indigo-300 dark:border-indigo-900/50 dark:bg-slate-900 dark:hover:border-indigo-800 rounded-xl shadow-sm p-2.5 flex flex-col justify-between flex-1 min-w-[150px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  MediEND Share
                </span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  <ReceiptText className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold tabular-nums text-indigo-950 dark:text-indigo-50">
                  ₹{totalMediendShare.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">Total share sum</p>
              </div>
            </Card>
          </div>

          <Card className="min-w-0 w-full overflow-hidden border-teal-200/50 shadow-lg dark:border-teal-800/40">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-teal-500/12 via-indigo-500/10 to-transparent pb-4">
              <div>
                <CardTitle className="text-lg text-teal-950 dark:text-teal-100">P/L records</CardTitle>
                <CardDescription className="mt-1">Click a row to edit. Filtered by surgery date (lead or P/L record).</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-300 bg-background/90 dark:border-slate-600"
                  >
                    <Download className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('xlsx')} className="cursor-pointer">
                    Export to Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={tableRecords ?? []}
                isLoading={isLoading}
                emptyMessage="No P/L records found"
                onRowClick={(record) => {
                  const plStatus = record.plRecord?.outstandingStatus || 'NEW'
                  if (plStatus === 'OUTSTANDING' && user?.role === 'PL_HEAD') {
                    toast.error('Outstanding records can only be edited by Project Head / Executive Assistant')
                    return
                  }
                  setSheetLeadId(record.id)
                  setSheetOpen(true)
                }}
                columnVisibility={visibleCols}
                onColumnVisibilityChange={persistCols}
                footer={
                  tableRecords && tableRecords.length > 0 && (
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
                        {visibleCols.actualImplantCost && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.actualImplantCost)}</TableCell>}
                        {visibleCols.actualInstrumentCost && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.actualInstrumentCost)}</TableCell>}
                        {visibleCols.hospitalRecoverAmount && <TableCell className="whitespace-nowrap">{formatPlRupee(columnTotals.hospitalRecoverAmount)}</TableCell>}
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
                  )
                }
              />
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
