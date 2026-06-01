"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Stethoscope, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useComplianceCalls,
  useComplianceFilterOptions,
  useComplianceStats,
  type ComplianceCall,
  type ComplianceCallStatus,
} from "@/hooks/use-compliance-calls"
import { ComplianceCallRow } from "./compliance-call-row"
import { ComplianceFeedbackDrawer } from "./compliance-feedback-drawer"

const ALL = "ALL"

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
  const [hospitalFilter, setHospitalFilter] = useState<string>(ALL)
  const [doctorFilter, setDoctorFilter] = useState<string>(ALL)
  const [bdFilter, setBdFilter] = useState<string>(ALL)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [editing, setEditing] = useState<ComplianceCall | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const monthOptions = useMemo(() => buildMonthOptions(12), [])
  const { data: filterOptions } = useComplianceFilterOptions()

  const { data: stats } = useComplianceStats({})

  const dischargeRange = useMemo(
    () => (monthFilter === ALL ? null : monthRange(monthFilter)),
    [monthFilter],
  )

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useComplianceCalls({
      status: statusFilter === "ALL" ? null : statusFilter,
      sort: "discharge",
      dischargeStart: dischargeRange?.start ?? null,
      dischargeEnd: dischargeRange?.end ?? null,
      q: debouncedSearch || null,
      hospitalName: hospitalFilter === ALL ? null : hospitalFilter,
      surgeonName: doctorFilter === ALL ? null : doctorFilter,
      bdId: bdFilter === ALL ? null : bdFilter,
    })

  const allCalls = useMemo(
    () => data?.pages.flatMap((p) => p.calls) ?? [],
    [data],
  )

  const hasNonStatusFilter =
    debouncedSearch !== "" ||
    hospitalFilter !== ALL ||
    doctorFilter !== ALL ||
    bdFilter !== ALL ||
    monthFilter !== ALL

  const clearFilters = () => {
    setSearchInput("")
    setDebouncedSearch("")
    setHospitalFilter(ALL)
    setDoctorFilter(ALL)
    setBdFilter(ALL)
    setMonthFilter(ALL)
  }

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
          <SelectTrigger
            className="w-[160px] shrink-0"
            aria-label="Filter by discharge month"
            title="Filter by discharge month"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL}>All months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Discharges this month" value={stats?.dischargesThisMonth ?? 0} />
        <StatCard label="Today's discharges" value={stats?.dischargesToday ?? 0} />
        <StatCard label="Pending calls" value={stats?.pending ?? 0} />
        <StatCard label="Completed calls" value={stats?.totalCompleted ?? 0} />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by patient name, phone, or lead reference"
            className="pl-9 pr-9"
            aria-label="Search"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
            <SelectTrigger aria-label="Filter by hospital">
              <SelectValue placeholder="All hospitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All hospitals</SelectItem>
              {filterOptions?.hospitals.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger aria-label="Filter by doctor">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All doctors</SelectItem>
              {filterOptions?.surgeons.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bdFilter} onValueChange={setBdFilter}>
            <SelectTrigger aria-label="Filter by BD">
              <SelectValue placeholder="All BDs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All BDs</SelectItem>
              {filterOptions?.bds.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasNonStatusFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

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
            {hasNonStatusFilter ? (
              <>
                No patients match these filters.{" "}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              "No patients to follow up."
            )}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
    </div>
  )
}
