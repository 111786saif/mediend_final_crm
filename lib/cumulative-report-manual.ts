import {
  computeCumulativeKpiPercentages,
  CUMULATIVE_CONCERN_CATEGORY_LABEL,
  CUMULATIVE_CONCERN_CATEGORY_ORDER,
  emptyCumulativeKpiCounts,
  type CumulativeConcernCategoryKey,
  type CumulativeConcernCategoryReport,
  type CumulativeKpiCounts,
  type CumulativePatientSummaryMonth,
} from '@/lib/cumulative-report-monthly-shared'

export type StoredConcernCategoryRow = {
  key: CumulativeConcernCategoryKey
  monthlyCounts: number[]
}

export type CumulativeReportManualPayload = {
  year: number
  patientSummary: CumulativePatientSummaryMonth[]
  concernCategory: CumulativeConcernCategoryReport
}

function monthKeyForYearMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function buildEmptyPatientSummaryForYear(year: number): CumulativePatientSummaryMonth[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthKey = monthKeyForYearMonth(year, monthIndex)
    const counts = emptyCumulativeKpiCounts()
    return {
      monthKey,
      label: monthLabelFromKey(monthKey),
      counts,
      percentages: computeCumulativeKpiPercentages(counts),
    }
  })
}

export function buildEmptyConcernCategoryForYear(year: number): CumulativeConcernCategoryReport {
  const monthlyUnsatisfiedTotals = Array.from({ length: 12 }, () => 0)
  const rows = CUMULATIVE_CONCERN_CATEGORY_ORDER.map((key) => ({
    key,
    label: CUMULATIVE_CONCERN_CATEGORY_LABEL[key],
    monthlyCounts: Array.from({ length: 12 }, () => 0),
    totalYtd: 0,
    pctOfUnsatisfiedYtd: null,
  }))

  return {
    year,
    rows,
    monthlyUnsatisfiedTotals,
    totalUnsatisfiedYtd: 0,
  }
}

export function buildEmptyCumulativeReportManualPayload(year: number): CumulativeReportManualPayload {
  return {
    year,
    patientSummary: buildEmptyPatientSummaryForYear(year),
    concernCategory: buildEmptyConcernCategoryForYear(year),
  }
}

function isValidKpiCounts(value: unknown): value is CumulativeKpiCounts {
  if (!value || typeof value !== 'object') return false
  const keys = [
    'totalSurgeries',
    'mediendManaged',
    'offlineBusiness',
    'connectedCalls',
    'callsNotConnected',
    'patientSatisfied',
    'patientNotSatisfied',
  ] as const
  return keys.every((key) => typeof (value as CumulativeKpiCounts)[key] === 'number')
}

export function patientCountsRecordFromSummary(
  patientSummary: CumulativePatientSummaryMonth[],
): Record<string, CumulativeKpiCounts> {
  return Object.fromEntries(patientSummary.map((month) => [month.monthKey, { ...month.counts }]))
}

export function concernCountsRecordFromReport(
  concernCategory: CumulativeConcernCategoryReport,
): Record<CumulativeConcernCategoryKey, number[]> {
  return Object.fromEntries(
    concernCategory.rows.map((row) => [row.key, [...row.monthlyCounts]]),
  ) as Record<CumulativeConcernCategoryKey, number[]>
}

export function mergePatientSummaryFromStored(
  year: number,
  stored: unknown,
): CumulativePatientSummaryMonth[] {
  const empty = buildEmptyPatientSummaryForYear(year)
  if (!Array.isArray(stored)) return empty

  const byKey = new Map<string, CumulativeKpiCounts>()
  for (const item of stored) {
    if (!item || typeof item !== 'object') continue
    const monthKey = (item as { monthKey?: unknown }).monthKey
    const counts = (item as { counts?: unknown }).counts
    if (typeof monthKey !== 'string' || !isValidKpiCounts(counts)) continue
    byKey.set(monthKey, { ...counts })
  }

  return empty.map((month) => {
    const counts = byKey.get(month.monthKey) ?? month.counts
    return {
      ...month,
      counts,
      percentages: computeCumulativeKpiPercentages(counts),
    }
  })
}

export function mergeConcernCategoryFromStored(
  year: number,
  stored: unknown,
  patientSummary: CumulativePatientSummaryMonth[],
): CumulativeConcernCategoryReport {
  const empty = buildEmptyConcernCategoryForYear(year)
  const monthlyUnsatisfiedTotals = patientSummary.map((month) => month.counts.patientNotSatisfied)
  const totalUnsatisfiedYtd = monthlyUnsatisfiedTotals.reduce((sum, n) => sum + n, 0)

  if (!Array.isArray(stored)) {
    return {
      ...empty,
      monthlyUnsatisfiedTotals,
      totalUnsatisfiedYtd,
    }
  }

  const byKey = new Map<CumulativeConcernCategoryKey, number[]>()
  for (const item of stored) {
    if (!item || typeof item !== 'object') continue
    const key = (item as { key?: unknown }).key
    const monthlyCounts = (item as { monthlyCounts?: unknown }).monthlyCounts
    if (typeof key !== 'string' || !Array.isArray(monthlyCounts)) continue
    if (!CUMULATIVE_CONCERN_CATEGORY_ORDER.includes(key as CumulativeConcernCategoryKey)) continue
    const normalized = Array.from({ length: 12 }, (_, i) => {
      const value = monthlyCounts[i]
      return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
    })
    byKey.set(key as CumulativeConcernCategoryKey, normalized)
  }

  const rows = empty.rows.map((row) => {
    const monthlyCounts = byKey.get(row.key) ?? row.monthlyCounts
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

  return {
    year,
    rows,
    monthlyUnsatisfiedTotals,
    totalUnsatisfiedYtd,
  }
}

export function buildManualPayloadFromEdits(
  year: number,
  patientCountsByMonth: Record<string, CumulativeKpiCounts>,
  concernCountsByCategory: Record<CumulativeConcernCategoryKey, number[]>,
): CumulativeReportManualPayload {
  const patientSummary = buildEmptyPatientSummaryForYear(year).map((month) => {
    const counts = patientCountsByMonth[month.monthKey] ?? month.counts
    return {
      ...month,
      counts,
      percentages: computeCumulativeKpiPercentages(counts),
    }
  })

  const concernCategory = mergeConcernCategoryFromStored(
    year,
    CUMULATIVE_CONCERN_CATEGORY_ORDER.map((key) => ({
      key,
      monthlyCounts: concernCountsByCategory[key] ?? Array.from({ length: 12 }, () => 0),
    })),
    patientSummary,
  )

  return { year, patientSummary, concernCategory }
}

export function serializeManualPayloadForDb(payload: CumulativeReportManualPayload) {
  return {
    patientSummary: payload.patientSummary.map((month) => ({
      monthKey: month.monthKey,
      counts: month.counts,
    })),
    concernCategory: payload.concernCategory.rows.map((row) => ({
      key: row.key,
      monthlyCounts: row.monthlyCounts,
    })),
  }
}
