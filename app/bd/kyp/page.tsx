'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ColumnFilter } from '@/components/ui/column-filter'
import { DataTable } from '@/components/ui/data-table'
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
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Bucket =
  | 'KYP'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'IPD_SCHEDULED'
  | 'IPD_DONE'

type BucketFilter = Bucket | 'all'

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
  { key: 'IPD_SCHEDULED', label: 'IPD scheduled', tone: 'text-cyan-600' },
  { key: 'IPD_DONE', label: 'IPD done', tone: 'text-emerald-600' },
]

const BUCKET_BADGE: Record<Bucket, { label: string; className: string }> = {
  KYP: { label: 'KYP raised', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  HOSPITALS_SUGGESTED: { label: 'Hospitals suggested', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  PREAUTH_RAISED: { label: 'Pre-auth raised', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  PREAUTH_COMPLETE: { label: 'Pre-auth approved', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  IPD_SCHEDULED: { label: 'IPD scheduled', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  IPD_DONE: { label: 'IPD done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
}

/* ─── Page component ─────────────────────────────────────────────────────── */

export default function CaseTrackerPage() {
  const { user } = useAuth()
  const { hasAccess, permissions } = usePermissions()
  const router = useRouter()
  const canViewPhone = canViewPhoneNumber(user)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const phoneParsed = useMemo(() => parsePhoneSearchQuery(debouncedSearch), [debouncedSearch])

  const [stageFilter, setStageFilter] = useState<BucketFilter>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [bdFilter, setBdFilter] = useState('all')

  // Multi-select header column states consolidated in a single object
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})

  const handleColumnFilterChange = (key: string, selected: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: selected }))
  }

  const activeFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => v && v.length > 0).length
  }, [columnFilters])

  const clearAllFilters = () => {
    setColumnFilters({})
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
    }

    if (user?.role === 'PL_HEAD') {
      filters.caseStage = 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED'
    } else if (user?.role === 'BD' && user.id) {
      filters.bdId = user.id
    } else {
      filters.caseStage = 'KYP_BASIC_PENDING,KYP_BASIC_COMPLETE,KYP_DETAILED_PENDING,KYP_DETAILED_COMPLETE,KYP_PENDING,KYP_COMPLETE,HOSPITALS_SUGGESTED,PREAUTH_RAISED,PREAUTH_COMPLETE,INITIATED,ADMITTED,CASH_IPD_PENDING,CASH_IPD_SUBMITTED,CASH_APPROVED,CASH_ON_HOLD,IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING'
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
  }, [user, phoneParsed, columnFilters])

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
      const bucket = lead.caseStage ? BUCKET_OF_STAGE[lead.caseStage as CaseStage] : undefined
      const resolvedBucket = bucket === undefined && (
        lead.caseStage === CaseStage.PL_PENDING || lead.caseStage === CaseStage.OUTSTANDING
      ) && (
        (lead as { surgeryDate?: unknown }).surgeryDate != null ||
        (lead as { admissionRecord?: { surgeryDate?: unknown } }).admissionRecord?.surgeryDate != null
      ) ? 'IPD_DONE' : bucket
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

  // Mapping dynamic distinct unique lists safely from active data
  const leadRefOptions = useMemo(() => uniqueSorted(decorated.map((d) => String(d.lead.leadRef ?? ''))), [decorated])
  const patientOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.lead.patientName)), [decorated])
  const ageSexOptions = useMemo(() => uniqueSorted(decorated.map((d) => formatLeadAgeSex(d.lead))), [decorated])
  const stageOptions = useMemo(() => uniqueSorted(decorated.map((d) => BUCKET_BADGE[d.bucket]?.label ?? '')), [decorated])

  const showBdFilter = user?.role === 'TEAM_LEAD' || user?.role === 'SALES_HEAD' || user?.role === 'EXECUTIVE_ASSISTANT'
  const showTeamFilter = user?.role === 'SALES_HEAD' || user?.role === 'EXECUTIVE_ASSISTANT'

  interface TeamData {
    id: string
    userId: string
    name: string
    profilePicture: string | null
    employeeCode: string | null
    memberCount: number
    members: { id: string; employeeId: string; name: string; profilePicture: string | null }[]
  }

  const { data: teamsData } = useQuery<TeamData[]>({
    queryKey: ['targets', 'teams'],
    queryFn: () => apiGet<TeamData[]>('/api/targets/teams'),
    enabled: showTeamFilter && !!user,
  })

  const bdOptions = useMemo(() => {
    if (!showBdFilter) return []
    const map = new Map<string, string>()
    if (showTeamFilter) {
      const teams = teamsData ?? []
      const team = teamFilter !== 'all' ? teams.find((t) => t.id === teamFilter) : null
      const sourceTeams = team ? [team] : teams
      for (const t of sourceTeams) {
        for (const member of t.members) {
          if (member.id && member.name) map.set(member.id, member.name)
        }
      }
    } else {
      for (const { lead } of decorated) {
        const bd = lead.bd as { id?: string; name?: string } | undefined
        if (bd?.id && bd.name) map.set(bd.id, bd.name)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [decorated, showBdFilter, showTeamFilter, teamsData, teamFilter])

  const counts = useMemo(() => {
    const base: Record<Bucket, number> = {
      KYP: 0,
      HOSPITALS_SUGGESTED: 0,
      PREAUTH_RAISED: 0,
      PREAUTH_COMPLETE: 0,
      IPD_SCHEDULED: 0,
      IPD_DONE: 0,
    }
    for (const { bucket } of decorated) base[bucket]++
    return base
  }, [decorated])

  const filteredRows = useMemo(() => {
    let rows = decorated
    if (stageFilter !== 'all') rows = rows.filter((d) => d.bucket === stageFilter)
    if (teamFilter !== 'all') {
      const teamBdIds = new Set(teamsData?.find((t) => t.id === teamFilter)?.members.map((m) => m.id) ?? [])
      rows = rows.filter((d) => teamBdIds.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (bdFilter !== 'all') {
      rows = rows.filter((d) => (d.lead.bd as { id?: string } | undefined)?.id === bdFilter)
    }
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
  }, [decorated, stageFilter, teamFilter, bdFilter, columnFilters, debouncedSearch, phoneParsed, canViewPhone, teamsData])

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
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>Date</span>
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
      if (resourceKey in RESOURCE_MAP) {
        return hasAccess(resourceKey, 'READ')
      }
      return true
    })
  }, [
    columnFilters, leadRefOptions, patientOptions, ageSexOptions, filterOptions, stageOptions, showBdFilter, hasAccess, permissions
  ])

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-background">
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
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
          <Card className="border-border/80 shadow-sm">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {user?.role !== 'PL_HEAD' && (
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${stageFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">All active</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{decorated.length}</p>
              </button>
            )}
            {BUCKET_DEFS.filter(({ key }) => user?.role !== 'PL_HEAD' || key === 'IPD_DONE').map(({ key, label, tone }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStageFilter(key)}
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${stageFilter === key ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="line-clamp-2 text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{counts[key]}</p>
              </button>
            ))}
          </div>

          {/* Table Card */}
          <Card className="border-border/80 shadow-sm">
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
                    {filteredRows.length} shown · {decorated.length} active
                  </CardDescription>
                </div>

                {/* Team / BD dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                  {showTeamFilter && (
                    <select
                      value={teamFilter}
                      onChange={(e) => { setTeamFilter(e.target.value); setBdFilter('all') }}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                    >
                      <option value="all">All teams</option>
                      {(teamsData ?? []).map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                  {showBdFilter && (
                    <select
                      value={bdFilter}
                      onChange={(e) => setBdFilter(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                    >
                      <option value="all">All BDs</option>
                      {bdOptions.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
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
                onRowClick={(row) => router.push(`/patient/${row.lead.id}`)}
                enablePagination={true}
                initialPageSize={50}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}