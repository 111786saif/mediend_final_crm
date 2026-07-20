'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CallNotesPopover } from '@/components/pipeline/call-notes-popover'
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
import { ColumnFilter } from '@/components/ui/column-filter'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { CaseStage } from '@/generated/prisma/enums'
import { useAuth } from '@/hooks/use-auth'
import { usePipelinePage, usePipelineUrlState } from '@/hooks/use-pipeline'
import type { Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { formatLeadAgeSex, resolveLeadCity, resolveLeadHospitalDoctor } from '@/lib/lead-display'
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
  FilePenLine,
  Menu,
  Pencil,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

const PAGE_SIZE_OPTIONS = [20, 50, 100]

type PipelineColumnId =
  | 'id'
  | 'leadRef'
  | 'assignDate'
  | 'leadDate'
  | 'patient'
  | 'month'
  | 'age'
  | 'sex'
  | 'ageSex'
  | 'circle'
  | 'city'
  | 'category'
  | 'treatment'
  | 'planningTreatment'
  | 'profession'
  | 'tl'
  | 'bdm'
  | 'hospital'
  | 'doctor'
  | 'status'
  | 'stage'
  | 'mop'
  | 'lastRemarks'
  | 'newRemarks'
  | 'followUpDate'
  | 'subStatus'
  | 'surgeryDate'
  | 'healthInsurance'
  | 'preferredLocation'
  | 'source'
  | 'leadSource'
  | 'createDate'
  | 'modifyBy'
  | 'modifyDate'
  | 'dupCount'
  | 'recency'
  | 'bd'

type PipelineColumnDefinition = {
  id: PipelineColumnId
  label: string
  variants?: Array<'bd' | 'team-lead'>
  defaultVisible: {
    bd: boolean
    'team-lead': boolean
  }
}

const PIPELINE_VISIBLE_COLUMNS_STORAGE_KEY_PREFIX = 'crm-pipeline-visible-columns'

const PIPELINE_COLUMN_DEFINITIONS: PipelineColumnDefinition[] = [
  { id: 'id', label: 'id', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'leadRef', label: 'Lead Ref', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'assignDate', label: 'Assign Date', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'leadDate', label: 'Lead Date', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'patient', label: 'Patient Name', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'month', label: 'Month', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'age', label: 'Age', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'sex', label: 'Sex', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'ageSex', label: 'Age/Sex', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'circle', label: 'Circle', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'city', label: 'City', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'category', label: 'Category', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'treatment', label: 'Treatment', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'planningTreatment', label: 'Planning Treatment', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'profession', label: 'Profession', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'tl', label: 'TL', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'bdm', label: 'BDM (Assign)', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'hospital', label: 'Hospital', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'doctor', label: 'Doctor', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'status', label: 'Status', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'stage', label: 'Stage', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'mop', label: 'MOP', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'lastRemarks', label: 'Last Remarks', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'newRemarks', label: 'New Remarks', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'followUpDate', label: 'Follow Up Date', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'subStatus', label: 'Sub Status', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'surgeryDate', label: 'Surgery Date', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'healthInsurance', label: 'Health Insurance', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'preferredLocation', label: 'Preferred Location', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'source', label: 'Source', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'leadSource', label: 'Lead Source', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'createDate', label: 'Create Date', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'modifyBy', label: 'Modify By', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'modifyDate', label: 'Modify Date', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'dupCount', label: 'Dupl Count', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'recency', label: 'Recency', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'bd', label: 'BD', defaultVisible: { bd: false, 'team-lead': true } },
]

function getPipelineColumnDefinitions(variant: 'bd' | 'team-lead') {
  return PIPELINE_COLUMN_DEFINITIONS.filter(
    (column) => !column.variants || column.variants.includes(variant)
  )
}

function createInitialVisibleColumns(variant: 'bd' | 'team-lead') {
  return Object.fromEntries(
    getPipelineColumnDefinitions(variant).map((column) => [column.id, column.defaultVisible[variant]])
  ) as Record<PipelineColumnId, boolean>
}

function readPipelineVisibleColumns(variant: 'bd' | 'team-lead') {
  const defaults = createInitialVisibleColumns(variant)

  if (typeof window === 'undefined') return defaults

  try {
    const stored = window.localStorage.getItem(`${PIPELINE_VISIBLE_COLUMNS_STORAGE_KEY_PREFIX}:${variant}`)
    if (!stored) return defaults

    const parsed = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return defaults

    const next = { ...defaults }
    for (const column of getPipelineColumnDefinitions(variant)) {
      if (typeof parsed[column.id] === 'boolean') {
        next[column.id] = parsed[column.id]
      }
    }
    return next
  } catch {
    return defaults
  }
}

function writePipelineVisibleColumns(
  variant: 'bd' | 'team-lead',
  nextColumns: Record<PipelineColumnId, boolean>
) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      `${PIPELINE_VISIBLE_COLUMNS_STORAGE_KEY_PREFIX}:${variant}`,
      JSON.stringify(nextColumns)
    )
  } catch {
    // Ignore storage write failures. Column visibility is best-effort only.
  }
}

