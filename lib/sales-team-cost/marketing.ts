import { prisma } from '@/lib/prisma'
import type { SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

/**
 * Marketing spend attributed to a BD (stub — equal split across active BDs).
 */
export async function getMarketingCostForBD(
  bdUserId: string,
  bdEmployeeId?: string,
  period?: SalesTeamCostPeriod,
): Promise<number> {
  void bdUserId
  void bdEmployeeId
  return loadSharedBdMarketingCost(period)
}

/** Equal marketing share per active BD for the selected month (0 if none). */
export async function loadSharedBdMarketingCost(
  period?: SalesTeamCostPeriod,
): Promise<number> {
  const now = new Date()
  const month = period?.month ?? now.getMonth() + 1
  const year = period?.year ?? now.getFullYear()
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  const [recentSpend, bdCount] = await Promise.all([
    prisma.dailyCampaignSpend.aggregate({
      _sum: { spend: true },
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }),
    prisma.employee.count({
      where: { user: { role: 'BD' }, status: 'ACTIVE' },
    }),
  ])

  const totalSpend = recentSpend._sum.spend ?? 0
  if (totalSpend <= 0 || bdCount <= 0) return 0
  return Math.round((totalSpend / bdCount) * 100) / 100
}
