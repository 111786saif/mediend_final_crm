"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardX,
  Clock3,
  Filter,
  PhoneCall,
  PhoneOff,
  Scissors,
  Search,
  Stethoscope,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const FILTERS: {
  value: StatusFilter
  label: string
  hint: string
  activeClass: string
  idleClass: string
}[] = [
  {
    value: "ALL",
    label: "All calls",
    hint: "Full discharge queue",
    activeClass: "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900",
    idleClass: "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200",
  },
  {
    value: "PENDING",
    label: "Pending",
    hint: "Needs first follow-up",
    activeClass: "border-amber-500 bg-amber-500 text-white",
    idleClass: "border-amber-200 bg-amber-50/80 text-amber-800 hover:border-amber-300 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200",
  },
  {
    value: "CALLBACK_SCHEDULED",
    label: "Callbacks",
    hint: "Reach again later",
    activeClass: "border-sky-500 bg-sky-500 text-white",
    idleClass: "border-sky-200 bg-sky-50/80 text-sky-800 hover:border-sky-300 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200",
  },
  {
    value: "COMPLETED",
    label: "Completed",
    hint: "Feedback captured",
    activeClass: "border-emerald-500 bg-emerald-500 text-white",
    idleClass: "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:border-emerald-300 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200",
  },
  {
    value: "DID_NOT_PICK",
    label: "Did not pick",
    hint: "No answer yet",
    activeClass: "border-orange-500 bg-orange-500 text-white",
    idleClass: "border-orange-200 bg-orange-50/80 text-orange-800 hover:border-orange-300 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200",
  },
  {
    value: "WRONG_NUMBER",
    label: "Wrong number",
    hint: "Number issue found",
    activeClass: "border-rose-500 bg-rose-500 text-white",
    idleClass: "border-rose-200 bg-rose-50/80 text-rose-800 hover:border-rose-300 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200",
  },
]

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface MonthOption {
  value: string
  label: string
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editing, setEditing] = useState<ComplianceCall | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const monthOptions = useMemo(() => buildMonthOptions(12), [])
  const { data: filterOptions } = useComplianceFilterOptions()

  const dischargeRange = useMemo(
    () => (monthFilter === ALL ? null : monthRange(monthFilter)),
    [monthFilter],
  )

  const { data: stats } = useComplianceStats({
    dischargeStart: dischargeRange?.start ?? null,
    dischargeEnd: dischargeRange?.end ?? null,
  })

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

  const selectedMonthLabel =
    monthFilter === ALL
      ? "All discharge months"
      : monthOptions.find((m) => m.value === monthFilter)?.label ?? "Selected month"

  const hasNonStatusFilter =
    debouncedSearch !== "" ||
    hospitalFilter !== ALL ||
    doctorFilter !== ALL ||
    bdFilter !== ALL ||
    monthFilter !== ALL

  const activeFilters = [
    monthFilter !== ALL ? `Month: ${selectedMonthLabel}` : null,
    hospitalFilter !== ALL ? `Hospital: ${hospitalFilter}` : null,
    doctorFilter !== ALL ? `Doctor: ${doctorFilter}` : null,
    bdFilter !== ALL
      ? `BD: ${filterOptions?.bds.find((b) => b.id === bdFilter)?.name ?? "Selected"}`
      : null,
    debouncedSearch ? `Search: ${debouncedSearch}` : null,
  ].filter((value): value is string => Boolean(value))

  const clearFilters = () => {
    setSearchInput("")
    setDebouncedSearch("")
    setHospitalFilter(ALL)
    setDoctorFilter(ALL)
    setBdFilter(ALL)
    setMonthFilter(currentMonthValue())
  }

  const totalTracked =
    (stats?.pendingCount ?? 0) +
    (stats?.completedCount ?? 0) +
    (stats?.dnpCount ?? 0)

  return (
    <div className="space-y-6 pb-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                Compliance
              </h1>
            </div>
          </div>

          <div className="w-full sm:w-[210px]">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger
                className="h-11 rounded-xl border-emerald-200 bg-white shadow-sm dark:border-emerald-900/60 dark:bg-slate-950/60"
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
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <HeroMetricCard
            label="Total surgeries"
            value={stats?.totalSurgeries ?? 0}
            hint={selectedMonthLabel}
            icon={Scissors}
            tone="emerald"
          />
          <HeroMetricCard
            label="Pending calls"
            value={stats?.pendingCount ?? 0}
            hint="Needs action"
            icon={Clock3}
            tone="amber"
          />
          <HeroMetricCard
            label="Completed calls"
            value={stats?.completedCount ?? 0}
            hint={`${totalTracked} tracked cases`}
            icon={CheckCircle2}
            tone="slate"
          />
          <HeroMetricCard
            label="DNP"
            value={stats?.dnpCount ?? 0}
            hint="Did not pick"
            icon={PhoneOff}
            tone="orange"
          />
          <HeroMetricCard
            label="Review done"
            value={stats?.reviewDoneCount ?? 0}
            hint="Google review posted"
            icon={ClipboardCheck}
            tone="sky"
          />
          <HeroMetricCard
            label="Review not done"
            value={stats?.reviewNotDoneCount ?? 0}
            hint="Review pending"
            icon={ClipboardX}
            tone="rose"
          />
        </div>
      </section>

      <Card className="border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex items-center gap-2 text-left text-slate-900 transition hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-300"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Filters</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {activeFilters.length > 0 ? `${activeFilters.length} active` : "Search and narrow the queue"}
                </p>
              </div>
              {filtersOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {hasNonStatusFilter && (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="rounded-full">
                Clear filters
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.8fr))]">
              <FilterField
                label="Find patient"
                icon={Search}
                content={
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Patient name, phone, or lead reference"
                      className="h-11 rounded-xl border-slate-200 bg-white pl-9 pr-9 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
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
                }
              />

              <FilterField
                label="Hospital"
                icon={Building2}
                content={
                  <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60" aria-label="Filter by hospital">
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
                }
              />

              <FilterField
                label="Doctor"
                icon={Stethoscope}
                content={
                  <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60" aria-label="Filter by doctor">
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
                }
              />

              <FilterField
                label="Business developer"
                icon={UserRound}
                content={
                  <Select value={bdFilter} onValueChange={setBdFilter}>
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60" aria-label="Filter by BD">
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
                }
              />
            </div>
          )}

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Active
              </span>
              {activeFilters.map((filter) => (
                <Badge
                  key={filter}
                  variant="outline"
                  className="rounded-full border-emerald-200 bg-emerald-50/80 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
                >
                  {filter}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Status
            </h2>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 sm:flex">
            <PhoneCall className="h-3.5 w-3.5" />
            Tap a lane to focus the queue
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {FILTERS.map((f) => {
            const active = statusFilter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all duration-150",
                  active ? `${f.activeClass} shadow-md` : f.idleClass,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        active ? "text-white/85" : "text-current/70",
                      )}
                    >
                      {f.hint}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-0.5 h-2.5 w-2.5 rounded-full",
                      active ? "bg-white" : "bg-current/50",
                    )}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/75">
        <CardContent className="px-0 pt-0">
          <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Patients
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  {allCalls.length} loaded
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  {statusFilter === ALL
                    ? "All statuses"
                    : FILTERS.find((f) => f.value === statusFilter)?.label ?? "Filtered"}
                </Badge>
              </div>
            </div>
          </div>

          {isLoading ? (
            <DashboardMessage
              title="Loading the queue"
              body="Pulling the latest post-discharge calls."
            />
          ) : isError ? (
            <DashboardMessage
              title="Failed to load calls"
              body="Refresh the page to try again."
              tone="error"
            />
          ) : allCalls.length === 0 ? (
            <DashboardEmptyState
              hasFilters={hasNonStatusFilter}
              onClear={clearFilters}
            />
          ) : (
            <>
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {allCalls.map((call) => (
                  <ComplianceCallRow key={call.id} call={call} onEdit={setEditing} />
                ))}
              </div>

              {hasNextPage && (
                <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 text-center dark:border-slate-800 dark:bg-slate-900/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full px-5"
                  >
                    {isFetchingNextPage ? "Loading more..." : "Load more patients"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ComplianceFeedbackDrawer
        call={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}

function HeroMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone: "emerald" | "sky" | "amber" | "slate" | "orange" | "rose"
}) {
  const toneClasses = {
    emerald: "border-emerald-200/80 bg-white/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
    sky: "border-sky-200/80 bg-white/80 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
    amber: "border-amber-200/80 bg-white/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
    slate: "border-slate-200/80 bg-white/80 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
    orange: "border-orange-200/80 bg-white/80 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200",
    rose: "border-rose-200/80 bg-white/80 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
  } as const

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm backdrop-blur", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-current/70">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-current/70">{hint}</p>
        </div>
        <div className="rounded-2xl bg-white/90 p-2 shadow-sm dark:bg-slate-950/50">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function FilterField({
  label,
  icon: Icon,
  content,
}: {
  label: string
  icon: typeof Search
  content: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      {content}
    </div>
  )
}

function DashboardMessage({
  title,
  body,
  tone = "default",
}: {
  title: string
  body: string
  tone?: "default" | "error"
}) {
  return (
    <div className="flex min-h-[240px] items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        <div
          className={cn(
            "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl",
            tone === "error"
              ? "bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300",
          )}
        >
          <PhoneCall className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  )
}

function DashboardEmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean
  onClear: () => void
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          <Search className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {hasFilters ? "No patients match this view" : "No patients to follow up right now"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {hasFilters
            ? "Try loosening one or two filters to bring the queue back into view."
            : "Once discharge-linked cases are available, they will appear here automatically."}
        </p>
        {hasFilters && (
          <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
