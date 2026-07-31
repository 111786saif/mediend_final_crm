import { ComplianceCallStatus, SatisfactionLevel } from '@/generated/prisma/client'
import {
  buildCumulativeLeadWhere,
  buildSurgeryWhere,
  resolveCumulativeDateRange,
} from '@/lib/cumulative-report'
import type { CumulativeReportFilters } from '@/lib/cumulative-report-types'
import type { Prisma } from '@/generated/prisma/client'
import type {
  CumulativeKpiCounts,
  CumulativeKpiPercentages,
  CumulativeKpiPerformance,
  CumulativeKpiPerformanceRow,
  CumulativePatientSummaryMonth,
} from '@/lib/cumulative-report-monthly-shared'

export type {
  CumulativeKpiKey,
  CumulativeKpiCounts,
  CumulativeKpiPercentages,
  CumulativePatientSummaryMonth,
  CumulativeKpiPerformanceRow,
  CumulativeKpiPerformance,
} from '@/lib/cumulative-report-monthly-shared'
type SurgeryLeadRow = {
  surgeryDate: Date | null
  complianceCall: {
    status: ComplianceCallStatus
    satisfaction: SatisfactionLevel | null
  } | null
}

export function buildCumulativeSurgeryLeadWhere(
  filters: CumulativeReportFilters,
): Prisma.LeadWhereInput {
  const dateFilter = resolveCumulativeDateRange(
    filters.datePreset ?? 'all',
    filters.startDate,
    filters.endDate,
  )
  const base = buildCumulativeLeadWhere({
    ...filters,
    datePreset: 'all',
    startDate: null,
    endDate: null,
  })
  const and: Prisma.LeadWhereInput[] = [base, buildSurgeryWhere()]
  if (dateFilter) and.push({ surgeryDate: dateFilter })
  return { AND: and }
}

function emptyCounts(): CumulativeKpiCounts {
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

export function roundPct(n: number): number {
  return Math.round(n)
}

export function computeCumulativeKpiPercentages(counts: CumulativeKpiCounts): CumulativeKpiPercentages {
  const total = counts.totalSurgeries
  const mediend = counts.mediendManaged
  const connected = counts.connectedCalls

  const pct = (num: number, den: number): number | null => {
    if (den <= 0) return null
    return roundPct((num / den) * 100)
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

export function sumSatisfactionFromLeads(leads: SurgeryLeadRow[]): {
  patientSatisfied: number
  patientNotSatisfied: number
} {
  let patientSatisfied = 0
  let patientNotSatisfied = 0

  for (const lead of leads) {
    const call = lead.complianceCall
    if (call?.status !== ComplianceCallStatus.COMPLETED) continue
    if (call.satisfaction === SatisfactionLevel.SATISFIED) patientSatisfied += 1
    else if (call.satisfaction === SatisfactionLevel.NOT_SATISFIED) patientNotSatisfied += 1
  }

  return { patientSatisfied, patientNotSatisfied }
}

export function buildPatientSummaryFromLeads(
  leads: SurgeryLeadRow[],
): CumulativePatientSummaryMonth[] {
  const byMonth = new Map<string, CumulativeKpiCounts>()

  for (const lead of leads) {
    if (!lead.surgeryDate) continue
    const key = monthKeyFromDate(lead.surgeryDate)
    if (!byMonth.has(key)) byMonth.set(key, emptyCounts())
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

export function buildKpiPerformanceForMonth(
  month: CumulativePatientSummaryMonth | undefined,
): CumulativeKpiPerformance | null {
  if (!month) return null

  const rows: CumulativeKpiPerformanceRow[] = [
    {
      sno: 1,
      kpi: 'Total Surgeries Done',
      count: month.counts.totalSurgeries,
      percentage: month.percentages.totalSurgeries,
    },
    {
      sno: 2,
      kpi: 'MediEnd Managed Cases',
      count: month.counts.mediendManaged,
      percentage: month.percentages.mediendManaged,
    },
    {
      sno: 3,
      kpi: 'Offline Business',
      count: month.counts.offlineBusiness,
      percentage: month.percentages.offlineBusiness,
    },
    {
      sno: 4,
      kpi: 'Connected Calls',
      count: month.counts.connectedCalls,
      percentage: month.percentages.connectedCalls,
    },
    {
      sno: 5,
      kpi: 'Calls Not Connected',
      count: month.counts.callsNotConnected,
      percentage: month.percentages.callsNotConnected,
    },
    {
      sno: 6,
      kpi: 'Patient Satisfied',
      count: month.counts.patientSatisfied,
      percentage: month.percentages.patientSatisfied,
    },
    {
      sno: 7,
      kpi: 'Patient Not Satisfied',
      count: month.counts.patientNotSatisfied,
      percentage: month.percentages.patientNotSatisfied,
    },
  ]

  return {
    monthKey: month.monthKey,
    label: month.label,
    rows,
  }
}

export function pickKpiPerformanceMonth(
  patientSummary: CumulativePatientSummaryMonth[],
  kpiMonth: string | null | undefined,
): CumulativeKpiPerformance | null {
  if (!patientSummary.length) return null
  const selected =
    (kpiMonth && patientSummary.find((m) => m.monthKey === kpiMonth)) ||
    patientSummary[patientSummary.length - 1]
  return buildKpiPerformanceForMonth(selected)
}
