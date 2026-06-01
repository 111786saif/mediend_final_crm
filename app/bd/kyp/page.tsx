'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useLeads, type Lead } from '@/hooks/use-leads'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { formatLeadAgeSex, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { CaseStage } from '@/generated/prisma/enums'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

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
type Bucket =
  | 'KYP'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'IPD_SCHEDULED'
  | 'IPD_DONE'

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
  // IPD done (insurance + cash)
  [CaseStage.IPD_DONE]: 'IPD_DONE',
  [CaseStage.CASH_IPD_DONE]: 'IPD_DONE',
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

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM'
  targetForId: string
  entityName: string
  metric: string
  targetValue: number
  actual: number
  percentage: number
  bdBreakdown?: { id: string; name: string; actual: number; percentage: number }[]
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const s = (v ?? '').trim()
    if (s) set.add(s)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function monthKeyOf(value: unknown): string | null {
  if (!value) return null
  const d = new Date(value as string)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type DecoratedLead = { lead: Lead; bucket: Bucket; hospital: string; doctor: string }

export default function CaseTrackerPage() {
  const { user } = useAuth()
  const router = useRouter()

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [stageFilter, setStageFilter] = useState<Bucket | 'all'>('all')
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey)
  const [bdFilter, setBdFilter] = useState<string>('all')
  const [circleFilter, setCircleFilter] = useState<string>('all')
  const [hospitalFilter, setHospitalFilter] = useState<string>('all')
  const [doctorFilter, setDoctorFilter] = useState<string>('all')
  const [treatmentFilter, setTreatmentFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const phoneParsed = parsePhoneSearchQuery(debouncedSearch)

  const leadFilters = useMemo(() => {
    // view=pipeline uses a slim Lead select on /api/leads (avoids heavy KYP/preAuth joins that caused 60s+ loads)
    if (user?.role === 'BD' && user.id) {
      return {
        bdId: user.id,
        view: 'pipeline' as const,
        ...(phoneParsed ? { phoneSearch: phoneParsed.last10 } : {}),
      }
    }
    return {
      view: 'pipeline' as const,
      ...(phoneParsed ? { phoneSearch: phoneParsed.last10 } : {}),
    }
  }, [user?.role, user?.id, phoneParsed])

  const { leads, isLoading } = useLeads(leadFilters)

  // Map every lead to a unified bucket; anything without a bucket (NEW_LEAD,
  // discharged, PL, outstanding) is dropped from the active tracker.
  const decorated = useMemo<DecoratedLead[]>(() => {
    const out: DecoratedLead[] = []
    for (const lead of leads) {
      const bucket = lead.caseStage ? BUCKET_OF_STAGE[lead.caseStage as CaseStage] : undefined
      if (!bucket) continue
      const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
      out.push({ lead, bucket, hospital: hospital ?? '', doctor: doctor ?? '' })
    }
    return out
  }, [leads])

  const monthForTarget = monthFilter !== 'all' ? monthFilter : currentMonthKey

  const { data: targetProgress } = useQuery<TargetProgress[]>({
    queryKey: ['targets', 'progress', monthForTarget],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthForTarget}`),
    enabled: !!user,
  })

  const targetCard = useMemo(() => {
    const list = targetProgress ?? []
    if (!list.length) return null
    const prefer = (arr: TargetProgress[]) =>
      arr.find((t) => t.metric === 'IPD_DONE') ??
      arr.find((t) => t.metric === 'SURGERIES_DONE') ??
      arr[0]
    const toCard = (name: string, metric: string, actual: number, goal: number, pct: number) => ({
      name,
      metric,
      actual,
      goal,
      pct,
    })

    if (user?.role === 'TEAM_LEAD') {
      if (bdFilter !== 'all') {
        const bdTarget = list.find((t) => t.targetType === 'BD' && t.targetForId === bdFilter)
        if (bdTarget) return toCard(bdTarget.entityName, bdTarget.metric, bdTarget.actual, bdTarget.targetValue, bdTarget.percentage)
        for (const t of list) {
          const b = t.bdBreakdown?.find((x) => x.id === bdFilter)
          if (b) return toCard(b.name, t.metric, b.actual, t.targetValue, b.percentage)
        }
        return null
      }
      const teamTargets = list.filter((t) => t.targetType === 'TEAM')
      const t = prefer(teamTargets.length ? teamTargets : list)
      return t ? toCard(t.entityName, t.metric, t.actual, t.targetValue, t.percentage) : null
    }

    // BD (the progress API already scopes to the signed-in BD)
    const bdTargets = list.filter((t) => t.targetType === 'BD')
    const t = prefer(bdTargets.length ? bdTargets : list)
    return t ? toCard(t.entityName, t.metric, t.actual, t.targetValue, t.percentage) : null
  }, [targetProgress, user?.role, bdFilter])

  const monthOptions = useMemo(() => {
    const months = new Set<string>([currentMonthKey])
    if (monthFilter !== 'all') months.add(monthFilter)
    for (const { lead } of decorated) {
      const key = monthKeyOf(lead.leadEntryDate || lead.createdDate)
      if (key) months.add(key)
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [decorated, currentMonthKey, monthFilter])

  const showBdFilter = user?.role === 'TEAM_LEAD'
  const bdOptions = useMemo(() => {
    if (!showBdFilter) return []
    const map = new Map<string, string>()
    for (const { lead } of decorated) {
      const bd = lead.bd as { id?: string; name?: string } | undefined
      if (bd?.id && bd.name) map.set(bd.id, bd.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [decorated, showBdFilter])

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
    if (monthFilter !== 'all') {
      rows = rows.filter((d) => {
        const surgeryTs = (() => {
          const v = d.lead.surgeryDate
          if (!v) return Infinity
          const t = new Date(v as string).getTime()
          return Number.isFinite(t) ? t : Infinity
        })()
        const activityTs = getLatestActivityTime(d.lead)
        const effectiveTs = Math.min(surgeryTs, activityTs) || activityTs
        return monthKeyOf(new Date(effectiveTs).toISOString()) === monthFilter
      })
    }
    if (bdFilter !== 'all') {
      rows = rows.filter((d) => (d.lead.bd as { id?: string } | undefined)?.id === bdFilter)
    }
    if (circleFilter !== 'all') rows = rows.filter((d) => (d.lead.circle ?? '') === circleFilter)
    if (hospitalFilter !== 'all') rows = rows.filter((d) => d.hospital === hospitalFilter)
    if (doctorFilter !== 'all') rows = rows.filter((d) => d.doctor === doctorFilter)
    if (treatmentFilter !== 'all') rows = rows.filter((d) => (d.lead.treatment ?? '') === treatmentFilter)
    if (search.trim() && !phoneParsed) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (d) =>
          String(d.lead.patientName ?? '').toLowerCase().includes(q) ||
          String(d.lead.leadRef ?? '').toLowerCase().includes(q) ||
          d.hospital.toLowerCase().includes(q) ||
          String(d.lead.treatment ?? '').toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => getLatestActivityTime(b.lead) - getLatestActivityTime(a.lead))
  }, [decorated, stageFilter, monthFilter, bdFilter, circleFilter, hospitalFilter, doctorFilter, treatmentFilter, search, phoneParsed])

  const pipelinePath = user?.role === 'TEAM_LEAD' ? '/team-lead/pipeline' : '/bd/pipeline'

  const isMoneyMetric =
    targetCard?.metric === 'NET_PROFIT' ||
    targetCard?.metric === 'BILL_AMOUNT' ||
    targetCard?.metric === 'REVENUE'
  const fmtTarget = (n: number) =>
    isMoneyMetric ? `₹${Math.round(n).toLocaleString('en-IN')}` : Math.round(n).toLocaleString('en-IN')

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-background">
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          {/* ── Header ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Case tracker</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Active cash &amp; insurance cases after KYP — tap a card to filter
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {targetCard && (
                <div className="min-w-[240px] rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Target · {targetCard.metric.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">{Math.round(targetCard.pct)}%</p>
                  </div>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">
                    {fmtTarget(targetCard.actual)}{' '}
                    <span className="text-sm font-normal text-muted-foreground">/ {fmtTarget(targetCard.goal)}</span>
                  </p>
                  <Progress value={Math.min(100, targetCard.pct)} className="mt-2 h-1.5" />
                </div>
              )}
              <Button onClick={() => router.push(pipelinePath)} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                New case submission
              </Button>
            </div>
          </div>

          {/* ── Stage cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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
            {BUCKET_DEFS.map(({ key, label, tone }) => (
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
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name, ref, hospital… — or full mobile (10 digits)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {monthOptions.map((m) => {
                      const [y, mo] = m.split('-')
                      return (
                        <SelectItem key={m} value={m}>
                          {format(new Date(Number(y), Number(mo) - 1, 1), 'MMM yyyy')}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                {showBdFilter && (
                  <Select value={bdFilter} onValueChange={setBdFilter}>
                    <SelectTrigger className="w-[150px]">
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
                        <TableHead>Lead ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Age/Sex</TableHead>
                        <TableHead>Circle</TableHead>
                        <TableHead>Treatment</TableHead>
                        {showBdFilter && <TableHead>BDM</TableHead>}
                        <TableHead>Hospital</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="w-[90px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showBdFilter ? 11 : 10} className="py-10 text-center text-muted-foreground">
                            No leads match
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map(({ lead, bucket, hospital, doctor }) => {
                          const badge = BUCKET_BADGE[bucket]
                          const d = lead.leadEntryDate || lead.createdDate
                          return (
                            <TableRow
                              key={lead.id}
                              className="cursor-pointer"
                              onClick={() => router.push(`/patient/${lead.id}`)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-0.5">
                                  <span className="font-medium">{lead.leadRef}</span>
                                  {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {d ? format(new Date(d as string), 'MMM d, yyyy') : '—'}
                              </TableCell>
                              <TableCell>{lead.patientName}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm">{formatLeadAgeSex(lead)}</TableCell>
                              <TableCell>{typeof lead.circle === 'string' ? lead.circle : '—'}</TableCell>
                              <TableCell className="max-w-[140px] truncate">{lead.treatment ?? '—'}</TableCell>
                              {showBdFilter && (
                                <TableCell className="max-w-[120px] truncate">
                                  {(lead.plRecord?.bdmName ?? lead.bd?.name ?? '').trim() || '—'}
                                </TableCell>
                              )}
                              <TableCell className="max-w-[160px] truncate">{hospital || '—'}</TableCell>
                              <TableCell className="max-w-[160px] truncate">{doctor || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={badge.className}>
                                  {badge.label}
                                </Badge>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/patient/${lead.id}`}>Open</Link>
                                </Button>
                              </TableCell>
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
    </AuthenticatedLayout>
  )
}
