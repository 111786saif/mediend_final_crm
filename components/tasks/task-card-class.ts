import { cn } from "@/lib/utils"

export interface TaskLike {
  priority?: string | null
  status?: string
}

/**
 * Returns Tailwind classes for a task card wrapper (left accent border, clean white bg).
 * Use for All tasks, Completed, Team member detail, and Calendar list.
 */
export function getTaskCardClass(
  task: TaskLike,
  opts?: { isOverdue?: boolean; forCompletedSection?: boolean }
): string {
  const base = "border-l-4 overflow-hidden"
  const isOverdue = opts?.isOverdue ?? false

  if (task.status === "COMPLETED") {
    return cn(base, "border-l-emerald-600")
  }

  if (task.status === "EMPLOYEE_DONE") {
    return cn(base, "border-l-green-400 dark:border-l-green-500")
  }

  const priorityBorder: Record<string, string> = {
    URGENT: "border-l-red-500",
    HIGH: "border-l-orange-500",
    MEDIUM: "border-l-amber-400",
    LOW: "border-l-blue-400",
    GENERAL: "border-l-slate-300 dark:border-l-slate-600",
  }
  const priority = task.priority ?? "GENERAL"
  const priorityClass = priorityBorder[priority] ?? priorityBorder.GENERAL

  if (isOverdue) {
    return cn(base, "border-l-red-500 bg-red-50/40 dark:bg-red-950/20")
  }

  return cn(base, priorityClass)
}
