'use client'

import { DataTable } from '@/components/ui/data-table'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CallNotesPopover } from '@/components/pipeline/call-notes-popover'
import { BulkLeadReassignDialog } from '@/components/pipeline/bulk-lead-reassign-dialog'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { LeadEditDrawer } from '@/components/pipeline/lead-edit-drawer'
import { LeadAgeBadge } from '@/components/pipeline/lead-age-badge'
import { ManualLeadCreateDialog } from '@/components/pipeline/manual-lead-create-dialog'
import { PipelineStatusCards } from '@/components/pipeline/pipeline-status-cards'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { CaseStage } from '@/generated/prisma/enums'
import { useAuth } from '@/hooks/use-auth'
import { usePipelinePage, usePipelineUrlState } from '@/hooks/use-pipeline'
import type { Lead } from '@/hooks/use-leads'
import { apiGet, apiPost } from '@/lib/api-client'
import { CASE_STAGE_CONFIG, getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { resolveLeadCity, resolveLeadHospitalDoctor, resolveLeadSourceDisplay } from '@/lib/lead-display'
import {
  BulkLeadReassignmentRunResponse,
  isActiveBulkLeadReassignStatus,
} from '@/lib/lead-bulk-reassign/shared'
import { getStatusColor } from '@/lib/lead-status-colors'
import { CRM_LEAD_STATUS_OPTIONS, CRM_MODE_OF_PAYMENT_OPTIONS } from '@/lib/lead-status-options'
import { hasLeadOpdDone, hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import {
  getLeadAgeInfo,
  getLeadReceiptDate,
  normalizeLeadStatus,
  type LeadAgeFilter,
} from '@/lib/pipeline-lead-buckets'
import type {
  PipelineMultiColumnFilterField,
  PipelineServerColumnFilter,
  PipelineSortDir,
  PipelineSortField,
} from '@/lib/pipeline/server-query'
import {
  PIPELINE_MONTH_FILTER_OPTIONS,
  normalizePipelineSexValue,
  normalizePipelineMonthValue,
} from '@/lib/pipeline/filter-normalizers'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  CalendarClock,
  CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  GripVertical,
  HeartCrack,
  Loader2,
  MapPinOff,
  Menu,
  Pencil,
  PhoneCall,
  PhoneOff,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Sprout,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500]

interface StatusBadgeConfig {
  label: string
  icon: LucideIcon
  className: string
  iconClass: string
}

function getStatusBadgeConfig(status: string | null | undefined): StatusBadgeConfig {
  const norm = normalizeLeadStatus(status)
  const lower = norm.toLowerCase()

  if (lower.includes('callback')) {
    return {
      label: norm,
      icon: PhoneCall,
      className: 'bg-[#FFF7ED] dark:bg-amber-950/40 text-[#C2410C] dark:text-amber-300 border-[#FDBA74]/80 dark:border-amber-800/60',
      iconClass: 'text-[#EA580C] dark:text-amber-400',
    }
  }
  if (lower.includes('junk')) {
    return {
      label: norm,
      icon: Trash2,
      className: 'bg-[#F1F5F9] dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 border-[#CBD5E1] dark:border-slate-700',
      iconClass: 'text-[#64748B] dark:text-slate-400',
    }
  }
  if (lower.includes('dnp') || lower.includes('did not pick') || lower.includes('not connected')) {
    return {
      label: norm,
      icon: PhoneOff,
      className: 'bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E11D48] dark:text-rose-300 border-[#FECDD3] dark:border-rose-800/60',
      iconClass: 'text-[#F43F5E] dark:text-rose-400',
    }
  }
  if (
    lower.includes('ipd sch') ||
    lower.includes('opd sch') ||
    lower.includes('schedule') ||
    lower.includes('appointment')
  ) {
    return {
      label: norm,
      icon: CalendarClock,
      className: 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#047857] dark:text-emerald-300 border-[#A7F3D0] dark:border-emerald-800/60',
      iconClass: 'text-[#059669] dark:text-emerald-400',
    }
  }
  if (lower.includes('follow') || lower.includes('interested') || lower.includes('hot')) {
    return {
      label: norm,
      icon: PhoneCall,
      className: 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#047857] dark:text-emerald-300 border-[#A7F3D0] dark:border-emerald-800/60',
      iconClass: 'text-[#059669] dark:text-emerald-400',
    }
  }
  if (lower.includes('new')) {
    return {
      label: norm,
      icon: Sparkles,
      className: 'bg-[#EFF6FF] dark:bg-sky-950/40 text-[#1D4ED8] dark:text-sky-300 border-[#BFDBFE] dark:border-sky-800/60',
      iconClass: 'text-[#2563EB] dark:text-sky-400',
    }
  }
  if (lower.includes('done') || lower.includes('closed') || lower.includes('won')) {
    return {
      label: norm,
      icon: CheckCircle2,
      className: 'bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#15803D] dark:text-emerald-300 border-[#BBF7D0] dark:border-emerald-800/60',
      iconClass: 'text-[#16A34A] dark:text-emerald-400',
    }
  }
  if (lower.includes('fund') || lower.includes('finance')) {
    return {
      label: norm,
      icon: Banknote,
      className: 'bg-[#F0FDFA] dark:bg-teal-950/40 text-[#0F766E] dark:text-teal-300 border-[#99F6E4] dark:border-teal-800/60',
      iconClass: 'text-[#0D9488] dark:text-teal-400',
    }
  }
  if (lower.includes('duplicate')) {
    return {
      label: norm,
      icon: Copy,
      className: 'bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E11D48] dark:text-rose-300 border-[#FECDD3] dark:border-rose-800/60',
      iconClass: 'text-[#F43F5E] dark:text-rose-400',
    }
  }
  if (lower.includes('outstation')) {
    return {
      label: norm,
      icon: MapPinOff,
      className: 'bg-[#FFFBEB] dark:bg-amber-950/40 text-[#B45309] dark:text-amber-300 border-[#FDE68A] dark:border-amber-800/60',
      iconClass: 'text-[#D97706] dark:text-amber-400',
    }
  }
  if (lower.includes('loss') || lower.includes('lost')) {
    return {
      label: norm,
      icon: HeartCrack,
      className: 'bg-[#FFF1F2] dark:bg-rose-950/40 text-[#E11D48] dark:text-rose-300 border-[#FECDD3] dark:border-rose-800/60',
      iconClass: 'text-[#F43F5E] dark:text-rose-400',
    }
  }
  if (lower.includes('nurture')) {
    return {
      label: norm,
      icon: Sprout,
      className: 'bg-[#FAF5FF] dark:bg-purple-950/40 text-[#7E22CE] dark:text-purple-300 border-[#E9D5FF] dark:border-purple-800/60',
      iconClass: 'text-[#9333EA] dark:text-purple-400',
    }
  }

  return {
    label: norm,
    icon: CheckCircle2,
    className: 'bg-[#F8FAFC] dark:bg-slate-900/50 text-[#334155] dark:text-slate-300 border-[#E2E8F0] dark:border-slate-800',
    iconClass: 'text-[#64748B] dark:text-slate-400',
  }
}

const PIPELINE_STATUS_FILTER_OPTIONS = Array.from(
  new Set([
    ...CRM_LEAD_STATUS_OPTIONS,
    'Follow-up 4',
    'Follow-up 5',
    'Call Done',
    'Already Insured',
    'Policy Booked',
    'Policy Issued',
    'Lost',
    'Churned',
    'C/W Done',
    'WA Done',
    'Scan Done',
  ].map((status) => normalizeLeadStatus(status)))
)
const PIPELINE_MOP_FILTER_OPTIONS = [...CRM_MODE_OF_PAYMENT_OPTIONS]
const PIPELINE_RECENCY_FILTER_OPTIONS = ['New', '< 1 month', '1 month', '2 months', '3+ months', 'Unknown']
const PIPELINE_STAGE_FILTER_OPTIONS = uniqueSorted([
  'OPD Schedule',
  'OPD Done',
  ...Object.values(CASE_STAGE_CONFIG).map((stage) => stage.label),
])

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
const PIPELINE_COLUMN_ORDER_STORAGE_KEY_PREFIX = 'crm-pipeline-col-order'

const PIPELINE_COLUMN_DEFINITIONS: PipelineColumnDefinition[] = [
  { id: 'leadRef', label: 'Lead Ref', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'assignDate', label: 'Assign Date', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'leadDate', label: 'Lead Date', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'patient', label: 'Patient Name', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'month', label: 'Month', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'age', label: 'Age', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'sex', label: 'Sex', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'circle', label: 'Circle', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'city', label: 'City', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'category', label: 'Category', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'treatment', label: 'Treatment', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'tl', label: 'Team Lead', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'bd', label: 'BDM', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'lastRemarks', label: 'Last Remark', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'status', label: 'Lead Status', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'followUpDate', label: 'Follow Up Date', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'mop', label: 'MOP', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'surgeryDate', label: 'Surgery Date', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'planningTreatment', label: 'Planning Treatment', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'subStatus', label: 'Sub Status', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'healthInsurance', label: 'Health Insurance', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'preferredLocation', label: 'Preferred Location', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'profession', label: 'Profession', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'source', label: 'Source', variants: ['team-lead'], defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'leadSource', label: 'Lead Source', variants: ['team-lead'], defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'createDate', label: 'Create Date', variants: ['team-lead'], defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'modifyBy', label: 'Modify By', variants: ['team-lead'], defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'modifyDate', label: 'Modified Date', variants: ['team-lead'], defaultVisible: { bd: false, 'team-lead': true } },
  { id: 'dupCount', label: 'Duplicate Count', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'stage', label: 'Stage', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'hospital', label: 'Hospital', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'doctor', label: 'Doctor', defaultVisible: { bd: true, 'team-lead': true } },
  { id: 'recency', label: 'Recency', defaultVisible: { bd: true, 'team-lead': true } },
]

const PIPELINE_DATE_FILTER_COLUMNS = new Set<PipelineColumnId>([
  'assignDate',
  'leadDate',
  'followUpDate',
  'surgeryDate',
  'createDate',
  'modifyDate',
])

const PIPELINE_SERVER_FILTER_COLUMNS = new Set<PipelineColumnId>([
  'assignDate',
  'leadDate',
  'month',
  'circle',
  'category',
  'treatment',
  'tl',
  'bd',
  'status',
  'followUpDate',
  'stage',
  'mop',
  'source',
  'leadSource',
  'surgeryDate',
  'createDate',
  'modifyDate',
  'subStatus',
  'hospital',
  'doctor',
  'recency',
])

function getPipelineColumnDefinitions(variant: 'bd' | 'team-lead') {
  return PIPELINE_COLUMN_DEFINITIONS.filter(
    (column) => !column.variants || column.variants.includes(variant)
  )
}

function isPipelineDateFilterColumn(columnId: PipelineColumnId) {
  return PIPELINE_DATE_FILTER_COLUMNS.has(columnId)
}

function isPipelineServerFilterColumn(columnId: PipelineColumnId) {
  return PIPELINE_SERVER_FILTER_COLUMNS.has(columnId)
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

function readPipelineColumnOrder(variant: 'bd' | 'team-lead'): PipelineColumnId[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(`${PIPELINE_COLUMN_ORDER_STORAGE_KEY_PREFIX}:${variant}`)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    const validIds = new Set(getPipelineColumnDefinitions(variant).map((column) => column.id))
    return parsed.filter((id): id is PipelineColumnId => typeof id === 'string' && validIds.has(id as PipelineColumnId))
  } catch {
    return []
  }
}

function writePipelineColumnOrder(
  variant: 'bd' | 'team-lead',
  order: PipelineColumnId[]
) {
  if (typeof window === 'undefined') return

  try {
    if (!order || order.length === 0) {
      window.localStorage.removeItem(`${PIPELINE_COLUMN_ORDER_STORAGE_KEY_PREFIX}:${variant}`)
    } else {
      window.localStorage.setItem(
        `${PIPELINE_COLUMN_ORDER_STORAGE_KEY_PREFIX}:${variant}`,
        JSON.stringify(order)
      )
    }
  } catch {
    // Ignore storage write failures. Column ordering is best-effort only.
  }
}

function formatTableDate(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0
  return hasTime ? format(parsed, 'dd MMM yyyy, hh:mm a') : format(parsed, 'dd MMM yyyy')
}

function formatTableDateTime(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : format(parsed, 'dd MMM yyyy, hh:mm a')
}

function renderTableDateTime(value: unknown, customColorClass?: string) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    return <span className="text-muted-foreground text-xs">{String(value)}</span>
  }
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0
  const dateStr = format(parsed, 'dd MMM yyyy')
  const timeStr = hasTime ? format(parsed, 'hh:mm a') : null

  return (
    <div className="flex flex-col gap-0.5 text-xs text-left">
      <span className={cn("font-medium whitespace-nowrap text-[13px] text-foreground/90", customColorClass)}>
        {dateStr}
      </span>
      {timeStr && (
        <span className={cn("font-medium whitespace-nowrap text-[12px] text-muted-foreground/90", customColorClass)}>
          {timeStr}
        </span>
      )}
    </div>
  )
}


