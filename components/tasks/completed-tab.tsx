"use client"

import { useMemo, useState } from "react"
import { useTasks, useWarnings } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { TaskRow } from "./task-row"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { getTaskCardClass } from "./task-card-class"
import { format } from "date-fns"
import { CheckCircle } from "lucide-react"
import type { Task } from "@/hooks/use-tasks"

export function CompletedTab() {
  const { user } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: allWarnings = [] } = useWarnings()
  const taskWarningCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of allWarnings) {
      if (w.taskId) map[w.taskId] = (map[w.taskId] ?? 0) + 1
    }
    return map
  }, [allWarnings])
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const needsReviewTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "EMPLOYEE_DONE")
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  }, [tasks])

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "COMPLETED")
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  }, [tasks])

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  const hasAny = needsReviewTasks.length > 0 || completedTasks.length > 0

  if (!hasAny) {
    return (
      <div className="py-12 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No completed tasks yet. Complete tasks to see them here.
        </p>
        <TaskDetailModal
          open={!!detailTaskId}
          onOpenChange={(open) => !open && setDetailTaskId(null)}
          taskId={detailTaskId}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {needsReviewTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
            Needs review ({needsReviewTasks.length})
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Marked done by assignees. Tap to review and rate.
          </p>
          <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
            {needsReviewTasks.map((task) => (
              <div
                key={task.id}
                className={getTaskCardClass(task, { forCompletedSection: true })}
              >
                <div className="flex items-center gap-2">
                  <TaskRow
                    task={task}
                    onClick={() => setDetailTaskId(task.id)}
                    showAssignee
                    showProject
                    showCompletionRating={false}
                    showStrikethrough={false}
                    warningCount={taskWarningCountMap[task.id] ?? 0}
                    extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                    activityCount={task.unseenActivityCount ?? 0}
                    isAssignee={task.assigneeId === user?.id}
                    canMarkComplete={canMarkComplete(task)}
                  />
                  <span className="text-xs text-muted-foreground shrink-0 pr-2">
                    {format(new Date(task.updatedAt), "MMM d")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {completedTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            Completed ({completedTasks.length})
          </h2>
          <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className={getTaskCardClass(task, { forCompletedSection: true })}
              >
                <div className="flex items-center gap-2">
                  <TaskRow
                    task={task}
                    onClick={() => setDetailTaskId(task.id)}
                    showAssignee
                    showProject
                    showCompletionRating
                    warningCount={taskWarningCountMap[task.id] ?? 0}
                    extensionCount={task.pendingApprovalCount ?? task._count?.approvals ?? 0}
                    activityCount={task.unseenActivityCount ?? 0}
                    isAssignee={task.assigneeId === user?.id}
                    canMarkComplete={canMarkComplete(task)}
                  />
                  <span className="text-xs text-muted-foreground shrink-0 pr-2">
                    {format(new Date(task.updatedAt), "MMM d")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <TaskDetailModal
        open={!!detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
        taskId={detailTaskId}
      />
    </div>
  )
}
