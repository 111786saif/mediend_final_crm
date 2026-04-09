"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PriorityIcon } from "./priority-icon"
import { format, differenceInDays } from "date-fns"
import { type Task } from "@/hooks/use-tasks"
import { useUpdateTask } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { isSelfAssigned } from "@/lib/task-utils"
import { getAvatarColor } from "@/lib/avatar-colors"
import { AlertTriangle, CalendarClock, Clock } from "lucide-react"

const PRIORITY_COLORS: Record<string, string> = {
  GENERAL: "text-muted-foreground",
  LOW: "text-blue-600",
  MEDIUM: "text-amber-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600",
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

interface TaskRowProps {
  task: Task
  onClick?: () => void
  showAssignee?: boolean
  showProject?: boolean
  isAssignee?: boolean
  canMarkComplete?: boolean
  onMarkCompleteRequest?: (task: Task) => void
  showCompletionRating?: boolean
  warningCount?: number
  extensionCount?: number
  activityCount?: number
  showStrikethrough?: boolean
  exitAnimation?: boolean
  onExitAnimationEnd?: () => void
  className?: string
}

export function TaskRow({
  task,
  onClick,
  showAssignee = true,
  showProject = true,
  isAssignee = false,
  canMarkComplete = true,
  onMarkCompleteRequest,
  showCompletionRating = false,
  warningCount = 0,
  extensionCount = 0,
  activityCount = 0,
  className,
}: TaskRowProps) {
  const { user } = useAuth()
  const updateMutation = useUpdateTask()
  const isCompleted = task.status === "COMPLETED"
  const isEmployeeDone = task.status === "EMPLOYEE_DONE"
  const isDone = isCompleted || isEmployeeDone

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCompleted && canMarkComplete) {
      try {
        await updateMutation.mutateAsync({
          id: task.id,
          data: { status: "PENDING" },
        })
      } catch {}
      return
    }
    if (isEmployeeDone && canMarkComplete && onMarkCompleteRequest) {
      onMarkCompleteRequest(task)
      return
    }
    if ((task.status === "PENDING" || task.status === "IN_PROGRESS") && isAssignee) {
      try {
        await updateMutation.mutateAsync({
          id: task.id,
          data: { status: "EMPLOYEE_DONE" },
        })
      } catch {}
    }
  }

  const showCheckbox =
    (isAssignee && (task.status === "PENDING" || task.status === "IN_PROGRESS")) ||
    (canMarkComplete && (isEmployeeDone || isCompleted))

  const now = new Date()
  const isOverdue = !!task.dueDate && new Date(task.dueDate) < now && !isDone

  const dueLabel = task.dueDate
    ? format(new Date(task.dueDate), "MMM d")
    : null

  const givenLabel = task.createdAt
    ? format(new Date(task.createdAt), "MMM d, h:mm a")
    : null

  const daysGiven =
    task.dueDate && task.createdAt
      ? differenceInDays(new Date(task.dueDate), new Date(task.createdAt))
      : null

  // Determine who to show as avatar
  const avatarUser = task.assignee ?? task.createdBy
  const avatarName = avatarUser?.name ?? "?"
  const ac = getAvatarColor(avatarName)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        className
      )}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => {}}
          onClick={handleToggleComplete}
          aria-label={isCompleted ? "Mark incomplete" : isEmployeeDone ? "Review task" : "Mark done for review"}
          className="shrink-0"
        />
      )}

      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {avatarUser && 'profilePicture' in avatarUser && (avatarUser as any).profilePicture && (
          <AvatarImage src={(avatarUser as any).profilePicture} />
        )}
        <AvatarFallback className={cn(ac.bg, ac.text, "text-xs font-semibold")}>
          {getInitials(avatarName)}
        </AvatarFallback>
      </Avatar>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-base font-medium leading-snug line-clamp-2",
              isDone && "text-emerald-700 dark:text-emerald-400"
            )}
          >
            {task.title}
          </span>
          {activityCount > 0 && (
            <span
              className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground"
              title={`${activityCount} new activit${activityCount !== 1 ? "ies" : "y"}`}
            >
              {activityCount > 99 ? "99+" : activityCount}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
          {showAssignee && task.assignee && task.assigneeId !== task.createdById && (
            <span className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[120px]">
              → {task.assignee.name}
            </span>
          )}
          {showAssignee && isSelfAssigned(task) && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {user?.id === task.createdById ? "Self" : task.createdBy?.name ?? "—"}
            </span>
          )}
          {showProject && task.project && (
            <span className="text-xs text-purple-600 dark:text-purple-400 truncate max-w-[120px]">
              {task.project.name}
            </span>
          )}
          {givenLabel && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {givenLabel}
            </span>
          )}
          {daysGiven !== null && daysGiven > 0 && (
            <span className="text-xs text-muted-foreground">
              · {daysGiven}d
            </span>
          )}
        </div>
      </div>

      {/* Right side badges */}
      <div className="flex shrink-0 items-center gap-2">
        {extensionCount > 0 && (
          <span
            className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400"
            title={`${extensionCount} extension${extensionCount !== 1 ? "s" : ""}`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{extensionCount}</span>
          </span>
        )}
        {warningCount > 0 && (
          <span
            className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"
            title={`${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{warningCount}</span>
          </span>
        )}
        {task.priority && task.priority !== "GENERAL" && (
          <PriorityIcon
            priority={task.priority}
            className={cn("h-3.5 w-3.5", PRIORITY_COLORS[task.priority] ?? "text-muted-foreground")}
          />
        )}
        {dueLabel && (
          <span
            className={cn(
              "text-xs font-medium whitespace-nowrap",
              isOverdue ? "text-red-600" : "text-muted-foreground"
            )}
          >
            {dueLabel}
          </span>
        )}
      </div>
    </div>
  )
}
