import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import type {
  CumulativeConcernCategoryKey,
  CumulativeConcernCategoryReport,
  CumulativeKpiCounts,
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

export interface SaveCumulativeReportInput {
  year: number
  patientCountsByMonth: Record<string, CumulativeKpiCounts>
  concernCountsByCategory: Record<CumulativeConcernCategoryKey, number[]>
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

export function useSaveCumulativeReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SaveCumulativeReportInput) =>
      apiPatch<CumulativeReportResponse>('/api/cumulative-report', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['cumulative-report', { year: data.year }], data)
    },
  })
}

export function buildCumulativeExportUrl(filters: CumulativeReportFilters): string {
  return `/api/cumulative-report/export?year=${filters.year}`
}
