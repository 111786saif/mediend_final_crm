'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, QrCode, RefreshCw, PhoneCall, MousePointerClick, AlertTriangle } from 'lucide-react'
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
  const hasAccess = String(user?.role) === 'SUPER_ADMIN' || String(user?.role) === 'CRM_ADMIN'

  const selectedMonth = Number.parseInt(month, 10) || initialMonthYear.month
  const selectedYear = Number.parseInt(year, 10) || initialMonthYear.year

  const { data, isLoading, error, refetch, isFetching } = useQuery<CrmKpiResponse, Error>({
    queryKey: ['crm-kpis', selectedMonth, selectedYear],
    queryFn: () => apiGet<CrmKpiResponse>(`/api/crm/kpis?month=${selectedMonth}&year=${selectedYear}`),
    retry: false,
    enabled: hasAccess,
  })

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
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <BarChart3 className="h-8 w-8 text-cyan-600" />
              CRM KPIs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              QR usage and call initiation metrics for CRM leads.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-[140px]"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching || !hasAccess}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {!isAuthLoading && !hasAccess ? (
          <Card>
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                This CRM KPI view is available to Super Admin and CRM Admin users.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : error && !isLoading ? (
          <Card className="border-amber-300 bg-amber-50/70">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <CardTitle>Unable to load CRM KPIs</CardTitle>
                <CardDescription className="text-amber-900/80">{errorMessage}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardDescription>{card.title}</CardDescription>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{formatWholeNumber(card.value)}</div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_2fr]">
              <Card>
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

              <Card>
                <CardHeader>
                  <CardTitle>Recent QR events</CardTitle>
                  <CardDescription>Latest lead QR and click-to-call actions.</CardDescription>
                </CardHeader>
                <CardContent>
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
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              Loading KPI events...
                            </TableCell>
                          </TableRow>
                        ) : (data?.events ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              No QR usage recorded for the selected month.
                            </TableCell>
                          </TableRow>
                        ) : (
                          data?.events.map((event) => (
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
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
