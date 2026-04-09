"use client"

import { useState, useMemo } from "react"
import { startOfDay, isSameDay } from "date-fns"
import { useTaskStats, useTasks, useWarnings } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { StatCard } from "@/components/ui/stat-card"
import { TaskRow } from "./task-row"
import { getTaskCardClass } from "./task-card-class"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { ChevronDown, ChevronRight, LayoutGrid, Users, Star, CalendarCheck } from "lucide-react"
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
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)
  const [statDrawer, setStatDrawer] = useState<"completed" | "pending" | "pendingReview" | "overdue" | null>(null)
  const [overdueExpanded, setOverdueExpanded] = useState(false)
  const [dueTodayExpanded, setDueTodayExpanded] = useState(true)
  const isMobile = useIsMobile()

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const today = useMemo(() => startOfDay(new Date()), [])

  const overdueTasks = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          t.status !== "COMPLETED" &&
          t.status !== "CANCELLED" &&
          t.status !== "EMPLOYEE_DONE" &&
          t.dueDate &&
          new Date(t.dueDate) < today
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      )
  }, [tasks, today])

  const dueTodayTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status !== "COMPLETED" &&
        t.status !== "CANCELLED" &&
        t.dueDate &&
        isSameDay(new Date(t.dueDate), today)
    )
  }, [tasks, today])

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
  const completedPct = pctOfTotal(stats.completed)
  const pendingPct = pctOfTotal(stats.pending)
  const pendingReviewPct = pctOfTotal(stats.pendingReview ?? 0)
  const overduePct = pctOfTotal(stats.overdue)

  const projectTasks = expandedProjectId
    ? tasks.filter((t) => (t.projectId ?? null) === expandedProjectId)
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
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                  {statDrawerTasks.map((task) => {
                    const isOverdue =
                      !!task.dueDate &&
                      new Date(task.dueDate) < today &&
                      task.status !== "COMPLETED" &&
                      task.status !== "EMPLOYEE_DONE"
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
                  })}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {dueTodayTasks.length > 0 && (
        <section>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-1 py-2 text-left hover:opacity-80"
            onClick={() => setDueTodayExpanded((v) => !v)}
          >
            {dueTodayExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-blue-600" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-blue-600" />
            )}
            <CalendarCheck className="h-4 w-4 shrink-0 text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-600 flex-1">
              Due Today ({dueTodayTasks.length})
            </h2>
          </button>
          {dueTodayExpanded && (
            <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
              {dueTodayTasks.map((task) => (
                <div key={task.id} className={getTaskCardClass(task, { isOverdue: false })}>
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


      {overdueTasks.length > 0 && (
        <section>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-1 py-2 text-left hover:opacity-80"
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
            <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
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
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-2 px-1 text-muted-foreground uppercase tracking-wide">
          <LayoutGrid className="h-4 w-4" />
          By project
        </h2>
        <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
          {projectList.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-6">No projects yet.</p>
          ) : (
            projectList.map((p) => {
              const total = p.count
              const completed = tasks.filter(
                (t) => (t.projectId ?? null) === p.projectId && t.status === "COMPLETED"
              ).length
              const isExpanded = expandedProjectId === p.projectId
              return (
                <div key={p.projectId ?? "none"}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    onClick={() =>
                      setExpandedProjectId(isExpanded ? null : p.projectId)
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span className="flex-1 text-base font-medium">{p.projectName}</span>
                    <span className="text-sm text-muted-foreground">
                      {completed}/{total}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t divide-y divide-border bg-muted/20">
                      {tasksLoading ? (
                        <p className="text-xs text-muted-foreground px-4 py-4">
                          Loading...
                        </p>
                      ) : projectTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-4 py-4">
                          No tasks
                        </p>
                      ) : (
                        projectTasks.map((task) => {
                          const isOverdue =
                            !!task.dueDate &&
                            new Date(task.dueDate) < today &&
                            task.status !== "COMPLETED" &&
                            task.status !== "EMPLOYEE_DONE"
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
