'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  CalendarIcon,
  Download,
  Filter,
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
} from 'lucide-react'
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// --- Types ---

export interface FinanceAnalytics {
  kpis: {
    totalRevenue: number
    totalExpenses: number
    netCashFlow: number
    pendingApprovalsCount: number
    approvedAmount: number
    rejectedAmount: number
  }
  transactionTrends: Array<{
    date: string
    credit: number
    debit: number
    netFlow: number
  }>
  partyAnalysis: Array<{
    partyId: string
    partyName: string
    partyType: string
    totalCredits: number
    totalDebits: number
    netAmount: number
    transactionCount: number
  }>
  headAnalysis: Array<{
    headId: string
    headName: string
    department: string | null
    totalCredits: number
    totalDebits: number
    netAmount: number
    transactionCount: number
  }>
  paymentModeAnalysis: Array<{
    paymentModeId: string
    paymentModeName: string
    totalCredits: number
    totalDebits: number
    netFlow: number
    transactionCount: number
    currentBalance: number
  }>
  approvalStatus: Array<{
    status: string
    count: number
    amount: number
  }>
  topTransactions: Array<{
    id: string
    serialNumber: string
    transactionDate: Date | string
    transactionType: string
    partyName: string
    partyType: string
    headName: string
    paymentModeName: string
    amount: number
    description: string
  }>
  pendingApprovals: Array<{
    id: string
    serialNumber: string
    transactionDate: Date | string
    transactionType: string
    partyName: string
    partyType: string
    headName: string
    paymentModeName: string
    amount: number
    description: string
    createdByName: string
  }>
}

interface PaymentModeSummary {
  id: string
  name: string
  openingBalance: number
  currentBalance: number
  totalCredits: number
  totalDebits: number
  netChange: number
}

interface PartyWiseSummary {
  partyId: string
  partyName: string
  partyType: string
  totalCredits: number
  totalDebits: number
  netAmount: number
  entriesCount: number
}

interface ExpenseReportSummary {
  headId: string
  headName: string
  department: string | null
  totalExpenses: number
  entriesCount: number
}

interface DayWiseSummary {
  date: string
  totalCredits: number
  totalDebits: number
  netChange: number
  entriesCount: number
}

interface RevenueSummary {
  projectId: string
  projectName: string
  totalRevenue: number
  entriesCount: number
}

interface ProfitLossReportResponse {
  type: 'profit-loss'
  data: unknown[]
  revenueByProject: Array<{
    projectId: string
    projectName: string
    totalRevenue: number
    entriesCount: number
  }>
  expensesByHead: Array<{
    headId: string
    headName: string
    department: string | null
    totalExpenses: number
    entriesCount: number
  }>
  totals: {
    totalRevenue?: number
    totalExpenses?: number
    netProfitLoss?: number
  }
}

interface ReportResponse<T> {
  type: string
  data: T[]
  totals: {
    totalCredits?: number
    totalDebits?: number
    totalExpenses?: number
    totalBalance?: number
    totalRevenue?: number
    netProfitLoss?: number
    entriesCount?: number
  }
}

type TabId = 'overview' | 'balances' | 'expenses' | 'revenue' | 'profit-loss' | 'parties' | 'daily'
type PeriodPreset = 'all' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'

