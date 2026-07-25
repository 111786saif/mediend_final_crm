import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess, getManagerGroups } from '@/lib/hierarchy'
import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole, isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'

const CLOSED_STATUS_CODES = [
  '13', // IPD Done
  '25', // Closed
  '30', // Call Done
  '31', // WA Done
  '32', // C/W Done
]

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'bd', 'team', or 'teamlead'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = buildDateRange(startDate, endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const completedLeadsFilter: Prisma.LeadWhereInput = canonicalSalesCompletedWhere(dateFilter)

    // Role-based scope (hierarchy-only)
    let scopeFilter: Prisma.LeadWhereInput = {}
    if (user.role === 'BD') {
      scopeFilter = { bdId: user.id }
    } else if (isSubtreeScopedSalesRole(user.role)) {
      const bdIdFilter = await getSalesDashboardBdIdFilter(user)
      if (bdIdFilter) scopeFilter = { bdId: { in: bdIdFilter } }
    }

    if (type === 'bd') {
      const closedWhere: Prisma.LeadWhereInput = { status: { in: CLOSED_STATUS_CODES }, ...leadEntryDateFilter, ...scopeFilter }
      const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter, ...scopeFilter }
      const completedWhere: Prisma.LeadWhereInput = { ...completedLeadsFilter, ...scopeFilter }

      const [bdStats, bdLeads, completedStats] = await Promise.all([
        prisma.lead.groupBy({
          by: ['bdId'],
          where: closedWhere,
          _count: { id: true },
          _sum: { billAmount: true, netProfit: true },
          _avg: { billAmount: true },
        }),
        prisma.lead.groupBy({ by: ['bdId'], where: allLeadsWhere, _count: { id: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: completedWhere, _count: { id: true } }),
      ])

      const bdMap = new Map(bdLeads.map((b) => [b.bdId, b._count.id]))
      const completedStatsMap = new Map(completedStats.map((b) => [b.bdId, b._count.id]))
      const bdStatsMap = new Map(bdStats.map((b) => [b.bdId, { closed: b._count.id, netProfit: b._sum.netProfit ?? 0, avgBill: b._avg.billAmount ?? 0 }]))
      const bdIds = [...new Set([...bdStats.map((b) => b.bdId), ...bdLeads.map((b) => b.bdId), ...completedStats.map((b) => b.bdId)])].filter(
        (id): id is string => id !== null
      )
      const bds = await prisma.user.findMany({
        where: { id: { in: bdIds }, role: 'BD' },
        include: {
          employee: {
            select: {
              manager: { select: { user: { select: { name: true } } } },
              team: { select: { name: true } },
            },
          },
        },
      })

      const leaderboard = bdIds.map((bdId) => {
        const bd = bds.find((b) => b.id === bdId)
        const stat = bdStatsMap.get(bdId)
        const totalLeads = bdMap.get(bdId) || 0
        const closedLeads = stat?.closed ?? 0
        const ipdDone = completedStatsMap.get(bdId) || 0

        return {
          bdId,
          bdName: bd?.name || 'Unknown',
          managerName: bd?.employee?.manager?.user?.name ?? 'No Manager',
          teamName: bd?.employee?.team?.name ?? null,
          totalLeads,
          closedLeads,
          ipdDone,
          conversionRate: Math.round(totalLeads > 0 ? (closedLeads / totalLeads) * 100 * 100 : 0) / 100,
          netProfit: stat?.netProfit ?? 0,
          avgTicketSize: Math.round((stat?.avgBill ?? 0) * 100) / 100,
        }
      })

      leaderboard.sort((a, b) => b.ipdDone - a.ipdDone || b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)

    } else if (type === 'team') {
      // Team leaderboard = manager groups (each manager + their direct subordinates)
      const closedWhere: Prisma.LeadWhereInput = { status: { in: CLOSED_STATUS_CODES }, ...leadEntryDateFilter, ...scopeFilter }
      const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter, ...scopeFilter }
      const completedWhere: Prisma.LeadWhereInput = { ...completedLeadsFilter, ...scopeFilter }

      const [teamStats, teamLeads, completedStats] = await Promise.all([
        prisma.lead.groupBy({ by: ['bdId'], where: closedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: allLeadsWhere, _count: { id: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: completedWhere, _count: { id: true } }),
      ])

      const managerGroups = await getManagerGroups()

      const groupMap = new Map<string, { name: string; closedLeads: number; ipdDone: number; netProfit: number; revenue: number; totalLeads: number }>()

      for (const group of managerGroups) {
        const groupUserIds = new Set([group.managerUserId, ...group.subordinates.map((s) => s.userId)])
        let closedLeads = 0, ipdDone = 0, netProfit = 0, revenue = 0, totalLeads = 0

        for (const stat of teamStats) {
          if (stat.bdId && groupUserIds.has(stat.bdId)) {
            closedLeads += stat._count.id
            netProfit += stat._sum.netProfit || 0
            revenue += stat._sum.billAmount || 0
          }
        }
        for (const stat of completedStats) {
          if (stat.bdId && groupUserIds.has(stat.bdId)) ipdDone += stat._count.id
        }
        for (const stat of teamLeads) {
          if (stat.bdId && groupUserIds.has(stat.bdId)) totalLeads += stat._count.id
        }

        if (closedLeads > 0 || totalLeads > 0) {
          groupMap.set(group.managerId, { name: `${group.managerName}'s Team`, closedLeads, ipdDone, netProfit, revenue, totalLeads })
        }
      }

      const leaderboard = Array.from(groupMap.entries()).map(([managerId, data]) => ({
        managerId,
        teamName: data.name,
        totalLeads: data.totalLeads,
        closedLeads: data.closedLeads,
        ipdDone: data.ipdDone,
        conversionRate: Math.round(data.totalLeads > 0 ? (data.closedLeads / data.totalLeads) * 100 * 100 : 0) / 100,
        revenue: data.revenue,
        netProfit: data.netProfit,
      }))

      leaderboard.sort((a, b) => b.ipdDone - a.ipdDone || b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)

    } else if (type === 'teamlead') {
      // Team lead leaderboard: each TEAM_LEAD user ranked by their group's performance
      const teamLeadUsers = await prisma.user.findMany({
        where: {
          role: { in: ['TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER'] },
          ...(isTeamLeadEquivalent(user.role) ? { id: user.id } : {}),
        },
        include: {
          employee: { select: { id: true } },
        },
      })

      if (teamLeadUsers.length === 0) return successResponse([])

      const leaderboard = await Promise.all(
        teamLeadUsers.map(async (tl) => {
          const subIds = await getSubordinateUserIdsForLeadAccess(tl.id)
          const teamUserIds = [tl.id, ...subIds]

          const closedWhere: Prisma.LeadWhereInput = {
            status: { in: CLOSED_STATUS_CODES },
            ...leadEntryDateFilter,
            bdId: { in: teamUserIds },
          }
          const completedWhere: Prisma.LeadWhereInput = {
            ...completedLeadsFilter,
            bdId: { in: teamUserIds },
          }

          const [closedCount, completedCount, profitAgg] = await Promise.all([
            prisma.lead.count({ where: closedWhere }),
            prisma.lead.count({ where: completedWhere }),
            prisma.lead.aggregate({ where: completedWhere, _sum: { netProfit: true } }),
          ])

          return {
            teamLeadId: tl.id,
            teamLeadName: tl.name,
            closedLeads: closedCount,
            ipdDone: completedCount,
            netProfit: profitAgg._sum.netProfit || 0,
          }
        })
      )

      leaderboard.sort((a, b) => b.ipdDone - a.ipdDone || b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)
    }

    return errorResponse('Invalid type parameter', 400)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return errorResponse('Failed to fetch leaderboard', 500)
  }
}
