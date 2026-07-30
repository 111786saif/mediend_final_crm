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
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useState, useMemo, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ClipboardList, Download, Eye, Layers } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PatientQuickViewDrawer } from '@/components/reports/patient-quick-view-drawer'

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

type BucketCounts = {
  all: number
  d30: number
  d60: number
  d90: number
}

type ReportResponse = {
  rows: Row[]
  groups?: Group[]
  months: string[]
  truncated: boolean
  bucketCounts: BucketCounts
  stageOptions: string[]
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
        r.caseStage,
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
  if (daysSinceUpload >= 90) return 'bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/30 dark:hover:bg-red-950/40'
  if (daysSinceUpload >= 60) return 'bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/30 dark:hover:bg-orange-950/40'
  if (daysSinceUpload >= 30) return 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/40'
  return ''
}

type DayBucket = 'all' | '30' | '60' | '90'

function humanizeStage(stage: string | undefined | null): string {
  if (!stage) return '—'
  return stage
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

export default function PatientCardsPendingSurgeryPage() {
  const { user } = useAuth()
  const isTL =
    user?.role === 'TEAM_LEAD' ||
    user?.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user?.role === 'CATEGORY_MANAGER'

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => [
    monthKey(currentYear, 3),
    monthKey(currentYear, 4),
  ])
  const [teamLeadFilter, setTeamLeadFilter] = useState<string>('all')
  const [groupByTeam, setGroupByTeam] = useState(true)
  const [dayBucket, setDayBucket] = useState<DayBucket>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [quickViewLeadId, setQuickViewLeadId] = useState<string | null>(null)
  const [quickViewTeamLead, setQuickViewTeamLead] = useState<string | null>(null)
  const [quickViewDays, setQuickViewDays] = useState<number | null>(null)
  const [quickViewUploadDate, setQuickViewUploadDate] = useState<string | null>(null)
  const [quickViewOpen, setQuickViewOpen] = useState(false)

  const openQuickView = (row: Row) => {
    setQuickViewLeadId(row.id)
    setQuickViewTeamLead(row.teamLeadName)
    setQuickViewDays(row.daysSinceUpload)
    setQuickViewUploadDate(row.uploadDate)
    setQuickViewOpen(true)
  }

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

  const { data, isLoading, isFetching, error } = useQuery<ReportResponse>({
    queryKey: ['reports/patient-cards-pending-surgery', monthsParam, teamLeadFilter, dayBucket, stageFilter],
    queryFn: () => {
      const params = new URLSearchParams({ months: monthsParam, bucket: dayBucket })
      if (teamLeadFilter !== 'all') params.set('teamLeadUserId', teamLeadFilter)
      if (stageFilter !== 'all') params.set('caseStage', stageFilter)
      return apiGet<ReportResponse>(`/api/reports/patient-cards-pending-surgery?${params.toString()}`)
    },
    enabled: !!monthsParam && !!user,
    placeholderData: (prev) => prev,
  })

  const rows = useMemo(() => data?.rows ?? [], [data])
  const groups = useMemo(() => data?.groups ?? [], [data])
  const stageOptions = useMemo(() => data?.stageOptions ?? [], [data])
  const bucketCounts = data?.bucketCounts

  const groupedRows = useMemo(() => {
    if (!groups.length) return null
    const byTl = new Map<string, Row[]>()
    for (const r of rows) {
      const key = r.teamLeadId ?? '__unassigned'
      const arr = byTl.get(key) ?? []
      arr.push(r)
      byTl.set(key, arr)
    }
    return groups
      .map((g) => ({ ...g, rows: byTl.get(g.teamLeadId) ?? [] }))
      .concat(
        byTl.has('__unassigned')
          ? [{ teamLeadId: '__unassigned', teamLeadName: 'Unassigned', count: byTl.get('__unassigned')!.length, rows: byTl.get('__unassigned')! }]
          : []
      )
  }, [groups, rows])

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
                        : selectedMonths.length > 5
                          ? `${selectedMonths.length} months selected`
                          : summarizeMonths(selectedMonths)}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[300px] p-3">
                  <div className="flex items-center justify-between px-0.5 pb-2">
                    <DropdownMenuLabel className="p-0 text-sm font-semibold">Months — {year}</DropdownMenuLabel>
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {selectedMonths.filter((k) => k.startsWith(String(year))).length}/12
                    </Badge>
                  </div>
                  <DropdownMenuSeparator className="mb-2" />
                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTH_LABELS.map((label, idx) => {
                      const key = monthKey(year, idx)
                      const checked = selectedMonths.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleMonth(key)}
                          className={cn(
                            'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                            checked
                              ? 'border-teal-500 bg-teal-500/15 text-teal-800 dark:border-teal-400 dark:text-teal-200'
                              : 'border-border/60 bg-transparent text-muted-foreground hover:border-teal-300 hover:bg-teal-50/60 hover:text-foreground dark:hover:bg-teal-950/30'
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <DropdownMenuSeparator className="my-2" />
                  <div className="flex justify-between px-0.5">
                    <button
                      type="button"
                      className="text-xs font-medium text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
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
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedMonths([])}
                    >
                      Clear
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {!isTL && groups.length > 0 && (
                <Select value={teamLeadFilter} onValueChange={setTeamLeadFilter}>
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue placeholder="All teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teams</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.teamLeadId} value={g.teamLeadId}>
                        {g.teamLeadName} ({g.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-[190px]">
                  <Layers className="h-3.5 w-3.5 opacity-60 mr-1" />
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {stageOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {humanizeStage(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => downloadCsv(rows)}
                disabled={rows.length === 0}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BucketCard
              label="Pending cards"
              sublabel="Surgery not done in filtered window"
              count={bucketCounts?.all ?? 0}
              active={dayBucket === 'all'}
              onClick={() => setDayBucket('all')}
              icon={<ClipboardList className="h-4 w-4" />}
              tone="indigo"
            />
            <BucketCard
              label="Stale > 30 days"
              sublabel="30–59 days since upload"
              count={bucketCounts?.d30 ?? 0}
              active={dayBucket === '30'}
              onClick={() => setDayBucket((v) => (v === '30' ? 'all' : '30'))}
              tone="amber"
            />
            <BucketCard
              label="Critical > 60 days"
              sublabel="60–89 days since upload"
              count={bucketCounts?.d60 ?? 0}
              active={dayBucket === '60'}
              onClick={() => setDayBucket((v) => (v === '60' ? 'all' : '60'))}
              tone="orange"
            />
            <BucketCard
              label="Severe > 90 days"
              sublabel="90+ days since upload"
              count={bucketCounts?.d90 ?? 0}
              active={dayBucket === '90'}
              onClick={() => setDayBucket((v) => (v === '90' ? 'all' : '90'))}
              tone="red"
            />
          </div>
          {isFetching && !isLoading && (
            <p className="-mt-2 text-xs text-muted-foreground">Refreshing…</p>
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
            <FlatTable rows={rows} isLoading={isLoading} onQuickView={openQuickView} />
          ) : (
            <GroupedTables groups={groupedRows ?? []} isLoading={isLoading} onQuickView={openQuickView} />
          )}
        </div>
      </div>
      <PatientQuickViewDrawer
        leadId={quickViewLeadId}
        teamLeadName={quickViewTeamLead}
        daysSinceUpload={quickViewDays}
        uploadDate={quickViewUploadDate}
        open={quickViewOpen}
        onOpenChange={(o) => {
          setQuickViewOpen(o)
          if (!o) setQuickViewLeadId(null)
        }}
      />
    </ProtectedRoute>
  )
}

function BucketCard({
  label,
  sublabel,
  count,
  active,
  onClick,
  icon,
  tone,
}: {
  label: string
  sublabel: string
  count: number
  active: boolean
  onClick: () => void
  icon?: ReactNode
  tone: 'indigo' | 'amber' | 'orange' | 'red'
}) {
  const toneClasses: Record<typeof tone, { border: string; bg: string; text: string; iconBg: string }> = {
    indigo: {
      border: 'border-l-indigo-500',
      bg: 'from-indigo-50/90 dark:from-indigo-950/35',
      text: 'text-indigo-900/90 dark:text-indigo-100/90',
      iconBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    },
    amber: {
      border: 'border-l-amber-500',
      bg: 'from-amber-50/90 dark:from-amber-950/35',
      text: 'text-amber-900/90 dark:text-amber-100/90',
      iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    orange: {
      border: 'border-l-orange-500',
      bg: 'from-orange-50/90 dark:from-orange-950/35',
      text: 'text-orange-900/90 dark:text-orange-100/90',
      iconBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    },
    red: {
      border: 'border-l-red-500',
      bg: 'from-red-50/90 dark:from-red-950/35',
      text: 'text-red-900/90 dark:text-red-100/90',
      iconBg: 'bg-red-500/15 text-red-700 dark:text-red-300',
    },
  }
  const t = toneClasses[tone]
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={cn(
          'overflow-hidden border-0 shadow-md border-l-4 bg-gradient-to-br to-card transition-all',
          t.border,
          t.bg,
          active && 'ring-2 ring-offset-1 ring-teal-500 dark:ring-teal-400'
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn('text-sm font-medium', t.text)}>{label}</CardTitle>
          {icon && (
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', t.iconBg)}>{icon}</div>
          )}
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-bold tabular-nums', t.text)}>{count}</div>
          <p className={cn('text-xs mt-1 opacity-70', t.text)}>{sublabel}</p>
        </CardContent>
      </Card>
    </button>
  )
}

function FlatTable({
  rows,
  isLoading,
  onQuickView,
}: {
  rows: Row[]
  isLoading: boolean
  onQuickView: (row: Row) => void
}) {
  return (
    <Card className="overflow-hidden border-teal-200/50 shadow-lg dark:border-teal-800/40">
      <CardHeader className="border-b bg-gradient-to-r from-teal-500/12 via-indigo-500/10 to-transparent pb-4">
        <CardTitle className="text-lg text-teal-950 dark:text-teal-100">Patient cards</CardTitle>
        <CardDescription>Click a lead ID to open the lead, or the eye icon for a quick preview.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : (
          <ReportTable rows={rows} onQuickView={onQuickView} />
        )}
      </CardContent>
    </Card>
  )
}

function GroupedTables({
  groups,
  isLoading,
  onQuickView,
}: {
  groups: (Group & { rows: Row[] })[]
  isLoading: boolean
  onQuickView: (row: Row) => void
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
              <Badge variant="secondary" className="font-mono">{g.rows.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <ReportTable rows={g.rows} onQuickView={onQuickView} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ReportTable({ rows, onQuickView }: { rows: Row[]; onQuickView: (row: Row) => void }) {
  if (rows.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No rows.</div>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-teal-200/50 bg-teal-50/60 hover:bg-teal-50/60 dark:border-teal-800/35 dark:bg-teal-950/30">
          <TableHead className="w-9" />
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
            <TableCell className="w-9">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Quick view"
                onClick={() => onQuickView(r)}
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TableCell>
            <TableCell className="whitespace-nowrap font-medium">
              <Link
                href={`/leads/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:underline dark:text-teal-300"
              >
                {r.leadRef}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">{r.patientName}</TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs">{r.phoneNumber}</TableCell>
            <TableCell className="whitespace-nowrap">{r.bdmName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.teamLeadName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.uploadDate.slice(0, 10)}</TableCell>
            <TableCell className="whitespace-nowrap text-right tabular-nums">{r.daysSinceUpload}</TableCell>
            <TableCell className="whitespace-nowrap">{humanizeStage(r.caseStage)}</TableCell>
            <TableCell className="whitespace-nowrap">{humanizeStage(r.pipelineStage)}</TableCell>
            <TableCell className="whitespace-nowrap">{r.hospitalName || '—'}</TableCell>
            <TableCell className="whitespace-nowrap">{r.treatment || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}