"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  useUpdateComplianceCall,
  type ComplianceCall,
} from "@/hooks/use-compliance-calls"

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

interface Props {
  call: ComplianceCall | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComplianceCallEditDrawer({ call, open, onOpenChange }: Props) {
  const update = useUpdateComplianceCall()
  const [rating, setRating] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (call) {
      setRating(call.rating ?? null)
      setNotes(call.notes ?? "")
    }
  }, [call])

  const onSubmit = async () => {
    if (!call) return
    if (!rating) {
      toast.error("Please select a rating")
      return
    }
    try {
      await update.mutateAsync({
        id: call.id,
        status: "COMPLETED",
        rating,
        notes: notes.trim() || null,
      })
      toast.success("Feedback saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  const display = hover ?? rating

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl sm:max-w-md sm:mx-auto">
        <SheetHeader>
          <SheetTitle>
            {call?.lead.patientName ?? "Patient"}
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              {call?.lead.leadRef}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">How did the patient rate the experience?</p>
            <div className="flex items-center justify-between gap-1">
              {RATINGS.map((r) => {
                const filled = display != null && r <= display
                return (
                  <button
                    key={r}
                    type="button"
                    onMouseEnter={() => setHover(r)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setRating(r)}
                    aria-label={`${r} out of 5`}
                    className="p-2 -m-1 transition active:scale-95"
                  >
                    <Star
                      className={cn(
                        "h-9 w-9 transition",
                        filled ? RATING_COLORS[display!] : "text-muted-foreground/40",
                        filled && "fill-current",
                      )}
                    />
                  </button>
                )
              })}
            </div>
            {display != null && (
              <p className={cn("mt-2 text-center text-sm font-medium", RATING_COLORS[display])}>
                {RATING_LABELS[display]}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="compliance-notes">
              Notes
            </label>
            <Textarea
              id="compliance-notes"
              placeholder="What did the patient say? Any issues or praise?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onSubmit}
              disabled={update.isPending}
            >
              {update.isPending ? "Saving…" : "Save feedback"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
