"use client"

import { useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  buildCumulativeExportUrl,
  useCumulativeReport,
  useSaveCumulativeReport,
} from "@/hooks/use-cumulative-report"
import {
  computeCumulativeKpiPercentages,
  formatKpiPercentage,
  MONTH_SHORT_LABELS,
  type CumulativeConcernCategoryKey,
  type CumulativeConcernCategoryReport,
  type CumulativeKpiCounts,
  type CumulativeKpiKey,
} from "@/lib/cumulative-report-monthly-shared"

const KPI_CARD_TONES: Record<
  CumulativeKpiKey,
  "emerald" | "sky" | "slate" | "amber" | "orange" | "rose"
> = {
  totalSurgeries: "emerald",
  mediendManaged: "sky",
  offlineBusiness: "slate",
  connectedCalls: "amber",
  callsNotConnected: "orange",
  patientSatisfied: "emerald",
  patientNotSatisfied: "rose",
}

const PATIENT_SUMMARY_COLUMNS: { key: CumulativeKpiKey; label: string }[] = [
  { key: "totalSurgeries", label: "Total Surgeries Done" },
  { key: "mediendManaged", label: "MediEnd Managed Cases" },
  { key: "offlineBusiness", label: "Offline Business" },
  { key: "connectedCalls", label: "Connected Calls" },
  { key: "callsNotConnected", label: "Calls Not Connected" },
  { key: "patientSatisfied", label: "Patient Satisfied" },
  { key: "patientNotSatisfied", label: "Patient Not Satisfied" },
]

type ReportTab = "patient-summary" | "concern-category"
type SaveStatus = "idle" | "saving" | "saved" | "error"

function buildYearOptions(): number[] {
  const current = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => current - i)
}

