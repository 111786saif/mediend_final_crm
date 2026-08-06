'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react'
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
  filters: {
    entityTypes: string[]
    actions: string[]
  }
}

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

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (entityType !== 'all') params.set('entityType', entityType)
    if (action !== 'all') params.set('action', action)
    if (search.trim()) params.set('search', search.trim())
    params.set('limit', '100')
    return params.toString()
  }, [action, entityType, search])

  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivityResponse, Error>({
    queryKey: ['crm-activity', queryString],
    queryFn: () => apiGet<ActivityResponse>(`/api/crm/activity?${queryString}`),
    retry: false,
  })

  const logs = data?.logs ?? []

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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search summary, actor, entity..."
            />
            <Select value={entityType} onValueChange={setEntityType}>
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
            <Select value={action} onValueChange={setAction}>
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
              <CardDescription>Showing the latest 100 lead-related CRM events.</CardDescription>
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
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  )
}