function isPastFollowUpDate(value: unknown) {
  if (!value) return false
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return false

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return parsed.getTime() < startOfToday.getTime()
}

function formatMonthCell(value: unknown) {
  if (!value) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  return formatTableDate(value)
}

function isCashCaseStage(stage: Lead['caseStage']) {
  return ([
    CaseStage.CASH_IPD_PENDING,
    CaseStage.CASH_OPD_SCHEDULED,
    CaseStage.CASH_OPD_DONE,
    CaseStage.CASH_IPD_SUBMITTED,
    CaseStage.CASH_ON_HOLD,
    CaseStage.CASH_APPROVED,
    CaseStage.CASH_IPD_DONE,
    CaseStage.CASH_DISCHARGED,
  ] as CaseStage[]).includes(stage as CaseStage)
}

function getLeadStageBadge(lead: Lead) {
  if (!lead.caseStage) return null

  if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
    if (hasLeadOpdDone(lead)) {
      return {
        className: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
        label: 'OPD Done',
      }
    }

    return hasLeadOpdScheduled(lead)
      ? {
        className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
        label: 'OPD Schedule',
      }
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

function stripRemarkMetadataPrefix(value: string) {
  return value.replace(
    /^\s*.+?\s+on\s+\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}:\s*/i,
    ''
  )
}

function getLeadLastRemarkDetails(lead: Lead): { dateText: string | null; content: string } {
  const remarkObj = lead.latestRemark
  const candidate =
    typeof remarkObj?.content === 'string' && remarkObj.content.trim().length > 0
      ? remarkObj.content
      : typeof lead.remarks === 'string'
        ? lead.remarks
        : null

  if (candidate == null) return { dateText: null, content: '—' }
  const trimmed = stripRemarkMetadataPrefix(candidate.trim()).trim()
  if (!trimmed) return { dateText: null, content: '—' }

  const dateValue = remarkObj?.createdAt ?? lead.updatedDate ?? lead.createdDate
  let dateText: string | null = null
  if (dateValue) {
    const d = new Date(dateValue)
    if (!Number.isNaN(d.getTime())) {
      dateText = format(d, 'dd MMM yyyy, hh:mm a')
    }
  }

  return { dateText, content: trimmed }
}

function getLeadLastRemarksText(lead: Lead) {
  const { dateText, content } = getLeadLastRemarkDetails(lead)
  if (content === '—') return '—'
  return dateText ? `${dateText}  ${content}` : content
}

function getLeadPlanningTreatmentText(lead: Lead) {
  if (!lead.ipdPotentialDate) return '—'
  const parsed = new Date(String(lead.ipdPotentialDate))
  return Number.isNaN(parsed.getTime()) ? String(lead.ipdPotentialDate) : format(parsed, 'dd MMM yyyy')
}

function getLeadTeamLeadText(lead: Lead) {
  return (
    (typeof lead.plRecord?.managerName === 'string' && lead.plRecord.managerName.trim()) ||
    (lead.teamLeadId != null ? String(lead.teamLeadId) : '—')
  )
}

