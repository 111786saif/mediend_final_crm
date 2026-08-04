import { SalesTeamBulkCostType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

export interface BulkCostEntryDto {
  id: string
  costType: SalesTeamBulkCostType
  month: number
  year: number
  amount: number
  remark: string
  employeeId: string | null
  employeeName: string | null
  employeeCode: string | null
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BulkCostActivityDto {
  id: string
  entryId: string | null
  costType: SalesTeamBulkCostType
  month: number
  year: number
  action: string
  amount: number
  remark: string
  employeeId: string | null
  employeeName: string | null
  previousAmount: number | null
  previousRemark: string | null
  previousEmployeeId: string | null
  previousEmployeeName: string | null
  changedBy: string
  changedAt: string
}

export interface BulkCostTotalsByEmployee {
  misc: number
  other: number
}

export interface UnallocatedBulkCostTotals {
  misc: number
  other: number
}

const entryInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      user: { select: { name: true } },
    },
  },
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} as const

export function mapBulkCostEntry(row: {
  id: string
  costType: SalesTeamBulkCostType
  month: number
  year: number
  amount: number
  remark: string
  employeeId: string | null
  createdAt: Date
  updatedAt: Date
  employee: { id: string; employeeCode: string; user: { name: string } } | null
  createdBy: { name: string }
  updatedBy: { name: string } | null
}): BulkCostEntryDto {
  return {
    id: row.id,
    costType: row.costType,
    month: row.month,
    year: row.year,
    amount: row.amount,
    remark: row.remark,
    employeeId: row.employeeId,
    employeeName: row.employee?.user.name ?? null,
    employeeCode: row.employee?.employeeCode ?? null,
    createdBy: row.createdBy.name,
    updatedBy: row.updatedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Sum line-item misc/other by employee for hierarchy nodes. */
export async function loadBulkCostTotalsByEmployee(
  period: SalesTeamCostPeriod,
): Promise<Map<string, BulkCostTotalsByEmployee>> {
  const rows = await prisma.salesTeamBulkCostEntry.groupBy({
    by: ['employeeId', 'costType'],
    where: {
      month: period.month,
      year: period.year,
      employeeId: { not: null },
    },
    _sum: { amount: true },
  })

  const map = new Map<string, BulkCostTotalsByEmployee>()
  for (const row of rows) {
    if (!row.employeeId) continue
    const existing = map.get(row.employeeId) ?? { misc: 0, other: 0 }
    const amount = row._sum.amount ?? 0
    if (row.costType === SalesTeamBulkCostType.MISC) existing.misc += amount
    else existing.other += amount
    map.set(row.employeeId, existing)
  }
  return map
}

/** Line items with no employee — still counted in summary totals. */
export async function loadUnallocatedBulkCostTotals(
  period: SalesTeamCostPeriod,
): Promise<UnallocatedBulkCostTotals> {
  const rows = await prisma.salesTeamBulkCostEntry.groupBy({
    by: ['costType'],
    where: {
      month: period.month,
      year: period.year,
      employeeId: null,
    },
    _sum: { amount: true },
  })

  const result: UnallocatedBulkCostTotals = { misc: 0, other: 0 }
  for (const row of rows) {
    const amount = row._sum.amount ?? 0
    if (row.costType === SalesTeamBulkCostType.MISC) result.misc += amount
    else result.other += amount
  }
  return result
}

/**
 * Authoritative Misc/Other totals for the period — sum of EVERY bulk entry.
 * Use this for the Sales Team Cost summary so the front total always matches
 * the Add Misc/Other Cost entry list (hierarchy walk can miss orphan assignees).
 */
export async function loadBulkCostPeriodTotals(
  period: SalesTeamCostPeriod,
): Promise<BulkCostTotalsByEmployee> {
  const rows = await prisma.salesTeamBulkCostEntry.groupBy({
    by: ['costType'],
    where: {
      month: period.month,
      year: period.year,
    },
    _sum: { amount: true },
  })

  const result: BulkCostTotalsByEmployee = { misc: 0, other: 0 }
  for (const row of rows) {
    const amount = row._sum.amount ?? 0
    if (row.costType === SalesTeamBulkCostType.MISC) result.misc += amount
    else result.other += amount
  }
  return result
}

export async function listBulkCostEntries(
  period: SalesTeamCostPeriod,
  costType: SalesTeamBulkCostType,
): Promise<BulkCostEntryDto[]> {
  const rows = await prisma.salesTeamBulkCostEntry.findMany({
    where: { month: period.month, year: period.year, costType },
    include: entryInclude,
    orderBy: [{ createdAt: 'asc' }],
  })
  return rows.map(mapBulkCostEntry)
}

export async function listBulkCostActivity(
  costType: SalesTeamBulkCostType,
  period?: SalesTeamCostPeriod,
): Promise<BulkCostActivityDto[]> {
  const rows = await prisma.salesTeamBulkCostEntryHistory.findMany({
    where: {
      costType,
      ...(period ? { month: period.month, year: period.year } : {}),
    },
    include: { changedBy: { select: { name: true } } },
    orderBy: { changedAt: 'desc' },
    take: 200,
  })

  const activity: BulkCostActivityDto[] = rows.map((row) => ({
    id: row.id,
    entryId: row.entryId,
    costType: row.costType,
    month: row.month,
    year: row.year,
    action: row.action,
    amount: row.amount,
    remark: row.remark,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    previousAmount: row.previousAmount,
    previousRemark: row.previousRemark,
    previousEmployeeId: row.previousEmployeeId,
    previousEmployeeName: row.previousEmployeeName,
    changedBy: row.changedBy.name,
    changedAt: row.changedAt.toISOString(),
  }))

  // Live entries with no CREATE history (legacy / failed log) still appear as CREATE.
  if (period) {
    const entries = await listBulkCostEntries(period, costType)
    const createEntryIds = new Set(
      activity.filter((a) => a.action === 'CREATE' && a.entryId).map((a) => a.entryId as string),
    )
    for (const entry of entries) {
      if (createEntryIds.has(entry.id)) continue
      activity.push({
        id: `legacy-create-${entry.id}`,
        entryId: entry.id,
        costType: entry.costType,
        month: entry.month,
        year: entry.year,
        action: 'CREATE',
        amount: entry.amount,
        remark: entry.remark,
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        previousAmount: null,
        previousRemark: null,
        previousEmployeeId: null,
        previousEmployeeName: null,
        changedBy: entry.createdBy,
        changedAt: entry.createdAt,
      })
    }
    activity.sort((a, b) => +new Date(b.changedAt) - +new Date(a.changedAt))
  }

  return activity
}
