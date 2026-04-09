"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, AlertTriangle, Star, ArrowUpRight, Crown, Users, FileText, CheckCircle2, Clock, MoreVertical, ClipboardList, ShieldAlert } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useTasks, useWarnings, useTaskApprovals } from "@/hooks/use-tasks"
import { useAuth } from "@/hooks/use-auth"
import { useIsMobile } from "@/hooks/use-mobile"
import { TaskRow } from "./task-row"
import { TaskInput } from "./task-input"
import { MobileTaskDrawer } from "./mobile-task-drawer"
import { TaskDetailModal } from "@/components/calendar/task-detail-modal"
import { MarkCompleteDrawer } from "./mark-complete-drawer"
import { IssueWarningDialog } from "./issue-warning-dialog"
import { WorkLogViewerDrawer } from "./work-log-viewer-drawer"
import { WarningsDrawer } from "./warnings-drawer"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { startOfDay, format, differenceInDays } from "date-fns"
import type { MDTeamOverviewMember } from "@/hooks/use-md-team"
import type { Task } from "@/hooks/use-tasks"
import { cn } from "@/lib/utils"
import { getAvatarColor } from "@/lib/avatar-colors"
import { apiGet, apiPatch } from "@/lib/api-client"
import { FEATURE_KEYS } from "@/lib/feature-keys"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type TabId = "active" | "completed" | "overdue"

/** Team member detail: red left border for overdue, amber for on-time */
function getTeamDetailTaskCardClass(isOverdue: boolean): string {
  const base = "border-l-4 overflow-hidden"
  return isOverdue
    ? cn(base, "border-l-red-500")
    : cn(base, "border-l-amber-400")
}

function getOverdueDays(task: Task, today: Date): number {
  if (!task.dueDate) return 0
  const due = new Date(task.dueDate)
  return Math.max(0, differenceInDays(today, due))
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || "?"
}

const STAR_COLOR: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-emerald-500",
  5: "text-emerald-600",
}

function getStarColor(rating: number): string {
  const rounded = Math.round(rating)
  return STAR_COLOR[Math.min(5, Math.max(1, rounded))] ?? "text-amber-500"
}

function RatingStars({ rating }: { rating: number }) {
  const color = getStarColor(rating)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            "h-4 w-4",
            s <= Math.round(rating) ? cn("fill-current", color) : "text-muted-foreground/20"
          )}
        />
      ))}
      <span className={cn("ml-1.5 text-sm font-semibold", color)}>{rating.toFixed(1)}</span>
    </div>
  )
}

export interface TeamMemberDetailContentProps {
  member: MDTeamOverviewMember
}

