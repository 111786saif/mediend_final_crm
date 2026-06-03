'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { 
  Wallet, 
  Users, 
  FolderTree, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Download,
  BarChart3,
  ScrollText
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

interface HeadWiseSummary {
  headId: string
  headName: string
  department: string | null
  totalCredits: number
  totalExpenses: number
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

interface NonExpenseReportSummary {
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

interface ProfitLossSummary {
  totalRevenue: number
  totalExpenses: number
  profitLoss: number
}

interface ProfitLossRevenueRow {
  projectId: string
  projectName: string
  totalRevenue: number
  entriesCount: number
}

interface ProfitLossExpenseRow {
  headId: string
  headName: string
  department: string | null
  totalExpenses: number
  entriesCount: number
}

interface ProfitLossReportResponse {
  type: 'profit-loss'
  data: ProfitLossSummary[]
  revenueByProject: ProfitLossRevenueRow[]
  expensesByHead: ProfitLossExpenseRow[]
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('payment-mode')
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false)
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false)

  const dateParams = new URLSearchParams()
  if (startDate) dateParams.set('startDate', startDate.toISOString())
  if (endDate) dateParams.set('endDate', endDate.toISOString())

  const periodLabel = startDate && endDate
    ? `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`
    : 'All time'

  const handleDownloadPDF = () => {
    const reportTitle =
        { 'payment-mode': 'Payment Mode Balance Summary', 'party-wise': 'Party-wise Summary', 'head-wise': 'Head-wise Summary', 'expense-report': 'Expense Report', 'non-expense-report': 'Non-Expense Report', 'day-wise': 'Day-wise Summary', 'revenue': 'Revenue Report', 'profit-loss': 'Profit & Loss Report' }[
          activeTab as 'payment-mode' | 'party-wise' | 'head-wise' | 'expense-report' | 'non-expense-report' | 'day-wise' | 'revenue' | 'profit-loss'
        ] ?? 'Finance Report'

    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('Finance Reports', 14, 20)
    doc.setFontSize(12)
    doc.text(reportTitle, 14, 28)
    doc.text(`Period: ${periodLabel}`, 14, 36)
    const startY = 44

    if (activeTab === 'payment-mode' && paymentModeData) {
      autoTable(doc, {
        head: [['Payment Mode', 'Opening Balance', 'Total Credits', 'Total Debits', 'Net Change', 'Current Balance']],
        body: paymentModeData.data.map((m) => [
          m.name,
          formatCurrencyForPDF(m.openingBalance),
          formatCurrencyForPDF(m.totalCredits),
          formatCurrencyForPDF(m.totalDebits),
          formatCurrencyForPDF(m.netChange),
          formatCurrencyForPDF(m.currentBalance),
        ]),
        startY,
      })
    } else if (activeTab === 'party-wise' && partyWiseData) {
      autoTable(doc, {
        head: [['Party', 'Type', 'Total Credits', 'Total Debits', 'Net Amount', 'Entries']],
        body: partyWiseData.data.map((p) => [
          p.partyName,
          p.partyType,
          formatCurrencyForPDF(p.totalCredits),
          formatCurrencyForPDF(p.totalDebits),
          formatCurrencyForPDF(p.netAmount),
          String(p.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'head-wise' && headWiseData) {
      autoTable(doc, {
        head: [['Head', 'Department', 'Total Credits', 'Total Expenses', 'Net Amount', 'Entries']],
        body: headWiseData.data.map((h) => [
          h.headName,
          h.department || '-',
          formatCurrencyForPDF(h.totalCredits),
          formatCurrencyForPDF(h.totalExpenses),
          formatCurrencyForPDF(h.netAmount),
          String(h.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'expense-report' && expenseReportData) {
      autoTable(doc, {
        head: [['Head', 'Department', 'Total Expenses', 'Entries']],
        body: expenseReportData.data.map((h) => [
          h.headName,
          h.department || '-',
          formatCurrencyForPDF(h.totalExpenses),
          String(h.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'non-expense-report' && nonExpenseReportData) {
      autoTable(doc, {
        head: [['Head', 'Department', 'Total Component B', 'Entries']],
        body: nonExpenseReportData.data.map((h) => [
          h.headName,
          h.department || '-',
          formatCurrencyForPDF(h.totalExpenses),
          String(h.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'day-wise' && dayWiseData) {
      autoTable(doc, {
        head: [['Date', 'Total Credits', 'Total Debits', 'Net Change', 'Entries']],
        body: dayWiseData.data.map((d) => [
          format(new Date(d.date), 'dd MMM yyyy'),
          formatCurrencyForPDF(d.totalCredits),
          formatCurrencyForPDF(d.totalDebits),
          formatCurrencyForPDF(d.netChange),
          String(d.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'revenue' && revenueData) {
      autoTable(doc, {
        head: [['Project', 'Total Revenue', 'Entries']],
        body: revenueData.data.map((p) => [
          p.projectName,
          formatCurrencyForPDF(p.totalRevenue),
          String(p.entriesCount),
        ]),
        startY,
      })
    } else if (activeTab === 'profit-loss' && profitLossData) {
      let y = startY
      // Revenue by Project table
      doc.setFontSize(11)
      doc.setTextColor(0, 100, 0)
      doc.text('Revenue by Project', 14, y)
      y += 6
      const revenueBody = (profitLossData.revenueByProject ?? []).length === 0
        ? [['No revenue in period', '', '']]
        : profitLossData.revenueByProject.map((r) => [r.projectName, formatCurrencyForPDF(r.totalRevenue), String(r.entriesCount)])
      autoTable(doc, {
        head: [['Project', 'Total Revenue', 'Entries']],
        body: revenueBody,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [220, 245, 220], textColor: [0, 80, 0] },
      })
      y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
      y += 10
      // Expenses by Head table
      doc.setTextColor(180, 100, 0)
      doc.text('Expenses by Head', 14, y)
      y += 6
      const expenseBody = (profitLossData.expensesByHead ?? []).length === 0
        ? [['No expenses in period', '', '', '']]
        : profitLossData.expensesByHead.map((e) => [e.headName, e.department ?? '—', formatCurrencyForPDF(e.totalExpenses), String(e.entriesCount)])
      autoTable(doc, {
        head: [['Head', 'Department', 'Total Expenses', 'Entries']],
        body: expenseBody,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [255, 243, 224], textColor: [140, 80, 0] },
      })
      y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
      y += 10
      // Summary totals
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Total Revenue:', 14, y)
      doc.setFont('helvetica', 'normal')
      doc.text(formatCurrencyForPDF(profitLossData.totals.totalRevenue || 0), 80, y)
      y += 7
      doc.setFont('helvetica', 'bold')
      doc.text('Total Expenses:', 14, y)
      doc.setFont('helvetica', 'normal')
      doc.text(formatCurrencyForPDF(profitLossData.totals.totalExpenses || 0), 80, y)
      y += 7
      doc.setFont('helvetica', 'bold')
      doc.text('Net P/L:', 14, y)
      doc.setFont('helvetica', 'normal')
      const net = profitLossData.totals.netProfitLoss ?? 0
      doc.setTextColor(net >= 0 ? 0 : 255, 0, 0)
      doc.text(formatCurrencyForPDF(net), 80, y)
      doc.setTextColor(0, 0, 0)
    }
    doc.save(`finance-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  // Fetch payment mode summary
  const { data: paymentModeData, isLoading: loadingPaymentMode } = useQuery<ReportResponse<PaymentModeSummary>>({
    queryKey: ['report-payment-mode', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<PaymentModeSummary>>(`/api/finance/reports/summary?type=payment-mode&${dateParams.toString()}`),
    enabled: activeTab === 'payment-mode',
  })

  // Fetch party-wise summary
  const { data: partyWiseData, isLoading: loadingPartyWise } = useQuery<ReportResponse<PartyWiseSummary>>({
    queryKey: ['report-party-wise', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<PartyWiseSummary>>(`/api/finance/reports/summary?type=party-wise&${dateParams.toString()}`),
    enabled: activeTab === 'party-wise',
  })

  // Fetch head-wise summary
  const { data: headWiseData, isLoading: loadingHeadWise } = useQuery<ReportResponse<HeadWiseSummary>>({
    queryKey: ['report-head-wise', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<HeadWiseSummary>>(`/api/finance/reports/summary?type=head-wise&${dateParams.toString()}`),
    enabled: activeTab === 'head-wise',
  })

  // Fetch expense report summary
  const { data: expenseReportData, isLoading: loadingExpenseReport } = useQuery<ReportResponse<ExpenseReportSummary>>({
    queryKey: ['report-expense-report', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<ExpenseReportSummary>>(`/api/finance/reports/summary?type=expense-report&${dateParams.toString()}`),
    enabled: activeTab === 'expense-report',
  })

  // Fetch non-expense report summary
  const { data: nonExpenseReportData, isLoading: loadingNonExpenseReport } = useQuery<ReportResponse<NonExpenseReportSummary>>({
    queryKey: ['report-non-expense-report', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<NonExpenseReportSummary>>(`/api/finance/reports/summary?type=non-expense-report&${dateParams.toString()}`),
    enabled: activeTab === 'non-expense-report',
  })

  // Fetch day-wise summary
  const { data: dayWiseData, isLoading: loadingDayWise } = useQuery<ReportResponse<DayWiseSummary>>({
    queryKey: ['report-day-wise', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<DayWiseSummary>>(`/api/finance/reports/summary?type=day-wise&${dateParams.toString()}`),
    enabled: activeTab === 'day-wise',
  })

  // Fetch revenue summary
  const { data: revenueData, isLoading: loadingRevenue } = useQuery<ReportResponse<RevenueSummary>>({
    queryKey: ['report-revenue', startDate, endDate],
    queryFn: () => apiGet<ReportResponse<RevenueSummary>>(`/api/finance/reports/summary?type=revenue&${dateParams.toString()}`),
    enabled: activeTab === 'revenue',
  })

  // Fetch profit-loss summary
  const { data: profitLossData, isLoading: loadingProfitLoss } = useQuery<ProfitLossReportResponse>({
    queryKey: ['report-profit-loss', startDate, endDate],
    queryFn: () => apiGet<ProfitLossReportResponse>(`/api/finance/reports/summary?type=profit-loss&${dateParams.toString()}`),
    enabled: activeTab === 'profit-loss',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance Reports</h1>
        <p className="text-muted-foreground mt-1">View summaries and analytics</p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Filter reports by date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">From:</span>
              <Dialog open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PP') : 'Pick date'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date)
                      setIsStartCalendarOpen(false)
                    }}
                    initialFocus
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">To:</span>
              <Dialog open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PP') : 'Pick date'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date)
                      setIsEndCalendarOpen(false)
                    }}
                    initialFocus
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date()
                  setStartDate(startOfMonth(now))
                  setEndDate(endOfMonth(now))
                }}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastMonth = subMonths(new Date(), 1)
                  setStartDate(startOfMonth(lastMonth))
                  setEndDate(endOfMonth(lastMonth))
                }}
              >
                Last Month
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setStartDate(subDays(new Date(), 30))
                setEndDate(new Date())
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStartDate(subDays(new Date(), 7))
                setEndDate(new Date())
              }}
            >
              Last 7 Days
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="payment-mode" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payment Mode
          </TabsTrigger>
          <TabsTrigger value="party-wise" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Party-wise
          </TabsTrigger>
          <TabsTrigger value="head-wise" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Head-wise
          </TabsTrigger>
          <TabsTrigger value="expense-report" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            Expense Report
          </TabsTrigger>
          <TabsTrigger value="non-expense-report" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Non-Expense
          </TabsTrigger>
          <TabsTrigger value="day-wise" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Day-wise
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            P/L
          </TabsTrigger>
        </TabsList>

        {/* Payment Mode Summary */}
        <TabsContent value="payment-mode">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Mode Balance Summary</CardTitle>
                  <CardDescription>Current balances across all payment modes</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingPaymentMode || !paymentModeData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Totals */}
              {paymentModeData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-green-50 dark:bg-green-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">Total Credits</p>
                          <p className="text-2xl font-bold">{formatCurrency(paymentModeData.totals.totalCredits || 0)}</p>
                        </div>
                        <ArrowUpCircle className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 dark:bg-red-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600">Total Debits</p>
                          <p className="text-2xl font-bold">{formatCurrency(paymentModeData.totals.totalDebits || 0)}</p>
                        </div>
                        <ArrowDownCircle className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Total Balance</p>
                          <p className="text-2xl font-bold">{formatCurrency(paymentModeData.totals.totalBalance || 0)}</p>
                        </div>
                        <Wallet className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingPaymentMode ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="text-right">Total Credits</TableHead>
                      <TableHead className="text-right">Total Debits</TableHead>
                      <TableHead className="text-right">Net Change</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentModeData?.data.map((mode) => (
                      <TableRow key={mode.id}>
                        <TableCell className="font-medium">{mode.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(mode.openingBalance)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(mode.totalCredits)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(mode.totalDebits)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={`flex items-center justify-end gap-1 ${mode.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {mode.netChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {formatCurrency(Math.abs(mode.netChange))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(mode.currentBalance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Party-wise Summary */}
        <TabsContent value="party-wise">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Party-wise Summary</CardTitle>
                  <CardDescription>Transaction totals by party</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingPartyWise || !partyWiseData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPartyWise ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Party</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total Credits</TableHead>
                      <TableHead className="text-right">Total Debits</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partyWiseData?.data.map((party) => (
                      <TableRow key={party.partyId}>
                        <TableCell className="font-medium">{party.partyName}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{party.partyType}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(party.totalCredits)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(party.totalDebits)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={party.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(party.netAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{party.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!partyWiseData?.data || partyWiseData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Head-wise Summary */}
        <TabsContent value="head-wise">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Head-wise Summary</CardTitle>
                  <CardDescription>Transaction totals by head/category</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingHeadWise || !headWiseData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Totals for head-wise */}
              {headWiseData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-green-50 dark:bg-green-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">Total Credits</p>
                          <p className="text-2xl font-bold">{formatCurrency(headWiseData.totals.totalCredits || 0)}</p>
                        </div>
                        <ArrowUpCircle className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 dark:bg-red-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600">Expenses</p>
                          <p className="text-2xl font-bold">{formatCurrency(headWiseData.totals.totalExpenses || 0)}</p>
                        </div>
                        <ArrowDownCircle className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Net Amount</p>
                          <p className="text-2xl font-bold">
                            {formatCurrency((headWiseData.totals.totalCredits || 0) - (headWiseData.totals.totalExpenses || 0))}
                          </p>
                        </div>
                        <FolderTree className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingHeadWise ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Head</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Total Credits</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net Amount</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headWiseData?.data.map((head) => (
                      <TableRow key={head.headId}>
                        <TableCell className="font-medium">{head.headName}</TableCell>
                        <TableCell>{head.department || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(head.totalCredits)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(head.totalExpenses)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={head.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(head.netAmount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{head.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!headWiseData?.data || headWiseData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Report */}
        <TabsContent value="expense-report">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Expense Report</CardTitle>
                  <CardDescription>Expenses (Component A) by head/category - No credits</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingExpenseReport || !expenseReportData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Totals for expense report */}
              {expenseReportData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="bg-red-50 dark:bg-red-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600">Total Expenses</p>
                          <p className="text-2xl font-bold">{formatCurrency(expenseReportData.totals.totalExpenses || 0)}</p>
                        </div>
                        <ArrowDownCircle className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Total Entries</p>
                          <p className="text-2xl font-bold">{expenseReportData.totals.entriesCount || 0}</p>
                        </div>
                        <FolderTree className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingExpenseReport ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Head</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Total Expenses</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseReportData?.data.map((head) => (
                      <TableRow key={head.headId}>
                        <TableCell className="font-medium">{head.headName}</TableCell>
                        <TableCell>{head.department || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(head.totalExpenses)}</TableCell>
                        <TableCell className="text-center">{head.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!expenseReportData?.data || expenseReportData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No expense data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Non-Expense Report */}
        <TabsContent value="non-expense-report">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Non-Expense Report</CardTitle>
                  <CardDescription>Claimable amounts (Component B) by head/category - No main expenses</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingNonExpenseReport || !nonExpenseReportData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {nonExpenseReportData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="bg-amber-50 dark:bg-amber-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-amber-600">Total Component B</p>
                          <p className="text-2xl font-bold">{formatCurrency(nonExpenseReportData.totals.totalExpenses || 0)}</p>
                        </div>
                        <ScrollText className="h-8 w-8 text-amber-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Total Entries</p>
                          <p className="text-2xl font-bold">{nonExpenseReportData.totals.entriesCount || 0}</p>
                        </div>
                        <FolderTree className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingNonExpenseReport ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Head</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Total Component B</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonExpenseReportData?.data.map((head) => (
                      <TableRow key={head.headId}>
                        <TableCell className="font-medium">{head.headName}</TableCell>
                        <TableCell>{head.department || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-amber-600">{formatCurrency(head.totalExpenses)}</TableCell>
                        <TableCell className="text-center">{head.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!nonExpenseReportData?.data || nonExpenseReportData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No non-expense data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Day-wise Summary */}
        <TabsContent value="day-wise">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Day-wise Summary</CardTitle>
                  <CardDescription>Daily transaction totals</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingDayWise || !dayWiseData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDayWise ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Credits</TableHead>
                      <TableHead className="text-right">Total Debits</TableHead>
                      <TableHead className="text-right">Net Change</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayWiseData?.data.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-medium">
                          {format(new Date(day.date), 'EEE, dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(day.totalCredits)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(day.totalDebits)}</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={`flex items-center justify-end gap-1 ${day.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {day.netChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {formatCurrency(Math.abs(day.netChange))}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{day.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!dayWiseData?.data || dayWiseData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Report */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue Report</CardTitle>
                  <CardDescription>Booked sales/revenue by project</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingRevenue || !revenueData?.data?.length}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Totals for revenue report */}
              {revenueData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="bg-green-50 dark:bg-green-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">Total Revenue</p>
                          <p className="text-2xl font-bold">{formatCurrency(revenueData.totals.totalRevenue || 0)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-600">Total Entries</p>
                          <p className="text-2xl font-bold">{revenueData.totals.entriesCount || 0}</p>
                        </div>
                        <FolderTree className="h-8 w-8 text-blue-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingRevenue ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueData?.data.map((project) => (
                      <TableRow key={project.projectId}>
                        <TableCell className="font-medium">{project.projectName}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(project.totalRevenue)}</TableCell>
                        <TableCell className="text-center">{project.entriesCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!revenueData?.data || revenueData.data.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No revenue data available for selected period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit & Loss Report */}
        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profit & Loss Report</CardTitle>
                  <CardDescription>Total Revenue (by Project) minus Total Expenses (by Head)</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={loadingProfitLoss || !profitLossData}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Totals for P/L report */}
              {profitLossData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-green-50 dark:bg-green-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-600">Total Revenue</p>
                          <p className="text-2xl font-bold">{formatCurrency(profitLossData.totals.totalRevenue || 0)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 dark:bg-red-900/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-red-600">Total Expenses</p>
                          <p className="text-2xl font-bold">{formatCurrency(profitLossData.totals.totalExpenses || 0)}</p>
                        </div>
                        <ArrowDownCircle className="h-8 w-8 text-red-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className={`${(profitLossData.totals.netProfitLoss || 0) >= 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm ${(profitLossData.totals.netProfitLoss || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Net P/L</p>
                          <p className={`text-2xl font-bold ${(profitLossData.totals.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(profitLossData.totals.netProfitLoss || 0)}
                          </p>
                        </div>
                        {(profitLossData.totals.netProfitLoss || 0) >= 0 ? (
                          <TrendingUp className="h-8 w-8 text-green-400" />
                        ) : (
                          <TrendingDown className="h-8 w-8 text-red-400" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {loadingProfitLoss ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : profitLossData ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Revenue by Project</h4>
                    <div className="rounded-lg border border-green-200 dark:border-green-800/60 overflow-hidden overflow-x-auto bg-green-50/30 dark:bg-green-950/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-green-200 dark:border-green-800/60 hover:bg-transparent">
                            <TableHead className="bg-green-100/80 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-medium">Project</TableHead>
                            <TableHead className="bg-green-100/80 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-medium text-right">Total Revenue</TableHead>
                            <TableHead className="bg-green-100/80 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-medium text-right">Entries</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(profitLossData.revenueByProject ?? []).length === 0 ? (
                            <TableRow className="border-green-200/50 dark:border-green-800/40">
                              <TableCell colSpan={3} className="text-center text-muted-foreground">No revenue in period</TableCell>
                            </TableRow>
                          ) : (
                            (profitLossData.revenueByProject ?? []).map((row, i) => (
                              <TableRow
                                key={row.projectId}
                                className={`border-green-200/50 dark:border-green-800/40 ${i % 2 === 0 ? 'bg-white/60 dark:bg-green-950/10' : 'bg-green-50/50 dark:bg-green-900/10'} hover:bg-green-100/50 dark:hover:bg-green-800/20`}
                              >
                                <TableCell className="font-medium">{row.projectName}</TableCell>
                                <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(row.totalRevenue)}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{row.entriesCount}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Expenses by Head</h4>
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 overflow-hidden overflow-x-auto bg-amber-50/30 dark:bg-amber-950/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-amber-200 dark:border-amber-800/60 hover:bg-transparent">
                            <TableHead className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium">Head</TableHead>
                            <TableHead className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium">Department</TableHead>
                            <TableHead className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium text-right">Total Expenses</TableHead>
                            <TableHead className="bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium text-right">Entries</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(profitLossData.expensesByHead ?? []).length === 0 ? (
                            <TableRow className="border-amber-200/50 dark:border-amber-800/40">
                              <TableCell colSpan={4} className="text-center text-muted-foreground">No expenses in period</TableCell>
                            </TableRow>
                          ) : (
                            (profitLossData.expensesByHead ?? []).map((row, i) => (
                              <TableRow
                                key={row.headId}
                                className={`border-amber-200/50 dark:border-amber-800/40 ${i % 2 === 0 ? 'bg-white/60 dark:bg-amber-950/10' : 'bg-amber-50/50 dark:bg-amber-900/10'} hover:bg-amber-100/50 dark:hover:bg-amber-800/20`}
                              >
                                <TableCell className="font-medium">{row.headName}</TableCell>
                                <TableCell className="text-muted-foreground">{row.department ?? '—'}</TableCell>
                                <TableCell className="text-right font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(row.totalExpenses)}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{row.entriesCount}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

