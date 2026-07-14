'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CallNotesPopover } from '@/components/pipeline/call-notes-popover'
import {
  CampaignSidebar,
  type CampaignSelection,
  type SidebarGroupMode,
} from '@/components/pipeline/campaign-sidebar'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { LeadEditDrawer } from '@/components/pipeline/lead-edit-drawer'
import { LeadRemarksDrawer } from '@/components/pipeline/lead-remarks-drawer'
import { LeadAgeBadge } from '@/components/pipeline/lead-age-badge'
import { PipelineStatusCards } from '@/components/pipeline/pipeline-status-cards'
import { LeadQrPopover } from '@/components/leads/lead-qr-popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/use-auth'
import { useLeads, type Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { formatLeadAgeSex, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { getStatusColor } from '@/lib/lead-status-colors'
import {
  getLeadReceiptDate,
  getLeadPipelineBucket,
  matchesLeadAgeFilter,
  normalizeLeadStatus,
  type LeadAgeFilter,
  type PipelineStatusBucket,
} from '@/lib/pipeline-lead-buckets'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { format } from 'date-fns'
import { CalendarIcon, ExternalLink, FilePenLine, Pencil, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, memo, useDeferredValue } from 'react'
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

function normalizedText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return (trimmed || fallback).replace(/\s+/g, ' ')
}

function groupValueForLead(lead: Lead, groupBy: SidebarGroupMode): string {
  return groupBy === 'circle'
    ? normalizedText(lead.circle, 'Unknown')
    : normalizedText(lead.treatment, 'Unknown disease')
}

function filterByCampaign(leads: Lead[], sel: CampaignSelection): Lead[] {
  if (sel.type === 'all') return leads
  return leads.filter((l) => {
    const groupValue = groupValueForLead(l, sel.groupBy)
    const camp = normalizedText(l.campaignName, 'No campaign')
    return groupValue === sel.groupValue && camp === sel.campaignLabel
  })
}

const ROW_HEIGHT = 48
const OVERSCAN = 30
const OPENED_PIPELINE_LEADS_STORAGE_KEY = 'crm-pipeline-opened-leads'

function readOpenedPipelineLeadIds() {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(OPENED_PIPELINE_LEADS_STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function writeOpenedPipelineLeadIds(nextIds: string[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(OPENED_PIPELINE_LEADS_STORAGE_KEY, JSON.stringify(nextIds))
  } catch {
    // Ignore storage write failures. The UI highlight is best-effort only.
  }
}

export function SalesPipelinePage({ variant }: { variant: 'bd' | 'team-lead' }) {
  const { user } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [campaignSelection, setCampaignSelection] = useState<CampaignSelection>({ type: 'all' })
  const [sidebarGroupBy, setSidebarGroupBy] = useState<SidebarGroupMode>('circle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [statusBucket, setStatusBucket] = useState<PipelineStatusBucket>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 250)
  const [categoryBar, setCategoryBar] = useState<string>('all')
  const [circleBar, setCircleBar] = useState<string>('all')
  const [leadAgeFilter, setLeadAgeFilter] = useState<LeadAgeFilter>('all')
  const [bdFilter, setBdFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [remarksLeadId, setRemarksLeadId] = useState<string | null>(null)
  const [openedLeadIds, setOpenedLeadIds] = useState<string[]>([])

  const phoneParsed = parsePhoneSearchQuery(debouncedSearch)

  const leadFilters = useMemo(() => {
    const f: Record<string, string> = { view: 'pipeline' }
    if (variant === 'bd' && user?.id) f.bdId = user.id
    // `teamId` is ignored by /api/leads today, but including a user-scoped value here
    // keeps the client/query cache isolated per team lead instead of sharing one
    // generic "pipeline" cache across all team-lead sessions.
    if (variant === 'team-lead' && user?.id) f.teamId = user.id
    if (phoneParsed) f.phoneSearch = phoneParsed.last10
    return f
  }, [variant, user?.id, phoneParsed])

  const { leads, isLoading } = useLeads(leadFilters)

  useEffect(() => {
    setOpenedLeadIds(readOpenedPipelineLeadIds())
  }, [])

  useEffect(() => {
    setCampaignSelection({ type: 'all' })
  }, [sidebarGroupBy])

  const { data: targets } = useQuery<Target[]>({
    queryKey: ['targets', 'BD', user?.id],
    queryFn: () => apiGet<Target[]>(`/api/targets?targetType=BD&targetForId=${user?.id}`),
    enabled: variant === 'bd' && !!user?.id,
  })

  const targetProgress = useMemo(() => {
    if (variant !== 'bd' || !targets?.length || !leads.length) return null
    const now = new Date()
    const activeTarget = targets
      .filter((t) => {
        const start = new Date(t.periodStartDate)
        const end = new Date(t.periodEndDate)
        return now >= start && now <= end
      })
      .sort((a, b) => new Date(b.periodStartDate).getTime() - new Date(a.periodStartDate).getTime())[0]
    if (!activeTarget) return null
    let actual = 0
    switch (activeTarget.metric) {
      case 'LEADS_CLOSED':
        actual = leads.filter((lead) => {
          const st = normalizeLeadStatus(lead.status).toLowerCase()
          return ['ipd done', 'closed', 'call done', 'c/w done', 'wa done', 'scan done'].some((x) => st.includes(x))
        }).length
        break
      case 'NET_PROFIT':
        actual = leads.reduce((sum, lead) => sum + (lead.netProfit || 0), 0)
        break
      case 'BILL_AMOUNT':
        actual = leads.reduce((sum, lead) => sum + (Number((lead as { billAmount?: number }).billAmount) || 0), 0)
        break
      case 'SURGERIES_DONE':
        actual = leads.filter((lead) => (lead as { surgeryDate?: unknown }).surgeryDate != null).length
        break
    }
    const pct = activeTarget.targetValue > 0 ? Math.min(100, (actual / activeTarget.targetValue) * 100) : 0
    return { target: activeTarget, actual, pct }
  }, [variant, targets, leads])

  const campaignFiltered = useMemo(() => filterByCampaign(leads, campaignSelection), [leads, campaignSelection])

  const uniqueCategories = useMemo(() => {
    const s = new Set(campaignFiltered.map((l) => l.category).filter(Boolean) as string[])
    return [...s].sort()
  }, [campaignFiltered])

  const uniqueCirclesBar = useMemo(() => {
    const s = new Set(campaignFiltered.map((l) => normalizedText(l.circle, 'Unknown')))
    return [...s].sort()
  }, [campaignFiltered])

  const bdOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of campaignFiltered) {
      const id = l.bdId || l.bd?.id
      const name = l.bd?.name
      if (id && name) m.set(id, name)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [campaignFiltered])

  const tableFilters = useMemo(
    () => ({
      statusBucket,
      bdFilter,
      categoryBar,
      circleBar,
      leadAgeFilter,
      startDate: startDate?.getTime() ?? null,
      endDate: endDate?.getTime() ?? null,
    }),
    [statusBucket, bdFilter, categoryBar, circleBar, leadAgeFilter, startDate, endDate]
  )

  const deferredFilters = useDeferredValue(tableFilters)

  const isFiltering = deferredFilters !== tableFilters

  const tableRows = useMemo(() => {
    let result = campaignFiltered

    if (deferredFilters.statusBucket !== 'all') {
      result = result.filter((l) => getLeadPipelineBucket(l.status) === deferredFilters.statusBucket)
    }

    if (deferredFilters.bdFilter !== 'all') {
      result = result.filter((l) => (l.bdId || l.bd?.id) === deferredFilters.bdFilter)
    }

    if (debouncedSearch.trim() && !phoneParsed) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (lead) =>
          String(lead.patientName ?? '').toLowerCase().includes(q) ||
          String(lead.leadRef ?? '').toLowerCase().includes(q) ||
          String(lead.circle ?? '').toLowerCase().includes(q) ||
          String(lead.hospitalName ?? '').toLowerCase().includes(q) ||
          String(lead.treatment ?? '').toLowerCase().includes(q) ||
          String(lead.category ?? '').toLowerCase().includes(q) ||
          String(lead.bd?.name ?? '').toLowerCase().includes(q)
      )
    }

    if (deferredFilters.categoryBar !== 'all') {
      result = result.filter((l) => (l.category ?? '') === deferredFilters.categoryBar)
    }

    if (deferredFilters.circleBar !== 'all') {
      result = result.filter((l) => normalizedText(l.circle, 'Unknown') === deferredFilters.circleBar)
    }

    if (deferredFilters.leadAgeFilter !== 'all') {
      result = result.filter((l) => matchesLeadAgeFilter(l, deferredFilters.leadAgeFilter))
    }

    if (deferredFilters.startDate || deferredFilters.endDate) {
      result = result.filter((lead) => {
        const receiptDate = getLeadReceiptDate(lead)
        if (!receiptDate) return false
        const leadOnly = new Date(receiptDate.getFullYear(), receiptDate.getMonth(), receiptDate.getDate())
        const startOnly = deferredFilters.startDate
        const endOnly = deferredFilters.endDate
        if (startOnly && endOnly) return leadOnly >= new Date(startOnly) && leadOnly <= new Date(endOnly)
        if (startOnly) return leadOnly >= new Date(startOnly)
        if (endOnly) return leadOnly <= new Date(endOnly)
        return true
      })
    }

    return [...result].sort((a, b) => {
      const ta = getLeadReceiptDate(a)?.getTime() ?? 0
      const tb = getLeadReceiptDate(b)?.getTime() ?? 0
      return tb - ta
    })
  }, [
    campaignFiltered,
    deferredFilters,
    debouncedSearch,
    phoneParsed,
  ])

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  const visibleLeadIds = useMemo(() => {
    const items = virtualizer.getVirtualItems()
    return items.map((vi) => tableRows[vi.index]?.id).filter(Boolean) as string[]
  }, [virtualizer.getVirtualItems(), tableRows])

  const noteCountKey = useMemo(() => {
    const sorted = [...visibleLeadIds].sort()
    return sorted.join(',')
  }, [visibleLeadIds])

  const { data: noteCounts = {} } = useQuery({
    queryKey: ['call-note-counts', noteCountKey],
    queryFn: () => fetchNoteCountsForLeads(visibleLeadIds),
    enabled: visibleLeadIds.length > 0 && !!user?.id,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const markLeadOpened = useCallback((id: string) => {
    setOpenedLeadIds((current) => {
      if (current.includes(id)) return current
      const next = [id, ...current].slice(0, 500)
      writeOpenedPipelineLeadIds(next)
      return next
    })
  }, [])

  const handleRowClick = useCallback(
    (id: string) => {
      markLeadOpened(id)
      router.push(`/patient/${id}`)
    },
    [markLeadOpened, router]
  )

  const handleEditLead = useCallback((id: string) => {
    markLeadOpened(id)
    setEditingLeadId(id)
  }, [markLeadOpened])

  const handleEditRemarks = useCallback((id: string) => {
    markLeadOpened(id)
    setRemarksLeadId(id)
  }, [markLeadOpened])

  const handleEditDrawerChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingLeadId(null)
    }
  }, [])

  const handleRemarksDrawerChange = useCallback((open: boolean) => {
    if (!open) {
      setRemarksLeadId(null)
    }
  }, [])

  const title = variant === 'bd' ? 'Pipeline' : 'Team pipeline'
  const subtitle =
    variant === 'bd' ? 'Campaigns, status breakdown, and all your leads' : 'Your team\u2019s leads by campaign and status'

  const virtualItems = virtualizer.getVirtualItems()
  const padTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const padBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0

  const colCount = variant === 'team-lead' ? 16 : 9

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
                <p className="text-xl font-bold text-primary tabular-nums">{leads.length}</p>
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
            leads={leads}
            groupBy={sidebarGroupBy}
            onGroupByChange={setSidebarGroupBy}
            selection={campaignSelection}
            onSelect={setCampaignSelection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
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
                    <div className="flex justify-between text-xs">
                      <span>Actual: {targetProgress.actual}</span>
                      <span>Goal: {targetProgress.target.targetValue}</span>
                    </div>
                    <Progress value={targetProgress.pct} className="h-2" />
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
                        {campaignFiltered.length} in campaign
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {campaignSelection.groupBy}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-primary">{campaignFiltered.length}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                </div>
              </Card>
            )}

            <div className="mb-4">
              <PipelineStatusCards
                leads={campaignFiltered}
                selected={statusBucket}
                onSelect={setStatusBucket}
              />
            </div>

            <Card className="border-border/80 p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, ref, hospital… — or full mobile (10 digits or 91…)"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {variant === 'team-lead' && bdOptions.length > 0 && (
                  <Select value={bdFilter} onValueChange={setBdFilter}>
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="BD" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All BDs</SelectItem>
                      {bdOptions.map(([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={leadAgeFilter} onValueChange={(v) => setLeadAgeFilter(v as LeadAgeFilter)}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Lead age" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ages</SelectItem>
                    <SelectItem value="new">New (&lt; 1 week)</SelectItem>
                    <SelectItem value="lt1m">&lt; 1 month</SelectItem>
                    <SelectItem value="1to2m">1â€“2 months</SelectItem>
                    <SelectItem value="2to3m">2â€“3 months</SelectItem>
                    <SelectItem value="3plus">3+ months</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryBar} onValueChange={setCategoryBar}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {uniqueCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={circleBar} onValueChange={setCircleBar}>
                  <SelectTrigger className="w-full lg:w-[160px]">
                    <SelectValue placeholder="Circle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All circles</SelectItem>
                    {uniqueCirclesBar.map((c) => (
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
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
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
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                  </PopoverContent>
                </Popover>
                {(startDate || endDate) && (
                  <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined) }}>
                    Clear dates
                  </Button>
                )}
              </div>

              <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">Leads</h3>
                    <p className="text-xs text-muted-foreground">
                      {tableRows.length} shown &middot; filters apply on top of campaign + status card
                    </p>
                  </div>
                </div>

                <div ref={scrollRef} className={cn('max-h-[min(70vh,900px)] overflow-auto transition-opacity duration-200', isFiltering && 'opacity-50 pointer-events-none')}>
                  {isLoading ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Loading leadsâ€¦</p>
                  ) : tableRows.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">No leads match filters</p>
                  ) : (
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/50 [&_tr]:border-b">
                        {variant === 'team-lead' ? (
                          <tr className="border-b transition-colors hover:bg-muted/50">
                            <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Lead ref
                            </th>
                            <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Date
                            </th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Patient</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Age/Sex</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Circle</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Treatment</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">BDM</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hospital</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Doctor</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recency</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">BD</th>
                            <th className="h-10 w-[100px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Notes
                            </th>
                            <th className="h-10 w-[132px] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                          </tr>
                        ) : (
                          <tr className="border-b transition-colors hover:bg-muted/50">
                            <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Lead ref
                            </th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Patient</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Treatment</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Age</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
                            <th className="h-10 w-[100px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Notes
                            </th>
                            <th className="h-10 w-[132px] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {padTop > 0 && (
                          <tr>
                            <td colSpan={colCount} style={{ height: padTop, padding: 0 }} />
                          </tr>
                        )}
                        {virtualItems.map((vi) => {
                          const lead = tableRows[vi.index]
                          if (!lead) return null
                          return (
                            <PipelineRow
                              key={lead.id}
                              lead={lead}
                              variant={variant}
                              noteCount={noteCounts[lead.id]}
                              onClick={handleRowClick}
                              onEdit={handleEditLead}
                              onEditRemarks={handleEditRemarks}
                              onMarkOpened={markLeadOpened}
                              isOpened={openedLeadIds.includes(lead.id)}
                            />
                          )
                        })}
                        {padBottom > 0 && (
                          <tr>
                            <td colSpan={colCount} style={{ height: padBottom, padding: 0 }} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </Card>
          </main>
        </div>
        <LeadEditDrawer
          key={editingLeadId ?? 'lead-edit-drawer'}
          leadId={editingLeadId}
          open={editingLeadId !== null}
          onOpenChange={handleEditDrawerChange}
        />
        <LeadRemarksDrawer
          key={remarksLeadId ?? 'lead-remarks-drawer'}
          leadId={remarksLeadId}
          open={remarksLeadId !== null}
          onOpenChange={handleRemarksDrawerChange}
        />
      </div>
    </AuthenticatedLayout>
  )
}

function getLatestRemarkPreview(lead: Lead) {
  const rawRemark =
    typeof lead.latestRemark?.content === 'string'
      ? lead.latestRemark.content
      : typeof lead.remarks === 'string'
        ? lead.remarks
        : ''
  const trimmed = rawRemark.trim()
  return trimmed.length > 0 ? trimmed : 'No remarks yet.'
}

const PipelineRow = memo(function PipelineRow({
  lead,
  variant,
  noteCount,
  onClick,
  onEdit,
  onEditRemarks,
}: {
  lead: Lead
  variant: 'bd' | 'team-lead'
  noteCount?: number
  onClick: (id: string) => void
  onEdit: (id: string) => void
  onEditRemarks: (id: string) => void
  onMarkOpened: (id: string) => void
  isOpened: boolean
}) {
  const stage = lead.caseStage ? getCaseStageBadgeConfig(String(lead.caseStage)) : null
  const st = normalizeLeadStatus(lead.status)
  const sc = getStatusColor(st)
  const statusClass = isOpened
    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200'
    : `${sc.bg} ${sc.text}`
  const latestRemarkPreview = getLatestRemarkPreview(lead)
  const patientName = typeof lead.patientName === 'string' ? lead.patientName : '—'

  if (variant === 'team-lead') {
    const receipt = getLeadReceiptDate(lead)
    const dateStr = receipt ? format(receipt, 'MMM d, yyyy') : '—'
    const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
    return (
      <tr
        className={cn(
          'cursor-pointer border-b border-border/60 transition-colors',
          isOpened
            ? 'bg-cyan-50/80 hover:bg-cyan-100/70 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30'
            : 'hover:bg-muted/50'
        )}
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
        <td className="max-w-[140px] truncate px-3 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block max-w-[140px] truncate align-bottom">{patientName}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-pre-wrap text-left text-xs leading-5">
              {latestRemarkPreview}
            </TooltipContent>
          </Tooltip>
        </td>
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
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEditRemarks(lead.id)}
                  aria-label="Edit remarks"
                >
                  <FilePenLine className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-wrap text-left text-xs leading-5">
                {latestRemarkPreview}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => onEdit(lead.id)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <LeadQrPopover
              leadId={lead.id}
              phoneNumber={lead.phoneNumber ?? ''}
              patientName={patientName}
              allowServerSidePhoneLookup
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link
                href={`/patient/${lead.id}`}
                aria-label="Open lead"
                onClick={() => onMarkOpened(lead.id)}
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={cn(
        'cursor-pointer border-b border-border/60 transition-colors',
        isOpened
          ? 'bg-cyan-50/80 hover:bg-cyan-100/70 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30'
          : 'hover:bg-muted/50'
      )}
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
      <td className="max-w-[140px] truncate px-3 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block max-w-[140px] truncate align-bottom">{patientName}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm whitespace-pre-wrap text-left text-xs leading-5">
            {latestRemarkPreview}
          </TooltipContent>
        </Tooltip>
      </td>
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
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              className="h-8 w-8"
              onClick={() => onEditRemarks(lead.id)}
              aria-label="Edit remarks"
              >
                <FilePenLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-pre-wrap text-left text-xs leading-5">
              {latestRemarkPreview}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            onClick={() => onEdit(lead.id)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <LeadQrPopover
            leadId={lead.id}
            phoneNumber={lead.phoneNumber ?? ''}
            patientName={patientName}
            allowServerSidePhoneLookup
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link
              href={`/patient/${lead.id}`}
              aria-label="Open lead"
              onClick={() => onMarkOpened(lead.id)}
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  )
})
