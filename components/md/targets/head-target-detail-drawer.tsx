'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart3,
  ChevronLeft,
  Target,
  Users,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  SALES_HEAD: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  HR_HEAD: 'bg-violet-100 text-violet-700 border-violet-200',
  DIGITAL_MARKETING_HEAD: 'bg-sky-100 text-sky-700 border-sky-200',
  IT_HEAD: 'bg-amber-100 text-amber-700 border-amber-200',
}

const AVATAR_COLORS: Record<string, string> = {
  SALES_HEAD: 'bg-emerald-500/20 text-emerald-700',
  HR_HEAD: 'bg-violet-500/20 text-violet-700',
  DIGITAL_MARKETING_HEAD: 'bg-sky-500/20 text-sky-700',
  IT_HEAD: 'bg-amber-500/20 text-amber-700',
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
    return `₹${(value / 100000).toFixed(1)}L`
  }
  return value.toLocaleString()
}

export interface HeadTargetDetailDrawerProps {
  headUserId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditTarget?: (headUserId: string) => void
}

export function HeadTargetDetailDrawer({
  headUserId,
  open,
  onOpenChange,
  onEditTarget,
}: HeadTargetDetailDrawerProps) {
  const isMobile = useIsMobile()
  const { data, isLoading } = useQuery({
    queryKey: ['head-target-achievement', headUserId],
    queryFn: () =>
      apiGet<{
        head: { id: string; name: string; email: string; role: string; profilePicture: string | null; department: { id: string; name: string } | null }
        metric: string
        currentMonth: { month: string; targetValue: number; actual: number; percentage: number }
        history: Array<{ month: string; targetValue: number; actual: number; percentage: number }>
        departmentBreakdown: Array<{
          departmentId: string
          departmentName: string
          currentCount: number
          addedInPeriod: number
          monthlyTarget: number
        }>
      }>(`/api/md/head-targets/achievement?headUserId=${headUserId}`),
    enabled: !!headUserId && open,
  })

  if (!headUserId) return null

  const head = data?.head
  const metric = data?.metric ?? 'IPD_DONE'
  const currentMonth = data?.currentMonth
  const history = data?.history ?? []
  const departmentBreakdown = data?.departmentBreakdown ?? []

  const chartData = [
    ...(currentMonth ? [{ month: currentMonth.month, actual: currentMonth.actual, target: currentMonth.targetValue }] : []),
    ...history.map((h) => ({ month: h.month, actual: h.actual, target: h.targetValue })),
  ].reverse()

  const roleColor = ROLE_COLORS[head?.role ?? ''] ?? 'bg-muted text-muted-foreground'
  const avatarColor = AVATAR_COLORS[head?.role ?? ''] ?? 'bg-muted text-muted-foreground'

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? 'bottom' : 'right'}
    >
      <DrawerContent
        className={cn(
          'flex flex-col overflow-hidden',
          isMobile
            ? 'z-[60] max-h-[min(90dvh,100%)] w-[100vw] max-w-[100vw] rounded-t-2xl border-0'
            : 'ml-auto h-full max-h-dvh w-full max-w-full rounded-none rounded-r-none md:w-[60vw] md:max-w-[min(60vw,56rem)] md:rounded-l-2xl'
        )}
      >
        {isMobile ? (
          <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" aria-hidden />
        ) : null}
        <DrawerHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4 md:py-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 -ml-1"
              onClick={() => onOpenChange(false)}
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <Avatar className={cn('size-12 shrink-0 sm:size-14', avatarColor)}>
                <AvatarImage src={head?.profilePicture ?? undefined} />
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(head?.name ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="text-lg font-semibold truncate">
                  {head?.name ?? 'Loading...'}
                </DrawerTitle>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="outline" className={cn('text-xs', roleColor)}>
                    {head?.department?.name ?? head?.role?.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </DrawerHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div
            className={cn(
              'space-y-4 sm:space-y-6',
              isMobile
                ? 'p-4 pb-[max(1.5rem,calc(4.5rem+env(safe-area-inset-bottom)))]'
                : 'p-6'
            )}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Current Month */}
                {currentMonth && (
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      This Month ({currentMonth.month})
                    </h3>
                    <div className="flex items-end justify-between gap-4 mb-3">
                      <div>
                        <p className="text-2xl font-bold">
                          {formatValue(currentMonth.actual, metric)} / {formatValue(currentMonth.targetValue, metric)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {METRIC_LABELS[metric] ?? metric}
                        </p>
                      </div>
                      <Badge
                        variant={currentMonth.percentage >= 100 ? 'default' : 'secondary'}
                        className={cn(
                          currentMonth.percentage >= 100 && 'bg-emerald-600'
                        )}
                      >
                        {currentMonth.percentage}%
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(currentMonth.percentage, 100)}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Monthly Trend Chart */}
                {chartData.length > 0 && (
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Monthly Trend
                    </h3>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: number) => [formatValue(Number(value), metric), '']}
                            labelFormatter={(label) => label}
                          />
                          <Bar dataKey="actual" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} name="Achieved" />
                          <Bar dataKey="target" fill="rgb(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="Target" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Previous Months */}
                {history.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Previous Months
                    </h3>
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div
                          key={h.month}
                          className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
                        >
                          <span className="font-medium">{h.month}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {formatValue(h.actual, metric)} / {formatValue(h.targetValue, metric)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {h.percentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HR Department Breakdown */}
                {departmentBreakdown.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Department Headcount
                    </h3>
                    <div className="space-y-2">
                      {departmentBreakdown.map((d) => (
                        <div
                          key={d.departmentId}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border px-4 py-3"
                        >
                          <span className="font-medium">{d.departmentName}</span>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {d.currentCount} total
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              +{d.addedInPeriod} /{' '}
                              {d.monthlyTarget > 0 ? d.monthlyTarget : '—'} target
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {onEditTarget && head && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      onEditTarget(head.id)
                      onOpenChange(false)
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Edit Target
                  </Button>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
