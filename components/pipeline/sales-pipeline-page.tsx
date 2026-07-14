'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CallNotesPopover } from '@/components/pipeline/call-notes-popover'
import {
  CampaignSidebar,
  type SidebarGroupMode,
} from '@/components/pipeline/campaign-sidebar'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { LeadAgeBadge } from '@/components/pipeline/lead-age-badge'
import { PipelineStatusCards } from '@/components/pipeline/pipeline-status-cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { ColumnFilter } from '@/components/ui/column-filter'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { usePipelinePage, usePipelineUrlState } from '@/hooks/use-pipeline'
import type { Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { formatLeadAgeSex, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { getStatusColor } from '@/lib/lead-status-colors'
import { getLeadReceiptDate, normalizeLeadStatus, type LeadAgeFilter } from '@/lib/pipeline-lead-buckets'
import type { PipelineSortDir, PipelineSortField } from '@/lib/pipeline/server-query'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState, memo } from 'react'
import { cn } from '@/lib/utils'

interface Target {
  id: string
  targetType: 'BD' | 'TEAM'
  targetForId: string
  periodType: 'WEEK' | 'MONTH'
  periodStartDate: string
  periodEndDate: string
  metric: 'LEADS_CLOSED' | 'NET_PROFIT' | 'BILL_AMOUNT' | 'SURGERIES_DONE'
  targetValue: number
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

async function fetchNoteCountsForLeads(leadIds: string[]): Promise<Record<string, number>> {
  if (leadIds.length === 0) return {}
  const chunk = 200
  const out: Record<string, number> = {}
  for (let i = 0; i < leadIds.length; i += chunk) {
    const slice = leadIds.slice(i, i + chunk)
    const part = await apiGet<Record<string, number>>(
      `/api/call-notes/counts?leadIds=${encodeURIComponent(slice.join(','))}`
    )
    Object.assign(out, part)
  }
  return out
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function normalizedText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return (trimmed || fallback).replace(/\s+/g, ' ')
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export function SalesPipelinePage({ variant }: { variant: 'bd' | 'team-lead' }) {
  return (
    <Suspense fallback={<PipelinePageFallback variant={variant} />}>
      <SalesPipelinePageInner variant={variant} />
    </Suspense>
  )
}

function PipelinePageFallback({ variant }: { variant: 'bd' | 'team-lead' }) {
  const title = variant === 'bd' ? 'Pipeline' : 'Team pipeline'
  return (
    <AuthenticatedLayout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#F2F2F7] dark:bg-background">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md dark:bg-background/90 md:px-6">
          <h1 className="text-lg font-bold tracking-tight md:text-xl">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PipelineStatusCards selected="all" onSelect={() => {}} isLoading />
        </main>
      </div>
    </AuthenticatedLayout>
  )
}

function SalesPipelinePageInner({ variant }: { variant: 'bd' | 'team-lead' }) {
  const { user } = useAuth()

  const { state, setState, campaignSelection, setCampaignSelection } = usePipelineUrlState()
  const { data, isLoading, isFetching } = usePipelinePage()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchInput, setSearchInput] = useState(state.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  // Column header filters (dropdown-in-header) — client-side, applied on top of
  // whatever page of data the server already returned/filtered/sorted.
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const handleColumnFilterChange = useCallback((key: string, selected: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: selected }))
  }, [])
  const activeColumnFilterCount = useMemo(
    () => Object.values(columnFilters).filter((v) => v && v.length > 0).length,
    [columnFilters]
  )
  const clearColumnFilters = useCallback(() => setColumnFilters({}), [])

  useEffect(() => {
    setSearchInput(state.q)
  }, [state.q])

  useEffect(() => {
    if (debouncedSearch !== state.q) {
      setState({ q: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const handleGroupByChange = useCallback(
    (mode: SidebarGroupMode) => {
      setState({ groupBy: mode, campaign: '', groupValue: '' })
    },
    [setState]
  )

  const handleSort = useCallback(
    (field: PipelineSortField) => {
      const nextDir: PipelineSortDir =
        state.sort === field ? (state.dir === 'asc' ? 'desc' : 'asc') : field === 'date' ? 'desc' : 'asc'
      setState({ sort: field, dir: nextDir })
    },
    [state.sort, state.dir, setState]
  )

  const { data: targets } = useQuery<Target[]>({
    queryKey: ['targets', 'BD', user?.id],
    queryFn: () => apiGet<Target[]>(`/api/targets?targetType=BD&targetForId=${user?.id}`),
    enabled: variant === 'bd' && !!user?.id,
  })

  const targetProgress = useMemo(() => {
    if (variant !== 'bd' || !targets?.length || !data) return null
    const now = new Date()
    const activeTarget = targets
      .filter((t) => {
        const start = new Date(t.periodStartDate)
        const end = new Date(t.periodEndDate)
        return now >= start && now <= end
      })
      .sort((a, b) => new Date(b.periodStartDate).getTime() - new Date(a.periodStartDate).getTime())[0]
    if (!activeTarget) return null

    if (activeTarget.metric === 'LEADS_CLOSED') {
      const actual = (data.statusCounts.closed ?? 0) + (data.statusCounts.ipd_done ?? 0)
      const pct = activeTarget.targetValue > 0 ? Math.min(100, (actual / activeTarget.targetValue) * 100) : 0
      return { target: activeTarget, actual, pct, showActual: true as const }
    }
    return { target: activeTarget, actual: null, pct: null, showActual: false as const }
  }, [variant, targets, data])

  // Raw rows for the current server page, before client-side column filters.
  const rawPageLeads: Lead[] = useMemo(() => data?.leads ?? [], [data?.leads])

  // Column filter dropdown option lists — built from the current page only.
  const leadRefOptions = useMemo(() => uniqueSorted(rawPageLeads.map((l) => String(l.leadRef ?? ''))), [rawPageLeads])
  const patientOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => (typeof l.patientName === 'string' ? l.patientName : ''))),
    [rawPageLeads]
  )
  const treatmentOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => (typeof l.treatment === 'string' ? l.treatment : ''))),
    [rawPageLeads]
  )
  const statusOptions = useMemo(() => uniqueSorted(rawPageLeads.map((l) => normalizeLeadStatus(l.status))), [rawPageLeads])
  const stageOptions = useMemo(
    () =>
      uniqueSorted(
        rawPageLeads.map((l) => (l.caseStage ? getCaseStageBadgeConfig(String(l.caseStage))?.label ?? '' : ''))
      ),
    [rawPageLeads]
  )
  const categoryColOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => (typeof l.category === 'string' ? l.category : ''))),
    [rawPageLeads]
  )
  // Team-lead only columns
  const ageSexOptions = useMemo(() => uniqueSorted(rawPageLeads.map((l) => formatLeadAgeSex(l))), [rawPageLeads])
  const circleColOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => normalizedText(l.circle, 'Unknown'))),
    [rawPageLeads]
  )
  const bdmOptions = useMemo(() => uniqueSorted(rawPageLeads.map((l) => l.plRecord?.bdmName ?? '')), [rawPageLeads])
  const hospitalOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => resolveLeadHospitalDoctor(l).hospital ?? '')),
    [rawPageLeads]
  )
  const doctorOptions = useMemo(
    () => uniqueSorted(rawPageLeads.map((l) => resolveLeadHospitalDoctor(l).doctor ?? '')),
    [rawPageLeads]
  )
  const bdNameOptions = useMemo(() => uniqueSorted(rawPageLeads.map((l) => l.bd?.name ?? '')), [rawPageLeads])

  // Apply column filters on top of the current page's rows.
  const tableRows: Lead[] = useMemo(() => {
    let result = rawPageLeads
    const cf = columnFilters

    if (cf.leadRef?.length) result = result.filter((l) => cf.leadRef.includes(String(l.leadRef ?? '')))
    if (cf.patient?.length)
      result = result.filter((l) => cf.patient.includes(typeof l.patientName === 'string' ? l.patientName : ''))
    if (cf.treatment?.length)
      result = result.filter((l) => cf.treatment.includes(typeof l.treatment === 'string' ? l.treatment : ''))
    if (cf.category?.length)
      result = result.filter((l) => cf.category.includes(typeof l.category === 'string' ? l.category : ''))
    if (cf.status?.length) result = result.filter((l) => cf.status.includes(normalizeLeadStatus(l.status)))
    if (cf.stage?.length) {
      result = result.filter((l) =>
        cf.stage.includes(l.caseStage ? getCaseStageBadgeConfig(String(l.caseStage))?.label ?? '' : '')
      )
    }
    if (variant === 'team-lead') {
      if (cf.ageSex?.length) result = result.filter((l) => cf.ageSex.includes(formatLeadAgeSex(l)))
      if (cf.circle?.length) result = result.filter((l) => cf.circle.includes(normalizedText(l.circle, 'Unknown')))
      if (cf.bdm?.length) result = result.filter((l) => cf.bdm.includes(l.plRecord?.bdmName ?? ''))
      if (cf.hospital?.length)
        result = result.filter((l) => cf.hospital.includes(resolveLeadHospitalDoctor(l).hospital ?? ''))
      if (cf.doctor?.length) result = result.filter((l) => cf.doctor.includes(resolveLeadHospitalDoctor(l).doctor ?? ''))
      if (cf.bd?.length) result = result.filter((l) => cf.bd.includes(l.bd?.name ?? ''))
    }

    return result
  }, [rawPageLeads, columnFilters, variant])

  const noteCountKey = useMemo(() => [...tableRows.map((l) => l.id)].sort().join(','), [tableRows])

  const { data: noteCounts = {} } = useQuery({
    queryKey: ['call-note-counts', noteCountKey],
    queryFn: () => fetchNoteCountsForLeads(tableRows.map((l) => l.id)),
    enabled: tableRows.length > 0 && !!user?.id,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const handleRowClick = useCallback((id: string) => {
    window.open(`/patient/${id}`, '_blank', 'noopener,noreferrer')
  }, [])

  const title = variant === 'bd' ? 'Pipeline' : 'Team pipeline'
  const subtitle =
    variant === 'bd' ? 'Campaigns, status breakdown, and all your leads' : 'Your team\u2019s leads by campaign and status'

  const colCount = variant === 'team-lead' ? 16 : 9

  const total = data?.total ?? 0
  const page = data?.page ?? state.page
  const pageSize = data?.pageSize ?? state.pageSize
  const totalPages = data?.totalPages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)
  const isBackgroundRefetching = isFetching && !isLoading

  const startDate = state.from ? new Date(state.from) : undefined
  const endDate = state.to ? new Date(state.to) : undefined

  return (
    <AuthenticatedLayout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#F2F2F7] dark:bg-background">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md dark:bg-background/90 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight md:text-xl">{title}</h1>
              <p className="text-xs text-muted-foreground md:text-sm">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-right">
              <div>
                <p className="text-xl font-bold text-primary tabular-nums">{data ? total : '—'}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total leads</p>
              </div>
              {variant === 'bd' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/bd/kyp">Case tracker</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <CampaignSidebar
            tree={data?.campaignTree ?? []}
            totalLeads={data?.facetTotal ?? 0}
            groupBy={state.groupBy}
            onGroupByChange={handleGroupByChange}
            selection={campaignSelection}
            onSelect={setCampaignSelection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            isLoading={isLoading && !data}
          />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {targetProgress && (
              <Card className="mb-4 border-border/80 p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Target progress</p>
                    <p className="text-xs text-muted-foreground">
                      {targetProgress.target.metric.replace(/_/g, ' ')} &middot; period active
                    </p>
                  </div>
                  <div className="w-full max-w-md space-y-1">
                    {targetProgress.showActual ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span>Actual: {targetProgress.actual}</span>
                          <span>Goal: {targetProgress.target.targetValue}</span>
                        </div>
                        <Progress value={targetProgress.pct ?? 0} className="h-2" />
                      </>
                    ) : (
                      <div className="flex justify-end text-xs">
                        <span>Goal: {targetProgress.target.targetValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {campaignSelection.type === 'campaign' && (
              <Card className="mb-4 border-border/80 p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {campaignSelection.groupValue}
                    </p>
                    <h2 className="text-lg font-bold tracking-tight">{campaignSelection.campaignLabel}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {data?.facetTotal ?? 0} in campaign
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {campaignSelection.groupBy}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-primary">{data?.facetTotal ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                </div>
              </Card>
            )}

            <div className="mb-4">
              <PipelineStatusCards
                counts={data?.statusCounts}
                total={data?.facetTotal}
                selected={state.status}
                onSelect={(b) => setState({ status: b })}
                isLoading={isLoading}
              />
            </div>

            <Card className="border-border/80 p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, ref, hospital… — or full mobile (10 digits or 91…)"
                    className="pl-9"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
                {variant === 'team-lead' && (data?.facets.bds.length ?? 0) > 0 && (
                  <Select value={state.bdId} onValueChange={(v) => setState({ bdId: v })}>
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="BD" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All BDs</SelectItem>
                      {data?.facets.bds.map(({ id, name }) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={state.age} onValueChange={(v) => setState({ age: v as LeadAgeFilter })}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Lead age" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ages</SelectItem>
                    <SelectItem value="new">New (&lt; 1 week)</SelectItem>
                    <SelectItem value="lt1m">&lt; 1 month</SelectItem>
                    <SelectItem value="1to2m">1–2 months</SelectItem>
                    <SelectItem value="2to3m">2–3 months</SelectItem>
                    <SelectItem value="3plus">3+ months</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={state.category} onValueChange={(v) => setState({ category: v })}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {data?.facets.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={state.circle} onValueChange={(v) => setState({ circle: v })}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Circle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All circles</SelectItem>
                    {data?.facets.circles.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal lg:w-[140px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => setState({ from: d ? format(d, 'yyyy-MM-dd') : '' })}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal lg:w-[140px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM d') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => setState({ to: d ? format(d, 'yyyy-MM-dd') : '' })}
                    />
                  </PopoverContent>
                </Popover>
                {(state.from || state.to) && (
                  <Button variant="ghost" size="sm" onClick={() => setState({ from: '', to: '' })}>
                    Clear dates
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      Leads
                      {activeColumnFilterCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 py-0 text-[10px] font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          onClick={clearColumnFilters}
                        >
                          Clear column filters ({activeColumnFilterCount})
                        </Button>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {data
                        ? `${rangeStart}–${rangeEnd} of ${total} shown${
                            activeColumnFilterCount > 0 ? ` · ${tableRows.length} match column filters on this page` : ''
                          }`
                        : 'Loading…'}{' '}
                      &middot; filters apply on top of campaign + status card
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    'max-h-[min(70vh,900px)] overflow-auto transition-opacity duration-200',
                    isBackgroundRefetching && 'opacity-60 pointer-events-none'
                  )}
                >
                  {isLoading ? (
                    <table className="w-full caption-bottom text-sm">
                      <tbody>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <tr key={i} className="border-b border-border/60">
                            {Array.from({ length: colCount }).map((__, j) => (
                              <td key={j} className="px-3 py-2.5">
                                <Skeleton className="h-4 w-full" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : tableRows.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">No leads match filters</p>
                  ) : (
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/50 [&_tr]:border-b">
                        {variant === 'team-lead' ? (
                          <tr className="border-b transition-colors hover:bg-muted/50">
                            <HeaderCell
                              label="Lead ref"
                              sortField="leadRef"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.leadRef}
                              filterOptions={leadRefOptions}
                              onFilterChange={(v) => handleColumnFilterChange('leadRef', v)}
                            />
                            <HeaderCell label="Date" sortField="date" state={state} onSort={handleSort} />
                            <HeaderCell
                              label="Patient"
                              sortField="patient"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.patient}
                              filterOptions={patientOptions}
                              onFilterChange={(v) => handleColumnFilterChange('patient', v)}
                            />
                            <HeaderCell
                              label="Age/Sex"
                              filterValue={columnFilters.ageSex}
                              filterOptions={ageSexOptions}
                              onFilterChange={(v) => handleColumnFilterChange('ageSex', v)}
                            />
                            <HeaderCell
                              label="Circle"
                              filterValue={columnFilters.circle}
                              filterOptions={circleColOptions}
                              onFilterChange={(v) => handleColumnFilterChange('circle', v)}
                            />
                            <HeaderCell
                              label="Treatment"
                              filterValue={columnFilters.treatment}
                              filterOptions={treatmentOptions}
                              onFilterChange={(v) => handleColumnFilterChange('treatment', v)}
                            />
                            <HeaderCell
                              label="BDM"
                              filterValue={columnFilters.bdm}
                              filterOptions={bdmOptions}
                              onFilterChange={(v) => handleColumnFilterChange('bdm', v)}
                            />
                            <HeaderCell
                              label="Hospital"
                              filterValue={columnFilters.hospital}
                              filterOptions={hospitalOptions}
                              onFilterChange={(v) => handleColumnFilterChange('hospital', v)}
                            />
                            <HeaderCell
                              label="Doctor"
                              filterValue={columnFilters.doctor}
                              filterOptions={doctorOptions}
                              onFilterChange={(v) => handleColumnFilterChange('doctor', v)}
                            />
                            <HeaderCell
                              label="Category"
                              filterValue={columnFilters.category}
                              filterOptions={categoryColOptions}
                              onFilterChange={(v) => handleColumnFilterChange('category', v)}
                            />
                            <HeaderCell
                              label="Status"
                              sortField="status"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.status}
                              filterOptions={statusOptions}
                              onFilterChange={(v) => handleColumnFilterChange('status', v)}
                            />
                            <HeaderCell
                              label="Stage"
                              filterValue={columnFilters.stage}
                              filterOptions={stageOptions}
                              onFilterChange={(v) => handleColumnFilterChange('stage', v)}
                            />
                            <HeaderCell label="Recency" />
                            <HeaderCell
                              label="BD"
                              sortField="bd"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.bd}
                              filterOptions={bdNameOptions}
                              onFilterChange={(v) => handleColumnFilterChange('bd', v)}
                            />
                            <th className="h-10 w-[100px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Notes
                            </th>
                            <th className="h-10 w-[80px] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                          </tr>
                        ) : (
                          <tr className="border-b transition-colors hover:bg-muted/50">
                            <HeaderCell
                              label="Lead ref"
                              sortField="leadRef"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.leadRef}
                              filterOptions={leadRefOptions}
                              onFilterChange={(v) => handleColumnFilterChange('leadRef', v)}
                            />
                            <HeaderCell
                              label="Patient"
                              sortField="patient"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.patient}
                              filterOptions={patientOptions}
                              onFilterChange={(v) => handleColumnFilterChange('patient', v)}
                            />
                            <HeaderCell
                              label="Treatment"
                              filterValue={columnFilters.treatment}
                              filterOptions={treatmentOptions}
                              onFilterChange={(v) => handleColumnFilterChange('treatment', v)}
                            />
                            <HeaderCell
                              label="Category"
                              filterValue={columnFilters.category}
                              filterOptions={categoryColOptions}
                              onFilterChange={(v) => handleColumnFilterChange('category', v)}
                            />
                            <HeaderCell label="Age" />
                            <HeaderCell
                              label="Status"
                              sortField="status"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.status}
                              filterOptions={statusOptions}
                              onFilterChange={(v) => handleColumnFilterChange('status', v)}
                            />
                            <HeaderCell
                              label="Stage"
                              filterValue={columnFilters.stage}
                              filterOptions={stageOptions}
                              onFilterChange={(v) => handleColumnFilterChange('stage', v)}
                            />
                            <th className="h-10 w-[100px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Notes
                            </th>
                            <th className="h-10 w-[80px] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {tableRows.map((lead) => (
                          <PipelineRow
                            key={lead.id}
                            lead={lead}
                            variant={variant}
                            noteCount={noteCounts[lead.id]}
                            onClick={handleRowClick}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {total > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : 'No results'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => setState({ pageSize: Number(v), page: 1 })}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setState({ page: page - 1 })}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setState({ page: page + 1 })}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

/**
 * Unified header cell: optional sort button + optional column filter dropdown,
 * side by side in one <th>. Pass sortField/state/onSort to make it sortable,
 * and/or filterValue/filterOptions/onFilterChange to give it a filter dropdown.
 * A header with neither is just a static label (e.g. "Recency").
 */
function HeaderCell({
  label,
  sortField,
  state,
  onSort,
  filterValue,
  filterOptions,
  onFilterChange,
}: {
  label: string
  sortField?: PipelineSortField
  state?: { sort: PipelineSortField; dir: PipelineSortDir }
  onSort?: (field: PipelineSortField) => void
  filterValue?: string[]
  filterOptions?: string[]
  onFilterChange?: (v: string[]) => void
}) {
  const active = !!sortField && state?.sort === sortField

  return (
    <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
        {sortField && onSort ? (
          <button
            type="button"
            onClick={() => onSort(sortField)}
            className={cn(
              'inline-flex items-center gap-1 transition-colors hover:text-foreground',
              active && 'text-foreground'
            )}
          >
            {label}
            {active ? (
              state!.dir === 'asc' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
            )}
          </button>
        ) : (
          <span>{label}</span>
        )}
        {filterOptions && onFilterChange && (
          <ColumnFilter value={filterValue} options={filterOptions} onChange={(v) => onFilterChange(v as string[])} />
        )}
      </div>
    </th>
  )
}

const PipelineRow = memo(function PipelineRow({
  lead,
  variant,
  noteCount,
  onClick,
}: {
  lead: Lead
  variant: 'bd' | 'team-lead'
  noteCount?: number
  onClick: (id: string) => void
}) {
  const stage = lead.caseStage ? getCaseStageBadgeConfig(String(lead.caseStage)) : null
  const st = normalizeLeadStatus(lead.status)
  const sc = getStatusColor(st)
  const statusClass = `${sc.bg} ${sc.text}`

  if (variant === 'team-lead') {
    const receipt = getLeadReceiptDate(lead)
    const dateStr = receipt ? format(receipt, 'MMM d, yyyy') : '—'
    const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
    return (
      <tr
        className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
        onClick={() => onClick(lead.id)}
      >
        <td className="px-3 py-2 font-medium">
          <div className="flex items-center gap-0.5">
            <span className="truncate max-w-[120px] sm:max-w-[160px]" title={String(lead.leadRef)}>
              {lead.leadRef}
            </span>
            {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
          </div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">{dateStr}</td>
        <td className="max-w-[140px] truncate px-3 py-2">{typeof lead.patientName === 'string' ? lead.patientName : '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 text-sm">{formatLeadAgeSex(lead)}</td>
        <td className="max-w-[100px] truncate px-3 py-2 text-sm">{normalizedText(lead.circle, '—')}</td>
        <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">{typeof lead.treatment === 'string' ? lead.treatment : '—'}</td>
        <td className="max-w-[100px] truncate px-3 py-2 text-sm">{(lead.plRecord?.bdmName ?? '').trim() || '—'}</td>
        <td className="max-w-[140px] truncate px-3 py-2 text-sm">{hospital || '—'}</td>
        <td className="max-w-[140px] truncate px-3 py-2 text-sm">{doctor || '—'}</td>
        <td className="px-3 py-2">{typeof lead.category === 'string' ? lead.category : '—'}</td>
        <td className="px-3 py-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass}`}>{st}</span>
        </td>
        <td className="px-3 py-2">
          {stage ? (
            <Badge variant="secondary" className={`text-[11px] ${stage.className}`}>
              {stage.label}
            </Badge>
          ) : (
            '—'
          )}
        </td>
        <td className="px-3 py-2">
          <LeadAgeBadge lead={lead} />
        </td>
        <td className="max-w-[100px] truncate px-3 py-2 text-sm">{lead.bd?.name ?? '—'}</td>
        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center">
            <CallNotesPopover leadId={lead.id} onRowClickStop noteCount={noteCount} />
          </div>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/patient/${lead.id}`} aria-label="Open lead">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
      onClick={() => onClick(lead.id)}
    >
      <td className="px-3 py-2 font-medium">
        <div className="flex items-center gap-0.5">
          <span className="truncate max-w-[120px] sm:max-w-[160px]" title={String(lead.leadRef)}>
            {lead.leadRef}
          </span>
          {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
        </div>
      </td>
      <td className="max-w-[140px] truncate px-3 py-2">{typeof lead.patientName === 'string' ? lead.patientName : '—'}</td>
      <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">{typeof lead.treatment === 'string' ? lead.treatment : '—'}</td>
      <td className="px-3 py-2">{typeof lead.category === 'string' ? lead.category : '—'}</td>
      <td className="px-3 py-2">
        <LeadAgeBadge lead={lead} />
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass}`}>{st}</span>
      </td>
      <td className="px-3 py-2">
        {stage ? (
          <Badge variant="secondary" className={`text-[11px] ${stage.className}`}>
            {stage.label}
          </Badge>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <CallNotesPopover leadId={lead.id} onRowClickStop noteCount={noteCount} />
        </div>
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/patient/${lead.id}`} aria-label="Open lead">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </td>
    </tr>
  )
})