function formatConcernPct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value.toFixed(2)}%`
}

function cloneCounts(counts: CumulativeKpiCounts): CumulativeKpiCounts {
  return { ...counts }
}

function cloneMonthlyCounts(values: number[]): number[] {
  return [...values]
}

export function CumulativeReportView() {
  const currentYear = new Date().getFullYear()
  const [activeTab, setActiveTab] = useState<ReportTab>("patient-summary")
  const [year, setYear] = useState(currentYear)
  const [exporting, setExporting] = useState(false)
  const [patientCountsByMonth, setPatientCountsByMonth] = useState<
    Record<string, CumulativeKpiCounts>
  >({})
  const [concernCountsByCategory, setConcernCountsByCategory] = useState<
    Record<CumulativeConcernCategoryKey, number[]>
  >({} as Record<CumulativeConcernCategoryKey, number[]>)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const skipNextSaveRef = useRef(true)
  const hydratedRef = useRef(false)

  const { data, isLoading, isError } = useCumulativeReport({ year })
  const { mutate: saveReport } = useSaveCumulativeReport()

  useEffect(() => {
    if (!data?.patientSummary) return
    const nextPatient: Record<string, CumulativeKpiCounts> = {}
    for (const month of data.patientSummary) {
      nextPatient[month.monthKey] = cloneCounts(month.counts)
    }
    setPatientCountsByMonth(nextPatient)

    if (data.concernCategory) {
      const nextConcern = {} as Record<CumulativeConcernCategoryKey, number[]>
      for (const row of data.concernCategory.rows) {
        nextConcern[row.key] = cloneMonthlyCounts(row.monthlyCounts)
      }
      setConcernCountsByCategory(nextConcern)
    }

    skipNextSaveRef.current = true
    hydratedRef.current = true
    setSaveStatus("idle")
  }, [data?.patientSummary, data?.concernCategory, year])

  useEffect(() => {
    if (!hydratedRef.current || isLoading) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      setSaveStatus("saving")
      saveReport(
        {
          year,
          patientCountsByMonth,
          concernCountsByCategory,
        },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("error"),
        },
      )
    }, 800)

    return () => window.clearTimeout(timer)
  }, [year, patientCountsByMonth, concernCountsByCategory, isLoading, saveReport])

  const patientSummaryRows = useMemo(() => {
    if (!data?.patientSummary) return []
    return data.patientSummary.map((month) => {
      const counts = patientCountsByMonth[month.monthKey] ?? month.counts
      return {
        ...month,
        counts,
        percentages: computeCumulativeKpiPercentages(counts),
      }
    })
  }, [data?.patientSummary, patientCountsByMonth])

  const monthlyUnsatisfiedTotals = useMemo(
    () =>
      patientSummaryRows.map((month) => month.counts.patientNotSatisfied),
    [patientSummaryRows],
  )

  const totalUnsatisfiedYtd = useMemo(
    () => monthlyUnsatisfiedTotals.reduce((sum, n) => sum + n, 0),
    [monthlyUnsatisfiedTotals],
  )

  const concernCategoryRows = useMemo(() => {
    if (!data?.concernCategory) return []
    return data.concernCategory.rows.map((row) => {
      const monthlyCounts = concernCountsByCategory[row.key] ?? row.monthlyCounts
      const totalYtd = monthlyCounts.reduce((sum, n) => sum + n, 0)
      return {
        ...row,
        monthlyCounts,
        totalYtd,
        pctOfUnsatisfiedYtd:
          totalUnsatisfiedYtd > 0
            ? Math.round((totalYtd / totalUnsatisfiedYtd) * 10000) / 100
            : null,
      }
    })
  }, [data?.concernCategory, concernCountsByCategory, totalUnsatisfiedYtd])

  const ytdTotals = useMemo(() => {
    const totals = {
      totalSurgeries: 0,
      mediendManaged: 0,
      offlineBusiness: 0,
      connectedCalls: 0,
      callsNotConnected: 0,
      patientSatisfied: 0,
      patientNotSatisfied: 0,
    }
    for (const month of patientSummaryRows) {
      for (const col of PATIENT_SUMMARY_COLUMNS) {
        totals[col.key] += month.counts[col.key]
      }
    }
    return totals
  }, [patientSummaryRows])

  const ytdPercentages = useMemo(
    () => computeCumulativeKpiPercentages(ytdTotals),
    [ytdTotals],
  )

  const updatePatientCount = (monthKey: string, kpiKey: CumulativeKpiKey, raw: string) => {
    const value = Math.max(0, parseInt(raw, 10) || 0)
    setPatientCountsByMonth((prev) => ({
      ...prev,
      [monthKey]: {
        ...(prev[monthKey] ?? cloneCounts(data?.patientSummary.find((m) => m.monthKey === monthKey)?.counts ?? {
          totalSurgeries: 0,
          mediendManaged: 0,
          offlineBusiness: 0,
          connectedCalls: 0,
          callsNotConnected: 0,
          patientSatisfied: 0,
          patientNotSatisfied: 0,
        })),
        [kpiKey]: value,
      },
    }))
  }

  const updateConcernCount = (
    categoryKey: CumulativeConcernCategoryKey,
    monthIndex: number,
    raw: string,
  ) => {
    const value = Math.max(0, parseInt(raw, 10) || 0)
    setConcernCountsByCategory((prev) => {
      const base =
        prev[categoryKey] ??
        cloneMonthlyCounts(
          data?.concernCategory.rows.find((r) => r.key === categoryKey)?.monthlyCounts ??
            Array.from({ length: 12 }, () => 0),
        )
      const next = cloneMonthlyCounts(base)
      next[monthIndex] = value
      return { ...prev, [categoryKey]: next }
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const url = buildCumulativeExportUrl({ year })
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `cumulative-report-${year}-${format(new Date(), "yyyy-MM-dd")}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      // silent
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
              <p className="text-sm text-slate-500 dark:text-slate-400">{year} year-to-date</p>
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {PATIENT_SUMMARY_COLUMNS.map((col) => (
            <SummaryKpiCard
              key={col.key}
              label={col.label}
              value={ytdTotals[col.key]}
              percentage={ytdPercentages[col.key]}
              tone={KPI_CARD_TONES[col.key]}
            />
          ))}
        </div>
      </section>

      <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-950/75">
        <CardContent className="px-0 pt-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ReportTab)}
            className="gap-0"
          >
            <div className="border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="h-10">
                  <TabsTrigger value="patient-summary">Patient Summary</TabsTrigger>
                  <TabsTrigger value="concern-category">Concern Category</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Year</span>
                    <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                      <SelectTrigger className="h-9 w-[120px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buildYearOptions().map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <SaveStatusLabel status={saveStatus} />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                Loading report…
              </div>
            ) : isError ? (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-destructive">
                Failed to load report. Refresh and try again.
              </div>
            ) : (
              <>
                <TabsContent value="patient-summary" className="mt-0">
                  <div className="max-h-[min(75vh,800px)] overflow-auto p-5">
                    <ReportTable>
                      <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                        <TableRow>
                          <TableHead className="min-w-[140px] text-center">Month</TableHead>
                          {PATIENT_SUMMARY_COLUMNS.map((col) => (
                            <TableHead key={col.key} className="min-w-[120px] text-center">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientSummaryRows.map((month) => (
                          <Fragment key={month.monthKey}>
                            <TableRow>
                              <TableCell
                                rowSpan={2}
                                className="align-middle text-center font-medium"
                              >
                                {month.label}
                              </TableCell>
                              {PATIENT_SUMMARY_COLUMNS.map((col) => (
                                <TableCell key={col.key} className="p-1 text-center">
                                  <EditableCountInput
                                    value={month.counts[col.key]}
                                    onChange={(v) => updatePatientCount(month.monthKey, col.key, v)}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                            <TableRow>
                              {PATIENT_SUMMARY_COLUMNS.map((col) => (
                                <TableCell
                                  key={col.key}
                                  className="text-center tabular-nums text-muted-foreground"
                                >
                                  {formatKpiPercentage(month.percentages[col.key])}
                                </TableCell>
                              ))}
                            </TableRow>
                          </Fragment>
                        ))}
                      </TableBody>
                    </ReportTable>
                  </div>
                </TabsContent>

                <TabsContent value="concern-category" className="mt-0">
                  <div className="max-h-[min(75vh,800px)] overflow-auto p-5">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Concern Category (Patient Satisfaction)
                    </h2>
                    <p className="mt-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                      Note: A single patient may report multiple concerns. Therefore, the total number of
                      concerns can exceed the total number of unsatisfied patients.
                    </p>
                    <ConcernCategoryTable
                      year={year}
                      rows={concernCategoryRows}
                      monthlyUnsatisfiedTotals={monthlyUnsatisfiedTotals}
                      totalUnsatisfiedYtd={totalUnsatisfiedYtd}
                      onUpdateCount={updateConcernCount}
                    />
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "idle") return null

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : "Save failed — retry by editing a value"

  const tone =
    status === "error"
      ? "text-rose-600 dark:text-rose-400"
      : status === "saved"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-slate-500 dark:text-slate-400"

  return <span className={cn("text-xs font-medium", tone)}>{label}</span>
}

function SummaryKpiCard({
  label,
  value,
  percentage,
  tone,
}: {
  label: string
  value: number
  percentage: number | null
  tone: "emerald" | "sky" | "slate" | "amber" | "orange" | "rose"
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-sm tabular-nums text-current/80">
        {formatKpiPercentage(percentage)}
      </p>
    </div>
  )
}

function EditableCountInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: string) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      inputMode="numeric"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="mx-auto h-8 w-[72px] rounded-md border-slate-200 bg-white px-2 text-center tabular-nums dark:border-slate-700 dark:bg-slate-950"
    />
  )
}

function ConcernCategoryTable({
  year,
  rows,
  monthlyUnsatisfiedTotals,
  totalUnsatisfiedYtd,
  onUpdateCount,
}: {
  year: number
  rows: CumulativeConcernCategoryReport["rows"]
  monthlyUnsatisfiedTotals: number[]
  totalUnsatisfiedYtd: number
  onUpdateCount: (
    categoryKey: CumulativeConcernCategoryKey,
    monthIndex: number,
    raw: string,
  ) => void
}) {
  return (
    <ReportTable>
      <TableHeader className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
        <TableRow>
          <TableHead className="w-14 text-center">S. No.</TableHead>
          <TableHead className="min-w-[200px]">Concern Category</TableHead>
          {MONTH_SHORT_LABELS.map((label) => (
            <TableHead key={label} className="min-w-[88px] text-center">
              {label} {year}
            </TableHead>
          ))}
          <TableHead className="min-w-[100px] text-center">Total (YTD)</TableHead>
          <TableHead className="min-w-[160px] text-center">
            % of Unsatisfied Patients* (YTD)
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.key}>
            <TableCell className="text-center tabular-nums">{index + 1}</TableCell>
            <TableCell className="font-medium">{row.label}</TableCell>
            {row.monthlyCounts.map((count, monthIndex) => {
              const monthDen = monthlyUnsatisfiedTotals[monthIndex] ?? 0
              const monthPct =
                monthDen > 0 ? Math.round((count / monthDen) * 10000) / 100 : null
              return (
                <TableCell key={`${row.key}-${monthIndex}`} className="p-1 text-center">
                  <EditableCountInput
                    value={count}
                    onChange={(v) => onUpdateCount(row.key, monthIndex, v)}
                  />
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {formatConcernPct(monthPct)}
                  </p>
                </TableCell>
              )
            })}
            <TableCell className="text-center tabular-nums font-semibold">{row.totalYtd}</TableCell>
            <TableCell className="text-center tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
              {formatConcernPct(row.pctOfUnsatisfiedYtd)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-slate-50/80 font-semibold dark:bg-slate-900/60">
          <TableCell colSpan={2} className="text-right">
            Total Unsatisfied Patients
          </TableCell>
          {monthlyUnsatisfiedTotals.map((total, monthIndex) => (
            <TableCell key={`unsatisfied-${monthIndex}`} className="text-center tabular-nums">
              {total}
            </TableCell>
          ))}
          <TableCell className="text-center tabular-nums">{totalUnsatisfiedYtd}</TableCell>
          <TableCell className="text-center tabular-nums text-emerald-700 dark:text-emerald-300">
            {totalUnsatisfiedYtd > 0 ? "100%" : "—"}
          </TableCell>
        </TableRow>
      </TableBody>
    </ReportTable>
  )
}

function ReportTable({ children }: { children: ReactNode }) {
  return (
    <Table className="border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-200 [&_td]:border-slate-200 dark:[&_th]:border-slate-700 dark:[&_td]:border-slate-700">
      {children}
    </Table>
  )
}
