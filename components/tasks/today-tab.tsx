"use client"

import { useMemo, useState } from "react"
import { startOfDay, isBefore, isSameDay, format } from "date-fns"
import { useTasks, useWarnings } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { TaskRow } from "./task-row"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import type { Task } from "@/hooks/use-tasks"

function getTaskDueDate(task: Task): Date | null {
  if (!task.dueDate) return null
  return startOfDay(new Date(task.dueDate))
}

export function TodayTab() {
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
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const sections = useMemo(() => {
    const now = new Date()
    const startToday = startOfDay(now)

    const activeTasks = tasks.filter(
      (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
    )

    const byDate = new Map<string, Task[]>()
    const overdue: Task[] = []
    const noDate: Task[] = []

    for (const task of activeTasks) {
      const due = getTaskDueDate(task)
      if (!due) {
        noDate.push(task)
        continue
      }
      if (isBefore(due, startToday)) {
        overdue.push(task)
      } else {
        const key = due.toISOString()
        if (!byDate.has(key)) byDate.set(key, [])
        byDate.get(key)!.push(task)
      }
    }

    overdue.sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    )

    const sortedDates = Array.from(byDate.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    )
    for (const key of sortedDates) {
      byDate.get(key)!.sort(
        (a, b) =>
          (a.dueDate ? new Date(a.dueDate).getTime() : 0) -
          (b.dueDate ? new Date(b.dueDate).getTime() : 0)
      )
    }

    return { overdue, byDate, sortedDates, noDate }
  }, [tasks])

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading tasks...
      </div>
    )
  }

  const hasAny =
    sections.overdue.length > 0 ||
    sections.sortedDates.length > 0 ||
    sections.noDate.length > 0

  const renderTask = (task: Task) => (
    <TaskRow
      key={task.id}
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
  )

  return (
    <div className="space-y-6">
      {sections.overdue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-600 mb-2">
            Overdue ({sections.overdue.length})
          </h2>
          <div className="space-y-2">
            {sections.overdue.map(renderTask)}
          </div>
        </section>
      )}

      {sections.sortedDates.map((dateKey) => {
        const date = new Date(dateKey)
        const dayTasks = sections.byDate.get(dateKey)!
        const isToday = isSameDay(date, new Date())
        const heading = isToday
          ? `Today · ${format(date, "d MMM")}`
          : format(date, "d MMM")
        return (
          <section key={dateKey}>
            <h2 className="text-sm font-semibold text-foreground mb-2">
              {heading} ({dayTasks.length})
            </h2>
            <div className="space-y-2">
              {dayTasks.map(renderTask)}
            </div>
          </section>
        )
      })}

      {sections.noDate.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            No date ({sections.noDate.length})
          </h2>
          <div className="space-y-2">
            {sections.noDate.map(renderTask)}
          </div>
        </section>
      )}

      {!hasAny && (
        <p className="text-sm text-muted-foreground py-4">
          No tasks. Add one above.
        </p>
      )}

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
