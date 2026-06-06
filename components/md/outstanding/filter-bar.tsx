"use client"

import { ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  filterCount: number
  onOpenFilters: () => void
}

export function FilterBar({ filterCount, onOpenFilters }: Props) {
  return (
    <div className="sticky top-0 z-20 -mx-1 flex items-center gap-2 border-b bg-background/90 px-1 py-2 backdrop-blur">
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted active:scale-[0.98] transition",
          filterCount > 0
            ? "border-primary bg-primary/10 text-primary"
            : "bg-card",
        )}
      >
        <ListFilter className="h-3.5 w-3.5" />
        Filters
        {filterCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold text-primary-foreground">
            {filterCount}
          </span>
        )}
      </button>
      <span className="text-xs text-muted-foreground ml-auto">
        Apply filters to refresh KPIs & leaderboards
      </span>
    </div>
  )
}
