"use client"

import { useMemo, useState } from "react"
import { Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useComplianceCalls,
  useComplianceStats,
  type ComplianceCall,
  type ComplianceCallStatus,
} from "@/hooks/use-compliance-calls"
import { ComplianceCallRow } from "./compliance-call-row"
import { ComplianceFeedbackDrawer } from "./compliance-feedback-drawer"

type StatusFilter = "ALL" | ComplianceCallStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CALLBACK_SCHEDULED", label: "Callbacks" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DID_NOT_PICK", label: "Did not pick" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
]

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface MonthOption {
  value: string // "YYYY-MM"
  label: string // "May 2026"
}

function buildMonthOptions(count = 12): MonthOption[] {
  const now = new Date()
  const opts: MonthOption[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    opts.push({
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${year}`,
    })
  }
  return opts
}

function monthRange(value: string): { start: string; end: string } {
  const [yStr, mStr] = value.split("-")
  const year = Number(yStr)
  const month = Number(mStr) - 1
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

function currentMonthValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function ComplianceOfficerDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [monthFilter, setMonthFilter] = useState<string>(() => currentMonthValue())
  const [editing, setEditing] = useState<ComplianceCall | null>(null)

  const monthOptions = useMemo(() => buildMonthOptions(12), [])

  const { data: stats } = useComplianceStats({})

  const surgeryRange = useMemo(
    () => (monthFilter === "ALL" ? null : monthRange(monthFilter)),
    [monthFilter],
  )

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useComplianceCalls({
      status: statusFilter === "ALL" ? null : statusFilter,
      sort: statusFilter === "ALL" ? "pending" : "recent",
      surgeryStart: surgeryRange?.start ?? null,
      surgeryEnd: surgeryRange?.end ?? null,
    })

  const allCalls = useMemo(
    () => data?.pages.flatMap((p) => p.calls) ?? [],
    [data],
  )

  return (
    <div className="space-y-5 pb-10">
      <header className="flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">Compliance</h1>
          <p className="text-xs text-muted-foreground">
            {stats?.pending ?? 0} pending · {stats?.totalCompleted ?? 0} completed
          </p>
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px] shrink-0" aria-label="Filter by surgery month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="ALL">All months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="-mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1 snap-x">
          {FILTERS.map((f) => {
            const active = statusFilter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "snap-start shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <section className="rounded-xl border bg-card divide-y">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            Failed to load. Refresh to try again.
          </div>
        ) : allCalls.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {monthFilter === "ALL"
              ? "No patients to follow up."
              : `No surgeries in ${monthOptions.find((m) => m.value === monthFilter)?.label ?? "this month"}.`}
          </div>
        ) : (
          allCalls.map((call) => (
            <ComplianceCallRow key={call.id} call={call} onEdit={setEditing} />
          ))
        )}
      </section>

      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <ComplianceFeedbackDrawer
        call={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}
