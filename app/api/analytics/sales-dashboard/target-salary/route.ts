import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSession } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return unauthorizedResponse()

    if (user.role !== 'MD' && user.role !== 'ADMIN' && user.role !== 'SALES_HEAD' && user.role !== 'EXECUTIVE_ASSISTANT') {
      return errorResponse(`Forbidden: Only MD, ADMIN, SALES_HEAD, and EXECUTIVE_ASSISTANT can access.`, 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return errorResponse('startDate and endDate are required', 400)
    }

    const periodStart = new Date(startDate)
    const periodEnd = new Date(endDate)
    const dateFilter: Prisma.DateTimeFilter = { gte: periodStart, lte: periodEnd }

    const [targets, bdsWithEmployee] = await Promise.all([
      prisma.target.findMany({
        where: {
          periodStartDate: { lte: periodEnd },
          periodEndDate: { gte: periodStart },
        },
        include: { bonusRules: true },
      }),
      prisma.user.findMany({
        where: { role: 'BD' },
        select: {
          id: true,
          name: true,
          employee: {
            select: {
              id: true,
              managerId: true,
              manager: { select: { user: { select: { name: true } } } },
              salary: true,
              salaryStructures: { orderBy: { effectiveFrom: 'desc' }, take: 1, select: { monthlyGross: true } },
            },
          },
        },
      }),
    ])

    // Team targets: targetForId = manager's Employee.id
    const teamTargetBreakdown: Array<{
      managerId: string | null
      teamName: string
      targets: Array<{
        metric: string
        targetValue: number
        achieved: number
        percentage: number
      }>
    }> = []

    const teamTargetsOnly = targets.filter((t) => t.targetType === 'TEAM')
    for (const target of teamTargetsOnly) {
      const overlapStart = new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime()))
      const overlapEnd = new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime()))

      // Resolve manager's subordinate user IDs
      const managerEmp = await prisma.employee.findUnique({
        where: { id: target.targetForId },
        select: { userId: true, user: { select: { name: true } } },
      })
      if (!managerEmp) continue

      const subIds = await getSubordinateUserIdsForLeadAccess(managerEmp.userId)
      const teamUserIds = [managerEmp.userId, ...subIds]

      const where: Prisma.LeadWhereInput = {
        pipelineStage: 'COMPLETED',
        conversionDate: { gte: overlapStart, lte: overlapEnd },
        bdId: { in: teamUserIds },
      }

      let achieved = 0
      switch (target.metric) {
        case 'LEADS_CLOSED':
        case 'SURGERIES_DONE':
          achieved = await prisma.lead.count({ where })
          break
        case 'NET_PROFIT': {
          const agg = await prisma.lead.aggregate({ where, _sum: { netProfit: true } })
          achieved = agg._sum.netProfit ?? 0
          break
        }
        case 'BILL_AMOUNT': {
          const agg = await prisma.lead.aggregate({ where, _sum: { billAmount: true } })
          achieved = agg._sum.billAmount ?? 0
          break
        }
      }

      const teamName = `${managerEmp.user.name}'s Team`
      let teamEntry = teamTargetBreakdown.find((t) => t.managerId === target.targetForId)
      if (!teamEntry) {
        teamEntry = { managerId: target.targetForId, teamName, targets: [] }
        teamTargetBreakdown.push(teamEntry)
      }
      teamEntry.targets.push({
        metric: target.metric,
        targetValue: target.targetValue,
        achieved,
        percentage: target.targetValue > 0 ? (achieved / target.targetValue) * 100 : 0,
      })
    }

    const bdSalaryTarget: Array<{
      bdId: string
      bdName: string
      managerName: string | null
      salary: number | null
      targetValue: number
      achieved: number
      ratio: number | null
    }> = []

    const bdTargets = targets.filter((t) => t.targetType === 'BD')
    for (const bd of bdsWithEmployee) {
      const salary = bd.employee?.salary ?? bd.employee?.salaryStructures?.[0]?.monthlyGross ?? null
      const bdTargetsForUser = bdTargets.filter((t) => t.targetForId === bd.id)
      let targetValue = 0
      let achieved = 0
      for (const target of bdTargetsForUser) {
        const overlapStart = new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime()))
        const overlapEnd = new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime()))
        const where: Prisma.LeadWhereInput = {
          pipelineStage: 'COMPLETED',
          bdId: bd.id,
          conversionDate: { gte: overlapStart, lte: overlapEnd },
        }
        switch (target.metric) {
          case 'LEADS_CLOSED':
          case 'SURGERIES_DONE':
            achieved += await prisma.lead.count({ where })
            break
          case 'NET_PROFIT': {
            const agg = await prisma.lead.aggregate({ where, _sum: { netProfit: true } })
            achieved += agg._sum.netProfit ?? 0
            break
          }
          case 'BILL_AMOUNT': {
            const agg = await prisma.lead.aggregate({ where, _sum: { billAmount: true } })
            achieved += agg._sum.billAmount ?? 0
            break
          }
        }
        targetValue += target.targetValue
      }
      bdSalaryTarget.push({
        bdId: bd.id,
        bdName: bd.name,
        managerName: bd.employee?.manager?.user?.name ?? null,
        salary: salary ?? null,
        targetValue,
        achieved,
        ratio: salary != null && salary > 0 ? achieved / salary : null,
      })
    }

    return successResponse({
      teamTargetBreakdown,
      bdSalaryTarget: bdSalaryTarget.sort((a, b) => (b.achieved ?? 0) - (a.achieved ?? 0)),
    })
  } catch (error) {
    console.error('Target salary error:', error)
    return errorResponse('Failed to fetch target/salary breakdown', 500)
  }
}
