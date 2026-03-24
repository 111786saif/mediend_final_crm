import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

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
    const teamId = searchParams.get('teamId')
    if (!teamId) return errorResponse('teamId is required', 400)

    if (user.role === UserRole.TEAM_LEAD && user.teamId !== teamId) {
      return errorResponse('Forbidden', 403)
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        salesHead: { select: { id: true, name: true, profilePicture: true } },
        teamLead: { select: { id: true, name: true, profilePicture: true } },
        members: {
          where: { role: UserRole.BD },
          select: { id: true, name: true, profilePicture: true },
        },
      },
    })

    if (!team) return errorResponse('Team not found', 404)

    const bdIds = team.members.map((m) => m.id)

    // Aggregate leads and IPD for each member in the period
    const [allLeads, completedLeads] = await Promise.all([
      prisma.lead.groupBy({
        by: ['bdId'],
        where: {
          bdId: { in: bdIds },
          OR: [
            { leadDate: { gte: start, lte: end } },
            { AND: [{ leadDate: null }, { createdDate: { gte: start, lte: end } }] },
          ],
        },
        _count: { id: true },
        _sum: { netProfit: true, billAmount: true },
      }),
      prisma.lead.groupBy({
        by: ['bdId'],
        where: {
          bdId: { in: bdIds },
          pipelineStage: 'COMPLETED',
          OR: [
            { conversionDate: { gte: start, lte: end } },
            { AND: [{ conversionDate: null }, { surgeryDate: { gte: start, lte: end } }] },
            { AND: [{ conversionDate: null }, { surgeryDate: null }, { leadDate: { gte: start, lte: end } }] },
          ],
        },
        _count: { id: true },
        _sum: { netProfit: true, billAmount: true },
      }),
    ])

    const leadsMap = new Map(allLeads.map((r) => [r.bdId, r]))
    const ipdMap = new Map(completedLeads.map((r) => [r.bdId, r]))

    const members = team.members.map((m) => {
      const leads = leadsMap.get(m.id)?._count.id ?? 0
      const ipd = ipdMap.get(m.id)?._count.id ?? 0
      const profit = ipdMap.get(m.id)?._sum.netProfit ?? 0
      const bill = ipdMap.get(m.id)?._sum.billAmount ?? 0
      return {
        id: m.id,
        name: m.name,
        profilePicture: m.profilePicture ?? null,
        leads,
        ipdDone: ipd,
        conversionRate: leads > 0 ? (ipd / leads) * 100 : 0,
        netProfit: profit,
        billAmount: bill,
      }
    }).sort((a, b) => b.ipdDone - a.ipdDone)

    // Team totals
    const totalLeads = members.reduce((s, m) => s + m.leads, 0)
    const totalIpd = members.reduce((s, m) => s + m.ipdDone, 0)
    const totalProfit = members.reduce((s, m) => s + m.netProfit, 0)
    const totalBill = members.reduce((s, m) => s + m.billAmount, 0)

    // Month-wise breakdown for the whole team (all time)
    // Leads bucketed by leadDate, IPDs bucketed by conversionDate (when done, not when received)
    const [leadsByMonth, ipdByMonth] = await Promise.all([
      prisma.$queryRaw<{ month: string; bdId: string; bdName: string; count: number }[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadDate", l."createdDate"), 'YYYY-MM') AS month,
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
          TO_CHAR(COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate"), 'YYYY-MM') AS month,
          u.id AS "bdId",
          u.name AS "bdName",
          COUNT(*)::int AS count
        FROM "Lead" l
        JOIN "User" u ON u.id = l."bdId"
        WHERE l."bdId" = ANY(${bdIds}) AND l."pipelineStage" = 'COMPLETED'
        GROUP BY 1, u.id, u.name
        ORDER BY 1, u.name
      `,
    ])

    const allMonths = [...new Set([...leadsByMonth.map((r) => r.month), ...ipdByMonth.map((r) => r.month)])].sort()

    // Merge lead counts and ipd counts by (month, bdId) key
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
        id: team.id,
        name: team.name,
        salesHead: team.salesHead,
        teamLead: team.teamLead,
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
