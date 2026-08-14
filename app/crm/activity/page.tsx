'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { apiGet } from '@/lib/api-client'

type ActivityLogRow = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  entityLabel: string | null
  summary: string
  actorRole: string | null
  route: string | null
  method: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: {
    deviceInfo?: {
      browser?: string | null
      operatingSystem?: string | null
      operatingSystemVersion?: string | null
      deviceType?: string | null
      label?: string | null
    } | null
  } | null
  errorMessage: string | null
  createdAt: string
  actorUser: {
    id: string
    name: string
    email: string
  } | null
}

type ActivityResponse = {
  logs: ActivityLogRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  filters: {
    entityTypes: string[]
    actions: string[]
  }
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { date: 'Unknown', time: '' }
  }

  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
  }
}

export default function CrmActivityPage() {
  const [entityType, setEntityType] = useState('all')
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('50')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (entityType !== 'all') params.set('entityType', entityType)
    if (action !== 'all') params.set('action', action)
    if (search.trim()) params.set('search', search.trim())
    params.set('page', String(page))
    params.set('pageSize', pageSize)
    return params.toString()
  }, [action, entityType, page, pageSize, search])

  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivityResponse, Error>({
    queryKey: ['crm-activity', queryString],
    queryFn: () => apiGet<ActivityResponse>(`/api/crm/activity?${queryString}`),
    retry: false,
  })

  const logs = data?.logs ?? []
  const pagination = data?.pagination
  const total = pagination?.total ?? 0
  const totalPages = pagination?.totalPages ?? 1
  const currentPage = pagination?.page ?? page
  const currentPageSize = pagination?.pageSize ?? Number(pageSize)
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * currentPageSize, total)

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Activity className="h-8 w-8" />
              Lead Activity Trail
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chronological lead audit for reassignments, remark updates, and QR usage.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Review lead-related actions across the CRM admin surfaces.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search summary, actor, entity..."
            />
            <Select
              value={entityType}
              onValueChange={(value) => {
                setEntityType(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                {(data?.filters.entityTypes ?? []).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(data?.filters.actions ?? []).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && !isLoading ? (
          <Card className="border-amber-300 bg-amber-50/70">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="space-y-1">
                <CardTitle>Unable to load lead activity</CardTitle>
                <CardDescription className="text-amber-900/80">
                  {error.message || 'We could not load the lead activity trail right now.'}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                {total > 0
                  ? `Showing ${rangeStart}-${rangeEnd} of ${total} lead-related CRM events.`
                  : 'Showing all matching lead-related CRM events.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border">
                <Table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[132px]" />
                    <col className="w-[44%]" />
                    <col className="w-[168px]" />
                    <col className="w-[280px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">When</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="whitespace-nowrap">Actor</TableHead>
                      <TableHead className="whitespace-nowrap">Entity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          Loading activity...
                        </TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          No lead activity found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="align-top whitespace-nowrap text-sm text-muted-foreground">
                            <div className="space-y-0.5">
                              <p>{formatDateTime(log.createdAt).date}</p>
                              <p>{formatDateTime(log.createdAt).time}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 overflow-hidden">
                              <p className="break-all font-medium whitespace-normal">{log.summary}</p>
                              {log.errorMessage ? <p className="text-xs text-destructive">{log.errorMessage}</p> : null}
                              {log.metadata?.deviceInfo?.label || log.ipAddress ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {log.metadata?.deviceInfo?.label ? (
                                    <span>Device: {log.metadata.deviceInfo.label}</span>
                                  ) : null}
                                  {log.ipAddress ? <span>IP: {log.ipAddress}</span> : null}
                                </div>
                              ) : null}
                              {log.userAgent ? (
                                <p className="break-all whitespace-normal text-xs text-muted-foreground">
                                  User-Agent: {log.userAgent}
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">{log.action}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 text-sm">
                              <p className="break-words">{log.actorUser?.name ?? 'System / Webhook'}</p>
                              <p className="text-xs text-muted-foreground">{log.actorRole ?? 'SYSTEM'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1 overflow-hidden text-sm">
                              <p className="break-all whitespace-normal">{log.entityLabel ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">{log.entityType}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {total > 0 ? `Showing ${rangeStart}-${rangeEnd} of ${total}` : 'No results'}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(currentPageSize)}
                    onValueChange={(value) => {
                      setPageSize(value)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size} / page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage >= totalPages || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}
