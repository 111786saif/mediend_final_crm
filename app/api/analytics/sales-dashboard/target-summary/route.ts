import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

/**
 * GET /api/analytics/sales-dashboard/target-summary?startDate=&endDate=
 *
 * Org- or team-scoped IPD done vs assigned target for the selected period.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!canAccessSalesDashboard(user)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return errorResponse('startDate and endDate are required', 400)
    }

    const dateFilter = buildDateRange(startDate, endDate)
    const periodStart = dateFilter.gte as Date
    const periodEnd = dateFilter.lte as Date

    const bdIdFilter = await getSalesDashboardBdIdFilter(user)
    const teamScope: Prisma.LeadWhereInput = bdIdFilter
      ? { bdId: { in: bdIdFilter } }
      : {}
    let targetScope: Prisma.TargetWhereInput = {
      targetType: 'TEAM',
      periodStartDate: { lte: periodEnd },
      periodEndDate: { gte: periodStart },
      metric: { in: ['IPD_DONE', 'SURGERIES_DONE'] },
    }

    if (isSubtreeScopedSalesRole(user.role)) {
      const emp = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (emp) {
        targetScope.targetForId = emp.id
      }
    }

    const [ipdDone, teamTargets] = await Promise.all([
      prisma.lead.count({
        where: {
          ...teamScope,
          ...canonicalSalesCompletedWhere(dateFilter),
        },
      }),
      prisma.target.findMany({ where: targetScope }),
    ])

    let assignedTarget = 0
    for (const target of teamTargets) {
      const overlapStart = new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime()))
      const overlapEnd = new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime()))
      const overlapDays =
        (overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000) + 1
      const targetDays =
        (target.periodEndDate.getTime() - target.periodStartDate.getTime()) / (24 * 60 * 60 * 1000) + 1
      const fraction = targetDays > 0 ? Math.min(1, overlapDays / targetDays) : 1
      assignedTarget += target.targetValue * fraction
    }

    assignedTarget = Math.round(assignedTarget * 10) / 10
    const achievementPercentage =
      assignedTarget > 0 ? Math.round((ipdDone / assignedTarget) * 1000) / 10 : null

    return successResponse({
      ipdDone,
      assignedTarget,
      achievementPercentage,
      teamTargetCount: teamTargets.length,
    })
  } catch (error) {
    console.error('Target summary error:', error)
    return errorResponse('Failed to fetch target summary', 500)
  }
}
