'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
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
  Flame,
  Award,
  Sparkles,
  Medal,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths } from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────────────────

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
  bonusRules: Array<{
    id: string
    ruleType: string
    thresholdValue: number
    bonusAmount?: number
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  SURGERIES_DONE: 'Surgeries Done',
  LEADS_CLOSED: 'Leads Closed',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
}

const RANK_COLORS = [
  'from-amber-400 to-yellow-500', // 1st - gold
  'from-slate-300 to-slate-400',  // 2nd - silver
  'from-orange-400 to-amber-600', // 3rd - bronze
]

const RANK_ICONS = [Trophy, Medal, Award]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatMetricValue(value: number, metric: string) {
  if (metric === 'NET_PROFIT' || metric === 'BILL_AMOUNT') {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
    return `₹${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

// ─── Month Picker ───────────────────────────────────────────────────────────────

function MonthPicker({ selectedMonth, onChange }: { selectedMonth: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-2 py-1.5 shadow-sm">
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

// ─── Team Target Hero Card ──────────────────────────────────────────────────────

function TeamTargetHero({ target }: { target: TargetProgress }) {
  const pct = Math.min(target.percentage, 100)
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (pct / 100) * circumference

  const statusColors = {
    completed: 'text-emerald-500',
    on_track: 'text-blue-500',
    at_risk: 'text-red-500',
  }

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/40 dark:via-card dark:to-fuchsia-950/20 border-violet-200 dark:border-violet-800">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Circular progress */}
          <div className="relative shrink-0">
            <svg width="120" height="120" className="-rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-violet-100 dark:text-violet-900/50" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke="url(#gradient)" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#D946EF" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{target.percentage}%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">progress</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
              <Target className="h-5 w-5 text-violet-500" />
              <h2 className="text-lg font-bold">Team Target</h2>
              <Badge className={cn('text-[11px] border-0', statusColors[target.status])}>
                {target.status === 'completed' ? '🎉 Completed!' : target.status === 'on_track' ? '📈 On Track' : '⚠️ At Risk'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {METRIC_LABELS[target.metric]} · {format(new Date(), 'MMMM yyyy')}
            </p>
            <div className="flex items-center gap-6 justify-center sm:justify-start">
              <div>
                <p className="text-3xl font-bold">{formatMetricValue(target.actual, target.metric)}</p>
                <p className="text-xs text-muted-foreground">Achieved</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-3xl font-bold text-muted-foreground/60">{formatMetricValue(target.targetValue, target.metric)}</p>
                <p className="text-xs text-muted-foreground">Target</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── BD Leaderboard ─────────────────────────────────────────────────────────────

function BDLeaderboard({
  bdTargets,
  teamTarget,
}: {
  bdTargets: TargetProgress[]
  teamTarget: TargetProgress | null
}) {
  // Combine BD targets and team breakdown
  const allBDs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; profilePicture: string | null; actual: number; targetValue: number; percentage: number; hasTarget: boolean }>()

    // From individual BD targets
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

    // From team breakdown (add any BDs not already covered)
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
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        BD Performance
      </h2>
      <div className="space-y-2">
        {allBDs.map((bd, idx) => {
          const ac = getAvatarColor(bd.name)
          const barWidth = maxActual > 0 ? (bd.actual / maxActual) * 100 : 0
          const RankIcon = idx < 3 ? RANK_ICONS[idx] : null
          const isTop3 = idx < 3

          return (
            <div
              key={bd.id}
              className={cn(
                'relative flex items-center gap-3 bg-card border rounded-xl p-3 overflow-hidden transition-all hover:shadow-md',
                isTop3 && 'border-amber-200/50 dark:border-amber-800/30'
              )}
            >
              {/* Background bar */}
              <div
                className={cn(
                  'absolute inset-y-0 left-0 opacity-[0.06] transition-all duration-700',
                  idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-orange-500' : 'bg-blue-500'
                )}
                style={{ width: `${barWidth}%` }}
              />

              {/* Rank */}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 shrink-0">
                {RankIcon ? (
                  <div className={cn('h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center', RANK_COLORS[idx])}>
                    <RankIcon className="h-3.5 w-3.5 text-white" />
                  </div>
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="relative z-10">
                {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                  {getInitials(bd.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name & progress */}
              <div className="relative z-10 flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold truncate">{bd.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {bd.hasTarget && (
                      <span className="text-xs text-muted-foreground">
                        / {formatMetricValue(bd.targetValue, teamTarget?.metric || 'SURGERIES_DONE')}
                      </span>
                    )}
                    <span className={cn(
                      'text-lg font-bold tabular-nums',
                      idx === 0 ? 'text-amber-600 dark:text-amber-400' : ''
                    )}>
                      {formatMetricValue(bd.actual, teamTarget?.metric || 'SURGERIES_DONE')}
                    </span>
                  </div>
                </div>
                {bd.hasTarget && (
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(bd.percentage, 100)}
                      className="h-1.5 flex-1 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-fuchsia-500"
                    />
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right">{bd.percentage}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Assign BD Target Form ──────────────────────────────────────────────────────

function AssignBDTargetForm({
  members,
  selectedMonth,
  onSubmit,
  isLoading,
}: {
  members: TeamMember[]
  selectedMonth: Date
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
}) {
  const [selectedBdId, setSelectedBdId] = useState('')
  const [metric, setMetric] = useState('SURGERIES_DONE')
  const [targetValue, setTargetValue] = useState('')

  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBdId) {
      toast.error('Please select a BD')
      return
    }
    onSubmit({
      targetType: 'BD',
      targetForId: selectedBdId,
      periodType: 'MONTH',
      periodStartDate: periodStart.toISOString(),
      periodEndDate: periodEnd.toISOString(),
      metric,
      targetValue: parseFloat(targetValue),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Select BD</Label>
        <div className="grid gap-2 mt-2 max-h-[220px] overflow-y-auto">
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
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <Avatar size="sm">
                  {m.profilePicture && <AvatarImage src={m.profilePicture} />}
                  <AvatarFallback className={cn(ac.bg, ac.text, 'text-[10px] font-semibold')}>
                    {getInitials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
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

      <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Period</span>
        <span className="text-sm font-medium">{format(periodStart, 'MMM d')} – {format(periodEnd, 'MMM d, yyyy')}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SURGERIES_DONE">Surgeries Done</SelectItem>
              <SelectItem value="LEADS_CLOSED">Leads Closed</SelectItem>
              <SelectItem value="NET_PROFIT">Net Profit</SelectItem>
              <SelectItem value="BILL_AMOUNT">Bill Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Target</Label>
          <Input
            type="number"
            className="mt-1"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="Target value"
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Assigning...' : 'Assign Target'}
      </Button>
    </form>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function TeamLeadTargetsPage() {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const monthStr = format(selectedMonth, 'yyyy-MM')

  // Get my team info (I'm a TL, so my Employee.id is the teamId)
  const { data: teams = [] } = useQuery<TeamInfo[]>({
    queryKey: ['target-teams'],
    queryFn: () => apiGet<TeamInfo[]>('/api/targets/teams'),
  })

  const myTeam = useMemo(
    () => teams.find((t) => t.userId === user?.id),
    [teams, user?.id]
  )

  // Get progress for my team
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
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      setIsDialogOpen(false)
      toast.success('Target assigned successfully')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to assign target')
    },
  })

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-violet-500" />
              My Team Targets
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track your team&apos;s progress and assign BD targets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            {myTeam && myTeam.members.length > 0 && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" size="sm">
                    <Plus className="h-4 w-4" />
                    Assign BD Target
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      Assign BD Target
                    </DialogTitle>
                    <DialogDescription>{format(selectedMonth, 'MMMM yyyy')}</DialogDescription>
                  </DialogHeader>
                  <AssignBDTargetForm
                    members={myTeam.members}
                    selectedMonth={selectedMonth}
                    onSubmit={(data) => createTargetMutation.mutate(data)}
                    isLoading={createTargetMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-40 rounded-xl bg-muted animate-pulse" />
            <div className="h-60 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            {/* Team target hero */}
            {teamTarget ? (
              <TeamTargetHero target={teamTarget} />
            ) : (
              <Card className="border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10">
                <CardContent className="py-10 text-center">
                  <Target className="h-10 w-10 text-violet-300 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No team target set for {format(selectedMonth, 'MMMM yyyy')}</h3>
                  <p className="text-sm text-muted-foreground">Your Sales Head will set your team target here.</p>
                </CardContent>
              </Card>
            )}

            {/* My Team section with avatars */}
            {myTeam && myTeam.members.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  My Team · {myTeam.members.length} BDs
                </h2>
                <div className="flex flex-wrap gap-3 mb-4">
                  {myTeam.members.map((m) => {
                    const ac = getAvatarColor(m.name)
                    return (
                      <div key={m.id} className="flex flex-col items-center gap-1">
                        <Avatar>
                          {m.profilePicture && <AvatarImage src={m.profilePicture} />}
                          <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-muted-foreground max-w-[60px] truncate text-center">
                          {m.name.split(' ')[0]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BD Leaderboard */}
            <BDLeaderboard bdTargets={bdTargets} teamTarget={teamTarget ?? null} />

            {/* Empty state for no BD data */}
            {bdTargets.length === 0 && (!teamTarget || teamTarget.bdBreakdown.length === 0) && myTeam && (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No BD targets yet</h3>
                  <p className="text-sm text-muted-foreground mb-3">Assign targets to your BDs to track their individual performance.</p>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Assign First Target
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
