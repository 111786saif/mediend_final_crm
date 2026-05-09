import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import type { ConcernCategory } from "./use-compliance-calls"

export interface MonthlyReportRow {
  month: number
  label: string
  totalSurgeries: number
  connected: number
  notConnected: number
  satisfied: number
  notSatisfied: number
  neutral: number
  concerns: Record<ConcernCategory, number>
}

export interface MonthlyReport {
  year: number
  months: MonthlyReportRow[]
  categories: ConcernCategory[]
}

export function useMonthlyComplianceReport(year: number) {
  return useQuery<MonthlyReport>({
    queryKey: ["compliance", "monthly-report", year],
    queryFn: () => apiGet<MonthlyReport>(`/api/compliance/monthly-report?year=${year}`),
  })
}
