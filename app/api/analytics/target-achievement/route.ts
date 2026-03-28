import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

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

    if (!startDate || !endDate) {
      return errorResponse('startDate and endDate are required', 400)
    }

    const periodStart = new Date(startDate)
    const periodEnd = new Date(endDate)

    // Get all targets for the period (no team relation anymore)
    const targets = await prisma.target.findMany({
      where: {
        periodStartDate: { lte: periodEnd },
        periodEndDate: { gte: periodStart },
      },
      include: {
        bonusRules: true,
      },
    })

    // Get BD users for target lookup
    const bdUsers = await prisma.user.findMany({
      where: { role: 'BD' },
      select: { id: true, name: true },
    })

    // For TEAM targets: targetForId = manager's Employee.id; get manager name
    const managerEmployees = await prisma.employee.findMany({
      where: { id: { in: targets.filter((t) => t.targetType === 'TEAM').map((t) => t.targetForId) } },
      select: { id: true, user: { select: { name: true } } },
    })
    const managerMap = new Map(managerEmployees.map((e) => [e.id, e.user.name]))

    // Role-based scoping
    let roleFilter: Prisma.LeadWhereInput = {}
    if (user.role === 'BD') {
      roleFilter = { bdId: user.id }
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      roleFilter = { bdId: { in: [user.id, ...subIds] } }
    }

    // Calculate achievements for each target
    const targetAchievements = await Promise.all(
      targets.map(async (target) => {
        const dateFilter: Prisma.DateTimeFilter = {
          gte: new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime())),
          lte: new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime())),
        }

        const where: Prisma.LeadWhereInput = {
          pipelineStage: 'COMPLETED',
          conversionDate: dateFilter,
          ...roleFilter,
        }

        // Apply target-specific filtering (but don't override role filter)
        if (target.targetType === 'BD' && user.role !== 'BD') {
          where.bdId = target.targetForId
        } else if (target.targetType === 'TEAM') {
          // targetForId = manager's Employee.id — resolve to subordinate user IDs
          const managerEmp = await prisma.employee.findUnique({
            where: { id: target.targetForId },
            select: { userId: true },
          })
          if (managerEmp) {
            const subIds = await getSubordinateUserIdsForLeadAccess(managerEmp.userId)
            where.bdId = { in: [managerEmp.userId, ...subIds] }
          }
        }

        let achieved = 0

        switch (target.metric) {
          case 'LEADS_CLOSED':
          case 'SURGERIES_DONE':
            achieved = await prisma.lead.count({ where })
            break
          case 'NET_PROFIT': {
            const agg = await prisma.lead.aggregate({ where, _sum: { netProfit: true } })
            achieved = agg._sum.netProfit || 0
            break
          }
          case 'BILL_AMOUNT': {
            const agg = await prisma.lead.aggregate({ where, _sum: { billAmount: true } })
            achieved = agg._sum.billAmount || 0
            break
          }
        }

        const percentage = target.targetValue > 0 ? (achieved / target.targetValue) * 100 : 0

        let entityName = 'Unknown'
        if (target.targetType === 'BD') {
          const bd = bdUsers.find((u) => u.id === target.targetForId)
          entityName = bd?.name || 'Unknown BD'
        } else if (target.targetType === 'TEAM') {
          entityName = managerMap.get(target.targetForId) ? `${managerMap.get(target.targetForId)}'s Team` : 'Unknown Team'
        }

        return {
          targetId: target.id,
          targetType: target.targetType,
          entityName,
          metric: target.metric,
          periodType: target.periodType,
          periodStartDate: target.periodStartDate.toISOString(),
          periodEndDate: target.periodEndDate.toISOString(),
          targetValue: target.targetValue,
          achieved,
          percentage: Math.round(percentage * 100) / 100,
          bonusRules: target.bonusRules.map((rule) => ({
            id: rule.id,
            type: rule.ruleType,
            threshold: rule.thresholdValue,
            bonusAmount: rule.bonusAmount,
            bonusPercentage: rule.bonusPercentage,
            capAmount: rule.capAmount,
          })),
        }
      })
    )

    const overallSummary = {
      leadsClosed: { target: 0, achieved: 0, percentage: 0 },
      netProfit: { target: 0, achieved: 0, percentage: 0 },
      billAmount: { target: 0, achieved: 0, percentage: 0 },
      surgeriesDone: { target: 0, achieved: 0, percentage: 0 },
    }

    targetAchievements.forEach((achievement) => {
      const metricKey = achievement.metric.toLowerCase() as keyof typeof overallSummary
      if (overallSummary[metricKey]) {
        overallSummary[metricKey].target += achievement.targetValue
        overallSummary[metricKey].achieved += achievement.achieved
      }
    })

    Object.keys(overallSummary).forEach((key) => {
      const metric = overallSummary[key as keyof typeof overallSummary]
      metric.percentage = metric.target > 0 ? (metric.achieved / metric.target) * 100 : 0
      metric.percentage = Math.round(metric.percentage * 100) / 100
    })

    return successResponse({
      overallSummary,
      targetAchievements,
    })
  } catch (error) {
    console.error('Error fetching target achievement:', error)
    return errorResponse('Failed to fetch target achievement', 500)
  }
}
