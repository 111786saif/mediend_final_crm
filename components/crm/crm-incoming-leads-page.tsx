'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { AlertTriangle, CalendarIcon, Eye, Inbox, Loader2, Pencil, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { IncomingLeadsManualAssignDialog } from '@/components/crm/incoming-leads-manual-assign-dialog'
import { IncomingLeadsManualCreateDialog } from '@/components/crm/incoming-leads-manual-create-dialog'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/crm/crm-filter-table'
import { useAuth } from '@/hooks/use-auth'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import {
  extractIncomingLeadEditValues,
  type IncomingLeadEditValues,
} from '@/lib/crm-incoming-leads'
import {
  parseFlexibleDateInput,
  toDateTimeLocalInputValue,
} from '@/lib/flexible-date-input'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
} from '@/lib/lead-status-options'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import {
  MANUAL_MYSQL_LEAD_FIELDS,
  MANUAL_MYSQL_LEAD_SECTION_ORDER,
} from '@/lib/manual-mysql-lead-import'

type SourceMaster = {
  id: string
  name: string
  isActive: boolean
}

type LeadSourceMaster = {
  id: string
  name: string
  cpl: number | null
  sourceId: string
  isActive: boolean
  source: SourceMaster
}

type CircleMaster = {
  id: string
  name: string
  isActive: boolean
}

type CityMaster = {
  id: string
  name: string
  circleId: string
  isActive: boolean
  circle: CircleMaster
}

type DepartmentOption = {
  id: string
  name: string
}

type TreatmentCategoryOption = {
  id: string
  name: string
  isActive: boolean
}

type TreatmentOption = {
  id: string
  name: string
  category: string
  isActive: boolean
}

type CampaignMasters = {
  sources: SourceMaster[]
  leadSources: LeadSourceMaster[]
  circles: CircleMaster[]
  cities: CityMaster[]
  departments: DepartmentOption[]
  treatmentCategories: TreatmentCategoryOption[]
  treatments: TreatmentOption[]
}

type CampaignRecord = {
  id: string
  externalCampaignId: string
  displayName: string
  category: string | null
  treatmentMasterId: string | null
  departmentId: string | null
  isActive: boolean
  sourceId: string
  leadSourceId: string
  circleId: string
  cityId: string | null
  source: SourceMaster
  leadSource: LeadSourceMaster
  circle: CircleMaster
  city: CityMaster | null
  department: DepartmentOption | null
  treatmentMaster: TreatmentOption | null
}

type IncomingLeadRecord = {
  id: string
  source: string | null
  status: string
  payload: unknown
  externalCampaignId: string | null
  normalizedPhone: string | null
  errorMessage: string | null
  processedAt: string | null
  receivedAt: string
  summary: {
    campaignId: string | null
    leadDate: string | null
    category: string | null
    treatment: string | null
    circle: string | null
    city: string | null
    patientName: string | null
    phone: string | null
    email: string | null
  }
  campaign: {
    id: string
    displayName: string
    externalCampaignId: string
  } | null
  processedLead: {
    id: string
    leadRef: string
    patientName: string
    phoneNumber: string
    category: string | null
    treatment: string | null
    assignedDate: string | null
    leadEntryDate: string | null
    followUpDate: string | null
    surgeryDate: string | null
  } | null
  teamLead: {
    id: string
    name: string
    email: string
  } | null
  bd: {
    id: string
    name: string
    email: string
  } | null
}

type IncomingLeadPageData = {
  month: number | null
  year: number | null
  masters: CampaignMasters
  campaigns: CampaignRecord[]
  incomingLeads: IncomingLeadRecord[]
}

type IncomingLeadManualAssignOptions = {
  canManualAssign: boolean
  assignableUsers: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
}

type IncomingLeadManualAssignResult = {
  processedCount: number
  duplicateCount: number
  failedCount: number
  results: Array<{
    incomingLeadId: string
    status: 'processed' | 'duplicate' | 'failed' | 'already_processed'
    leadId?: string
    leadRef?: string
    bdName?: string
    error?: string
  }>
}

type IncomingLeadRetryResult = {
  processedCount: number
  duplicateCount: number
  failedCount: number
  skippedCount: number
  results: Array<{
    incomingLeadId: string
    status: 'processed' | 'already_processed' | 'duplicate' | 'failed' | 'skipped'
    leadId?: string
    leadRef?: string
    assignedBdName?: string | null
    error?: string
  }>
}

type IncomingLeadEditDraft = IncomingLeadEditValues

type IncomingLeadTableRow = {
  id: string
  receivedAt: string
  processedAt: string
  status: string
  source: string
  externalCampaignId: string
  payloadCampaignId: string
  campaignName: string
  campaignSource: string
  leadSource: string
  category: string
  treatment: string
  circle: string
  city: string
  patientName: string
  email: string
  normalizedPhone: string
  assignedDate: string
  leadDate: string
  followUpDate: string
  surgeryDate: string
  processedLeadRef: string
  processedLeadPatientName: string
  processedLeadPhoneNumber: string
  teamLeadName: string
  teamLeadEmail: string
  bdName: string
  bdEmail: string
  errorMessage: string
  raw: IncomingLeadRecord
}

type ColumnType = 'string' | 'date'

type IncomingLeadColumn = {
  id: keyof Omit<IncomingLeadTableRow, 'raw'>
  label: string
  type: ColumnType
  defaultVisible?: boolean
  masterKey?: keyof CampaignMasters
  cell?: (row: IncomingLeadTableRow) => ReactNode
}

const INCOMING_LEAD_VIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'CRM_ADMIN',
  'BD',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])
const ALL_FILTER_VALUE = '__all__'
const ALL_MONTHS_VALUE = '__all_months__'
const INCOMING_LEAD_HEADER_FILTER_COLUMN_IDS = [
  'receivedAt',
  'processedAt',
  'status',
  'source',
  'campaignName',
  'campaignSource',
  'leadSource',
  'category',
  'treatment',
  'circle',
  'city',
] as const satisfies ReadonlyArray<IncomingLeadColumn['id']>

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

const HIDDEN_INCOMING_LEAD_EDIT_FIELD_KEYS = new Set([
  'id',
  'month',
  'LeadEntryDate',
  'create_date',
  'BDM',
  'TL',
  'ad_id',
  'form_id',
  'create_by',
  'update_by',
  'update_date',
  'Follow_up_Date',
  'Surgery_Date',
  'PaymentDetails',
  'aes',
  'OPD_Hospital',
  'OPD_DrName',
  'OPD_ContactNo',
  'OPD_Charges',
  'OPD_ScheduleDate',
  'OPD_Meeting',
  'IPD_AdmisisonDate',
  'IPD_Hospital',
  'IPD_DrName',
  'IPD_ContactNo',
  'IPD_TotalPayment',
  'IPD_Details',
  'Attendant',
  'AttendantName',
  'AttendantContactNo',
])

const HIDDEN_INCOMING_LEAD_EDIT_SECTIONS = new Set(['Communication', 'Tracking'])

const EMPTY_INCOMING_LEAD_EDIT_DRAFT: IncomingLeadEditDraft = {
  Lead_Date: '',
  Patient_Number: '',
  AlternativePhone: '',
  Whatsapp: '',
  Patient_Name: '',
  PatientEmail: '',
  Age: '',
  Sex: '',
  Profession: '',
  Circle: '',
  city_option: '',
  address: '',
  website: '',
  ip: '',
  Category: '',
  Treatment: '',
  DiseaseDetails: '',
  Status: '',
  SubStatus: '',
  MOP: '',
  Source: '',
  Lead_Source: '',
  campaign_id: '',
}

