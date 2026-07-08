import { EmployeeSeatingMiscCostStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { SALES_TEAM_COST_SEATING_MISC_STATUSES } from '@/lib/finance/seating-misc-cost/types'
import type { SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

export interface EmployeeSeatingMiscTotals {
  seating: number
  misc: number
}

/** Approved monthly seating & misc totals per employee for Sales Team Cost. */
export async function loadApprovedSeatingMiscByEmployee(
  period: SalesTeamCostPeriod,
): Promise<Map<string, EmployeeSeatingMiscTotals>> {
  const rows = await prisma.employeeMonthlySeatingMiscCost.findMany({
    where: {
      month: period.month,
      year: period.year,
      status: { in: SALES_TEAM_COST_SEATING_MISC_STATUSES as EmployeeSeatingMiscCostStatus[] },
    },
    select: {
      employeeId: true,
      seatingCost: true,
      miscCost: true,
    },
  })

  const map = new Map<string, EmployeeSeatingMiscTotals>()
  for (const row of rows) {
    map.set(row.employeeId, { seating: row.seatingCost, misc: row.miscCost })
  }
  return map
}
