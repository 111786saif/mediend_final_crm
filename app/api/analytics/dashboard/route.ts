import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const circle = searchParams.get('circle')

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

    const completedWhere: Prisma.LeadWhereInput = {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
      ...ipdDoneDateFilter(dateFilter),
    }

    const where: Prisma.LeadWhereInput = { ...completedWhere }
    if (circle) where.circle = circle

    // Role-based filtering
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      where.bdId = { in: [user.id, ...subIds] }
    }

    const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter }
    if (circle) allLeadsWhere.circle = circle
    if (user.role === 'BD') {
      allLeadsWhere.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      allLeadsWhere.bdId = { in: [user.id, ...subIds] }
    }

    const [totalSurgeries, totalProfit, avgTicketSize, totalLeads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.aggregate({
        where,
        _sum: {
          netProfit: true,
        },
      }),
      prisma.lead.aggregate({
        where,
        _avg: {
          ticketSize: true,
        },
      }),
      prisma.lead.count({
        where: allLeadsWhere,
      }),
    ])

    const conversionRate = totalLeads > 0 ? (totalSurgeries / totalLeads) * 100 : 0

    return successResponse({
      totalSurgeries,
      totalProfit: totalProfit._sum.netProfit || 0,
      avgTicketSize: avgTicketSize._avg.ticketSize || 0,
      totalLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
    })
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
    return errorResponse('Failed to fetch analytics', 500)
  }
}

