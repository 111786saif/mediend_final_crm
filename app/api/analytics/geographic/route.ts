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

    const baseWhere: Prisma.LeadWhereInput = {
      ...leadEntryDateFilter,
    }

    const subtreeBdIds = isSubtreeScopedSalesRole(user.role)
      ? await getSalesDashboardBdIdFilter(user)
      : undefined
    if (user.role === 'BD') {
      baseWhere.bdId = user.id
    } else if (subtreeBdIds) {
      baseWhere.bdId = { in: subtreeBdIds }
    }

    const completedWhere = canonicalSalesCompletedWhere(dateFilter)
    if (user.role === 'BD') completedWhere.bdId = user.id
    else if (subtreeBdIds) completedWhere.bdId = { in: subtreeBdIds }

    // Circle Performance
    const circleStats = await prisma.lead.groupBy({
      by: ['circle'],
      where: baseWhere,
      _count: { id: true },
    })

    const circleCompleted = await prisma.lead.groupBy({
      by: ['circle'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const circleMap = new Map<string, { totalLeads: number; completed: number; revenue: number; profit: number }>()
    
    circleStats.forEach((stat) => {
      circleMap.set(stat.circle, {
        totalLeads: stat._count.id,
        completed: 0,
        revenue: 0,
        profit: 0,
      })
    })

    circleCompleted.forEach((stat) => {
      const existing = circleMap.get(stat.circle) || { totalLeads: 0, completed: 0, revenue: 0, profit: 0 }
      existing.completed = stat._count.id
      existing.revenue = stat._sum.billAmount || 0
      existing.profit = stat._sum.netProfit || 0
      circleMap.set(stat.circle, existing)
    })

    const circlePerformance = Array.from(circleMap.entries()).map(([circle, data]) => {
      const conversionRate = data.totalLeads > 0 ? (data.completed / data.totalLeads) * 100 : 0
      const avgTicketSize = data.completed > 0 ? data.revenue / data.completed : 0

      return {
        circle,
        totalLeads: data.totalLeads,
        completedSurgeries: data.completed,
        conversionRate: Math.round(conversionRate * 100) / 100,
        revenue: data.revenue,
        profit: data.profit,
        avgTicketSize: Math.round(avgTicketSize * 100) / 100,
      }
    })

    return successResponse({
      circlePerformance,
    })
  } catch (error) {
    console.error('Error fetching geographic analytics:', error)
    return errorResponse('Failed to fetch geographic analytics', 500)
  }
}
