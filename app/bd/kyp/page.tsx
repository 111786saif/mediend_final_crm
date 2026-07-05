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
import { ColumnFilter } from '@/components/ui/column-filter'
import { CaseStage } from '@/generated/prisma/enums'
import { useAuth } from '@/hooks/use-auth'
import { useLeads, type Lead } from '@/hooks/use-leads'
import { apiGet } from '@/lib/api-client'
import { getLatestActivityTime } from '@/lib/lead-activity'
import { formatLeadAgeSex, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

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

  const isOrgViewer = user?.role === 'SALES_HEAD' || user?.role === 'EXECUTIVE_ASSISTANT' || user?.role === 'PL_HEAD'

  const [search, setSearch] = useState('')
  const phoneParsed = useMemo(() => parsePhoneSearchQuery(search), [search])

  const [monthFilter, setMonthFilter] = useState(currentMonthKey)
  const [stageFilter, setStageFilter] = useState<Bucket | 'all'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [bdFilter, setBdFilter] = useState('all')
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [treatmentFilter, setTreatmentFilter] = useState('all')
  const [circleFilter, setCircleFilter] = useState('all')

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

  // Map every lead to a unified bucket; anything without a bucket (NEW_LEAD,
  // discharged, PL, outstanding) is dropped from the active tracker.
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
      out.push({ lead, bucket: resolvedBucket, hospital: hospital ?? '', doctor: doctor ?? '' })
    }
    return out
  }, [leads])

  // Mapping dynamic distinct unique lists safely from active data
  const leadRefOptions = useMemo(() => uniqueSorted(decorated.map((d) => String(d.lead.leadRef ?? ''))), [decorated])
  const dateOptions = useMemo(() => uniqueSorted(decorated.map((d) => {
    const dt = d.lead.leadEntryDate || d.lead.createdDate
    return dt ? format(new Date(dt as string), 'MMM d, yyyy') : ''
  })), [decorated])
  const surgeryDateOptions = useMemo(() => uniqueSorted(decorated.map((d) => {
    const sd = d.lead.surgeryDate ?? (d.lead as any).admissionRecord?.surgeryDate
    return sd ? format(new Date(sd as string), 'MMM d, yyyy') : ''
  })), [decorated])
  const patientOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.lead.patientName)), [decorated])
  const ageSexOptions = useMemo(() => uniqueSorted(decorated.map((d) => formatLeadAgeSex(d.lead))), [decorated])
  const circleOptions = useMemo(() => uniqueSorted(decorated.map((d) => (typeof d.lead.circle === 'string' ? d.lead.circle : ''))), [decorated])
  const cityOptions = useMemo(() => uniqueSorted(decorated.map((d) => (typeof d.lead.city === 'string' ? d.lead.city : ''))), [decorated])
  const treatmentOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.lead.treatment)), [decorated])
  const bdmOptions = useMemo(() => uniqueSorted(decorated.map((d) => (d.lead.plRecord?.bdmName ?? d.lead.bd?.name ?? '').trim())), [decorated])
  const hospitalOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.hospital)), [decorated])
  const doctorOptions = useMemo(() => uniqueSorted(decorated.map((d) => d.doctor)), [decorated])
  const stageOptions = useMemo(() => uniqueSorted(decorated.map((d) => BUCKET_BADGE[d.bucket]?.label ?? '')), [decorated])

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

    if (isOrgViewer) {
      if (bdFilter !== 'all') {
        const bdTarget = list.find((t) => t.targetType === 'BD' && t.targetForId === bdFilter)
        if (bdTarget) return toCard(bdTarget.entityName, bdTarget.metric, bdTarget.actual, bdTarget.targetValue, bdTarget.percentage)
        for (const t of list) {
          const b = t.bdBreakdown?.find((x) => x.id === bdFilter)
          if (b) return toCard(b.name, t.metric, b.actual, t.targetValue, b.percentage)
        }
        return null
      }
      if (teamFilter !== 'all') {
        const teamTarget = list.find((t) => t.targetType === 'TEAM' && t.targetForId === teamFilter)
        if (teamTarget) return toCard(teamTarget.entityName, teamTarget.metric, teamTarget.actual, teamTarget.targetValue, teamTarget.percentage)
      }
      const t = prefer(list)
      return t ? toCard(t.entityName, t.metric, t.actual, t.targetValue, t.percentage) : null
    }

    // BD (the progress API already scopes to the signed-in BD)
    const bdTargets = list.filter((t) => t.targetType === 'BD')
    const t = prefer(bdTargets.length ? bdTargets : list)
    return t ? toCard(t.entityName, t.metric, t.actual, t.targetValue, t.percentage) : null
  }, [targetProgress, user?.role, bdFilter, teamFilter, isOrgViewer])

  const monthOptions = useMemo(() => {
    const months: string[] = []
    const now = new Date()
    let y = now.getFullYear()
    let m = now.getMonth()
    while (y > 2022 || (y === 2022 && m >= 0)) {
      months.push(`${y}-${String(m + 1).padStart(2, '0')}`)
      m--
      if (m < 0) { m = 11; y-- }
    }
    return months
  }, [])

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
      for (const team of teams) {
        for (const member of team.members) {
          if (member.id && member.name) map.set(member.id, member.name)
        }
      }
    } else {
      for (const { lead } of decorated) {
        const bd = lead.bd as { id?: string; name?: string } | undefined
        if (bd?.id && bd.name) map.set(bd.id, bd.name)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [decorated, showBdFilter, showTeamFilter, teamsData])

  const monthFiltered = useMemo<DecoratedLead[]>(() => {
    if (monthFilter === 'all') return decorated

    return decorated.filter((d) => {
      const isIpdDone = d.bucket === 'IPD_DONE'
      if (isIpdDone) {
        const adSurg = (d.lead as { admissionRecord?: { surgeryDate?: string | Date } }).admissionRecord?.surgeryDate
        const sd = d.lead.surgeryDate ?? adSurg
        if (sd) {
          const t = new Date(sd as string).getTime()
          if (Number.isFinite(t) && t > 0) {
            return monthKeyOf(new Date(t).toISOString()) === monthFilter
          }
        }
        return false
      }
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
  }, [decorated, monthFilter])

  const counts = useMemo(() => {
    const base: Record<Bucket, number> = {
      KYP: 0,
      HOSPITALS_SUGGESTED: 0,
      PREAUTH_RAISED: 0,
      PREAUTH_COMPLETE: 0,
      IPD_SCHEDULED: 0,
      IPD_DONE: 0,
    }
    for (const { bucket } of monthFiltered) base[bucket]++
    return base
  }, [monthFiltered])

  const filteredRows = useMemo(() => {
    let rows = monthFiltered
    if (stageFilter !== 'all') rows = rows.filter((d) => d.bucket === stageFilter)
    if (teamFilter !== 'all') {
      const teamBdIds = new Set(teamsData?.find((t) => t.id === teamFilter)?.members.map((m) => m.id) ?? [])
      rows = rows.filter((d) => teamBdIds.has((d.lead.bd as { id?: string } | undefined)?.id ?? ''))
    }
    if (bdFilter !== 'all') {
      rows = rows.filter((d) => (d.lead.bd as { id?: string } | undefined)?.id === bdFilter)
    }

    // Checking row parameters validations safely
    if (columnFilters.leadRef?.length) rows = rows.filter((d) => columnFilters.leadRef.includes(String(d.lead.leadRef ?? '')))
    if (columnFilters.date?.length === 2) {
      const [startStr, endStr] = columnFilters.date
      const start = startStr ? new Date(startStr) : null
      const end = endStr ? new Date(endStr) : null
      if (start && end) {
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        rows = rows.filter((d) => {
          const dt = d.lead.leadEntryDate || d.lead.createdDate
          if (!dt) return false
          const t = new Date(dt as string).getTime()
          return t >= start.getTime() && t <= end.getTime()
        })
      }
    }
    if (columnFilters.surgeryDate?.length === 2) {
      const [startStr, endStr] = columnFilters.surgeryDate
      const start = startStr ? new Date(startStr) : null
      const end = endStr ? new Date(endStr) : null
      if (start && end) {
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        rows = rows.filter((d) => {
          const sd = d.lead.surgeryDate ?? (d.lead as any).admissionRecord?.surgeryDate
          if (!sd) return false
          const t = new Date(sd as string).getTime()
          return t >= start.getTime() && t <= end.getTime()
        })
      }
    }
    if (columnFilters.patient?.length) rows = rows.filter((d) => columnFilters.patient.includes(d.lead.patientName ?? ''))
    if (columnFilters.ageSex?.length) rows = rows.filter((d) => columnFilters.ageSex.includes(formatLeadAgeSex(d.lead)))
    if (columnFilters.circle?.length) rows = rows.filter((d) => columnFilters.circle.includes(typeof d.lead.circle === 'string' ? d.lead.circle : ''))
    if (columnFilters.city?.length) rows = rows.filter((d) => columnFilters.city.includes(typeof d.lead.city === 'string' ? d.lead.city : ''))
    if (columnFilters.treatment?.length) rows = rows.filter((d) => columnFilters.treatment.includes(d.lead.treatment ?? ''))
    if (columnFilters.bdm?.length) rows = rows.filter((d) => columnFilters.bdm.includes((d.lead.plRecord?.bdmName ?? d.lead.bd?.name ?? '').trim()))
    if (columnFilters.hospital?.length) rows = rows.filter((d) => columnFilters.hospital.includes(d.hospital))
    if (columnFilters.doctor?.length) rows = rows.filter((d) => columnFilters.doctor.includes(d.doctor))
    if (columnFilters.stage?.length) rows = rows.filter((d) => columnFilters.stage.includes(BUCKET_BADGE[d.bucket]?.label ?? ''))

    if (circleFilter !== 'all') rows = rows.filter((d) => (d.lead.circle ?? '') === circleFilter)
    if (hospitalFilter !== 'all') rows = rows.filter((d) => d.hospital === hospitalFilter)
    if (doctorFilter !== 'all') rows = rows.filter((d) => d.doctor === doctorFilter)
    if (treatmentFilter !== 'all') rows = rows.filter((d) => (d.lead.treatment ?? '') === treatmentFilter)
    if (search.trim() && !phoneParsed) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (d) =>
          String(d.lead.patientName ?? '').toLowerCase().includes(q) ||
          d.hospital.toLowerCase().includes(q) ||
          String(d.lead.treatment ?? '').toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => getLatestActivityTime(b.lead) - getLatestActivityTime(a.lead))
  }, [monthFiltered, stageFilter, teamFilter, bdFilter, columnFilters, circleFilter, hospitalFilter, doctorFilter, treatmentFilter, search, phoneParsed, teamsData])

  const pipelinePath = user?.role === 'TEAM_LEAD' ? '/team-lead/pipeline' : '/bd/pipeline'

  const isMoneyMetric =
    targetCard?.metric === 'NET_PROFIT' ||
    targetCard?.metric === 'BILL_AMOUNT' ||
    targetCard?.metric === 'REVENUE'
  const fmtTarget = (n: number) =>
    isMoneyMetric ? `₹${Math.round(n).toLocaleString('en-IN')}` : Math.round(n).toLocaleString('en-IN')

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
            <ColumnFilter type="date" value={columnFilters.date} options={dateOptions} onChange={(selected) => handleColumnFilterChange('date', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => {
          const d = row.original.lead.leadEntryDate || row.original.lead.createdDate;
          return <div className="whitespace-nowrap text-sm text-muted-foreground">{d ? format(new Date(d as string), 'MMM d, yyyy') : '—'}</div>
        }
      },
      {
        id: 'surgeryDate',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
            <span>Surgery Date</span>
            <ColumnFilter type="date" value={columnFilters.surgeryDate} options={surgeryDateOptions} onChange={(selected) => handleColumnFilterChange('surgeryDate', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => {
          const sd = row.original.lead.surgeryDate ?? (row.original.lead as { admissionRecord?: { surgeryDate?: string } }).admissionRecord?.surgeryDate;
          return <div className="whitespace-nowrap text-sm text-muted-foreground">{sd ? format(new Date(sd as string), 'MMM d, yyyy') : '—'}</div>
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
            <ColumnFilter value={columnFilters.circle} options={circleOptions} onChange={(selected) => handleColumnFilterChange('circle', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div>{typeof row.original.lead.circle === 'string' ? row.original.lead.circle : '—'}</div>
      },
      {
        id: 'treatment',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
            <span>Treatment</span>
            <ColumnFilter value={columnFilters.treatment} options={treatmentOptions} onChange={(selected) => handleColumnFilterChange('treatment', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[140px] truncate">{row.original.lead.treatment ?? '—'}</div>
      }
    ];

    if (showBdFilter) {
      cols.push({
        id: 'bdm',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[110px]">
            <span>BDM</span>
            <ColumnFilter value={columnFilters.bdm} options={bdmOptions} onChange={(selected) => handleColumnFilterChange('bdm', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[120px] truncate">{(row.original.lead.plRecord?.bdmName ?? row.original.lead.bd?.name ?? '').trim() || '—'}</div>
      });
    }

    cols.push(
      {
        id: 'hospital',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[140px]">
            <span>Hospital</span>
            <ColumnFilter value={columnFilters.hospital} options={hospitalOptions} onChange={(selected) => handleColumnFilterChange('hospital', selected as string[])} />
          </div>
        ),
        cell: ({ row }) => <div className="max-w-[160px] truncate">{row.original.hospital || '—'}</div>
      },
      {
        id: 'doctor',
        header: () => (
          <div className="flex items-center justify-between gap-1 whitespace-nowrap min-w-[130px]">
            <span>Doctor</span>
            <ColumnFilter value={columnFilters.doctor} options={doctorOptions} onChange={(selected) => handleColumnFilterChange('doctor', selected as string[])} />
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
          const badge = BUCKET_BADGE[row.original.bucket];
          return (
            <Badge variant="secondary" className={badge.className}>
              {badge.label}
            </Badge>
          );
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
    );

    return cols;
  }, [
    columnFilters, leadRefOptions, dateOptions, surgeryDateOptions, patientOptions, ageSexOptions, circleOptions, treatmentOptions, bdmOptions, hospitalOptions, doctorOptions, stageOptions, showBdFilter
  ]);



  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-background">
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          {/* ── Header ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Case tracker</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.role === 'PL_HEAD' ? 'IPD done cases across all teams' : 'Active cash &amp; insurance cases after KYP — tap a card to filter'}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {user?.role !== 'PL_HEAD' && targetCard && (
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
              {user?.role !== 'PL_HEAD' && (
                <Button onClick={() => router.push(pipelinePath)} className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  New case submission
                </Button>
              )}
            </div>
          </div>

          {/* ── Stage cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {user?.role !== 'PL_HEAD' && (
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${stageFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">All active</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{monthFiltered.length}</p>
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
                    {filteredRows.length} shown · {monthFiltered.length} active
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

                {showTeamFilter && (
                  <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setBdFilter('all') }}>
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
                  <DataTable
                    columns={columns}
                    data={filteredRows}
                    onRowClick={(row) => router.push(`/patient/${row.lead.id}`)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}