"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
// Select no longer used — Priority & Project use Popover
import { CalendarIcon, User, FolderPlus, SendHorizonal, Search, Check, X } from "lucide-react"
import { PriorityIcon } from "./priority-icon"
import { format, startOfDay } from "date-fns"
import { useAuth } from "@/hooks/use-auth"
import {
  useCreateTask,
  useAssignableUsers,
  useTaskProjects,
  useCreateTaskProject,
  type CreateTaskInput,
} from "@/hooks/use-tasks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const PRIORITIES = [
  { value: "GENERAL", label: "No priority", color: "text-muted-foreground" },
  { value: "LOW", label: "Low", color: "text-blue-600" },
  { value: "MEDIUM", label: "Medium", color: "text-amber-600" },
  { value: "HIGH", label: "High", color: "text-orange-600" },
  { value: "URGENT", label: "Urgent", color: "text-red-600" },
] as const

const priorityColorMap: Record<string, string> = {
  GENERAL: "text-muted-foreground",
  LOW: "text-blue-600",
  MEDIUM: "text-amber-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600",
}

interface TaskInputProps {
  onSuccess?: () => void
  className?: string
  /** When true, input is anchored at bottom (e.g. mobile) */
  bottomAnchored?: boolean
  /** Pre-fill assignee (e.g. from team member detail); hides assignee selector */
  prefillAssignee?: { id: string; name: string }
  /** When true (MD role), assignee is required and "Me" is not an option */
  isMD?: boolean
}

