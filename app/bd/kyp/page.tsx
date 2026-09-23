'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ColumnFilter } from '@/components/ui/column-filter'
import { DataTable } from '@/components/ui/data-table'
import { CaseOverviewSheet } from '@/components/case/case-overview-sheet'
import { useAuth } from '@/hooks/use-auth'
import { useLeads, type Lead } from '@/hooks/use-leads'
import { usePermissions } from '@/hooks/use-permissions'
import { RESOURCE_MAP } from '@/lib/rbac/resourceMap'
import { apiGet } from '@/lib/api-client'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { formatLeadAgeSex, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { CaseStage } from '@/generated/prisma/enums'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from 'date-fns'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Bucket =
  | 'KYP'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'IPD_POSSIBLE'
  | 'IPD_SCHEDULED'
  | 'IPD_DONE'
  | 'POSTPONED'
  | 'CANCELLED'

type BucketFilter = Bucket | 'all'
type DatePreset = 'all' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'currentMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'currentYear' | 'lastYear' | 'custom'
type TrackerDateField = 'ipdCreated' | 'lastModified' | 'surgery' | 'leadCreated'

interface DecoratedLead {
  lead: Lead
  bucket: Bucket
  hospital: string
  doctor: string
  stageLabel: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function dateInputValue(value: Date) {
  return format(value, 'yyyy-MM-dd')
}

function resolveDateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const now = new Date()
  const range = (start: Date, end: Date) => ({ startDate: dateInputValue(start), endDate: dateInputValue(end) })
  switch (preset) {
    case 'today': return range(now, now)
    case 'yesterday': { const d = subDays(now, 1); return range(d, d) }
    case 'thisWeek': return range(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }))
    case 'lastWeek': { const d = subWeeks(now, 1); return range(startOfWeek(d, { weekStartsOn: 1 }), endOfWeek(d, { weekStartsOn: 1 })) }
    case 'currentMonth': return range(startOfMonth(now), endOfMonth(now))
    case 'lastMonth': { const d = subMonths(now, 1); return range(startOfMonth(d), endOfMonth(d)) }
    case 'last3Months': return range(startOfMonth(subMonths(now, 2)), now)
    case 'last6Months': return range(startOfMonth(subMonths(now, 5)), now)
    case 'currentYear': return range(startOfYear(now), endOfYear(now))
    case 'lastYear': { const d = subYears(now, 1); return range(startOfYear(d), endOfYear(d)) }
    case 'custom': return { startDate: customStart || undefined, endDate: customEnd || undefined }
    default: return {}
  }
}

/* ─── Stage / bucket definitions ─────────────────────────────────────────── */

const BUCKET_OF_STAGE: Partial<Record<CaseStage, Bucket>> = {
  [CaseStage.KYP_BASIC_PENDING]: 'KYP',
  [CaseStage.KYP_BASIC_COMPLETE]: 'KYP',
  [CaseStage.KYP_DETAILED_PENDING]: 'KYP',
  [CaseStage.KYP_DETAILED_COMPLETE]: 'KYP',
  [CaseStage.KYP_PENDING]: 'KYP',
  [CaseStage.KYP_COMPLETE]: 'KYP',
  [CaseStage.HOSPITALS_SUGGESTED]: 'HOSPITALS_SUGGESTED',
  [CaseStage.PREAUTH_RAISED]: 'PREAUTH_RAISED',
  [CaseStage.PREAUTH_COMPLETE]: 'PREAUTH_COMPLETE',
  // IPD form filled → scheduled (insurance INITIATED/ADMITTED + cash pre-done)
  [CaseStage.INITIATED]: 'IPD_SCHEDULED',
  [CaseStage.ADMITTED]: 'IPD_SCHEDULED',
  [CaseStage.CASH_IPD_PENDING]: 'IPD_SCHEDULED',
  [CaseStage.CASH_OPD_SCHEDULED]: 'IPD_SCHEDULED',
  [CaseStage.CASH_OPD_DONE]: 'IPD_SCHEDULED',
  [CaseStage.CASH_IPD_SUBMITTED]: 'IPD_SCHEDULED',
  [CaseStage.CASH_APPROVED]: 'IPD_SCHEDULED',
  [CaseStage.CASH_ON_HOLD]: 'IPD_SCHEDULED',
  // IPD done (canonical: insurance + cash, including discharged)
  [CaseStage.IPD_DONE]: 'IPD_DONE',
  [CaseStage.CASH_IPD_DONE]: 'IPD_DONE',
  [CaseStage.DISCHARGED]: 'IPD_DONE',
  [CaseStage.CASH_DISCHARGED]: 'IPD_DONE',
}

