import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess, getManagerGroups } from '@/lib/hierarchy'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

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

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const conversionDateFilter: Prisma.LeadWhereInput = ipdDoneDateFilter(dateFilter)

    // Role-based scope (hierarchy-only)
    let scopeFilter: Prisma.LeadWhereInput = {}
    if (user.role === 'BD') {
      scopeFilter = { bdId: user.id }
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      scopeFilter = { bdId: { in: [user.id, ...subIds] } }
    }

    if (type === 'bd') {
      const closedWhere: Prisma.LeadWhereInput = { status: { in: CLOSED_STATUS_CODES }, ...leadEntryDateFilter, ...scopeFilter }
      const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter, ...scopeFilter }
      const ipdDoneWhere: Prisma.LeadWhereInput = { ...conversionDateFilter, ...scopeFilter }

      const [bdStats, bdLeads, ipdDoneStats] = await Promise.all([
        prisma.lead.groupBy({
          by: ['bdId'],
          where: closedWhere,
          _count: { id: true },
          _sum: { billAmount: true, netProfit: true },
          _avg: { billAmount: true },
        }),
        prisma.lead.groupBy({ by: ['bdId'], where: allLeadsWhere, _count: { id: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: ipdDoneWhere, _count: { id: true } }),
      ])

      const bdMap = new Map(bdLeads.map((b) => [b.bdId, b._count.id]))
      const ipdDoneMap = new Map(ipdDoneStats.map((b) => [b.bdId, b._count.id]))
      const bdIds = [...new Set([...bdStats.map((b) => b.bdId), ...bdLeads.map((b) => b.bdId)])].filter(
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

      const leaderboard = bdStats.map((stat) => {
        const bd = bds.find((b) => b.id === stat.bdId)
        const totalLeads = bdMap.get(stat.bdId) || 0
        const closedLeads = stat._count.id
        const ipdDone = ipdDoneMap.get(stat.bdId) || 0

        return {
          bdId: stat.bdId,
          bdName: bd?.name || 'Unknown',
          managerName: bd?.employee?.manager?.user?.name ?? 'No Manager',
          teamName: bd?.employee?.team?.name ?? null,
          totalLeads,
          closedLeads,
          ipdDone,
          conversionRate: Math.round(totalLeads > 0 ? (closedLeads / totalLeads) * 100 * 100 : 0) / 100,
          netProfit: stat._sum.netProfit || 0,
          avgTicketSize: Math.round((stat._avg.billAmount || 0) * 100) / 100,
        }
      })

      leaderboard.sort((a, b) => b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)

    } else if (type === 'team') {
      // Team leaderboard = manager groups (each manager + their direct subordinates)
      const closedWhere: Prisma.LeadWhereInput = { status: { in: CLOSED_STATUS_CODES }, ...leadEntryDateFilter, ...scopeFilter }
      const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter, ...scopeFilter }
      const ipdDoneWhere: Prisma.LeadWhereInput = { ...conversionDateFilter, ...scopeFilter }

      const [teamStats, teamLeads, ipdDoneStats] = await Promise.all([
        prisma.lead.groupBy({ by: ['bdId'], where: closedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: allLeadsWhere, _count: { id: true } }),
        prisma.lead.groupBy({ by: ['bdId'], where: ipdDoneWhere, _count: { id: true } }),
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
        for (const stat of ipdDoneStats) {
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

      leaderboard.sort((a, b) => b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)

    } else if (type === 'teamlead') {
      // Team lead leaderboard: each TEAM_LEAD user ranked by their group's performance
      const teamLeadUsers = await prisma.user.findMany({
        where: {
          role: 'TEAM_LEAD',
          ...(user.role === 'TEAM_LEAD' ? { id: user.id } : {}),
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
          const ipdDoneWhere: Prisma.LeadWhereInput = {
            ...conversionDateFilter,
            bdId: { in: teamUserIds },
          }

          const [closedCount, ipdCount, profitAgg] = await Promise.all([
            prisma.lead.count({ where: closedWhere }),
            prisma.lead.count({ where: ipdDoneWhere }),
            prisma.lead.aggregate({ where: ipdDoneWhere, _sum: { netProfit: true } }),
          ])

          return {
            teamLeadId: tl.id,
            teamLeadName: tl.name,
            closedLeads: closedCount,
            ipdDone: ipdCount,
            netProfit: profitAgg._sum.netProfit || 0,
          }
        })
      )

      leaderboard.sort((a, b) => b.closedLeads - a.closedLeads)
      return successResponse(leaderboard)
    }

    return errorResponse('Invalid type parameter', 400)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return errorResponse('Failed to fetch leaderboard', 500)
  }
}
