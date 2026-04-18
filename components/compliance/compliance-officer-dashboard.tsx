"use client"

import { useMemo, useState } from "react"
import { Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useComplianceCalls,
  useComplianceStats,
  type ComplianceCall,
  type ComplianceCallStatus,
} from "@/hooks/use-compliance-calls"
import { ComplianceCallRow } from "./compliance-call-row"
import { ComplianceCallEditDrawer } from "./compliance-call-edit-drawer"

type StatusFilter = "ALL" | ComplianceCallStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CALLBACK_SCHEDULED", label: "Callbacks" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DID_NOT_PICK", label: "Did not pick" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
]

export function ComplianceOfficerDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [editing, setEditing] = useState<ComplianceCall | null>(null)

  const { data: stats } = useComplianceStats({})

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useComplianceCalls({
      status: statusFilter === "ALL" ? null : statusFilter,
      sort: statusFilter === "ALL" ? "pending" : "recent",
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
        <div>
          <h1 className="text-xl font-semibold">Compliance</h1>
          <p className="text-xs text-muted-foreground">
            {stats?.pending ?? 0} pending · {stats?.totalCompleted ?? 0} completed
          </p>
        </div>
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
            No patients to follow up.
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

      <ComplianceCallEditDrawer
        call={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}
