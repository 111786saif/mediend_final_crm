"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateWarning, type WarningType } from "@/hooks/use-tasks"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

const WARNING_TYPES: { value: WarningType; label: string }[] = [
  { value: "REPEATED_DEADLINE_MISS", label: "Repeated deadline miss" },
  { value: "LOW_QUALITY_WORK", label: "Low quality work" },
  { value: "UNRESPONSIVE", label: "Unresponsive" },
  { value: "TASK_ABANDONMENT", label: "Task abandonment" },
  { value: "OTHER", label: "Other" },
]

interface IssueWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-filled when opening from a task or team member context */
  employeeId: string
  employeeName?: string
  /** Task to link the warning to - required. When from task detail, pass directly. When from team member, use task dropdown. */
  taskId?: string | null
  taskTitle?: string
  /** Tasks for dropdown when issuing from team member (no taskId provided) */
  tasks?: { id: string; title: string }[]
  onSuccess?: () => void
}

export function IssueWarningDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  taskId: initialTaskId,
  taskTitle,
  tasks: taskOptions,
  onSuccess,
}: IssueWarningDialogProps) {
  const [type, setType] = useState<WarningType | "">("")
  const [note, setNote] = useState("")
  const [selectedTaskId, setSelectedTaskId] = useState<string>("")
  const [isGeneral, setIsGeneral] = useState(false)
  const createWarning = useCreateWarning()

  const isFromTaskContext = !!initialTaskId
  const effectiveTaskId = isFromTaskContext
    ? initialTaskId
    : isGeneral
      ? null
      : selectedTaskId || null
  const selectedTask = isFromTaskContext
    ? { id: initialTaskId!, title: taskTitle ?? "" }
    : taskOptions?.find((t) => t.id === selectedTaskId)

  const canSubmit =
    !!type &&
    !!note.trim() &&
    (isFromTaskContext || isGeneral || !!selectedTaskId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !note.trim()) {
      toast.error("Please select a type and enter a note")
      return
    }
    if (!isFromTaskContext && !isGeneral && !selectedTaskId) {
      toast.error("Pick a task or switch on General warning")
      return
    }
    try {
      await createWarning.mutateAsync({
        employeeId,
        taskId: effectiveTaskId,
        type: type as WarningType,
        note: note.trim(),
      })
      toast.success(isGeneral && !isFromTaskContext ? "General warning issued" : "Warning issued")
      setType("")
      setNote("")
      setIsGeneral(false)
      setSelectedTaskId("")
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Failed to issue warning")
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setType("")
      setNote("")
      setSelectedTaskId("")
      setIsGeneral(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue warning</DialogTitle>
        </DialogHeader>
        {employeeName && (
          <p className="text-sm text-muted-foreground mb-2">
            Employee: <span className="font-medium text-foreground">{employeeName}</span>
            {selectedTask && (
              <>
                {" · Task: "}
                <span className="font-medium text-foreground">{selectedTask.title}</span>
              </>
            )}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isFromTaskContext && (
            <div className="flex items-center justify-between rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/30 px-3 py-2.5">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-medium text-violet-900 dark:text-violet-100">General warning</p>
                <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80">
                  Not tied to a specific task
                </p>
              </div>
              <Switch
                checked={isGeneral}
                onCheckedChange={(v) => {
                  setIsGeneral(v)
                  if (v) setSelectedTaskId("")
                }}
                aria-label="General warning"
              />
            </div>
          )}
          {taskOptions && !isFromTaskContext && !isGeneral && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Task</label>
              {taskOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No tasks to link — switch on General warning above.
                </p>
              ) : (
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {taskOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Type</label>
            <Select value={type} onValueChange={(v) => setType(v as WarningType)} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {WARNING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the reason for this warning..."
              className="min-h-[100px] resize-none"
              rows={4}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || createWarning.isPending}>
              Issue warning
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
