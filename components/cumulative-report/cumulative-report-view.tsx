"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react"
import { format } from "date-fns"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildCumulativeExportUrl,
  useCumulativeReport,
  useCumulativeReportFilterOptions,
  type CumulativeDatePreset,
  type CumulativeReportStatus,
} from "@/hooks/use-cumulative-report"

const ALL = "ALL"

const DATE_PRESETS: { value: CumulativeDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Date Range" },
  { value: "all", label: "All Time" },
]

type SortKey = "date" | "patientName" | "hospitalName" | "circle" | "status" | "bd"

const PAGE_SIZE = 20

export function CumulativeReportView() {
  const [datePreset, setDatePreset] = useState<CumulativeDatePreset>("this_month")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [hospitalFilter, setHospitalFilter] = useState(ALL)
  const [circleFilter, setCircleFilter] = useState(ALL)
  const [treatmentFilter, setTreatmentFilter] = useState(ALL)
  const [referralFilter, setReferralFilter] = useState("")
  const [bdFilter, setBdFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [
    datePreset,
    customStart,
    customEnd,
    hospitalFilter,
    circleFilter,
    treatmentFilter,
    referralFilter,
    bdFilter,
    statusFilter,
    debouncedSearch,
    sortKey,
    sortDir,
  ])

  const { data: filterOptions } = useCumulativeReportFilterOptions()

  const queryFilters = useMemo(
    () => ({
      datePreset,
      startDate: datePreset === "custom" ? customStart || null : null,
      endDate: datePreset === "custom" ? customEnd || null : null,
      hospital: hospitalFilter === ALL ? null : hospitalFilter,
      circle: circleFilter === ALL ? null : circleFilter,
      treatment: treatmentFilter === ALL ? null : treatmentFilter,
      referralName: referralFilter.trim() || null,
      bdId: bdFilter === ALL ? null : bdFilter,
      status: statusFilter === ALL ? null : (statusFilter as CumulativeReportStatus),
      search: debouncedSearch || null,
      page,
      limit: PAGE_SIZE,
      sort: sortKey,
      dir: sortDir,
    }),
    [
      datePreset,
      customStart,
      customEnd,
      hospitalFilter,
      circleFilter,
      treatmentFilter,
      referralFilter,
      bdFilter,
      statusFilter,
      debouncedSearch,
      page,
      sortKey,
      sortDir,
    ],
  )

  const { data, isLoading, isError } = useCumulativeReport(queryFilters)
  const summary = data?.summary

  const hasActiveFilters =
    datePreset !== "this_month" ||
    hospitalFilter !== ALL ||
    circleFilter !== ALL ||
    treatmentFilter !== ALL ||
    referralFilter.trim() !== "" ||
    bdFilter !== ALL ||
    statusFilter !== ALL ||
    debouncedSearch !== ""

  const clearFilters = () => {
    setDatePreset("this_month")
    setCustomStart("")
    setCustomEnd("")
    setHospitalFilter(ALL)
    setCircleFilter(ALL)
    setTreatmentFilter(ALL)
    setReferralFilter("")
    setBdFilter(ALL)
    setStatusFilter(ALL)
    setSearchInput("")
    setDebouncedSearch("")
    setPage(1)
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const url = buildCumulativeExportUrl(queryFilters)
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `cumulative-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      // silent — user sees no download
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                Cumulative Report
              </h1>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleExport}
            disabled={exporting || isLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export Excel"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryCard label="Total patients" value={summary?.totalPatients ?? 0} tone="emerald" />
          <SummaryCard label="Total surgeries" value={summary?.totalSurgeries ?? 0} tone="sky" />
          <SummaryCard label="Planning" value={summary?.planning ?? 0} tone="slate" />
          <SummaryCard label="IPD done" value={summary?.ipdDone ?? 0} tone="amber" />
          <SummaryCard label="Pending" value={summary?.pending ?? 0} tone="orange" />
          <SummaryCard label="Cancelled" value={summary?.cancelled ?? 0} tone="rose" />
          <SummaryCard label="Follow-up" value={summary?.followUp ?? 0} tone="sky" />
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
                  {hasActiveFilters ? "Filters applied" : "Narrow the report"}
                </p>
              </div>
              {filtersOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {hasActiveFilters && (
              <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="rounded-full">
                Clear filters
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
              <FilterField
                label="Date range"
                icon={FileSpreadsheet}
                content={
                  <div className="space-y-2">
                    <Select
                      value={datePreset}
                      onValueChange={(v) => setDatePreset(v as CumulativeDatePreset)}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATE_PRESETS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {datePreset === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="h-10 rounded-xl"
                        />
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="h-10 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                }
              />

              <FilterField
                label="Hospital"
                icon={Building2}
                content={
                  <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
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
                label="Circle"
                icon={CircleDot}
                content={
                  <Select value={circleFilter} onValueChange={setCircleFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="All circles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All circles</SelectItem>
                      {filterOptions?.circles.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />

              <FilterField
                label="Treatment"
                icon={Stethoscope}
                content={
                  <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="All treatments" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      <SelectItem value={ALL}>All treatments</SelectItem>
                      {filterOptions?.treatments.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />

              <FilterField
                label="Referral name"
                icon={UserRound}
                content={
                  <Input
                    value={referralFilter}
                    onChange={(e) => setReferralFilter(e.target.value)}
                    placeholder="Referral name"
                    className="h-11 rounded-xl"
                  />
                }
              />

              <FilterField
                label="Business developer"
                icon={UserRound}
                content={
                  <Select value={bdFilter} onValueChange={setBdFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
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

              <FilterField
                label="Status"
                icon={CircleDot}
                content={
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All statuses</SelectItem>
                      {(data?.statusOptions ?? []).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />

              <FilterField
                label="Search"
                icon={Search}
                content={
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Patient name or mobile"
                      className="h-11 rounded-xl pl-9 pr-9"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => setSearchInput("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/75">
        <CardContent className="px-0 pt-0">
          <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Report</h2>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {data?.totalRecords ?? 0} records
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              Loading report…
            </div>
          ) : isError ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-destructive">
              Failed to load report. Refresh and try again.
            </div>
          ) : (
            <>
              <div className="max-h-[min(70vh,720px)] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Sr. No.</TableHead>
                      <SortHead label="Date" active={sortKey === "date"} dir={sortDir} onClick={() => toggleSort("date")} />
                      <SortHead label="Patient Name" active={sortKey === "patientName"} dir={sortDir} onClick={() => toggleSort("patientName")} />
                      <TableHead className="whitespace-nowrap">Patient Contact</TableHead>
                      <TableHead className="whitespace-nowrap">Referral Name</TableHead>
                      <TableHead className="whitespace-nowrap">Referral Contact</TableHead>
                      <TableHead className="whitespace-nowrap">Treatment</TableHead>
                      <SortHead label="Hospital Name" active={sortKey === "hospitalName"} dir={sortDir} onClick={() => toggleSort("hospitalName")} />
                      <SortHead label="Circle" active={sortKey === "circle"} dir={sortDir} onClick={() => toggleSort("circle")} />
                      <SortHead label="Business Developer" active={sortKey === "bd"} dir={sortDir} onClick={() => toggleSort("bd")} />
                      <SortHead label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.data ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                          No records match the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.data.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="tabular-nums">{row.srNo}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.date || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{row.patientName}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{row.patientContact || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.referralName || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{row.referralContact || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.treatment || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.hospitalName || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.circle || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.businessDeveloper || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="rounded-full">
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {(data?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-sm text-muted-foreground">
                    Page {data?.page ?? 1} of {data?.totalPages ?? 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={page >= (data?.totalPages ?? 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-current/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
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

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
}) {
  return (
    <TableHead className="whitespace-nowrap">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-emerald-700 dark:hover:text-emerald-300",
          active && "text-emerald-700 dark:text-emerald-300",
        )}
      >
        {label}
        {active && <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  )
}
