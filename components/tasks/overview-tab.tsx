"use client"

import { useState, useMemo } from "react"
import { startOfDay } from "date-fns"
import { useTaskStats, useTasks, useWarnings } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { StatCard } from "@/components/ui/stat-card"
import { TaskRow } from "./task-row"
import { getTaskCardClass } from "./task-card-class"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { ChevronDown, ChevronRight, LayoutGrid, Users, Star, Trophy, Medal } from "lucide-react"
import type { Task } from "@/hooks/use-tasks"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function OverviewTab() {
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorDetail } = useTaskStats()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: allWarnings = [] } = useWarnings()
  const taskWarningCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of allWarnings) {
      if (w.taskId) map[w.taskId] = (map[w.taskId] ?? 0) + 1
    }
    return map
  }, [allWarnings])
  const activityCountByAssignee = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of tasks) {
      const count = t.unseenActivityCount ?? 0
      if (count > 0) {
        map[t.assigneeId] = (map[t.assigneeId] ?? 0) + count
      }
    }
    return map
  }, [tasks])
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [expandedAssigneeId, setExpandedAssigneeId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)
  const [statDrawer, setStatDrawer] = useState<"completed" | "pending" | "pendingReview" | "overdue" | null>(null)
  const [overdueExpanded, setOverdueExpanded] = useState(false)
  const isMobile = useIsMobile()

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const overdueTasks = useMemo(() => {
    const today = startOfDay(new Date())
    return tasks
      .filter(
        (t) =>
          t.status !== "COMPLETED" &&
          t.status !== "CANCELLED" &&
          t.dueDate &&
          new Date(t.dueDate) < today
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
  }, [tasks])

  const projectList = useMemo(
    () => stats?.projectWise.filter((p) => p.projectId != null) ?? [],
    [stats]
  )

  const statDrawerTasks = useMemo(() => {
    if (!statDrawer) return []
    switch (statDrawer) {
      case "completed":
        return tasks.filter((t) => t.status === "COMPLETED")
      case "pending":
        return tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")
      case "pendingReview":
        return tasks.filter((t) => t.status === "EMPLOYEE_DONE")
      case "overdue":
        return overdueTasks
      default:
        return []
    }
  }, [statDrawer, tasks, overdueTasks])

  if (statsError) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        Failed to load stats. {statsErrorDetail instanceof Error ? statsErrorDetail.message : "Please try again."}
      </div>
    )
  }

  if (statsLoading || !stats) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading stats...
      </div>
    )
  }

  const taskTotal = stats.total
  const pctOfTotal = (count: number) => {
    if (taskTotal <= 0) {
      return {
        main: count === 0 ? "0%" : "—",
        sub: `${count} task${count === 1 ? "" : "s"}`,
      }
    }
    return {
      main: `${Math.round((count / taskTotal) * 100)}%`,
      sub: `${count} task${count === 1 ? "" : "s"}`,
    }
  }
  const assigneeCount = stats.employeeWise.length
  const warnN = stats.employeesWithWarnings ?? 0
  const warningsPct =
    assigneeCount <= 0
      ? {
          main: warnN === 0 ? "0%" : "—",
          sub: `${warnN} employee${warnN === 1 ? "" : "s"}`,
        }
      : {
          main: `${Math.round((warnN / assigneeCount) * 100)}%`,
          sub: `${warnN} employee${warnN === 1 ? "" : "s"}`,
        }

  const completedPct = pctOfTotal(stats.completed)
  const pendingPct = pctOfTotal(stats.pending)
  const pendingReviewPct = pctOfTotal(stats.pendingReview ?? 0)
  const overduePct = pctOfTotal(stats.overdue)

  const projectTasks = expandedProjectId
    ? tasks.filter((t) => (t.projectId ?? null) === expandedProjectId)
    : []
  const assigneeTasks = expandedAssigneeId
    ? tasks.filter((t) => t.assigneeId === expandedAssigneeId)
    : []

  const statDrawerTitle =
    statDrawer === "completed"
      ? "Completed"
      : statDrawer === "pending"
        ? "Pending"
        : statDrawer === "pendingReview"
          ? "Needs review"
          : statDrawer === "overdue"
            ? "Overdue"
            : ""

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {isMobile ? (
          <>
            <StatCard
              label="Completed"
              value={completedPct.main}
              subValue={completedPct.sub}
              accent="green"
              valueAccent
              className="cursor-pointer active:opacity-80"
              onClick={() => setStatDrawer("completed")}
            />
            <StatCard
              label="Pending"
              value={pendingPct.main}
              subValue={pendingPct.sub}
              accent="amber"
              className="cursor-pointer active:opacity-80"
              onClick={() => setStatDrawer("pending")}
            />
            <StatCard
              label="Pending review"
              value={pendingReviewPct.main}
              subValue={pendingReviewPct.sub}
              accent="purple"
              valueAccent
              className="cursor-pointer active:opacity-80"
              onClick={() => setStatDrawer("pendingReview")}
            />
            <StatCard
              label="Overdue"
              value={overduePct.main}
              subValue={overduePct.sub}
              accent="red"
              valueAccent
              className="cursor-pointer active:opacity-80"
              onClick={() => setStatDrawer("overdue")}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Completed"
              value={completedPct.main}
              subValue={completedPct.sub}
              accent="green"
              valueAccent
            />
            <StatCard
              label="Pending"
              value={pendingPct.main}
              subValue={pendingPct.sub}
              accent="amber"
            />
            <StatCard
              label="Pending review"
              value={pendingReviewPct.main}
              subValue={pendingReviewPct.sub}
              accent="purple"
              valueAccent
            />
            <StatCard
              label="Overdue"
              value={overduePct.main}
              subValue={overduePct.sub}
              accent="red"
              valueAccent
            />
            <StatCard
              label="Employees w/ warnings"
              value={warningsPct.main}
              subValue={warningsPct.sub}
              accent="orange"
              valueAccent
            />
          </>
        )}
      </section>

      {isMobile && (
        <Sheet open={!!statDrawer} onOpenChange={(open) => !open && setStatDrawer(null)}>
          <SheetContent side="bottom" className="rounded-t-2xl flex flex-col max-h-[85dvh]">
            <SheetHeader className="text-left">
              <SheetTitle>{statDrawerTitle}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-auto py-4 space-y-2">
              {tasksLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : statDrawerTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks</p>
              ) : (
                statDrawerTasks.map((task) => {
                  const today = startOfDay(new Date())
                  const isOverdue = !!task.dueDate && new Date(task.dueDate) < today && task.status !== "COMPLETED"
                  return (
                    <div key={task.id} className={getTaskCardClass(task, { isOverdue })}>
                      <TaskRow
                        task={task}
                        onClick={() => {
                          setDetailTaskId(task.id)
                          setStatDrawer(null)
                        }}
                        showAssignee
                        showProject
                        warningCount={taskWarningCountMap[task.id] ?? 0}
                        extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                        activityCount={task.unseenActivityCount ?? 0}
                        isAssignee={task.assigneeId === user?.id}
                        canMarkComplete={canMarkComplete(task)}
                        onMarkCompleteRequest={() => {
                          setTaskToComplete(task)
                          setStatDrawer(null)
                        }}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {overdueTasks.length > 0 && (
        <section className="rounded-xl border border-border border-l-4 border-l-red-500 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-muted/50"
            onClick={() => setOverdueExpanded((v) => !v)}
          >
            {overdueExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <h2 className="text-sm font-semibold text-red-600 flex-1">
              Overdue ({overdueTasks.length})
            </h2>
          </button>
          {overdueExpanded && (
            <div className="border-t px-2 py-2 space-y-2">
              {overdueTasks.map((task) => (
                <div key={task.id} className={getTaskCardClass(task, { isOverdue: true })}>
                  <TaskRow
                    task={task}
                    onClick={() => setDetailTaskId(task.id)}
                    showAssignee
                    showProject
                    warningCount={taskWarningCountMap[task.id] ?? 0}
                    extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                    activityCount={task.unseenActivityCount ?? 0}
                    isAssignee={task.assigneeId === user?.id}
                    canMarkComplete={canMarkComplete(task)}
                    onMarkCompleteRequest={() => setTaskToComplete(task)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4" />
          Leaderboard
        </h2>
        <div className="space-y-2">
          {stats.employeeWise.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            [...stats.employeeWise]
              .sort((a, b) => {
                const aVal = a.avgRating ?? -1
                const bVal = b.avgRating ?? -1
                return bVal - aVal
              })
              .map((e, idx) => {
                const rank = idx + 1
                const isExpanded = expandedAssigneeId === e.assigneeId
                return (
                  <div
                    key={e.assigneeId}
                    className="rounded-xl border border-border border-l-4 overflow-hidden transition-colors hover:bg-muted/30"
                    style={{
                      borderLeftColor:
                        rank === 1
                          ? "var(--color-amber-500)"
                          : rank === 2
                            ? "var(--color-slate-400)"
                            : rank === 3
                              ? "var(--color-amber-700)"
                              : undefined,
                    }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-muted/50"
                      onClick={() =>
                        setExpandedAssigneeId(
                          isExpanded ? null : e.assigneeId
                        )
                      }
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                        {rank <= 3 ? (
                          rank === 1 ? (
                            <Trophy className="h-5 w-5 text-amber-500" />
                          ) : rank === 2 ? (
                            <Medal className="h-5 w-5 text-slate-400" />
                          ) : (
                            <Medal className="h-5 w-5 text-amber-700" />
                          )
                        ) : (
                          <span className="text-muted-foreground">{rank}</span>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block truncate">{e.assigneeName}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.completed}/{e.total} tasks
                          {(activityCountByAssignee[e.assigneeId] ?? 0) > 0 && (
                            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                              {activityCountByAssignee[e.assigneeId]! > 99 ? "99+" : activityCountByAssignee[e.assigneeId]}
                            </span>
                          )}
                        </span>
                      </div>
                      {e.avgRating != null ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                            {e.avgRating.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">—</span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  {isExpanded && (
                    <div className="border-t px-2 py-2 space-y-2">
                      {tasksLoading ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Loading...
                        </p>
                      ) : assigneeTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No tasks
                        </p>
                      ) : (
                        assigneeTasks.map((task) => {
                          const today = startOfDay(new Date())
                          const isOverdue = !!task.dueDate && new Date(task.dueDate) < today && task.status !== "COMPLETED"
                          return (
                            <div key={task.id} className={getTaskCardClass(task, { isOverdue })}>
                              <TaskRow
                                task={task}
                                onClick={() => setDetailTaskId(task.id)}
                                showAssignee={false}
                                showProject
                                warningCount={taskWarningCountMap[task.id] ?? 0}
                                extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                                activityCount={task.unseenActivityCount ?? 0}
                                isAssignee={task.assigneeId === user?.id}
                                canMarkComplete={canMarkComplete(task)}
                                onMarkCompleteRequest={() => setTaskToComplete(task)}
                              />
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <LayoutGrid className="h-4 w-4" />
          By project
        </h2>
        <div className="space-y-2">
          {projectList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            projectList.map((p) => {
              const total = p.count
              const completed = tasks.filter(
                (t) => (t.projectId ?? null) === p.projectId && t.status === "COMPLETED"
              ).length
              const isExpanded = expandedProjectId === p.projectId
              return (
                <div
                  key={p.projectId ?? "none"}
                  className="rounded-md border"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() =>
                      setExpandedProjectId(isExpanded ? null : p.projectId)
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1 font-medium">{p.projectName}</span>
                    <span className="text-muted-foreground">
                      {completed}/{total}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-2 py-2 space-y-2">
                      {tasksLoading ? (
                        <p className="text-xs text-muted-foreground py-2">
                          Loading...
                        </p>
                      ) : projectTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No tasks
                        </p>
                      ) : (
                        projectTasks.map((task) => {
                          const today = startOfDay(new Date())
                          const isOverdue = !!task.dueDate && new Date(task.dueDate) < today && task.status !== "COMPLETED"
                          return (
                            <div key={task.id} className={getTaskCardClass(task, { isOverdue })}>
                              <TaskRow
                                task={task}
                                onClick={() => setDetailTaskId(task.id)}
                                showAssignee
                                showProject={false}
                                warningCount={taskWarningCountMap[task.id] ?? 0}
                                extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                                activityCount={task.unseenActivityCount ?? 0}
                                isAssignee={task.assigneeId === user?.id}
                                canMarkComplete={canMarkComplete(task)}
                                onMarkCompleteRequest={() => setTaskToComplete(task)}
                              />
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>



      <TaskDetailModal
        open={!!detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
        taskId={detailTaskId}
      />
      <MarkCompleteDrawer
        task={taskToComplete}
        open={!!taskToComplete}
        onOpenChange={(open) => !open && setTaskToComplete(null)}
        onSuccess={() => setTaskToComplete(null)}
      />
    </div>
  )
}
