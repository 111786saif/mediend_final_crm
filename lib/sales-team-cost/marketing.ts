import { prisma } from '@/lib/prisma'

/**
 * Marketing spend attributed to a BD's team (stub — equal split across active BDs).
 */
export async function getMarketingCostForBD(
  bdUserId: string,
  bdEmployeeId?: string,
): Promise<number> {
  void bdUserId
  void bdEmployeeId
  return loadSharedBdMarketingCost()
}

/** Single aggregate + BD count — reuse for every BD node in the hierarchy. */
export async function loadSharedBdMarketingCost(): Promise<number> {
  const [recentSpend, bdCount] = await Promise.all([
    prisma.dailyCampaignSpend.aggregate({
      _sum: { spend: true },
      where: {
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
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
