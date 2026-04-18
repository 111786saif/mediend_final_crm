"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ComplianceStats } from "@/hooks/use-compliance-calls"
import { RatingDistributionBar } from "./rating-distribution-bar"

interface Props {
  stats: ComplianceStats | undefined
  activeRating: number | null
  onRatingClick: (r: 1 | 2 | 3 | 4 | 5) => void
}

export function RatingHero({ stats, activeRating, onRatingClick }: Props) {
  const avg = stats?.averageRating ?? 0
  const total = stats?.totalCompleted ?? 0
  const pending = stats?.pending ?? 0
  const byRating = stats?.byRating ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  const maxCount = Math.max(1, ...Object.values(byRating))

  return (
    <section className="rounded-2xl border bg-gradient-to-br from-amber-50/60 via-background to-background p-5 dark:from-amber-950/20 dark:via-background">
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-8">
        <div className="flex flex-col items-start md:items-center md:justify-center md:border-r md:pr-8">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums md:text-6xl">
              {total > 0 ? avg.toFixed(1) : "—"}
            </span>
            <span className="text-lg text-muted-foreground">/5</span>
          </div>
          <div className="mt-1 flex">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = avg >= n - 0.25
              const half = !filled && avg >= n - 0.75
              return (
                <Star
                  key={n}
                  className={cn(
                    "h-5 w-5",
                    filled
                      ? "fill-amber-400 text-amber-400"
                      : half
                        ? "fill-amber-400/50 text-amber-400"
                        : "text-muted-foreground/30",
                  )}
                />
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {total === 0 ? "No reviews yet" : `Based on ${total} review${total === 1 ? "" : "s"}`}
            {pending > 0 && <span> · {pending} pending</span>}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          {total === 0 ? (
            <div className="flex h-full min-h-[140px] items-center justify-center text-sm text-muted-foreground">
              No reviews match the selected date range.
            </div>
          ) : (
            ([5, 4, 3, 2, 1] as const).map((r) => (
              <RatingDistributionBar
                key={r}
                rating={r}
                count={byRating[String(r) as "1" | "2" | "3" | "4" | "5"] ?? 0}
                maxCount={maxCount}
                total={total}
                active={activeRating === r}
                onClick={() => onRatingClick(r)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
