import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type {
  CumulativeConcernCategoryReport,
  CumulativePatientSummaryMonth,
} from '@/lib/cumulative-report-monthly-shared'

export type { CumulativePatientSummaryMonth, CumulativeConcernCategoryReport }

export interface CumulativeReportFilters {
  year: number
}

export interface CumulativeReportResponse {
  year: number
  patientSummary: CumulativePatientSummaryMonth[]
  concernCategory: CumulativeConcernCategoryReport
}

function buildQueryString(filters: CumulativeReportFilters): string {
  const params = new URLSearchParams()
  params.set('year', String(filters.year))
  return `?${params.toString()}`
}

export function useCumulativeReport(filters: CumulativeReportFilters) {
  return useQuery<CumulativeReportResponse>({
    queryKey: ['cumulative-report', filters],
    queryFn: () => apiGet<CumulativeReportResponse>(`/api/cumulative-report${buildQueryString(filters)}`),
    placeholderData: (prev) => prev,
  })
}

export function buildCumulativeExportUrl(filters: CumulativeReportFilters): string {
  return `/api/cumulative-report/export?year=${filters.year}`
}
