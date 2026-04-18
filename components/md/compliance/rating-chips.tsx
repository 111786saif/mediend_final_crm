"use client"

import { cn } from "@/lib/utils"
import type { ComplianceStats } from "@/hooks/use-compliance-calls"

interface Props {
  stats: ComplianceStats | undefined
  activeRating: number | null
  onChange: (r: number | null) => void
}

const RATINGS = [5, 4, 3, 2, 1] as const

export function RatingChips({ stats, activeRating, onChange }: Props) {
  const byRating = stats?.byRating ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  const total = stats?.totalCompleted ?? 0

  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex gap-2 px-1 snap-x">
        <Chip
          label={`All ${total}`}
          active={activeRating == null}
          onClick={() => onChange(null)}
          accent="primary"
        />
        {RATINGS.map((r) => (
          <Chip
            key={r}
            label={`${r}★ ${byRating[String(r) as "1" | "2" | "3" | "4" | "5"] ?? 0}`}
            active={activeRating === r}
            onClick={() => onChange(r)}
            accent={r >= 4 ? "emerald" : r === 3 ? "amber" : "rose"}
          />
        ))}
      </div>
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string
  active: boolean
  onClick: () => void
  accent: "primary" | "emerald" | "amber" | "rose"
}) {
  const activeClass = {
    primary: "bg-primary text-primary-foreground",
    emerald: "bg-emerald-500 text-white",
    amber: "bg-amber-500 text-white",
    rose: "bg-rose-500 text-white",
  }[accent]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "snap-start shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-[0.98]",
        active ? activeClass : "bg-card text-foreground/80 hover:bg-muted",
      )}
    >
      {label}
    </button>
  )
}
