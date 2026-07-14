import { prisma } from '@/lib/prisma'
import type { SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

export interface SalaryOverrideEntry {
  amount: number
  reason: string
  updatedAt: string
  updatedBy: string
}

/** Month-scoped Sales Team Cost salary overrides (never writes to Payroll). */
export async function loadSalaryOverridesByEmployee(
  period: SalesTeamCostPeriod,
): Promise<Map<string, SalaryOverrideEntry>> {
  const rows = await prisma.employeeSalesTeamSalaryOverride.findMany({
    where: { month: period.month, year: period.year },
    select: {
      employeeId: true,
      amount: true,
      reason: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  })

  const map = new Map<string, SalaryOverrideEntry>()
  for (const row of rows) {
    map.set(row.employeeId, {
      amount: row.amount,
      reason: row.reason,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy.name,
    })
  }
  return map
}
