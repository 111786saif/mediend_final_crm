"use client"

import { useMemo, useState } from "react"
import { startOfDay, isBefore } from "date-fns"
import { useTasks, useWarnings } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { TaskRow } from "./task-row"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { getTaskCardClass } from "./task-card-class"
import type { Task } from "@/hooks/use-tasks"

export function MyTasksTab() {
  const { user } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: allWarnings = [] } = useWarnings()
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)

  const taskWarningCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of allWarnings) {
      if (w.taskId) map[w.taskId] = (map[w.taskId] ?? 0) + 1
    }
    return map
  }, [allWarnings])

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const today = useMemo(() => startOfDay(new Date()), [])

  const myTasks = useMemo(() => {
    if (!user) return []
    return tasks.filter(
      (t) =>
        t.assigneeId === user.id &&
        t.status !== "COMPLETED" &&
        t.status !== "CANCELLED"
    )
  }, [tasks, user])

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading tasks...
      </div>
    )
  }

  if (myTasks.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No tasks assigned to you.
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
        {myTasks.map((task) => {
          const isOverdue =
            !!task.dueDate &&
            isBefore(new Date(task.dueDate), today) &&
            task.status !== "EMPLOYEE_DONE"
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
                isAssignee
                canMarkComplete={canMarkComplete(task)}
                onMarkCompleteRequest={() => setTaskToComplete(task)}
              />
            </div>
          )
        })}
      </div>

      <TaskDetailModal
        open={!!detailTaskId}
        onOpenChange={(open) => { if (!open) setDetailTaskId(null) }}
        taskId={detailTaskId}
      />
      <MarkCompleteDrawer
        task={taskToComplete}
        open={!!taskToComplete}
        onOpenChange={(open) => { if (!open) setTaskToComplete(null) }}
      />
    </div>
  )
}
