"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ComplianceCall } from "@/hooks/use-compliance-calls"

interface Props {
  call: ComplianceCall
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

export function ReviewCard({ call }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const rating = call.rating ?? 0
  const dateLabel = call.completedAt
    ? format(new Date(call.completedAt), "d MMM yyyy")
    : format(new Date(call.createdAt), "d MMM yyyy")
  const bdmName = call.lead.dischargeSheet?.bdmName

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/patient/${call.leadId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/patient/${call.leadId}`)
      }}
      className="cursor-pointer rounded-xl border bg-card p-4 transition hover:shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-sm font-semibold text-emerald-800 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:text-emerald-300">
          {initials(call.lead.patientName) || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{call.lead.patientName}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{dateLabel}</span>
          </div>
          {rating > 0 && (
            <div className="mt-0.5 flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "h-3.5 w-3.5",
                    n <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30",
                  )}
                />
              ))}
            </div>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {call.lead.treatment ?? "—"} · {call.lead.hospitalName}
          </p>
          <p className="truncate text-xs text-muted-foreground/80">
            BD {call.lead.bd?.name ?? "—"}
            {bdmName ? ` · BDM ${bdmName}` : ""}
          </p>
        </div>
      </div>

      {call.notes && (
        <div className="mt-3 border-t pt-3">
          <p
            className={cn(
              "text-sm leading-relaxed text-foreground/90",
              !expanded && "line-clamp-3",
            )}
          >
            &ldquo;{call.notes}&rdquo;
          </p>
          {call.notes.length > 140 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "more"}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