export function TaskInput({
  onSuccess,
  className,
  bottomAnchored,
  prefillAssignee,
  isMD = false,
}: TaskInputProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [priority, setPriority] = useState<CreateTaskInput["priority"]>("MEDIUM")
  const [assigneeId, setAssigneeId] = useState<string>(() => {
    if (prefillAssignee) return prefillAssignee.id
    return user?.id ?? ""
  })
  const [projectId, setProjectId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const createMutation = useCreateTask()
  const { data: assignableUsers = [] } = useAssignableUsers()
  const { data: projects = [], refetch: refetchProjects } = useTaskProjects()
  const createProjectMutation = useCreateTaskProject()

  const assigneeOptions = useMemo(() => {
    // Self is shown as "Me" button separately for non-MD; MD has no self-option.
    // API already restricts non-MD users to self + direct reports only.
    const list = assignableUsers.filter((u) => u.id !== user?.id)
    if (!assigneeSearch.trim()) return list
    const q = assigneeSearch.trim().toLowerCase()
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    )
  }, [assignableUsers, assigneeSearch, user?.id])

  const effectiveAssigneeId = prefillAssignee ? prefillAssignee.id : assigneeId
  const assigneeRequired = isMD || !!prefillAssignee

  const selectedAssigneeName = effectiveAssigneeId
    ? effectiveAssigneeId === user?.id
      ? "Me"
      : assignableUsers.find((u) => u.id === effectiveAssigneeId)?.name ?? "Select person"
    : "Me"

  const canSubmit =
    !!title.trim() &&
    !createMutation.isPending &&
    (!assigneeRequired || !!effectiveAssigneeId)

  const reset = useCallback(() => {
    setTitle("")
    setDueDate(undefined)
    setPriority("MEDIUM")
    setAssigneeId(prefillAssignee ? prefillAssignee.id : user?.id ?? "")
    setProjectId(null)
    setNewProjectName("")
    inputRef.current?.focus()
  }, [user?.id, isMD, prefillAssignee])

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    if (assigneeRequired && !effectiveAssigneeId) {
      toast.error("Please select a person to assign the task to.")
      return
    }
    if (dueDate && startOfDay(dueDate).getTime() < startOfDay(new Date()).getTime()) {
      toast.error("Due date can't be in the past")
      return
    }

    const payload: CreateTaskInput = {
      title: trimmed,
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      priority,
      assigneeId: effectiveAssigneeId || undefined,
      projectId: projectId || undefined,
    }

    try {
      await createMutation.mutateAsync(payload)
      toast.success("Task added")
      reset()
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputFocus = useCallback(() => {
    if (!bottomAnchored) return
    const el = wrapperRef.current ?? inputRef.current
    if (!el) return
    const scroll = () => {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    requestAnimationFrame(() => setTimeout(scroll, 350))
  }, [bottomAnchored])

  const handleCreateProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    try {
      const created = await createProjectMutation.mutateAsync({ name })
      setProjectId(created.id)
      setNewProjectName("")
      refetchProjects()
    } catch {
      toast.error("Failed to create project")
    }
  }

  const selectedPriority = PRIORITIES.find((p) => p.value === (priority ?? "MEDIUM"))
  const selectedProjectName = projectId ? projects.find((p) => p.id === projectId)?.name : null
  const hasChips = !!(dueDate || (priority && priority !== "MEDIUM") || effectiveAssigneeId || selectedProjectName)

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "min-w-0 w-full",
        !bottomAnchored && "rounded-lg border border-border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary/20",
        bottomAnchored && "bg-card focus-within:ring-0 scroll-mb-[40vh]",
        className
      )}
    >
      {/* Input + send */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 min-w-0">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder="What would you like to do?"
          className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-label="New task title"
        />
        <Button
          type="button"
          size="icon"
          variant="default"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-9 w-9 shrink-0 rounded-full md:rounded-md"
          aria-label="Send"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>

      {/* Colored chips for selected values */}
      {hasChips && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
          {effectiveAssigneeId && selectedAssigneeName !== "Select person" && (
            prefillAssignee ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                @{selectedAssigneeName}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAssigneeId(user?.id ?? "")}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 pl-2 pr-1 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
              >
                @{selectedAssigneeName}
                <X className="h-3 w-3 shrink-0 rounded-full p-0.5 hover:bg-blue-300/50 dark:hover:bg-blue-700/50" />
              </button>
            )
          )}
          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate(undefined)}
              className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 pl-2 pr-1 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
            >
              {format(dueDate, "MMM d")}
              <X className="h-3 w-3 shrink-0 rounded-full p-0.5 hover:bg-green-300/50 dark:hover:bg-green-700/50" />
            </button>
          )}
          {priority && priority !== "MEDIUM" && selectedPriority && (
            <button
              type="button"
              onClick={() => setPriority("MEDIUM")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-xs font-medium transition-colors",
                priority === "LOW" && "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50",
                priority === "HIGH" && "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50",
                priority === "URGENT" && "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50",
                priority === "GENERAL" && "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
              )}
            >
              {selectedPriority.label}
              <X className="h-3 w-3 shrink-0 rounded-full p-0.5 opacity-80 hover:opacity-100" />
            </button>
          )}
          {selectedProjectName && (
            <button
              type="button"
              onClick={() => setProjectId(null)}
              className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/40 pl-2 pr-1 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
            >
              {selectedProjectName}
              <X className="h-3 w-3 shrink-0 rounded-full p-0.5 hover:bg-purple-300/50 dark:hover:bg-purple-700/50" />
            </button>
          )}
        </div>
      )}

      {/* Icon-only action row */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        {/* Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 shrink-0", dueDate ? "text-green-600" : "text-muted-foreground")}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              disabled={{ before: startOfDay(new Date()) }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Priority */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 shrink-0", priorityColorMap[priority ?? "MEDIUM"] ?? "text-muted-foreground")}
            >
              <PriorityIcon priority={priority ?? "MEDIUM"} className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="start">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80",
                  priority === p.value && "bg-muted"
                )}
                onClick={() => setPriority(p.value as CreateTaskInput["priority"])}
              >
                <PriorityIcon priority={p.value} className={cn("h-3.5 w-3.5", p.color)} />
                <span className={cn(p.color)}>{p.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Assignee */}
        {!prefillAssignee ? (
          <Popover open={assigneePopoverOpen} onOpenChange={(open) => { setAssigneePopoverOpen(open); if (!open) setAssigneeSearch("") }}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 shrink-0", effectiveAssigneeId ? "text-blue-600" : "text-muted-foreground")}
              >
                <User className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(320px,calc(100vw-2rem))] min-w-[200px] p-0 overflow-hidden rounded-md flex flex-col max-h-[min(360px,70vh)]"
              align="start"
              side={bottomAnchored ? "top" : "bottom"}
              sideOffset={6}
              collisionPadding={bottomAnchored ? { bottom: 80, top: 8 } : 8}
            >
              <div className="p-2 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search people..."
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    className="h-9 pl-8 text-sm"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="overflow-y-auto overflow-x-hidden max-h-[280px] overscroll-contain">
                <div className="py-1">
                  {user && (
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm rounded-sm mx-1 hover:bg-muted/80 active:bg-muted",
                        effectiveAssigneeId === user.id && "bg-muted"
                      )}
                      onClick={() => {
                        setAssigneeId(user.id)
                        setAssigneePopoverOpen(false)
                      }}
                    >
                      {effectiveAssigneeId === user.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
                      Me
                    </button>
                  )}
                  {assigneeOptions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm rounded-sm mx-1 hover:bg-muted/80 active:bg-muted",
                        effectiveAssigneeId === u.id && "bg-muted"
                      )}
                      onClick={() => {
                        setAssigneeId(u.id)
                        setAssigneePopoverOpen(false)
                      }}
                    >
                      {effectiveAssigneeId === u.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
                  {assigneeOptions.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">No one found.</p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="h-8 w-8 inline-flex items-center justify-center text-blue-600">
            <User className="h-4 w-4" />
          </span>
        )}

        {/* Project */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 shrink-0", selectedProjectName ? "text-purple-600" : "text-muted-foreground")}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80",
                !projectId && "bg-muted"
              )}
              onClick={() => setProjectId(null)}
            >
              No project
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/80",
                  projectId === p.id && "bg-muted"
                )}
                onClick={() => setProjectId(p.id)}
              >
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            <div className="hidden md:block border-t mt-1 pt-1">
              <div className="flex gap-1 px-1">
                <Input
                  placeholder="New project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateProject())}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs px-2"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || createProjectMutation.isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