interface LedgerEntryDetailRow {
  id: string
  serialNumber: string
  transactionDate: Date | string
  transactionType: string
  partyName: string
  headName: string
  paymentModeName: string
  amount: number
  description: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatCurrencyCompact(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCurrencyForPDF(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function toDateOnly(d: Date) {
  return d.toISOString().split('T')[0]
}

function getRangeFromPreset(
  preset: PeriodPreset,
  customStart: Date | undefined,
  customEnd: Date | undefined
): { startDate?: Date; endDate?: Date } {
  if (preset === 'all') return {}
  if (preset === 'custom') {
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }
    const end = new Date()
    return { startDate: subDays(end, 30), endDate: end }
  }
  const endDate = new Date()
  let startDate = new Date()
  switch (preset) {
    case '7d':
      startDate = subDays(endDate, 7)
      break
    case '30d':
      startDate = subDays(endDate, 30)
      break
    case 'thisMonth':
      startDate = startOfMonth(endDate)
      break
    case 'lastMonth': {
      const last = subMonths(endDate, 1)
      return { startDate: startOfMonth(last), endDate: endOfMonth(last) }
    }
    case 'thisYear':
      startDate = new Date(endDate.getFullYear(), 0, 1)
      break
    default:
      startDate = subDays(endDate, 30)
  }
  return { startDate, endDate }
}

function periodLabel(
  preset: PeriodPreset,
  start?: Date,
  end?: Date
): string {
  if (preset === 'all') return 'All time'
  if (start && end) return `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`
  return 'Period'
}

export function MDFinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d')
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined)
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined)
  const [filterOpen, setFilterOpen] = useState(false)
  const [startCalOpen, setStartCalOpen] = useState(false)
  const [endCalOpen, setEndCalOpen] = useState(false)

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailDrawerType, setDetailDrawerType] = useState<'day' | 'head' | null>(null)
  const [detailDrawerTitle, setDetailDrawerTitle] = useState('')
  const [detailDayDate, setDetailDayDate] = useState<string | null>(null)
  const [detailHeadId, setDetailHeadId] = useState<string | null>(null)

  const { startDate, endDate } = useMemo(
    () => getRangeFromPreset(periodPreset, customStart, customEnd),
    [periodPreset, customStart, customEnd]
  )

  const analyticsQueryKey = useMemo(() => {
    if (periodPreset === 'all') return ['analytics', 'md', 'finance', 'all'] as const
    if (startDate && endDate) {
      return ['analytics', 'md', 'finance', toDateOnly(startDate), toDateOnly(endDate)] as const
    }
    return ['analytics', 'md', 'finance', 'pending'] as const
  }, [periodPreset, startDate, endDate])

  const reportParams = useMemo(() => {
    const p = new URLSearchParams()
    if (startDate) p.set('startDate', startDate.toISOString())
    if (endDate) p.set('endDate', endDate.toISOString())
    return p
  }, [startDate, endDate])
  const reportQuerySuffix = reportParams.toString()

  const { data: analytics, isLoading: loadingAnalytics } = useQuery<FinanceAnalytics>({
    queryKey: analyticsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (periodPreset !== 'all' && startDate && endDate) {
        params.append('startDate', toDateOnly(startDate))
        params.append('endDate', toDateOnly(endDate))
      }
      return apiGet<FinanceAnalytics>(`/api/analytics/md/finance?${params.toString()}`)
    },
    enabled: activeTab === 'overview' && (periodPreset === 'all' || (!!startDate && !!endDate)),
  })

  const { data: paymentModeData, isLoading: loadingPaymentMode } = useQuery<
    ReportResponse<PaymentModeSummary>
  >({
    queryKey: ['md-finance', 'payment-mode', reportQuerySuffix],
    queryFn: () =>
      apiGet<ReportResponse<PaymentModeSummary>>(
        `/api/finance/reports/summary?type=payment-mode&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'balances',
  })

  const { data: expenseReportData, isLoading: loadingExpenseReport } = useQuery<
    ReportResponse<ExpenseReportSummary>
  >({
    queryKey: ['md-finance', 'expense-report', reportQuerySuffix],
    queryFn: () =>
      apiGet<ReportResponse<ExpenseReportSummary>>(
        `/api/finance/reports/summary?type=expense-report&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'expenses',
  })

  const { data: revenueData, isLoading: loadingRevenue } = useQuery<ReportResponse<RevenueSummary>>({
    queryKey: ['md-finance', 'revenue', reportQuerySuffix],
    queryFn: () =>
      apiGet<ReportResponse<RevenueSummary>>(
        `/api/finance/reports/summary?type=revenue&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'revenue',
  })

  const { data: profitLossData, isLoading: loadingProfitLoss } = useQuery<ProfitLossReportResponse>({
    queryKey: ['md-finance', 'profit-loss', reportQuerySuffix],
    queryFn: () =>
      apiGet<ProfitLossReportResponse>(
        `/api/finance/reports/summary?type=profit-loss&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'profit-loss',
  })

  const { data: partyWiseData, isLoading: loadingPartyWise } = useQuery<ReportResponse<PartyWiseSummary>>({
    queryKey: ['md-finance', 'party-wise', reportQuerySuffix],
    queryFn: () =>
      apiGet<ReportResponse<PartyWiseSummary>>(
        `/api/finance/reports/summary?type=party-wise&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'parties',
  })

  const { data: dayWiseData, isLoading: loadingDayWise } = useQuery<ReportResponse<DayWiseSummary>>({
    queryKey: ['md-finance', 'day-wise', reportQuerySuffix],
    queryFn: () =>
      apiGet<ReportResponse<DayWiseSummary>>(
        `/api/finance/reports/summary?type=day-wise&${reportQuerySuffix}`
      ),
    enabled: activeTab === 'daily',
  })

  const detailEntriesQueryKey = useMemo(
    () =>
      [
        'md-finance',
        'entries',
        detailDrawerType,
        detailDayDate,
        detailHeadId,
        reportQuerySuffix,
      ] as const,
    [detailDrawerType, detailDayDate, detailHeadId, reportQuerySuffix]
  )

  const { data: detailEntriesPayload, isLoading: loadingDetailEntries } = useQuery<{
    type: string
    data: LedgerEntryDetailRow[]
  }>({
    queryKey: detailEntriesQueryKey,
    queryFn: async () => {
      const p = new URLSearchParams()
      if (detailDrawerType === 'day') {
        p.set('type', 'day')
        if (detailDayDate) p.set('date', detailDayDate)
      } else {
        p.set('type', 'head')
        if (detailHeadId) p.set('headId', detailHeadId)
      }
      if (startDate) p.set('startDate', startDate.toISOString())
      if (endDate) p.set('endDate', endDate.toISOString())
      return apiGet<{ type: string; data: LedgerEntryDetailRow[] }>(
        `/api/finance/reports/entries?${p.toString()}`
      )
    },
    enabled:
      detailDrawerOpen &&
      !!detailDrawerType &&
      (detailDrawerType === 'day' ? !!detailDayDate : !!detailHeadId),
  })

  const detailEntries = detailEntriesPayload?.data ?? []

  const openDayEntriesDrawer = (dateKey: string, label: string) => {
    setDetailDrawerType('day')
    setDetailDayDate(dateKey)
    setDetailHeadId(null)
    setDetailDrawerTitle(label)
    setDetailDrawerOpen(true)
  }

  const openHeadEntriesDrawer = (headId: string, headName: string) => {
    setDetailDrawerType('head')
    setDetailHeadId(headId)
    setDetailDayDate(null)
    setDetailDrawerTitle(headName)
    setDetailDrawerOpen(true)
  }

  const expenseTotalForBars = expenseReportData?.totals.totalExpenses ?? 0

  const handleDownloadPDF = () => {
    const periodStr = periodLabel(periodPreset, startDate, endDate)
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('MD Finance', 14, 20)
    doc.setFontSize(11)
    doc.text(`Period: ${periodStr}`, 14, 28)
    const startY = 36

    if (activeTab === 'overview' && analytics) {
      doc.setFontSize(12)
      doc.text('Overview', 14, startY)
      let y = startY + 8
      doc.setFontSize(10)
      doc.text(`Total Revenue: ${formatCurrencyForPDF(analytics.kpis.totalRevenue)}`, 14, y)
      y += 6
      doc.text(`Total Debit: ${formatCurrencyForPDF(analytics.kpis.totalExpenses)}`, 14, y)
      y += 6
      doc.text(`Net cash flow: ${formatCurrencyForPDF(analytics.kpis.netCashFlow)}`, 14, y)
      y += 6
      doc.text(`Pending approvals: ${analytics.kpis.pendingApprovalsCount}`, 14, y)
      y += 10
      const top = analytics.topTransactions.slice(0, 15)
      autoTable(doc, {
        head: [['Serial', 'Date', 'Type', 'Party', 'Amount', 'Description']],
        body: top.map((t) => [
          t.serialNumber,
          format(new Date(t.transactionDate), 'dd MMM yyyy'),
          t.transactionType,
          t.partyName,
          formatCurrencyForPDF(t.amount),
          (t.description || '').slice(0, 40),
        ]),
        startY: y,
      })
    } else if (activeTab === 'balances' && paymentModeData?.data?.length) {
      autoTable(doc, {
        head: [['Payment Mode', 'Opening', 'Credits', 'Debits', 'Net', 'Balance']],
        body: paymentModeData.data.map((m) => [
          m.name,
          formatCurrencyForPDF(m.openingBalance),
          formatCurrencyForPDF(m.totalCredits),
          formatCurrencyForPDF(m.totalDebits),
          formatCurrencyForPDF(m.netChange),
          formatCurrencyForPDF(m.currentBalance),
        ]),
        startY: startY,
      })
    } else if (activeTab === 'expenses' && expenseReportData?.data?.length) {
      autoTable(doc, {
        head: [['Head', 'Department', 'Expenses', 'Entries']],
        body: expenseReportData.data.map((h) => [
          h.headName,
          h.department || '-',
          formatCurrencyForPDF(h.totalExpenses),
          String(h.entriesCount),
        ]),
        startY: startY,
      })
    } else if (activeTab === 'revenue' && revenueData?.data?.length) {
      autoTable(doc, {
        head: [['Project', 'Revenue', 'Entries']],
        body: revenueData.data.map((p) => [
          p.projectName,
          formatCurrencyForPDF(p.totalRevenue),
          String(p.entriesCount),
        ]),
        startY: startY,
      })
    } else if (activeTab === 'profit-loss' && profitLossData) {
      let y = startY
      doc.text('Revenue by project', 14, y)
      y += 6
      const revBody =
        (profitLossData.revenueByProject ?? []).length === 0
          ? [['No revenue', '', '']]
          : profitLossData.revenueByProject.map((r) => [
              r.projectName,
              formatCurrencyForPDF(r.totalRevenue),
              String(r.entriesCount),
            ])
      autoTable(doc, { head: [['Project', 'Revenue', 'Entries']], body: revBody, startY: y })
      y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
      y += 8
      doc.text('Expenses by head', 14, y)
      y += 6
      const expBody =
        (profitLossData.expensesByHead ?? []).length === 0
          ? [['No expenses', '', '', '']]
          : profitLossData.expensesByHead.map((e) => [
              e.headName,
              e.department ?? '—',
              formatCurrencyForPDF(e.totalExpenses),
              String(e.entriesCount),
            ])
      autoTable(doc, {
        head: [['Head', 'Dept', 'Expenses', 'Entries']],
        body: expBody,
        startY: y,
      })
      y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
      y += 8
      doc.setFont('helvetica', 'bold')
      doc.text('Net P/L:', 14, y)
      doc.setFont('helvetica', 'normal')
      doc.text(
        formatCurrencyForPDF(profitLossData.totals.netProfitLoss ?? 0),
        50,
        y
      )
    } else if (activeTab === 'parties' && partyWiseData?.data?.length) {
      autoTable(doc, {
        head: [['Party', 'Type', 'Credits', 'Debits', 'Net', 'Entries']],
        body: partyWiseData.data.map((p) => [
          p.partyName,
          p.partyType,
          formatCurrencyForPDF(p.totalCredits),
          formatCurrencyForPDF(p.totalDebits),
          formatCurrencyForPDF(p.netAmount),
          String(p.entriesCount),
        ]),
        startY: startY,
      })
    } else if (activeTab === 'daily' && dayWiseData?.data?.length) {
      autoTable(doc, {
        head: [['Date', 'Credits', 'Debits', 'Net', 'Entries']],
        body: dayWiseData.data.map((d) => [
          format(new Date(d.date), 'dd MMM yyyy'),
          formatCurrencyForPDF(d.totalCredits),
          formatCurrencyForPDF(d.totalDebits),
          formatCurrencyForPDF(d.netChange),
          String(d.entriesCount),
        ]),
        startY: startY,
      })
    } else {
      doc.text('No data to export for this tab.', 14, startY)
    }

    doc.save(`md-finance-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  const pdfDisabled =
    (activeTab === 'overview' && (loadingAnalytics || !analytics)) ||
    (activeTab === 'balances' && (loadingPaymentMode || !paymentModeData?.data?.length)) ||
    (activeTab === 'expenses' && (loadingExpenseReport || !expenseReportData?.data?.length)) ||
    (activeTab === 'revenue' && (loadingRevenue || !revenueData?.data?.length)) ||
    (activeTab === 'profit-loss' && (loadingProfitLoss || !profitLossData)) ||
    (activeTab === 'parties' && (loadingPartyWise || !partyWiseData?.data?.length)) ||
    (activeTab === 'daily' && (loadingDayWise || !dayWiseData?.data?.length))

  const presetButtons: { id: PeriodPreset; label: string }[] = [
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: 'thisMonth', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' },
    { id: 'thisYear', label: 'This year' },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-2 py-2 sm:gap-6 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">Finance</h1>
          <p className="text-muted-foreground text-sm">Overview and reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="size-4" />
            <span className="max-w-[200px] truncate text-left">
              {periodLabel(periodPreset, startDate, endDate)}
            </span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={handleDownloadPDF}
            disabled={pdfDisabled}
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Filter sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Period</SheetTitle>
            <SheetDescription>Choose a preset or custom range for all tabs.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
            {presetButtons.map((b) => (
              <Button
                key={b.id}
                variant={periodPreset === b.id ? 'default' : 'outline'}
                size="sm"
                className="h-auto min-h-10 py-2 whitespace-normal text-center"
                onClick={() => {
                  setPeriodPreset(b.id)
                  if (b.id !== 'custom') {
                    setCustomStart(undefined)
                    setCustomEnd(undefined)
                  }
                }}
              >
                {b.label}
              </Button>
            ))}
          </div>
          {periodPreset === 'custom' && (
            <div className="flex flex-col gap-3 px-4">
              <p className="text-muted-foreground text-sm">Custom range</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Dialog open={startCalOpen} onOpenChange={setStartCalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal sm:w-[200px]">
                      <CalendarIcon className="mr-2 size-4" />
                      {customStart ? format(customStart, 'PP') : 'Start date'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStart}
                      onSelect={(d) => {
                        setCustomStart(d)
                        setStartCalOpen(false)
                      }}
                      initialFocus
                    />
                  </DialogContent>
                </Dialog>
                <Dialog open={endCalOpen} onOpenChange={setEndCalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal sm:w-[200px]">
                      <CalendarIcon className="mr-2 size-4" />
                      {customEnd ? format(customEnd, 'PP') : 'End date'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEnd}
                      onSelect={(d) => {
                        setCustomEnd(d)
                        setEndCalOpen(false)
                      }}
                      initialFocus
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
          <SheetFooter className="sm:justify-center">
            <Button className="w-full sm:w-auto" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
        <div className="bg-background sticky top-0 z-10 -mx-2 overflow-x-auto px-2 pb-1 sm:static sm:z-auto sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 bg-muted/50 p-1 sm:flex-wrap sm:justify-start">
            <TabsTrigger value="overview" className="shrink-0 px-3 text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="balances" className="shrink-0 px-3 text-xs sm:text-sm">
              Balances
            </TabsTrigger>
            <TabsTrigger value="expenses" className="shrink-0 px-3 text-xs sm:text-sm">
              Expenses
            </TabsTrigger>
            <TabsTrigger value="revenue" className="shrink-0 px-3 text-xs sm:text-sm">
              Revenue
            </TabsTrigger>
            <TabsTrigger value="profit-loss" className="shrink-0 px-3 text-xs sm:text-sm">
              P&amp;L
            </TabsTrigger>
            <TabsTrigger value="parties" className="shrink-0 px-3 text-xs sm:text-sm">
              Parties
            </TabsTrigger>
            <TabsTrigger value="daily" className="shrink-0 px-3 text-xs sm:text-sm">
              Daily
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingAnalytics ? (
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                <StatCard
                  label="Revenue"
                  value={formatCurrencyCompact(analytics.kpis.totalRevenue)}
                  accent="green"
                  valueAccent
                />
                <StatCard
                  label="Debit"
                  value={formatCurrencyCompact(analytics.kpis.totalExpenses)}
                  accent="red"
                  valueAccent
                />
                <StatCard
                  label="Net flow"
                  value={formatCurrencyCompact(analytics.kpis.netCashFlow)}
                  accent={analytics.kpis.netCashFlow >= 0 ? 'blue' : 'red'}
                  valueAccent
                  className="col-span-2 lg:col-span-1"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <StatCard
                  label="Pending approvals"
                  value={analytics.kpis.pendingApprovalsCount}
                  accent="amber"
                  valueAccent
                  className="border-l-amber-500"
                />
                <div className="text-muted-foreground flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-sm sm:px-3 sm:py-3">
                  <AlertCircle className="text-amber-500 size-5 shrink-0" />
                  <span>Approved ₹{formatCurrencyCompact(analytics.kpis.approvedAmount)} · Rejected ₹{formatCurrencyCompact(analytics.kpis.rejectedAmount)}</span>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top transactions</CardTitle>
                  <CardDescription>Largest amounts in period</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                    {analytics.topTransactions.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-col gap-1 bg-card px-2 py-2.5 active:scale-[0.99] sm:px-3 sm:py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{t.serialNumber}</span>
                          <Badge variant={t.transactionType === 'CREDIT' ? 'default' : 'destructive'} className="shrink-0">
                            {t.transactionType}
                          </Badge>
                        </div>
                        <p className="font-medium leading-tight">{t.partyName}</p>
                        <p className="text-muted-foreground text-xs line-clamp-2">{t.description || '—'}</p>
                        <p className="text-lg font-semibold">{formatCurrency(t.amount)}</p>
                        <p className="text-muted-foreground text-xs">
                          {format(new Date(t.transactionDate), 'dd MMM yyyy')} · {t.paymentModeName || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Serial</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Party</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.topTransactions.slice(0, 10).map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs">{t.serialNumber}</TableCell>
                            <TableCell>{format(new Date(t.transactionDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={t.transactionType === 'CREDIT' ? 'default' : 'destructive'}>
                                {t.transactionType}
                              </Badge>
                            </TableCell>
                            <TableCell>{t.partyName}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {analytics.pendingApprovals.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pending approvals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                      {analytics.pendingApprovals.slice(0, 8).map((t) => (
                        <div key={t.id} className="px-2 py-2.5 sm:px-3 sm:py-3">
                          <div className="flex justify-between gap-2">
                            <span className="font-mono text-xs">{t.serialNumber}</span>
                            <span className="font-semibold">{formatCurrency(t.amount)}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium">{t.partyName}</p>
                          <p className="text-muted-foreground text-xs">{t.createdByName}</p>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Serial</TableHead>
                            <TableHead>Party</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.pendingApprovals.slice(0, 10).map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono text-xs">{t.serialNumber}</TableCell>
                              <TableCell>{t.partyName}</TableCell>
                              <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{t.createdByName}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                No overview data for this period.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Balances */}
        <TabsContent value="balances" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingPaymentMode ? (
            <Skeleton className="h-40 w-full" />
          ) : paymentModeData ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <StatCard
                  label="Total credits"
                  value={formatCurrencyCompact(paymentModeData.totals.totalCredits || 0)}
                  accent="green"
                  valueAccent
                />
                <StatCard
                  label="Total debits"
                  value={formatCurrencyCompact(paymentModeData.totals.totalDebits || 0)}
                  accent="red"
                  valueAccent
                />
                <StatCard
                  label="Total balance"
                  value={formatCurrencyCompact(paymentModeData.totals.totalBalance || 0)}
                  accent="blue"
                  valueAccent
                />
              </div>
              <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                {paymentModeData.data.map((m) => (
                  <div key={m.id} className="space-y-2 px-2 py-3 active:scale-[0.99] sm:px-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{m.name}</p>
                      <Wallet className="text-muted-foreground size-4" />
                    </div>
                    <p className="text-lg font-semibold">{formatCurrency(m.currentBalance)}</p>
                    <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                      <span>Credits {formatCurrencyCompact(m.totalCredits)}</span>
                      <span>Debits {formatCurrencyCompact(m.totalDebits)}</span>
                      <span className="col-span-2">Net {formatCurrencyCompact(m.netChange)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mode</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Debits</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentModeData.data.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(m.currentBalance)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(m.totalCredits)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(m.totalDebits)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(m.netChange)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              {paymentModeData.data.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">No payment modes in this period.</p>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingExpenseReport ? (
            <Skeleton className="h-40 w-full" />
          ) : expenseReportData ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard
                  label="Total expenses"
                  value={formatCurrencyCompact(expenseReportData.totals.totalExpenses || 0)}
                  accent="red"
                  valueAccent
                />
                <StatCard
                  label="Entries"
                  value={expenseReportData.totals.entriesCount ?? 0}
                  accent="neutral"
                />
              </div>
              <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                {expenseReportData.data.map((h) => {
                  const pct =
                    expenseTotalForBars > 0
                      ? Math.round((h.totalExpenses / expenseTotalForBars) * 100)
                      : 0
                  return (
                    <button
                      key={h.headId}
                      type="button"
                      className="w-full cursor-pointer space-y-2 px-2 py-3 text-left active:bg-muted/50 sm:px-3"
                      onClick={() => openHeadEntriesDrawer(h.headId, h.headName)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight">{h.headName}</p>
                        {h.department ? (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {h.department}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(h.totalExpenses)}
                      </p>
                      <Progress value={pct} className="h-2" />
                      <p className="text-muted-foreground text-xs">{pct}% of period · {h.entriesCount} entries</p>
                    </button>
                  )
                })}
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Head</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-center">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseReportData.data.map((h) => (
                          <TableRow key={h.headId}>
                            <TableCell className="font-medium">{h.headName}</TableCell>
                            <TableCell>{h.department || '—'}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(h.totalExpenses)}</TableCell>
                            <TableCell className="text-center">{h.entriesCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          {!loadingExpenseReport && expenseReportData?.data.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">No expenses in this period.</p>
          )}
        </TabsContent>

        {/* Revenue */}
        <TabsContent value="revenue" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingRevenue ? (
            <Skeleton className="h-40 w-full" />
          ) : revenueData ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard
                  label="Total revenue"
                  value={formatCurrencyCompact(revenueData.totals.totalRevenue || 0)}
                  accent="green"
                  valueAccent
                />
                <StatCard label="Entries" value={revenueData.totals.entriesCount ?? 0} accent="neutral" />
              </div>
              <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                {revenueData.data.map((p) => (
                  <div
                    key={p.projectId}
                    className="flex items-center justify-between gap-2 px-2 py-3 sm:px-3"
                  >
                    <div>
                      <p className="font-medium">{p.projectName}</p>
                      <p className="text-muted-foreground text-xs">{p.entriesCount} entries</p>
                    </div>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {formatCurrencyCompact(p.totalRevenue)}
                    </p>
                  </div>
                ))}
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-center">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueData.data.map((p) => (
                          <TableRow key={p.projectId}>
                            <TableCell className="font-medium">{p.projectName}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(p.totalRevenue)}</TableCell>
                            <TableCell className="text-center">{p.entriesCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          {!loadingRevenue && revenueData?.data.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">No revenue in this period.</p>
          )}
        </TabsContent>

        {/* P&L */}
        <TabsContent value="profit-loss" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingProfitLoss ? (
            <Skeleton className="h-40 w-full" />
          ) : profitLossData ? (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <StatCard
                  label="Revenue"
                  value={formatCurrencyCompact(profitLossData.totals.totalRevenue || 0)}
                  accent="green"
                  valueAccent
                />
                <StatCard
                  label="Expenses"
                  value={formatCurrencyCompact(profitLossData.totals.totalExpenses || 0)}
                  accent="red"
                  valueAccent
                />
                <StatCard
                  label="Net P/L"
                  value={formatCurrencyCompact(profitLossData.totals.netProfitLoss || 0)}
                  accent={(profitLossData.totals.netProfitLoss || 0) >= 0 ? 'blue' : 'red'}
                  valueAccent
                />
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue by project</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                    {(profitLossData.revenueByProject ?? []).map((r) => (
                      <div key={r.projectId} className="flex justify-between gap-2 px-2 py-3 sm:px-3">
                        <span className="font-medium">{r.projectName}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrencyCompact(r.totalRevenue)}
                        </span>
                      </div>
                    ))}
                    {(profitLossData.revenueByProject ?? []).length === 0 && (
                      <p className="text-muted-foreground px-2 py-3 text-sm sm:px-3">No revenue in period.</p>
                    )}
                  </div>
                  <div className="hidden md:block overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-center">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(profitLossData.revenueByProject ?? []).map((r) => (
                          <TableRow key={r.projectId}>
                            <TableCell>{r.projectName}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(r.totalRevenue)}</TableCell>
                            <TableCell className="text-center">{r.entriesCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Expenses by head</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                    {(profitLossData.expensesByHead ?? []).map((e) => (
                      <div key={e.headId} className="px-2 py-3 sm:px-3">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{e.headName}</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {formatCurrencyCompact(e.totalExpenses)}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">{e.department ?? '—'}</p>
                      </div>
                    ))}
                    {(profitLossData.expensesByHead ?? []).length === 0 && (
                      <p className="text-muted-foreground px-2 py-3 text-sm sm:px-3">No expenses in period.</p>
                    )}
                  </div>
                  <div className="hidden md:block overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Head</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-center">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(profitLossData.expensesByHead ?? []).map((e) => (
                          <TableRow key={e.headId}>
                            <TableCell>{e.headName}</TableCell>
                            <TableCell>{e.department ?? '—'}</TableCell>
                            <TableCell className="text-right font-mono text-amber-700">{formatCurrency(e.totalExpenses)}</TableCell>
                            <TableCell className="text-center">{e.entriesCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Parties */}
        <TabsContent value="parties" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingPartyWise ? (
            <Skeleton className="h-40 w-full" />
          ) : partyWiseData ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatCard
                  label="Credits"
                  value={formatCurrencyCompact(partyWiseData.totals.totalCredits || 0)}
                  accent="green"
                  valueAccent
                />
                <StatCard
                  label="Debits"
                  value={formatCurrencyCompact(partyWiseData.totals.totalDebits || 0)}
                  accent="red"
                  valueAccent
                />
              </div>
              <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                {partyWiseData.data.map((p) => (
                  <div key={p.partyId} className="space-y-2 px-2 py-3 sm:px-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{p.partyName}</p>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {p.partyType}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        'text-lg font-semibold',
                        p.netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      Net {formatCurrency(p.netAmount)}
                    </p>
                    <div className="text-muted-foreground flex justify-between text-xs">
                      <span>In {formatCurrencyCompact(p.totalCredits)}</span>
                      <span>Out {formatCurrencyCompact(p.totalDebits)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Party</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Debits</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partyWiseData.data.map((p) => (
                          <TableRow key={p.partyId}>
                            <TableCell className="font-medium">{p.partyName}</TableCell>
                            <TableCell>{p.partyType}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(p.totalCredits)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(p.totalDebits)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(p.netAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          {!loadingPartyWise && partyWiseData?.data.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">No party data in this period.</p>
          )}
        </TabsContent>

        {/* Daily */}
        <TabsContent value="daily" className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">
          {loadingDayWise ? (
            <Skeleton className="h-40 w-full" />
          ) : dayWiseData ? (
            <>
              <div className="md:hidden divide-y divide-border rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                {dayWiseData.data.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    className="w-full cursor-pointer space-y-2 px-2 py-3 text-left active:bg-muted/50 sm:px-3"
                    onClick={() =>
                      openDayEntriesDrawer(
                        d.date,
                        format(new Date(d.date), 'EEE, dd MMM yyyy')
                      )
                    }
                  >
                    <p className="font-medium">{format(new Date(d.date), 'EEE, dd MMM yyyy')}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">+{formatCurrencyCompact(d.totalCredits)}</span>
                      <span className="text-red-600">−{formatCurrencyCompact(d.totalDebits)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.netChange >= 0 ? (
                        <TrendingUp className="size-4 text-green-600" />
                      ) : (
                        <TrendingDown className="size-4 text-red-600" />
                      )}
                      <span
                        className={cn(
                          'font-semibold',
                          d.netChange >= 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        Net {formatCurrency(Math.abs(d.netChange))}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{d.entriesCount} entries</p>
                  </button>
                ))}
              </div>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Debits</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead className="text-center">Entries</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayWiseData.data.map((d) => (
                          <TableRow key={d.date}>
                            <TableCell>{format(new Date(d.date), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(d.totalCredits)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(d.totalDebits)}</TableCell>
                            <TableCell className="text-right font-mono">
                              <span className="inline-flex items-center justify-end gap-1">
                                {d.netChange >= 0 ? (
                                  <ArrowUpCircle className="size-4 text-green-600" />
                                ) : (
                                  <ArrowDownCircle className="size-4 text-red-600" />
                                )}
                                {formatCurrency(Math.abs(d.netChange))}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{d.entriesCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
          {!loadingDayWise && dayWiseData?.data.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">No daily data in this period.</p>
          )}
        </TabsContent>
      </Tabs>

      <Drawer open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle className="line-clamp-2">{detailDrawerTitle}</DrawerTitle>
            <DrawerDescription>
              {detailDrawerType === 'day'
                ? 'All ledger lines on this day in the selected period.'
                : detailDrawerType === 'head'
                  ? 'Expense (debit) lines for this head in the selected period.'
                  : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {loadingDetailEntries ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : detailEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No entries found.</p>
            ) : (
              <div className="divide-y divide-border">
                {detailEntries.map((e) => (
                  <div key={e.id} className="space-y-1 py-3 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{e.serialNumber}</span>
                      <Badge
                        variant={e.transactionType === 'CREDIT' ? 'default' : 'destructive'}
                        className="shrink-0"
                      >
                        {e.transactionType}
                      </Badge>
                    </div>
                    <p className="font-medium leading-tight">{e.partyName || '—'}</p>
                    <p className="text-lg font-semibold tabular-nums">{formatCurrency(e.amount)}</p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(e.transactionDate), 'dd MMM yyyy, HH:mm')}
                      {e.paymentModeName ? ` · ${e.paymentModeName}` : ''}
                      {e.headName ? ` · ${e.headName}` : ''}
                    </p>
                    {e.description ? (
                      <p className="text-muted-foreground text-xs line-clamp-3">{e.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