const INCOMING_LEAD_COLUMNS: IncomingLeadColumn[] = [
  { id: 'receivedAt', label: 'Received', type: 'date', cell: (row) => formatDateOnly(row.receivedAt) },
  { id: 'processedAt', label: 'Processed', type: 'date', cell: (row) => formatDateOnly(row.processedAt) },
  { id: 'status', label: 'Status', type: 'string', cell: (row) => webhookStatusBadge(row.status) },
  { id: 'source', label: 'Source', type: 'string' },
  { id: 'campaignName', label: 'Campaign Name', type: 'string' },
  { id: 'campaignSource', label: 'Campaign Source', type: 'string', masterKey: 'sources' },
  { id: 'leadSource', label: 'Lead Source', type: 'string', masterKey: 'leadSources' },
  { id: 'category', label: 'Category', type: 'string' },
  { id: 'treatment', label: 'Treatment', type: 'string', masterKey: 'treatments' },
  { id: 'circle', label: 'Circle', type: 'string', masterKey: 'circles' },
  { id: 'city', label: 'City', type: 'string', masterKey: 'cities' },
  { id: 'patientName', label: 'Patient', type: 'string' },
  { id: 'email', label: 'Email', type: 'string' },
  { id: 'normalizedPhone', label: 'Phone', type: 'string', cell: (row) => <span className="font-mono text-sm">{row.normalizedPhone}</span> },
  { id: 'assignedDate', label: 'Assign Date', type: 'date', cell: (row) => formatDateOnly(row.assignedDate) },
  { id: 'leadDate', label: 'Lead Date', type: 'date', cell: (row) => formatDateOnly(row.leadDate) },
  { id: 'followUpDate', label: 'Follow up Date', type: 'date', cell: (row) => formatDateOnly(row.followUpDate) },
  { id: 'surgeryDate', label: 'Surgery Date', type: 'date', cell: (row) => formatDateOnly(row.surgeryDate) },
  { id: 'processedLeadRef', label: 'Lead Ref', type: 'string' },
  { id: 'teamLeadName', label: 'Team Lead', type: 'string' },
  { id: 'bdName', label: 'BD', type: 'string' },
]

function getInitialMonthYear() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

function createInitialVisibleColumns() {
  return Object.fromEntries(INCOMING_LEAD_COLUMNS.map((column) => [column.id, column.defaultVisible ?? true])) as Record<
    IncomingLeadColumn['id'],
    boolean
  >
}

