import { ComplianceCallStatus, ConcernCategory, SatisfactionLevel } from '@/generated/prisma/client'
import { buildSurgeryWhere } from '@/lib/cumulative-report'
import type { Prisma } from '@/generated/prisma/client'
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

export type {
  CumulativeKpiKey,
  CumulativeKpiCounts,
  CumulativeKpiPercentages,
  CumulativePatientSummaryMonth,
  CumulativeConcernCategoryReport,
} from '@/lib/cumulative-report-monthly-shared'
export { computeCumulativeKpiPercentages } from '@/lib/cumulative-report-monthly-shared'

type SurgeryLeadRow = {
  surgeryDate: Date | null
  complianceCall: {
    status: ComplianceCallStatus
    satisfaction: SatisfactionLevel | null
  } | null
}

type ConcernCallRow = {
  satisfaction: SatisfactionLevel | null
  concernCategories: ConcernCategory[]
  lead: { surgeryDate: Date | null }
}

export function buildCumulativeSurgeryLeadWhereForYear(year: number): Prisma.LeadWhereInput {
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  return {
    AND: [buildSurgeryWhere(), { surgeryDate: { gte: start, lt: end } }],
  }
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function accumulateLead(counts: CumulativeKpiCounts, lead: SurgeryLeadRow) {
  counts.totalSurgeries += 1

  const call = lead.complianceCall
  if (call) {
    counts.mediendManaged += 1
    if (call.status === ComplianceCallStatus.COMPLETED) {
      counts.connectedCalls += 1
      if (call.satisfaction === SatisfactionLevel.SATISFIED) counts.patientSatisfied += 1
      else if (call.satisfaction === SatisfactionLevel.NOT_SATISFIED) counts.patientNotSatisfied += 1
    } else {
      counts.callsNotConnected += 1
    }
  } else {
    counts.offlineBusiness += 1
  }
}

export function buildPatientSummaryFromLeads(
  leads: SurgeryLeadRow[],
): CumulativePatientSummaryMonth[] {
  const byMonth = new Map<string, CumulativeKpiCounts>()

  for (const lead of leads) {
    if (!lead.surgeryDate) continue
    const key = monthKeyFromDate(lead.surgeryDate)
    if (!byMonth.has(key)) byMonth.set(key, emptyCumulativeKpiCounts())
    accumulateLead(byMonth.get(key)!, lead)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, counts]) => ({
      monthKey,
      label: monthLabelFromKey(monthKey),
      counts,
      percentages: computeCumulativeKpiPercentages(counts),
    }))
}

export function buildPatientSummaryForYear(
  leads: SurgeryLeadRow[],
  year: number,
): CumulativePatientSummaryMonth[] {
  const fromLeads = buildPatientSummaryFromLeads(leads)
  const byKey = new Map(fromLeads.map((m) => [m.monthKey, m]))

  return Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`
    const existing = byKey.get(monthKey)
    if (existing) return existing
    const counts = emptyCumulativeKpiCounts()
    return {
      monthKey,
      label: monthLabelFromKey(monthKey),
      counts,
      percentages: computeCumulativeKpiPercentages(counts),
    }
  })
}

export function buildConcernCategoryReport(
  calls: ConcernCallRow[],
  year: number,
): CumulativeConcernCategoryReport {
  const monthlyUnsatisfiedTotals = Array.from({ length: 12 }, () => 0)
  const categoryMonthly = Object.fromEntries(
    CUMULATIVE_CONCERN_CATEGORY_ORDER.map((key) => [key, Array.from({ length: 12 }, () => 0)]),
  ) as Record<CumulativeConcernCategoryKey, number[]>

  for (const call of calls) {
    const d = call.lead.surgeryDate
    if (!d || d.getFullYear() !== year) continue
    if (call.satisfaction !== SatisfactionLevel.NOT_SATISFIED) continue

    const monthIdx = d.getMonth()
    monthlyUnsatisfiedTotals[monthIdx] += 1

    for (const cat of call.concernCategories) {
      const key = cat as CumulativeConcernCategoryKey
      if (key in categoryMonthly) categoryMonthly[key][monthIdx] += 1
    }
  }

  const totalUnsatisfiedYtd = monthlyUnsatisfiedTotals.reduce((sum, n) => sum + n, 0)

  const rows = CUMULATIVE_CONCERN_CATEGORY_ORDER.map((key) => {
    const monthlyCounts = categoryMonthly[key]
    const totalYtd = monthlyCounts.reduce((sum, n) => sum + n, 0)
    return {
      key,
      label: CUMULATIVE_CONCERN_CATEGORY_LABEL[key],
      monthlyCounts,
      totalYtd,
      pctOfUnsatisfiedYtd:
        totalUnsatisfiedYtd > 0
          ? Math.round((totalYtd / totalUnsatisfiedYtd) * 10000) / 100
          : null,
    }
  })

  return { year, rows, monthlyUnsatisfiedTotals, totalUnsatisfiedYtd }
}
