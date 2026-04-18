"use client"

import { cn } from "@/lib/utils"

interface Props {
  rating: 1 | 2 | 3 | 4 | 5
  count: number
  maxCount: number
  total: number
  active: boolean
  onClick: () => void
}

export function RatingDistributionBar({ rating, count, maxCount, total, active, onClick }: Props) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  const share = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${rating}-star reviews (${count})`}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-muted/50 active:scale-[0.98]",
        active && "bg-muted",
      )}
    >
      <span className="w-6 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {rating}★
      </span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-500",
            active && "bg-amber-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground/70">
        {share}%
      </span>
    </button>
  )
}
