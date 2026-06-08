import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSession } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'

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

    const dateFilter = buildDateRange(startDate, endDate)
    const periodStart = dateFilter.gte as Date
    const periodEnd = dateFilter.lte as Date

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
        ...canonicalSalesCompletedWhere({ gte: overlapStart, lte: overlapEnd }),
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

    // Pre-compute actual netProfit per BD for the period
    const netProfitAgg = await prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        ...canonicalSalesCompletedWhere({ gte: periodStart, lte: periodEnd }),
      },
      _sum: { netProfit: true },
    })
    const netProfitByBd = new Map<string, number>()
    for (const row of netProfitAgg) {
      netProfitByBd.set(row.bdId, row._sum.netProfit ?? 0)
    }

    const bdSalaryTarget: Array<{
      bdId: string
      bdName: string
      managerName: string | null
      salary: number | null
      netProfit: number
      revenueSalaryRatio: number | null
      targetValue: number
      achieved: number
      ratio: number | null
    }> = []

    const bdTargets = targets.filter((t) => t.targetType === 'BD')
    for (const bd of bdsWithEmployee) {
      const salary = bd.employee?.salary ?? bd.employee?.salaryStructures?.[0]?.monthlyGross ?? null
      const np = netProfitByBd.get(bd.id) ?? 0
      const bdTargetsForUser = bdTargets.filter((t) => t.targetForId === bd.id)
      let targetValue = 0
      let achieved = 0
      for (const target of bdTargetsForUser) {
        const overlapStart = new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime()))
        const overlapEnd = new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime()))
        const where: Prisma.LeadWhereInput = {
          ...canonicalSalesCompletedWhere({ gte: overlapStart, lte: overlapEnd }),
          bdId: bd.id,
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
        netProfit: np,
        revenueSalaryRatio: salary != null && salary > 0 ? np / salary : null,
        targetValue,
        achieved,
        ratio: salary != null && salary > 0 ? achieved / salary : null,
      })
    }

    // Team-level salary aggregation: group BDs by manager, include manager's own salary
    const managerEmpIds = new Set(bdsWithEmployee.map((b) => b.employee?.managerId).filter(Boolean) as string[])
    const managersWithSalary = await prisma.employee.findMany({
      where: { id: { in: [...managerEmpIds] } },
      select: { id: true, salary: true, salaryStructures: { orderBy: { effectiveFrom: 'desc' }, take: 1, select: { monthlyGross: true } }, user: { select: { name: true } } },
    })
    const managerSalaryMap = new Map<string, { salary: number; name: string }>()
    for (const m of managersWithSalary) {
      managerSalaryMap.set(m.id, { salary: m.salary ?? m.salaryStructures?.[0]?.monthlyGross ?? 0, name: m.user?.name ?? m.id })
    }

    const teamSalaryBreakdown: Array<{
      managerId: string
      teamName: string
      totalSalary: number
      totalNetProfit: number
      revenueSalaryRatio: number | null
      memberCount: number
    }> = []
    const teamMap = new Map<string, { totalSalary: number; totalNetProfit: number; memberCount: number }>()
    // Build a quick lookup from bdId -> salary + netProfit
    const bdLookup = new Map(bdSalaryTarget.map((b) => [b.bdId, b]))
    for (const bd of bdsWithEmployee) {
      const mgrId = bd.employee?.managerId
      if (!mgrId) continue
      if (!teamMap.has(mgrId)) teamMap.set(mgrId, { totalSalary: 0, totalNetProfit: 0, memberCount: 0 })
      const t = teamMap.get(mgrId)!
      const bdEntry = bdLookup.get(bd.id)
      t.totalSalary += bdEntry?.salary ?? 0
      t.totalNetProfit += bdEntry?.netProfit ?? 0
      t.memberCount += 1
    }
    for (const [mgrId, data] of teamMap) {
      const mgrInfo = managerSalaryMap.get(mgrId)
      const leadSalary = mgrInfo?.salary ?? 0
      data.totalSalary += leadSalary
      teamSalaryBreakdown.push({
        managerId: mgrId,
        teamName: mgrInfo?.name ?? mgrId,
        totalSalary: data.totalSalary,
        totalNetProfit: data.totalNetProfit,
        revenueSalaryRatio: data.totalSalary > 0 ? data.totalNetProfit / data.totalSalary : null,
        memberCount: data.memberCount,
      })
    }
    teamSalaryBreakdown.sort((a, b) => b.totalNetProfit - a.totalNetProfit)

    return successResponse({
      teamTargetBreakdown,
      bdSalaryTarget: bdSalaryTarget.sort((a, b) => (b.achieved ?? 0) - (a.achieved ?? 0)),
      teamSalaryBreakdown,
    })
  } catch (error) {
    console.error('Target salary error:', error)
    return errorResponse('Failed to fetch target/salary breakdown', 500)
  }
}
