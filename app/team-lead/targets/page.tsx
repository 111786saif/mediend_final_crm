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
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  employeeId: string
  name: string
  profilePicture: string | null
  suggestedTarget?: number
  suggestedBasis?: 'salary_slab' | 'tenure'
  suggestedLabel?: string
}

interface TeamInfo {
  id: string
  userId: string
  name: string
  profilePicture: string | null
  memberCount: number
  members: TeamMember[]
}

interface TargetProgress {
  id: string
  targetType: 'BD' | 'TEAM'
  targetForId: string
  entityName: string
  entityAvatar: string | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const RANK_ICONS = [Trophy, Medal, Award]
const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400']
const RANK_BG = [
  'bg-amber-50 border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/30',
  'bg-slate-50 border-slate-200/60 dark:bg-slate-900/20 dark:border-slate-700/30',
  'bg-orange-50 border-orange-200/60 dark:bg-orange-950/20 dark:border-orange-800/30',
]

const STATUS_CONFIG = {
  completed: {
    label: 'Completed',
    color: 'text-emerald-600 dark:text-emerald-400',
    ringColor: '#10B981',
    icon: CheckCircle2,
  },
  on_track: {
    label: 'On Track',
    color: 'text-blue-600 dark:text-blue-400',
    ringColor: '#3B82F6',
    icon: TrendingUp,
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-red-500 dark:text-red-400',
    ringColor: '#EF4444',
    icon: AlertTriangle,
  },
}

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

// ─── Team Target Hero ─────────────────────────────────────────────────────────

function TeamTargetHero({ target }: { target: TargetProgress }) {
  const pct = Math.min(Math.round(target.percentage), 100)
  const circumference = 2 * Math.PI * 48
  const offset = circumference - (pct / 100) * circumference
  const sc = STATUS_CONFIG[target.status]
  const StatusIcon = sc.icon

  return (
    <Card className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/40 dark:via-card dark:to-fuchsia-950/20 border-violet-200 dark:border-violet-800">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Circular ring */}
          <div className="relative shrink-0">
            <svg width="112" height="112" className="-rotate-90">
              <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-violet-100 dark:text-violet-900/50" />
              <circle cx="56" cy="56" r="48" fill="none"
                stroke={sc.ringColor} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums">{pct}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">done</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div>
              <div className={cn('flex items-center gap-2 justify-center sm:justify-start mb-0.5', sc.color)}>
                <StatusIcon className="h-4 w-4" />
                <span className="text-sm font-semibold">{sc.label}</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">Team IPD Target</h2>
              <p className="text-xs text-muted-foreground">Monthly surgery target set by Sales Head</p>
            </div>
            <div className="flex items-baseline gap-3 justify-center sm:justify-start">
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold tabular-nums">{target.actual}</p>
                <p className="text-xs text-muted-foreground">IPDs Done</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold tabular-nums text-muted-foreground/50">{target.targetValue}</p>
                <p className="text-xs text-muted-foreground">Target</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold tabular-nums text-muted-foreground/50">
                  {Math.max(0, target.targetValue - target.actual)}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── BD Leaderboard ───────────────────────────────────────────────────────────

function BDLeaderboard({
  bdTargets,
  teamTarget,
}: {
  bdTargets: TargetProgress[]
  teamTarget: TargetProgress | null
}) {
  const allBDs = useMemo(() => {
    const map = new Map<string, {
      id: string
      name: string
      profilePicture: string | null
      actual: number
      targetValue: number
      percentage: number
      hasTarget: boolean
    }>()

    for (const t of bdTargets) {
      map.set(t.targetForId, {
        id: t.targetForId,
        name: t.entityName,
        profilePicture: t.entityAvatar,
        actual: t.actual,
        targetValue: t.targetValue,
        percentage: t.percentage,
        hasTarget: true,
      })
    }

    if (teamTarget?.bdBreakdown) {
      for (const bd of teamTarget.bdBreakdown) {
        if (!map.has(bd.id)) {
          map.set(bd.id, {
            id: bd.id,
            name: bd.name,
            profilePicture: bd.profilePicture,
            actual: bd.actual,
            targetValue: 0,
            percentage: 0,
            hasTarget: false,
          })
        }
      }
    }

    return [...map.values()].sort((a, b) => b.actual - a.actual)
  }, [bdTargets, teamTarget])

  if (allBDs.length === 0) return null

  const maxActual = Math.max(...allBDs.map((b) => b.actual), 1)

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Users className="h-4 w-4" />
        BD Leaderboard
      </h2>
      <div className="space-y-2">
        {allBDs.map((bd, idx) => {
          const ac = getAvatarColor(bd.name)
          const barPct = maxActual > 0 ? Math.round((bd.actual / maxActual) * 100) : 0
          const RankIcon = idx < 3 ? RANK_ICONS[idx] : null
          const isTop3 = idx < 3

          return (
            <div
              key={bd.id}
              className={cn(
                'relative flex items-center gap-3 border rounded-xl p-3 overflow-hidden transition-all hover:shadow-sm',
                isTop3 ? RANK_BG[idx] : 'bg-card border-border'
              )}
            >
              {/* Background progress bar */}
              <div
                className="absolute inset-y-0 left-0 opacity-[0.05] bg-violet-500 transition-all duration-700"
                style={{ width: `${barPct}%` }}
              />

              {/* Rank */}
              <div className="relative z-10 flex items-center justify-center w-7 h-7 shrink-0">
                {RankIcon ? (
                  <RankIcon className={cn('h-5 w-5', RANK_COLORS[idx])} />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="relative z-10 h-9 w-9">
                {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                  {getInitials(bd.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name & score */}
              <div className="relative z-10 flex-1 min-w-0 flex items-center justify-between">
                <span className="text-sm font-semibold truncate">{bd.name}</span>
                <span className={cn(
                  'text-lg font-bold tabular-nums shrink-0 ml-2',
                  idx === 0 && 'text-amber-600 dark:text-amber-400'
                )}>
                  {bd.actual}<span className="text-muted-foreground font-medium">/{bd.hasTarget ? bd.targetValue : '-'}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Assign BD Target Dialog ──────────────────────────────────────────────────

function AssignBDTargetDialog({
  members,
  selectedMonth,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
}: {
  members: TeamMember[]
  selectedMonth: Date
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [selectedBdId, setSelectedBdId] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const selectedMember = members.find((m) => m.id === selectedBdId)

  useEffect(() => {
    if (selectedMember?.suggestedTarget) {
      setTargetValue(String(selectedMember.suggestedTarget))
    }
  }, [selectedBdId, selectedMember?.suggestedTarget])

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBdId) { toast.error('Please select a BD'); return }
    if (!targetValue || Number(targetValue) <= 0) { toast.error('Enter a valid target'); return }
    onSubmit({
      targetType: 'BD',
      targetForId: selectedBdId,
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
            Assign BD Target · {format(selectedMonth, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select BD</Label>
            <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
              {members.map((m) => {
                const ac = getAvatarColor(m.name)
                const isSelected = selectedBdId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedBdId(m.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                      isSelected
                        ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      {m.profilePicture && <AvatarImage src={m.profilePicture} />}
                      <AvatarFallback className={cn(ac.bg, ac.text, 'text-[10px] font-semibold')}>
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                    {m.suggestedTarget != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0 tabular-nums">
                        Suggested: {m.suggestedTarget}
                      </Badge>
                    )}
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
            <Label className="text-sm font-medium">IPD Done Target</Label>
            <Input
              type="number"
              className="mt-1.5 text-lg font-semibold h-12"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g. 8"
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of IPDs expected from this BD
              {selectedMember?.suggestedLabel && (
                <span className="block mt-0.5 text-violet-600 dark:text-violet-400">
                  Suggested ({selectedMember.suggestedLabel}): {selectedMember.suggestedTarget ?? '–'}
                </span>
              )}
            </p>
          </div>
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isLoading || !selectedBdId}>
            {isLoading ? 'Assigning...' : 'Assign Target'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamLeadTargetsPage() {
  const { user } = useAuth()
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

  const myTeam = useMemo(() => teams.find((t) => t.userId === user?.id), [teams, user?.id])

  const { data: targets = [], isLoading } = useQuery<TargetProgress[]>({
    queryKey: ['target-progress', monthStr],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthStr}`),
  })

  const teamTarget = useMemo(() => targets.find((t) => t.targetType === 'TEAM'), [targets])
  const bdTargets = useMemo(() => targets.filter((t) => t.targetType === 'BD'), [targets])

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/api/targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      setIsDialogOpen(false)
      toast.success('Target assigned')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to assign target'),
  })

  const hasBDs = myTeam && myTeam.members.length > 0

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <Target className="h-6 w-6 text-violet-500" />
              My Team Targets
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              IPD progress · {format(selectedMonth, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            {hasBDs && (
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                size="sm"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Assign Target
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-muted animate-pulse" />
            <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            {/* Team target hero */}
            {teamTarget ? (
              <TeamTargetHero target={teamTarget} />
            ) : (
              <Card className="border-dashed border-violet-200 dark:border-violet-800 rounded-2xl">
                <CardContent className="py-10 text-center">
                  <Target className="h-10 w-10 text-violet-300 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No team target yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Your Sales Head will set your team&apos;s IPD target for {format(selectedMonth, 'MMMM yyyy')}.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* BD Leaderboard */}
            {(bdTargets.length > 0 || (teamTarget && teamTarget.bdBreakdown.length > 0)) ? (
              <BDLeaderboard bdTargets={bdTargets} teamTarget={teamTarget ?? null} />
            ) : myTeam ? (
              <Card className="border-dashed rounded-2xl">
                <CardContent className="py-10 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No BD activity yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Assign targets to your BDs to track individual performance.
                  </p>
                  {hasBDs && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Assign First Target
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>

      {hasBDs && (
        <AssignBDTargetDialog
          members={myTeam.members}
          selectedMonth={selectedMonth}
          onSubmit={(data) => createTargetMutation.mutate(data)}
          isLoading={createTargetMutation.isPending}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </AuthenticatedLayout>
  )
}
