export const CUMULATIVE_KPI_LABELS = [
  'Total Surgeries Done',
  'MediEnd Managed Cases',
  'Offline Business',
  'Connected Calls',
  'Calls Not Connected',
  'Patient Satisfied',
  'Patient Not Satisfied',
] as const

export type CumulativeKpiKey =
  | 'totalSurgeries'
  | 'mediendManaged'
  | 'offlineBusiness'
  | 'connectedCalls'
  | 'callsNotConnected'
  | 'patientSatisfied'
  | 'patientNotSatisfied'

export type CumulativeKpiCounts = Record<CumulativeKpiKey, number>

export type CumulativeKpiPercentages = Record<CumulativeKpiKey, number | null>

export type CumulativePatientSummaryMonth = {
  monthKey: string
  label: string
  counts: CumulativeKpiCounts
  percentages: CumulativeKpiPercentages
}

export type CumulativeKpiPerformanceRow = {
  sno: number
  kpi: (typeof CUMULATIVE_KPI_LABELS)[number]
  count: number
  percentage: number | null
}

export type CumulativeKpiPerformance = {
  monthKey: string
  label: string
  rows: CumulativeKpiPerformanceRow[]
}

export const PATIENT_SUMMARY_COLUMNS: { key: CumulativeKpiKey; label: string }[] = [
  { key: 'totalSurgeries', label: 'Total Surgeries Done' },
  { key: 'mediendManaged', label: 'MediEnd Managed Cases' },
  { key: 'offlineBusiness', label: 'Offline Business' },
  { key: 'connectedCalls', label: 'Connected Calls' },
  { key: 'callsNotConnected', label: 'Calls Not Connected' },
  { key: 'patientSatisfied', label: 'Patient Satisfied' },
  { key: 'patientNotSatisfied', label: 'Patient Not Satisfied' },
]

export function formatKpiPercentage(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
}
