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
  Zap,
  Award,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths } from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TeamInfo {
  id: string // Employee.id
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
  periodType: 'WEEK' | 'MONTH'
  periodStartDate: string
  periodEndDate: string
  metric: string
  targetValue: number
  actual: number
  percentage: number
  status: 'completed' | 'on_track' | 'at_risk'
  createdBy: { id: string; name: string }
  bonusRules: Array<{
    id: string
    ruleType: string
    thresholdValue: number
    bonusAmount?: number
    bonusPercentage?: number
  }>
  bdBreakdown: Array<{
    id: string
    name: string
    profilePicture: string | null
    actual: number
    percentage: number
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  SURGERIES_DONE: 'Surgeries Done',
  LEADS_CLOSED: 'Leads Closed',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
}

const METRIC_COLORS: Record<string, { bg: string; text: string; border: string; progress: string }> = {
  SURGERIES_DONE: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800', progress: '[&>div]:bg-violet-500' },
  LEADS_CLOSED: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', progress: '[&>div]:bg-blue-500' },
  NET_PROFIT: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', progress: '[&>div]:bg-emerald-500' },
  BILL_AMOUNT: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', progress: '[&>div]:bg-amber-500' },
}

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  on_track: { label: 'On Track', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  at_risk: { label: 'At Risk', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
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

function MonthPicker({
  selectedMonth,
  onChange,
}: {
  selectedMonth: Date
  onChange: (date: Date) => void
}) {
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-2 py-1.5 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(subMonths(selectedMonth, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[120px] text-center">
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
  const teamTargets = targets.filter((t) => t.targetType === 'TEAM')
  const totalTarget = teamTargets.reduce((s, t) => s + t.targetValue, 0)
  const totalActual = teamTargets.reduce((s, t) => s + t.actual, 0)
  const avgPercentage = teamTargets.length > 0
    ? Math.round(teamTargets.reduce((s, t) => s + t.percentage, 0) / teamTargets.length)
    : 0
  const completedCount = teamTargets.filter((t) => t.status === 'completed').length
  const atRiskCount = teamTargets.filter((t) => t.status === 'at_risk').length

  const stats = [
    {
      label: 'Teams Tracked',
      value: teamTargets.length,
      icon: Users,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    },
    {
      label: 'Avg Progress',
      value: `${avgPercentage}%`,
      icon: TrendingUp,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    {
      label: 'Completed',
      value: completedCount,
      icon: Trophy,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    },
    {
      label: 'At Risk',
      value: atRiskCount,
      icon: Zap,
      color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm"
        >
          <div className={cn('rounded-xl p-2.5', stat.color)}>
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Team Target Card ───────────────────────────────────────────────────────────

function TeamTargetCard({ target }: { target: TargetProgress }) {
  const mc = METRIC_COLORS[target.metric] || METRIC_COLORS.SURGERIES_DONE
  const sc = STATUS_CONFIG[target.status]
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className={cn('overflow-hidden border-l-4 transition-all', mc.border)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar size="lg">
              {target.entityAvatar && <AvatarImage src={target.entityAvatar} />}
              <AvatarFallback className={cn(getAvatarColor(target.entityName).bg, getAvatarColor(target.entityName).text, 'font-semibold')}>
                {getInitials(target.entityName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{target.entityName}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn('text-[11px] px-1.5 py-0 border-0', mc.bg, mc.text)}>
                  {METRIC_LABELS[target.metric] || target.metric}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(target.periodStartDate), 'MMM d')} – {format(new Date(target.periodEndDate), 'MMM d')}
                </span>
              </div>
            </div>
          </div>
          <Badge className={cn('shrink-0 text-[11px] font-medium border-0', sc.color)}>
            {sc.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-2xl font-bold">{target.percentage}%</span>
            <span className="text-sm text-muted-foreground">
              {formatMetricValue(target.actual, target.metric)} / {formatMetricValue(target.targetValue, target.metric)}
            </span>
          </div>
          <Progress value={Math.min(target.percentage, 100)} className={cn('h-2.5 rounded-full', mc.progress)} />
        </div>

        {/* BD Breakdown */}
        {target.bdBreakdown.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <Users className="h-3.5 w-3.5" />
              {target.bdBreakdown.length} BDs
              <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
            </button>
            {expanded && (
              <div className="space-y-2 pl-1">
                {target.bdBreakdown.map((bd, idx) => {
                  const ac = getAvatarColor(bd.name)
                  return (
                    <div key={bd.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5 shrink-0 w-5">
                        {idx === 0 && target.bdBreakdown.length > 1 && (
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        {idx !== 0 && (
                          <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
                        )}
                      </div>
                      <Avatar size="sm">
                        {bd.profilePicture && <AvatarImage src={bd.profilePicture} />}
                        <AvatarFallback className={cn(ac.bg, ac.text, 'text-[10px] font-semibold')}>
                          {getInitials(bd.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{bd.name}</span>
                          <span className="text-xs font-semibold tabular-nums">
                            {formatMetricValue(bd.actual, target.metric)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(bd.percentage, 100)}
                          className={cn('h-1 mt-1 rounded-full', mc.progress)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Bonus rules */}
        {target.bonusRules.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {target.bonusRules.map((rule) => (
              <Badge key={rule.id} variant="outline" className="text-[11px] gap-1 bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                <Award className="h-3 w-3" />
                {rule.ruleType === 'PERCENT_ABOVE_TARGET'
                  ? `${rule.thresholdValue}% above → ₹${rule.bonusAmount?.toLocaleString()}`
                  : `${rule.thresholdValue}+ → ₹${rule.bonusAmount?.toLocaleString()}`}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Create Target Form ─────────────────────────────────────────────────────────

function CreateTargetForm({
  teams,
  selectedMonth,
  onSubmit,
  isLoading,
}: {
  teams: TeamInfo[]
  selectedMonth: Date
  onSubmit: (data: Record<string, unknown>) => void
  isLoading: boolean
}) {
  const [targetType, setTargetType] = useState<'TEAM' | 'BD'>('TEAM')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedBdId, setSelectedBdId] = useState('')
  const [metric, setMetric] = useState('SURGERIES_DONE')
  const [targetValue, setTargetValue] = useState('')

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  // Auto-fill period dates for the selected month
  const periodStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const periodEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetForId = targetType === 'TEAM' ? selectedTeamId : selectedBdId
    if (!targetForId) {
      toast.error('Please select a target recipient')
      return
    }
    onSubmit({
      targetType,
      targetForId,
      periodType: 'MONTH',
      periodStartDate: periodStart.toISOString(),
      periodEndDate: periodEnd.toISOString(),
      metric,
      targetValue: parseFloat(targetValue),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Target type toggle */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Target For</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setTargetType('TEAM'); setSelectedBdId('') }}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
              targetType === 'TEAM'
                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border-border text-muted-foreground hover:border-muted-foreground/30'
            )}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Team
          </button>
          <button
            type="button"
            onClick={() => { setTargetType('BD'); setSelectedTeamId('') }}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
              targetType === 'BD'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                : 'border-border text-muted-foreground hover:border-muted-foreground/30'
            )}
          >
            <Target className="h-4 w-4 inline mr-2" />
            Individual BD
          </button>
        </div>
      </div>

      {/* Team / BD selector */}
      {targetType === 'TEAM' ? (
        <div>
          <Label>Select Team</Label>
          <div className="grid gap-2 mt-2 max-h-[200px] overflow-y-auto">
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
                    isSelected
                      ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <Avatar>
                    {team.profilePicture && <AvatarImage src={team.profilePicture} />}
                    <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                      {getInitials(team.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{team.name}&apos;s Team</p>
                    <p className="text-xs text-muted-foreground">{team.memberCount} BDs</p>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-violet-500 flex items-center justify-center">
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
      ) : (
        <div>
          <Label>Select Team (then BD)</Label>
          <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedBdId('') }}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select team first" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}&apos;s Team ({team.memberCount} BDs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTeam && (
            <div className="grid gap-2 mt-3 max-h-[180px] overflow-y-auto">
              {selectedTeam.members.map((m) => {
                const ac = getAvatarColor(m.name)
                const isSelected = selectedBdId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedBdId(m.id)}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left',
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
                      <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Period display */}
      <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Period</span>
        <span className="text-sm font-medium">
          {format(periodStart, 'MMM d, yyyy')} – {format(periodEnd, 'MMM d, yyyy')}
        </span>
      </div>

      {/* Metric & Value */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SURGERIES_DONE">Surgeries Done</SelectItem>
              <SelectItem value="LEADS_CLOSED">Leads Closed</SelectItem>
              <SelectItem value="NET_PROFIT">Net Profit</SelectItem>
              <SelectItem value="BILL_AMOUNT">Bill Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Target Value</Label>
          <Input
            type="number"
            className="mt-1"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder={metric.includes('PROFIT') || metric.includes('BILL') ? '₹ amount' : 'Count'}
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Set Target'}
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
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthStr}`),
  })

  const createTargetMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/api/targets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-progress'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      setIsDialogOpen(false)
      toast.success('Target created successfully')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create target')
    },
  })

  const teamTargets = useMemo(() => targets.filter((t) => t.targetType === 'TEAM'), [targets])
  const bdTargets = useMemo(() => targets.filter((t) => t.targetType === 'BD'), [targets])

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-violet-500" />
              Monthly Targets
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Set and track team performance targets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-4 w-4" />
                  Set Target
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-500" />
                    Set Monthly Target
                  </DialogTitle>
                  <DialogDescription>
                    {format(selectedMonth, 'MMMM yyyy')} target
                  </DialogDescription>
                </DialogHeader>
                <CreateTargetForm
                  teams={teams}
                  selectedMonth={selectedMonth}
                  onSubmit={(data) => createTargetMutation.mutate(data)}
                  isLoading={createTargetMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary stats */}
        {targets.length > 0 && <SummaryStats targets={targets} />}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : targets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No targets set for {format(selectedMonth, 'MMMM yyyy')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click &ldquo;Set Target&rdquo; to create monthly targets for your teams
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
          <div className="space-y-6">
            {/* Team targets */}
            {teamTargets.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Targets
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {teamTargets.map((t) => (
                    <TeamTargetCard key={t.id} target={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Individual BD targets */}
            {bdTargets.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Individual BD Targets
                </h2>
                <div className="grid gap-3">
                  {bdTargets.map((t) => {
                    const mc = METRIC_COLORS[t.metric] || METRIC_COLORS.SURGERIES_DONE
                    const sc = STATUS_CONFIG[t.status]
                    const ac = getAvatarColor(t.entityName)
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center gap-4 bg-card border rounded-xl p-4 shadow-sm border-l-4',
                          mc.border
                        )}
                      >
                        <Avatar>
                          {t.entityAvatar && <AvatarImage src={t.entityAvatar} />}
                          <AvatarFallback className={cn(ac.bg, ac.text, 'font-semibold text-xs')}>
                            {getInitials(t.entityName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold truncate">{t.entityName}</span>
                            <Badge className={cn('text-[10px] border-0 shrink-0', sc.color)}>
                              {sc.label}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                            <span>{METRIC_LABELS[t.metric]}</span>
                            <span className="font-medium">
                              {formatMetricValue(t.actual, t.metric)} / {formatMetricValue(t.targetValue, t.metric)}
                            </span>
                          </div>
                          <Progress value={Math.min(t.percentage, 100)} className={cn('h-1.5 rounded-full', mc.progress)} />
                        </div>
                        <span className="text-lg font-bold tabular-nums shrink-0">{t.percentage}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}