export function TeamMemberDetailContent({ member }: TeamMemberDetailContentProps) {
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [issueWarningOpen, setIssueWarningOpen] = useState(false)
  const [workLogDrawerOpen, setWorkLogDrawerOpen] = useState(false)
  const [warningsDrawerOpen, setWarningsDrawerOpen] = useState(false)
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("active")

  const canMarkComplete = (task: Task) =>
    !!user && (user.role === "MD" || user.role === "ADMIN" || task.createdById === user.id)

  const { data: tasks = [], isLoading, isError } = useTasks(
    { assigneeId: member.id },
    { enabled: !!member.id }
  )
  const { data: allWarnings = [] } = useWarnings()
  const { data: allApprovals = [] } = useTaskApprovals()
  const warnings = allWarnings.filter((w) => w.employeeId === member.id)
  const taskWarningCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of warnings) {
      if (w.taskId) map[w.taskId] = (map[w.taskId] ?? 0) + 1
    }
    return map
  }, [warnings])
  const canIssueWarning = user?.role === "MD" || user?.role === "ADMIN"
  const isMD = user?.role === "MD"
  const queryClient = useQueryClient()
  const today = startOfDay(new Date())

  const { data: memberPermissions } = useQuery({
    queryKey: ["it-permissions", "member", member.id],
    queryFn: () =>
      apiGet<{ id: string; permissions: { [FEATURE_KEYS.WORKLOG_ENFORCEMENT]: boolean | null } }[]>(
        `/api/it/permissions?userId=${member.id}`
      ),
    enabled: !!isMD && !!member.id && actionsSheetOpen,
  })
  const workLogEnforcementEnabled =
    memberPermissions?.[0]?.permissions[FEATURE_KEYS.WORKLOG_ENFORCEMENT] ?? false

  const workLogEnforcementMutation = useMutation({
    mutationFn: ({ enabled }: { enabled: boolean }) =>
      apiPatch("/api/it/permissions", {
        userId: member.id,
        featureKey: FEATURE_KEYS.WORKLOG_ENFORCEMENT,
        enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it-permissions"] })
      toast.success("Work log enforcement updated")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update")
    },
  })

  const extensionRequests = useMemo(() => {
    return allApprovals.filter((a) => a.task.assignee?.id === member.id)
  }, [allApprovals, member.id])

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"),
    [tasks]
  )

  const needsReviewTasks = useMemo(
    () => activeTasks.filter((t) => t.status === "EMPLOYEE_DONE"),
    [activeTasks]
  )

  const overdueTasks = useMemo(
    () =>
      activeTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "EMPLOYEE_DONE"
      ),
    [activeTasks, today]
  )

  const mdTasks = useMemo(
    () => activeTasks.filter((t) => user && t.createdById === user.id),
    [activeTasks, user]
  )

  const teamTasks = useMemo(
    () => activeTasks.filter((t) => user && t.createdById !== user.id),
    [activeTasks, user]
  )

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "COMPLETED"),
    [tasks]
  )

  const avgRating = useMemo(() => {
    const graded = completedTasks.filter((t) => t.grade)
    if (graded.length === 0) return null
    const sum = graded.reduce((acc, t) => {
      const n = parseInt(t.grade!)
      return acc + (isNaN(n) ? 0 : n)
    }, 0)
    return Math.round((sum / graded.length) * 10) / 10
  }, [completedTasks])

  const isIn = member.attendanceStatus === "in"
  const isLeave = member.attendanceStatus === "leave"

  const mdTasksOnTime = useMemo(
    () =>
      mdTasks.filter(
        (t) =>
          t.status !== "EMPLOYEE_DONE" &&
          (!t.dueDate || new Date(t.dueDate) >= today)
      ),
    [mdTasks, today]
  )
  const teamTasksOnTime = useMemo(
    () =>
      teamTasks.filter(
        (t) =>
          t.status !== "EMPLOYEE_DONE" &&
          (!t.dueDate || new Date(t.dueDate) >= today)
      ),
    [teamTasks, today]
  )

  const handleTaskRowClick = (task: Task) => {
    if (task.status === "EMPLOYEE_DONE" && canMarkComplete(task)) {
      setTaskToComplete(task)
    } else {
      setDetailTaskId(task.id)
    }
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header card */}
        <header className="shrink-0 rounded-xl border bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/40 dark:to-violet-950/40 p-4 mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className={cn("text-base font-semibold", getAvatarColor(member.name).bg, getAvatarColor(member.name).text)}>
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-lg font-semibold tracking-tight truncate">{member.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium",
                    isLeave && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                    isIn && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
                    !isIn && !isLeave && "bg-muted text-muted-foreground"
                  )}
                >
                  {isLeave ? "Leave" : isIn ? "IN" : "OUT"}
                </span>
                {member.designation && (
                  <span className="text-xs text-muted-foreground">{member.designation}</span>
                )}
                {member.department && (
                  <span className="text-xs text-muted-foreground">· {member.department.name}</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setActionsSheetOpen(true)}
              aria-label="Actions"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>

          {/* Tabs: Active | Completed | Overdue | Warnings */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {avgRating != null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white/60 dark:bg-white/5 px-2.5 py-1.5 border">
                <RatingStars rating={avgRating} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-sm transition-colors",
                activeTab === "active"
                  ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                  : "bg-white/60 dark:bg-white/5 border-border hover:bg-muted/50"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold">{activeTasks.length}</span>
              <span className="text-muted-foreground">active</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-sm transition-colors",
                activeTab === "completed"
                  ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                  : "bg-white/60 dark:bg-white/5 border-border hover:bg-muted/50"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-semibold">{completedTasks.length}</span>
              <span className="text-muted-foreground">completed</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("overdue")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-sm transition-colors",
                activeTab === "overdue"
                  ? "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                  : "bg-white/60 dark:bg-white/5 border-border hover:bg-muted/50"
              )}
            >
              <span className="font-semibold text-red-600 dark:text-red-400">{overdueTasks.length}</span>
              <span className="text-muted-foreground">overdue</span>
            </button>
            {canIssueWarning && (
              <button
                type="button"
                onClick={() => setWarningsDrawerOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-sm transition-colors",
                  warnings.length > 0
                    ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-800/40"
                    : "bg-white/60 dark:bg-white/5 border-border hover:bg-muted/50"
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-semibold">{warnings.length}</span>
                <span className="text-muted-foreground">warnings</span>
              </button>
            )}
            {canIssueWarning && (
              <button
                type="button"
                onClick={() => setWorkLogDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-sm transition-colors bg-white/60 dark:bg-white/5 border-border hover:bg-muted/50"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="text-muted-foreground">logs</span>
              </button>
            )}
            {extensionRequests.length > 0 && (
              <div className="flex items-center gap-1 rounded-lg bg-white/60 dark:bg-white/5 px-2.5 py-1.5 border text-sm">
                <ArrowUpRight className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <span className="font-semibold text-violet-600 dark:text-violet-400">{extensionRequests.length}</span>
                <span className="text-muted-foreground">extensions</span>
              </div>
            )}
          </div>
        </header>

        <ScrollArea className="flex-1 min-h-0 -mx-2 px-2">
          <div className="space-y-4 pb-6">
            {/* Extension Requests - pink, click navigates to approval tab */}
            {extensionRequests.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-pink-700 dark:text-pink-400">
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                  Extension Requests ({extensionRequests.length})
                </h2>
                <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                  {extensionRequests.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => router.push("/md/tasks#approval")}
                      className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-medium truncate">{a.task.title}</span>
                        <span className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                          a.status === "PENDING" && "bg-amber-100 text-amber-800",
                          a.status === "APPROVED" && "bg-emerald-100 text-emerald-800",
                          a.status === "REJECTED" && "bg-red-100 text-red-800"
                        )}>
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.oldDueDate ? format(new Date(a.oldDueDate), "MMM d") : "No date"}
                        {" → "}
                        {a.newDueDate ? format(new Date(a.newDueDate), "MMM d") : "No date"}
                        {a.reason && ` · ${a.reason}`}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Task sections - filtered by tab */}
            {(activeTab === "active" || activeTab === "overdue") && (
              <>
                {/* Needs review - top (active tab only) */}
                {activeTab === "active" && needsReviewTasks.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-violet-700 dark:text-violet-300">
                      <Star className="h-4 w-4 shrink-0" />
                      Needs review ({needsReviewTasks.length})
                      <span className="text-xs font-normal text-muted-foreground ml-1">Click to rate</span>
                    </h2>
                    <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                      {needsReviewTasks.map((task) => (
                        <div key={task.id} className={getTeamDetailTaskCardClass(false)}>
                          <TaskRow
                            task={task}
                            onClick={() => handleTaskRowClick(task)}
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
                      ))}
                    </div>
                  </section>
                )}

                {/* Overdue - top */}
                {overdueTasks.length > 0 && (activeTab === "overdue" || activeTab === "active") && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-red-600 dark:text-red-400">
                      <Clock className="h-4 w-4 shrink-0" />
                      Overdue ({overdueTasks.length})
                    </h2>
                    <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                      {overdueTasks.map((task) => {
                        const daysOverdue = getOverdueDays(task, today)
                        return (
                          <div key={task.id} className={getTeamDetailTaskCardClass(true)}>
                            <p className="text-xs text-red-600 px-4 pt-3 pb-0 font-medium">
                              {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                            </p>
                            <TaskRow
                              task={task}
                              onClick={() => handleTaskRowClick(task)}
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
                      })}
                    </div>
                  </section>
                )}

                {/* MD Tasks - on-time only (active tab only) */}
                {activeTab === "active" && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-blue-700 dark:text-blue-300">
                      <Crown className="h-4 w-4 shrink-0" />
                      MD Tasks ({mdTasksOnTime.length})
                      <span className="text-xs font-normal text-muted-foreground ml-1">Assigned by you</span>
                    </h2>
                    {isError ? (
                      <p className="text-xs text-destructive px-1">Failed to load tasks.</p>
                    ) : isLoading ? (
                      <p className="text-xs text-muted-foreground px-1">Loading…</p>
                    ) : mdTasksOnTime.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No on-time MD tasks</p>
                    ) : (
                      <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                        {mdTasksOnTime.map((task) => (
                          <div key={task.id} className={getTeamDetailTaskCardClass(false)}>
                            <TaskRow
                              task={task}
                              onClick={() => handleTaskRowClick(task)}
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
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Team Tasks - on-time only (active tab only) */}
                {activeTab === "active" && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-emerald-700 dark:text-emerald-300">
                      <Users className="h-4 w-4 shrink-0" />
                      Team Tasks ({teamTasksOnTime.length})
                      <span className="text-xs font-normal text-muted-foreground ml-1">Assigned by others</span>
                    </h2>
                    {isError ? (
                      <p className="text-xs text-destructive px-1">Failed to load tasks.</p>
                    ) : isLoading ? (
                      <p className="text-xs text-muted-foreground px-1">Loading…</p>
                    ) : teamTasksOnTime.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No on-time team tasks</p>
                    ) : (
                      <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                        {teamTasksOnTime.map((task) => (
                          <div key={task.id} className={getTeamDetailTaskCardClass(false)}>
                            <TaskRow
                              task={task}
                              onClick={() => handleTaskRowClick(task)}
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
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {/* Completed tab */}
            {activeTab === "completed" && (
              <section>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 px-1 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Completed ({completedTasks.length})
                </h2>
                {isError ? (
                  <p className="text-xs text-destructive px-1">Failed to load tasks.</p>
                ) : isLoading ? (
                  <p className="text-xs text-muted-foreground px-1">Loading…</p>
                ) : completedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No completed tasks</p>
                ) : (
                  <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                    {completedTasks.map((task) => (
                      <div key={task.id} className={getTeamDetailTaskCardClass(false)}>
                        <TaskRow
                          task={task}
                          onClick={() => handleTaskRowClick(task)}
                          showAssignee={false}
                          showProject
                          showCompletionRating
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

            {activeTab === "overdue" && overdueTasks.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No overdue tasks</p>
            )}
          </div>
        </ScrollArea>

        {!isMobile && (
          <div className="shrink-0 mt-4 pt-4 border-t border-border">
            <TaskInput
              onSuccess={() => {}}
              prefillAssignee={{ id: member.id, name: member.name }}
              isMD
              className="w-full min-w-0"
            />
          </div>
        )}
      </div>

      {isMobile && (
        <>
          <Button
            size="icon"
            className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
            onClick={() => setDrawerOpen(true)}
            aria-label="New task"
          >
            <Plus className="h-12 w-12 font-bold" />
          </Button>
          <MobileTaskDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onSuccess={() => {}}
            prefillAssignee={{ id: member.id, name: member.name }}
            isMD
          />
        </>
      )}

      <TaskDetailModal
        open={!!detailTaskId}
        onOpenChange={(o) => !o && setDetailTaskId(null)}
        taskId={detailTaskId}
      />
      <MarkCompleteDrawer
        task={taskToComplete}
        open={!!taskToComplete}
        onOpenChange={(open) => !open && setTaskToComplete(null)}
        onSuccess={() => setTaskToComplete(null)}
      />
      <IssueWarningDialog
        open={issueWarningOpen}
        onOpenChange={setIssueWarningOpen}
        employeeId={member.id}
        employeeName={member.name}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
        onSuccess={() => {}}
      />
      <WorkLogViewerDrawer
        open={workLogDrawerOpen}
        onOpenChange={setWorkLogDrawerOpen}
        memberId={member.id}
        memberName={member.name}
      />
      <WarningsDrawer
        open={warningsDrawerOpen}
        onOpenChange={setWarningsDrawerOpen}
        memberName={member.name}
        warnings={warnings}
      />
      <Sheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen}>
        <SheetContent side="right" className="w-full max-w-xs sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Actions</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 pt-4">
            {isMD && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm">
                <Label htmlFor="worklog-enforcement" className="font-medium cursor-pointer flex-1">
                  Work Log Enforcement
                </Label>
                <Switch
                  id="worklog-enforcement"
                  checked={workLogEnforcementEnabled}
                  onCheckedChange={(checked) =>
                    workLogEnforcementMutation.mutate({ enabled: checked })
                  }
                  disabled={workLogEnforcementMutation.isPending}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setActionsSheetOpen(false)
                setWorkLogDrawerOpen(true)
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
                <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="font-medium">View Work Logs</span>
            </button>
            {canIssueWarning && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActionsSheetOpen(false)
                    setWarningsDrawerOpen(true)
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">View Warnings</span>
                    {warnings.length > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">({warnings.length})</span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsSheetOpen(false)
                    setIssueWarningOpen(true)
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="font-medium">Issue Warning</span>
                </button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