const BUCKET_DEFS: { key: Bucket; label: string; tone: string }[] = [
  { key: 'KYP', label: 'KYP raised', tone: 'text-sky-600' },
  { key: 'HOSPITALS_SUGGESTED', label: 'Hospitals suggested', tone: 'text-blue-600' },
  { key: 'PREAUTH_RAISED', label: 'Pre-auth raised', tone: 'text-purple-600' },
  { key: 'PREAUTH_COMPLETE', label: 'Pre-auth approved', tone: 'text-indigo-600' },
  { key: 'IPD_POSSIBLE', label: 'IPD Possible', tone: 'text-purple-600' },
  { key: 'IPD_SCHEDULED', label: 'IPD scheduled', tone: 'text-cyan-600' },
  { key: 'IPD_DONE', label: 'IPD done', tone: 'text-emerald-600' },
  { key: 'POSTPONED', label: 'Postponed', tone: 'text-amber-600' },
  { key: 'CANCELLED', label: 'Cancelled', tone: 'text-rose-600' },
]

const BUCKET_BADGE: Record<Bucket, { label: string; className: string }> = {
  KYP: { label: 'KYP raised', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  HOSPITALS_SUGGESTED: { label: 'Hospitals suggested', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  PREAUTH_RAISED: { label: 'Pre-auth raised', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  PREAUTH_COMPLETE: { label: 'Pre-auth approved', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  IPD_POSSIBLE: { label: 'IPD Possible', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  IPD_SCHEDULED: { label: 'IPD scheduled', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  IPD_DONE: { label: 'IPD done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  POSTPONED: { label: 'Postponed', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' },
}

/* ─── Page component ─────────────────────────────────────────────────────── */

export default function CaseTrackerPage() {
  const { user } = useAuth()
  const { hasAccess, permissions } = usePermissions()
  const canViewPhone = canViewPhoneNumber(user)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const phoneParsed = useMemo(() => parsePhoneSearchQuery(debouncedSearch), [debouncedSearch])

  // Row selected for the side-drawer overview (replaces navigating straight to /patient/[id])
  const [overviewRow, setOverviewRow] = useState<DecoratedLead | null>(null)

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [dateField, setDateField] = useState<TrackerDateField>('ipdCreated')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [stageFilter, setStageFilter] = useState<BucketFilter>('all')
  const [cmFilter, setCmFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [bdFilter, setBdFilter] = useState<string[]>([])
  const [bdFilterSearch, setBdFilterSearch] = useState('')
  const [bdFilterOpen, setBdFilterOpen] = useState(false)
  const [mopFilter, setMopFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Multi-select header column states consolidated in a single object
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})

  const handleColumnFilterChange = (key: string, selected: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: selected }))
  }

  const activeFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => v && v.length > 0).length +
      Number(datePreset !== 'all') +
      Number(mopFilter !== 'all') +
      Number(sourceFilter !== 'all') +
      Number(cityFilter !== 'all') +
      Number(departmentFilter !== 'all') +
      Number(teamFilter !== 'all') +
      Number(cmFilter !== 'all') +
      Number(bdFilter.length > 0)
  }, [columnFilters, datePreset, mopFilter, sourceFilter, cityFilter, departmentFilter, teamFilter, cmFilter, bdFilter])

  const clearAllFilters = () => {
    setColumnFilters({})
    setDatePreset('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setMopFilter('all')
    setSourceFilter('all')
    setCityFilter('all')
    setDepartmentFilter('all')
    setTeamFilter('all')
    setCmFilter('all')
    setBdFilter([])
    setStageFilter('all')
  }

  /* ── Filter config from backend (for column filter options) ── */
  const { data: filterConfig } = useQuery<{
    filters: Array<{
      field: string
      label: string
      filterType: string
      filterable: boolean
      options?: Array<{ label: string; value: string }>
    }>
  }>({
    queryKey: ['leads', 'filter-config'],
    queryFn: () => apiGet('/api/leads/filter-config'),
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      hospital: find('hospital')?.options || [],
      doctor: find('doctor')?.options || [],
      circle: find('circle')?.options || [],
      treatment: find('treatment')?.options || [],
      bdm: find('bdm')?.options || [],
    }
  }, [filterConfig])

  /* ── Build lead filters (server-side) ── */
  const leadFilters = useMemo(() => {
    const filters: any = {
      view: 'pipeline' as const,
      ...(phoneParsed ? { phoneSearch: phoneParsed.last10 } : {}),
      ...resolveDateRange(datePreset, customStartDate, customEndDate),
      ...(datePreset !== 'all' ? { dateField } : {}),
    }

    if (user?.role === 'PL_HEAD') {
      filters.caseStage = 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED'
    } else if (user?.role === 'BD' && user.id) {
      filters.bdId = user.id
    } else {
      filters.caseStage = 'OPD_SCHEDULED,OPD_DONE,KYP_BASIC_PENDING,KYP_BASIC_COMPLETE,KYP_DETAILED_PENDING,KYP_DETAILED_COMPLETE,KYP_PENDING,KYP_COMPLETE,HOSPITALS_SUGGESTED,PREAUTH_RAISED,PREAUTH_COMPLETE,INITIATED,ADMITTED,CASH_IPD_PENDING,CASH_OPD_SCHEDULED,CASH_OPD_DONE,CASH_IPD_SUBMITTED,CASH_APPROVED,CASH_ON_HOLD,IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING'
    }

    // Construct server-side filters parameter
    const backendFilters = []
    if (columnFilters.leadRef?.length > 0) {
      backendFilters.push({ field: 'leadRef', operator: 'in', value: columnFilters.leadRef })
    }
    if (columnFilters.patient?.length > 0) {
      backendFilters.push({ field: 'patient', operator: 'in', value: columnFilters.patient })
    }
    if (columnFilters.circle?.length > 0) {
      backendFilters.push({ field: 'circle', operator: 'in', value: columnFilters.circle })
    }
    if (columnFilters.treatment?.length > 0) {
      backendFilters.push({ field: 'treatment', operator: 'in', value: columnFilters.treatment })
    }
    if (columnFilters.bdm?.length > 0) {
      backendFilters.push({ field: 'bdm', operator: 'in', value: columnFilters.bdm })
    }
    if (columnFilters.hospital?.length > 0) {
      backendFilters.push({ field: 'hospital', operator: 'in', value: columnFilters.hospital })
    }
    if (columnFilters.doctor?.length > 0) {
      backendFilters.push({ field: 'doctor', operator: 'in', value: columnFilters.doctor })
    }
    if (columnFilters.date?.length === 2 && columnFilters.date[0]) {
      backendFilters.push({ field: 'date', operator: 'between', value: columnFilters.date })
    }
    if (columnFilters.surgeryDate?.length === 2 && columnFilters.surgeryDate[0]) {
      backendFilters.push({ field: 'surgeryDate', operator: 'between', value: columnFilters.surgeryDate })
    }

    if (backendFilters.length > 0) {
      filters.filters = JSON.stringify(backendFilters)
    }

    return filters
  }, [user, phoneParsed, columnFilters, datePreset, customStartDate, customEndDate, dateField])

  const { leads, isLoading } = useLeads(leadFilters)

  // Map every lead to a unified bucket
  const decorated = useMemo<DecoratedLead[]>(() => {
    const out: DecoratedLead[] = []
    for (const lead of leads) {
      if (
        typeof lead.patientName !== 'string' ||
        lead.patientName.trim() === 'Unknown' ||
        lead.patientName.trim() === ''
      ) continue

      const isCancelled =
        lead.admissionRecord?.ipdStatus === 'CANCELLED' ||
        String(lead.status ?? '').toLowerCase().includes('cancel')

      if (isCancelled) {
        const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
        const badge = BUCKET_BADGE.CANCELLED
        out.push({
          lead,
          bucket: 'CANCELLED',
          hospital: hospital ?? '',
          doctor: doctor ?? '',
          stageLabel: badge.label,
        })
        continue
      }

      const isPostponed =
        lead.admissionRecord?.ipdStatus === 'POSTPONED' ||
        String(lead.status ?? '').toLowerCase().includes('postpone')

      if (isPostponed) {
        const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
        const badge = BUCKET_BADGE.POSTPONED
        out.push({
          lead,
          bucket: 'POSTPONED',
          hospital: hospital ?? '',
          doctor: doctor ?? '',
          stageLabel: badge.label,
        })
        continue
      }

      const isPossible =
        !isCancelled &&
        lead.caseStage !== CaseStage.IPD_DONE &&
        lead.caseStage !== CaseStage.DISCHARGED &&
        lead.caseStage !== CaseStage.CASH_IPD_DONE &&
        lead.caseStage !== CaseStage.CASH_DISCHARGED &&
        (lead.admissionRecord?.ipdStatus === 'POSSIBLE' || !!lead.ipdPotentialDate)

      const bucket = lead.caseStage ? BUCKET_OF_STAGE[lead.caseStage as CaseStage] : undefined
      const resolvedBucket = isPossible
        ? 'IPD_POSSIBLE'
        : (bucket === undefined && (
            lead.caseStage === CaseStage.PL_PENDING || lead.caseStage === CaseStage.OUTSTANDING
          ) && (
            (lead as { surgeryDate?: unknown }).surgeryDate != null ||
            (lead as { admissionRecord?: { surgeryDate?: unknown } }).admissionRecord?.surgeryDate != null
          ) ? 'IPD_DONE' : bucket)

      if (!resolvedBucket) continue

      const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
      const badge = BUCKET_BADGE[resolvedBucket]
      out.push({
        lead,
        bucket: resolvedBucket,
        hospital: hospital ?? '',
        doctor: doctor ?? '',
        stageLabel: badge.label,
      })
    }
    return out
  }, [leads])

  // Date filtering is applied by the API using the selected tracker date field.
  // Keep this list as the single client-side base for cards, views, and the table.
  const dateFiltered = decorated

  // Mapping dynamic distinct unique lists safely from active (month-filtered) data
  const leadRefOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => String(d.lead.leadRef ?? ''))), [dateFiltered])
  const patientOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => d.lead.patientName)), [dateFiltered])
  const ageSexOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => formatLeadAgeSex(d.lead))), [dateFiltered])
  const stageOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => BUCKET_BADGE[d.bucket]?.label ?? '')), [dateFiltered])
  const sourceOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => d.lead.source)), [dateFiltered])
  const mopOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => d.lead.modeOfPayment)), [dateFiltered])
  const cityOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => d.lead.city || d.lead.circle)), [dateFiltered])
  const departmentOptions = useMemo(() => uniqueSorted(dateFiltered.map((d) => {
    const employee = d.lead.bd?.employee
    return employee?.department?.name || employee?.team?.department?.name
  })), [dateFiltered])

  const canViewAllCaseDimensions = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const showBdFilter =
    canViewAllCaseDimensions ||
    user?.role === 'TEAM_LEAD' ||
    user?.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user?.role === 'CATEGORY_MANAGER' ||
    user?.role === 'SALES_HEAD' ||
    user?.role === 'EXECUTIVE_ASSISTANT'
  const showTeamFilter = canViewAllCaseDimensions || user?.role === 'SALES_HEAD' || user?.role === 'EXECUTIVE_ASSISTANT' || user?.role === 'CATEGORY_MANAGER'
  const showCmFilter = user?.role === 'SALES_HEAD' || user?.role === 'EXECUTIVE_ASSISTANT'

  interface TeamData {
    id: string
    userId: string
    name: string
    profilePicture: string | null
    employeeCode: string | null
    role?: string
    memberCount: number
    members: { id: string; employeeId: string; name: string; profilePicture: string | null }[]
    scopeUserIds?: string[]
  }

  interface TeamsWithCmResponse {
    teams: TeamData[]
    categoryManagers: TeamData[]
  }

  const { data: teamsPayload } = useQuery<TeamData[] | TeamsWithCmResponse>({
    queryKey: ['targets', 'teams', 'includeCm'],
    queryFn: () => apiGet<TeamData[] | TeamsWithCmResponse>('/api/targets/teams?includeCm=1'),
    enabled: (showTeamFilter || showCmFilter) && !!user,
  })

  const teamsData = useMemo(() => {
    if (!teamsPayload) return []
    if (Array.isArray(teamsPayload)) return teamsPayload
    return teamsPayload.teams ?? []
  }, [teamsPayload])

  const categoryManagers = useMemo(() => {
    if (!teamsPayload || Array.isArray(teamsPayload)) return []
    return teamsPayload.categoryManagers ?? []
  }, [teamsPayload])

  // When logged in as CM, only show TL/ACM units inside their own recursive scope
  const teamsForActor = useMemo(() => {
    if (user?.role !== 'CATEGORY_MANAGER') return teamsData
    const selfCm = categoryManagers.find((c) => c.userId === user.id)
    if (!selfCm?.scopeUserIds?.length) return teamsData
    const scope = new Set(selfCm.scopeUserIds)
    return teamsData.filter((t) => scope.has(t.userId))
  }, [teamsData, categoryManagers, user?.role, user?.id])

  const teamsInCmScope = useMemo(() => {
    const base = teamsForActor
    if (cmFilter === 'all') return base
    const cm = categoryManagers.find((c) => c.id === cmFilter)
    if (!cm?.scopeUserIds?.length) return base
    const scope = new Set(cm.scopeUserIds)
    return base.filter((t) => scope.has(t.userId))
  }, [teamsForActor, categoryManagers, cmFilter])

  const bdOptions = useMemo(() => {
    if (!showBdFilter) return []
    const map = new Map<string, string>()
    if (showTeamFilter || showCmFilter) {
      const teams = teamsInCmScope
      const team = teamFilter !== 'all' ? teams.find((t) => t.id === teamFilter) : null
      if (team) {
        // Prefer recursive scope when available (includes nested BDs)
        if (team.scopeUserIds?.length) {
          for (const { lead } of dateFiltered) {
            const bd = lead.bd as { id?: string; name?: string } | undefined
            if (bd?.id && bd.name && team.scopeUserIds.includes(bd.id)) {
              map.set(bd.id, bd.name)
            }
          }
        }
        for (const member of team.members) {
          if (member.id && member.name) map.set(member.id, member.name)
        }
      } else if (cmFilter !== 'all') {
        const cm = categoryManagers.find((c) => c.id === cmFilter)
        if (cm?.scopeUserIds?.length) {
          for (const { lead } of dateFiltered) {
            const bd = lead.bd as { id?: string; name?: string } | undefined
            if (bd?.id && bd.name && cm.scopeUserIds.includes(bd.id)) {
              map.set(bd.id, bd.name)
            }
          }
        }
        for (const t of teams) {
          for (const member of t.members) {
            if (member.id && member.name) map.set(member.id, member.name)
          }
        }
      } else {
        for (const t of teams) {
          for (const member of t.members) {
            if (member.id && member.name) map.set(member.id, member.name)
          }
        }
      }
    } else {
      for (const { lead } of dateFiltered) {
        const bd = lead.bd as { id?: string; name?: string } | undefined
        if (bd?.id && bd.name) map.set(bd.id, bd.name)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [dateFiltered, showBdFilter, showTeamFilter, showCmFilter, teamsInCmScope, teamFilter, cmFilter, categoryManagers])

  const counts = useMemo(() => {
    const base: Record<Bucket, number> = {
      KYP: 0,
      HOSPITALS_SUGGESTED: 0,
      PREAUTH_RAISED: 0,
      PREAUTH_COMPLETE: 0,
      IPD_POSSIBLE: 0,
      IPD_SCHEDULED: 0,
      IPD_DONE: 0,
      POSTPONED: 0,
      CANCELLED: 0,
    }
    for (const { bucket } of dateFiltered) base[bucket]++
    return base
  }, [dateFiltered])

  const filteredRows = useMemo(() => {
    let rows = dateFiltered
    if (stageFilter !== 'all') rows = rows.filter((d) => d.bucket === stageFilter)
    if (cmFilter !== 'all') {
      const cm = categoryManagers.find((c) => c.id === cmFilter)
      const scopeIds = new Set(cm?.scopeUserIds ?? [])
      rows = rows.filter((d) => scopeIds.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (teamFilter !== 'all') {
      const team = teamsForActor.find((t) => t.id === teamFilter) ?? teamsData.find((t) => t.id === teamFilter)
      const teamBdIds = new Set(
        team?.scopeUserIds?.length
          ? team.scopeUserIds
          : (team?.members.map((m) => m.id) ?? [])
      )
      rows = rows.filter((d) => teamBdIds.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (bdFilter.length > 0) {
      const bdSet = new Set(bdFilter)
      rows = rows.filter((d) => bdSet.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (departmentFilter !== 'all') {
      rows = rows.filter((d) => {
        const employee = d.lead.bd?.employee
        return (employee?.department?.name || employee?.team?.department?.name) === departmentFilter
      })
    }
    if (mopFilter !== 'all') rows = rows.filter((d) => d.lead.modeOfPayment === mopFilter)
    if (sourceFilter !== 'all') rows = rows.filter((d) => d.lead.source === sourceFilter)
    if (cityFilter !== 'all') rows = rows.filter((d) => (d.lead.city || d.lead.circle) === cityFilter)
    if (columnFilters.stage?.length) rows = rows.filter((d) => columnFilters.stage.includes(BUCKET_BADGE[d.bucket]?.label ?? ''))
    if (debouncedSearch.trim() && !phoneParsed) {
      const q = debouncedSearch.toLowerCase()
      rows = rows.filter((d) => {
        const lead = d.lead
        const phone = canViewPhone ? (lead.phoneNumber ?? '') : ''
        const blob = [
          lead.patientName,
          lead.leadRef,
          lead.treatment,
          d.hospital,
          d.doctor,
          lead.circle,
          lead.city,
          phone,
          d.stageLabel,
          lead.bd?.name,
          formatLeadAgeSex(lead),
        ].join(' ').toLowerCase()
        return blob.includes(q)
      })
    }
    return [...rows].sort((a, b) => getLatestActivityTime(b.lead) - getLatestActivityTime(a.lead))
  }, [dateFiltered, stageFilter, cmFilter, teamFilter, bdFilter, departmentFilter, mopFilter, sourceFilter, cityFilter, columnFilters, debouncedSearch, phoneParsed, canViewPhone, teamsData, teamsForActor, categoryManagers])

  const columns = useMemo<ColumnDef<DecoratedLead>[]>(() => {
    const cols: ColumnDef<DecoratedLead>[] = [
      {
        id: 'leadRef',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[120px]">
            <span>Lead ref</span>
            <ColumnFilter value={columnFilters.leadRef} options={leadRefOptions} onChange={(selected) => handleColumnFilterChange('leadRef', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            <span className="font-medium">{row.original.lead.leadRef}</span>
            {row.original.lead.leadRef && <CopyLeadRefButton leadRef={String(row.original.lead.leadRef)} />}
          </div>
        )
      },
      {
        id: 'date',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[120px]">
            <span>Lead Date</span>
            <ColumnFilter type="dateRange" value={columnFilters.date} onChange={(selected) => handleColumnFilterChange('date', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => {
          const d = row.original.lead.leadEntryDate || row.original.lead.createdDate
          return <div className="whitespace-nowrap text-sm text-muted-foreground">{d ? new Date(d as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
        }
      },
      {
        id: 'surgeryDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
            <span>Surgery Date</span>
            <ColumnFilter type="dateRange" value={columnFilters.surgeryDate} onChange={(selected) => handleColumnFilterChange('surgeryDate', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => {
          const sd = row.original.lead.surgeryDate ?? (row.original.lead as { admissionRecord?: { surgeryDate?: string } }).admissionRecord?.surgeryDate
          return <div className="whitespace-nowrap text-sm text-muted-foreground">{sd ? new Date(sd as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
        }
      },
      {
        id: 'preAuthRaised',
        header: () => <span className="whitespace-nowrap min-w-[170px]">Pre-auth raised</span>,
        cell: ({ row }) => {
          const preAuth = row.original.lead.kypSubmission?.preAuthData
          const raisedAt = preAuth?.preAuthRaisedAt
          const raisedBy = preAuth?.preAuthRaisedBy?.name
          return (
            <div className="min-w-[170px] text-sm">
              <div className="whitespace-nowrap text-muted-foreground">
                {raisedAt ? format(new Date(raisedAt), 'dd MMM yyyy, hh:mm a') : '—'}
              </div>
              {raisedBy && <div className="truncate text-xs text-muted-foreground">By {raisedBy}</div>}
            </div>
          )
        }
      },
      {
        id: 'lastModified',
        header: () => <span className="whitespace-nowrap min-w-[170px]">Last modified</span>,
        cell: ({ row }) => {
          const timestamp = getLatestActivityTime(row.original.lead)
          return <div className="whitespace-nowrap text-sm text-muted-foreground">{timestamp ? format(new Date(timestamp), 'dd MMM yyyy, hh:mm a') : '—'}</div>
        }
      },
      {
        id: 'patient',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[120px]">
            <span>Patient</span>
            <ColumnFilter value={columnFilters.patient} options={patientOptions} onChange={(selected) => handleColumnFilterChange('patient', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div>{row.original.lead.patientName}</div>
      },
      {
        id: 'ageSex',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>Age/Sex</span>
            <ColumnFilter value={columnFilters.ageSex} options={ageSexOptions} onChange={(selected) => handleColumnFilterChange('ageSex', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="whitespace-nowrap text-sm">{formatLeadAgeSex(row.original.lead)}</div>
      },
      {
        id: 'circle',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>Circle</span>
            <ColumnFilter value={columnFilters.circle} options={filterOptions.circle} onChange={(selected) => handleColumnFilterChange('circle', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div>{typeof row.original.lead.circle === 'string' ? row.original.lead.circle : '—'}</div>
      },
      {
        id: 'treatment',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
            <span>Treatment</span>
            <ColumnFilter value={columnFilters.treatment} options={filterOptions.treatment} onChange={(selected) => handleColumnFilterChange('treatment', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[140px] truncate">{row.original.lead.treatment ?? '—'}</div>
      }
    ]

    if (showBdFilter) {
      cols.push({
        id: 'bdm',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>BDM</span>
            <ColumnFilter value={columnFilters.bdm} options={filterOptions.bdm} onChange={(selected) => handleColumnFilterChange('bdm', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[120px] truncate">{(row.original.lead.plRecord?.bdmName ?? row.original.lead.bd?.name ?? '').trim() || '—'}</div>
      })
    }

    cols.push(
      {
        id: 'hospital',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
            <span>Hospital</span>
            <ColumnFilter value={columnFilters.hospital} options={filterOptions.hospital} onChange={(selected) => handleColumnFilterChange('hospital', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[160px] truncate">{row.original.hospital || '—'}</div>
      },
      {
        id: 'doctor',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
            <span>Doctor</span>
            <ColumnFilter value={columnFilters.doctor} options={filterOptions.doctor} onChange={(selected) => handleColumnFilterChange('doctor', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[160px] truncate">{row.original.doctor || '—'}</div>
      },
      {
        id: 'stage',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>Stage</span>
            <ColumnFilter value={columnFilters.stage} options={stageOptions} onChange={(selected) => handleColumnFilterChange('stage', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => {
          const badge = BUCKET_BADGE[row.original.bucket]
          return (
            <Badge variant="secondary" className={badge.className}>
              {badge.label}
            </Badge>
          )
        }
      },
      {
        id: 'actions',
        header: () => <div className="w-[90px]" />,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/patient/${row.original.lead.id}`}>Open</Link>
            </Button>
          </div>
        )
      }
    )

    return cols.filter((col) => {
      const colId = col.id
      if (!colId) return true
      const resourceKey = `sales.case_tracker.table.lead.column.${colId}`
      if (resourceKey in RESOURCE_MAP && resourceKey in permissions) {
        return hasAccess(resourceKey, 'READ')
      }
      return true
    })
  }, [
    columnFilters, leadRefOptions, patientOptions, ageSexOptions, filterOptions, stageOptions, showBdFilter, hasAccess, permissions
  ])

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen w-full min-w-0 bg-[#F2F2F7] dark:bg-background">
        <div className="w-full min-w-0 space-y-5 p-4 md:p-6">
          {/* ── Header ── */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Case tracker</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.role === 'PL_HEAD'
                ? 'IPD done cases across all teams'
                : 'Active cash & insurance cases after KYP — tap a card to filter'}
            </p>
          </div>

          {/* ── Global search ── */}
          <Card className="min-w-0 w-full border-border/80 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-10"
                  placeholder="Search patient, phone, UHID, hospital, insurance, TPA, BD, city, status…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Stage cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
            {user?.role !== 'PL_HEAD' && (
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:shadow-md ${stageFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">All active</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{dateFiltered.length}</p>
              </button>
            )}
            {BUCKET_DEFS.filter(({ key }) => user?.role !== 'PL_HEAD' || key === 'IPD_DONE').map(({ key, label, tone }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStageFilter(key)}
                className={`rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:shadow-md ${stageFilter === key ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground" title={label}>{label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{counts[key]}</p>
              </button>
            ))}
          </div>

          {/* Table Card */}
          <Card className="min-w-0 w-full border-border/80 shadow-sm">
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Leads
                    {activeFilterCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium px-2 py-0"
                        onClick={clearAllFilters}
                      >
                        Clear Filters ({activeFilterCount})
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {filteredRows.length} shown · {dateFiltered.length} active
                  </CardDescription>
                </div>

                {/* Date, organization and IPD case filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={dateField} onValueChange={(value) => setDateField(value as TrackerDateField)}>
                    <SelectTrigger className="w-[155px]">
                      <SelectValue placeholder="Date field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ipdCreated">IPD created date</SelectItem>
                      <SelectItem value="lastModified">Last modified date</SelectItem>
                      <SelectItem value="surgery">Surgery date</SelectItem>
                      <SelectItem value="leadCreated">Lead created date</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DatePreset)}>
                    <SelectTrigger className="w-[155px]">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="thisWeek">This week</SelectItem>
                      <SelectItem value="lastWeek">Last week</SelectItem>
                      <SelectItem value="currentMonth">Current month</SelectItem>
                      <SelectItem value="lastMonth">Last month</SelectItem>
                      <SelectItem value="last3Months">Last 3 months</SelectItem>
                      <SelectItem value="last6Months">Last 6 months</SelectItem>
                      <SelectItem value="currentYear">Current year</SelectItem>
                      <SelectItem value="lastYear">Last year</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>

                  {datePreset === 'custom' && <>
                    <Input aria-label="Start date" type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="h-9 w-[145px]" />
                    <Input aria-label="End date" type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="h-9 w-[145px]" />
                  </>}

                  <Select value={mopFilter} onValueChange={setMopFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="MOP" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All MOP</SelectItem>{mopOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-[135px]"><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All sources</SelectItem>{sourceOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="w-[125px]"><SelectValue placeholder="City" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All cities</SelectItem>{cityOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  {(canViewAllCaseDimensions || showTeamFilter) && <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[145px]"><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All departments</SelectItem>{departmentOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>}

                  {showCmFilter && (
                    <select
                      value={cmFilter}
                      onChange={(e) => {
                        setCmFilter(e.target.value)
                        setTeamFilter('all')
                        setBdFilter([])
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                    >
                      <option value="all">All CMs</option>
                      {categoryManagers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}

                  {showTeamFilter && (
                    <select
                      value={teamFilter}
                      onChange={(e) => { setTeamFilter(e.target.value); setBdFilter([]) }}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                    >
                      <option value="all">All teams</option>
                      {teamsInCmScope.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.role === 'ASSISTANT_CATEGORY_MANAGER' ? ' (ACM)' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {showBdFilter && (
                    <Popover
                      open={bdFilterOpen}
                      onOpenChange={(open) => {
                        setBdFilterOpen(open)
                        if (!open) setBdFilterSearch('')
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-[150px] justify-start font-normal">
                          {bdFilter.length === 0
                            ? 'All BDs'
                            : bdFilter.length === 1
                              ? bdOptions.find((b) => b.value === bdFilter[0])?.label ?? '1 BD'
                              : `${bdFilter.length} BDs selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="start">
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="Search BD…"
                              value={bdFilterSearch}
                              onChange={(e) => setBdFilterSearch(e.target.value)}
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-1">
                          <label className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80 cursor-pointer">
                            <Checkbox
                              checked={bdFilter.length === bdOptions.length && bdOptions.length > 0}
                              onCheckedChange={(checked) =>
                                setBdFilter(checked ? bdOptions.map((b) => b.value) : [])
                              }
                            />
                            Select all
                          </label>
                          {bdOptions
                            .filter((b) => b.label.toLowerCase().includes(bdFilterSearch.trim().toLowerCase()))
                            .map((b) => (
                              <label
                                key={b.value}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80 cursor-pointer"
                              >
                                <Checkbox
                                  checked={bdFilter.includes(b.value)}
                                  onCheckedChange={(checked) =>
                                    setBdFilter((prev) =>
                                      checked ? [...prev, b.value] : prev.filter((x) => x !== b.value)
                                    )
                                  }
                                />
                                <span className="truncate">{b.label}</span>
                              </label>
                            ))}
                          {bdOptions.length === 0 && (
                            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No BDs found.</p>
                          )}
                        </div>
                        {bdFilter.length > 0 && (
                          <div className="border-t p-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs text-muted-foreground"
                              onClick={() => setBdFilter([])}
                            >
                              Clear selection
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={filteredRows}
                isLoading={isLoading}
                emptyMessage="No leads match the current filters."
                onRowClick={(row) => setOverviewRow(row)}
                enablePagination={true}
                initialPageSize={50}
              />
            </CardContent>
          </Card>

          <CaseOverviewSheet
            row={overviewRow}
            open={overviewRow !== null}
            onClose={() => setOverviewRow(null)}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
