'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Target,
  TrendingUp,
  Trophy,
  Medal,
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { apiGet } from '@/lib/api-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getAvatarColor } from '@/lib/avatar-colors'
import { cn } from '@/lib/utils'

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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function TeamLeaderCard({
  team,
  target,
}: {
  team: TeamInfo
  target: TargetProgress | null
}) {
  const status = target?.status ?? 'at_risk'
  const sc = STATUS_CONFIG[status]
  const StatusIcon = sc.icon
  const ac = getAvatarColor(team.name)
  const pct = target ? Math.min(target.percentage, 100) : 0
  const members = target?.bdBreakdown ?? []
  const maxActual = members[0]?.actual ?? 0

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 shrink-0">
              {team.profilePicture && <AvatarImage src={team.profilePicture} />}
              <AvatarFallback className={cn(ac.bg, ac.text, 'text-sm font-bold')}>
                {getInitials(team.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight">{team.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Team Leader · {team.memberCount} team member{team.memberCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Badge className={cn('shrink-0 gap-1 border-0 text-xs font-medium', sc.badge)}>
            <StatusIcon className="h-3 w-3" />
            {target ? sc.label : 'No target'}
          </Badge>
        </div>

        {target ? (
          <div>
            <div className="mb-2 flex items-end justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums">{target.actual}</span>
                <span className="text-sm text-muted-foreground">/ {target.targetValue} IPDs</span>
              </div>
              <span className="text-lg font-bold tabular-nums text-muted-foreground/70">
                {Math.round(target.percentage)}%
              </span>
            </div>
            <Progress
              value={pct}
              className={cn('h-2.5 rounded-full [&>div]:rounded-full [&>div]:bg-gradient-to-r', sc.bar)}
            />
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            No monthly target set for this team yet.
          </p>
        )}

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Team members
          </p>
          {members.length > 0 ? (
            members.map((member, idx) => {
              const RankIcon = RANK_ICONS[idx]
              const memberAc = getAvatarColor(member.name)
              const barPct =
                maxActual > 0 ? Math.round((member.actual / maxActual) * 100) : 0
              return (
                <div key={member.id} className="flex items-center gap-2.5">
                  {RankIcon ? (
                    <RankIcon className={cn('h-4 w-4 shrink-0', RANK_COLORS[idx])} />
                  ) : (
                    <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">
                      {idx + 1}
                    </span>
                  )}
                  <Avatar className="h-7 w-7 shrink-0">
                    {member.profilePicture && <AvatarImage src={member.profilePicture} />}
                    <AvatarFallback className={cn(memberAc.bg, memberAc.text, 'text-[9px] font-bold')}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-bold tabular-nums">
                      {member.actual}
                    </span>
                  </div>
                </div>
              )
            })
          ) : team.members.length > 0 ? (
            team.members.map((member) => {
              const memberAc = getAvatarColor(member.name)
              return (
                <div key={member.id} className="flex items-center gap-2.5">
                  <span className="w-4 shrink-0" />
                  <Avatar className="h-7 w-7 shrink-0">
                    {member.profilePicture && <AvatarImage src={member.profilePicture} />}
                    <AvatarFallback className={cn(memberAc.bg, memberAc.text, 'text-[9px] font-bold')}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">0 IPDs</span>
                </div>
              )
            })
          ) : (
            <p className="text-sm italic text-muted-foreground">No team members assigned</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Project Head view for Executive Assistant on the home page.
 * Visible only to EXECUTIVE_ASSISTANT role.
 */
export function EaProjectHeadTeamsSection() {
  const { user } = useAuth()
  const month = format(new Date(), 'yyyy-MM')

  const { data: teams = [], isLoading: teamsLoading } = useQuery<TeamInfo[]>({
    queryKey: ['target-teams', 'ea-home'],
    queryFn: () => apiGet<TeamInfo[]>('/api/targets/teams'),
    enabled: user?.role === 'EXECUTIVE_ASSISTANT',
  })

  const { data: targets = [], isLoading: targetsLoading } = useQuery<TargetProgress[]>({
    queryKey: ['target-progress', 'ea-home', month],
    queryFn: () =>
      apiGet<TargetProgress[]>(`/api/targets/progress?month=${month}&targetType=TEAM`),
    enabled: user?.role === 'EXECUTIVE_ASSISTANT',
  })

  const teamCards = useMemo(() => {
    const targetByTeamId = new Map(
      targets.filter((t) => t.targetType === 'TEAM').map((t) => [t.targetForId, t])
    )
    return teams
      .map((team) => ({
        team,
        target: targetByTeamId.get(team.id) ?? null,
      }))
      .sort((a, b) => (b.target?.percentage ?? 0) - (a.target?.percentage ?? 0))
  }, [teams, targets])

  if (user?.role !== 'EXECUTIVE_ASSISTANT') return null

  const isLoading = teamsLoading || targetsLoading
  const withTargets = teamCards.filter((c) => c.target)
  const totalTarget = withTargets.reduce((sum, c) => sum + (c.target?.targetValue ?? 0), 0)
  const totalActual = withTargets.reduce((sum, c) => sum + (c.target?.actual ?? 0), 0)
  const overallPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Team Leader Achievements
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'MMMM yyyy')} · Team targets and member progress
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start" asChild>
          <Link href="/executive-assistant/targets">
            View all targets
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {!isLoading && withTargets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Teams tracked</p>
            <p className="text-3xl font-bold tabular-nums">{withTargets.length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Monthly target</p>
            <p className="text-3xl font-bold tabular-nums">{totalTarget}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">IPDs done</p>
            <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalActual}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Overall progress</p>
            <p
              className={cn(
                'text-3xl font-bold tabular-nums',
                overallPct >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'
              )}
            >
              {overallPct}%
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : teamCards.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-10 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium">No team leaders found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Team leader records will appear here once configured in HR.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teamCards.map(({ team, target }) => (
            <TeamLeaderCard key={team.id} team={team} target={target} />
          ))}
        </div>
      )}
    </section>
  )
}
