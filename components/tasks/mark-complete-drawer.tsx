"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { isSelfAssigned } from "@/lib/task-utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateTask } from "@/hooks/use-tasks"
import type { Task } from "@/hooks/use-tasks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Star } from "lucide-react"

const RATINGS = [1, 2, 3, 4, 5] as const

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Below average",
  3: "Average",
  4: "Good",
  5: "Excellent",
}

const RATING_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-emerald-500",
  5: "text-emerald-600",
}

const PRESET_COMMENTS = [
  "Good job",
  "Excellent work",
  "Delivered on time",
  "Slight delay",
  "Very delayed",
  "Bad quality of work",
  "Needs improvement",
  "Rework required",
]

interface MarkCompleteDrawerProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (task: Task) => void
}

export function MarkCompleteDrawer({
  task,
  open,
  onOpenChange,
  onSuccess,
}: MarkCompleteDrawerProps) {
  const { user } = useAuth()
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [comments, setComments] = useState("")
  const updateTask = useUpdateTask()

  const isAssignee = !!user && !!task && task.assigneeId === user.id
  const selfAssignedAssigneeCannotRate = !!task && isSelfAssigned(task) && isAssignee && user?.role !== "MD"

  const handlePresetSelect = (value: string) => {
    const preset = PRESET_COMMENTS.find((p) => p === value)
    if (preset) {
      setComments((prev) => (prev ? `${prev}\n${preset}` : preset))
    }
  }

  const handleApprove = async () => {
    if (!task || !rating) return
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          status: "COMPLETED",
          grade: String(rating) as "1" | "2" | "3" | "4" | "5",
          completionComments: comments.trim() || undefined,
        },
      })
      try {
        const audio = new Audio("/ding-sound-effect_1.mp3")
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch {}
      toast.success("Task approved")
      setRating(null)
      setHoverRating(null)
      setComments("")
      onOpenChange(false)
      onSuccess?.(task)
    } catch {
      toast.error("Failed to approve task")
    }
  }

  const handleReject = async () => {
    if (!task || !rating) return
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          status: "IN_PROGRESS",
          grade: String(rating) as "1" | "2" | "3" | "4" | "5",
          completionComments: comments.trim() || undefined,
        },
      })
      toast.success("Task sent back to in progress")
      setRating(null)
      setHoverRating(null)
      setComments("")
      onOpenChange(false)
      onSuccess?.(task)
    } catch {
      toast.error("Failed to reject task")
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRating(null)
      setHoverRating(null)
      setComments("")
    }
    onOpenChange(next)
  }

  const activeRating = hoverRating ?? rating
  const canApprove = task && rating && !selfAssignedAssigneeCannotRate
  const canReject = task && rating && !selfAssignedAssigneeCannotRate

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col max-h-[85dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-4 sm:px-6"
      >
        <SheetHeader className="text-left px-0">
          <SheetTitle>
            {task ? `Review: ${task.title}` : "Review task"}
          </SheetTitle>
        </SheetHeader>
        {task && (
          <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-auto py-5 px-1 sm:px-2">
            {selfAssignedAssigneeCannotRate ? (
              <>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Self-assigned task</p>
                  <p className="text-muted-foreground">
                    For self-assigned tasks, ratings must be given by your manager. Only MD or your manager can approve and rate this task.
                  </p>
                </div>
                <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
                  Close
                </Button>
              </>
            ) : (
            <>
            <div className="flex justify-center w-full" role="group" aria-label="Select rating">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  onMouseEnter={() => setHoverRating(r)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1.5 transition-transform hover:scale-110 focus:outline-none"
                  aria-pressed={rating === r}
                  aria-label={`${r} star`}
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-colors",
                      activeRating && r <= activeRating
                        ? cn("fill-current", RATING_COLORS[activeRating])
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            <div>
              <Select onValueChange={handlePresetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Add preset comment..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_COMMENTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Add feedback (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-[100px] resize-none"
              rows={4}
            />
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleApprove}
                disabled={!canApprove || updateTask.isPending}
                className="flex-1"
              >
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={!canReject || updateTask.isPending}
                className="text-destructive hover:text-destructive"
              >
                Reject
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={updateTask.isPending}
              >
                Cancel
              </Button>
            </div>
            </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
