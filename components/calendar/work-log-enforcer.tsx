"use client"

import { useEffect, useState } from "react"
import { format, startOfDay } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useWorkLogCheck, useCreateWorkLog } from "@/hooks/use-work-logs"
import { useAuth } from "@/hooks/use-auth"
import { apiGet } from "@/lib/api-client"
import { toast } from "sonner"
import { Clock } from "lucide-react"

const INTERVAL_LABELS: Record<string, string> = {
  "0-9": "Night catch-up (optional)",
  "9-11": "9:00 AM - 11:00 AM",
  "11-13": "11:00 AM - 1:00 PM",
  "13-15": "1:00 PM - 3:00 PM",
  "15-17": "3:00 PM - 5:00 PM",
  "17-19": "5:00 PM - 7:00 PM",
}

function getIntervalLabel(start: number, end: number): string {
  return INTERVAL_LABELS[`${start}-${end}`] ?? `${start}:00 - ${end}:00`
}

function formatDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function WorkLogEnforcer() {
  const { user } = useAuth()
  const [description, setDescription] = useState("")
  const { data: check, isLoading, refetch } = useWorkLogCheck({
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
  })
  const { data: pendingNotice } = useQuery<{ id: string } | null>({
    queryKey: ["notices-pending"],
    queryFn: () => apiGet<{ id: string } | null>("/api/notices/pending"),
  })
  const createMutation = useCreateWorkLog()

  const isBlocked = check?.isBlocked ?? false
  const missingIntervals = check?.missingIntervals ?? []
  const firstMissing = missingIntervals[0]
  const today = new Date()

  useEffect(() => {
    if (isBlocked && firstMissing) {
      setDescription("")
    }
  }, [isBlocked, firstMissing?.start])

  const handleSubmit = async () => {
    if (!firstMissing || !description.trim()) {
      toast.error("Please enter what you did")
      return
    }

    try {
      const tzOffsetMinutes = -new Date().getTimezoneOffset()
      await createMutation.mutateAsync({
        logDate: formatDateOnly(today),
        intervalStart: firstMissing.start as 0 | 9 | 11 | 13 | 15 | 17,
        intervalEnd: firstMissing.end as 9 | 11 | 13 | 15 | 17 | 19,
        description: description.trim(),
        tzOffsetMinutes,
      })
      toast.success("Log saved")
      setDescription("")
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save log")
    }
  }

  if (user?.role === "SALES_HEAD") return null
  if (isLoading || !check) return null
  if (pendingNotice) return null
  if (!isBlocked) return null

  return (
    <Drawer
      open={true}
      onOpenChange={() => {}}
      modal={true}
    >
      <DrawerContent
        className="max-h-[85vh] rounded-t-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Log your work
          </DrawerTitle>
          <DrawerDescription>
            {firstMissing && (
              <>
                {getIntervalLabel(firstMissing.start, firstMissing.end)} —{" "}
                {format(today, "MMM d, yyyy")}
              </>
            )}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-8">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you do in this period?"
            rows={3}
            className="resize-none"
            autoFocus
          />
          <Button
            className="mt-4 w-full"
            onClick={handleSubmit}
            disabled={!description.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Saving…" : "Add Log"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
