import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (
      user.role !== UserRole.MD &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SALES_HEAD &&
      user.role !== UserRole.EXECUTIVE_ASSISTANT &&
      user.role !== UserRole.TEAM_LEAD
    ) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    // Accept managerId (Employee.id of the manager) to define the team
    const managerId = searchParams.get('managerId') ?? searchParams.get('teamId')
    if (!managerId) return errorResponse('managerId is required', 400)

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()

    // Resolve the manager's employee record
    const managerEmp = await prisma.employee.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        user: { select: { id: true, name: true, profilePicture: true } },
        subordinates: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, profilePicture: true } },
          },
          where: { user: { role: UserRole.BD } },
        },
      },
    })

    if (!managerEmp) return errorResponse('Manager not found', 404)

    // Gate: TEAM_LEAD can only view their own team
    if (user.role === UserRole.TEAM_LEAD) {
      const managerEmpForUser = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!managerEmpForUser || managerEmpForUser.id !== managerId) {
        return errorResponse('Forbidden', 403)
      }
    }

    const bdMembers = managerEmp.subordinates
    const bdIds = bdMembers.map((m) => m.userId)

    // Include the manager themselves if they also do BD work
    const allUserIds = [managerEmp.user.id, ...bdIds]

    const [allLeads, completedLeads] = await Promise.all([
      prisma.lead.groupBy({
        by: ['bdId'],
        where: {
          bdId: { in: allUserIds },
          OR: [
            { leadEntryDate: { gte: start, lte: end } },
            { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
          ],
        },
        _count: { id: true },
        _sum: { netProfit: true, billAmount: true },
      }),
      prisma.lead.groupBy({
        by: ['bdId'],
        where: {
          bdId: { in: allUserIds },
          pipelineStage: { in: ['PL', 'COMPLETED'] },
          ...ipdDoneDateFilter({ gte: start, lte: end }),
        },
        _count: { id: true },
        _sum: { netProfit: true, billAmount: true },
      }),
    ])

    const leadsMap = new Map(allLeads.map((r) => [r.bdId, r]))
    const ipdMap = new Map(completedLeads.map((r) => [r.bdId, r]))

    const members = bdMembers.map((m) => {
      const leads = leadsMap.get(m.userId)?._count.id ?? 0
      const ipd = ipdMap.get(m.userId)?._count.id ?? 0
      const profit = ipdMap.get(m.userId)?._sum.netProfit ?? 0
      const bill = ipdMap.get(m.userId)?._sum.billAmount ?? 0
      return {
        id: m.userId,
        name: m.user.name,
        profilePicture: m.user.profilePicture ?? null,
        leads,
        ipdDone: ipd,
        conversionRate: leads > 0 ? (ipd / leads) * 100 : 0,
        netProfit: profit,
        billAmount: bill,
      }
    }).sort((a, b) => b.ipdDone - a.ipdDone)

    const totalLeads = members.reduce((s, m) => s + m.leads, 0)
    const totalIpd = members.reduce((s, m) => s + m.ipdDone, 0)
    const totalProfit = members.reduce((s, m) => s + m.netProfit, 0)
    const totalBill = members.reduce((s, m) => s + m.billAmount, 0)

    const [leadsByMonth, ipdByMonth] = await Promise.all([
      prisma.$queryRaw<{ month: string; bdId: string; bdName: string; count: number }[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM') AS month,
          u.id AS "bdId",
          u.name AS "bdName",
          COUNT(*)::int AS count
        FROM "Lead" l
        JOIN "User" u ON u.id = l."bdId"
        WHERE l."bdId" = ANY(${bdIds})
        GROUP BY 1, u.id, u.name
        ORDER BY 1, u.name
      `,
      prisma.$queryRaw<{ month: string; bdId: string; bdName: string; count: number }[]>`
        SELECT
          TO_CHAR(COALESCE(l."surgeryDate", l."conversionDate", l."leadEntryDate", l."createdDate"), 'YYYY-MM') AS month,
          u.id AS "bdId",
          u.name AS "bdName",
          COUNT(*)::int AS count
        FROM "Lead" l
        JOIN "User" u ON u.id = l."bdId"
        WHERE l."bdId" = ANY(${bdIds}) AND l."pipelineStage" IN ('PL', 'COMPLETED')
        GROUP BY 1, u.id, u.name
        ORDER BY 1, u.name
      `,
    ])

    const allMonths = [...new Set([...leadsByMonth.map((r) => r.month), ...ipdByMonth.map((r) => r.month)])].sort()
    const monthWiseMap = new Map<string, { month: string; bdId: string; bdName: string; leadCount: number; ipdCount: number }>()
    for (const r of leadsByMonth) {
      const key = `${r.month}|${r.bdId}`
      monthWiseMap.set(key, { month: r.month, bdId: r.bdId, bdName: r.bdName, leadCount: Number(r.count), ipdCount: 0 })
    }
    for (const r of ipdByMonth) {
      const key = `${r.month}|${r.bdId}`
      const existing = monthWiseMap.get(key)
      if (existing) {
        existing.ipdCount = Number(r.count)
      } else {
        monthWiseMap.set(key, { month: r.month, bdId: r.bdId, bdName: r.bdName, leadCount: 0, ipdCount: Number(r.count) })
      }
    }
    const monthWise = [...monthWiseMap.values()].sort((a, b) => a.month.localeCompare(b.month) || a.bdName.localeCompare(b.bdName))

    return successResponse({
      team: {
        id: managerId,
        name: `${managerEmp.user.name}'s Team`,
        manager: managerEmp.user,
      },
      kpis: {
        totalLeads,
        totalIpd,
        totalProfit,
        totalBill,
        conversionRate: totalLeads > 0 ? (totalIpd / totalLeads) * 100 : 0,
      },
      members,
      monthWise: {
        months: allMonths,
        rows: monthWise.map((r) => ({
          month: r.month,
          bdId: r.bdId,
          bdName: r.bdName,
          leadCount: Number(r.leadCount),
          ipdCount: Number(r.ipdCount),
        })),
      },
    })
  } catch (error) {
    console.error('Team detail error:', error)
    return errorResponse('Failed to fetch team detail', 500)
  }
}