function getLeadSurgeryDateValue(lead: Lead) {
  return lead.surgeryDate ?? lead.admissionRecord?.surgeryDate ?? null
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
      return formatTableDateTime(lead.assignedDate)
    case 'leadDate':
      return receipt ? format(receipt, 'dd MMM yyyy, hh:mm a') : '—'
    case 'patient':
      return typeof lead.patientName === 'string' ? lead.patientName : '—'
    case 'month':
      return normalizePipelineMonthValue(lead.month)
    case 'age':
      return lead.age != null ? String(lead.age) : '—'
    case 'sex':
      return normalizePipelineSexValue(lead.sex)
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
      return normalizedText(normalizeModeOfPaymentLabel(lead.modeOfPayment), '—')
    case 'lastRemarks':
      return getLeadLastRemarksText(lead)
    case 'followUpDate':
      return formatTableDate(lead.followUpDate)
    case 'subStatus':
      return lead.subStatus != null ? String(lead.subStatus) : '—'
    case 'surgeryDate':
      return formatTableDate(getLeadSurgeryDateValue(lead))
    case 'healthInsurance':
      return normalizedText(lead.insuranceName, '—')
    case 'preferredLocation':
      return preferredLocation
    case 'source':
      return normalizedText(lead.source, '—')
    case 'leadSource':
      return resolveLeadSourceDisplay(lead)
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
  const title = variant === 'bd' ? 'CRM' : 'Team CRM'
  const subtitle = 'Manage, track & convert leads across all pipelines'
  return (
    <AuthenticatedLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background overflow-hidden -mt-4 md:-mt-6 -mx-4 md:-mx-6 -mb-24 md:-mb-6">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-1.5 backdrop-blur-md dark:bg-background/90 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3 text-right">
              {/* Month Selector Dropdown (Disabled during loading) */}
              <Select value="all" disabled>
                <SelectTrigger className="w-[130px] h-9 text-xs bg-background/80 border-zinc-400 dark:border-zinc-500 rounded-xl shadow-xs font-semibold">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="all">All Months</SelectItem>
                </SelectContent>
              </Select>

              {/* Flashy Teal Banner: Total Leads */}
              <div className="relative overflow-hidden flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-teal-500/20 dark:from-teal-950/60 dark:via-emerald-950/40 dark:to-teal-900/50 border border-teal-500/30 dark:border-teal-500/40 rounded-xl shadow-md shadow-teal-500/10 min-w-[240px] sm:min-w-[280px] backdrop-blur-md">
                <div className="relative flex flex-col text-left flex-1 min-w-0 pr-3">
                  <span className="text-[10px] font-black tracking-widest uppercase text-teal-700 dark:text-teal-300 leading-none mb-1">
                    Total Leads
                  </span>
                  <Skeleton className="h-5 w-20 bg-teal-500/20 rounded-md" />
                </div>
                <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/30 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col pt-1.5 px-3 pb-2 md:pt-1.5 md:px-4 md:pb-3 overflow-hidden">
          <PipelineStatusCards selected="all" onSelect={() => { }} isLoading />
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

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null)
  const handleInitiateCall = useCallback(async (targetLead: Lead) => {
    const patientName = targetLead.patientName || 'patient'
    try {
      setCallingLeadId(targetLead.id)
      toast.info(`Initiating Knowlarity call for ${patientName}...`)
      await apiPost(`/api/leads/${targetLead.id}/make-call`, {})
      toast.success(`Knowlarity call initiated for ${patientName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate call via Knowlarity')
    } finally {
      setCallingLeadId(null)
    }
  }, [])

  const [bulkReassignOpen, setBulkReassignOpen] = useState(false)
  const [manualLeadCreateOpen, setManualLeadCreateOpen] = useState(false)
  const [activeBulkReassignJobId, setActiveBulkReassignJobId] = useState<string | null>(null)
  const [handledBulkReassignTerminalKey, setHandledBulkReassignTerminalKey] = useState<string | null>(null)
  const [optimisticallyOpenedLeadIds, setOptimisticallyOpenedLeadIds] = useState<string[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [visibleColumns, setVisibleColumns] = useState<Record<PipelineColumnId, boolean>>(() =>
    readPipelineVisibleColumns(variant)
  )
  const [columnOrder, setColumnOrder] = useState<PipelineColumnId[]>(() =>
    readPipelineColumnOrder(variant)
  )

  const availableColumns = useMemo(() => getPipelineColumnDefinitions(variant), [variant])
  const orderedAvailableColumnIds = useMemo(() => {
    const defaultIds = availableColumns.map((c) => c.id)
    if (!columnOrder.length) return defaultIds
    const set = new Set(columnOrder)
    const missing = defaultIds.filter((id) => !set.has(id))
    return [...columnOrder.filter((id) => defaultIds.includes(id)), ...missing]
  }, [availableColumns, columnOrder])

  // Drag-to-reorder state for the Columns dropdown
  const [pipelineDraggingColId, setPipelineDraggingColId] = useState<string | null>(null)
  const [pipelineDropIndicator, setPipelineDropIndicator] = useState<{ id: string; position: 'top' | 'bottom' } | null>(null)
  const dragColRef = useRef<string | null>(null)
  const dropTargetColRef = useRef<{ id: string; position: 'top' | 'bottom' } | null>(null)

  const handleColDragStart = (e: React.DragEvent, id: string) => {
    dragColRef.current = id
    setPipelineDraggingColId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleColDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragColRef.current === id) {
      if (pipelineDropIndicator) setPipelineDropIndicator(null)
      dropTargetColRef.current = null
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: 'top' | 'bottom' = e.clientY < midY ? 'top' : 'bottom'

    if (!dropTargetColRef.current || dropTargetColRef.current.id !== id || dropTargetColRef.current.position !== position) {
      const target = { id, position }
      dropTargetColRef.current = target
      setPipelineDropIndicator(target)
    }
  }

  const handleColDragLeave = (e: React.DragEvent, id: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dropTargetColRef.current?.id === id) {
        dropTargetColRef.current = null
        setPipelineDropIndicator(null)
      }
    }
  }

  const handleColDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const from = dragColRef.current as PipelineColumnId | null
    const target = dropTargetColRef.current || { id: targetId, position: 'bottom' as const }
    if (!from || !target || from === target.id) {
      setPipelineDraggingColId(null)
      setPipelineDropIndicator(null)
      dragColRef.current = null
      dropTargetColRef.current = null
      return
    }

    setColumnOrder(() => {
      const base: PipelineColumnId[] = [...orderedAvailableColumnIds]
      const fromIdx = base.indexOf(from)
      if (fromIdx === -1) return base
      const next = [...base]
      next.splice(fromIdx, 1)
      const targetIdx = next.indexOf(target.id as PipelineColumnId)
      if (targetIdx !== -1) {
        const insertIdx = target.position === 'top' ? targetIdx : targetIdx + 1
        next.splice(insertIdx, 0, from)
      }
      return next
    })

    setPipelineDraggingColId(null)
    setPipelineDropIndicator(null)
    dragColRef.current = null
    dropTargetColRef.current = null
  }

  const handleColDragEnd = () => {
    setPipelineDraggingColId(null)
    setPipelineDropIndicator(null)
    dragColRef.current = null
    dropTargetColRef.current = null
  }

  const [searchInput, setSearchInput] = useState(state.q)
  const debouncedSearch = useDebouncedValue(searchInput, 400)
  const isBulkReassignAllowedRole =
    user?.role !== 'BD' && user?.role !== 'USER'
  const canCreateManualLead = new Set([
    'BD',
    'TEAM_LEAD',
    'ASSISTANT_CATEGORY_MANAGER',
    'CATEGORY_MANAGER',
    'SALES_HEAD',
    'EXECUTIVE_ASSISTANT',
  ]).has(String(user?.role ?? ''))

  const { data: bulkReassignOptions } = useQuery<BulkLeadReassignOptionsResponse>({
    queryKey: ['lead-bulk-reassign-options'],
    queryFn: () => apiGet<BulkLeadReassignOptionsResponse>('/api/leads/bulk-reassign'),
    enabled: Boolean(user) && isBulkReassignAllowedRole,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const showBulkReassign =
    isBulkReassignAllowedRole && bulkReassignOptions?.canBulkReassign === true
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
  const areAllColumnsVisible = useMemo(
    () => availableColumns.every((column) => visibleColumns[column.id] === true),
    [availableColumns, visibleColumns]
  )

  // Column header filters are sent to the server so they apply across the full
  // dataset before pagination.
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = sessionStorage.getItem(`pipeline-column-filters-${variant}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const serverColumnFilters = useMemo(() => {
    const filters = (Object.entries(columnFilters) as Array<[PipelineColumnId, string[]]>).flatMap(
      ([columnId, selected]): PipelineServerColumnFilter[] => {
        if (!isPipelineServerFilterColumn(columnId) || selected.length === 0) {
          return []
        }

        if (isPipelineDateFilterColumn(columnId)) {
          if (selected.length !== 2 || !selected[0]) {
            return []
          }

          return [
            {
              field: columnId as any,
              operator: 'between' as const,
              value: [selected[0], selected[1] || selected[0]] as [string, string],
            },
          ]
        }

        return [
          {
            field: columnId as any,
            operator: 'in' as const,
            value: selected,
          },
        ]
      }
    )

    return filters.length > 0 ? JSON.stringify(filters) : ''
  }, [columnFilters])
  const { data, isLoading, isFetching, refetch } = usePipelinePage({ filters: serverColumnFilters })
  const handleColumnFilterChange = useCallback(
    (key: PipelineColumnId, selected: string[]) => {
      setColumnFilters((prev) => {
        const next = { ...prev, [key]: selected }
        try {
          sessionStorage.setItem(`pipeline-column-filters-${variant}`, JSON.stringify(next))
        } catch { }
        return next
      })
      setState({ page: 1 }, { resetPage: false })
    },
    [setState, variant]
  )
  const activeColumnFilterCount = useMemo(
    () => Object.values(columnFilters).filter((v) => v && v.length > 0).length,
    [columnFilters]
  )
  const clearColumnFilters = useCallback(() => {
    setColumnFilters({})
    try {
      sessionStorage.removeItem(`pipeline-column-filters-${variant}`)
    } catch { }
    setState({ page: 1 }, { resetPage: false })
  }, [setState, variant])

  const hasAnyActiveFilters = useMemo(
    () =>
      activeColumnFilterCount > 0 ||
      Boolean(state.q) ||
      Boolean(state.from) ||
      Boolean(state.to) ||
      Boolean(state.bdId) ||
      (state.status && state.status !== 'all') ||
      Boolean(searchInput),
    [activeColumnFilterCount, state.q, state.from, state.to, state.bdId, state.status, searchInput]
  )

  const handleResetAllFilters = useCallback(() => {
    clearColumnFilters()
    setSearchInput('')
    setState({
      q: '',
      from: '',
      to: '',
      bdId: '',
      status: 'all',
      page: 1,
    })
  }, [clearColumnFilters, setState])

  useEffect(() => {
    if (debouncedSearch !== state.q) {
      setState({ q: debouncedSearch })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    writePipelineVisibleColumns(variant, visibleColumns)
  }, [variant, visibleColumns])

  useEffect(() => {
    writePipelineColumnOrder(variant, columnOrder)
  }, [variant, columnOrder])

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

  const { data: masterOptions } = useQuery<{
    treatments: string[]
    treatmentCategories: string[]
    hospitals: string[]
    doctors: string[]
    insurance: string[]
  }, Error>({
    queryKey: ['pipeline-master-options'],
    queryFn: () =>
      apiGet<{
        treatments: string[]
        treatmentCategories: string[]
        hospitals: string[]
        doctors: string[]
        insurance: string[]
      }>('/api/masters/pipeline-options'),
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

  const rawPageLeads: Lead[] = useMemo(() => data?.leads ?? [], [data?.leads])

  // Column filter dropdown option lists — sourced from server facets across the
  // full matching dataset, then merged with page/master values where useful.
  const columnFilterOptions = useMemo(() => {
    const options = Object.fromEntries(
      availableColumns.map((column) => [
        column.id,
        isPipelineDateFilterColumn(column.id)
          ? []
          : mergeUniqueSortedLists(
            data?.facets.columnFacets?.[column.id as PipelineMultiColumnFilterField] ?? [],
            rawPageLeads.map((lead) => getPipelineColumnFilterValue(lead, column.id))
          ),
      ])
    ) as Record<PipelineColumnId, string[]>

    const treatmentMasterOptions = uniqueSorted(masterOptions?.treatments ?? [])
    const categoryMasterOptions = uniqueSorted(masterOptions?.treatmentCategories ?? [])
    const hospitalMasterOptions = uniqueSorted(masterOptions?.hospitals ?? [])
    const doctorMasterOptions = uniqueSorted(masterOptions?.doctors ?? [])
    const insuranceMasterOptions = uniqueSorted(masterOptions?.insurance ?? [])

    options.treatment = treatmentMasterOptions
    options.category = categoryMasterOptions
    options.hospital = mergeUniqueSortedLists(hospitalMasterOptions, options.hospital)
    options.doctor = mergeUniqueSortedLists(doctorMasterOptions, options.doctor)
    options.healthInsurance = mergeUniqueSortedLists(insuranceMasterOptions, options.healthInsurance)
    options.month = [...PIPELINE_MONTH_FILTER_OPTIONS]
    options.circle = mergeUniqueSortedLists(data?.facets.circles ?? [], options.circle)
    options.mop = mergeUniqueSortedLists(PIPELINE_MOP_FILTER_OPTIONS, options.mop)
    options.recency = mergeUniqueSortedLists(PIPELINE_RECENCY_FILTER_OPTIONS, options.recency)
    options.stage = mergeUniqueSortedLists(PIPELINE_STAGE_FILTER_OPTIONS, options.stage)
    options.status = PIPELINE_STATUS_FILTER_OPTIONS

    return options
  }, [
    availableColumns,
    data?.facets.columnFacets,
    data?.facets.circles,
    rawPageLeads,
    masterOptions,
  ])

  const getHeaderFilterProps = useCallback(
    (columnId: PipelineColumnId) => {
      if (!isPipelineServerFilterColumn(columnId)) {
        return {
          filterValue: undefined,
          filterOptions: undefined,
          filterType: undefined,
          onFilterChange: undefined,
        }
      }

      if (columnId === 'subStatus') {
        const valArray = columnFilters[columnId]
        return {
          filterValue: (valArray && valArray.length > 0) ? valArray[0] : '',
          filterOptions: undefined,
          filterType: 'search' as const,
          onFilterChange: (val: string) => handleColumnFilterChange(columnId, val ? [val] : []),
        }
      }

      return {
        filterValue: columnFilters[columnId] ?? [],
        filterOptions: isPipelineDateFilterColumn(columnId) ? undefined : (columnFilterOptions[columnId] ?? []),
        filterType: (isPipelineDateFilterColumn(columnId) ? 'dateRange' : 'multiSelect') as 'dateRange' | 'multiSelect',
        onFilterChange: (values: string[]) => handleColumnFilterChange(columnId, values),
      }
    },
    [columnFilterOptions, columnFilters, handleColumnFilterChange]
  )

  const tableRows: Lead[] = useMemo(() => rawPageLeads, [rawPageLeads])

  const noteCountKey = useMemo(() => [...tableRows.map((l) => l.id)].sort().join(','), [tableRows])

  const { data: noteCounts = {} } = useQuery({
    queryKey: ['call-note-counts', noteCountKey],
    queryFn: () => fetchNoteCountsForLeads(tableRows.map((l) => l.id)),
    enabled: tableRows.length > 0 && !!user?.id,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const markLeadOpenedMutation = useMutation({
    mutationFn: async (id: string) =>
      apiPost<{ marked: boolean; openedInCrmAt: string }>(`/api/leads/${id}/opened`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
    },
  })

  const markLeadOpened = useCallback(
    (id: string, alreadyOpened = false) => {
      if (alreadyOpened) return

      let shouldRequest = false

      setOptimisticallyOpenedLeadIds((current) => {
        if (current.includes(id)) return current
        shouldRequest = true
        return [id, ...current].slice(0, 500)
      })

      if (!shouldRequest) return

      markLeadOpenedMutation.mutate(id, {
        onError: () => {
          setOptimisticallyOpenedLeadIds((current) => current.filter((leadId) => leadId !== id))
        },
      })
    },
    [markLeadOpenedMutation]
  )

  const isLeadOpened = useCallback(
    (lead: Lead) =>
      Boolean(lead.openedInCrmAt) || optimisticallyOpenedLeadIds.includes(lead.id),
    [optimisticallyOpenedLeadIds]
  )

  const handleRowClick = useCallback(
    (id: string, alreadyOpened: boolean) => {
      markLeadOpened(id, alreadyOpened)
      // router.push(`/patient/${id}`)
      window.open(`/patient/${id}`, '_blank', 'noopener,noreferrer')
    },
    [markLeadOpened]
  )


  // const handleRowClick = useCallback((id: string) => {
  //   window.open(`/patient/${id}`, '_blank', 'noopener,noreferrer')
  // }, [])

  const handleEditLead = useCallback((id: string, alreadyOpened: boolean) => {
    markLeadOpened(id, alreadyOpened)
    setEditingLeadId(id)
  }, [markLeadOpened])

  const handleEditDrawerChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setEditingLeadId(null)
        queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      }
    },
    [queryClient]
  )

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
      removePreviousFollowUpDate?: boolean
      leadStatus?: string
      followUpDate?: string
      modeOfPayment?: string
      subStatus?: string
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

  const title = variant === 'bd' ? 'CRM' : 'Team CRM'
  const subtitle = 'Manage, track & convert leads across all pipelines'

  const total = data?.total ?? 0
  const overallTotalLeads = data?.facetTotal ?? total
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

  // Prefetch next page for instant (0ms) pagination transition
  useEffect(() => {
    if (page < totalPages) {
      const nextPage = page + 1
      const p = new URLSearchParams()
      p.set('page', String(nextPage))
      p.set('pageSize', String(pageSize))
      if (state.q) p.set('q', state.q)
      if (state.status !== 'all') p.set('status', state.status)
      if (state.bdId !== 'all') p.set('bdId', state.bdId)
      if (state.category !== 'all') p.set('category', state.category)
      if (state.circle !== 'all') p.set('circle', state.circle)
      if (state.age !== 'all') p.set('age', state.age)
      if (state.from) p.set('from', state.from)
      if (state.to) p.set('to', state.to)
      if (state.campaign) {
        p.set('campaign', state.campaign)
        if (state.groupBy === 'disease' && state.groupValue) {
          p.set('treatment', state.groupValue)
        }
      }
      p.set('groupBy', state.groupBy)
      p.set('sort', state.sort)
      p.set('dir', state.dir)
      if (serverColumnFilters) p.set('filters', serverColumnFilters)
      const nextQueryString = p.toString()

      queryClient.prefetchQuery({
        queryKey: ['pipeline-table', nextQueryString],
        queryFn: () => apiGet(`/api/pipeline?${nextQueryString}`),
        staleTime: 10_000,
      })
    }
  }, [page, totalPages, pageSize, state, serverColumnFilters, queryClient])

  // -----------------------------------------------------------------------
  // TanStack ColumnDef array — exact 1-to-1 port of PipelineRow + HeaderCell
  // -----------------------------------------------------------------------
  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    const defs: ColumnDef<Lead>[] = []

    // Fixed: S.No. (serial number — sticky fixed left column)
    // Fixed: S.No. (serial number — sticky fixed top and left)
    defs.push({
      id: '__sno',
      enableHiding: false,
      header: 'S.No.',
      cell: ({ row }) => (
        <span className="font-bold text-xs tabular-nums text-slate-800 dark:text-slate-200">
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
      size: 54,
      meta: {
        headerStyle: { width: 54, minWidth: 54, position: 'sticky', top: 0, left: 0, zIndex: 30 },
        headerClassName: "sticky top-0 left-0 z-30 text-center text-[11px] font-extrabold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-r border-border/80 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]",
        cellStyle: { width: 54, minWidth: 54, position: 'sticky', left: 0, zIndex: 20 },
        cellClassName: "sticky left-0 z-20 text-center bg-slate-100 dark:bg-slate-900 font-bold border-r border-border/70 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]",
      },
    })

    // Fixed: Bulk select (conditional on showBulkReassign)
    if (showBulkReassign) {
      defs.push({
        id: '__select',
        enableHiding: false,
        header: () => (
          <div className="flex justify-center">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
              onCheckedChange={(checked) =>
                setSelectedLeadIds(checked === true ? tableRows.map((l) => l.id) : [])
              }
              aria-label="Select visible leads"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedLeadIds.includes(row.original.id)}
              onCheckedChange={(checked) => toggleLeadSelection(row.original.id, checked === true)}
              aria-label={`Select lead ${row.original.leadRef ?? ''}`}
            />
          </div>
        ),
        size: 48,
        meta: { headerStyle: { width: 48, position: 'sticky', top: 0, zIndex: 10 }, cellStyle: { textAlign: 'center' }, headerClassName: "sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200" },
      })
    }

    // Fixed: Flow actions menu
    defs.push({
      id: '__flow',
      enableHiding: false,
      header: 'Flow',
      cell: ({ row }) => {
        const lead = row.original
        const caseActions = getPipelineCaseActions(lead, pipelineReturnTo)
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80" aria-label="Open case actions">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 shadow-lg border-border">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Case Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {caseActions.length > 0 ? caseActions.map((action) => (
                  <DropdownMenuItem key={action.id} asChild className="font-medium">
                    <Link href={action.href} onClick={(e) => { e.stopPropagation(); markLeadOpened(lead.id, Boolean(lead.openedInCrmAt) || optimisticallyOpenedLeadIds.includes(lead.id)) }}>{action.label}</Link>
                  </DropdownMenuItem>
                )) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No flow actions available yet.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      size: 48,
      meta: { headerStyle: { width: 48, position: 'sticky', top: 0, zIndex: 10 }, headerClassName: "sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200" },
    })

    // Helper to push a toggleable column
    const addCol = (colId: PipelineColumnId, def: Omit<ColumnDef<Lead>, 'id'>) =>
      defs.push({
        id: colId,
        enableHiding: true,
        ...def,
        meta: {
          ...def.meta,
          headerStyle: {
            position: 'sticky',
            top: 0,
            zIndex: 10,
            ...(def.meta as any)?.headerStyle,
          },
          headerClassName: cn(
            "sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200",
            (def.meta as any)?.headerClassName
          )
        }
      })

    addCol('leadRef', {
      header: () => <HeaderCell label="Lead Ref" sortField="leadRef" state={state} onSort={handleSort} {...getHeaderFilterProps('leadRef')} />,
      cell: ({ row }) => {
        const lead = row.original
        const leadRefText = typeof lead.leadRef === 'string' || typeof lead.leadRef === 'number' ? String(lead.leadRef) : '—'
        const isOpened = isLeadOpened(lead)
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="truncate max-w-[120px] text-left font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline sm:max-w-[160px]"
              title={leadRefText}
              onClick={() => handleEditLead(lead.id, isOpened)}
            >
              {leadRefText}
            </button>
            {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
          </div>
        )
      },
      meta: { headerStyle: { minWidth: 120 } },
    })

    addCol('assignDate', {
      header: () => <HeaderCell label="Assign Date" {...getHeaderFilterProps('assignDate')} />,
      cell: ({ row }) => renderTableDateTime(row.original.assignedDate),
      meta: { headerStyle: { minWidth: 120 } },
    })

    addCol('leadDate', {
      header: () => <HeaderCell label="Lead Date" sortField="date" state={state} onSort={handleSort} {...getHeaderFilterProps('leadDate')} />,
      cell: ({ row }) => renderTableDateTime(getLeadReceiptDate(row.original)),
      meta: { headerStyle: { minWidth: 130 } },
    })

    addCol('patient', {
      header: () => <HeaderCell label="Patient Name" sortField="patient" state={state} onSort={handleSort} {...getHeaderFilterProps('patient')} />,
      cell: ({ row }) => {
        const lead = row.original
        const patientName = typeof lead.patientName === 'string' ? lead.patientName : '—'
        const isOpened = isLeadOpened(lead)
        const latestRemarkPreview = getLatestRemarkPreview(lead)
        return (
          <div className="flex items-center gap-1.5 min-w-0 max-w-[170px]">
            <button
              type="button"
              disabled={callingLeadId === lead.id}
              onClick={(e) => {
                e.stopPropagation()
                handleInitiateCall(lead)
              }}
              title={`Call ${patientName} via Knowlarity`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white transition-all duration-200 disabled:opacity-50"
            >
              {callingLeadId === lead.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PhoneCall className="h-3.5 w-3.5" />
              )}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={appendReturnTo(`/patient/${lead.id}?action=edit-lead`, pipelineReturnTo)}
                  onClick={(e) => {
                    e.stopPropagation()
                    markLeadOpened(lead.id, isOpened)
                  }}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block max-w-[125px] truncate align-bottom font-semibold text-foreground hover:text-primary transition-colors hover:underline"
                >
                  {patientName}
                </Link>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-wrap text-left text-xs leading-5 shadow-lg border border-border">{latestRemarkPreview}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
      meta: { headerStyle: { minWidth: 175 } },
    })

    addCol('month', {
      header: () => <HeaderCell label="Month" {...getHeaderFilterProps('month')} />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm font-medium">{formatMonthCell(row.original.month)}</span>,
    })
    addCol('age', {
      header: 'Age',
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{row.original.age ?? '—'}</span>,
    })
    addCol('sex', {
      header: 'Sex',
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{normalizedText(row.original.sex, '—')}</span>,
    })
    addCol('circle', {
      header: () => <HeaderCell label="Circle" {...getHeaderFilterProps('circle')} />,
      cell: ({ row }) => <span className="max-w-[100px] truncate text-sm">{normalizedText(row.original.circle, '—')}</span>,
    })
    addCol('city', {
      header: 'City',
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm">{resolveLeadCity(row.original) ?? '—'}</span>,
    })
    addCol('category', {
      header: () => <HeaderCell label="Category" {...getHeaderFilterProps('category')} />,
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm">{normalizedText(row.original.category, '—')}</span>,
    })
    addCol('treatment', {
      header: () => <HeaderCell label="Treatment" {...getHeaderFilterProps('treatment')} />,
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm text-muted-foreground">{normalizedText(row.original.treatment, '—')}</span>,
    })
    addCol('tl', {
      header: () => <HeaderCell label="Team Lead" {...getHeaderFilterProps('tl')} />,
      cell: ({ row }) => {
        const text = getLeadTeamLeadText(row.original)
        return <span className="max-w-[120px] truncate text-sm font-medium" title={text}>{text}</span>
      },
    })
    addCol('bd', {
      header: () => <HeaderCell label="BDM" {...getHeaderFilterProps('bd')} />,
      cell: ({ row }) => <span className="max-w-[100px] truncate text-sm font-medium">{row.original.bd?.name ?? '—'}</span>,
    })
    addCol('lastRemarks', {
      header: () => <HeaderCell label="Last Remark" {...getHeaderFilterProps('lastRemarks')} />,
      cell: ({ row }) => {
        const { dateText, content } = getLeadLastRemarkDetails(row.original)
        if (content === '—') return '—'
        return (
          <div className="min-w-[360px] max-w-[600px] whitespace-normal break-words text-sm leading-relaxed text-foreground/90 flex flex-wrap items-baseline gap-1.5">
            {dateText && (
              <Badge
                variant="outline"
                className="inline-flex shrink-0 items-center rounded-full border-slate-300 bg-slate-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 shadow-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {dateText}
              </Badge>
            )}
            <span>{content}</span>
          </div>
        )
      },
      size: 400,
      meta: {
        headerStyle: { minWidth: 360 },
        cellClassName: "min-w-[360px] max-w-[600px]",
      },
    })
    addCol('status', {
      header: () => <HeaderCell label="Status" {...getHeaderFilterProps('status')} />,
      cell: ({ row }) => {
        const config = getStatusBadgeConfig(row.original.status)
        const IconComponent = config.icon
        return (
          <div className="flex items-center">
            <span
              className={cn(
                'inline-flex items-center gap-2.5 px-4 py-2 min-h-[34px] rounded-xl text-[13px] font-bold border shadow-xs whitespace-nowrap tracking-wide',
                config.className
              )}
            >
              <IconComponent className={cn('h-4 w-4 shrink-0 stroke-[2.3]', config.iconClass)} />
              <span>{config.label}</span>
            </span>
          </div>
        )
      },
      meta: {
        headerStyle: { minWidth: 150 },
        cellClassName: "py-1 px-1.5",
      },
    })
    addCol('followUpDate', {
      header: () => <HeaderCell label="Follow Up Date" sortField="followUpDate" state={state} onSort={handleSort} {...getHeaderFilterProps('followUpDate')} />,
      cell: ({ row }) => {
        const past = isPastFollowUpDate(row.original.followUpDate)
        return renderTableDateTime(row.original.followUpDate, past ? 'text-rose-600 dark:text-rose-400 font-semibold' : undefined)
      },
      meta: { headerStyle: { minWidth: 120 } },
    })
    addCol('mop', {
      header: () => <HeaderCell label="MOP" {...getHeaderFilterProps('mop')} />,
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm">{normalizedText(normalizeModeOfPaymentLabel(row.original.modeOfPayment), '—')}</span>,
    })
    addCol('surgeryDate', {
      header: () => <HeaderCell label="Surgery Date" {...getHeaderFilterProps('surgeryDate')} />,
      cell: ({ row }) => renderTableDateTime(getLeadSurgeryDateValue(row.original)),
      meta: { headerStyle: { minWidth: 120 } },
    })
    addCol('planningTreatment', {
      header: () => <HeaderCell label="Planning Treatment" {...getHeaderFilterProps('planningTreatment')} />,
      cell: ({ row }) => {
        const text = typeof row.original.diseaseDetails === 'string' && row.original.diseaseDetails.trim().length > 0 ? row.original.diseaseDetails.trim() : '—'
        return <span className="max-w-[180px] truncate text-sm" title={text}>{text}</span>
      },
    })
    addCol('subStatus', {
      header: () => <HeaderCell label="Sub Status" {...getHeaderFilterProps('subStatus')} />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{row.original.subStatus != null ? String(row.original.subStatus) : '—'}</span>,
    })
    addCol('healthInsurance', {
      header: () => <HeaderCell label="Health Insurance" {...getHeaderFilterProps('healthInsurance')} />,
      cell: ({ row }) => <span className="max-w-[160px] truncate text-sm">{normalizedText(row.original.insuranceName, '—')}</span>,
    })
    addCol('preferredLocation', {
      header: () => <HeaderCell label="Preferred Location" {...getHeaderFilterProps('preferredLocation')} />,
      cell: ({ row }) => {
        const loc = resolveLeadCity(row.original) ?? normalizedText(row.original.circle, '—')
        return <span className="max-w-[160px] truncate text-sm">{loc}</span>
      },
    })
    addCol('profession', {
      header: () => <HeaderCell label="Profession" {...getHeaderFilterProps('profession')} />,
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm">{normalizedText(row.original.profession, '—')}</span>,
    })
    addCol('source', {
      header: () => <HeaderCell label="Source" {...getHeaderFilterProps('source')} />,
      cell: ({ row }) => <span className="max-w-[120px] truncate text-sm">{normalizedText(row.original.source, '—')}</span>,
    })
    addCol('leadSource', {
      header: () => <HeaderCell label="Lead Source" {...getHeaderFilterProps('leadSource')} />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{resolveLeadSourceDisplay(row.original)}</span>,
    })
    addCol('createDate', {
      header: () => <HeaderCell label="Create Date" {...getHeaderFilterProps('createDate')} />,
      cell: ({ row }) => renderTableDateTime(row.original.createdDate),
      meta: { headerStyle: { minWidth: 120 } },
    })
    addCol('modifyBy', {
      header: () => <HeaderCell label="Modify By" {...getHeaderFilterProps('modifyBy')} />,
      cell: ({ row }) => <span className="max-w-[140px] truncate text-sm">{row.original.updatedBy?.name ?? '—'}</span>,
    })
    addCol('modifyDate', {
      header: () => <HeaderCell label="Modified Date" {...getHeaderFilterProps('modifyDate')} />,
      cell: ({ row }) => renderTableDateTime(row.original.updatedDate),
      meta: { headerStyle: { minWidth: 120 } },
    })
    addCol('dupCount', {
      header: () => <HeaderCell label="Duplicate Count" {...getHeaderFilterProps('dupCount')} />,
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{row.original.duplCount != null ? String(row.original.duplCount) : '0'}</span>,
    })
    addCol('stage', {
      header: () => <HeaderCell label="Stage" {...getHeaderFilterProps('stage')} />,
      cell: ({ row }) => {
        const stageBadge = getLeadStageBadge(row.original)
        return stageBadge ? <Badge variant="secondary" className={`text-[11px] ${stageBadge.className}`}>{stageBadge.label}</Badge> : <span>—</span>
      },
    })
    addCol('hospital', {
      header: () => <HeaderCell label="Hospital" {...getHeaderFilterProps('hospital')} />,
      cell: ({ row }) => {
        const { hospital } = resolveLeadHospitalDoctor(row.original)
        return <span className="max-w-[160px] truncate text-sm">{hospital || '—'}</span>
      },
    })
    addCol('doctor', {
      header: () => <HeaderCell label="Doctor" {...getHeaderFilterProps('doctor')} />,
      cell: ({ row }) => {
        const { doctor } = resolveLeadHospitalDoctor(row.original)
        return <span className="max-w-[160px] truncate text-sm">{doctor || '—'}</span>
      },
    })
    addCol('recency', {
      header: () => <HeaderCell label="Recency" {...getHeaderFilterProps('recency')} />,
      cell: ({ row }) => <LeadAgeBadge lead={row.original} />,
    })

    // Fixed: Notes + Actions (always last)
    defs.push({
      id: '__notes',
      enableHiding: false,
      header: 'Notes',
      cell: ({ row }) => (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <CallNotesPopover leadId={row.original.id} onRowClickStop noteCount={noteCounts[row.original.id]} />
        </div>
      ),
      size: 100,
      meta: { headerStyle: { width: 100, position: 'sticky', top: 0, zIndex: 10 }, cellStyle: { textAlign: 'center' }, headerClassName: "sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 text-center" },
    })
    defs.push({
      id: '__actions',
      enableHiding: false,
      header: '',
      cell: ({ row }) => {
        const lead = row.original
        const isOpened = isLeadOpened(lead)
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 font-medium hover:bg-muted/80" onClick={() => handleEditLead(lead.id, isOpened)}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80" asChild>
              <Link href={`/patient/${lead.id}`} aria-label="Open lead" onClick={(e) => { e.stopPropagation(); markLeadOpened(lead.id, isOpened) }}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )
      },
      size: 132,
      meta: { headerStyle: { width: 132, position: 'sticky', top: 0, zIndex: 10 }, headerClassName: "sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 text-right" },
    })

    // Apply column visibility from visibleColumns state (hide toggleable cols not in visibleColumns)
    return defs.filter((col) => {
      if (col.enableHiding === false) return true
      const id = col.id as PipelineColumnId
      return visibleColumns[id] !== false
    })
  }, [
    page, pageSize, showBulkReassign, allVisibleSelected, someVisibleSelected,
    tableRows, selectedLeadIds, state, pipelineReturnTo,
    getHeaderFilterProps, handleSort, handleEditLead, isLeadOpened,
    markLeadOpened, optimisticallyOpenedLeadIds, noteCounts,
    toggleLeadSelection, visibleColumns, callingLeadId, handleInitiateCall,
  ])


  const startDate = state.from ? new Date(state.from) : undefined
  const endDate = state.to ? new Date(state.to) : undefined

  const effectiveColumnOrder = useMemo(() => {
    const leading = ['__sno', ...(showBulkReassign ? ['__select'] : []), '__flow']
    const trailing = ['__notes', '__actions']
    return [...leading, ...orderedAvailableColumnIds, ...trailing]
  }, [orderedAvailableColumnIds, showBulkReassign])

  return (
    <AuthenticatedLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background overflow-hidden -mt-4 md:-mt-6 -mx-4 md:-mx-6 -mb-24 md:-mb-6">
        {/* Top Header */}
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-1.5 backdrop-blur-xl dark:bg-background/80 md:px-6 shrink-0 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
                {title}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-3 text-right">
              {/* Month Selector Dropdown */}
              <Select
                value={columnFilters.month?.[0] || 'all'}
                onValueChange={(val) => {
                  if (val === 'all') {
                    handleColumnFilterChange('month', [])
                  } else {
                    handleColumnFilterChange('month', [val])
                  }
                }}
              >
                <SelectTrigger className="w-[130px] h-9 text-xs bg-background/80 hover:bg-background border-zinc-400 dark:border-zinc-500 rounded-xl shadow-xs font-semibold">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="all">All Months</SelectItem>
                  {PIPELINE_MONTH_FILTER_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Flashy Teal Banner: Total Leads (Compact, Icon on Right) */}
              <div className="relative overflow-hidden flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-teal-600/15 via-emerald-500/10 to-teal-500/20 dark:from-teal-950/60 dark:via-emerald-950/40 dark:to-teal-900/50 border border-teal-500/30 dark:border-teal-500/40 rounded-xl shadow-md shadow-teal-500/10 min-w-[240px] sm:min-w-[280px] backdrop-blur-md group hover:border-teal-400/60 transition-all duration-300">
                {/* Ambient glowing background blur */}
                <div className="absolute -right-6 -top-6 w-20 h-20 bg-teal-400/20 rounded-full blur-xl pointer-events-none group-hover:bg-teal-400/30 transition-all duration-500" />

                <div className="relative flex flex-col text-left flex-1 min-w-0 pr-3">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-700 dark:from-teal-300 dark:via-teal-200 dark:to-emerald-300 bg-clip-text text-transparent leading-none mb-1">
                    Total Leads
                  </span>
                  <span className="text-xl font-black tabular-nums tracking-tight text-teal-900 dark:text-teal-100 drop-shadow-2xs leading-tight">
                    {data ? overallTotalLeads.toLocaleString() : '—'}
                  </span>
                </div>

                <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/30 shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Database className="w-4 h-4 drop-shadow-xs" />
                </div>
              </div>

              {variant === 'bd' && (
                <Button
                  variant="outline"
                  className="h-9 text-xs font-semibold px-3 border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-teal-800/80 dark:hover:bg-teal-950/50 dark:hover:text-teal-300 shadow-xs transition-all"
                  asChild
                >
                  <Link href="/bd/kyp">Case tracker</Link>
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <main className="flex-1 flex flex-col pt-1.5 px-3 pb-2 md:pt-1.5 md:px-4 md:pb-3 overflow-hidden min-h-0">
            {/* Target Progress Card */}
            {targetProgress && (
              <Card className="mb-2 overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80 p-3 shadow-sm dark:border-indigo-900/60 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      <p className="text-sm font-bold text-foreground">Target Progress</p>
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300">
                        Active Period
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      Metric: {targetProgress.target.metric.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="w-full max-w-md space-y-1">
                    {targetProgress.showActual ? (
                      <>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-indigo-700 dark:text-indigo-300">Actual: {targetProgress.actual}</span>
                          <span className="text-muted-foreground">Goal: {targetProgress.target.targetValue} ({targetProgress.pct?.toFixed(0)}%)</span>
                        </div>
                        <Progress
                          value={targetProgress.pct ?? 0}
                          className="h-2 rounded-full bg-indigo-200/50 dark:bg-indigo-950 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:via-indigo-600 [&>div]:to-purple-600"
                        />
                      </>
                    ) : (
                      <div className="flex justify-end text-xs font-semibold text-muted-foreground">
                        <span>Goal: {targetProgress.target.targetValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Campaign Selection Card */}
            {campaignSelection.type === 'campaign' && (
              <Card className="mb-2 overflow-hidden rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-50/80 via-fuchsia-50/40 to-card p-3 shadow-sm dark:border-violet-900/60 dark:from-violet-950/30 dark:via-fuchsia-950/20 dark:to-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      {campaignSelection.groupValue}
                    </p>
                    <h2 className="text-lg font-black tracking-tight text-foreground">{campaignSelection.campaignLabel}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                        {data?.facetTotal ?? 0} in campaign
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize font-semibold border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300">
                        {campaignSelection.groupBy}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tabular-nums text-violet-700 dark:text-violet-400">{data?.facetTotal ?? 0}</p>
                    <p className="text-xs font-medium text-muted-foreground">Total Campaign Leads</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Status Breakdown Cards */}
            <div className="mb-2 shrink-0">
              <PipelineStatusCards
                counts={data?.statusCounts}
                total={data?.facetTotal}
                selected={state.status}
                onSelect={(b) => setState({ status: b })}
                isLoading={isLoading}
              />
            </div>

            {/* Main Table Card Container */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="rounded-2xl border border-border/80 bg-white dark:bg-card flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm">
                {/* Table Toolbar Header Section */}
                <div className="flex items-center justify-between border-b border-border/80 bg-white dark:bg-card text-foreground px-4 py-2.5 shrink-0 rounded-t-2xl shadow-xs">
                  <div>
                    <h3 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span>Leads Pipeline</span>
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {data ? `Showing ${rangeStart}–${rangeEnd} of ${total} leads` : 'Loading…'}{' '}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetAllFilters}
                      disabled={!hasAnyActiveFilters}
                      className={cn(
                        "h-8 gap-1.5 text-xs font-semibold border-border shadow-xs transition-colors",
                        hasAnyActiveFilters
                          ? "text-rose-600 dark:text-rose-400 bg-rose-50/60 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border-rose-200 dark:border-rose-800"
                          : "text-muted-foreground bg-background hover:bg-muted opacity-60"
                      )}
                      title="Reset all search, date, and column filters"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Filters
                    </Button>
                    {canCreateManualLead ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border-0 transition-all"
                        onClick={() => setManualLeadCreateOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                        Create manual lead
                      </Button>
                    ) : null}
                    {showBulkReassign ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold border-border text-foreground bg-background hover:bg-muted shadow-xs"
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
                            className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            onClick={() => setSelectedLeadIds([])}
                          >
                            Deselect all
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold border-border text-foreground bg-background hover:bg-muted shadow-xs">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          Columns
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[380px] w-64 overflow-y-auto p-0 shadow-lg border-border"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <div className="px-2.5 py-2">
                          <DropdownMenuLabel className="px-0 py-0.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Toggle &amp; Reorder Columns
                          </DropdownMenuLabel>
                        </div>
                        <DropdownMenuSeparator className="my-0" />
                        {/* Select All row */}
                        <div className="px-2 py-1">
                          <DropdownMenuCheckboxItem
                            checked={areAllColumnsVisible}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(checked) =>
                              setVisibleColumns(
                                availableColumns.reduce<Record<PipelineColumnId, boolean>>(
                                  (next, column) => {
                                    next[column.id] = checked === true
                                    return next
                                  },
                                  {} as Record<PipelineColumnId, boolean>
                                )
                              )
                            }
                            className="font-medium"
                          >
                            Select all
                          </DropdownMenuCheckboxItem>
                        </div>
                        <DropdownMenuSeparator className="my-0" />
                        {/* Draggable column rows */}
                        <div
                          className="py-1 relative"
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setPipelineDropIndicator(null)
                              dropTargetColRef.current = null
                            }
                          }}
                        >
                          {orderedAvailableColumnIds.map((colId) => {
                            const column = availableColumns.find((c) => c.id === colId)
                            if (!column) return null
                            const isDragging = pipelineDraggingColId === colId
                            const isDropTop = pipelineDropIndicator?.id === colId && pipelineDropIndicator?.position === 'top'
                            const isDropBottom = pipelineDropIndicator?.id === colId && pipelineDropIndicator?.position === 'bottom'
                            const draggingColLabel = availableColumns.find((c) => c.id === pipelineDraggingColId)?.label || 'Column'

                            return (
                              <div
                                key={colId}
                                className="relative"
                                onDragOver={(e) => handleColDragOver(e, colId)}
                                onDrop={(e) => handleColDrop(e, colId)}
                              >
                                {/* Drop Indicator Bar (Top) */}
                                {isDropTop && (
                                  <div className="absolute -top-1 inset-x-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full z-20 shadow-[0_0_6px_rgba(37,99,235,0.8)] pointer-events-none" />
                                )}

                                {/* Draggable Column Row */}
                                <div
                                  draggable
                                  onDragStart={(e) => handleColDragStart(e, colId)}
                                  onDragOver={(e) => handleColDragOver(e, colId)}
                                  onDragEnter={(e) => handleColDragOver(e, colId)}
                                  onDragLeave={(e) => handleColDragLeave(e, colId)}
                                  onDrop={(e) => handleColDrop(e, colId)}
                                  onDragEnd={handleColDragEnd}
                                  className={cn(
                                    "flex items-center gap-2 px-2.5 py-1.5 rounded-sm transition-colors select-none group cursor-default relative",
                                    isDragging
                                      ? "opacity-30 bg-blue-50/40 dark:bg-blue-950/30 border border-dashed border-blue-500 dark:border-blue-400"
                                      : "hover:bg-accent",
                                    (isDropTop || isDropBottom) && "bg-blue-50/20 dark:bg-blue-950/30 ring-1 ring-blue-500/40"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    id={`pipeline-col-${colId}`}
                                    checked={visibleColumns[colId] ?? false}
                                    onChange={(e) =>
                                      setVisibleColumns((current) => ({
                                        ...current,
                                        [colId]: e.target.checked,
                                      }))
                                    }
                                    className={cn(
                                      "h-4 w-4 rounded border border-input accent-indigo-600 cursor-pointer shrink-0",
                                      pipelineDraggingColId && "pointer-events-none"
                                    )}
                                  />
                                  <label
                                    htmlFor={`pipeline-col-${colId}`}
                                    className={cn(
                                      "flex-1 text-sm font-medium cursor-pointer truncate",
                                      pipelineDraggingColId && "pointer-events-none"
                                    )}
                                  >
                                    {column.label}
                                  </label>
                                  <span
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className={cn(
                                      "cursor-grab active:cursor-grabbing shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors p-0.5",
                                      pipelineDraggingColId && "pointer-events-none"
                                    )}
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </span>
                                </div>

                                {/* Drop Indicator Bar (Bottom) */}
                                {isDropBottom && (
                                  <div className="absolute -bottom-1 inset-x-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full z-20 shadow-[0_0_6px_rgba(37,99,235,0.8)] pointer-events-none" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isFetching}
                      className="h-8 gap-1.5 text-xs font-semibold border-border text-foreground bg-background hover:bg-muted shadow-xs"
                      title="Refresh CRM data"
                    >
                      <RotateCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filter Search Bar */}
                <div className="border-b border-border/70 px-4 py-2.5 bg-muted/30 dark:bg-muted/10 shrink-0 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                    <Input
                      placeholder="Search all table columns except dates… or full mobile (10 digits or 91…) "
                      className="pl-9 h-9 text-xs bg-background/80 hover:bg-background focus:bg-background border-border/80 rounded-lg shadow-xs transition-colors"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>
                  {variant === 'team-lead' && (data?.facets.bds.length ?? 0) > 0 && (
                    <Select value={state.bdId} onValueChange={(v) => setState({ bdId: v })}>
                      <SelectTrigger className="w-full lg:w-[200px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs font-medium">
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
                    <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs font-medium">
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
                    <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs font-medium">
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
                    <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs font-medium">
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
                      <Button variant="outline" className="w-full justify-start text-left font-medium lg:w-[120px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
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
                      <Button variant="outline" className="w-full justify-start text-left font-medium lg:w-[120px] h-9 text-xs bg-background/80 hover:bg-background border-border/80 rounded-lg shadow-xs">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
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
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-lg"
                      onClick={() => setState({ from: '', to: '' })}
                    >
                      Clear dates
                    </Button>
                  )}
                </div>

                {/* Table Content Container */}
                <div
                  className={cn(
                    'flex-1 flex flex-col min-h-0 overflow-hidden transition-opacity duration-200',
                    isBackgroundRefetching && 'opacity-60 pointer-events-none'
                  )}
                >
                  <DataTable
                    columns={columns}
                    data={tableRows}
                    isLoading={isLoading}
                    emptyMessage="No leads match filters"
                    onRowClick={(lead) => handleRowClick(lead.id, isLeadOpened(lead))}
                    rowClassName={(lead) =>
                      !isLeadOpened(lead)
                        ? 'bg-[#E4EEFF] hover:bg-[#D9E7FF] shadow-[inset_0_1px_0_0_rgba(175,196,255,0.9),inset_0_-1px_0_0_rgba(175,196,255,0.9)] dark:bg-[#2A3B60] dark:hover:bg-[#334874] dark:shadow-[inset_0_1px_0_0_rgba(93,124,199,0.95),inset_0_-1px_0_0_rgba(93,124,199,0.95)] font-medium'
                        : 'hover:bg-muted/50'
                    }
                    className="flex-1 flex flex-col min-h-0 space-y-0 overflow-hidden"
                    columnVisibility={visibleColumns as Record<string, boolean>}
                    tableContainerClassName="border-0 rounded-none shadow-none flex-1 flex flex-col min-h-0 h-full overflow-hidden"
                    tableHeaderClassName="!static [&_th]:bg-slate-100 dark:[&_th]:bg-slate-900 border-b border-border/80 text-foreground shadow-xs [&_tr]:border-b [&_tr]:border-border/60"
                    onColumnVisibilityChange={(updaterOrVal) => {
                      const next = typeof updaterOrVal === 'function'
                        ? updaterOrVal(visibleColumns as Record<string, boolean>)
                        : updaterOrVal
                      setVisibleColumns(next as Record<PipelineColumnId, boolean>)
                    }}
                    columnOrder={effectiveColumnOrder}
                    onColumnOrderChange={(updaterOrVal) => {
                      const next = typeof updaterOrVal === 'function'
                        ? updaterOrVal(effectiveColumnOrder ?? [])
                        : updaterOrVal
                      const fixedIds = new Set(['__sno', '__select', '__flow', '__notes', '__actions'])
                      setColumnOrder(next.filter((id) => !fixedIds.has(id)) as PipelineColumnId[])
                    }}
                  />
                </div>

                {/* Pagination Footer */}
                <div className="flex flex-col gap-2 border-t border-border/70 bg-gradient-to-r from-muted/30 via-muted/10 to-card px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {total > 0
                      ? `Showing ${rangeStart}–${rangeEnd} of ${total} results`
                      : 'No results'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => setState({ pageSize: Number(v), page: 1 })}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs font-medium bg-background/80 border-border/80 shadow-xs">
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
                      className="h-8 text-xs font-medium border-border/80 hover:bg-muted shadow-xs"
                      disabled={page <= 1}
                      onClick={() => setState({ page: page - 1 })}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                      Prev
                    </Button>
                    <span className="whitespace-nowrap text-xs font-bold text-foreground/80 tabular-nums px-1">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium border-border/80 hover:bg-muted shadow-xs"
                      disabled={page >= totalPages}
                      onClick={() => setState({ page: page + 1 })}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
        <ManualLeadCreateDialog
          currentUserId={user?.id ?? null}
          open={manualLeadCreateOpen}
          onOpenChange={setManualLeadCreateOpen}
          onCreated={async (lead) => {
            await queryClient.invalidateQueries({ queryKey: ['pipeline'] })
            setEditingLeadId(lead.id)
          }}
        />
      </div>
    </AuthenticatedLayout>
  )
}

function getLatestRemarkPreview(lead: Lead) {
  const text = getLeadLastRemarksText(lead)
  return text !== '—' ? text : 'No remarks yet.'
}

type PipelineCaseAction = {
  id: 'opd-schedule' | 'card-upload' | 'pre-auth-raised' | 'ipd-schedule'
  label: string
  href: string
}

function canShowPipelineOpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (isCashCaseStage(lead.caseStage)) {
    return ([
      CaseStage.CASH_IPD_PENDING,
      CaseStage.CASH_OPD_SCHEDULED,
      CaseStage.CASH_OPD_DONE,
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ] as CaseStage[]).includes(lead.caseStage as CaseStage)
  }

  return ([
    CaseStage.NEW_LEAD,
    CaseStage.OPD_SCHEDULED,
    CaseStage.OPD_DONE,
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
  ] as CaseStage[]).includes(lead.caseStage as CaseStage)
}

function canShowPipelineCardUpload(lead: Lead) {
  if (!lead.caseStage || isCashCaseStage(lead.caseStage)) return false
  if (lead.caseStage === CaseStage.KYP_BASIC_COMPLETE) return true
  return ([CaseStage.NEW_LEAD, CaseStage.OPD_SCHEDULED, CaseStage.OPD_DONE, CaseStage.KYP_BASIC_PENDING] as CaseStage[]).includes(
    lead.caseStage as CaseStage
  )
}

function canShowPipelinePreAuthRaised(lead: Lead) {
  return !isCashCaseStage(lead.caseStage) && lead.caseStage === CaseStage.HOSPITALS_SUGGESTED
}

function canShowPipelineIpdSchedule(lead: Lead) {
  if (!lead.caseStage) return false

  if (isCashCaseStage(lead.caseStage) || lead.flowType === 'CASH') {
    if (lead.caseStage === CaseStage.CASH_OPD_DONE) {
      return true
    }

    if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
      return true
    }

    return ([
      CaseStage.CASH_IPD_SUBMITTED,
      CaseStage.CASH_ON_HOLD,
      CaseStage.CASH_APPROVED,
    ] as CaseStage[]).includes(lead.caseStage as CaseStage)
  }

  return ([CaseStage.PREAUTH_COMPLETE, CaseStage.INITIATED, CaseStage.ADMITTED] as CaseStage[]).includes(
    lead.caseStage as CaseStage
  )
}

function getPipelineIpdScheduleHref(lead: Lead) {
  return isCashCaseStage(lead.caseStage) || lead.flowType === 'CASH'
    ? `/patient/${lead.id}?action=ipd-cash`
    : `/patient/${lead.id}?action=ipd-schedule`
}

function getPipelineIpdScheduleLabel(lead: Lead) {
  if (isCashCaseStage(lead.caseStage) || lead.flowType === 'CASH') {
    return lead.admissionRecord ? 'Edit IPD Cash Form' : 'Fill IPD Cash Form'
  }

  return 'IPD Schedule'
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
  const showInsuranceActions = !isCashCaseStage(lead.caseStage) && lead.flowType !== 'CASH'

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
      label: getPipelineIpdScheduleLabel(lead),
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
  filterType,
  onFilterChange,
}: {
  label: string
  sortField?: PipelineSortField
  state?: { sort: PipelineSortField; dir: PipelineSortDir }
  onSort?: (field: PipelineSortField) => void
  filterValue?: any
  filterOptions?: string[]
  filterType?: 'multiSelect' | 'dateRange' | 'search'
  onFilterChange?: (v: any) => void
}) {
  const active = !!sortField && state?.sort === sortField

  return (
    <div className="flex items-center justify-between gap-1.5 whitespace-nowrap w-full">
      {sortField && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortField)}
          className={cn(
            'group inline-flex items-center gap-1 font-bold transition-colors hover:text-indigo-600 dark:hover:text-indigo-400',
            active ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-700 dark:text-slate-200'
          )}
        >
          <span>{label}</span>
          {active ? (
            state!.dir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      ) : (
        <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
      )}
      {onFilterChange && (filterType === 'dateRange' || filterType === 'search' || filterOptions) && (
        <div className="shrink-0">
          <ColumnFilter
            type={filterType}
            value={filterValue}
            options={filterOptions}
            onChange={(v) => onFilterChange(v)}
            placeholder={`Filter ${label.toLowerCase()}...`}
          />
        </div>
      )}
    </div>
  )
}

