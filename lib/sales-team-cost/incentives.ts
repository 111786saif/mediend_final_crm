import { EmployeeIncentiveStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

/** Approved incentive statuses included in Sales Team Cost totals. */
export const SALES_TEAM_COST_INCENTIVE_STATUSES: EmployeeIncentiveStatus[] = [
  EmployeeIncentiveStatus.APPROVED,
  EmployeeIncentiveStatus.PAID,
]

export interface SalesTeamCostPeriod {
  month: number
  year: number
}

export function parseSalesTeamCostPeriod(
  monthParam: string | null,
  yearParam: string | null,
): SalesTeamCostPeriod {
  const now = new Date()
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1
  const year = yearParam ? Number(yearParam) : now.getFullYear()

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid month')
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Invalid year')
  }

  return { month, year }
}

/**
 * Single query: approved incentive totals grouped by employee for a calendar month.
 * EmployeeMonthlyIncentive is unique on (employeeId, month, year) — no double-counting.
 */
export async function loadApprovedIncentiveTotalsByEmployee(
  period: SalesTeamCostPeriod,
): Promise<Map<string, number>> {
  const rows = await prisma.employeeMonthlyIncentive.groupBy({
    by: ['employeeId'],
    where: {
      month: period.month,
      year: period.year,
      status: { in: SALES_TEAM_COST_INCENTIVE_STATUSES },
    },
    _sum: { amount: true },
  })

  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.employeeId, row._sum.amount ?? 0)
  }
  return map
}
