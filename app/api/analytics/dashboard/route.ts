import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'

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

    const dateFilter = buildDateRange(startDate, endDate)

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
      ...canonicalSalesCompletedWhere(dateFilter),
    }

    const where: Prisma.LeadWhereInput = { ...completedWhere }
    if (circle) where.circle = circle

    // Role-based filtering
    const subtreeBdIds = isSubtreeScopedSalesRole(user.role)
      ? await getSalesDashboardBdIdFilter(user)
      : undefined
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (subtreeBdIds) {
      where.bdId = { in: subtreeBdIds }
    }

    const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter }
    if (circle) allLeadsWhere.circle = circle
    if (user.role === 'BD') {
      allLeadsWhere.bdId = user.id
    } else if (subtreeBdIds) {
      allLeadsWhere.bdId = { in: subtreeBdIds }
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

