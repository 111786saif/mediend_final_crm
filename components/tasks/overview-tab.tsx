"use client"

import { useState, useMemo } from "react"
import { startOfDay, format } from "date-fns"
import { useTaskStats, useTasks, useWarnings, useTaskApprovals, useApproveTaskDueDate } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { StatCard } from "@/components/ui/stat-card"
import { TaskRow } from "./task-row"
import { getTaskCardClass } from "./task-card-class"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { SwipeableReviewRow } from "./approval-tab"
import { ChevronDown, ChevronRight, LayoutGrid, ClipboardCheck, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Task } from "@/hooks/use-tasks"
import { cn } from "@/lib/utils"

export function OverviewTab() {
  const { user } = useAuth()
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorDetail } = useTaskStats()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: allWarnings = [] } = useWarnings()
  const { data: approvals = [] } = useTaskApprovals()
  const approveMutation = useApproveTaskDueDate()
  const { data: pendingReviewTasks = [] } = useTasks(
    { status: "EMPLOYEE_DONE" },
    { enabled: true }
  )

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
  const [expandedCard, setExpandedCard] = useState<"completed" | "pending" | "pendingReview" | "overdue" | null>(null)
  const [exitingTask, setExitingTask] = useState<Task | null>(null)

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

  const projectList = useMemo(
    () => stats?.projectWise.filter((p) => p.projectId != null) ?? [],
    [stats]
  )

  const expandedCardTasks = useMemo(() => {
    if (!expandedCard) return []
    switch (expandedCard) {
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
  }, [expandedCard, tasks, overdueTasks])

  const expandedCardTitle = expandedCard === "completed"
    ? "Completed"
    : expandedCard === "pending"
      ? "Pending"
      : expandedCard === "pendingReview"
        ? "Approvals"
        : expandedCard === "overdue"
          ? "Overdue"
          : ""

  const visibleReviewTasks = useMemo(() => {
    if (!exitingTask) return pendingReviewTasks
    if (pendingReviewTasks.some((t) => t.id === exitingTask.id)) return pendingReviewTasks
    return [exitingTask, ...pendingReviewTasks]
  }, [pendingReviewTasks, exitingTask])

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

  const handleCardClick = (card: "completed" | "pending" | "pendingReview" | "overdue") => {
    setExpandedCard((prev) => (prev === card ? null : card))
  }

  const renderTaskList = (taskList: Task[]) => (
    <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
      {taskList.length === 0 ? (
        <p className="text-sm text-muted-foreground px-4 py-6">No tasks</p>
      ) : (
        taskList.map((task) => {
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
  )

  return (
    <div className="space-y-6">
      {/* Stat Cards — clickable to expand inline */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Completed"
          value={completedPct.main}
          subValue={completedPct.sub}
          accent="green"
          valueAccent
          className={cn("cursor-pointer active:opacity-80 transition-all", expandedCard === "completed" && "ring-2 ring-emerald-500")}
          onClick={() => handleCardClick("completed")}
        />
        <StatCard
          label="Pending"
          value={pendingPct.main}
          subValue={pendingPct.sub}
          accent="amber"
          className={cn("cursor-pointer active:opacity-80 transition-all", expandedCard === "pending" && "ring-2 ring-amber-500")}
          onClick={() => handleCardClick("pending")}
        />
        <StatCard
          label="Approvals"
          value={pendingReviewPct.main}
          subValue={pendingReviewPct.sub}
          accent="purple"
          valueAccent
          className={cn("cursor-pointer active:opacity-80 transition-all", expandedCard === "pendingReview" && "ring-2 ring-purple-500")}
          onClick={() => handleCardClick("pendingReview")}
        />
        <StatCard
          label="Overdue"
          value={overduePct.main}
          subValue={overduePct.sub}
          accent="red"
          valueAccent
          className={cn("cursor-pointer active:opacity-80 transition-all", expandedCard === "overdue" && "ring-2 ring-red-500")}
          onClick={() => handleCardClick("overdue")}
        />
      </section>

      {/* Inline expanded card task list (not for pendingReview — that uses the approvals section below) */}
      {expandedCard && expandedCard !== "pendingReview" && (
        <section>
          <h2 className="text-sm font-semibold mb-2 px-1">{expandedCardTitle}</h2>
          {tasksLoading ? (
            <p className="text-sm text-muted-foreground px-4 py-4">Loading...</p>
          ) : (
            renderTaskList(expandedCardTasks)
          )}
        </section>
      )}

      {/* Pending Approvals — shown inline when "Pending review" card is expanded */}
      {expandedCard === "pendingReview" && (
        <>
          {/* Due date change requests */}
          {approvals.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-amber-600 mb-2 px-1 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                Due Date Requests ({approvals.length})
              </h2>
              <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                {approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="border-l-4 border-l-amber-400 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-left font-medium text-base">
                          {approval.task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested by {approval.requestedBy.name}
                          {approval.task.assignee && (
                            <> · Assignee: {approval.task.assignee.name}</>
                          )}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            {approval.oldDueDate
                              ? format(new Date(approval.oldDueDate), "MMM d, yyyy")
                              : "No date"}
                          </span>
                          {" → "}
                          <span className="font-medium text-primary">
                            {approval.newDueDate
                              ? format(new Date(approval.newDueDate), "MMM d, yyyy")
                              : "No date"}
                          </span>
                        </p>
                        {approval.reason && (
                          <div className="rounded bg-muted/50 px-2 py-1.5 mt-1">
                            <p className="text-xs font-medium text-muted-foreground">Reason</p>
                            <p className="text-sm mt-0.5 whitespace-pre-wrap">{approval.reason}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            approveMutation.mutateAsync({ id: approval.id, status: "APPROVED" })
                          }
                          disabled={approveMutation.isPending}
                          className="gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            approveMutation.mutateAsync({ id: approval.id, status: "REJECTED" })
                          }
                          disabled={approveMutation.isPending}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Swipeable review tasks */}
          {visibleReviewTasks.length > 0 && (
            <section>
              <p className="text-xs text-muted-foreground mb-2 px-1">
                Swipe right to rate
              </p>
              <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                {visibleReviewTasks.map((task) => (
                  <div key={task.id} className={getTaskCardClass(task)}>
                    <SwipeableReviewRow
                      onReview={() => !exitingTask && canMarkComplete(task) && setTaskToComplete(task)}
                    >
                      <TaskRow
                        task={task}
                        onClick={() => setDetailTaskId(task.id)}
                        showAssignee
                        showProject
                        warningCount={taskWarningCountMap[task.id] ?? 0}
                        extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                        activityCount={task.unseenActivityCount ?? 0}
                        isAssignee={false}
                        canMarkComplete={false}
                        showCompletionRating={false}
                        showStrikethrough={false}
                        exitAnimation={exitingTask?.id === task.id}
                        onExitAnimationEnd={() => exitingTask?.id === task.id && setExitingTask(null)}
                      />
                    </SwipeableReviewRow>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
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
        onSuccess={(task) => {
          setTaskToComplete(null)
          if (task) setExitingTask(task)
        }}
      />
    </div>
  )
}
