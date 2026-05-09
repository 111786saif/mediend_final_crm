"use client"

import { cn } from "@/lib/utils"
import {
  CONCERN_CATEGORY_LABEL,
  type ConcernCategory,
} from "@/hooks/use-compliance-calls"
import type { MonthlyReport, MonthlyReportRow } from "@/hooks/use-compliance-monthly-report"

interface Props {
  report: MonthlyReport
}

export function MonthlyReportTable({ report }: Props) {
  const totals: MonthlyReportRow = {
    month: 0,
    label: "Total",
    totalSurgeries: 0,
    connected: 0,
    notConnected: 0,
    satisfied: 0,
    notSatisfied: 0,
    neutral: 0,
    concerns: Object.fromEntries(
      report.categories.map((c) => [c, 0]),
    ) as Record<ConcernCategory, number>,
  }
  for (const m of report.months) {
    totals.totalSurgeries += m.totalSurgeries
    totals.connected += m.connected
    totals.notConnected += m.notConnected
    totals.satisfied += m.satisfied
    totals.notSatisfied += m.notSatisfied
    totals.neutral += m.neutral
    for (const c of report.categories) totals.concerns[c] += m.concerns[c] ?? 0
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Th className="sticky left-0 bg-muted/40">Month</Th>
            <Th>Surgeries</Th>
            <Th>Connected</Th>
            <Th>Not connected</Th>
            <Th>Satisfied</Th>
            <Th>Not satisfied</Th>
            {report.categories.map((c) => (
              <Th key={c}>{CONCERN_CATEGORY_LABEL[c]}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.months.map((m) => (
            <Row key={m.month} row={m} categories={report.categories} />
          ))}
          <Row row={totals} categories={report.categories} isTotal />
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-2 text-left whitespace-nowrap", className)}>{children}</th>
  )
}

function Row({
  row,
  categories,
  isTotal,
}: {
  row: MonthlyReportRow
  categories: ConcernCategory[]
  isTotal?: boolean
}) {
  return (
    <tr
      className={cn(
        "border-t",
        isTotal ? "bg-muted/30 font-semibold" : "hover:bg-muted/20",
      )}
    >
      <td
        className={cn(
          "px-3 py-2 sticky left-0",
          isTotal ? "bg-muted/30" : "bg-card",
        )}
      >
        {row.label}
      </td>
      <td className="px-3 py-2 tabular-nums">{row.totalSurgeries || "—"}</td>
      <td className="px-3 py-2 tabular-nums text-emerald-700 dark:text-emerald-400">
        {row.connected || "—"}
      </td>
      <td className="px-3 py-2 tabular-nums text-muted-foreground">
        {row.notConnected || "—"}
      </td>
      <td className="px-3 py-2 tabular-nums text-emerald-700 dark:text-emerald-400">
        {row.satisfied || "—"}
      </td>
      <td className="px-3 py-2 tabular-nums text-red-600 dark:text-red-400">
        {row.notSatisfied || "—"}
      </td>
      {categories.map((c) => (
        <td key={c} className="px-3 py-2 tabular-nums text-muted-foreground">
          {row.concerns[c] || "—"}
        </td>
      ))}
    </tr>
  )
}
