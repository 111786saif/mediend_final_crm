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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useState, useMemo, useEffect } from 'react'
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
  targetType: 'BD' | 'TEAM' | 'CATEGORY'
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
  createdById: string
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

// ─── Team Details Dialog ────────────────────────────────────────────────────────

function TeamDetailsDialog({
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
            {target.entityName} · Members breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="text-sm">
            <span className="font-bold tabular-nums text-lg">{target.actual}</span>
            <span className="text-muted-foreground"> / {target.targetValue} IPDs</span>
          </div>
          <Badge variant="outline" className="text-xs">{sortedBDs.length} members</Badge>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {sortedBDs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No members in this team.</p>
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
  const sc = STATUS_CONFIG[target.status] || STATUS_CONFIG.at_risk
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
              <p className="text-xs text-muted-foreground mt-0.5">{target.bdBreakdown.length} members in team</p>
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
              <p className="text-xs text-muted-foreground pl-6">+{remaining} more members</p>
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
            View Breakdown
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

      <TeamDetailsDialog target={target} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </Card>
  )
}

// ─── Set Target Dialog ─────────────────────────────────────────────────────────

function SetTargetDialog({
  teams,
  selectedMonth,
  existingTargets,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
  delegationRemaining,
}: {
  teams: TeamInfo[]
  selectedMonth: Date
  existingTargets: TargetProgress[]
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  delegationRemaining: number
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId) { toast.error('Please select a team'); return }
    const val = parseFloat(targetValue)
    if (!targetValue || val <= 0) { toast.error('Enter a valid target'); return }
    
    // Check allocation limits
    if (val > delegationRemaining) {
      toast.error(`Value exceeds remaining team delegation budget (${delegationRemaining} IPDs)`)
      return
    }

    onSubmit({
      targetType: 'TEAM',
      targetForId: selectedTeamId,
      periodType: 'MONTH',
      periodStartDate: periodStart.toISOString(),
      periodEndDate: periodEnd.toISOString(),
      metric: 'IPD_DONE',
      targetValue: val,
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
            <Label className="text-sm font-medium mb-2 block">Select Team Lead / ACM</Label>
            <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
              {teams.map((team) => {
                const ac = getAvatarColor(team.name)
                const isSelected = selectedTeamId === team.id
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
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
                      <p className="text-xs text-muted-foreground">{team.memberCount} members</p>
                    </div>
                    {isSelected && (
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
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">IPD Done Target</Label>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Budget Limit: {delegationRemaining} IPDs</span>
            </div>
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

// ─── Set Self Target Dialog ────────────────────────────────────────────────────

function SetSelfTargetDialog({
  selectedMonth,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
  initialValue = '',
}: {
  selectedMonth: Date
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  initialValue?: string
}) {
  const [targetValue, setTargetValue] = useState(initialValue)

  useEffect(() => {
    setTargetValue(initialValue)
  }, [initialValue, open])

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetValue || Number(targetValue) <= 0) { toast.error('Enter a valid target'); return }
    onSubmit({
      targetType: 'BD',
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
            Set My Individual Target · {format(selectedMonth, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label className="text-sm font-medium">IPD Done Target</Label>
            <Input
              type="number"
              className="mt-1.5 text-lg font-semibold h-12"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g. 10"
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Your own target expected this month</p>
          </div>
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Set Target'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategorySalesTargetsPage({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false)
  const [isSelfDialogOpen, setIsSelfDialogOpen] = useState(false)
  const [selfTargetValueInput, setSelfTargetValueInput] = useState('')

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

  const selfTarget = useMemo(
    () => targets.find((t) => t.targetType === 'BD' && t.targetForId === user?.id),
    [targets, user?.id]
  )

  const categoryTarget = useMemo(
    () => targets.find((t) => t.targetType === 'CATEGORY'),
    [targets]
  )

  const categoryTargetValue = categoryTarget?.targetValue ?? 0
  const selfTargetValue = selfTarget?.targetValue ?? 0
  const delegationBudget = Math.max(0, categoryTargetValue - selfTargetValue)
  const totalTeamDelegated = teamTargets.reduce((sum, t) => sum + t.targetValue, 0)
  const delegationRemaining = Math.max(0, delegationBudget - totalTeamDelegated)

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (data.targetType === 'BD' && !data.targetForId) {
        data.targetForId = user?.id
      }
      return apiPost('/api/targets', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      setIsTeamDialogOpen(false)
      setIsSelfDialogOpen(false)
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
              Category Sales Targets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sub-team delegation targets · {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </div>

        {/* Hero Performance Cards at the Top */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Category Target */}
            <Card className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-indigo-50/20 dark:from-blue-950/20 dark:to-indigo-950/10 p-4 shadow-sm flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">My Category Target</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Assigned from top order</p>
                  </div>
                  <div className="h-6 w-6 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold tabular-nums text-blue-900 dark:text-blue-200">{categoryTargetValue}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">IPDs</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-blue-100 dark:border-blue-900/50">
                Progress: <span className="font-semibold text-blue-700 dark:text-blue-300">{categoryTarget?.actual ?? 0} Done ({categoryTarget ? Math.round(categoryTarget.percentage) : 0}%)</span>
              </p>
            </Card>

            {/* Card 2: Self Target */}
            <Card className="rounded-2xl border border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/50 to-fuchsia-50/20 dark:from-violet-950/20 dark:to-fuchsia-950/10 p-4 shadow-sm flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">My Self Target</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Individual performance target</p>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] gap-1 border-violet-300 dark:border-violet-800 hover:bg-violet-100/50 dark:hover:bg-violet-900/30 shrink-0"
                      onClick={() => {
                        setSelfTargetValueInput(selfTargetValue > 0 ? selfTargetValue.toString() : '')
                        setIsSelfDialogOpen(true)
                      }}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      {selfTargetValue > 0 ? 'Edit' : 'Set'}
                    </Button>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold tabular-nums text-violet-900 dark:text-violet-200">{selfTargetValue}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">IPDs</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-violet-100 dark:border-violet-900/50">
                Progress: <span className="font-semibold text-violet-700 dark:text-violet-300">{selfTarget?.actual ?? 0} Done ({selfTarget ? Math.round(selfTarget.percentage) : 0}%)</span>
              </p>
            </Card>

            {/* Card 3: Delegation Budget */}
            <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/20 dark:to-teal-950/10 p-4 shadow-sm flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Team Delegation Budget</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">For Team Leads & ACMs</p>
                  </div>
                  <div className="h-6 w-6 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold tabular-nums text-emerald-900 dark:text-emerald-200">{delegationBudget}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">IPDs ({categoryTargetValue} - {selfTargetValue})</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-emerald-100 dark:border-emerald-900/50 flex justify-between">
                <span>Allocated: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{totalTeamDelegated}</span></span>
                <span>Remaining: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{delegationRemaining}</span></span>
              </p>
            </Card>
          </div>
        )}

        {/* Team Targets Content */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Team Level Performance
            </h2>
            {!readOnly && (
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                size="sm"
                onClick={() => setIsTeamDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Set Team Target
              </Button>
            )}
          </div>

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
                  {readOnly ? 'No targets have been set yet.' : 'Set monthly delegation targets for each team lead / ACM to start tracking.'}
                </p>
                {!readOnly && (
                  <Button variant="outline" className="gap-2" onClick={() => setIsTeamDialogOpen(true)}>
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
                  onSetTarget={() => setIsTeamDialogOpen(true)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <SetTargetDialog
          teams={teams}
          selectedMonth={selectedMonth}
          existingTargets={teamTargets}
          onSubmit={(data) => createTargetMutation.mutate(data)}
          isLoading={createTargetMutation.isPending}
          open={isTeamDialogOpen}
          onOpenChange={setIsTeamDialogOpen}
          delegationRemaining={delegationRemaining}
        />
      )}

      {!readOnly && (
        <SetSelfTargetDialog
          selectedMonth={selectedMonth}
          onSubmit={(data) => createTargetMutation.mutate(data)}
          isLoading={createTargetMutation.isPending}
          open={isSelfDialogOpen}
          onOpenChange={setIsSelfDialogOpen}
          initialValue={selfTargetValueInput}
        />
      )}
    </AuthenticatedLayout>
  )
}
