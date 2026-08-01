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

export function computeCumulativeKpiPercentages(counts: CumulativeKpiCounts): CumulativeKpiPercentages {
  const total = counts.totalSurgeries
  const mediend = counts.mediendManaged
  const connected = counts.connectedCalls

  const pct = (num: number, den: number): number | null => {
    if (den <= 0) return null
    return Math.round((num / den) * 100)
  }

  return {
    totalSurgeries: total > 0 ? 100 : null,
    mediendManaged: pct(mediend, total),
    offlineBusiness: pct(counts.offlineBusiness, total),
    connectedCalls: pct(connected, mediend),
    callsNotConnected: pct(counts.callsNotConnected, mediend),
    patientSatisfied: pct(counts.patientSatisfied, connected),
    patientNotSatisfied: pct(counts.patientNotSatisfied, connected),
  }
}

export type CumulativeConcernCategoryKey =
  | 'BD'
  | 'PAYMENT'
  | 'NO_UPDATE_FOLLOWUP'
  | 'SURGERY_RELATED'
  | 'DOCTOR'
  | 'HOSPITAL_STAFF'
  | 'CAB_PAYMENT'
  | 'OTHERS'

export const CUMULATIVE_CONCERN_CATEGORY_ORDER: CumulativeConcernCategoryKey[] = [
  'BD',
  'PAYMENT',
  'NO_UPDATE_FOLLOWUP',
  'SURGERY_RELATED',
  'DOCTOR',
  'HOSPITAL_STAFF',
  'CAB_PAYMENT',
  'OTHERS',
]

export const CUMULATIVE_CONCERN_CATEGORY_LABEL: Record<CumulativeConcernCategoryKey, string> = {
  BD: 'BD Related',
  PAYMENT: 'Bill Related',
  NO_UPDATE_FOLLOWUP: 'Follow-up Update Delay',
  SURGERY_RELATED: 'Surgery Related',
  DOCTOR: 'Doctor Related',
  HOSPITAL_STAFF: 'Hospital/Staff Related',
  CAB_PAYMENT: 'Cab Payment',
  OTHERS: 'Others',
}

export type CumulativeConcernCategoryRow = {
  key: CumulativeConcernCategoryKey
  label: string
  monthlyCounts: number[]
  totalYtd: number
  pctOfUnsatisfiedYtd: number | null
}

export type CumulativeConcernCategoryReport = {
  year: number
  rows: CumulativeConcernCategoryRow[]
  monthlyUnsatisfiedTotals: number[]
  totalUnsatisfiedYtd: number
}

export const MONTH_SHORT_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export function emptyCumulativeKpiCounts(): CumulativeKpiCounts {
  return {
    totalSurgeries: 0,
    mediendManaged: 0,
    offlineBusiness: 0,
    connectedCalls: 0,
    callsNotConnected: 0,
    patientSatisfied: 0,
    patientNotSatisfied: 0,
  }
}