function getUniqueRowValues(rows: IncomingLeadTableRow[], columnId: IncomingLeadColumn['id']) {
  return Array.from(
    new Set(
      rows
        .map((row) => String(row[columnId] ?? '').trim())
        .filter((value) => value.length > 0 && value !== '—')
    )
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

function isSelectableIncomingLead(record: IncomingLeadRecord) {
  return Boolean(record.id)
}

function formatDateOnly(value: string | null) {
  if (!value) return '—'

  const date = parseFlexibleDateInput(value)
  if (!date) return value

  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    ...(hasTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

function toDateTimeLocalValue(value: string) {
  return toDateTimeLocalInputValue(value)
}

function convertDateTimeLocalToMysql(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = trimmed.replace('T', ' ')
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function getDateOnlyValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateOnlyValue(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatPayload(payload: unknown) {
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function webhookStatusBadge(status: string) {
  switch (status) {
    case 'PROCESSED':
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Processed</Badge>
    case 'DUPLICATE':
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Duplicate</Badge>
    case 'FAILED':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function createIncomingLeadEditDraft(record: IncomingLeadRecord, canViewPhone: boolean): IncomingLeadEditDraft {
  const values = extractIncomingLeadEditValues(record.payload, {
    externalCampaignId: record.externalCampaignId,
    source: record.source,
  })

  return {
    ...values,
    Lead_Date: toDateTimeLocalValue(values.Lead_Date),
    Patient_Number: canViewPhone ? values.Patient_Number : '',
  }
}

function compareValues(left: string, right: string, type: ColumnType) {
  if (type === 'date') {
    const leftValue = left ? new Date(`${left}T00:00:00`).getTime() : 0
    const rightValue = right ? new Date(`${right}T00:00:00`).getTime() : 0
    return leftValue - rightValue
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function isWithinDateRange(value: string, from: string, to: string) {
  const dateOnlyValue = getDateOnlyValue(value)
  if (!dateOnlyValue) return false
  if (from && dateOnlyValue < from) return false
  if (to && dateOnlyValue > to) return false
  return true
}

function DateRangeFilter({
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: {
  label: string
  fromValue: string
  toValue: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const fromDate = fromValue ? parseDateOnlyValue(fromValue) : undefined
  const toDate = toValue ? parseDateOnlyValue(toValue) : undefined

  return (
    <div className="space-y-2">
      <Label>{label} between</Label>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="flex-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                {fromDate ? format(fromDate, 'PPP') : label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => onFromChange(date ? format(date, 'yyyy-MM-dd') : '')}
                defaultMonth={fromDate ?? new Date()}
              />
            </PopoverContent>
          </Popover>
          {fromValue ? (
            <Button type="button" variant="outline" size="icon" onClick={() => onFromChange('')} aria-label={`Clear ${label} from date`}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <span className="hidden text-center text-sm text-muted-foreground sm:block">and</span>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="flex-1 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                {toDate ? format(toDate, 'PPP') : label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => onToChange(date ? format(date, 'yyyy-MM-dd') : '')}
                defaultMonth={toDate ?? fromDate ?? new Date()}
              />
            </PopoverContent>
          </Popover>
          {toValue ? (
            <Button type="button" variant="outline" size="icon" onClick={() => onToChange('')} aria-label={`Clear ${label} to date`}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CrmIncomingLeadsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const initialMonthYear = getInitialMonthYear()
  const initialStatusFilter = searchParams.get('status')?.trim() ?? ''
  const [month, setMonth] = useState(ALL_MONTHS_VALUE)
  const [year, setYear] = useState(String(initialMonthYear.year))
  const [searchColumn, setSearchColumn] = useState<IncomingLeadColumn['id']>('patientName')
  const [searchValue, setSearchValue] = useState('')
  const [sortColumn, setSortColumn] = useState<IncomingLeadColumn['id']>('receivedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [visibleColumns, setVisibleColumns] = useState(createInitialVisibleColumns)
  const [tableFilterVersion, setTableFilterVersion] = useState(0)
  const [selectedIncomingLead, setSelectedIncomingLead] = useState<IncomingLeadRecord | null>(null)
  const [incomingLeadEditMode, setIncomingLeadEditMode] = useState(false)
  const [incomingLeadEditDraft, setIncomingLeadEditDraft] = useState<IncomingLeadEditDraft>(
    EMPTY_INCOMING_LEAD_EDIT_DRAFT
  )
  const [selectedManualAssignLeadIds, setSelectedManualAssignLeadIds] = useState<string[]>([])
  const [visibleTableLeadIds, setVisibleTableLeadIds] = useState<string[]>([])
  const [manualAssignDialogOpen, setManualAssignDialogOpen] = useState(false)
  const [manualCreateDialogOpen, setManualCreateDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState('50')
  const [assignDateFrom, setAssignDateFrom] = useState('')
  const [assignDateTo, setAssignDateTo] = useState('')
  const [leadDateFrom, setLeadDateFrom] = useState('')
  const [leadDateTo, setLeadDateTo] = useState('')
  const [followUpDateFrom, setFollowUpDateFrom] = useState('')
  const [followUpDateTo, setFollowUpDateTo] = useState('')
  const [surgeryDateFrom, setSurgeryDateFrom] = useState('')
  const [surgeryDateTo, setSurgeryDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState(
    initialStatusFilter.length > 0 ? initialStatusFilter : ALL_FILTER_VALUE
  )
  const [sourceFilter, setSourceFilter] = useState(ALL_FILTER_VALUE)
  const [campaignSourceFilter, setCampaignSourceFilter] = useState(ALL_FILTER_VALUE)
  const [leadSourceFilter, setLeadSourceFilter] = useState(ALL_FILTER_VALUE)
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER_VALUE)
  const [treatmentFilter, setTreatmentFilter] = useState(ALL_FILTER_VALUE)
  const [circleFilter, setCircleFilter] = useState(ALL_FILTER_VALUE)
  const [cityFilter, setCityFilter] = useState(ALL_FILTER_VALUE)
  const [teamLeadFilter, setTeamLeadFilter] = useState(ALL_FILTER_VALUE)
  const [bdFilter, setBdFilter] = useState(ALL_FILTER_VALUE)
  const [headerColumnFilters, setHeaderColumnFilters] = useState<Record<number, string[]>>({})

  const hasAccess = Boolean(user?.role && INCOMING_LEAD_VIEW_ROLES.has(user.role))
  const canManuallyAssignFailedLeads = user?.role === 'SUPER_ADMIN'
  const canCreateManualLeads = user?.role === 'SUPER_ADMIN'
  const canEditIncomingLeads = user?.role === 'SUPER_ADMIN' || user?.role === 'CRM_ADMIN'
  const canViewIncomingLeadPhone = user?.role === 'ADMIN'
  const selectedMonth = month === ALL_MONTHS_VALUE ? null : Number.parseInt(month, 10) || initialMonthYear.month
  const selectedYear = Number.parseInt(year, 10) || initialMonthYear.year

  const incomingLeadEditGroups = useMemo(
    () =>
      MANUAL_MYSQL_LEAD_SECTION_ORDER.map((section) => ({
        section,
        fields: MANUAL_MYSQL_LEAD_FIELDS.filter(
          (field) =>
            field.section === section &&
            !HIDDEN_INCOMING_LEAD_EDIT_FIELD_KEYS.has(field.key)
        ),
      })).filter(
        (group) =>
          group.fields.length > 0 && !HIDDEN_INCOMING_LEAD_EDIT_SECTIONS.has(group.section)
      ),
    []
  )

  const availableIncomingLeadColumns = useMemo(() => INCOMING_LEAD_COLUMNS, [])

  const availableIncomingLeadHeaderFilters = useMemo(
    () =>
      INCOMING_LEAD_HEADER_FILTER_COLUMN_IDS.flatMap((columnId) => {
        const column = availableIncomingLeadColumns.find((entry) => entry.id === columnId)
        return column ? [column.label] : []
      }),
    [availableIncomingLeadColumns]
  )

  const effectiveSearchColumn = useMemo<IncomingLeadColumn['id']>(
    () =>
      availableIncomingLeadColumns.some((column) => column.id === searchColumn)
        ? searchColumn
        : (availableIncomingLeadColumns[0]?.id ?? searchColumn),
    [availableIncomingLeadColumns, searchColumn]
  )
  const serverPhoneSearch = useMemo(
    () =>
      effectiveSearchColumn === 'normalizedPhone'
        ? parsePhoneSearchQuery(searchValue)
        : null,
    [effectiveSearchColumn, searchValue]
  )

  const effectiveSortColumn = useMemo<IncomingLeadColumn['id']>(
    () =>
      availableIncomingLeadColumns.some((column) => column.id === sortColumn)
        ? sortColumn
        : (availableIncomingLeadColumns[0]?.id ?? sortColumn),
    [availableIncomingLeadColumns, sortColumn]
  )

  const { data, isLoading, error, refetch, isFetching } = useQuery<IncomingLeadPageData, Error>({
    queryKey: ['crm-incoming-leads', selectedMonth, selectedYear, effectiveSearchColumn, serverPhoneSearch?.last10 ?? ''],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedMonth !== null) {
        params.set('month', String(selectedMonth))
        params.set('year', String(selectedYear))
      }
      if (serverPhoneSearch && effectiveSearchColumn === 'normalizedPhone') {
        params.set('searchColumn', 'normalizedPhone')
        params.set('searchValue', searchValue.trim())
      }
      const query = params.toString()
      return apiGet<IncomingLeadPageData>(query ? `/api/crm/incoming-leads?${query}` : '/api/crm/incoming-leads')
    },
    retry: false,
    enabled: hasAccess,
  })

  const manualAssignOptionsQuery = useQuery<IncomingLeadManualAssignOptions, Error>({
    queryKey: ['crm-incoming-leads-manual-assign-options'],
    queryFn: () => apiGet<IncomingLeadManualAssignOptions>('/api/crm/incoming-leads/manual-assign'),
    retry: false,
    enabled: hasAccess && canManuallyAssignFailedLeads,
  })

  const incomingLeadCategoryOptions = useMemo(
    () => (data?.masters.treatmentCategories ?? []).filter((item) => item.isActive !== false),
    [data?.masters.treatmentCategories]
  )

  const incomingLeadTreatmentOptions = useMemo(() => {
    const selectedCategory = incomingLeadEditDraft.Category.trim()
    const base = (data?.masters.treatments ?? []).filter((item) => item.isActive !== false)
    if (!selectedCategory) return base
    return base.filter((item) => item.category === selectedCategory)
  }, [data?.masters.treatments, incomingLeadEditDraft.Category])

  const incomingLeadSourceOptions = useMemo(
    () => (data?.masters.sources ?? []).filter((item) => item.isActive !== false),
    [data?.masters.sources]
  )

  const incomingLeadLeadSourceOptions = useMemo(() => {
    const selectedSource = incomingLeadEditDraft.Source.trim()
    const base = (data?.masters.leadSources ?? []).filter((item) => item.isActive !== false)
    if (!selectedSource) return base
    return base.filter((item) => item.source.name === selectedSource)
  }, [data?.masters.leadSources, incomingLeadEditDraft.Source])

  const rows = useMemo<IncomingLeadTableRow[]>(() => {
    const campaignByExternalId = new Map(
      (data?.campaigns ?? []).map((campaign) => [campaign.externalCampaignId, campaign])
    )

    return (data?.incomingLeads ?? []).map((incomingLead) => {
      const mappedCampaign = incomingLead.externalCampaignId
        ? campaignByExternalId.get(incomingLead.externalCampaignId)
        : null

      return {
        id: incomingLead.id,
        receivedAt: incomingLead.receivedAt,
        processedAt: incomingLead.processedAt ?? '',
        status: incomingLead.status,
        source: incomingLead.source ?? '—',
        externalCampaignId: incomingLead.externalCampaignId ?? '—',
        payloadCampaignId: incomingLead.summary.campaignId ?? '—',
        campaignName: incomingLead.campaign?.displayName ?? 'Unmapped campaign',
        campaignSource: mappedCampaign?.source.name ?? '—',
        leadSource: mappedCampaign?.leadSource.name ?? '—',
        category:
          incomingLead.processedLead?.category ??
          incomingLead.summary.category ??
          mappedCampaign?.category ??
          '—',
        treatment:
          incomingLead.processedLead?.treatment ??
          incomingLead.summary.treatment ??
          mappedCampaign?.treatmentMaster?.name ??
          '—',
        circle: incomingLead.summary.circle ?? mappedCampaign?.circle.name ?? '—',
        city: incomingLead.summary.city ?? '—',
        patientName: incomingLead.summary.patientName ?? '—',
        email: incomingLead.summary.email ?? '—',
        normalizedPhone: incomingLead.normalizedPhone ?? '—',
        assignedDate: incomingLead.processedLead?.assignedDate ?? '',
        leadDate: incomingLead.processedLead?.leadEntryDate ?? incomingLead.summary.leadDate ?? '',
        followUpDate: incomingLead.processedLead?.followUpDate ?? '',
        surgeryDate: incomingLead.processedLead?.surgeryDate ?? '',
        processedLeadRef: incomingLead.processedLead?.leadRef ?? '—',
        processedLeadPatientName: incomingLead.processedLead?.patientName ?? '—',
        processedLeadPhoneNumber: incomingLead.processedLead?.phoneNumber ?? '—',
        teamLeadName: incomingLead.teamLead?.name ?? '—',
        teamLeadEmail: incomingLead.teamLead?.email ?? '—',
        bdName: incomingLead.bd?.name ?? '—',
        bdEmail: incomingLead.bd?.email ?? '—',
        errorMessage: incomingLead.errorMessage ?? '—',
        raw: incomingLead,
      }
    })
  }, [data?.campaigns, data?.incomingLeads])

  const visibleColumnDefinitions = useMemo(
    () => availableIncomingLeadColumns.filter((column) => visibleColumns[column.id]),
    [availableIncomingLeadColumns, visibleColumns]
  )
  const areAllIncomingLeadColumnsVisible = useMemo(
    () => availableIncomingLeadColumns.every((column) => visibleColumns[column.id]),
    [availableIncomingLeadColumns, visibleColumns]
  )

  const allColumnOptions = useMemo(() => {
    const optionsMap: Record<number, string[]> = {}
    visibleColumnDefinitions.forEach((col, idx) => {
      const colIndex = idx + (canManuallyAssignFailedLeads ? 1 : 0)
      optionsMap[colIndex] = getUniqueRowValues(rows, col.id)
    })
    return optionsMap
  }, [visibleColumnDefinitions, rows, canManuallyAssignFailedLeads])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    const selectedSearchColumn = availableIncomingLeadColumns.find((column) => column.id === effectiveSearchColumn)

    return rows.filter((row) => {
      for (const [colIndexStr, filterValues] of Object.entries(headerColumnFilters)) {
        if (!filterValues || filterValues.length === 0) continue
        const colIndex = Number(colIndexStr)
        const colDefIdx = colIndex - (canManuallyAssignFailedLeads ? 1 : 0)
        const colDef = visibleColumnDefinitions[colDefIdx]
        if (!colDef) continue

        const rawValue = String(row[colDef.id] ?? '').trim()
        if (colDef.type === 'date' && filterValues.length === 2) {
          const [startStr, endStr] = filterValues
          if (!isWithinDateRange(rawValue, getDateOnlyValue(startStr), getDateOnlyValue(endStr))) {
            return false
          }
        } else if (!filterValues.includes(rawValue)) {
          return false
        }
      }

      if (assignDateFrom || assignDateTo) {
        if (!isWithinDateRange(row.assignedDate, assignDateFrom, assignDateTo)) return false
      }

      if (leadDateFrom || leadDateTo) {
        if (!isWithinDateRange(row.leadDate, leadDateFrom, leadDateTo)) return false
      }

      if (followUpDateFrom || followUpDateTo) {
        if (!isWithinDateRange(row.followUpDate, followUpDateFrom, followUpDateTo)) return false
      }

      if (surgeryDateFrom || surgeryDateTo) {
        if (!isWithinDateRange(row.surgeryDate, surgeryDateFrom, surgeryDateTo)) return false
      }

      if (statusFilter !== ALL_FILTER_VALUE && row.status !== statusFilter) return false
      if (sourceFilter !== ALL_FILTER_VALUE && row.source !== sourceFilter) return false
      if (campaignSourceFilter !== ALL_FILTER_VALUE && row.campaignSource !== campaignSourceFilter) return false
      if (leadSourceFilter !== ALL_FILTER_VALUE && row.leadSource !== leadSourceFilter) return false
      if (categoryFilter !== ALL_FILTER_VALUE && row.category !== categoryFilter) return false
      if (treatmentFilter !== ALL_FILTER_VALUE && row.treatment !== treatmentFilter) return false
      if (circleFilter !== ALL_FILTER_VALUE && row.circle !== circleFilter) return false
      if (cityFilter !== ALL_FILTER_VALUE && row.city !== cityFilter) return false
      if (teamLeadFilter !== ALL_FILTER_VALUE && row.teamLeadName !== teamLeadFilter) return false
      if (bdFilter !== ALL_FILTER_VALUE && row.bdName !== bdFilter) return false

      if (!normalizedSearch) return true

      if (effectiveSearchColumn === 'normalizedPhone' && serverPhoneSearch) {
        return true
      }

      const rawValue = String(row[effectiveSearchColumn] ?? '')
      if (selectedSearchColumn?.type === 'date') {
        const dateOnlyValue = getDateOnlyValue(rawValue)
        const displayValue = formatDateOnly(rawValue).toLowerCase()
        return `${dateOnlyValue} ${displayValue}`.includes(normalizedSearch)
      }
      if (selectedSearchColumn?.masterKey) {
        return rawValue.trim().toLowerCase() === normalizedSearch
      }
      return rawValue.toLowerCase().includes(normalizedSearch)
    })
  }, [
    rows,
    effectiveSearchColumn,
    searchValue,
    statusFilter,
    sourceFilter,
    campaignSourceFilter,
    leadSourceFilter,
    categoryFilter,
    treatmentFilter,
    circleFilter,
    cityFilter,
    teamLeadFilter,
    bdFilter,
    assignDateFrom,
    assignDateTo,
    leadDateFrom,
    leadDateTo,
    followUpDateFrom,
    followUpDateTo,
    surgeryDateFrom,
    surgeryDateTo,
    headerColumnFilters,
    visibleColumnDefinitions,
    canManuallyAssignFailedLeads,
    availableIncomingLeadColumns,
    serverPhoneSearch,
  ])

  const sortedRows = useMemo(() => {
    const selectedSortColumn = availableIncomingLeadColumns.find((column) => column.id === effectiveSortColumn)
    if (!selectedSortColumn) return filteredRows

    const nextRows = [...filteredRows].sort((left, right) =>
      compareValues(
        selectedSortColumn.type === 'date'
          ? getDateOnlyValue(String(left[effectiveSortColumn] ?? ''))
          : String(left[effectiveSortColumn] ?? ''),
        selectedSortColumn.type === 'date'
          ? getDateOnlyValue(String(right[effectiveSortColumn] ?? ''))
          : String(right[effectiveSortColumn] ?? ''),
        selectedSortColumn.type
      )
    )

    if (sortDirection === 'desc') {
      nextRows.reverse()
    }

    return nextRows
  }, [availableIncomingLeadColumns, effectiveSortColumn, filteredRows, sortDirection])

  const pageSizeNumber = Number.parseInt(pageSize, 10) || 50
  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSizeNumber))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = totalRows === 0 ? 0 : (safeCurrentPage - 1) * pageSizeNumber
  const pageEndIndex = totalRows === 0 ? 0 : Math.min(pageStartIndex + pageSizeNumber, totalRows)

  const paginatedRows = useMemo(
    () => sortedRows.slice(pageStartIndex, pageEndIndex),
    [pageEndIndex, pageStartIndex, sortedRows]
  )

  const selectedManualAssignLeads = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            selectedManualAssignLeadIds.includes(row.id) && isSelectableIncomingLead(row.raw)
        )
        .map((row) => ({
          id: row.id,
          patientName: row.patientName,
          externalCampaignId: row.externalCampaignId,
          source: row.source,
          status: row.status,
        })),
    [rows, selectedManualAssignLeadIds]
  )

  const selectedRetryableLeadIds = useMemo(
    () =>
      rows
        .filter((row) => selectedManualAssignLeadIds.includes(row.id) && row.status === 'FAILED')
        .map((row) => row.id),
    [rows, selectedManualAssignLeadIds]
  )

  const visibleSelectableLeadIds = useMemo(
    () =>
      visibleTableLeadIds.filter((leadId) =>
        paginatedRows.some((row) => row.id === leadId && isSelectableIncomingLead(row.raw))
      ),
    [paginatedRows, visibleTableLeadIds]
  )

  const allVisibleSelectableRowsSelected =
    visibleSelectableLeadIds.length > 0 &&
    visibleSelectableLeadIds.every((leadId) => selectedManualAssignLeadIds.includes(leadId))
  const someVisibleSelectableRowsSelected =
    visibleSelectableLeadIds.some((leadId) => selectedManualAssignLeadIds.includes(leadId)) &&
    !allVisibleSelectableRowsSelected

  const handleVisibleRowIdsChange = useCallback((nextVisibleRowIds: string[]) => {
    setVisibleTableLeadIds((current) =>
      current.length === nextVisibleRowIds.length &&
      current.every((leadId, index) => leadId === nextVisibleRowIds[index])
        ? current
        : nextVisibleRowIds
    )
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [
    month,
    year,
    searchColumn,
    searchValue,
    sortColumn,
    sortDirection,
    assignDateFrom,
    assignDateTo,
    leadDateFrom,
    leadDateTo,
    followUpDateFrom,
    followUpDateTo,
    surgeryDateFrom,
    surgeryDateTo,
    statusFilter,
    sourceFilter,
    campaignSourceFilter,
    leadSourceFilter,
    categoryFilter,
    treatmentFilter,
    circleFilter,
    cityFilter,
    teamLeadFilter,
    bdFilter,
    pageSize,
  ])

  useEffect(() => {
    const eligibleLeadIds = new Set(
      rows
        .filter((row) => isSelectableIncomingLead(row.raw))
        .map((row) => row.id)
    )

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedManualAssignLeadIds((current) =>
      current.filter((leadId) => eligibleLeadIds.has(leadId))
    )
  }, [rows])

  useEffect(() => {
    const paginatedLeadIdSet = new Set(paginatedRows.map((row) => row.id))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleTableLeadIds((current) => {
      const next = current.filter((leadId) => paginatedLeadIdSet.has(leadId))
      return current.length === next.length &&
        current.every((leadId, index) => leadId === next[index])
        ? current
        : next
    })
  }, [paginatedRows])

  const selectedSearchColumnDefinition = useMemo(
    () => availableIncomingLeadColumns.find((column) => column.id === effectiveSearchColumn) ?? null,
    [availableIncomingLeadColumns, effectiveSearchColumn]
  )

  const masterFilterOptions = useMemo(() => {
    if (!selectedSearchColumnDefinition?.masterKey) return []
    const values = (data?.masters[selectedSearchColumnDefinition.masterKey] ?? []).map((entry) => entry.name)
    return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    )
  }, [data?.masters, selectedSearchColumnDefinition])

  const filterOptions = useMemo(() => {
    const circleScopedRows =
      circleFilter === ALL_FILTER_VALUE ? rows : rows.filter((row) => row.circle === circleFilter)
    const teamLeadScopedRows =
      teamLeadFilter === ALL_FILTER_VALUE ? rows : rows.filter((row) => row.teamLeadName === teamLeadFilter)

    return {
      statuses: getUniqueRowValues(rows, 'status'),
      sources: getUniqueRowValues(rows, 'source'),
      campaignSources: getUniqueRowValues(rows, 'campaignSource'),
      leadSources: getUniqueRowValues(rows, 'leadSource'),
      categories: getUniqueRowValues(rows, 'category'),
      treatments: getUniqueRowValues(rows, 'treatment'),
      circles: getUniqueRowValues(rows, 'circle'),
      cities: getUniqueRowValues(circleScopedRows, 'city'),
      teamLeads: getUniqueRowValues(rows, 'teamLeadName'),
      bds: getUniqueRowValues(teamLeadScopedRows, 'bdName'),
    }
  }, [circleFilter, rows, teamLeadFilter])

  const activeFilterCount = useMemo(
    () =>
      [
        searchValue.trim().length > 0,
        assignDateFrom,
        assignDateTo,
        leadDateFrom,
        leadDateTo,
        followUpDateFrom,
        followUpDateTo,
        surgeryDateFrom,
        surgeryDateTo,
        statusFilter !== ALL_FILTER_VALUE,
        sourceFilter !== ALL_FILTER_VALUE,
        campaignSourceFilter !== ALL_FILTER_VALUE,
        leadSourceFilter !== ALL_FILTER_VALUE,
        categoryFilter !== ALL_FILTER_VALUE,
        treatmentFilter !== ALL_FILTER_VALUE,
        circleFilter !== ALL_FILTER_VALUE,
        cityFilter !== ALL_FILTER_VALUE,
        teamLeadFilter !== ALL_FILTER_VALUE,
        bdFilter !== ALL_FILTER_VALUE,
        Object.keys(headerColumnFilters).length > 0,
      ].filter(Boolean).length,
    [
      assignDateFrom,
      assignDateTo,
      bdFilter,
      campaignSourceFilter,
      categoryFilter,
      circleFilter,
      cityFilter,
      treatmentFilter,
      followUpDateFrom,
      followUpDateTo,
      headerColumnFilters,
      leadDateFrom,
      leadDateTo,
      leadSourceFilter,
      searchValue,
      sourceFilter,
      statusFilter,
      surgeryDateFrom,
      surgeryDateTo,
      teamLeadFilter,
    ]
  )

  const clearFilters = () => {
    setHeaderColumnFilters({})
    setSearchValue('')
    setAssignDateFrom('')
    setAssignDateTo('')
    setLeadDateFrom('')
    setLeadDateTo('')
    setFollowUpDateFrom('')
    setFollowUpDateTo('')
    setSurgeryDateFrom('')
    setSurgeryDateTo('')
    setStatusFilter(ALL_FILTER_VALUE)
    setSourceFilter(ALL_FILTER_VALUE)
    setCampaignSourceFilter(ALL_FILTER_VALUE)
    setLeadSourceFilter(ALL_FILTER_VALUE)
    setCategoryFilter(ALL_FILTER_VALUE)
    setTreatmentFilter(ALL_FILTER_VALUE)
    setCircleFilter(ALL_FILTER_VALUE)
    setCityFilter(ALL_FILTER_VALUE)
    setTeamLeadFilter(ALL_FILTER_VALUE)
    setBdFilter(ALL_FILTER_VALUE)
  }

  const clearColumnFilters = () => {
    setHeaderColumnFilters({})
    setTableFilterVersion((current) => current + 1)
    setCurrentPage(1)
  }

  const handleColumnFilterChange = useCallback((colIndex: number, selected: string[]) => {
    setHeaderColumnFilters((prev) => {
      const next = { ...prev }
      if (selected.length === 0) {
        delete next[colIndex]
      } else {
        next[colIndex] = selected
      }
      return next
    })
    setCurrentPage(1)
  }, [])

  function toggleManualAssignLead(leadId: string, checked: boolean) {
    if (checked) {
      setSelectedManualAssignLeadIds((current) =>
        current.includes(leadId) ? current : [...current, leadId]
      )
      return
    }

    setSelectedManualAssignLeadIds((current) => current.filter((id) => id !== leadId))
  }

  const manualAssignMutation = useMutation({
    mutationFn: (payload: { incomingLeadIds: string[]; assigneeUserIds: string[] }) =>
      apiPost<IncomingLeadManualAssignResult>(
        '/api/crm/incoming-leads/manual-assign',
        payload
      ),
    onSuccess: async (result) => {
      const totalAssigned = result.processedCount + result.duplicateCount
      if (result.failedCount > 0) {
        toast.error(
          `Assigned ${totalAssigned} incoming lead${totalAssigned === 1 ? '' : 's'}, ${result.failedCount} failed`
        )
      } else {
        toast.success(
          `Assigned ${totalAssigned} incoming lead${totalAssigned === 1 ? '' : 's'}`
        )
      }

      setSelectedManualAssignLeadIds([])
      setManualAssignDialogOpen(false)
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['crm-incoming-leads-manual-assign-options'] }),
      ])
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign incoming leads')
    },
  })

  const retryFailedLeadsMutation = useMutation({
    mutationFn: (payload: { incomingLeadIds: string[] }) =>
      apiPost<IncomingLeadRetryResult>('/api/crm/incoming-leads/retry', payload),
    onSuccess: async (result) => {
      if (result.failedCount > 0) {
        toast.error(
          `Retried ${result.processedCount} failed lead${result.processedCount === 1 ? '' : 's'}, ${result.failedCount} still failed`
        )
      } else if (result.skippedCount > 0) {
        toast.success(
          `Retried ${result.processedCount} failed lead${result.processedCount === 1 ? '' : 's'}, ${result.skippedCount} skipped`
        )
      } else {
        toast.success(
          `Retried ${result.processedCount} failed lead${result.processedCount === 1 ? '' : 's'} successfully`
        )
      }

      setSelectedManualAssignLeadIds((current) =>
        current.filter((leadId) => !selectedRetryableLeadIds.includes(leadId))
      )
      await refetch()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to retry selected incoming leads')
    },
  })

  const editIncomingLeadMutation = useMutation({
    mutationFn: (payload: { incomingLeadId: string; data: Record<string, string | null> }) =>
      apiPatch<IncomingLeadRecord>(
        `/api/crm/incoming-leads/${payload.incomingLeadId}`,
        payload.data,
      ),
    onSuccess: async (updatedIncomingLead) => {
      toast.success('Incoming lead updated')
      setSelectedIncomingLead(updatedIncomingLead)
      setIncomingLeadEditDraft(
        createIncomingLeadEditDraft(updatedIncomingLead, canViewIncomingLeadPhone),
      )
      setIncomingLeadEditMode(false)
      await refetch()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update incoming lead')
    },
  })

  const summary = useMemo(() => {
    const total = rows.length
    const processed = rows.filter((row) => row.status === 'PROCESSED').length
    const duplicates = rows.filter((row) => row.status === 'DUPLICATE').length
    const failed = rows.filter((row) => row.status === 'FAILED').length
    return { total, processed, duplicates, failed }
  }, [rows])

  const errorMessage =
    error instanceof Error ? error.message : 'We could not load the incoming lead audit right now.'

  const handleIncomingLeadEditSave = useCallback(async () => {
    if (!selectedIncomingLead) return

    const trimmedPatientName = incomingLeadEditDraft.Patient_Name.trim()
    const trimmedPhone = incomingLeadEditDraft.Patient_Number.trim()

    if (trimmedPatientName.length === 0) {
      toast.error('Patient name is required')
      return
    }

    if (canViewIncomingLeadPhone && trimmedPhone.length === 0) {
      toast.error('Phone number is required')
      return
    }

    const currentDraft = createIncomingLeadEditDraft(
      selectedIncomingLead,
      canViewIncomingLeadPhone
    )
    const payload: Record<string, string | null> = {}
    const draftKeys = Object.keys(EMPTY_INCOMING_LEAD_EDIT_DRAFT) as Array<
      keyof IncomingLeadEditDraft
    >

    for (const key of draftKeys) {
      const nextValue =
        key === 'Lead_Date'
          ? convertDateTimeLocalToMysql(incomingLeadEditDraft[key])
          : incomingLeadEditDraft[key].trim()
      const currentValue =
        key === 'Lead_Date'
          ? convertDateTimeLocalToMysql(currentDraft[key])
          : currentDraft[key].trim()

      if (key === 'Patient_Number' && !canViewIncomingLeadPhone && nextValue.length === 0) {
        continue
      }

      if (nextValue !== currentValue) {
        payload[key] = nextValue || null
      }
    }

    if (Object.keys(payload).length === 0) {
      setIncomingLeadEditMode(false)
      return
    }

    await editIncomingLeadMutation.mutateAsync({
      incomingLeadId: selectedIncomingLead.id,
      data: payload,
    })
  }, [
    canViewIncomingLeadPhone,
    editIncomingLeadMutation,
    incomingLeadEditDraft,
    selectedIncomingLead,
  ])

  const handleIncomingLeadEditFieldChange = useCallback(
    (key: keyof IncomingLeadEditDraft, value: string) => {
      setIncomingLeadEditDraft((current) => {
        const next = {
          ...current,
          [key]: value,
        }

        if (key === 'Category' && current.Category !== value) {
          next.Treatment = ''
        }

        if (key === 'Source' && current.Source !== value) {
          next.Lead_Source = ''
        }

        return next
      })
    },
    []
  )

  const openIncomingLeadSheet = useCallback(
    (incomingLead: IncomingLeadRecord, mode: 'view' | 'edit') => {
      setSelectedIncomingLead(incomingLead)
      setIncomingLeadEditDraft(
        createIncomingLeadEditDraft(incomingLead, canViewIncomingLeadPhone),
      )
      setIncomingLeadEditMode(mode === 'edit')
    },
    [canViewIncomingLeadPhone],
  )

  return (
    <ProtectedRoute>
      <div className="mx-auto w-full min-w-0 max-w-full space-y-6 p-4 md:p-6 xl:max-w-[1800px]">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Inbox className="h-8 w-8 text-cyan-600" />
              CRM Incoming Leads
            </h1>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              Review queued inbound leads from webhook and MySQL intake with searchable columns, column-based sorting, and column visibility controls.
            </p>
          </div>

          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[180px_140px_auto] xl:items-end">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full xl:w-[180px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MONTHS_VALUE}>All months</SelectItem>
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
                className="w-full xl:w-[140px]"
                disabled={selectedMonth === null}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching || !hasAccess} className="w-full xl:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {!isAuthLoading && !hasAccess ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>No access</CardTitle>
              <CardDescription>
                This incoming lead audit is available to Super Admin and CRM Admin users.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total webhooks</CardDescription>
                  <CardTitle>{formatWholeNumber(summary.total)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Processed</CardDescription>
                  <CardTitle>{formatWholeNumber(summary.processed)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Duplicates</CardDescription>
                  <CardTitle>{formatWholeNumber(summary.duplicates)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Failed</CardDescription>
                  <CardTitle>{formatWholeNumber(summary.failed)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>View controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  <div className="min-w-0 space-y-2">
                    <Label>Search column</Label>
                    <Select
                      value={effectiveSearchColumn}
                      onValueChange={(value) => {
                        setSearchColumn(value as IncomingLeadColumn['id'])
                        setSearchValue('')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIncomingLeadColumns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Search value</Label>
                    {selectedSearchColumnDefinition?.type === 'date' ? (
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="flex-1 justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                              {searchValue ? format(parseDateOnlyValue(searchValue) ?? new Date(), 'PPP') : 'Pick date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={searchValue ? parseDateOnlyValue(searchValue) : undefined}
                              onSelect={(date) => setSearchValue(date ? format(date, 'yyyy-MM-dd') : '')}
                              defaultMonth={searchValue ? parseDateOnlyValue(searchValue) : new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                        {searchValue ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setSearchValue('')}
                            aria-label="Clear date filter"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : selectedSearchColumnDefinition?.masterKey ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={searchValue || ALL_FILTER_VALUE}
                          onValueChange={(value) => setSearchValue(value === ALL_FILTER_VALUE ? '' : value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={`Select ${selectedSearchColumnDefinition.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_FILTER_VALUE}>All values</SelectItem>
                            {masterFilterOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {searchValue ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setSearchValue('')}
                            aria-label="Clear selected filter"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <Input
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder={`Search ${selectedSearchColumnDefinition?.label.toLowerCase() ?? 'column'}...`}
                      />
                    )}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Sort by</Label>
                    <Select
                      value={effectiveSortColumn}
                      onValueChange={(value) => setSortColumn(value as IncomingLeadColumn['id'])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableIncomingLeadColumns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Direction</Label>
                    <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>&nbsp;</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={clearFilters}
                      disabled={activeFilterCount === 0}
                    >
                      Clear filters
                      {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 border-t pt-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                  <div className="min-w-0 space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All statuses</SelectItem>
                        {filterOptions.statuses.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Source</Label>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All sources</SelectItem>
                        {filterOptions.sources.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Campaign source</Label>
                    <Select value={campaignSourceFilter} onValueChange={setCampaignSourceFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All campaign sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All campaign sources</SelectItem>
                        {filterOptions.campaignSources.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Lead source</Label>
                    <Select value={leadSourceFilter} onValueChange={setLeadSourceFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All lead sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All lead sources</SelectItem>
                        {filterOptions.leadSources.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All categories</SelectItem>
                        {filterOptions.categories.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Treatment</Label>
                    <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All treatments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All treatments</SelectItem>
                        {filterOptions.treatments.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Circle</Label>
                    <Select
                      value={circleFilter}
                      onValueChange={(value) => {
                        setCircleFilter(value)
                        setCityFilter(ALL_FILTER_VALUE)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All circles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All circles</SelectItem>
                        {filterOptions.circles.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>City</Label>
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All cities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All cities</SelectItem>
                        {filterOptions.cities.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Team Lead</Label>
                    <Select
                      value={teamLeadFilter}
                      onValueChange={(value) => {
                        setTeamLeadFilter(value)
                        setBdFilter(ALL_FILTER_VALUE)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All team leads" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All team leads</SelectItem>
                        {filterOptions.teamLeads.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>BD</Label>
                    <Select value={bdFilter} onValueChange={setBdFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All BDs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All BDs</SelectItem>
                        {filterOptions.bds.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 border-t pt-5 md:grid-cols-2 2xl:grid-cols-4">
                  <DateRangeFilter
                    label="Assign Date"
                    fromValue={assignDateFrom}
                    toValue={assignDateTo}
                    onFromChange={setAssignDateFrom}
                    onToChange={setAssignDateTo}
                  />
                  <DateRangeFilter
                    label="Lead Date"
                    fromValue={leadDateFrom}
                    toValue={leadDateTo}
                    onFromChange={setLeadDateFrom}
                    onToChange={setLeadDateTo}
                  />
                  <DateRangeFilter
                    label="Follow up Date"
                    fromValue={followUpDateFrom}
                    toValue={followUpDateTo}
                    onFromChange={setFollowUpDateFrom}
                    onToChange={setFollowUpDateTo}
                  />
                  <DateRangeFilter
                    label="Surgery Date"
                    fromValue={surgeryDateFrom}
                    toValue={surgeryDateTo}
                    onFromChange={setSurgeryDateFrom}
                    onToChange={setSurgeryDateTo}
                  />
                </div>
              </CardContent>
            </Card>

            {error && !isLoading ? (
              <Card className="border-amber-300 bg-amber-50/70">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="space-y-1">
                    <CardTitle>Unable to load incoming leads</CardTitle>
                    <CardDescription className="text-amber-900/80">{errorMessage}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle>Incoming lead table</CardTitle>
                    <CardDescription>
                      {selectedMonth === null
                        ? `${pageStartIndex + (totalRows > 0 ? 1 : 0)}-${pageEndIndex} of ${formatWholeNumber(sortedRows.length)} rows across all months.`
                        : `${pageStartIndex + (totalRows > 0 ? 1 : 0)}-${pageEndIndex} of ${formatWholeNumber(sortedRows.length)} rows for ${MONTH_OPTIONS.find((option) => option.value === selectedMonth)?.label} ${selectedYear}.`}
                    </CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {canCreateManualLeads ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setManualCreateDialogOpen(true)}
                      >
                        Create manual leads
                      </Button>
                    ) : null}
                    {canManuallyAssignFailedLeads ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() =>
                          retryFailedLeadsMutation.mutate({
                            incomingLeadIds: selectedRetryableLeadIds,
                          })
                        }
                        disabled={
                          selectedRetryableLeadIds.length === 0 ||
                          retryFailedLeadsMutation.isPending
                        }
                      >
                        Retry
                        {selectedRetryableLeadIds.length > 0
                          ? ` (${selectedRetryableLeadIds.length})`
                          : ''}
                      </Button>
                    ) : null}
                    {canManuallyAssignFailedLeads ? (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setManualAssignDialogOpen(true)}
                        disabled={
                          selectedManualAssignLeads.length === 0 ||
                          manualAssignOptionsQuery.isLoading ||
                          !manualAssignOptionsQuery.data?.canManualAssign
                        }
                      >
                        Assign incoming leads
                        {selectedManualAssignLeads.length > 0
                          ? ` (${selectedManualAssignLeads.length})`
                          : ''}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={clearColumnFilters}
                    >
                      Clear column filters
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                          <SlidersHorizontal className="h-4 w-4" />
                          Columns
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[360px] w-64 overflow-y-auto">
                        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={areAllIncomingLeadColumnsVisible}
                          onSelect={(event) => event.preventDefault()}
                          onCheckedChange={(checked) => {
                            const nextValue = checked === true
                            setVisibleColumns(
                              Object.fromEntries(
                                availableIncomingLeadColumns.map((column) => [column.id, nextValue])
                              ) as Record<IncomingLeadColumn['id'], boolean>
                            )
                          }}
                        >
                          Select all
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {availableIncomingLeadColumns.map((column) => (
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
                </CardHeader>
                <CardContent>
                  <div className="w-full min-w-0 rounded-xl border">
                    <div className="max-h-[min(70vh,900px)] overflow-auto">
                      <Table
                        key={tableFilterVersion}
                        containerClassName="overflow-visible"
                        filterableHeaders={availableIncomingLeadHeaderFilters}
                        rowIds={paginatedRows.map((row) => row.id)}
                        onVisibleRowIdsChange={handleVisibleRowIdsChange}
                        externalColumnOptions={allColumnOptions}
                        externalActiveFilters={headerColumnFilters}
                        onFilterChange={handleColumnFilterChange}
                      >
                        <TableHeader className="sticky top-0 z-10 bg-background [&_tr]:border-b">
                          <TableRow className="bg-background hover:bg-background">
                            <TableHead className="w-[60px] text-center">S.No.</TableHead>
                            {canManuallyAssignFailedLeads ? (
                              <TableHead className="w-[52px] text-center">
                                <Checkbox
                                  checked={
                                    allVisibleSelectableRowsSelected
                                      ? true
                                      : someVisibleSelectableRowsSelected
                                        ? 'indeterminate'
                                        : false
                                  }
                                  onCheckedChange={(checked) => {
                                    const nextChecked = checked === true
                                    if (nextChecked) {
                                      setSelectedManualAssignLeadIds((current) =>
                                        Array.from(
                                          new Set([
                                            ...current,
                                            ...visibleSelectableLeadIds,
                                          ])
                                        )
                                      )
                                      return
                                    }

                                    setSelectedManualAssignLeadIds((current) =>
                                      current.filter(
                                        (leadId) => !visibleSelectableLeadIds.includes(leadId)
                                      )
                                    )
                                  }}
                                  disabled={visibleSelectableLeadIds.length === 0}
                                  aria-label="Select incoming leads on this page"
                                />
                              </TableHead>
                            ) : null}
                            {visibleColumnDefinitions.map((column) => (
                              <TableHead key={column.id}>{column.label}</TableHead>
                            ))}
                            <TableHead className="w-[120px] text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell
                                colSpan={visibleColumnDefinitions.length + 2 + (canManuallyAssignFailedLeads ? 1 : 0)}
                                className="py-10 text-center text-muted-foreground"
                              >
                                Loading incoming leads...
                              </TableCell>
                            </TableRow>
                          ) : sortedRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={visibleColumnDefinitions.length + 2 + (canManuallyAssignFailedLeads ? 1 : 0)}
                                className="py-10 text-center text-muted-foreground"
                              >
                                No incoming leads matched the selected month or filters.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedRows.map((row, index) => (
                              <TableRow key={row.id}>
                                <TableCell className="text-center font-medium text-muted-foreground whitespace-nowrap">
                                  {pageStartIndex + index + 1}
                                </TableCell>
                                {canManuallyAssignFailedLeads ? (
                                  <TableCell className="text-center">
                                    {isSelectableIncomingLead(row.raw) ? (
                                      <Checkbox
                                        checked={selectedManualAssignLeadIds.includes(row.id)}
                                        onCheckedChange={(checked) =>
                                          toggleManualAssignLead(row.id, checked === true)
                                        }
                                        aria-label={`Select incoming lead ${row.patientName}`}
                                      />
                                    ) : null}
                                  </TableCell>
                                ) : null}
                                {visibleColumnDefinitions.map((column) => (
                                  <TableCell key={`${row.id}-${column.id}`}>
                                    {column.cell ? column.cell(row) : row[column.id]}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openIncomingLeadSheet(row.raw, 'view')}
                                    >
                                      <Eye className="mr-2 h-4 w-4" />
                                      View
                                    </Button>
                                    {canEditIncomingLeads ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openIncomingLeadSheet(row.raw, 'edit')}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                      </Button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {!isLoading && sortedRows.length > 0 ? (
                      <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-muted-foreground">
                          Showing {pageStartIndex + 1}-{pageEndIndex} of {formatWholeNumber(totalRows)}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Select
                            value={pageSize}
                            onValueChange={(value) => {
                              setPageSize(value)
                              setCurrentPage(1)
                            }}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue placeholder="50 / page" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="25">25 / page</SelectItem>
                              <SelectItem value="50">50 / page</SelectItem>
                              <SelectItem value="100">100 / page</SelectItem>
                              <SelectItem value="200">200 / page</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((page) => Math.max(1, Math.min(page, totalPages) - 1))}
                              disabled={safeCurrentPage <= 1}
                            >
                              Prev
                            </Button>
                            <span className="text-muted-foreground">
                              Page {safeCurrentPage} of {totalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage((page) => Math.min(totalPages, Math.min(page, totalPages) + 1))}
                              disabled={safeCurrentPage >= totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <IncomingLeadsManualAssignDialog
        open={manualAssignDialogOpen}
        onOpenChange={setManualAssignDialogOpen}
        leadOptions={rows
          .filter((row) => isSelectableIncomingLead(row.raw))
          .map((row) => ({
            id: row.id,
            patientName: row.patientName,
            externalCampaignId: row.externalCampaignId,
            source: row.source,
            status: row.status,
          }))}
        selectedLeadIds={selectedManualAssignLeadIds}
        onSelectedLeadIdsChange={setSelectedManualAssignLeadIds}
        selectedLeads={selectedManualAssignLeads}
        assignableUsers={manualAssignOptionsQuery.data?.assignableUsers ?? []}
        isPending={manualAssignMutation.isPending}
        onSubmit={async ({ leadIds, assigneeUserIds }) => {
          await manualAssignMutation.mutateAsync({
            incomingLeadIds: leadIds,
            assigneeUserIds,
          })
        }}
      />

      <IncomingLeadsManualCreateDialog
        open={manualCreateDialogOpen}
        onOpenChange={setManualCreateDialogOpen}
        masters={data?.masters}
        onImported={async () => {
          await Promise.all([
            refetch(),
            queryClient.invalidateQueries({
              queryKey: ['crm-incoming-leads-manual-assign-options'],
            }),
          ])
        }}
      />

      <Sheet
        open={Boolean(selectedIncomingLead)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIncomingLead(null)
            setIncomingLeadEditMode(false)
            setIncomingLeadEditDraft(EMPTY_INCOMING_LEAD_EDIT_DRAFT)
          }
        }}
      >
        <SheetContent
          side="right"
          className={
            incomingLeadEditMode
              ? 'flex h-full w-full max-w-5xl flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-5xl'
              : 'flex h-full w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-2xl'
          }
        >
          <SheetHeader className="shrink-0 border-b p-4 text-left">
            <SheetTitle>Incoming lead {selectedIncomingLead?.id ?? ''}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedIncomingLead ? (
              <div className="space-y-5">
                <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-1">{webhookStatusBadge(selectedIncomingLead.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Received</p>
                    <p className="font-medium">{formatDateOnly(selectedIncomingLead.receivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign Name</p>
                    <p className="font-medium">
                      {selectedIncomingLead.campaign?.displayName ?? 'Unmapped campaign'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Processed</p>
                    <p className="font-medium">{formatDateOnly(selectedIncomingLead.processedAt)}</p>
                  </div>
                </div>

                {incomingLeadEditMode ? (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Editing keeps the current assignee unless <code>campaign_id</code> or{' '}
                      <code>Circle</code> changes. If either routing field changes, the linked lead
                      will be routed again using the current campaign rules.
                    </div>

                    {incomingLeadEditGroups.map((group) => (
                      <div key={group.section} className="rounded-xl border p-4">
                        <h3 className="text-sm font-semibold">{group.section}</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {group.fields.map((field) => {
                            const draftKey = field.key as keyof IncomingLeadEditDraft
                            const fieldValue = incomingLeadEditDraft[draftKey] ?? ''

                            return (
                              <div
                                key={field.key}
                                className={field.multiline ? 'md:col-span-2 xl:col-span-3' : ''}
                              >
                                <Label className="mb-2 block">
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </Label>
                                {field.key === 'Category' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {incomingLeadCategoryOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.name}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'Treatment' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select treatment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {incomingLeadTreatmentOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.name}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'Status' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {CRM_LEAD_STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'MOP' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select mode of payment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {CRM_MODE_OF_PAYMENT_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'Source' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {incomingLeadSourceOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.name}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'Lead_Source' ? (
                                  <Select
                                    value={fieldValue || '__empty__'}
                                    onValueChange={(value) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        value === '__empty__' ? '' : value
                                      )
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select lead source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__empty__">Blank</SelectItem>
                                      {incomingLeadLeadSourceOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.name}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.key === 'SubStatus' ? (
                                  <Input
                                    value={fieldValue}
                                    onChange={(event) =>
                                      handleIncomingLeadEditFieldChange(
                                        draftKey,
                                        event.target.value.slice(0, 25)
                                      )
                                    }
                                    placeholder="Enter sub status"
                                    maxLength={25}
                                  />
                                ) : field.type === 'date' ? (
                                  <Input
                                    type="datetime-local"
                                    value={fieldValue}
                                    onChange={(event) =>
                                      handleIncomingLeadEditFieldChange(draftKey, event.target.value)
                                    }
                                  />
                                ) : field.multiline ? (
                                  <Textarea
                                    value={fieldValue}
                                    onChange={(event) =>
                                      handleIncomingLeadEditFieldChange(draftKey, event.target.value)
                                    }
                                    placeholder={field.sample || field.helperText || field.label}
                                    rows={3}
                                  />
                                ) : (
                                  <Input
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    value={fieldValue}
                                    onChange={(event) =>
                                      handleIncomingLeadEditFieldChange(draftKey, event.target.value)
                                    }
                                    placeholder={
                                      field.key === 'Patient_Number' && !canViewIncomingLeadPhone
                                        ? 'Enter new phone to replace existing'
                                        : field.sample || field.helperText || field.label
                                    }
                                  />
                                )}
                                {field.key === 'Patient_Number' ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Current normalized phone: {selectedIncomingLead.normalizedPhone ?? '—'}
                                  </p>
                                ) : null}
                                {field.helperText ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {field.helperText}
                                  </p>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Team Lead</p>
                        <p className="font-medium">{selectedIncomingLead.teamLead?.name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedIncomingLead.teamLead?.email ?? ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">BD</p>
                        <p className="font-medium">{selectedIncomingLead.bd?.name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedIncomingLead.bd?.email ?? ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient</p>
                      <p className="font-medium">{selectedIncomingLead.summary.patientName ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncomingLead.summary.email ?? 'No email'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
                      <p className="font-medium">
                        {selectedIncomingLead.summary.phone ?? selectedIncomingLead.normalizedPhone ?? '—'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Normalized: {selectedIncomingLead.normalizedPhone ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Matched campaign</p>
                      <p className="font-medium">
                        {selectedIncomingLead.campaign?.displayName ?? 'Not matched'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead result</p>
                      <p className="font-medium">
                        {selectedIncomingLead.processedLead?.leadRef ?? 'No lead created'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Circle</p>
                      <p className="font-medium">{selectedIncomingLead.summary.circle ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">City</p>
                      <p className="font-medium">{selectedIncomingLead.summary.city ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Team Lead</p>
                      <p className="font-medium">{selectedIncomingLead.teamLead?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncomingLead.teamLead?.email ?? ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">BD</p>
                      <p className="font-medium">{selectedIncomingLead.bd?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncomingLead.bd?.email ?? ''}
                      </p>
                    </div>
                  </div>
                )}

                {selectedIncomingLead.errorMessage && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-800">Error</p>
                    <p className="mt-1 text-sm text-amber-900">{selectedIncomingLead.errorMessage}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Webhook payload</Label>
                  <pre className="max-h-[360px] overflow-auto rounded-xl border bg-slate-950 p-4 text-xs text-slate-100">
                    {formatPayload(selectedIncomingLead.payload)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-t bg-background/95 p-4 sm:flex-row sm:justify-end">
            {incomingLeadEditMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!selectedIncomingLead) return
                    setIncomingLeadEditDraft(
                      createIncomingLeadEditDraft(selectedIncomingLead, canViewIncomingLeadPhone),
                    )
                    setIncomingLeadEditMode(false)
                  }}
                  disabled={editIncomingLeadMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleIncomingLeadEditSave()}
                  disabled={editIncomingLeadMutation.isPending}
                >
                  {editIncomingLeadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save changes
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setSelectedIncomingLead(null)}>
                Close
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedRoute>
  )
}
