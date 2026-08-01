import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type {
  CumulativeDatePreset,
  CumulativeReportRow,
  CumulativeReportStatus,
  CumulativeReportSummary,
} from '@/lib/cumulative-report-types'
import type {
  CumulativeKpiPerformance,
  CumulativePatientSummaryMonth,
} from '@/lib/cumulative-report-monthly-shared'

export type { CumulativeDatePreset, CumulativeReportStatus, CumulativeReportRow, CumulativeReportSummary } from '@/lib/cumulative-report-types'
export type { CumulativeKpiPerformance, CumulativePatientSummaryMonth } from '@/lib/cumulative-report-monthly-shared'

export interface CumulativeReportFilters {
  datePreset: CumulativeDatePreset
  startDate?: string | null
  endDate?: string | null
  hospital?: string | null
  circle?: string | null
  treatment?: string | null
  referralName?: string | null
  bdId?: string | null
  status?: CumulativeReportStatus | null
  search?: string | null
  page?: number
  limit?: number
  sort?: string | null
  dir?: 'asc' | 'desc' | null
  kpiMonth?: string | null
}

export interface CumulativeReportResponse {
  summary: CumulativeReportSummary
  totalRecords: number
  page: number
  pageSize: number
  totalPages: number
  data: Array<CumulativeReportRow & { srNo: number }>
  statusOptions: CumulativeReportStatus[]
  patientSummary: CumulativePatientSummaryMonth[]
  kpiPerformance: CumulativeKpiPerformance | null
}

export interface CumulativeFilterOptions {
  hospitals: string[]
  circles: string[]
  treatments: string[]
  bds: { id: string; name: string }[]
}

function buildQueryString(filters: CumulativeReportFilters): string {
  const params = new URLSearchParams()
  if (filters.datePreset) params.set('datePreset', filters.datePreset)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.hospital) params.set('hospital', filters.hospital)
  if (filters.circle) params.set('circle', filters.circle)
  if (filters.treatment) params.set('treatment', filters.treatment)
  if (filters.referralName) params.set('referralName', filters.referralName)
  if (filters.bdId) params.set('bdId', filters.bdId)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.dir) params.set('dir', filters.dir)
  if (filters.kpiMonth) params.set('kpiMonth', filters.kpiMonth)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useCumulativeReport(filters: CumulativeReportFilters) {
  return useQuery<CumulativeReportResponse>({
    queryKey: ['cumulative-report', filters],
    queryFn: () => apiGet<CumulativeReportResponse>(`/api/cumulative-report${buildQueryString(filters)}`),
    placeholderData: (prev) => prev,
  })
}

export function useCumulativeReportFilterOptions() {
  return useQuery<CumulativeFilterOptions>({
    queryKey: ['cumulative-report', 'filter-options'],
    queryFn: () => apiGet<CumulativeFilterOptions>('/api/cumulative-report/filter-options'),
    staleTime: 5 * 60 * 1000,
  })
}

export function buildCumulativeExportUrl(filters: CumulativeReportFilters): string {
  const params = new URLSearchParams()
  if (filters.datePreset) params.set('datePreset', filters.datePreset)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.hospital) params.set('hospital', filters.hospital)
  if (filters.circle) params.set('circle', filters.circle)
  if (filters.treatment) params.set('treatment', filters.treatment)
  if (filters.referralName) params.set('referralName', filters.referralName)
  if (filters.bdId) params.set('bdId', filters.bdId)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.dir) params.set('dir', filters.dir)
  const qs = params.toString()
  return `/api/cumulative-report/export${qs ? `?${qs}` : ''}`
}
