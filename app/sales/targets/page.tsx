'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState, useMemo } from 'react'
import { getAvatarColor } from '@/lib/avatar-colors'
import {
  Plus,
  Target,
  TrendingUp,
  Trophy,
  Medal,
  Award,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Eye,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamInfo {
  id: string
  userId: string
  name: string
  profilePicture: string | null
  employeeCode: string
  memberCount: number
  members: Array<{
    id: string
    employeeId: string
    name: string
    profilePicture: string | null
  }>
}

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM'
  targetForId: string
  entityName: string
  entityAvatar: string | null
  periodStartDate: string
  periodEndDate: string
  metric: string
  targetValue: number
  actual: number
  percentage: number
  status: 'completed' | 'on_track' | 'at_risk'
  bdBreakdown: Array<{
    id: string
    name: string
    profilePicture: string | null
    actual: number
    percentage: number
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const STATUS_CONFIG = {
  completed: {
    label: 'Completed',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: '[&>div]:from-emerald-400 [&>div]:to-emerald-500',
    icon: CheckCircle2,
  },
  on_track: {
    label: 'On Track',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    bar: '[&>div]:from-blue-400 [&>div]:to-blue-500',
    icon: TrendingUp,
  },
  at_risk: {
    label: 'At Risk',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    bar: '[&>div]:from-red-400 [&>div]:to-orange-400',
    icon: AlertTriangle,
  },
}

const RANK_ICONS = [Trophy, Medal, Award]
const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400']

// ─── Month Picker ─────────────────────────────────────────────────────────────

function MonthPicker({ selectedMonth, onChange }: { selectedMonth: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-1 bg-card border border-border rounded-xl px-1.5 py-1 shadow-sm">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(subMonths(selectedMonth, 1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[120px] text-center">{format(selectedMonth, 'MMMM yyyy')}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(addMonths(selectedMonth, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function SummaryStats({ targets }: { targets: TargetProgress[] }) {
  const totalTarget = targets.reduce((s, t) => s + t.targetValue, 0)
  const totalActual = targets.reduce((s, t) => s + t.actual, 0)
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
  const onTrack = targets.filter((t) => t.status === 'completed' || t.status === 'on_track').length

  const stats = [
    { label: 'Monthly Target', value: totalTarget, color: '' },
    { label: 'IPDs Done', value: totalActual, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Overall', value: `${overallPct}%`, color: overallPct >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500' },
    { label: 'On Track', value: `${onTrack}/${targets.length}`, color: 'text-violet-600 dark:text-violet-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium mb-1">{s.label}</p>
          <p className={cn('text-3xl font-bold tabular-nums', s.color)}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── BD Details Dialog ────────────────────────────────────────────────────────

function BdDetailsDialog({
  target,
  open,
  onOpenChange,
}: {
  target: TargetProgress
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const sortedBDs = useMemo(
    () => [...target.bdBreakdown].sort((a, b) => b.actual - a.actual),
    [target.bdBreakdown]
  )
  const topActual = sortedBDs[0]?.actual ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-500" />
            {target.entityName} · All BDs
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="text-sm">
            <span className="font-bold tabular-nums text-lg">{target.actual}</span>
            <span className="text-muted-foreground"> / {target.targetValue} IPDs</span>
          </div>
          <Badge variant="outline" className="text-xs">{sortedBDs.length} BDs</Badge>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {sortedBDs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No BDs in this team.</p>
          )}
          {sortedBDs.map((bd, idx) => {
            const RankIcon = RANK_ICONS[idx]
            const bac = getAvatarColor(bd.name)
            const barPct = topActual > 0 ? Math.round((bd.actual / topActual) * 100) : 0
            return (
              <div key={bd.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                <div className="w-6 shrink-0 flex justify-center">
                  {RankIcon ? (
                    <RankIcon className={cn('h-4 w-4', RANK_COLORS[idx])} />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">{idx + 1}</span>
                  )}
                </div>
                <Avatar className="h-8 w-8 shrink-0">
                  {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                  <AvatarFallback className={cn(bac.bg, bac.text, 'text-[10px] font-bold')}>{getInitials(bd.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bd.name}</p>
                  <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{bd.actual}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{Math.round(bd.percentage)}%</p>
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Team Target Card ─────────────────────────────────────────────────────────

function TeamTargetCard({
  target,
  onSetTarget,
  readOnly,
}: {
  target: TargetProgress
  onSetTarget: () => void
  readOnly?: boolean
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const pct = Math.min(target.percentage, 100)
  const sc = STATUS_CONFIG[target.status]
  const StatusIcon = sc.icon
  const ac = getAvatarColor(target.entityName)
  const topBDs = target.bdBreakdown.slice(0, 3)
  const remaining = target.bdBreakdown.length - 3

  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              {target.entityAvatar && <AvatarImage src={target.entityAvatar} />}
              <AvatarFallback className={cn(ac.bg, ac.text, 'font-bold text-sm')}>{getInitials(target.entityName)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-base leading-tight">{target.entityName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{target.bdBreakdown.length} BDs in team</p>
            </div>
          </div>
          <Badge className={cn('text-xs font-medium border-0 gap-1 shrink-0', sc.badge)}>
            <StatusIcon className="h-3 w-3" />
            {sc.label}
          </Badge>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tabular-nums">{target.actual}</span>
              <span className="text-base text-muted-foreground">/ {target.targetValue} IPDs</span>
            </div>
            <span className="text-xl font-bold tabular-nums text-muted-foreground/70">{Math.round(target.percentage)}%</span>
          </div>
          <Progress
            value={pct}
            className={cn('h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:rounded-full', sc.bar)}
          />
        </div>

        {/* BD Mini-leaderboard */}
        {target.bdBreakdown.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/60">
            {topBDs.map((bd, idx) => {
              const RankIcon = RANK_ICONS[idx]
              const bac = getAvatarColor(bd.name)
              const barPct = target.bdBreakdown[0].actual > 0
                ? Math.round((bd.actual / target.bdBreakdown[0].actual) * 100)
                : 0
              return (
                <div key={bd.id} className="flex items-center gap-2.5">
                  <RankIcon className={cn('h-4 w-4 shrink-0', RANK_COLORS[idx])} />
                  <Avatar className="h-6 w-6 shrink-0">
                    {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                    <AvatarFallback className={cn(bac.bg, bac.text, 'text-[9px] font-bold')}>{getInitials(bd.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1 truncate">{bd.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-6 text-right">{bd.actual}</span>
                  </div>
                </div>
              )
            })}
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground pl-6">+{remaining} more BDs</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-1 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setDetailsOpen(true)}
            disabled={target.bdBreakdown.length === 0}
          >
            <Eye className="h-3 w-3" />
            View
          </Button>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={onSetTarget}
            >
              <Pencil className="h-3 w-3" />
              Edit Target
            </Button>
          )}
        </div>
      </CardContent>

      <BdDetailsDialog target={target} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </Card>
  )
}

// ─── Set Target Dialog ────────────────────────────────────────────────────────

function SetTargetDialog({
  teams,
  selectedMonth,
  existingTargets,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
  preselectedTeamId,
}: {
  teams: TeamInfo[]
  selectedMonth: Date
  existingTargets: TargetProgress[]
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  preselectedTeamId?: string
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId ?? '')
  const [targetValue, setTargetValue] = useState('')

  const existingTeamIds = new Set(existingTargets.map((t) => t.targetForId))

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId) { toast.error('Please select a team'); return }
    if (!targetValue || Number(targetValue) <= 0) { toast.error('Enter a valid target'); return }
    onSubmit({
      targetType: 'TEAM',
      targetForId: selectedTeamId,
      periodType: 'MONTH',
      periodStartDate: periodStart.toISOString(),
      periodEndDate: periodEnd.toISOString(),
      metric: 'IPD_DONE',
      targetValue: parseFloat(targetValue),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" />
            Set Team Target · {format(selectedMonth, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Team Lead</Label>
            <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
              {teams.map((team) => {
                const ac = getAvatarColor(team.name)
                const isSelected = selectedTeamId === team.id
                const hasTarget = existingTeamIds.has(team.id)
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={hasTarget}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                      hasTarget ? 'border-border opacity-50 cursor-not-allowed' :
                      isSelected ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20' :
                      'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                        {getInitials(team.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-muted-foreground">{team.memberCount} BDs</p>
                    </div>
                    {hasTarget && <Badge variant="outline" className="text-[10px] shrink-0">Set</Badge>}
                    {isSelected && !hasTarget && (
                      <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">IPD Done Target</Label>
            <Input
              type="number"
              className="mt-1.5 text-lg font-semibold h-12"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g. 25"
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Number of IPDs expected this month</p>
          </div>
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isLoading || !selectedTeamId}>
            {isLoading ? 'Saving...' : 'Set Target'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesTargetsPage({ readOnly = false }: { readOnly?: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const monthStr = format(selectedMonth, 'yyyy-MM')

  const { data: teams = [] } = useQuery<TeamInfo[]>({
    queryKey: ['target-teams'],
    queryFn: () => apiGet<TeamInfo[]>('/api/targets/teams'),
  })

  const { data: targets = [], isLoading } = useQuery<TargetProgress[]>({
    queryKey: ['target-progress', monthStr],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthStr}`),
  })

  const teamTargets = useMemo(
    () => targets.filter((t) => t.targetType === 'TEAM').sort((a, b) => b.percentage - a.percentage),
    [targets]
  )

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/api/targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      setIsDialogOpen(false)
      toast.success('Target set successfully')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to set target'),
  })

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Target className="h-6 w-6 text-violet-500" />
              Surgery Sales Targets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monthly IPD targets · {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            {!readOnly && (
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Set Target
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        {teamTargets.length > 0 && <SummaryStats targets={teamTargets} />}

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : teamTargets.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No targets for {format(selectedMonth, 'MMMM yyyy')}</h3>
              <p className="text-sm text-muted-foreground mb-5">
                {readOnly ? 'No targets have been set yet.' : 'Set monthly IPD targets for each team lead to start tracking.'}
              </p>
              {!readOnly && (
                <Button variant="outline" className="gap-2" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Set First Target
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teamTargets.map((t) => (
              <TeamTargetCard
                key={t.id}
                target={t}
                readOnly={readOnly}
                onSetTarget={() => setIsDialogOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <SetTargetDialog
          teams={teams}
          selectedMonth={selectedMonth}
          existingTargets={teamTargets}
          onSubmit={(data) => createTargetMutation.mutate(data)}
          isLoading={createTargetMutation.isPending}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </AuthenticatedLayout>
  )
}
