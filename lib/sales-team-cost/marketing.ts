import { prisma } from '@/lib/prisma'

/**
 * Marketing spend attributed to a BD's team (stub — extend with campaign/team tagging).
 */
export async function getMarketingCostForBD(
  bdUserId: string,
  bdEmployeeId?: string,
): Promise<number> {
  let teamId: string | null = null
  if (bdEmployeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: bdEmployeeId },
      select: { teamId: true },
    })
    teamId = emp?.teamId ?? null
  }

  const recentSpend = await prisma.dailyCampaignSpend.aggregate({
    _sum: { spend: true },
    where: {
      date: {
        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    },
  })

  const totalSpend = recentSpend._sum.spend ?? 0
  if (totalSpend <= 0) return 0

  const bdCount = await prisma.employee.count({
    where: { user: { role: 'BD' }, status: 'ACTIVE' },
  })
  if (bdCount <= 0) return 0

  void teamId
  void bdUserId
  return Math.round((totalSpend / bdCount) * 100) / 100
}
