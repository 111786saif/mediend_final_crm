"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { format } from "date-fns"
import { Check, X, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useTaskApprovals, useApproveTaskDueDate, useTasks, useWarnings, type Task } from "@/hooks/use-tasks"
import { TaskRow } from "./task-row"
import { getTaskCardClass } from "./task-card-class"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { cn } from "@/lib/utils"

export function SwipeableReviewRow({
  children,
  onReview,
}: {
  children: React.ReactNode
  onReview: () => void
}) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const offsetX = useRef(0)
  const [translateX, setTranslateX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const triggered = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    offsetX.current = translateX
    triggered.current = false
    setAnimating(false)
  }, [translateX])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > 40) return
    const newX = Math.max(0, Math.min(dx + offsetX.current, 120))
    setTranslateX(newX)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setAnimating(true)
    if (translateX > 80 && !triggered.current) {
      triggered.current = true
      setTranslateX(0)
      setTimeout(() => onReview(), 150)
    } else {
      setTranslateX(0)
    }
  }, [translateX, onReview])

  const threshold = 80
  const progress = Math.min(translateX / threshold, 1)

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center pl-5 bg-amber-500">
        <Star className={cn("h-5 w-5 text-white transition-transform", progress >= 1 ? "scale-125" : "scale-100")} />
        <span className={cn("ml-2 text-sm font-semibold text-white transition-opacity", progress >= 0.5 ? "opacity-100" : "opacity-0")}>Rate</span>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${translateX}px)` }}
        className={cn(
          "relative bg-white dark:bg-card",
          animating && "transition-transform duration-200 ease-out"
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ApprovalTab() {
  const { user } = useAuth()
  const { data: approvals = [], isLoading, isError } = useTaskApprovals()
  const { data: pendingReviewTasks = [], isLoading: loadingReview } = useTasks(
    { status: "EMPLOYEE_DONE" },
    { enabled: true }
  )
  const { data: allWarnings = [] } = useWarnings()
  const taskWarningCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of allWarnings) {
      if (w.taskId) map[w.taskId] = (map[w.taskId] ?? 0) + 1
    }
    return map
  }, [allWarnings])
  const approveMutation = useApproveTaskDueDate()
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)
  const [exitingTask, setExitingTask] = useState<Task | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  const canReviewTask = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const visibleReviewTasks = useMemo(() => {
    if (!exitingTask) return pendingReviewTasks
    if (pendingReviewTasks.some((t) => t.id === exitingTask.id)) return pendingReviewTasks
    return [exitingTask, ...pendingReviewTasks]
  }, [pendingReviewTasks, exitingTask])

  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Loading approvals…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        Failed to load due date change requests.
      </div>
    )
  }

  const hasApprovals = approvals.length > 0
  const hasPendingReview = pendingReviewTasks.length > 0
  const hasAny = hasApprovals || hasPendingReview

  return (
    <div className="space-y-6">
      {hasApprovals && (
        <section>
          <p className="text-sm text-muted-foreground mb-3">
            Approve or reject due date change requests from your team.
          </p>
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

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">
          Tasks approvals ({visibleReviewTasks.length})
          <span className="text-xs font-normal text-muted-foreground ml-2">Swipe right to rate</span>
        </h2>
        {loadingReview ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : visibleReviewTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {user?.role === "MD" || user?.role === "ADMIN" ? (
              "No tasks approvals."
            ) : (
              "Your manager will rate and approve tasks when you mark them as done."
            )}
          </p>
        ) : (
          <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
            {visibleReviewTasks.map((task) => (
              <div key={task.id} className={getTaskCardClass(task)}>
                <SwipeableReviewRow
                  onReview={() => !exitingTask && canReviewTask(task) && setTaskToComplete(task)}
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
        )}
      </section>

      {!hasAny && !loadingReview && (user?.role === "MD" || user?.role === "ADMIN") && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No pending due date change requests and no tasks pending review.
        </p>
      )}

      <MarkCompleteDrawer
        task={taskToComplete}
        open={!!taskToComplete}
        onOpenChange={(open) => !open && setTaskToComplete(null)}
        onSuccess={(task) => {
          setTaskToComplete(null)
          if (task) setExitingTask(task)
        }}
      />

      <TaskDetailModal
        taskId={detailTaskId}
        open={!!detailTaskId}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
      />
    </div>
  )
}
