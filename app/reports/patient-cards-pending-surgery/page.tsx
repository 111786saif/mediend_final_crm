'use client'

import { ProtectedRoute } from '@/components/protected-route'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useState, useMemo } from 'react'
import { AlertTriangle, ChevronDown, Download } from 'lucide-react'
import Link from 'next/link'
import { CASE_STAGE_CONFIG, getCaseStageLabel } from '@/lib/case-stage-labels'
import { cn } from '@/lib/utils'

type Row = {
  id: string
  leadRef: string
  patientName: string
  phoneNumber: string
  caseStage: string
  pipelineStage: string
  hospitalName: string
  treatment: string | null
  uploadDate: string
  daysSinceUpload: number
  bdmId: string
  bdmName: string
  teamLeadId: string | null
  teamLeadName: string | null
}

type Group = {
  teamLeadId: string
  teamLeadName: string
  count: number
}

type ReportResponse = {
  rows: Row[]
  groups?: Group[]
  months: string[]
  truncated: boolean
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function monthKey(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`
}

function formatMonthKey(key: string): string {
  const [y, m] = key.split('-')
  const idx = Number(m) - 1
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return key
  return `${MONTH_LABELS[idx]} ${y}`
}

function summarizeMonths(keys: string[]): string {
  if (keys.length === 0) return 'No months'
  const sorted = [...keys].sort()
  // If all same year, show "Jan, Mar 2026"; otherwise show "Jan 2026, Feb 2027"
  const years = new Set(sorted.map((k) => k.split('-')[0]))
  if (years.size === 1) {
    const year = sorted[0].split('-')[0]
    const labels = sorted.map((k) => MONTH_LABELS[Number(k.split('-')[1]) - 1])
    return `${labels.join(', ')} ${year}`
  }
  return sorted.map(formatMonthKey).join(', ')
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(rows: Row[]) {
  const header = [
    'Lead ID',
    'Patient Name',
    'Phone',
    'BDM',
    'Team Lead',
    'Upload Date',
    'Days Since Upload',
    'Case Stage',
    'Pipeline Stage',
    'Hospital',
    'Treatment',
  ]
  const lines = [header.map(csvEscape).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.leadRef,
        r.patientName,
        r.phoneNumber,
        r.bdmName,
        r.teamLeadName ?? '',
        r.uploadDate.slice(0, 10),
        r.daysSinceUpload,
        getCaseStageLabel(r.caseStage),
        r.pipelineStage,
        r.hospitalName,
        r.treatment ?? '',
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `patient-cards-pending-surgery-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function rowTone(daysSinceUpload: number): string {
  if (daysSinceUpload > 60) return 'bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/40'
  if (daysSinceUpload > 30) return 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/40'
  return ''
}

type AgingBucket = '30' | '60' | '90'

function matchesAging(days: number, bucket: AgingBucket | null): boolean {
  if (!bucket) return true
  if (bucket === '30') return days <= 30
  if (bucket === '60') return days >= 31 && days <= 60
  return days > 60
}

// Several caseStage enum values share a display label (e.g. KYP_PENDING and
// KYP_BASIC_PENDING are both "Card Details Pending"), so dedupe by label and
// let one option match every underlying stage with that label.
const STAGE_OPTIONS: Array<{ value: string; label: string; stages: string[] }> = (() => {
  const byLabel = new Map<string, string[]>()
  for (const [stage, { label }] of Object.entries(CASE_STAGE_CONFIG)) {
    const arr = byLabel.get(label) ?? []
    arr.push(stage)
    byLabel.set(label, arr)
  }
  return Array.from(byLabel.entries())
    .map(([label, stages]) => ({ value: stages.join(','), label, stages }))
    .sort((a, b) => a.label.localeCompare(b.label))
})()

const AGING_CARDS: Array<{
  key: AgingBucket
  label: string
  subtitle: string
  borderClass: string
  bgClass: string
  titleClass: string
  countClass: string
}> = [
  {
    key: '30',
    label: '30 Days',
    subtitle: 'Pending 0–30 days',
    borderClass: 'border-l-emerald-500',
    bgClass: 'from-emerald-50/90 dark:from-emerald-950/35',
    titleClass: 'text-emerald-900/90 dark:text-emerald-100/90',
    countClass: 'text-emerald-950 dark:text-emerald-50',
  },
  {
    key: '60',
    label: '60 Days',
    subtitle: 'Pending 31–60 days',
    borderClass: 'border-l-amber-500',
    bgClass: 'from-amber-50/90 dark:from-amber-950/35',
    titleClass: 'text-amber-900/90 dark:text-amber-100/90',
    countClass: 'text-amber-950 dark:text-amber-50',
  },
  {
    key: '90',
    label: '90 Days',
    subtitle: 'Pending more than 60 days',
    borderClass: 'border-l-red-500',
    bgClass: 'from-red-50/90 dark:from-red-950/35',
    titleClass: 'text-red-900/90 dark:text-red-100/90',
    countClass: 'text-red-950 dark:text-red-50',
  },
]

export default function PatientCardsPendingSurgeryPage() {
  const { user } = useAuth()
  const isTL = user?.role === 'TEAM_LEAD'

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => [
    monthKey(currentYear, 3),
    monthKey(currentYear, 4),
  ])
  const [teamLeadFilter, setTeamLeadFilter] = useState<string>('all')
  const [groupByTeam, setGroupByTeam] = useState(true)
  const [agingFilter, setAgingFilter] = useState<AgingBucket | null>(null)
  const [stageFilter, setStageFilter] = useState<string>('all')

  const monthsParam = useMemo(() => [...selectedMonths].sort().join(','), [selectedMonths])

  const toggleMonth = (key: string) => {
    setSelectedMonths((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear + 1; y >= currentYear - 4; y--) years.push(y)
    return years
  }, [currentYear])

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey: ['reports/patient-cards-pending-surgery', monthsParam, teamLeadFilter],
    queryFn: () => {
      const params = new URLSearchParams({ months: monthsParam })
      if (teamLeadFilter !== 'all') params.set('teamLeadUserId', teamLeadFilter)
      return apiGet<ReportResponse>(`/api/reports/patient-cards-pending-surgery?${params.toString()}`)
    },
    enabled: !!monthsParam && !!user,
  })

  const baseRows = useMemo(() => data?.rows ?? [], [data])

  const stageScopedRows = useMemo(() => {
    if (stageFilter === 'all') return baseRows
    const stages = new Set(stageFilter.split(','))
    return baseRows.filter((r) => stages.has(r.caseStage))
  }, [baseRows, stageFilter])

  const filteredRows = useMemo(() => {
    if (!agingFilter) return stageScopedRows
    return stageScopedRows.filter((r) => matchesAging(r.daysSinceUpload, agingFilter))
  }, [stageScopedRows, agingFilter])

  const agingCounts = useMemo(
    () => ({
      '30': stageScopedRows.filter((r) => matchesAging(r.daysSinceUpload, '30')).length,
      '60': stageScopedRows.filter((r) => matchesAging(r.daysSinceUpload, '60')).length,
      '90': stageScopedRows.filter((r) => matchesAging(r.daysSinceUpload, '90')).length,
    }),
    [stageScopedRows]
  )

  const groupsForUi = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>()
    for (const r of stageScopedRows) {
      if (!r.teamLeadId) continue
      const existing = counts.get(r.teamLeadId)
      if (existing) existing.count += 1
      else counts.set(r.teamLeadId, { name: r.teamLeadName ?? '', count: 1 })
    }
    return Array.from(counts.entries())
      .map(([teamLeadId, v]) => ({ teamLeadId, teamLeadName: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
  }, [stageScopedRows])

  const groupedRows = useMemo(() => {
    if (!groupsForUi.length) return null
    const byTl = new Map<string, Row[]>()
    for (const r of filteredRows) {
      const key = r.teamLeadId ?? '__unassigned'
      const arr = byTl.get(key) ?? []
      arr.push(r)
      byTl.set(key, arr)
    }
    return groupsForUi
      .map((g) => ({ ...g, rows: byTl.get(g.teamLeadId) ?? [], count: (byTl.get(g.teamLeadId) ?? []).length }))
      .concat(
        byTl.has('__unassigned')
          ? [{
              teamLeadId: '__unassigned',
              teamLeadName: 'Unassigned',
              count: byTl.get('__unassigned')!.length,
              rows: byTl.get('__unassigned')!,
            }]
          : []
      )
      .filter((g) => g.rows.length > 0)
  }, [groupsForUi, filteredRows])

  const toggleAging = (bucket: AgingBucket) => {
    setAgingFilter((prev) => (prev === bucket ? null : bucket))
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/35 to-indigo-50/45 p-6 dark:from-slate-950 dark:via-teal-950/20 dark:to-indigo-950/25">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 inline-flex h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-teal-500 to-indigo-600 shadow-sm"
                aria-hidden
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-800 via-cyan-800 to-indigo-800 bg-clip-text text-transparent dark:from-teal-200 dark:via-cyan-200 dark:to-indigo-200">
                  Pending Surgery — Patient Cards
                </h1>
                <p className="text-muted-foreground mt-1">
                  Cards uploaded in the selected window whose surgery is still not done.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-2 min-w-[220px] justify-between">
                    <span className="truncate text-left">
                      {selectedMonths.length === 0
                        ? 'Select months'
                        : summarizeMonths(selectedMonths)}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Months ({year})</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {MONTH_LABELS.map((label, idx) => {
                    const key = monthKey(year, idx)
                    return (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={selectedMonths.includes(key)}
                        onCheckedChange={() => toggleMonth(key)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {label} {year}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <div className="flex justify-between px-2 py-1.5 text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const all = MONTH_LABELS.map((_, idx) => monthKey(year, idx))
                        const allInYear = all.every((k) => selectedMonths.includes(k))
                        if (allInYear) {
                          setSelectedMonths((prev) => prev.filter((k) => !all.includes(k)))
                        } else {
                          setSelectedMonths((prev) => Array.from(new Set([...prev, ...all])))
                        }
                      }}
                    >
                      Toggle all in {year}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedMonths([])}
                    >
                      Clear
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {!isTL && groupsForUi.length > 0 && (
                <Select value={teamLeadFilter} onValueChange={setTeamLeadFilter}>
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue placeholder="All teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teams</SelectItem>
                    {groupsForUi.map((g) => (
                      <SelectItem key={g.teamLeadId} value={g.teamLeadId}>
                        {g.teamLeadName} ({g.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="all">All stages</SelectItem>
                  {STAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isTL && (
                <Button
                  variant={groupByTeam ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8"
                  onClick={() => setGroupByTeam((v) => !v)}
                >
                  Group by team
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => downloadCsv(filteredRows)}
                disabled={filteredRows.length === 0}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {AGING_CARDS.map((card) => {
              const active = agingFilter === card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => toggleAging(card.key)}
                  className="text-left"
                >
                  <Card
                    className={cn(
                      'overflow-hidden border-0 shadow-md border-l-4 bg-gradient-to-br to-card transition-all hover:shadow-lg',
                      card.borderClass,
                      card.bgClass,
                      active && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    )}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className={cn('text-sm font-medium', card.titleClass)}>
                        {card.label}
                      </CardTitle>
                      {active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Active
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className={cn('text-2xl font-bold tabular-nums', card.countClass)}>
                        {agingCounts[card.key]}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                    </CardContent>
                  </Card>
                </button>
              )
            })}
          </div>

          {(agingFilter || stageFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {filteredRows.length} of {baseRows.length} patient{baseRows.length === 1 ? '' : 's'}
              </span>
              {agingFilter && (
                <Badge variant="outline" className="gap-1">
                  Aging: {AGING_CARDS.find((c) => c.key === agingFilter)?.label}
                  <button type="button" className="ml-1 hover:text-foreground" onClick={() => setAgingFilter(null)} aria-label="Clear aging filter">
                    ×
                  </button>
                </Badge>
              )}
              {stageFilter !== 'all' && (
                <Badge variant="outline" className="gap-1">
                  Stage: {STAGE_OPTIONS.find((o) => o.value === stageFilter)?.label ?? getCaseStageLabel(stageFilter.split(',')[0])}
                  <button type="button" className="ml-1 hover:text-foreground" onClick={() => setStageFilter('all')} aria-label="Clear stage filter">
                    ×
                  </button>
                </Badge>
              )}
            </div>
          )}

          {data?.truncated && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              Showing first 5000 rows — narrow your date range or team filter to see the rest.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">
              {(error as Error).message}
            </div>
          )}

          {isTL || !groupByTeam ? (
            <FlatTable rows={filteredRows} totalInScope={stageScopedRows.length} isLoading={isLoading} />
          ) : (
            <GroupedTables groups={groupedRows ?? []} isLoading={isLoading} />
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

function FlatTable({
  rows,
  totalInScope,
  isLoading,
}: {
  rows: Row[]
  totalInScope: number
  isLoading: boolean
}) {
  return (
    <Card className="overflow-hidden border-teal-200/50 shadow-lg dark:border-teal-800/40">
      <CardHeader className="border-b bg-gradient-to-r from-teal-500/12 via-indigo-500/10 to-transparent pb-4">
        <CardTitle className="text-lg text-teal-950 dark:text-teal-100">Patient cards</CardTitle>
        <CardDescription>
          {rows.length} shown{rows.length !== totalInScope ? ` · ${totalInScope} in scope` : ''} — click a row to open the lead.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : (
          <ReportTable rows={rows} />
        )}
      </CardContent>
    </Card>
  )
}

function GroupedTables({
  groups,
  isLoading,
}: {
  groups: (Group & { rows: Row[] })[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">Loading…</CardContent>
      </Card>
    )
  }
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          No pending patient cards in this window.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.teamLeadId} className="overflow-hidden border-teal-200/50 shadow-lg dark:border-teal-800/40">
          <CardHeader className="border-b bg-gradient-to-r from-teal-500/12 via-indigo-500/10 to-transparent pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-teal-950 dark:text-teal-100">{g.teamLeadName}</CardTitle>
              <Badge variant="secondary" className="font-mono">{g.count}</Badge>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <ReportTable rows={g.rows} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ReportTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No rows.</div>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-teal-200/50 bg-teal-50/60 hover:bg-teal-50/60 dark:border-teal-800/35 dark:bg-teal-950/30">
          <TableHead className="font-semibold text-teal-950 dark:text-teal-100">Lead ID</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>BDM</TableHead>
          <TableHead>Team Lead</TableHead>
          <TableHead>Uploaded</TableHead>
          <TableHead className="text-right">Days</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Pipeline</TableHead>
          <TableHead>Hospital</TableHead>
          <TableHead>Treatment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            className={cn(
              'border-b border-slate-100/80 transition-colors dark:border-slate-800/50',
              rowTone(r.daysSinceUpload)
            )}
          >
            <TableCell className="whitespace-nowrap font-medium">
              <Link href={`/leads/${r.id}`} className="text-teal-700 hover:underline dark:text-teal-300">
                {r.leadRef}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">{r.patientName}</TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs">{r.phoneNumber}</TableCell>
            <TableCell className="whitespace-nowrap">{r.bdmName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.teamLeadName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.uploadDate.slice(0, 10)}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">{r.daysSinceUpload}</TableCell>
            <TableCell className="whitespace-nowrap">{getCaseStageLabel(r.caseStage)}</TableCell>
            <TableCell className="whitespace-nowrap">{r.pipelineStage}</TableCell>
            <TableCell className="whitespace-nowrap">{r.hospitalName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.treatment || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
