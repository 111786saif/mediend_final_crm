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
  Pencil,
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

// ─── BD Leaderboard ───────────────────────────────────────────────────────────

export function BDLeaderboard({
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

export function AssignBDTargetDialog({
  members,
  selectedMonth,
  onSubmit,
  isLoading,
  open,
  onOpenChange,
  delegationRemaining,
  currentUser,
}: {
  members: TeamMember[]
  selectedMonth: Date
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  delegationRemaining: number
  currentUser: { id: string; name: string } | null
}) {
  const [selectedBdId, setSelectedBdId] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const selectableMembers = useMemo(() => {
    if (!currentUser) return members
    return [
      { id: currentUser.id, name: `${currentUser.name} (Self)`, employeeId: '', profilePicture: null },
      ...members,
    ]
  }, [members, currentUser])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBdId) { toast.error('Please select a team member'); return }
    const val = parseFloat(targetValue)
    if (!targetValue || val <= 0) { toast.error('Enter a valid target'); return }

    if (val > delegationRemaining) {
      toast.error(`Value exceeds remaining team delegation budget (${delegationRemaining} IPDs)`)
      return
    }

    onSubmit({
      targetType: 'BD',
      targetForId: selectedBdId,
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
            Assign Target · {format(selectedMonth, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
            <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1">
              {selectableMembers.map((m) => {
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
              placeholder="e.g. 8"
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Number of IPDs expected this month</p>
          </div>
          <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={isLoading || !selectedBdId}>
            {isLoading ? 'Saving...' : 'Assign Target'}
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

export default function TeamLeadTargetsPage() {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSelfDialogOpen, setIsSelfDialogOpen] = useState(false)
  const [selfTargetValueInput, setSelfTargetValueInput] = useState('')
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

  const selfTarget = useMemo(
    () => bdTargets.find((t) => t.targetForId === user?.id),
    [bdTargets, user?.id]
  )

  const subordinateBdTargets = useMemo(
    () => bdTargets.filter((t) => t.targetForId !== user?.id),
    [bdTargets, user?.id]
  )

  const teamTargetValue = teamTarget?.targetValue ?? 0
  const selfTargetValue = selfTarget?.targetValue ?? 0
  const delegationBudget = Math.max(0, teamTargetValue - selfTargetValue)
  const totalBdDelegated = subordinateBdTargets.reduce((sum, t) => sum + t.targetValue, 0)
  const delegationRemaining = Math.max(0, delegationBudget - totalBdDelegated)

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (data.targetType === 'BD' && !data.targetForId) {
        data.targetForId = user?.id
      }
      return apiPost('/api/targets', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      setIsDialogOpen(false)
      setIsSelfDialogOpen(false)
      toast.success('Target assigned successfully')
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

        {/* Hero Performance Cards at the Top */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Team Target */}
            <Card className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-indigo-50/20 dark:from-blue-950/20 dark:to-indigo-950/10 p-4 shadow-sm flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">My Team Target</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Assigned from Category Manager</p>
                  </div>
                  <div className="h-6 w-6 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold tabular-nums text-blue-900 dark:text-blue-200">{teamTargetValue}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">IPDs</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-blue-100 dark:border-blue-900/50">
                Progress: <span className="font-semibold text-blue-700 dark:text-blue-300">{teamTarget?.actual ?? 0} Done ({teamTarget ? Math.round(teamTarget.percentage) : 0}%)</span>
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

            {/* Card 3: BDE Budget */}
            <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-teal-50/20 dark:from-emerald-950/20 dark:to-teal-950/10 p-4 shadow-sm flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">BDE Allocation Budget</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">For BDE team members</p>
                  </div>
                  <div className="h-6 w-6 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold tabular-nums text-emerald-900 dark:text-emerald-200">{delegationBudget}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">IPDs ({teamTargetValue} - {selfTargetValue})</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-emerald-100 dark:border-emerald-900/50 flex justify-between">
                <span>Allocated: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{totalBdDelegated}</span></span>
                <span>Remaining: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{delegationRemaining}</span></span>
              </p>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          </div>
        ) : (
          <>
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
          delegationRemaining={delegationRemaining}
          currentUser={user ? { id: user.id, name: user.name } : null}
        />
      )}

      <SetSelfTargetDialog
        selectedMonth={selectedMonth}
        onSubmit={(data) => createTargetMutation.mutate(data)}
        isLoading={createTargetMutation.isPending}
        open={isSelfDialogOpen}
        onOpenChange={setIsSelfDialogOpen}
        initialValue={selfTargetValueInput}
      />
    </AuthenticatedLayout>
  )
}
