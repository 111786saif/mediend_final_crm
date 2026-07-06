'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { CaseTrackerDateRangeFilter } from '@/components/case-tracker/date-range-filter'
import { MultiSelectDropdown } from '@/components/case-tracker/multi-select-dropdown'
import { PatientDetailDrawer } from '@/components/case-tracker/patient-detail-drawer'
import { useCaseTracker, type CaseTrackerFilters } from '@/hooks/use-case-tracker'
import {
  getDefaultCaseTrackerDateRange,
  loadCaseTrackerDateRangeFromStorage,
  saveCaseTrackerDateRangeToStorage,
  type CaseTrackerDateRange,
} from '@/lib/case-tracker-date-range'
import {
  CASE_TRACKER_COLUMNS,
  compareCaseRows,
  exportCaseRowsCsv,
  formatCaseCellDisplay,
  getCaseRowSearchBlob,
  type Bucket,
  type CaseTrackerColumnKey,
  type DecoratedCaseRow,
} from '@/lib/case-tracker-table'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { CaseStage } from '@/generated/prisma/enums'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/* ── Unified stage buckets (cash + insurance combined) ──────────────────────
   Both flows collapse into one minimal set of milestones. Filling the IPD
   form = "IPD scheduled" (not admitted); the next milestone is "IPD done".
   Discharged / PL / outstanding are handled by insurance and intentionally
   dropped from this active tracker. */
type BucketFilter = Bucket | 'all'

