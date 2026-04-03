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
  Users,
  Trophy,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths } from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Month Picker ───────────────────────────────────────────────────────────────

function MonthPicker({
  selectedMonth,
  onChange,
}: {
  selectedMonth: Date
  onChange: (date: Date) => void
}) {
  return (
    <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-1.5 py-1 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(subMonths(selectedMonth, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[130px] text-center">
        {format(selectedMonth, 'MMMM yyyy')}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(addMonths(selectedMonth, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─── Summary Stats ──────────────────────────────────────────────────────────────

function SummaryStats({ targets }: { targets: TargetProgress[] }) {
  const totalTarget = targets.reduce((s, t) => s + t.targetValue, 0)
  const totalActual = targets.reduce((s, t) => s + t.actual, 0)
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0
  const completedCount = targets.filter((t) => t.status === 'completed').length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-muted-foreground font-medium mb-1">Total IPDs Target</p>
        <p className="text-3xl font-bold">{totalTarget}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-muted-foreground font-medium mb-1">IPDs Done</p>
        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalActual}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-muted-foreground font-medium mb-1">Overall Progress</p>
        <p className="text-3xl font-bold">{overallPct}%</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-muted-foreground font-medium mb-1">Teams Completed</p>
        <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
          {completedCount}
          <span className="text-lg text-muted-foreground font-normal">/{targets.length}</span>
        </p>
      </div>
    </div>
  )
}

// ─── Team Target Card ───────────────────────────────────────────────────────────

function TeamTargetCard({ target }: { target: TargetProgress }) {
  const pct = Math.min(target.percentage, 100)
  const [showBDs, setShowBDs] = useState(false)

  const statusConfig = {
    completed: {
      label: 'Completed',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      icon: CheckCircle2,
      ring: 'ring-emerald-200 dark:ring-emerald-800',
    },
    on_track: {
      label: 'On Track',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      icon: TrendingUp,
      ring: 'ring-blue-200 dark:ring-blue-800',
    },
    at_risk: {
      label: 'At Risk',
      badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      icon: AlertTriangle,
      ring: 'ring-red-200 dark:ring-red-800',
    },
  }

  const sc = statusConfig[target.status]
  const StatusIcon = sc.icon
  const ac = getAvatarColor(target.entityName)

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Team header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {target.entityAvatar && <AvatarImage src={target.entityAvatar} />}
              <AvatarFallback className={cn(ac.bg, ac.text, 'font-bold text-sm')}>
                {getInitials(target.entityName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-base">{target.entityName}</h3>
              <p className="text-xs text-muted-foreground">
                {target.bdBreakdown.length} BDs
              </p>
            </div>
          </div>
          <Badge className={cn('text-xs font-medium border-0 gap-1', sc.badge)}>
            <StatusIcon className="h-3 w-3" />
            {sc.label}
          </Badge>
        </div>

        {/* Big numbers */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-bold tabular-nums">{target.actual}</span>
          <span className="text-lg text-muted-foreground mb-1">/ {target.targetValue}</span>
          <span className="ml-auto text-2xl font-bold tabular-nums text-muted-foreground/80">
            {target.percentage}%
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={pct}
          className="h-3 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500 [&>div]:rounded-full mb-4"
        />

        {/* BD breakdown toggle */}
        {target.bdBreakdown.length > 0 && (
          <div>
            <button
              onClick={() => setShowBDs(!showBDs)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              {showBDs ? 'Hide' : 'Show'} BD breakdown
              <ChevronRight
                className={cn(
                  'h-3 w-3 transition-transform',
                  showBDs && 'rotate-90'
                )}
              />
            </button>

            {showBDs && (
              <div className="mt-3 space-y-2.5">
                {target.bdBreakdown.map((bd, idx) => {
                  const bac = getAvatarColor(bd.name)
                  return (
                    <div key={bd.id} className="flex items-center gap-3">
                      <div className="w-5 text-center shrink-0">
                        {idx === 0 && target.bdBreakdown.length > 1 ? (
                          <Trophy className="h-4 w-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <Avatar className="h-7 w-7">
                        {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                        <AvatarFallback
                          className={cn(
                            bac.bg,
                            bac.text,
                            'text-[9px] font-bold'
                          )}
                        >
                          {getInitials(bd.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {bd.name}
                          </span>
                          <span className="text-sm font-bold tabular-nums ml-2">
                            {bd.actual}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Set Target Dialog ──────────────────────────────────────────────────────────

function SetTargetForm({
  teams,
  selectedMonth,
  existingTargets,
  onSubmit,
  isLoading,
}: {
  teams: TeamInfo[]
  selectedMonth: Date
  existingTargets: TargetProgress[]
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const existingTeamIds = new Set(existingTargets.map((t) => t.targetForId))

  const periodStart = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1
  )
  const periodEnd = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId) {
      toast.error('Please select a team')
      return
    }
    if (!targetValue || Number(targetValue) <= 0) {
      toast.error('Enter a valid target number')
      return
    }
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Team selector */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Select Team</Label>
        <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-1">
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
                  hasTarget
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : isSelected
                      ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <Avatar>
                  {team.profilePicture && (
                    <AvatarImage src={team.profilePicture} />
                  )}
                  <AvatarFallback
                    className={cn(ac.bg, ac.text, 'font-semibold text-xs')}
                  >
                    {getInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {team.name}&apos;s Team
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {team.memberCount} BDs
                  </p>
                </div>
                {hasTarget && (
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0"
                  >
                    Target Set
                  </Badge>
                )}
                {isSelected && !hasTarget && (
                  <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Period display */}
      <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Period</span>
        <span className="text-sm font-medium">
          {format(selectedMonth, 'MMMM yyyy')}
        </span>
      </div>

      {/* Target value */}
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
        <p className="text-xs text-muted-foreground mt-1">
          Number of IPDs expected this month
        </p>
      </div>

      <Button
        type="submit"
        className="w-full bg-violet-600 hover:bg-violet-700"
        disabled={isLoading || !selectedTeamId}
      >
        {isLoading ? 'Setting Target...' : 'Set Target'}
      </Button>
    </form>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function TargetsPage() {
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
    queryFn: () =>
      apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthStr}`),
  })

  const teamTargets = useMemo(
    () => targets.filter((t) => t.targetType === 'TEAM'),
    [targets]
  )

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/api/targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      setIsDialogOpen(false)
      toast.success('Target set successfully')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to set target'
      )
    },
  })

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Target className="h-6 w-6 text-violet-500" />
              Monthly Targets
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track team-wise IPD targets for{' '}
              {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-4 w-4" />
                  Set Target
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-500" />
                    Set Team Target
                  </DialogTitle>
                </DialogHeader>
                <SetTargetForm
                  teams={teams}
                  selectedMonth={selectedMonth}
                  existingTargets={teamTargets}
                  onSubmit={(data) => createTargetMutation.mutate(data)}
                  isLoading={createTargetMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary stats */}
        {teamTargets.length > 0 && <SummaryStats targets={teamTargets} />}

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : teamTargets.length === 0 ? (
          <Card className="border-dashed rounded-2xl">
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">
                No targets for {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Set monthly IPD targets for your teams to start tracking
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Set First Target
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teamTargets.map((t) => (
              <TeamTargetCard key={t.id} target={t} />
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
