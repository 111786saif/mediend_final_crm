'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  QrCode,
  RefreshCw,
  PhoneCall,
  MousePointerClick,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'

type KpiEvent = {
  id: string
  action: string
  source: string | null
  phoneNumber: string
  createdAt: string
  lead: {
    id: string
    leadRef: string | null
    patientName: string | null
    campaignId: string | null
    campaignName: string | null
  }
  user: {
    id: string
    name: string
    email: string
  }
}

type CrmKpiResponse = {
  month: number
  year: number
  page: number
  pageSize: number
  totalEvents: number
  totalPages: number
  summary: {
    totalEvents: number
    qrViewed: number
    qrCallStarted: number
    callButtonInitiated: number
    uniqueLeads: number
    uniqueUsers: number
  }
  topCampaigns: Array<{
    campaign: string
    count: number
  }>
  events: KpiEvent[]
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

function getInitialMonthYear() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function actionBadge(action: string) {
  if (action === 'QR_VIEWED') {
    return <Badge className="bg-sky-600 text-white hover:bg-sky-600">QR Viewed</Badge>
  }
  if (action === 'QR_CALL_INITIATED') {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">QR Call</Badge>
  }
  return <Badge className="bg-violet-600 text-white hover:bg-violet-600">Call Button</Badge>
}

export default function CrmKpisPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const initialMonthYear = getInitialMonthYear()
  const [month, setMonth] = useState(String(initialMonthYear.month))
  const [year, setYear] = useState(String(initialMonthYear.year))
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)

  const hasAccess = String(user?.role) === 'SUPER_ADMIN' || String(user?.role) === 'CRM_ADMIN'

  const selectedMonth = Number.parseInt(month, 10) || initialMonthYear.month
  const selectedYear = Number.parseInt(year, 10) || initialMonthYear.year

  const { data, isLoading, error, refetch, isFetching } = useQuery<CrmKpiResponse, Error>({
    queryKey: ['crm-kpis', selectedMonth, selectedYear, currentPage, pageSize],
    queryFn: () =>
      apiGet<CrmKpiResponse>(
        `/api/crm/kpis?month=${selectedMonth}&year=${selectedYear}&page=${currentPage}&pageSize=${pageSize}`
      ),
    retry: false,
    placeholderData: (prev) => prev,
    enabled: hasAccess,
  })

  const handleMonthChange = (val: string) => {
    setMonth(val)
    setCurrentPage(1)
  }

  const handleYearChange = (val: string) => {
    setYear(val)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (val: string) => {
    const nextSize = Number.parseInt(val, 10) || 20
    setPageSize(nextSize)
    setCurrentPage(1)
  }

  const events = data?.events ?? []
  const totalEvents = data?.totalEvents ?? 0
  const totalPages = data?.totalPages ?? 1
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const rangeStart = totalEvents === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(safeCurrentPage * pageSize, totalEvents)

  const summaryCards = useMemo(
    () => [
      {
        title: 'QR views',
        value: data?.summary.qrViewed ?? 0,
        icon: QrCode,
      },
      {
        title: 'QR call starts',
        value: data?.summary.qrCallStarted ?? 0,
        icon: PhoneCall,
      },
      {
        title: 'Call button clicks',
        value: data?.summary.callButtonInitiated ?? 0,
        icon: MousePointerClick,
      },
      {
        title: 'Unique leads',
        value: data?.summary.uniqueLeads ?? 0,
        icon: BarChart3,
      },
    ],
    [data?.summary]
  )

  const errorMessage =
    error instanceof Error ? error.message : 'We could not load the CRM KPI feed right now.'

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CRM QR &amp; Call KPIs</h1>
            <p className="text-sm text-muted-foreground">
              Monitor monthly QR views, phone calls initiated from QR popovers, and direct call button usage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-36">
              <Label htmlFor="kpi-month" className="sr-only">
                Month
              </Label>
              <Select value={month} onValueChange={handleMonthChange}>
                <SelectTrigger id="kpi-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label htmlFor="kpi-year" className="sr-only">
                Year
              </Label>
              <Input
                id="kpi-year"
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              title="Refresh KPI data"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle className="text-base text-destructive">Failed to load CRM KPIs</CardTitle>
                <CardDescription className="text-destructive/80">{errorMessage}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {isLoading && !data ? '...' : formatWholeNumber(card.value)}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Top campaigns</CardTitle>
                  <CardDescription>Most QR interactions for the selected month.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(data?.topCampaigns ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No QR activity recorded yet.</p>
                  ) : (
                    data?.topCampaigns.map((item) => (
                      <div key={item.campaign} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.campaign}</p>
                        </div>
                        <Badge variant="secondary">{formatWholeNumber(item.count)}</Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent QR events</CardTitle>
                  <CardDescription>Latest lead QR and click-to-call actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Campaign</TableHead>
                          <TableHead>User</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading && !data ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              Loading KPI events...
                            </TableCell>
                          </TableRow>
                        ) : events.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              No QR usage recorded for the selected month.
                            </TableCell>
                          </TableRow>
                        ) : (
                          events.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {formatDateTime(event.createdAt)}
                              </TableCell>
                              <TableCell>{actionBadge(event.action)}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    {event.lead.leadRef ?? '—'}{event.lead.patientName ? ` · ${event.lead.patientName}` : ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{event.source ?? 'popover'}</p>
                                </div>
                              </TableCell>
                              <TableCell>{event.lead.campaignName ?? event.lead.campaignId ?? '—'}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p>{event.user.name}</p>
                                  <p className="text-xs text-muted-foreground">{event.user.email}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Server-Driven Pagination Controls */}
                  {totalEvents > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Rows per page:</span>
                        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                          <SelectTrigger className="h-8 w-[72px] text-xs">
                            <SelectValue placeholder={String(pageSize)} />
                          </SelectTrigger>
                          <SelectContent side="top">
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="ml-2">
                          Showing {rangeStart}–{rangeEnd} of {formatWholeNumber(totalEvents)} events
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground mr-2">
                          Page {safeCurrentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safeCurrentPage <= 1 || isFetching}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span className="sr-only">Previous page</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage >= totalPages || isFetching}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span className="sr-only">Next page</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