const ALL_COLUMN_KEYS = CASE_TRACKER_COLUMNS.map((c) => c.key)

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

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export default function CaseTrackerPage() {
  const { user } = useAuth()
  const canViewPhone = canViewPhoneNumber(user)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const phoneParsed = useMemo(() => parsePhoneSearchQuery(debouncedSearch), [debouncedSearch])

  const [searchColumnKeys, setSearchColumnKeys] = useState<string[]>([])
  const activeSearchColumns = useMemo<CaseTrackerColumnKey[]>(
    () => (searchColumnKeys.length === 0 ? ALL_COLUMN_KEYS : (searchColumnKeys as CaseTrackerColumnKey[])),
    [searchColumnKeys]
  )

  const [sortKey, setSortKey] = useState<CaseTrackerColumnKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [drawerRow, setDrawerRow] = useState<DecoratedCaseRow | null>(null)

  const [dateRange, setDateRange] = useState<CaseTrackerDateRange>(getDefaultCaseTrackerDateRange)

  useEffect(() => {
    const stored = loadCaseTrackerDateRangeFromStorage()
    if (stored) setDateRange(stored)
  }, [])

  useEffect(() => {
    saveCaseTrackerDateRangeToStorage(dateRange)
  }, [dateRange])
  const [stageFilter, setStageFilter] = useState<BucketFilter>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [selectedBdIds, setSelectedBdIds] = useState<string[]>([])
  const [circleFilter, setCircleFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [treatmentFilter, setTreatmentFilter] = useState('all')

  const leadFilters = useMemo(() => {
    const base: CaseTrackerFilters = {
      ...(dateRange.fromDate ? { fromDate: dateRange.fromDate } : {}),
      ...(dateRange.toDate ? { toDate: dateRange.toDate } : {}),
      ...(phoneParsed ? { phoneSearch: phoneParsed.last10 } : {}),
    }

    if (user?.role === 'PL_HEAD') {
      return {
        ...base,
        caseStage: 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED',
      }
    }
    if (user?.role === 'BD' && user.id) {
      return { ...base, bdId: user.id }
    }
    return {
      ...base,
      caseStage:
        'KYP_BASIC_PENDING,KYP_BASIC_COMPLETE,KYP_DETAILED_PENDING,KYP_DETAILED_COMPLETE,KYP_PENDING,KYP_COMPLETE,HOSPITALS_SUGGESTED,PREAUTH_RAISED,PREAUTH_COMPLETE,INITIATED,ADMITTED,CASH_IPD_PENDING,CASH_IPD_SUBMITTED,CASH_APPROVED,CASH_ON_HOLD,IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED,PL_PENDING,OUTSTANDING',
    }
  }, [user?.role, user?.id, phoneParsed, dateRange.fromDate, dateRange.toDate])

  const { leads, isLoading } = useCaseTracker(leadFilters)

  // Map every lead to a unified bucket; anything without a bucket (NEW_LEAD,
  // discharged, PL, outstanding) is dropped from the active tracker.
  const decorated = useMemo<DecoratedCaseRow[]>(() => {
    const out: DecoratedCaseRow[] = []
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

  const circleOptions = useMemo(
    () => uniqueSorted(decorated.map((d) => (typeof d.lead.circle === 'string' ? d.lead.circle : ''))),
    [decorated]
  )
  const hospitalOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.hospital)), [decorated])
  const doctorOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.doctor)), [decorated])
  const treatmentOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.lead.treatment)), [decorated])

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
    if (selectedBdIds.length > 0) {
      const bdSet = new Set(selectedBdIds)
      rows = rows.filter((d) => bdSet.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (circleFilter !== 'all') rows = rows.filter((d) => (d.lead.circle ?? '') === circleFilter)
    if (hospitalFilter !== 'all') rows = rows.filter((d) => d.hospital === hospitalFilter)
    if (doctorFilter !== 'all') rows = rows.filter((d) => d.doctor === doctorFilter)
    if (treatmentFilter !== 'all') rows = rows.filter((d) => (d.lead.treatment ?? '') === treatmentFilter)
    if (debouncedSearch.trim() && !phoneParsed) {
      const q = debouncedSearch.toLowerCase()
      rows = rows.filter((d) => getCaseRowSearchBlob(d, activeSearchColumns, canViewPhone).includes(q))
    }
    const sorted = [...rows]
    if (sortKey) {
      sorted.sort((a, b) => compareCaseRows(a, b, sortKey, sortDir, canViewPhone))
    } else {
      sorted.sort((a, b) => getLatestActivityTime(b.lead) - getLatestActivityTime(a.lead))
    }
    return sorted
  }, [
    decorated,
    stageFilter,
    teamFilter,
    selectedBdIds,
    circleFilter,
    hospitalFilter,
    doctorFilter,
    treatmentFilter,
    debouncedSearch,
    phoneParsed,
    activeSearchColumns,
    canViewPhone,
    sortKey,
    sortDir,
    teamsData,
  ])

  const visibleColumns = useMemo(() => {
    return CASE_TRACKER_COLUMNS.filter((col) => {
      if (col.key === 'bd' && !showBdFilter) return false
      return true
    })
  }, [showBdFilter])

  const toggleSort = (key: CaseTrackerColumnKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const columnSearchOptions = useMemo(
    () => CASE_TRACKER_COLUMNS.map((c) => ({ value: c.key, label: c.label })),
    []
  )

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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 h-10"
                    placeholder="Search patient, phone, UHID, hospital, insurance, TPA, BD, city, status…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <MultiSelectDropdown
                  options={columnSearchOptions}
                  selected={searchColumnKeys}
                  onChange={setSearchColumnKeys}
                  placeholder="Search columns"
                  searchPlaceholder="Filter columns…"
                  emptyLabel="All columns"
                  className="w-full lg:w-[220px]"
                />
              </div>
              {searchColumnKeys.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Searching in {searchColumnKeys.length} selected column{searchColumnKeys.length === 1 ? '' : 's'} only
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Stage cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {user?.role !== 'PL_HEAD' && (
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                  stageFilter === 'all' ? 'ring-2 ring-primary' : ''
                }`}
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
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                  stageFilter === key ? 'ring-2 ring-primary' : ''
                }`}
              >
                <p className="line-clamp-2 text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{counts[key]}</p>
              </button>
            ))}
          </div>

          {/* ── Table ── */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Leads</CardTitle>
                  <CardDescription>
                    {filteredRows.length} shown · {decorated.length} active
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => exportCaseRowsCsv(filteredRows, visibleColumns, canViewPhone)}
                  disabled={filteredRows.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <CaseTrackerDateRangeFilter value={dateRange} onChange={setDateRange} />

                {showTeamFilter && (
                  <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setSelectedBdIds([]) }}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teams</SelectItem>
                      {(teamsData ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {showBdFilter && (
                  <MultiSelectDropdown
                    options={bdOptions}
                    selected={selectedBdIds}
                    onChange={setSelectedBdIds}
                    placeholder="Business developer"
                    searchPlaceholder="Search BDs…"
                    emptyLabel="All BDs"
                    className="w-[180px]"
                  />
                )}

                <Select value={circleFilter} onValueChange={setCircleFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Circle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All circles</SelectItem>
                    {circleOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All hospitals</SelectItem>
                    {hospitalOptions.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All doctors</SelectItem>
                    {doctorOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Treatment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All treatments</SelectItem>
                    {treatmentOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-10 text-center text-muted-foreground">Loading…</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {visibleColumns.map((col) => (
                          <TableHead key={col.key}>
                            {col.sortable ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                onClick={() => toggleSort(col.key)}
                              >
                                {col.label}
                                {sortKey === col.key ? (
                                  sortDir === 'asc' ? (
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                )}
                              </button>
                            ) : (
                              col.label
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleColumns.length} className="py-10 text-center text-muted-foreground">
                            No leads match
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map((row) => {
                          const badge = BUCKET_BADGE[row.bucket]
                          return (
                            <TableRow
                              key={row.lead.id}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => setDrawerRow(row)}
                            >
                              {visibleColumns.map((col) => {
                                if (col.key === 'leadRef') {
                                  return (
                                    <TableCell key={col.key} onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center gap-0.5">
                                        <span className="font-medium">{row.lead.leadRef}</span>
                                        {row.lead.leadRef && (
                                          <CopyLeadRefButton leadRef={String(row.lead.leadRef)} />
                                        )}
                                      </div>
                                    </TableCell>
                                  )
                                }
                                if (col.key === 'stage') {
                                  return (
                                    <TableCell key={col.key}>
                                      <Badge variant="secondary" className={badge.className}>
                                        {badge.label}
                                      </Badge>
                                    </TableCell>
                                  )
                                }
                                const display = formatCaseCellDisplay(row, col.key, canViewPhone)
                                return (
                                  <TableCell
                                    key={col.key}
                                    className={cn(
                                      'text-sm',
                                      ['patientName', 'hospital', 'doctor', 'treatment', 'insurance', 'tpa', 'bd'].includes(col.key) &&
                                        'max-w-[160px] truncate'
                                    )}
                                  >
                                    {display}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PatientDetailDrawer
        row={drawerRow}
        open={!!drawerRow}
        onClose={() => setDrawerRow(null)}
        stageBadgeClassName={drawerRow ? BUCKET_BADGE[drawerRow.bucket].className : undefined}
      />
    </AuthenticatedLayout>
  )
}
