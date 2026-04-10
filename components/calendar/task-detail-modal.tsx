"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Check, Clock, User, FolderOpen, Trash2, CalendarClock, MoreVertical, ShieldAlert, Star as StarIcon } from "lucide-react"
import { PriorityIcon } from "@/components/tasks/priority-icon"
import { format } from "date-fns"
import {
  useTask,
  useTaskComments,
  useCreateTaskComment,
  useTaskActivity,
  useUpdateTask,
  useDeleteTask,
  useMarkTaskSeen,
  useAssignableUsers,
  type Task,
  type UpdateTaskInput,
} from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getAvatarColor } from "@/lib/avatar-colors"
import { CompletionFeedback } from "@/components/tasks/completion-feedback"
import { MarkCompleteDrawer } from "@/components/tasks/mark-complete-drawer"
import { IssueWarningDialog } from "@/components/tasks/issue-warning-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,

} from "@/components/ui/alert-dialog"

interface TaskDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "EMPLOYEE_DONE", label: "Done (pending review)" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const


const PRIORITY_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const

const PRIORITY_LABELS: Record<string, string> = {
  GENERAL: "General",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

const ACTIVITY_LABELS: Record<string, string> = {
  TITLE_CHANGED: "Title changed",
  DUE_DATE_CHANGED: "Due date changed",
  PRIORITY_CHANGED: "Priority changed",
  STATUS_CHANGED: "Status changed",
  PROJECT_CHANGED: "Project changed",
}

const ACTIVITY_COLORS: Record<string, { border: string; bg: string; icon: string }> = {
  TITLE_CHANGED: { border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50/60 dark:bg-blue-950/30", icon: "text-blue-600 dark:text-blue-400" },
  DUE_DATE_CHANGED: { border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-50/60 dark:bg-purple-950/30", icon: "text-purple-600 dark:text-purple-400" },
  PRIORITY_CHANGED: { border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50/60 dark:bg-orange-950/30", icon: "text-orange-600 dark:text-orange-400" },
  STATUS_CHANGED: { border: "border-emerald-200 dark:border-emerald-800", bg: "bg-emerald-50/60 dark:bg-emerald-950/30", icon: "text-emerald-600 dark:text-emerald-400" },
  PROJECT_CHANGED: { border: "border-violet-200 dark:border-violet-800", bg: "bg-violet-50/60 dark:bg-violet-950/30", icon: "text-violet-600 dark:text-violet-400" },
}

function formatActivityDetails(action: string, details: string | null): string {
  if (!details) return ""
  if (action === "DUE_DATE_CHANGED") {
    return details
      .split(/\s*→\s*/)
      .map((part) => {
        const trimmed = part.trim()
        if (trimmed === "None" || !trimmed) return trimmed
        const d = new Date(trimmed)
        return isNaN(d.getTime()) ? trimmed : format(d, "MMM d, yyyy")
      })
      .join(" → ")
  }
  return details
}

function TaskDetailContent({
  taskId,
  onClose,
}: {
  taskId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: task, isLoading } = useTask(taskId)
  const { data: comments = [], refetch: refetchComments } = useTaskComments(taskId)
  const createComment = useCreateTaskComment(taskId)
  const { data: activity = [], refetch: refetchActivity } = useTaskActivity(taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const markSeen = useMarkTaskSeen()
  const { data: assignableUsers = [] } = useAssignableUsers()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [commentText, setCommentText] = useState("")
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [statusValue, setStatusValue] = useState<string>("")
  const [priorityValue, setPriorityValue] = useState<string>("")
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null)
  const [pendingDueDate, setPendingDueDate] = useState<Date | null>(null)
  const [dueDateChangeReason, setDueDateChangeReason] = useState("")
  const [showCompletionFeedbackModal, setShowCompletionFeedbackModal] = useState(false)
  const [hasShownCompletionModal, setHasShownCompletionModal] = useState(false)
  const [issueWarningOpen, setIssueWarningOpen] = useState(false)
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)
  const [statusSheetOpen, setStatusSheetOpen] = useState(false)
  const [prioritySheetOpen, setPrioritySheetOpen] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [assigneeSheetOpen, setAssigneeSheetOpen] = useState(false)

  const canEditDueDateDirectly =
    !!task &&
    !!user &&
    (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)
  const canReviewTask = canEditDueDateDirectly
  const [markCompleteDrawerOpen, setMarkCompleteDrawerOpen] = useState(false)

  useEffect(() => {
    if (task && user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)) {
      markSeen.mutate(taskId)
    }
  }, [task?.id, taskId, user?.id, user?.role])

  useEffect(() => {
    setHasShownCompletionModal(false)
  }, [taskId])

  useEffect(() => {
    if (task) {
      setTitleValue(task.title)
      setStatusValue(task.status)
      setPriorityValue(task.priority)
      setDueDateValue(task.dueDate ? new Date(task.dueDate) : null)
      if (
        user &&
        task.assigneeId === user.id &&
        task.status === "COMPLETED" &&
        task.grade &&
        !hasShownCompletionModal
      ) {
        setShowCompletionFeedbackModal(true)
        setHasShownCompletionModal(true)
      }
    }
  }, [task, user, hasShownCompletionModal])

  const handleAddComment = async () => {
    const trimmed = commentText.trim()
    if (!trimmed) return
    try {
      await createComment.mutateAsync({ content: trimmed })
      setCommentText("")
      refetchComments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment")
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    const isMdSelf = user?.role === "MD" && task.assigneeId === user?.id
    if (newStatus === "COMPLETED" && canReviewTask && !isMdSelf) {
      setMarkCompleteDrawerOpen(true)
      return
    }
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: { status: newStatus as UpdateTaskInput["status"] },
      })
      setStatusValue(newStatus)
      refetchActivity()
    } catch {
      toast.error("Failed to update status")
    }
  }

  const handleSaveTitle = async () => {
    if (!task || titleValue.trim() === task.title) {
      setEditingTitle(false)
      return
    }
    try {
      await updateTask.mutateAsync({ id: task.id, data: { title: titleValue.trim() } })
      setEditingTitle(false)
      refetchActivity()
    } catch {
      toast.error("Failed to update title")
    }
  }

  const handlePriorityChange = async (newPriority: string) => {
    if (!task || newPriority === task.priority) return
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: { priority: newPriority as UpdateTaskInput["priority"] },
      })
      setPriorityValue(newPriority)
      refetchActivity()
    } catch {
      toast.error("Failed to update priority")
    }
  }

  const handleDueDateChange = async (newDate: Date | null) => {
    if (!task) return
    const currentDue = task.dueDate ? new Date(task.dueDate).toISOString() : null
    const newDue = newDate ? newDate.toISOString() : null
    if (currentDue === newDue) return
    if (canEditDueDateDirectly) {
      try {
        await updateTask.mutateAsync({
          id: task.id,
          data: { dueDate: newDue },
        })
        setDueDateValue(newDate)
        refetchActivity()
      } catch {
        toast.error("Failed to update due date")
      }
      return
    }
    setPendingDueDate(newDate)
    setDueDateChangeReason("")
  }

  const handleRequestDueDateChange = async () => {
    if (!task || !pendingDueDate || !dueDateChangeReason.trim()) return
    try {
      const result = await updateTask.mutateAsync({
        id: task.id,
        data: {
          dueDate: pendingDueDate.toISOString(),
          dueDateChangeReason: dueDateChangeReason.trim(),
        },
      }) as { message?: string; approvalId?: string }
      if (result?.message && result?.approvalId) {
        toast.success("Due date change requested. Waiting for approval.")
        setPendingDueDate(null)
        setDueDateChangeReason("")
        queryClient.invalidateQueries({ queryKey: ["task-approvals"] })
      } else {
        setDueDateValue(pendingDueDate)
        setPendingDueDate(null)
        setDueDateChangeReason("")
        refetchActivity()
      }
    } catch {
      toast.error("Failed to submit request")
    }
  }

  if (isLoading || !task) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const isAssignee = task.assigneeId === user?.id
  const showStatusDropdown =
    isAssignee &&
    (task.status === "PENDING" || task.status === "IN_PROGRESS" || task.status === "EMPLOYEE_DONE")
  const statusBadgeClass = {
    PENDING: "border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    IN_PROGRESS: "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    EMPLOYEE_DONE: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    COMPLETED: "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
    CANCELLED: "border-muted bg-muted/50 text-muted-foreground",
  }[task.status] ?? "border-muted bg-muted/50"

  const detailsBlock = (
    <>
      {/* Row 1: Due date + Assignee */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <button
          type="button"
          onClick={() => setDateSheetOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:opacity-70 transition-opacity"
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
          {dueDateValue ? format(dueDateValue, "MMM d, yyyy") : "Set due date"}
        </button>
        {task.assignee && (
          <>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setAssigneeSheetOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:opacity-70 transition-opacity"
            >
              <User className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              {task.assignee.name}
            </button>
          </>
        )}
      </div>
      {/* Row 2: Status + Priority + Project */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <button
          type="button"
          onClick={() => showStatusDropdown && setStatusSheetOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm font-medium transition-colors",
            showStatusDropdown && "cursor-pointer hover:opacity-80",
            !showStatusDropdown && "cursor-default",
            statusValue === "IN_PROGRESS" && "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
            statusValue === "EMPLOYEE_DONE" && "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
            statusValue === "COMPLETED" && "border-emerald-500 bg-emerald-50 text-emerald-700 dark:text-emerald-300",
            statusValue === "PENDING" && "border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
            statusValue === "CANCELLED" && "border-muted bg-muted/50 text-muted-foreground"
          )}
        >
          {STATUS_OPTIONS.find((o) => o.value === statusValue)?.label ?? statusValue}
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={() => setPrioritySheetOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity cursor-pointer hover:opacity-70"
        >
          <PriorityIcon
            priority={priorityValue}
            className={cn(
              "h-4 w-4 shrink-0",
              priorityValue === "HIGH" && "text-orange-600 dark:text-orange-400",
              priorityValue === "URGENT" && "text-red-600 dark:text-red-400",
              priorityValue === "MEDIUM" && "text-amber-600 dark:text-amber-400",
              priorityValue === "LOW" && "text-blue-600 dark:text-blue-400",
              (priorityValue === "GENERAL" || !priorityValue) && "text-muted-foreground"
            )}
          />
          {PRIORITY_OPTIONS.find((o) => o.value === priorityValue)?.label ?? "Priority"}
        </button>
        {task.project && (
          <>
            <span className="text-muted-foreground">·</span>
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-purple-700 dark:text-purple-300">{task.project.name}</span>
            </div>
          </>
        )}
      </div>
      {/* Row 3: Created by + Updated */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {task.createdBy && (
          <span>Created by {task.createdBy.name}</span>
        )}
        {task.createdBy && <span>·</span>}
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Updated {format(new Date(task.updatedAt), "MMM d")}</span>
        </div>
      </div>
      {task.status === "COMPLETED" && task.grade && (
        <CompletionFeedback
          grade={task.grade}
          comments={task.completionComments}
          completedBy={task.completedBy}
          completedAt={task.completedAt}
        />
      )}
    </>
  )

  return (
    <div className="flex flex-col md:flex-row md:min-h-0 h-full">
      <div className="flex-1 min-w-0 flex flex-col border-b md:border-b-0 md:border-r border-border">
        <div className="p-4 md:p-4 space-y-4 shrink-0">
          <div className="flex items-start gap-2">
            {editingTitle ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-lg md:text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <h2
                  className="flex-1 text-xl md:text-lg font-semibold cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 -mx-1 min-w-0"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.title}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setActionsSheetOpen(true)}
                  aria-label="Actions"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
          {task.description && (
            <p className="text-base md:text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        <div className="px-4 pb-4 space-y-4 shrink-0 border-b border-border">
          {detailsBlock}
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-4">
          <h3 className="text-base md:text-sm font-semibold mb-3 text-foreground">Comments</h3>
          <ScrollArea className="flex-1 min-h-[120px] max-h-[240px] pr-2">
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-base md:text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                (() => {
                  const topLevel = comments.filter((c) => !c.parentId)
                  return topLevel.map((c) => (
                    <div key={c.id} className="space-y-2 rounded-lg bg-muted/30 p-3">
                      <div className="flex gap-3">
                        <div className={cn("shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium", getAvatarColor(c.user.name).bg, getAvatarColor(c.user.name).text)}>
                          {c.user.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm md:text-xs text-muted-foreground">
                            {c.user.name} · {format(new Date(c.createdAt), "EEE, MMM d · h:mm a")}
                          </p>
                          <p className="text-base md:text-sm mt-1 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                      {(c.replies?.length ?? 0) > 0 && (
                        <div className="pl-11 space-y-2 border-l-2 border-blue-200 dark:border-blue-800 ml-1">
                          {c.replies?.map((r) => (
                            <div key={r.id} className="flex gap-2 py-1 pl-2">
                              <div className={cn("shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium", getAvatarColor(r.user.name).bg, getAvatarColor(r.user.name).text)}>
                                {r.user.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm md:text-xs text-muted-foreground">
                                  {r.user.name} · {format(new Date(r.createdAt), "EEE, MMM d · h:mm a")}
                                </p>
                                <p className="text-base md:text-sm mt-0.5 whitespace-pre-wrap">{r.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                })()
              )}
            </div>
          </ScrollArea>
          <div className="mt-3 shrink-0 relative">
            <Textarea
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
              className="min-h-[56px] md:min-h-[48px] resize-none pr-16 text-base md:text-sm bg-muted/20 border-border"
              rows={2}
            />
            <Button
              size="sm"
              className="absolute right-2 bottom-2 h-8 text-xs"
              onClick={handleAddComment}
              disabled={!commentText.trim() || createComment.isPending}
            >
              Send
            </Button>
          </div>
        </div>
      </div>

      <div className="md:w-72 shrink-0 flex flex-col min-h-0 overflow-y-auto p-4 gap-4 bg-white/60 dark:bg-muted/30 border-l border-border">

        {/* Activity */}
        <div className="space-y-2">
          <h3 className="text-base md:text-sm font-semibold text-foreground">Activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm md:text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm md:text-xs">
              {activity.map((a) => {
                const colors = ACTIVITY_COLORS[a.action] ?? { border: "border-border", bg: "bg-background/50", icon: "text-muted-foreground" }
                return (
                  <li key={a.id} className={cn("flex flex-col gap-0.5 rounded-md border-l-2 px-2.5 py-1.5", colors.border, colors.bg)}>
                    <span className={cn("font-semibold", colors.icon)}>
                      {ACTIVITY_LABELS[a.action] ?? a.action}
                    </span>
                    <span className="text-foreground/80">
                      {a.user.name}
                      {a.details ? ` · ${formatActivityDetails(a.action, a.details)}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(a.createdAt), "EEE, MMM d · h:mm a")}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Date Extensions */}
        {(task.approvals?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-base md:text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              Date Extensions
            </h3>
            <ul className="space-y-2 text-sm md:text-xs">
              {task.approvals!.map((a) => {
                const statusColors =
                  a.status === "APPROVED"
                    ? { border: "border-emerald-200 dark:border-emerald-800", bg: "bg-emerald-50/60 dark:bg-emerald-950/30", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400" }
                    : a.status === "REJECTED"
                      ? { border: "border-red-200 dark:border-red-800", bg: "bg-red-50/60 dark:bg-red-950/30", badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400" }
                      : { border: "border-amber-200 dark:border-amber-800", bg: "bg-amber-50/60 dark:bg-amber-950/30", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-400" }
                const oldStr = a.oldDueDate ? format(new Date(a.oldDueDate), "MMM d") : "—"
                const newStr = a.newDueDate ? format(new Date(a.newDueDate), "MMM d") : "—"
                return (
                  <li key={a.id} className={cn("flex flex-col gap-1 rounded-md border-l-2 px-2.5 py-1.5", statusColors.border, statusColors.bg)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{a.requestedBy.name}</span>
                      <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", statusColors.badge)}>
                        {a.status}
                      </Badge>
                    </div>
                    <span className="text-foreground/80">
                      {oldStr} → {newStr}
                    </span>
                    {a.reason && <span className="text-muted-foreground italic">{a.reason}</span>}
                    <span className="text-muted-foreground">
                      {format(new Date(a.createdAt), "EEE, MMM d · h:mm a")}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Hidden portal components */}
        <MarkCompleteDrawer
          task={task.status === "EMPLOYEE_DONE" ? task : null}
          open={markCompleteDrawerOpen}
          onOpenChange={setMarkCompleteDrawerOpen}
          onSuccess={() => {
            setStatusValue("COMPLETED")
            refetchActivity()
          }}
        />

        <IssueWarningDialog
          open={issueWarningOpen}
          onOpenChange={setIssueWarningOpen}
          employeeId={task.assigneeId}
          employeeName={task.assignee?.name}
          taskId={task.id}
          taskTitle={task.title}
        />

        <Dialog open={showCompletionFeedbackModal} onOpenChange={setShowCompletionFeedbackModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Task completed</DialogTitle>
            </DialogHeader>
            {task && task.grade && (
              <CompletionFeedback
                grade={task.grade}
                comments={task.completionComments}
                completedBy={task.completedBy}
                completedAt={task.completedAt}
              />
            )}
            <Button onClick={() => setShowCompletionFeedbackModal(false)}>Close</Button>
          </DialogContent>
        </Dialog>

      </div>

      {/* Actions Sheet — accessible via 3-dot menu */}
      <Sheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-card">
          <SheetHeader className="text-left">
            <SheetTitle>Actions</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 pt-2 pb-4">
            {task.status === "EMPLOYEE_DONE" && canReviewTask && (
              <button
                type="button"
                onClick={() => {
                  setActionsSheetOpen(false)
                  setMarkCompleteDrawerOpen(true)
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <StarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-medium">Review & Complete Task</span>
              </button>
            )}
            {canReviewTask && task.assigneeId && (
              <button
                type="button"
                onClick={() => {
                  setActionsSheetOpen(false)
                  setIssueWarningOpen(true)
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/40">
                  <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="font-medium">Issue Warning</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActionsSheetOpen(false)
                setDeleteDialogOpen(true)
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="font-medium text-destructive">Delete Task</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{task?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault()
                if (!task) return
                try {
                  await deleteTask.mutateAsync(task.id)
                  toast.success("Task deleted")
                  setDeleteDialogOpen(false)
                  onClose()
                } catch {
                  toast.error("Failed to delete task")
                }
              }}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status picker sheet */}
      <Sheet open={statusSheetOpen} onOpenChange={setStatusSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-card">
          <SheetHeader className="text-left">
            <SheetTitle>Change Status</SheetTitle>
          </SheetHeader>
          <div className="py-2 space-y-1">
            {(user?.role === "MD" && isAssignee
              ? [
                  { value: "PENDING", label: "Pending", color: "text-slate-700" },
                  { value: "IN_PROGRESS", label: "In Progress", color: "text-blue-700" },
                  { value: "COMPLETED", label: "Completed", color: "text-emerald-700" },
                ]
              : [
                  { value: "PENDING", label: "Pending", color: "text-slate-700" },
                  { value: "IN_PROGRESS", label: "In Progress", color: "text-blue-700" },
                  { value: "EMPLOYEE_DONE", label: "Done (pending review)", color: "text-amber-700" },
                ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  handleStatusChange(opt.value)
                  setStatusSheetOpen(false)
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50",
                  opt.color,
                  statusValue === opt.value && "bg-muted/40"
                )}
              >
                {opt.label}
                {statusValue === opt.value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Priority picker sheet */}
      <Sheet open={prioritySheetOpen} onOpenChange={setPrioritySheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-card">
          <SheetHeader className="text-left">
            <SheetTitle>Set Priority</SheetTitle>
          </SheetHeader>
          <div className="py-2 space-y-1">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  handlePriorityChange(opt.value)
                  setPrioritySheetOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50",
                  priorityValue === opt.value && "bg-muted/40"
                )}
              >
                <PriorityIcon
                  priority={opt.value}
                  className={cn(
                    "h-4 w-4 shrink-0",
                    opt.value === "HIGH" && "text-orange-600",
                    opt.value === "URGENT" && "text-red-600",
                    opt.value === "MEDIUM" && "text-amber-600",
                    opt.value === "LOW" && "text-blue-600",
                    opt.value === "GENERAL" && "text-muted-foreground"
                  )}
                />
                <span className="flex-1">{opt.label}</span>
                {priorityValue === opt.value && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Date picker sheet */}
      <Sheet open={dateSheetOpen} onOpenChange={setDateSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-card">
          <SheetHeader className="text-left">
            <SheetTitle>Due Date</SheetTitle>
          </SheetHeader>
          <div className="py-2 flex flex-col items-center">
            <Calendar
              mode="single"
              selected={(pendingDueDate ?? dueDateValue) ?? undefined}
              onSelect={(d) => {
                const date = d ?? null
                if (canEditDueDateDirectly) {
                  handleDueDateChange(date)
                  setDateSheetOpen(false)
                } else {
                  setPendingDueDate(date)
                  if (!date) setDueDateChangeReason("")
                }
              }}
              initialFocus
            />
            {(dueDateValue || pendingDueDate) && canEditDueDateDirectly && (
              <button
                type="button"
                className="mt-2 text-sm text-destructive hover:underline"
                onClick={() => { handleDueDateChange(null); setDateSheetOpen(false) }}
              >
                Clear date
              </button>
            )}
            {pendingDueDate != null && !canEditDueDateDirectly && (
              <div className="w-full mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium">Request due date change</p>
                <p className="text-xs text-muted-foreground">
                  New date: {format(pendingDueDate, "MMM d, yyyy")}. Reason is required.
                </p>
                <Textarea
                  placeholder="Reason for change (required)"
                  value={dueDateChangeReason}
                  onChange={(e) => setDueDateChangeReason(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { handleRequestDueDateChange(); setDateSheetOpen(false) }}
                    disabled={!dueDateChangeReason.trim() || updateTask.isPending}
                  >
                    Request change
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPendingDueDate(null); setDueDateChangeReason(""); setDateSheetOpen(false) }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Assignee picker sheet */}
      <Sheet open={assigneeSheetOpen} onOpenChange={setAssigneeSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-card max-h-[60vh]">
          <SheetHeader className="text-left">
            <SheetTitle>Assign To</SheetTitle>
          </SheetHeader>
          <ScrollArea className="py-2 max-h-[40vh]">
            <div className="space-y-1">
              {assignableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={async () => {
                    if (u.id === task.assigneeId) { setAssigneeSheetOpen(false); return }
                    try {
                      await updateTask.mutateAsync({ id: task.id, data: { assigneeId: u.id } })
                      setAssigneeSheetOpen(false)
                    } catch {
                      toast.error("Failed to reassign task")
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50",
                    task.assigneeId === u.id && "bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{u.name}</span>
                  </div>
                  {task.assigneeId === u.id && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function TaskDetailModal({ open, onOpenChange, taskId }: TaskDetailModalProps) {
  const isMobile = useIsMobile()

  if (!taskId) return null

  const content = (
    <TaskDetailContent
      taskId={taskId}
      onClose={() => onOpenChange(false)}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-full sm:max-w-full p-0 flex flex-col bg-white dark:bg-card"
        >
          <SheetHeader className="p-4 shrink-0 border-0">
            <SheetTitle className="sr-only">Task details</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] min-h-[80vh] max-h-[90vh] flex flex-col p-0 gap-0 bg-white dark:bg-card">
        <DialogHeader className="p-4 shrink-0 border-b-0">
          <DialogTitle className="sr-only">Task details</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  )
}
