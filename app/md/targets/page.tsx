'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, Target } from 'lucide-react'
import { HeadTargetDetailDrawer } from '@/components/md/targets/head-target-detail-drawer'
import { AddTargetDrawer } from '@/components/md/targets/add-target-drawer'
import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  SALES_HEAD: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  HR_HEAD: 'bg-violet-100 text-violet-700 border-violet-200',
  DIGITAL_MARKETING_HEAD: 'bg-sky-100 text-sky-700 border-sky-200',
  IT_HEAD: 'bg-amber-100 text-amber-700 border-amber-200',
  EXECUTIVE_ASSISTANT: 'bg-rose-100 text-rose-700 border-rose-200',
}

const AVATAR_COLORS: Record<string, string> = {
  SALES_HEAD: 'bg-emerald-500/20 text-emerald-700',
  HR_HEAD: 'bg-violet-500/20 text-violet-700',
  DIGITAL_MARKETING_HEAD: 'bg-sky-500/20 text-sky-700',
  IT_HEAD: 'bg-amber-500/20 text-amber-700',
  EXECUTIVE_ASSISTANT: 'bg-rose-500/20 text-rose-700',
}

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPD Done',
  HEAD_COUNT: 'Head Count',
  LEADS_GENERATED: 'Leads',
  REVENUE: 'Revenue',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function formatValue(value: number, metric: string): string {
  if (metric === 'REVENUE') {
    if (value >= 1000000) return `₹${(value / 1000000).toFixed(1)}M`
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    return `₹${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

interface HeadTargetItem {
  head: {
    id: string
    name: string
    email: string
    role: string
    profilePicture: string | null
    department: { id: string; name: string } | null
    departmentLabel: string
  }
  activeTarget: {
    id: string
    metric: string
    targetValue: number
    departmentTargets?: { departmentId: string; addCount: number }[] | null
    periodStartDate: string
    periodEndDate: string
    periodType: string
  } | null
  achievement: {
    actual: number
    targetValue: number
    percentage: number
    metric: string
  }
}

const HEAD_ROLES = ['SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'EXECUTIVE_ASSISTANT'] as const

export default function MDTargetsPage() {
  const { user } = useAuth()
  const [detailHeadId, setDetailHeadId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [editHeadId, setEditHeadId] = useState<string | null>(null)

  const isMdOrAdmin = user?.role === 'MD' || user?.role === 'ADMIN'
  const isHead = user && HEAD_ROLES.includes(user.role as (typeof HEAD_ROLES)[number])

  const { data: items = [], isLoading, error } = useQuery<HeadTargetItem[]>({
    queryKey: ['md-head-targets'],
    queryFn: () => apiGet<HeadTargetItem[]>('/api/md/head-targets'),
    enabled: isMdOrAdmin,
  })

  type AchievementMonth = {
    month: string
    targetValue: number
    actual: number
    percentage: number
    targetId?: string | null
  }

  const {
    data: myAchievement,
    isLoading: myAchievementLoading,
    isError: myAchievementError,
    error: myAchievementErr,
  } = useQuery({
    queryKey: ['head-target-achievement', user?.id],
    queryFn: () =>
      apiGet<{
        head: { id: string; name: string; role: string; departmentLabel?: string }
        metric: string
        currentMonth: AchievementMonth
        history: AchievementMonth[]
      }>(`/api/md/head-targets/achievement?headUserId=${user?.id}`),
    enabled: !!user?.id && !!isHead,
  })

  const handleCardClick = (headId: string) => {
    setDetailHeadId(headId)
    setDetailOpen(true)
  }

  const handleEditTarget = (headUserId: string) => {
    setEditHeadId(headUserId)
    setAddDrawerOpen(true)
  }

  const displayItems = isMdOrAdmin ? items : []
  const cm = myAchievement?.currentMonth
  const hasMyTargetRecord =
    !!cm && (cm.targetValue > 0 || Boolean(cm.targetId))
  const showMyTarget = Boolean(isHead && hasMyTargetRecord)

  return (
    <AuthenticatedLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-lg font-semibold leading-tight tracking-tight sm:text-xl md:text-2xl">
            {isHead ? 'My target' : 'Department targets'}
          </h1>
          {isMdOrAdmin && (
            <Button
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-3 sm:px-4"
              onClick={() => {
                setEditHeadId(null)
                setAddDrawerOpen(true)
              }}
              aria-label="Add target"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add target</span>
            </Button>
          )}
        </header>

        {isHead && myAchievementLoading && (
          <Card>
            <CardContent className="p-6 space-y-3 animate-pulse">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-8 w-48 rounded bg-muted" />
              <div className="h-2 w-full rounded bg-muted" />
            </CardContent>
          </Card>
        )}

        {isHead && myAchievementError && (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium text-destructive">Could not load your target</p>
              <p className="text-sm text-muted-foreground">
                {(myAchievementErr as Error)?.message || 'Please refresh or try again later.'}
              </p>
            </CardContent>
          </Card>
        )}

        {isHead && !myAchievementLoading && !myAchievementError && showMyTarget && myAchievement && (
          <Card
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
            onClick={() => {
              setDetailHeadId(user!.id)
              setDetailOpen(true)
            }}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {METRIC_LABELS[myAchievement.metric] ?? myAchievement.metric}
                  </p>
                  <p className="mt-1 text-xl font-bold sm:text-2xl">
                    {formatValue(myAchievement.currentMonth.actual, myAchievement.metric)} /{' '}
                    {formatValue(myAchievement.currentMonth.targetValue, myAchievement.metric)}
                  </p>
                </div>
                <Badge
                  variant={myAchievement.currentMonth.percentage >= 100 ? 'default' : 'secondary'}
                  className={
                    myAchievement.currentMonth.percentage >= 100 ? 'bg-emerald-600' : ''
                  }
                >
                  {myAchievement.currentMonth.percentage}%
                </Badge>
              </div>
              <Progress
                value={Math.min(myAchievement.currentMonth.percentage, 100)}
                className="mt-4 h-2"
              />
            </CardContent>
          </Card>
        )}

        {isHead && !myAchievementLoading && !myAchievementError && !showMyTarget && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No target set for this month. Contact your MD to set a target.
            </CardContent>
          </Card>
        )}

        {isMdOrAdmin && isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="h-14 w-14 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-32 rounded bg-muted" />
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-6 w-full rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isMdOrAdmin && displayItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">
                No department heads found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ensure users with Sales, HR, Digital, or IT Head roles exist
              </p>
            </CardContent>
          </Card>
        ) : isMdOrAdmin ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item) => {
              const { head, achievement, activeTarget } = item
              const roleColor = ROLE_COLORS[head.role] ?? 'bg-muted'
              const avatarColor = AVATAR_COLORS[head.role] ?? 'bg-muted'
              const metric = achievement.metric
              const hasTarget = activeTarget && achievement.targetValue > 0

              return (
                <Card
                  key={head.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20 active:scale-[0.99]"
                  onClick={() => handleCardClick(head.id)}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex gap-4">
                      <Avatar
                        className={cn(
                          'size-14 shrink-0 ring-2 ring-background',
                          avatarColor
                        )}
                      >
                        <AvatarImage src={head.profilePicture ?? undefined} />
                        <AvatarFallback className="text-lg font-semibold">
                          {getInitials(head.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{head.name}</p>
                        <Badge
                          variant="outline"
                          className={cn('mt-1 text-xs', roleColor)}
                        >
                          {head.departmentLabel}
                        </Badge>
                        {hasTarget ? (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {METRIC_LABELS[metric] ?? metric}
                              </span>
                              <span className="font-medium">
                                {formatValue(achievement.actual, metric)} /{' '}
                                {formatValue(achievement.targetValue, metric)}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(achievement.percentage, 100)}
                              className="h-2"
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-3">
                            No target set
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}
      </div>

      <HeadTargetDetailDrawer
        headUserId={detailHeadId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEditTarget={isMdOrAdmin ? handleEditTarget : undefined}
      />

      <AddTargetDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        prefillHeadId={editHeadId}
        onSuccess={() => {
          setAddDrawerOpen(false)
          setEditHeadId(null)
        }}
      />
    </AuthenticatedLayout>
  )
}
