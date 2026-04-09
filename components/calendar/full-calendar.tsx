"use client"

import { useState, useMemo } from "react"
import {
  format,
  startOfMonth,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameDay,
  startOfDay,
  isToday,
  getDay,
} from "date-fns"
import { ChevronLeft, ChevronRight, ChevronDown, GripVertical, Pencil, MessageSquare, MoreHorizontal, Plus } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useUpdateTask } from "@/hooks/use-tasks"
import { getTaskCardClass } from "@/components/tasks/task-card-class"
import { cn } from "@/lib/utils"

const DAYS_VISIBLE = 50

export interface CalendarTask {
  id: string
  title: string
  description?: string | null
  dueDate: string | null
  startTime?: string | null
  endTime?: string | null
  allDay: boolean
  status: string
  priority: string
  assignee?: { id: string; name: string; email: string }
  project?: { id: string; name: string } | null
}

interface FullCalendarTasksProps {
  events: CalendarTask[]
  onEventClick?: (taskId: string) => void
  /** When provided, marking a task complete will call this instead of updating directly (to open rating drawer). */
  onMarkCompleteRequest?: (taskId: string) => void
  onEventDrop?: (
    taskId: string,
    newStart: Date,
    newEnd?: Date,
    revert?: () => void
  ) => void | Promise<void>
  onDatesSet?: (start: Date, end: Date) => void
  onAddTask?: (date: Date) => void
  className?: string
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getTaskDate(task: CalendarTask): Date | null {
  if (task.dueDate) return startOfDay(new Date(task.dueDate))
  if (task.startTime) return startOfDay(new Date(task.startTime))
  return null
}

export function FullCalendarTasks({
  events,
  onEventClick,
  onMarkCompleteRequest,
  onAddTask,
  className,
}: FullCalendarTasksProps) {
  const [viewStart, setViewStart] = useState(() => startOfDay(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [monthPopoverOpen, setMonthPopoverOpen] = useState(false)
  const updateTask = useUpdateTask()

  const fiftyDays = useMemo(() => {
    return Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(viewStart, i))
  }, [viewStart])

  const monthLabel = format(viewStart, "MMMM yyyy")
  const visibleStart = viewStart
  const visibleEnd = addDays(viewStart, DAYS_VISIBLE - 1)

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    for (const task of events) {
      if (task.status === "CANCELLED") continue
      const d = getTaskDate(task)
      if (!d) continue
      const key = format(d, "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const da = getTaskDate(a)?.getTime() ?? 0
        const db = getTaskDate(b)?.getTime() ?? 0
        return da - db
      })
    }
    return map
  }, [events])

  const dateSections = useMemo(() => {
    const sections: { date: Date; key: string; tasks: CalendarTask[] }[] = []
    let d = startOfDay(visibleStart)
    while (d <= visibleEnd) {
      const key = format(d, "yyyy-MM-dd")
      const tasks = tasksByDate.get(key) ?? []
      sections.push({ date: d, key, tasks })
      d = addDays(d, 1)
    }
    return sections
  }, [visibleStart, visibleEnd, tasksByDate])

  const goPrev = () => setViewStart((prev) => subWeeks(prev, 1))
  const goNext = () => setViewStart((prev) => addWeeks(prev, 1))
  const goToday = () => {
    const today = startOfDay(new Date())
    setSelectedDate(today)
    setViewStart(today)
  }

  const allMonths = useMemo(() => {
    const list: { key: string; date: Date }[] = []
    const today = new Date()
    let d = startOfMonth(subMonths(today, 12))
    const end = startOfMonth(addMonths(today, 13))
    while (d < end) {
      list.push({ key: format(d, "yyyy-MM"), date: new Date(d) })
      d = addMonths(d, 1)
    }
    return list
  }, [])

  return (
    <div className={cn("flex flex-col", className)}>
      <header className="space-y-3 border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <Popover open={monthPopoverOpen} onOpenChange={setMonthPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                {monthLabel}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1 max-h-[70vh] overflow-y-auto" align="start">
              {allMonths.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    const monthStart = startOfDay(m.date)
                    setViewStart(monthStart)
                    setSelectedDate(monthStart)
                    setMonthPopoverOpen(false)
                    const key = format(monthStart, "yyyy-MM-dd")
                    setTimeout(() => {
                      document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }, 100)
                  }}
                  className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  {format(m.date, "MMMM yyyy")}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-md px-2 py-1 text-sm font-medium text-foreground hover:bg-muted"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto -mx-2 px-2 pb-1">
          <div className="flex gap-1 w-max">
            {fiftyDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const dayNum = format(day, "d")
              const weekday = WEEKDAY_NAMES[getDay(day)]
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day)
                    const key = format(day, "yyyy-MM-dd")
                    document.getElementById(`day-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                  className={cn(
                    "shrink-0 flex flex-col items-center w-10 rounded-md py-1.5 text-xs transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="font-medium">{weekday}</span>
                  <span className="mt-0.5 font-medium">{dayNum}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className="mt-4 space-y-6">
        {dateSections.map(({ date, key, tasks }) => {
          const dayLabel = format(date, "d MMM")
          const weekdayFull = format(date, "EEEE")
          const isTodayDate = isToday(date)
          const heading =
            isTodayDate
              ? `${dayLabel} · Today · ${weekdayFull}`
              : `${dayLabel} · ${weekdayFull}`

          return (
            <section key={key} id={`day-${key}`}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {heading}
              </h3>
              <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border">
                {tasks.map((task) => {
                  const today = startOfDay(new Date())
                  const taskDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : null
                  const isOverdue = !!taskDate && taskDate < today && task.status !== "COMPLETED"
                  return (
                    <div
                      key={task.id}
                      className={getTaskCardClass(task, { isOverdue })}
                    >
                      <UpcomingTaskRow
                        task={task}
                        onToggleComplete={updateTask}
                        onMarkCompleteRequest={onMarkCompleteRequest}
                        onClick={() => onEventClick?.(task.id)}
                      />
                    </div>
                  )
                })}
              </div>
              {onAddTask && (
                <button
                  type="button"
                  onClick={() => onAddTask(date)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Add task
                </button>
              )}
              <div className="mt-4 border-b border-border/60" />
            </section>
          )
        })}
      </div>
    </div>
  )
}

function UpcomingTaskRow({
  task,
  onToggleComplete,
  onMarkCompleteRequest,
  onClick,
}: {
  task: CalendarTask
  onToggleComplete: ReturnType<typeof useUpdateTask>
  onMarkCompleteRequest?: (taskId: string) => void
  onClick: () => void
}) {
  const isCompleted = task.status === "COMPLETED"

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (task.status === "EMPLOYEE_DONE" && onMarkCompleteRequest) {
      onMarkCompleteRequest(task.id)
      return
    }
    if (!isCompleted && onMarkCompleteRequest) return
    try {
      await onToggleComplete.mutateAsync({
        id: task.id,
        data: { status: isCompleted ? "PENDING" : "COMPLETED" },
      })
    } catch {
      // ignore
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-1 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCompleted && "opacity-70"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => {}}
        onClick={handleToggle}
        aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm text-foreground",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
        {task.project && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {task.project.name}
          </p>
        )}
      </div>
    </div>
  )
}