function formatTableDate(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : format(parsed, 'dd MMM yyyy')
}

function formatMonthCell(value: unknown) {
  if (!value) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  return formatTableDate(value)
}

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
  useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { state, setState, campaignSelection } = usePipelineUrlState()
  const { data, isLoading, isFetching } = usePipelinePage()

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [remarksLeadId, setRemarksLeadId] = useState<string | null>(null)
  const [openedLeadIds, setOpenedLeadIds] = useState<string[]>(() => readOpenedPipelineLeadIds())
  const [visibleColumns, setVisibleColumns] = useState<Record<PipelineColumnId, boolean>>(() =>
    readPipelineVisibleColumns(variant)
  )

  const [searchInput, setSearchInput] = useState(state.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const availableColumns = useMemo(() => getPipelineColumnDefinitions(variant), [variant])
  const visibleColumnCount = useMemo(
    () => availableColumns.filter((column) => visibleColumns[column.id]).length + 3,
    [availableColumns, visibleColumns]
  )
  const isColumnVisible = useCallback(
    (columnId: PipelineColumnId) => visibleColumns[columnId] === true,
    [visibleColumns]
  )

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
    const id = window.setTimeout(() => {
      setSearchInput(state.q)
    }, 0)

    return () => window.clearTimeout(id)
  }, [state.q])

  useEffect(() => {
    if (debouncedSearch !== state.q) {
      setState({ q: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    writePipelineVisibleColumns(variant, visibleColumns)
  }, [variant, visibleColumns])

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
    if (cf.ageSex?.length) result = result.filter((l) => cf.ageSex.includes(formatLeadAgeSex(l)))
    if (cf.circle?.length) result = result.filter((l) => cf.circle.includes(normalizedText(l.circle, 'Unknown')))
    if (cf.bdm?.length) result = result.filter((l) => cf.bdm.includes(l.plRecord?.bdmName ?? ''))
    if (cf.hospital?.length)
      result = result.filter((l) => cf.hospital.includes(resolveLeadHospitalDoctor(l).hospital ?? ''))
    if (cf.doctor?.length) result = result.filter((l) => cf.doctor.includes(resolveLeadHospitalDoctor(l).doctor ?? ''))
    if (cf.bd?.length) result = result.filter((l) => cf.bd.includes(l.bd?.name ?? ''))

    return result
  }, [rawPageLeads, columnFilters])

  const noteCountKey = useMemo(() => [...tableRows.map((l) => l.id)].sort().join(','), [tableRows])

  const { data: noteCounts = {} } = useQuery({
    queryKey: ['call-note-counts', noteCountKey],
    queryFn: () => fetchNoteCountsForLeads(tableRows.map((l) => l.id)),
    enabled: tableRows.length > 0 && !!user?.id,
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
      // router.push(`/patient/${id}`)
      window.open(`/patient/${id}`, '_blank', 'noopener,noreferrer')
    },
    [markLeadOpened]
  )


  // const handleRowClick = useCallback((id: string) => {
  //   window.open(`/patient/${id}`, '_blank', 'noopener,noreferrer')
  // }, [])

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

  const total = data?.total ?? 0
  const page = data?.page ?? state.page
  const pageSize = data?.pageSize ?? state.pageSize
  const totalPages = data?.totalPages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)
  const isBackgroundRefetching = isFetching && !isLoading
  const pipelineReturnTo = useMemo(() => {
    const query = searchParams.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

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
          {/* <CampaignSidebar
            tree={data?.campaignTree ?? []}
            totalLeads={data?.facetTotal ?? 0}
            groupBy={state.groupBy}
            onGroupByChange={handleGroupByChange}
            selection={campaignSelection}
            onSelect={setCampaignSelection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            isLoading={isLoading && !data}
          /> */}

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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-2">
                        <SlidersHorizontal className="h-4 w-4" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[380px] w-64 overflow-y-auto">
                      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableColumns.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={visibleColumns[column.id]}
                          onSelect={(event) => event.preventDefault()}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((current) => ({
                              ...current,
                              [column.id]: checked === true,
                            }))
                          }
                        >
                          {column.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                            {Array.from({ length: visibleColumnCount }).map((__, j) => (
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
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <th className="h-10 w-12 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Flow
                          </th>
                          {isColumnVisible('id') && <HeaderCell label="id" />}
                          {isColumnVisible('leadRef') && (
                            <HeaderCell
                              label="Lead Ref"
                              sortField="leadRef"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.leadRef}
                              filterOptions={leadRefOptions}
                              onFilterChange={(v) => handleColumnFilterChange('leadRef', v)}
                            />
                          )}
                          {isColumnVisible('assignDate') && <HeaderCell label="Assign Date" />}
                          {isColumnVisible('leadDate') && (
                            <HeaderCell label="Lead Date" sortField="date" state={state} onSort={handleSort} />
                          )}
                          {isColumnVisible('patient') && (
                            <HeaderCell
                              label="Patient Name"
                              sortField="patient"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.patient}
                              filterOptions={patientOptions}
                              onFilterChange={(v) => handleColumnFilterChange('patient', v)}
                            />
                          )}
                          {isColumnVisible('month') && <HeaderCell label="Month" />}
                          {isColumnVisible('age') && <HeaderCell label="Age" />}
                          {isColumnVisible('sex') && <HeaderCell label="Sex" />}
                          {isColumnVisible('ageSex') && (
                            <HeaderCell
                              label="Age/Sex"
                              filterValue={columnFilters.ageSex}
                              filterOptions={ageSexOptions}
                              onFilterChange={(v) => handleColumnFilterChange('ageSex', v)}
                            />
                          )}
                          {isColumnVisible('circle') && (
                            <HeaderCell
                              label="Circle"
                              filterValue={columnFilters.circle}
                              filterOptions={circleColOptions}
                              onFilterChange={(v) => handleColumnFilterChange('circle', v)}
                            />
                          )}
                          {isColumnVisible('city') && <HeaderCell label="City" />}
                          {isColumnVisible('category') && (
                            <HeaderCell
                              label="Category"
                              filterValue={columnFilters.category}
                              filterOptions={categoryColOptions}
                              onFilterChange={(v) => handleColumnFilterChange('category', v)}
                            />
                          )}
                          {isColumnVisible('treatment') && (
                            <HeaderCell
                              label="Treatment"
                              filterValue={columnFilters.treatment}
                              filterOptions={treatmentOptions}
                              onFilterChange={(v) => handleColumnFilterChange('treatment', v)}
                            />
                          )}
                          {isColumnVisible('planningTreatment') && <HeaderCell label="Planning Treatment" />}
                          {isColumnVisible('profession') && <HeaderCell label="Profession" />}
                          {isColumnVisible('tl') && <HeaderCell label="TL" />}
                          {isColumnVisible('bdm') && (
                            <HeaderCell
                              label="BDM (Assign)"
                              filterValue={columnFilters.bdm}
                              filterOptions={bdmOptions}
                              onFilterChange={(v) => handleColumnFilterChange('bdm', v)}
                            />
                          )}
                          {isColumnVisible('hospital') && (
                            <HeaderCell
                              label="Hospital"
                              filterValue={columnFilters.hospital}
                              filterOptions={hospitalOptions}
                              onFilterChange={(v) => handleColumnFilterChange('hospital', v)}
                            />
                          )}
                          {isColumnVisible('doctor') && (
                            <HeaderCell
                              label="Doctor"
                              filterValue={columnFilters.doctor}
                              filterOptions={doctorOptions}
                              onFilterChange={(v) => handleColumnFilterChange('doctor', v)}
                            />
                          )}
                          {isColumnVisible('status') && (
                            <HeaderCell
                              label="Status"
                              sortField="status"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.status}
                              filterOptions={statusOptions}
                              onFilterChange={(v) => handleColumnFilterChange('status', v)}
                            />
                          )}
                          {isColumnVisible('stage') && (
                            <HeaderCell
                              label="Stage"
                              filterValue={columnFilters.stage}
                              filterOptions={stageOptions}
                              onFilterChange={(v) => handleColumnFilterChange('stage', v)}
                            />
                          )}
                          {isColumnVisible('mop') && <HeaderCell label="MOP" />}
                          {isColumnVisible('lastRemarks') && <HeaderCell label="Last Remarks" />}
                          {isColumnVisible('newRemarks') && <HeaderCell label="New Remarks" />}
                          {isColumnVisible('followUpDate') && <HeaderCell label="Follow Up Date" />}
                          {isColumnVisible('subStatus') && <HeaderCell label="Sub Status" />}
                          {isColumnVisible('surgeryDate') && <HeaderCell label="Surgery Date" />}
                          {isColumnVisible('healthInsurance') && <HeaderCell label="Health Insurance" />}
                          {isColumnVisible('preferredLocation') && <HeaderCell label="Preferred Location" />}
                          {isColumnVisible('source') && <HeaderCell label="Source" />}
                          {isColumnVisible('leadSource') && <HeaderCell label="Lead Source" />}
                          {isColumnVisible('createDate') && <HeaderCell label="Create Date" />}
                          {isColumnVisible('modifyBy') && <HeaderCell label="Modify By" />}
                          {isColumnVisible('modifyDate') && <HeaderCell label="Modify Date" />}
                          {isColumnVisible('dupCount') && <HeaderCell label="Dupl Count" />}
                          {isColumnVisible('recency') && <HeaderCell label="Recency" />}
                          {isColumnVisible('bd') && (
                            <HeaderCell
                              label="BD"
                              sortField="bd"
                              state={state}
                              onSort={handleSort}
                              filterValue={columnFilters.bd}
                              filterOptions={bdNameOptions}
                              onFilterChange={(v) => handleColumnFilterChange('bd', v)}
                            />
                          )}
                          <th className="h-10 w-[100px] px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Notes
                          </th>
                          <th className="h-10 w-[132px] px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((lead) => (
                          <PipelineRow
                            key={lead.id}
                            lead={lead}
                            returnTo={pipelineReturnTo}
                            noteCount={noteCounts[lead.id]}
                            onClick={handleRowClick}
                            onEdit={handleEditLead}
                            onEditRemarks={handleEditRemarks}
                            onMarkOpened={markLeadOpened}
                            isOpened={openedLeadIds.includes(lead.id)}
                            visibleColumns={visibleColumns}
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

type PipelineCaseAction = {
  id: 'opd-schedule' | 'card-upload' | 'pre-auth-raised' | 'ipd-schedule'
  label: string
  href: string
}

function normalizeModeOfPaymentKey(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function isInsuranceModeOfPayment(modeOfPayment: unknown) {
  const normalized = normalizeModeOfPaymentKey(modeOfPayment)
  return normalized === 'cashless' || normalized === 'reimbursement'
}

function isCashModeOfPayment(modeOfPayment: unknown) {
  const normalized = normalizeModeOfPaymentKey(modeOfPayment)
  return normalized === 'cash' || normalized === 'emi'
}

function canShowPipelineOpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (lead.flowType === 'CASH') {
    return [
      CaseStage.CASH_IPD_PENDING,
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ].includes(lead.caseStage)
  }

  return [
    CaseStage.KYP_BASIC_COMPLETE,
    CaseStage.HOSPITALS_SUGGESTED,
    CaseStage.PREAUTH_RAISED,
    CaseStage.PREAUTH_COMPLETE,
    CaseStage.INITIATED,
    CaseStage.ADMITTED,
    CaseStage.IPD_DONE,
    CaseStage.DISCHARGED,
    CaseStage.PL_PENDING,
    CaseStage.OUTSTANDING,
  ].includes(lead.caseStage)
}

function canShowPipelineCardUpload(lead: Lead) {
  if (!lead.caseStage || lead.flowType === 'CASH') return false
  return [CaseStage.NEW_LEAD, CaseStage.KYP_BASIC_PENDING, CaseStage.KYP_BASIC_COMPLETE].includes(lead.caseStage)
}

function canShowPipelinePreAuthRaised(lead: Lead) {
  return lead.flowType !== 'CASH' && lead.caseStage === CaseStage.HOSPITALS_SUGGESTED
}

function canShowPipelineIpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (lead.flowType === 'CASH') {
    return [
      CaseStage.CASH_IPD_PENDING,
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ].includes(lead.caseStage)
  }

  return [CaseStage.PREAUTH_COMPLETE, CaseStage.INITIATED, CaseStage.ADMITTED].includes(lead.caseStage)
}

function getPipelineIpdScheduleHref(lead: Lead) {
  return lead.flowType === 'CASH'
    ? `/patient/${lead.id}?action=ipd-cash`
    : `/patient/${lead.id}?action=ipd-schedule`
}

function appendReturnTo(href: string, returnTo: string) {
  const [pathname, rawQuery = ''] = href.split('?')
  const params = new URLSearchParams(rawQuery)
  params.set('returnTo', returnTo)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function getPipelineCaseActions(lead: Lead, returnTo: string): PipelineCaseAction[] {
  const actions: PipelineCaseAction[] = []
  const showInsuranceActions = isInsuranceModeOfPayment(lead.modeOfPayment)
  const showCashActions = isCashModeOfPayment(lead.modeOfPayment)

  if (canShowPipelineOpdSchedule(lead) && (showInsuranceActions || showCashActions)) {
    actions.push({
      id: 'opd-schedule',
      label: 'OPD Schedule',
      href: appendReturnTo(`/patient/${lead.id}/opd-schedule`, returnTo),
    })
  }

  if (showInsuranceActions) {
    if (canShowPipelineCardUpload(lead)) {
      actions.push({
        id: 'card-upload',
        label: 'Card Upload',
        href: appendReturnTo(`/patient/${lead.id}/kyp/basic`, returnTo),
      })
    }

    if (canShowPipelinePreAuthRaised(lead)) {
      actions.push({
        id: 'pre-auth-raised',
        label: 'Pre-Auth Raised',
        href: appendReturnTo(`/patient/${lead.id}/raise-preauth`, returnTo),
      })
    }
  }

  if (canShowPipelineIpdSchedule(lead) && (showInsuranceActions || showCashActions)) {
    actions.push({
      id: 'ipd-schedule',
      label: 'IPD Schedule',
      href: appendReturnTo(getPipelineIpdScheduleHref(lead), returnTo),
    })
  }

  return actions
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
  returnTo,
  noteCount,
  onClick,
  onEdit,
  onEditRemarks,
  onMarkOpened,
  isOpened,
  visibleColumns,
}: {
  lead: Lead
  returnTo: string
  noteCount?: number
  onClick: (id: string) => void
  onEdit: (id: string) => void
  onEditRemarks: (id: string) => void
  onMarkOpened: (id: string) => void
  isOpened: boolean
  visibleColumns: Record<PipelineColumnId, boolean>
}) {
  const stage = lead.caseStage ? getCaseStageBadgeConfig(String(lead.caseStage)) : null
  const st = normalizeLeadStatus(lead.status)
  const sc = getStatusColor(st)
  const statusClass = isOpened
    ? 'bg-primary/18 text-primary ring-1 ring-primary/25 dark:bg-primary/20 dark:text-primary-foreground dark:ring-primary/30'
    : `${sc.bg} ${sc.text}`
  const latestRemarkPreview = getLatestRemarkPreview(lead)
  const patientName = typeof lead.patientName === 'string' ? lead.patientName : '—'
  const receipt = getLeadReceiptDate(lead)
  const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
  const preferredLocation = resolveLeadCity(lead) ?? normalizedText(lead.circle, '—')
  const leadRefText = typeof lead.leadRef === 'string' || typeof lead.leadRef === 'number' ? String(lead.leadRef) : '—'
  const lastRemarksText = typeof lead.remarks === 'string' && lead.remarks.trim().length > 0 ? lead.remarks.trim() : '—'
  const newRemarksText =
    typeof lead.latestRemark?.content === 'string' && lead.latestRemark.content.trim().length > 0
      ? lead.latestRemark.content.trim()
      : '—'
  const planningTreatmentText =
    typeof lead.diseaseDetails === 'string' && lead.diseaseDetails.trim().length > 0
      ? lead.diseaseDetails.trim()
      : '—'
  const caseActions = getPipelineCaseActions(lead, returnTo)
  const teamLeadText =
    (typeof lead.plRecord?.managerName === 'string' && lead.plRecord.managerName.trim()) ||
    (lead.teamLeadId != null ? String(lead.teamLeadId) : '—')
  const bdmText =
    typeof lead.plRecord?.bdmName === 'string' && lead.plRecord.bdmName.trim().length > 0
      ? lead.plRecord.bdmName.trim()
      : '—'
  const show = (columnId: PipelineColumnId) => visibleColumns[columnId] === true

  return (
    <tr
      className={cn(
        'cursor-pointer border-b border-border/60 transition-colors',
        isOpened
          ? 'bg-primary/8 hover:bg-primary/12 dark:bg-primary/10 dark:hover:bg-primary/16'
          : 'hover:bg-muted/50'
      )}
      onClick={() => onClick(lead.id)}
    >
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Open case actions"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Case Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {caseActions.length > 0 ? (
              caseActions.map((action) => (
                <DropdownMenuItem key={action.id} asChild>
                  <Link
                    href={action.href}
                    onClick={(event) => {
                      event.stopPropagation()
                      onMarkOpened(lead.id)
                    }}
                  >
                    {action.label}
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No flow actions available yet.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      {show('id') && <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">{lead.id}</td>}
      {show('leadRef') && (
        <td className="px-3 py-2 font-medium">
          <div className="flex items-center gap-0.5">
            <span className="truncate max-w-[120px] sm:max-w-[160px]" title={leadRefText}>
              {leadRefText}
            </span>
            {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
          </div>
        </td>
      )}
      {show('assignDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
          {formatTableDate(lead.assignedDate)}
        </td>
      )}
      {show('leadDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
          {receipt ? format(receipt, 'dd MMM yyyy') : '—'}
        </td>
      )}
      {show('patient') && (
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
      )}
      {show('month') && <td className="whitespace-nowrap px-3 py-2 text-sm">{formatMonthCell(lead.month)}</td>}
      {show('age') && <td className="whitespace-nowrap px-3 py-2 text-sm">{lead.age ?? '—'}</td>}
      {show('sex') && <td className="whitespace-nowrap px-3 py-2 text-sm">{normalizedText(lead.sex, '—')}</td>}
      {show('ageSex') && <td className="whitespace-nowrap px-3 py-2 text-sm">{formatLeadAgeSex(lead)}</td>}
      {show('circle') && (
        <td className="max-w-[100px] truncate px-3 py-2 text-sm">{normalizedText(lead.circle, '—')}</td>
      )}
      {show('city') && (
        <td className="max-w-[120px] truncate px-3 py-2 text-sm">{resolveLeadCity(lead) ?? '—'}</td>
      )}
      {show('category') && <td className="max-w-[120px] truncate px-3 py-2">{normalizedText(lead.category, '—')}</td>}
      {show('treatment') && (
        <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">{normalizedText(lead.treatment, '—')}</td>
      )}
      {show('planningTreatment') && (
        <td className="max-w-[180px] truncate px-3 py-2 text-sm" title={planningTreatmentText}>
          {planningTreatmentText}
        </td>
      )}
      {show('profession') && (
        <td className="max-w-[120px] truncate px-3 py-2 text-sm">{normalizedText(lead.profession, '—')}</td>
      )}
      {show('tl') && (
        <td className="max-w-[120px] truncate px-3 py-2 text-sm" title={teamLeadText}>
          {teamLeadText}
        </td>
      )}
      {show('bdm') && <td className="max-w-[120px] truncate px-3 py-2 text-sm">{bdmText}</td>}
      {show('hospital') && <td className="max-w-[160px] truncate px-3 py-2 text-sm">{hospital || '—'}</td>}
      {show('doctor') && <td className="max-w-[160px] truncate px-3 py-2 text-sm">{doctor || '—'}</td>}
      {show('status') && (
        <td className="px-3 py-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass}`}>{st}</span>
        </td>
      )}
      {show('stage') && (
        <td className="px-3 py-2">
          {stage ? (
            <Badge variant="secondary" className={`text-[11px] ${stage.className}`}>
              {stage.label}
            </Badge>
          ) : (
            '—'
          )}
        </td>
      )}
      {show('mop') && (
        <td className="max-w-[120px] truncate px-3 py-2 text-sm">{normalizedText(lead.modeOfPayment, '—')}</td>
      )}
      {show('lastRemarks') && (
        <td className="max-w-[180px] truncate px-3 py-2 text-sm" title={lastRemarksText}>
          {lastRemarksText}
        </td>
      )}
      {show('newRemarks') && (
        <td className="max-w-[180px] truncate px-3 py-2 text-sm" title={newRemarksText}>
          {newRemarksText}
        </td>
      )}
      {show('followUpDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{formatTableDate(lead.followUpDate)}</td>
      )}
      {show('subStatus') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{lead.subStatus != null ? String(lead.subStatus) : '—'}</td>
      )}
      {show('surgeryDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{formatTableDate(lead.surgeryDate)}</td>
      )}
      {show('healthInsurance') && (
        <td className="max-w-[160px] truncate px-3 py-2 text-sm">{normalizedText(lead.insuranceName, '—')}</td>
      )}
      {show('preferredLocation') && (
        <td className="max-w-[160px] truncate px-3 py-2 text-sm">{preferredLocation}</td>
      )}
      {show('source') && <td className="max-w-[120px] truncate px-3 py-2 text-sm">{normalizedText(lead.source, '—')}</td>}
      {show('leadSource') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">
          {lead.leadSource != null && String(lead.leadSource).trim().length > 0 ? String(lead.leadSource) : '—'}
        </td>
      )}
      {show('createDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{formatTableDate(lead.createdDate)}</td>
      )}
      {show('modifyBy') && (
        <td className="max-w-[140px] truncate px-3 py-2 text-sm">{lead.updatedBy?.name ?? '—'}</td>
      )}
      {show('modifyDate') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{formatTableDate(lead.updatedDate)}</td>
      )}
      {show('dupCount') && (
        <td className="whitespace-nowrap px-3 py-2 text-sm">{lead.duplCount != null ? String(lead.duplCount) : '0'}</td>
      )}
      {show('recency') && (
        <td className="px-3 py-2">
          <LeadAgeBadge lead={lead} />
        </td>
      )}
      {show('bd') && <td className="max-w-[100px] truncate px-3 py-2 text-sm">{lead.bd?.name ?? '—'}</td>}
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
              onClick={(event) => {
                event.stopPropagation()
                onMarkOpened(lead.id)
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  )
})
