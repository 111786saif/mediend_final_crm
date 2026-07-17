'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AlertTriangle, CalendarIcon, Eye, Inbox, RefreshCw, Settings2, X } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/crm/crm-filter-table'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'

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

type CampaignMasters = {
  sources: SourceMaster[]
  leadSources: LeadSourceMaster[]
  circles: CircleMaster[]
  cities: CityMaster[]
  departments: DepartmentOption[]
}

type CampaignRecord = {
  id: string
  externalCampaignId: string
  displayName: string
  category: string | null
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
  month: number
  year: number
  masters: CampaignMasters
  campaigns: CampaignRecord[]
  incomingLeads: IncomingLeadRecord[]
}

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
  department: string
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
const INCOMING_LEAD_HEADER_FILTERS = [
  'Received',
  'Processed',
  'Status',
  'Source',
  'Campaign ID',
  'Payload Campaign ID',
  'Campaign Source',
  'Lead Source',
  'Category',
  'Department',
  'Circle',
  'City',
] as const

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

const INCOMING_LEAD_COLUMNS: IncomingLeadColumn[] = [
  { id: 'receivedAt', label: 'Received', type: 'date', cell: (row) => formatDateOnly(row.receivedAt) },
  { id: 'processedAt', label: 'Processed', type: 'date', cell: (row) => formatDateOnly(row.processedAt) },
  { id: 'status', label: 'Status', type: 'string', cell: (row) => webhookStatusBadge(row.status) },
  { id: 'source', label: 'Source', type: 'string' },
  { id: 'externalCampaignId', label: 'Campaign ID', type: 'string', cell: (row) => <span className="font-mono text-sm">{row.externalCampaignId}</span> },
  { id: 'payloadCampaignId', label: 'Payload Campaign ID', type: 'string', cell: (row) => <span className="font-mono text-sm">{row.payloadCampaignId}</span> },
  { id: 'campaignName', label: 'Campaign', type: 'string' },
  { id: 'campaignSource', label: 'Campaign Source', type: 'string', masterKey: 'sources' },
  { id: 'leadSource', label: 'Lead Source', type: 'string', masterKey: 'leadSources' },
  { id: 'category', label: 'Category', type: 'string' },
  { id: 'department', label: 'Department', type: 'string', masterKey: 'departments' },
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
  { id: 'processedLeadPatientName', label: 'Lead Patient', type: 'string' },
  { id: 'processedLeadPhoneNumber', label: 'Lead Phone', type: 'string', cell: (row) => <span className="font-mono text-sm">{row.processedLeadPhoneNumber}</span> },
  { id: 'teamLeadName', label: 'Team Lead', type: 'string' },
  { id: 'teamLeadEmail', label: 'Team Lead Email', type: 'string' },
  { id: 'bdName', label: 'BD', type: 'string' },
  { id: 'bdEmail', label: 'BD Email', type: 'string' },
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

function formatDateOnly(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(date)
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
  const initialMonthYear = getInitialMonthYear()
  const [month, setMonth] = useState(String(initialMonthYear.month))
  const [year, setYear] = useState(String(initialMonthYear.year))
  const [searchColumn, setSearchColumn] = useState<IncomingLeadColumn['id']>('patientName')
  const [searchValue, setSearchValue] = useState('')
  const [sortColumn, setSortColumn] = useState<IncomingLeadColumn['id']>('receivedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [visibleColumns, setVisibleColumns] = useState(createInitialVisibleColumns)
  const [selectedIncomingLead, setSelectedIncomingLead] = useState<IncomingLeadRecord | null>(null)
  const [assignDateFrom, setAssignDateFrom] = useState('')
  const [assignDateTo, setAssignDateTo] = useState('')
  const [leadDateFrom, setLeadDateFrom] = useState('')
  const [leadDateTo, setLeadDateTo] = useState('')
  const [followUpDateFrom, setFollowUpDateFrom] = useState('')
  const [followUpDateTo, setFollowUpDateTo] = useState('')
  const [surgeryDateFrom, setSurgeryDateFrom] = useState('')
  const [surgeryDateTo, setSurgeryDateTo] = useState('')

  const hasAccess = Boolean(user?.role && INCOMING_LEAD_VIEW_ROLES.has(user.role))
  const selectedMonth = Number.parseInt(month, 10) || initialMonthYear.month
  const selectedYear = Number.parseInt(year, 10) || initialMonthYear.year

  const { data, isLoading, error, refetch, isFetching } = useQuery<IncomingLeadPageData, Error>({
    queryKey: ['crm-incoming-leads', selectedMonth, selectedYear],
    queryFn: () => apiGet<IncomingLeadPageData>(`/api/crm/incoming-leads?month=${selectedMonth}&year=${selectedYear}`),
    retry: false,
    enabled: hasAccess,
  })

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
        category: mappedCampaign?.category ?? '—',
        department: mappedCampaign?.department?.name ?? '—',
        circle: mappedCampaign?.circle.name ?? '—',
        city: mappedCampaign?.city?.name ?? '—',
        patientName: incomingLead.summary.patientName ?? '—',
        email: incomingLead.summary.email ?? '—',
        normalizedPhone: incomingLead.normalizedPhone ?? '—',
        assignedDate: incomingLead.processedLead?.assignedDate ?? '',
        leadDate: incomingLead.processedLead?.leadEntryDate ?? '',
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

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    const selectedSearchColumn = INCOMING_LEAD_COLUMNS.find((column) => column.id === searchColumn)

    return rows.filter((row) => {
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

      if (!normalizedSearch) return true

      const rawValue = String(row[searchColumn] ?? '')
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
    searchColumn,
    searchValue,
    assignDateFrom,
    assignDateTo,
    leadDateFrom,
    leadDateTo,
    followUpDateFrom,
    followUpDateTo,
    surgeryDateFrom,
    surgeryDateTo,
  ])

  const sortedRows = useMemo(() => {
    const selectedSortColumn = INCOMING_LEAD_COLUMNS.find((column) => column.id === sortColumn)
    if (!selectedSortColumn) return filteredRows

    const nextRows = [...filteredRows].sort((left, right) =>
      compareValues(
        selectedSortColumn.type === 'date'
          ? getDateOnlyValue(String(left[sortColumn] ?? ''))
          : String(left[sortColumn] ?? ''),
        selectedSortColumn.type === 'date'
          ? getDateOnlyValue(String(right[sortColumn] ?? ''))
          : String(right[sortColumn] ?? ''),
        selectedSortColumn.type
      )
    )

    if (sortDirection === 'desc') {
      nextRows.reverse()
    }

    return nextRows
  }, [filteredRows, sortColumn, sortDirection])

  const visibleColumnDefinitions = useMemo(
    () => INCOMING_LEAD_COLUMNS.filter((column) => visibleColumns[column.id]),
    [visibleColumns]
  )

  const selectedSearchColumnDefinition = useMemo(
    () => INCOMING_LEAD_COLUMNS.find((column) => column.id === searchColumn) ?? null,
    [searchColumn]
  )

  const masterFilterOptions = useMemo(() => {
    if (!selectedSearchColumnDefinition?.masterKey) return []
    const values = (data?.masters[selectedSearchColumnDefinition.masterKey] ?? []).map((entry) => entry.name)
    return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' })
    )
  }, [data?.masters, selectedSearchColumnDefinition])

  const summary = useMemo(() => {
    const total = rows.length
    const processed = rows.filter((row) => row.status === 'PROCESSED').length
    const duplicates = rows.filter((row) => row.status === 'DUPLICATE').length
    const failed = rows.filter((row) => row.status === 'FAILED').length
    return { total, processed, duplicates, failed }
  }, [rows])

  const errorMessage =
    error instanceof Error ? error.message : 'We could not load the incoming lead audit right now.'

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-[1800px] space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Inbox className="h-8 w-8 text-cyan-600" />
              CRM Incoming Leads
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review SaveMyLeads webhook intake with searchable columns, column-based sorting, and column visibility controls.
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-2">
                    <Label>Search column</Label>
                    <Select
                      value={searchColumn}
                      onValueChange={(value) => {
                        setSearchColumn(value as IncomingLeadColumn['id'])
                        setSearchValue('')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOMING_LEAD_COLUMNS.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Sort by</Label>
                    <Select value={sortColumn} onValueChange={(value) => setSortColumn(value as IncomingLeadColumn['id'])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose column" />
                      </SelectTrigger>
                      <SelectContent>
                        {INCOMING_LEAD_COLUMNS.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Columns</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between">
                          <span className="inline-flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            Select columns
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[360px] w-64 overflow-y-auto">
                        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {INCOMING_LEAD_COLUMNS.map((column) => (
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

                <div className="grid gap-4 border-t pt-5 md:grid-cols-2">
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
                <CardHeader>
                  <CardTitle>Incoming lead table</CardTitle>
                  <CardDescription>
                    Showing {formatWholeNumber(sortedRows.length)} rows for {MONTH_OPTIONS.find((option) => option.value === selectedMonth)?.label} {selectedYear}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border">
                    <div className="overflow-x-auto">
                      <Table filterableHeaders={[...INCOMING_LEAD_HEADER_FILTERS]}>
                        <TableHeader>
                          <TableRow>
                            {visibleColumnDefinitions.map((column) => (
                              <TableHead key={column.id}>{column.label}</TableHead>
                            ))}
                            <TableHead className="w-[120px] text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={visibleColumnDefinitions.length + 1} className="py-10 text-center text-muted-foreground">
                                Loading incoming leads...
                              </TableCell>
                            </TableRow>
                          ) : sortedRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={visibleColumnDefinitions.length + 1} className="py-10 text-center text-muted-foreground">
                                No incoming leads matched the selected month or filters.
                              </TableCell>
                            </TableRow>
                          ) : (
                            sortedRows.map((row) => (
                              <TableRow key={row.id}>
                                {visibleColumnDefinitions.map((column) => (
                                  <TableCell key={`${row.id}-${column.id}`}>
                                    {column.cell ? column.cell(row) : row[column.id]}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedIncomingLead(row.raw)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(selectedIncomingLead)} onOpenChange={(open) => !open && setSelectedIncomingLead(null)}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-2xl"
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign ID</p>
                    <p className="font-mono text-sm">
                      {selectedIncomingLead.externalCampaignId ?? selectedIncomingLead.summary.campaignId ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Processed</p>
                    <p className="font-medium">{formatDateOnly(selectedIncomingLead.processedAt)}</p>
                  </div>
                </div>

                <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient</p>
                    <p className="font-medium">{selectedIncomingLead.summary.patientName ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{selectedIncomingLead.summary.email ?? 'No email'}</p>
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
                    <p className="font-medium">{selectedIncomingLead.campaign?.displayName ?? 'Not matched'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead result</p>
                    <p className="font-medium">{selectedIncomingLead.processedLead?.leadRef ?? 'No lead created'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Team Lead</p>
                    <p className="font-medium">{selectedIncomingLead.teamLead?.name ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{selectedIncomingLead.teamLead?.email ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">BD</p>
                    <p className="font-medium">{selectedIncomingLead.bd?.name ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{selectedIncomingLead.bd?.email ?? ''}</p>
                  </div>
                </div>

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
            <Button type="button" variant="outline" onClick={() => setSelectedIncomingLead(null)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedRoute>
  )
}
