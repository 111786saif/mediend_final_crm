import { EmployeeSeatingMiscCostStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { SALES_TEAM_COST_SEATING_MISC_STATUSES } from '@/lib/finance/seating-misc-cost/types'
import type { SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

export interface EmployeeSeatingMiscTotals {
  seating: number
  misc: number
  other: number
}

/** Approved monthly seating / misc / other totals per employee for Sales Team Cost. */
export async function loadApprovedSeatingMiscByEmployee(
  period: SalesTeamCostPeriod,
): Promise<Map<string, EmployeeSeatingMiscTotals>> {
  const [rows, masters] = await Promise.all([
    prisma.employeeMonthlySeatingMiscCost.findMany({
      where: {
        month: period.month,
        year: period.year,
        status: { in: SALES_TEAM_COST_SEATING_MISC_STATUSES as EmployeeSeatingMiscCostStatus[] },
      },
      select: {
        employeeId: true,
        seatingCost: true,
        miscCost: true,
        otherCost: true,
      },
    }),
    prisma.employeeMasterSeatingCost.findMany({
      select: { employeeId: true, amount: true },
    }),
  ])

  const map = new Map<string, EmployeeSeatingMiscTotals>()
  for (const row of rows) {
    map.set(row.employeeId, {
      seating: row.seatingCost,
      misc: row.miscCost,
      other: row.otherCost,
    })
  }

  // Fall back to master seating when no approved monthly record exists.
  for (const master of masters) {
    const existing = map.get(master.employeeId)
    if (existing) {
      if (existing.seating <= 0 && master.amount > 0) {
        existing.seating = master.amount
      }
    } else if (master.amount > 0) {
      map.set(master.employeeId, { seating: master.amount, misc: 0, other: 0 })
    }
  }

  return map
}
