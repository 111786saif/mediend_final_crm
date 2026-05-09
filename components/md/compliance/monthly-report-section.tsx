"use client"

import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMonthlyComplianceReport } from "@/hooks/use-compliance-monthly-report"
import { MonthlyReportTable } from "./monthly-report-table"

export function MonthlyReportSection() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState<number>(currentYear)
  const years = [currentYear, currentYear - 1, currentYear - 2]
  const { data, isLoading, isError, refetch } = useMonthlyComplianceReport(year)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Monthly cumulative report</h2>
          <p className="text-xs text-muted-foreground">
            Surgeries grouped by date of surgery · Compliance call outcome &
            concern categories per month
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : isError ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-destructive">Failed to load report.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <MonthlyReportTable report={data} />
      ) : null}
    </div>
  )
}
