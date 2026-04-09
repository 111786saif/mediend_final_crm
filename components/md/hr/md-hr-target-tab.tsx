'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Target, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HRDashboardFilters } from './md-hr-filter-drawer'

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

interface EmployeeForTargets {
  joinDate: string | null
  departmentId: string | null
  employeeCode?: string
  user?: { name: string }
}

function getMonthBounds() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function countJoinsInDept(employees: EmployeeForTargets[], deptId: string, start: Date, end: Date): number {
  return employees.filter((e) => {
    if (!e.joinDate || e.departmentId !== deptId) return false
    const jd = new Date(e.joinDate)
    return !isNaN(jd.getTime()) && jd >= start && jd <= end
  }).length
}

function getJoinersInDept(employees: EmployeeForTargets[], deptId: string, start: Date, end: Date) {
  return employees.filter((e) => {
    if (!e.joinDate || e.departmentId !== deptId) return false
    const jd = new Date(e.joinDate)
    return !isNaN(jd.getTime()) && jd >= start && jd <= end
  })
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MdHrTargetTabProps {
  filters: HRDashboardFilters
}

export function MdHrTargetTab({ filters }: MdHrTargetTabProps) {
  const [detailDeptId, setDetailDeptId] = useState<string | null>(null)

  const { data: headTargetItems = [], isLoading: targetsLoading } = useQuery<HeadTargetItem[]>({
    queryKey: ['md-head-targets', 'hr-tab'],
    queryFn: () => apiGet<HeadTargetItem[]>('/api/md/head-targets'),
  })

  const { data: employeesRaw = [] } = useQuery<EmployeeForTargets[]>({
    queryKey: ['employees-for-hr-targets'],
    queryFn: () => apiGet<EmployeeForTargets[]>('/api/employees'),
  })

  const { data: departments = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments-for-hr-targets'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
  })

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of departments) m.set(d.id, d.name)
    return m
  }, [departments])

  const monthBounds = useMemo(() => getMonthBounds(), [])

  const employeesForTargets = useMemo((): EmployeeForTargets[] => {
    return (employeesRaw as any[]).map((e: any) => ({
      joinDate: e.joinDate ?? null,
      departmentId: e.departmentId ?? null,
      employeeCode: e.employeeCode ?? '',
      user: e.user ?? { name: 'Unknown' },
    }))
  }, [employeesRaw])

  // Find the HR HEAD target with HEAD_COUNT metric
  const hrTarget = useMemo(() => {
    return headTargetItems.find(
      (item) => item.head.role === 'HR_HEAD' && item.achievement.metric === 'HEAD_COUNT'
    )
  }, [headTargetItems])

  const departmentBreakdown = useMemo(() => {
    if (!hrTarget?.activeTarget?.departmentTargets) return []
    return hrTarget.activeTarget.departmentTargets
      .filter((dt) => dt.addCount > 0)
      .map((dt) => {
        const actual = countJoinsInDept(employeesForTargets, dt.departmentId, monthBounds.start, monthBounds.end)
        const pct = dt.addCount > 0 ? Math.round((actual / dt.addCount) * 100) : 0
        return {
          departmentId: dt.departmentId,
          departmentName: deptNameById.get(dt.departmentId) ?? 'Department',
          target: dt.addCount,
          actual,
          percentage: pct,
        }
      })
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
  }, [hrTarget, employeesForTargets, deptNameById, monthBounds])

  const selectedDept = useMemo(() => {
    if (!detailDeptId) return null
    return departmentBreakdown.find((d) => d.departmentId === detailDeptId) ?? null
  }, [detailDeptId, departmentBreakdown])

  const selectedDeptJoiners = useMemo(() => {
    if (!detailDeptId) return []
    return getJoinersInDept(employeesForTargets, detailDeptId, monthBounds.start, monthBounds.end)
  }, [detailDeptId, employeesForTargets, monthBounds])

  if (targetsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!hrTarget || !hrTarget.activeTarget) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium text-lg">No hiring target set</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set a headcount target for HR to track department-wise hiring progress
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/md/targets">
              Go to targets
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { achievement } = hrTarget

  return (
    <div className="space-y-5 sm:space-y-7 pb-8">
      {/* Overall Summary */}
      <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-600" />
                Headcount Target — {MONTHS[new Date().getMonth()]}
              </p>
              <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
                {achievement.actual} <span className="text-lg font-normal text-muted-foreground">/ {achievement.targetValue}</span>
              </p>
            </div>
            <Badge
              variant={achievement.percentage >= 100 ? 'default' : 'secondary'}
              className={cn(
                'text-base px-3 py-1',
                achievement.percentage >= 100 && 'bg-emerald-600'
              )}
            >
              {achievement.percentage}%
            </Badge>
          </div>
          <Progress value={Math.min(achievement.percentage, 100)} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Department Breakdown */}
      {departmentBreakdown.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Department-wise Targets</CardTitle>
            </div>
            <CardDescription>Hiring progress by department this month</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="space-y-3">
              {departmentBreakdown.map((dept) => (
                <button
                  key={dept.departmentId}
                  type="button"
                  className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/50 active:scale-[0.99] transition-all min-h-[52px]"
                  onClick={() => setDetailDeptId(dept.departmentId)}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="text-sm font-semibold truncate">{dept.departmentName}</p>
                    <span className="text-sm font-medium tabular-nums shrink-0">
                      {dept.actual} / {dept.target}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(dept.percentage, 100)} className="h-2 flex-1" />
                    <Badge
                      variant={dept.percentage >= 100 ? 'default' : 'outline'}
                      className={cn(
                        'text-xs tabular-nums shrink-0',
                        dept.percentage >= 100 && 'bg-emerald-600'
                      )}
                    >
                      {dept.percentage}%
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link to full targets */}
      <Button variant="outline" className="w-full rounded-xl" asChild>
        <Link href="/md/targets" className="gap-1.5">
          View all department targets
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>

      {/* Department Detail Drawer */}
      <Drawer open={!!detailDeptId} onOpenChange={(open) => !open && setDetailDeptId(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              {selectedDept?.departmentName ?? 'Department'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selectedDept && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Hiring progress</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {selectedDept.actual} / {selectedDept.target}
                  </span>
                </div>
                <Progress value={Math.min(selectedDept.percentage, 100)} className="h-2.5" />

                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    New joiners this month
                  </p>
                  {selectedDeptJoiners.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No new joiners yet</p>
                  ) : (
                    <div className="overflow-y-auto max-h-[50dvh]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-sm">Name</TableHead>
                            <TableHead className="text-sm text-right">Join date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedDeptJoiners.map((e, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium py-3">
                                {e.user?.name ?? 'Unknown'}
                              </TableCell>
                              <TableCell className="text-sm py-3 text-right text-teal-600 dark:text-teal-400 font-medium">
                                {e.joinDate
                                  ? new Date(e.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
