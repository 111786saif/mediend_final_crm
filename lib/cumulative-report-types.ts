export type CumulativeReportStatus =
  | 'Planning'
  | 'IPD Done'
  | 'Pending'
  | 'Cancelled'
  | 'Follow-up'

export const CUMULATIVE_REPORT_STATUSES: CumulativeReportStatus[] = [
  'Planning',
  'IPD Done',
  'Pending',
  'Cancelled',
  'Follow-up',
]

export type CumulativeDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all'

export interface CumulativeReportFilters {
  datePreset?: CumulativeDatePreset | null
  startDate?: string | null
  endDate?: string | null
  hospital?: string | null
  circle?: string | null
  treatment?: string | null
  referralName?: string | null
  bdId?: string | null
  status?: CumulativeReportStatus | null
  search?: string | null
}

export interface CumulativeReportRow {
  id: string
  date: string
  patientName: string
  patientContact: string
  referralName: string
  referralContact: string
  treatment: string
  hospitalName: string
  circle: string
  businessDeveloper: string
  status: CumulativeReportStatus
}

export interface CumulativeReportSummary {
  totalPatients: number
  totalSurgeries: number
  planning: number
  ipdDone: number
  pending: number
  cancelled: number
  followUp: number
  patientSatisfied: number
  patientNotSatisfied: number
}
