'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CallNotesPopover } from '@/components/pipeline/call-notes-popover'
import { BulkLeadReassignDialog } from '@/components/pipeline/bulk-lead-reassign-dialog'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { LeadEditDrawer } from '@/components/pipeline/lead-edit-drawer'
import { LeadAgeBadge } from '@/components/pipeline/lead-age-badge'
import { PipelineStatusCards } from '@/components/pipeline/pipeline-status-cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { apiGet, apiPost } from '@/lib/api-client'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { resolveLeadCity, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import {
  BulkLeadReassignmentRunResponse,
  isActiveBulkLeadReassignStatus,
} from '@/lib/lead-bulk-reassign/shared'
import { getStatusColor } from '@/lib/lead-status-colors'
import { hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import {
  getLeadAgeInfo,
  getLeadReceiptDate,
  normalizeLeadStatus,
  type LeadAgeFilter,
} from '@/lib/pipeline-lead-buckets'
import type { PipelineSortDir, PipelineSortField } from '@/lib/pipeline/server-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Menu,
  Pencil,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Suspense,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { toast } from 'sonner'
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

type NamedMasterItem = {
  id: string
  name: string
}

type MasterListResponse<TItem> = {
  items: TItem[]
}

type BulkLeadReassignOptionsResponse = {
  canBulkReassign: boolean
  assignableUsers: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
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

function mergeUniqueSortedLists(...lists: Array<readonly string[] | undefined>) {
  return uniqueSorted(lists.flatMap((list) => list ?? []))
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
  | 'leadRef'
  | 'assignDate'
  | 'leadDate'
  | 'patient'
  | 'month'
  | 'age'
  | 'sex'
  | 'circle'
  | 'city'
  | 'category'
  | 'treatment'
  | 'planningTreatment'
  | 'profession'
  | 'tl'
  // | 'bdm'
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
  { id: 'leadRef', label: 'Lead Ref', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'assignDate', label: 'Assign Date', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'leadDate', label: 'Lead Date', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'patient', label: 'Patient Name', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'month', label: 'Month', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'age', label: 'Age', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'sex', label: 'Sex', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'circle', label: 'Circle', defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'city', label: 'City', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'category', label: 'Category', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'treatment', label: 'Treatment', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'planningTreatment', label: 'Planning Treatment', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'profession', label: 'Profession', defaultVisible: { bd: false, 'team-lead': false } },
  { id: 'tl', label: 'TL', defaultVisible: { bd: false, 'team-lead': false } },
  // { id: 'bdm', label: 'BDM (Assign)', defaultVisible: { bd: false, 'team-lead': true } },
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

function isCashCaseStage(stage: Lead['caseStage']) {
  return [
    CaseStage.CASH_IPD_PENDING,
    CaseStage.CASH_IPD_SUBMITTED,
    CaseStage.CASH_ON_HOLD,
    CaseStage.CASH_APPROVED,
    CaseStage.CASH_IPD_DONE,
    CaseStage.CASH_DISCHARGED,
  ].includes(stage as CaseStage)
}

function getLeadStageBadge(lead: Lead) {
  if (!lead.caseStage) return null

  if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
    return hasLeadOpdScheduled(lead)
      ? getCaseStageBadgeConfig(String(lead.caseStage))
      : {
          className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
          label: 'OPD Schedule',
        }
  }

  return getCaseStageBadgeConfig(String(lead.caseStage))
}

function getLeadStageLabel(lead: Lead) {
  return getLeadStageBadge(lead)?.label ?? '—'
}

function getLeadLastRemarksText(lead: Lead) {
  return typeof lead.remarks === 'string' && lead.remarks.trim().length > 0 ? lead.remarks.trim() : '—'
}

function getLeadNewRemarksText(lead: Lead) {
  return typeof lead.latestRemark?.content === 'string' && lead.latestRemark.content.trim().length > 0
    ? lead.latestRemark.content.trim()
    : '—'
}

function getLeadPlanningTreatmentText(lead: Lead) {
  return typeof lead.diseaseDetails === 'string' && lead.diseaseDetails.trim().length > 0
    ? lead.diseaseDetails.trim()
    : '—'
}

function getLeadTeamLeadText(lead: Lead) {
  return (
    (typeof lead.plRecord?.managerName === 'string' && lead.plRecord.managerName.trim()) ||
    (lead.teamLeadId != null ? String(lead.teamLeadId) : '—')
  )
}

// function getLeadBdmText(lead: Lead) {
//   return typeof lead.plRecord?.bdmName === 'string' && lead.plRecord.bdmName.trim().length > 0
//     ? lead.plRecord.bdmName.trim()
//     : '—'
// }

function getPipelineColumnFilterValue(lead: Lead, columnId: PipelineColumnId): string {
  const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
  const preferredLocation = resolveLeadCity(lead) ?? normalizedText(lead.circle, '—')
  const receipt = getLeadReceiptDate(lead)

  switch (columnId) {
    case 'leadRef':
      return typeof lead.leadRef === 'string' || typeof lead.leadRef === 'number' ? String(lead.leadRef) : '—'
    case 'assignDate':
      return formatTableDate(lead.assignedDate)
    case 'leadDate':
      return receipt ? format(receipt, 'dd MMM yyyy') : '—'
    case 'patient':
      return typeof lead.patientName === 'string' ? lead.patientName : '—'
    case 'month':
      return formatMonthCell(lead.month)
    case 'age':
      return lead.age != null ? String(lead.age) : '—'
    case 'sex':
      return normalizedText(lead.sex, '—')
    case 'circle':
      return normalizedText(lead.circle, 'Unknown')
    case 'city':
      return resolveLeadCity(lead) ?? '—'
    case 'category':
      return normalizedText(lead.category, '—')
    case 'treatment':
      return normalizedText(lead.treatment, '—')
    case 'planningTreatment':
      return getLeadPlanningTreatmentText(lead)
    case 'profession':
      return normalizedText(lead.profession, '—')
    case 'tl':
      return getLeadTeamLeadText(lead)
    // case 'bdm':
    //   return getLeadBdmText(lead)
    case 'hospital':
      return hospital || '—'
    case 'doctor':
      return doctor || '—'
    case 'status':
      return normalizeLeadStatus(lead.status)
    case 'stage':
      return getLeadStageLabel(lead)
    case 'mop':
      return normalizedText(lead.modeOfPayment, '—')
    case 'lastRemarks':
      return getLeadLastRemarksText(lead)
    case 'newRemarks':
      return getLeadNewRemarksText(lead)
    case 'followUpDate':
      return formatTableDate(lead.followUpDate)
    case 'subStatus':
      return lead.subStatus != null ? String(lead.subStatus) : '—'
    case 'surgeryDate':
      return formatTableDate(lead.surgeryDate)
    case 'healthInsurance':
      return normalizedText(lead.insuranceName, '—')
    case 'preferredLocation':
      return preferredLocation
    case 'source':
      return normalizedText(lead.source, '—')
    case 'leadSource':
      return lead.leadSource != null && String(lead.leadSource).trim().length > 0 ? String(lead.leadSource) : '—'
    case 'createDate':
      return formatTableDate(lead.createdDate)
    case 'modifyBy':
      return lead.updatedBy?.name ?? '—'
    case 'modifyDate':
      return formatTableDate(lead.updatedDate)
    case 'dupCount':
      return lead.duplCount != null ? String(lead.duplCount) : '0'
    case 'recency':
      return getLeadAgeInfo(lead).label
    case 'bd':
      return lead.bd?.name ?? '—'
    default:
      return '—'
  }
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
  const queryClient = useQueryClient()
  useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { state, setState, campaignSelection } = usePipelineUrlState()
  const { data, isLoading, isFetching } = usePipelinePage()

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false)
  const [activeBulkReassignJobId, setActiveBulkReassignJobId] = useState<string | null>(null)
  const [handledBulkReassignTerminalKey, setHandledBulkReassignTerminalKey] = useState<string | null>(null)
  const [openedLeadIds, setOpenedLeadIds] = useState<string[]>(() => readOpenedPipelineLeadIds())
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState<Record<PipelineColumnId, boolean>>(() =>
    readPipelineVisibleColumns(variant)
  )

  const [searchInput, setSearchInput] = useState(state.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const availableColumns = useMemo(() => getPipelineColumnDefinitions(variant), [variant])
  const { data: bulkReassignOptions } = useQuery<BulkLeadReassignOptionsResponse>({
    queryKey: ['lead-bulk-reassign-options'],
    queryFn: () => apiGet<BulkLeadReassignOptionsResponse>('/api/leads/bulk-reassign'),
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const canBulkReassign = bulkReassignOptions?.canBulkReassign ?? false
  const {
    data: activeBulkReassignRun,
  } = useQuery<BulkLeadReassignmentRunResponse>({
    queryKey: ['lead-bulk-reassign-run', activeBulkReassignJobId],
    queryFn: () =>
      apiGet<BulkLeadReassignmentRunResponse>(
        `/api/leads/bulk-reassign/${activeBulkReassignJobId}`
      ),
    enabled: Boolean(activeBulkReassignJobId),
    retry: false,
    refetchInterval: (query) =>
      isActiveBulkLeadReassignStatus(query.state.data?.status ?? '') ? 2000 : false,
  })
  const visibleColumnCount = useMemo(
    () => availableColumns.filter((column) => visibleColumns[column.id]).length + 3 + (canBulkReassign ? 1 : 0),
    [availableColumns, canBulkReassign, visibleColumns]
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

  const { data: treatmentMasterData } = useQuery<MasterListResponse<NamedMasterItem>, Error>({
    queryKey: ['pipeline-master-filter', 'treatments'],
    queryFn: () => apiGet<MasterListResponse<NamedMasterItem>>('/api/masters/treatments?includeInactive=true'),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const { data: hospitalMasterData } = useQuery<MasterListResponse<NamedMasterItem>, Error>({
    queryKey: ['pipeline-master-filter', 'hospitals'],
    queryFn: () => apiGet<MasterListResponse<NamedMasterItem>>('/api/masters/hospitals?includeInactive=true'),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const { data: doctorMasterData } = useQuery<MasterListResponse<NamedMasterItem>, Error>({
    queryKey: ['pipeline-master-filter', 'doctors'],
    queryFn: () => apiGet<MasterListResponse<NamedMasterItem>>('/api/masters/doctors?includeInactive=true'),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const { data: insuranceMasterData } = useQuery<MasterListResponse<NamedMasterItem>, Error>({
    queryKey: ['pipeline-master-filter', 'insurance'],
    queryFn: () => apiGet<MasterListResponse<NamedMasterItem>>('/api/masters/insurance?includeInactive=true'),
    staleTime: 5 * 60_000,
    retry: false,
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
  const columnFilterOptions = useMemo(() => {
    const options = Object.fromEntries(
      availableColumns.map((column) => [
        column.id,
        uniqueSorted(rawPageLeads.map((lead) => getPipelineColumnFilterValue(lead, column.id))),
      ])
    ) as Record<PipelineColumnId, string[]>

    const treatmentMasterOptions = uniqueSorted(
      (treatmentMasterData?.items ?? []).map((item) => item.name)
    )
    const hospitalMasterOptions = uniqueSorted(
      (hospitalMasterData?.items ?? []).map((item) => item.name)
    )
    const doctorMasterOptions = uniqueSorted(
      (doctorMasterData?.items ?? []).map((item) => item.name)
    )
    const insuranceMasterOptions = uniqueSorted(
      (insuranceMasterData?.items ?? []).map((item) => item.name)
    )

    options.treatment = mergeUniqueSortedLists(treatmentMasterOptions, options.treatment)
    options.hospital = mergeUniqueSortedLists(hospitalMasterOptions, options.hospital)
    options.doctor = mergeUniqueSortedLists(doctorMasterOptions, options.doctor)
    options.healthInsurance = mergeUniqueSortedLists(insuranceMasterOptions, options.healthInsurance)

    return options
  }, [
    availableColumns,
    rawPageLeads,
    treatmentMasterData,
    hospitalMasterData,
    doctorMasterData,
    insuranceMasterData,
  ])

  const getHeaderFilterProps = useCallback(
    (columnId: PipelineColumnId) => ({
      filterValue: columnFilters[columnId] ?? [],
      filterOptions: columnFilterOptions[columnId] ?? [],
      onFilterChange: (values: string[]) => handleColumnFilterChange(columnId, values),
    }),
    [columnFilterOptions, columnFilters, handleColumnFilterChange]
  )

  // Apply column filters on top of the current page's rows.
  const tableRows: Lead[] = useMemo(
    () =>
      availableColumns.reduce<Lead[]>((result, column) => {
        const selected = columnFilters[column.id]
        if (!selected?.length) {
          return result
        }

        return result.filter((lead) =>
          selected.includes(getPipelineColumnFilterValue(lead, column.id))
        )
      }, rawPageLeads),
    [availableColumns, rawPageLeads, columnFilters]
  )

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

  const handleEditDrawerChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingLeadId(null)
    }
  }, [])

  const toggleLeadSelection = useCallback((leadId: string, checked: boolean) => {
    setSelectedLeadIds((current) => {
      if (checked) {
        return current.includes(leadId) ? current : [...current, leadId]
      }

      return current.filter((id) => id !== leadId)
    })
  }, [])

  const visibleSelectedLeadIds = useMemo(
    () => selectedLeadIds.filter((leadId) => tableRows.some((lead) => lead.id === leadId)),
    [selectedLeadIds, tableRows]
  )
  const selectedLeads = useMemo(
    () => tableRows.filter((lead) => visibleSelectedLeadIds.includes(lead.id)),
    [tableRows, visibleSelectedLeadIds]
  )
  const bulkLeadOptions = useMemo(
    () =>
      tableRows.map((lead) => ({
        id: lead.id,
        leadRef: lead.leadRef || undefined,
        patientName: lead.patientName || undefined,
      })),
    [tableRows]
  )
  const allVisibleSelected = tableRows.length > 0 && tableRows.every((lead) => visibleSelectedLeadIds.includes(lead.id))
  const someVisibleSelected = tableRows.some((lead) => visibleSelectedLeadIds.includes(lead.id))

  const bulkReassignMutation = useMutation({
    mutationFn: (payload: {
      bdUserIds: string[]
      removePreviousRemarks: boolean
      subStatus?: number
      pauseSeconds?: number
    }) =>
      apiPost<BulkLeadReassignmentRunResponse>('/api/leads/bulk-reassign', {
        leadIds: visibleSelectedLeadIds,
        ...payload,
      }),
    onSuccess: (run) => {
      toast.success('Bulk reassignment queued')
      setActiveBulkReassignJobId(run.jobId)
      setHandledBulkReassignTerminalKey(null)
      queryClient.setQueryData(['lead-bulk-reassign-run', run.jobId], run)
      setBulkReassignOpen(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to queue bulk reassignment')
    },
  })

  useEffect(() => {
    if (!activeBulkReassignRun) return

    const terminalKey = `${activeBulkReassignRun.id}:${activeBulkReassignRun.status}`
    if (terminalKey === handledBulkReassignTerminalKey) return

    if (activeBulkReassignRun.status === 'completed') {
      toast.success(
        `Bulk reassignment completed for ${activeBulkReassignRun.totalLeads} lead${activeBulkReassignRun.totalLeads === 1 ? '' : 's'}`
      )
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      startTransition(() => {
        setSelectedLeadIds([])
        setHandledBulkReassignTerminalKey(terminalKey)
      })
      return
    }

    if (activeBulkReassignRun.status === 'failed') {
      toast.error(activeBulkReassignRun.errorMessage || 'Bulk reassignment failed')
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      startTransition(() => {
        setHandledBulkReassignTerminalKey(terminalKey)
      })
    }
  }, [activeBulkReassignRun, handledBulkReassignTerminalKey, queryClient])

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
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canBulkReassign ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkReassignOpen(true)}
                        >
                          Bulk Reassign
                          {visibleSelectedLeadIds.length > 0 ? ` (${visibleSelectedLeadIds.length})` : ''}
                        </Button>
                        {visibleSelectedLeadIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLeadIds([])}
                          >
                            Clear selection
                          </Button>
                        ) : null}
                      </>
                    ) : null}
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
                      <thead className="sticky top-0 z-10 bg-background [&_tr]:border-b">
                        <tr className="border-b bg-background">
                          {canBulkReassign ? (
                            <th className="h-10 w-12 px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                                  onCheckedChange={(checked) =>
                                    setSelectedLeadIds(
                                      checked === true ? tableRows.map((lead) => lead.id) : []
                                    )
                                  }
                                  aria-label="Select visible leads"
                                />
                              </div>
                            </th>
                          ) : null}
                          <th className="h-10 w-12 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Flow
                          </th>
                          {isColumnVisible('leadRef') && (
                            <HeaderCell
                              label="Lead Ref"
                              sortField="leadRef"
                              state={state}
                              onSort={handleSort}
                              {...getHeaderFilterProps('leadRef')}
                            />
                          )}
                          {isColumnVisible('assignDate') && <HeaderCell label="Assign Date" {...getHeaderFilterProps('assignDate')} />}
                          {isColumnVisible('leadDate') && (
                            <HeaderCell label="Lead Date" sortField="date" state={state} onSort={handleSort} {...getHeaderFilterProps('leadDate')} />
                          )}
                          {isColumnVisible('patient') && (
                            <HeaderCell
                              label="Patient Name"
                              sortField="patient"
                              state={state}
                              onSort={handleSort}
                              {...getHeaderFilterProps('patient')}
                            />
                          )}
                          {isColumnVisible('month') && <HeaderCell label="Month" {...getHeaderFilterProps('month')} />}
                          {isColumnVisible('age') && <HeaderCell label="Age" {...getHeaderFilterProps('age')} />}
                          {isColumnVisible('sex') && <HeaderCell label="Sex" {...getHeaderFilterProps('sex')} />}
                          {isColumnVisible('circle') && (
                            <HeaderCell
                              label="Circle"
                              {...getHeaderFilterProps('circle')}
                            />
                          )}
                          {isColumnVisible('city') && <HeaderCell label="City" {...getHeaderFilterProps('city')} />}
                          {isColumnVisible('category') && (
                            <HeaderCell
                              label="Category"
                              {...getHeaderFilterProps('category')}
                            />
                          )}
                          {isColumnVisible('treatment') && (
                            <HeaderCell
                              label="Treatment"
                              {...getHeaderFilterProps('treatment')}
                            />
                          )}
                          {isColumnVisible('planningTreatment') && <HeaderCell label="Planning Treatment" {...getHeaderFilterProps('planningTreatment')} />}
                          {isColumnVisible('profession') && <HeaderCell label="Profession" {...getHeaderFilterProps('profession')} />}
                          {isColumnVisible('tl') && <HeaderCell label="TL" {...getHeaderFilterProps('tl')} />}
                          {/* {isColumnVisible('bdm') && (
                            <HeaderCell
                              label="BDM (Assign)"
                              {...getHeaderFilterProps('bdm')}
                            />
                          )} */}
                          {isColumnVisible('hospital') && (
                            <HeaderCell
                              label="Hospital"
                              {...getHeaderFilterProps('hospital')}
                            />
                          )}
                          {isColumnVisible('doctor') && (
                            <HeaderCell
                              label="Doctor"
                              {...getHeaderFilterProps('doctor')}
                            />
                          )}
                          {isColumnVisible('status') && (
                            <HeaderCell
                              label="Status"
                              sortField="status"
                              state={state}
                              onSort={handleSort}
                              {...getHeaderFilterProps('status')}
                            />
                          )}
                          {isColumnVisible('stage') && (
                            <HeaderCell
                              label="Stage"
                              {...getHeaderFilterProps('stage')}
                            />
                          )}
                          {isColumnVisible('mop') && <HeaderCell label="MOP" {...getHeaderFilterProps('mop')} />}
                          {isColumnVisible('lastRemarks') && <HeaderCell label="Last Remarks" {...getHeaderFilterProps('lastRemarks')} />}
                          {isColumnVisible('newRemarks') && <HeaderCell label="New Remarks" {...getHeaderFilterProps('newRemarks')} />}
                          {isColumnVisible('followUpDate') && <HeaderCell label="Follow Up Date" {...getHeaderFilterProps('followUpDate')} />}
                          {isColumnVisible('subStatus') && <HeaderCell label="Sub Status" {...getHeaderFilterProps('subStatus')} />}
                          {isColumnVisible('surgeryDate') && <HeaderCell label="Surgery Date" {...getHeaderFilterProps('surgeryDate')} />}
                          {isColumnVisible('healthInsurance') && <HeaderCell label="Health Insurance" {...getHeaderFilterProps('healthInsurance')} />}
                          {isColumnVisible('preferredLocation') && <HeaderCell label="Preferred Location" {...getHeaderFilterProps('preferredLocation')} />}
                          {isColumnVisible('source') && <HeaderCell label="Source" {...getHeaderFilterProps('source')} />}
                          {isColumnVisible('leadSource') && <HeaderCell label="Lead Source" {...getHeaderFilterProps('leadSource')} />}
                          {isColumnVisible('createDate') && <HeaderCell label="Create Date" {...getHeaderFilterProps('createDate')} />}
                          {isColumnVisible('modifyBy') && <HeaderCell label="Modify By" {...getHeaderFilterProps('modifyBy')} />}
                          {isColumnVisible('modifyDate') && <HeaderCell label="Modify Date" {...getHeaderFilterProps('modifyDate')} />}
                          {isColumnVisible('dupCount') && <HeaderCell label="Dupl Count" {...getHeaderFilterProps('dupCount')} />}
                          {isColumnVisible('recency') && <HeaderCell label="Recency" {...getHeaderFilterProps('recency')} />}
                          {isColumnVisible('bd') && (
                            <HeaderCell
                              label="BD"
                              sortField="bd"
                              state={state}
                              onSort={handleSort}
                              {...getHeaderFilterProps('bd')}
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
                            onMarkOpened={markLeadOpened}
                            isOpened={openedLeadIds.includes(lead.id)}
                            selectionEnabled={canBulkReassign}
                            isSelected={selectedLeadIds.includes(lead.id)}
                            onToggleSelected={toggleLeadSelection}
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
        <BulkLeadReassignDialog
          open={bulkReassignOpen}
          onOpenChange={setBulkReassignOpen}
          leadOptions={bulkLeadOptions}
          selectedLeadIds={visibleSelectedLeadIds}
          onSelectedLeadIdsChange={setSelectedLeadIds}
          selectedLeads={selectedLeads}
          assignableUsers={bulkReassignOptions?.assignableUsers ?? []}
          isPending={bulkReassignMutation.isPending}
          onSubmit={(payload) => bulkReassignMutation.mutateAsync(payload)}
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

function canShowPipelineOpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (isCashCaseStage(lead.caseStage)) {
    return [
      CaseStage.CASH_IPD_PENDING,
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ].includes(lead.caseStage)
  }

  return [
    CaseStage.NEW_LEAD,
    CaseStage.KYP_BASIC_PENDING,
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
  if (!lead.caseStage || isCashCaseStage(lead.caseStage)) return false
  if (lead.caseStage === CaseStage.KYP_BASIC_COMPLETE) return true
  if (![CaseStage.NEW_LEAD, CaseStage.KYP_BASIC_PENDING].includes(lead.caseStage)) return false
  return hasLeadOpdScheduled(lead)
}

function canShowPipelinePreAuthRaised(lead: Lead) {
  return !isCashCaseStage(lead.caseStage) && lead.caseStage === CaseStage.HOSPITALS_SUGGESTED
}

function canShowPipelineIpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (isCashCaseStage(lead.caseStage)) {
    if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
      return hasLeadOpdScheduled(lead)
    }

    return [
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ].includes(lead.caseStage)
  }

  return [CaseStage.PREAUTH_COMPLETE, CaseStage.INITIATED, CaseStage.ADMITTED].includes(lead.caseStage)
}

function getPipelineIpdScheduleHref(lead: Lead) {
  return isCashCaseStage(lead.caseStage) || lead.flowType === 'CASH'
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

  if (canShowPipelineOpdSchedule(lead)) {
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

  if (canShowPipelineIpdSchedule(lead)) {
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
  onMarkOpened,
  isOpened,
  selectionEnabled,
  isSelected,
  onToggleSelected,
  visibleColumns,
}: {
  lead: Lead
  returnTo: string
  noteCount?: number
  onClick: (id: string) => void
  onEdit: (id: string) => void
  onMarkOpened: (id: string) => void
  isOpened: boolean
  selectionEnabled: boolean
  isSelected: boolean
  onToggleSelected: (leadId: string, checked: boolean) => void
  visibleColumns: Record<PipelineColumnId, boolean>
}) {
  const stage = getLeadStageBadge(lead)
  const st = normalizeLeadStatus(lead.status)
  const sc = getStatusColor(st)
  const statusClass = isOpened
    ? 'bg-[#DCE8FF] text-[#17337A] ring-1 ring-[#AFC4FF] dark:bg-[#31456F] dark:text-[#F5F8FF] dark:ring-[#5D7CC7]'
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
  // const bdmText =
  //   typeof lead.plRecord?.bdmName === 'string' && lead.plRecord.bdmName.trim().length > 0
  //     ? lead.plRecord.bdmName.trim()
  //     : '—'
  const show = (columnId: PipelineColumnId) => visibleColumns[columnId] === true

  return (
    <tr
      className={cn(
        'cursor-pointer border-b border-border/60 transition-colors',
        isOpened
          ? 'bg-[#E4EEFF] hover:bg-[#D9E7FF] shadow-[inset_0_1px_0_0_rgba(175,196,255,0.9),inset_0_-1px_0_0_rgba(175,196,255,0.9)] dark:bg-[#2A3B60] dark:hover:bg-[#334874] dark:shadow-[inset_0_1px_0_0_rgba(93,124,199,0.95),inset_0_-1px_0_0_rgba(93,124,199,0.95)]'
          : 'hover:bg-muted/50'
      )}
      onClick={() => onClick(lead.id)}
    >
      {selectionEnabled ? (
        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggleSelected(lead.id, checked === true)}
              aria-label={`Select lead ${leadRefText}`}
            />
          </div>
        </td>
      ) : null}
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
      {show('leadRef') && (
        <td className="px-3 py-2 font-medium" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="truncate max-w-[120px] text-left text-primary hover:underline sm:max-w-[160px]"
              title={leadRefText}
              onClick={() => onEdit(lead.id)}
            >
              {leadRefText}
            </button>
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
      {/* {show('bdm') && <td className="max-w-[120px] truncate px-3 py-2 text-sm">{bdmText}</td>} */}
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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            onClick={() => onEdit(lead.id)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
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
