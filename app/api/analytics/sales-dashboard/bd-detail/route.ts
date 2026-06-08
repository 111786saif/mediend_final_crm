import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { canonicalSalesCompletedWhere, resolveIpdDate, buildDateRange } from '@/lib/analytics/ipd-filters'

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
    const bdId = searchParams.get('bdId')
    if (!bdId) return errorResponse('bdId is required', 400)

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateFilter = buildDateRange(startDate, endDate)
    const start = dateFilter.gte ?? new Date(new Date().getFullYear(), 0, 1)
    const end = dateFilter.lte ?? new Date()

    const [bdUser, allLeads, completedLeads] = await Promise.all([
      prisma.user.findUnique({
        where: { id: bdId },
        select: {
          id: true,
          name: true,
          profilePicture: true,
          employee: {
            select: {
              manager: {
                select: {
                  id: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.lead.findMany({
        where: {
          bdId,
          OR: [
            { leadEntryDate: { gte: start, lte: end } },
            { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
          ],
        },
        select: {
          id: true,
          leadEntryDate: true,
          createdDate: true,
          pipelineStage: true,
          netProfit: true,
          billAmount: true,
        },
      }),
      prisma.lead.findMany({
        where: {
          bdId,
          ...canonicalSalesCompletedWhere({ gte: start, lte: end }),
        },
        select: {
          id: true,
          patientName: true,
          treatment: true,
          hospitalName: true,
          surgeonName: true,
          conversionDate: true,
          surgeryDate: true,
          leadEntryDate: true,
          createdDate: true,
          billAmount: true,
          netProfit: true,
          circle: true,
          status: true,
        },
        orderBy: { conversionDate: 'desc' },
        take: 200,
      }),
    ])

    if (!bdUser) return errorResponse('BD not found', 404)

    // TEAM_LEAD gate: can only view BDs who are their subordinates
    if (user.role === UserRole.TEAM_LEAD) {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      if (!subIds.includes(bdId) && bdId !== user.id) {
        return errorResponse('Forbidden', 403)
      }
    }

    const totalLeads = allLeads.length
    // ipdDone, netProfit, billAmount come from completedLeads (conversionDate-filtered)
    // so they reflect IPDs actually done in the selected period, not leads received
    const ipdDone = completedLeads.length
    const conversionRate = totalLeads > 0 ? (ipdDone / totalLeads) * 100 : 0
    const netProfit = completedLeads.reduce((s, l) => s + (l.netProfit ?? 0), 0)
    const billAmount = completedLeads.reduce((s, l) => s + (l.billAmount ?? 0), 0)
    const avgTicketSize = ipdDone > 0 ? billAmount / ipdDone : 0

    // Month-wise breakdown (all leads for this BD, all time, no date filter)
    // Leads bucketed by leadEntryDate, IPDs bucketed by conversionDate (when done, not when received)
    const [leadsByMonth, ipdByMonth] = await Promise.all([
      prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Lead" l
        WHERE l."bdId" = ${bdId}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT
          TO_CHAR(COALESCE(l."surgeryDate", ar."surgeryDate"), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Lead" l
        LEFT JOIN "AdmissionRecord" ar ON ar."leadId" = l.id
        WHERE l."bdId" = ${bdId}
          AND (l."caseStage" IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
               OR (l."caseStage" IN ('PL_PENDING','OUTSTANDING') AND COALESCE(l."surgeryDate", ar."surgeryDate") IS NOT NULL))
        GROUP BY 1
        ORDER BY 1
      `,
    ])
    const allMonthsSet = new Set([...leadsByMonth.map((r) => r.month), ...ipdByMonth.map((r) => r.month)])
    const leadMonthMap = new Map(leadsByMonth.map((r) => [r.month, Number(r.count)]))
    const ipdMonthMap = new Map(ipdByMonth.map((r) => [r.month, Number(r.count)]))
    const allLeadsAllTime = [...allMonthsSet].sort().map((month) => ({
      month,
      leadCount: leadMonthMap.get(month) ?? 0,
      ipdCount: ipdMonthMap.get(month) ?? 0,
    }))

    // Treatment breakdown for pie chart
    const treatmentBreakdown: Record<string, number> = {}
    completedLeads.forEach((l) => {
      const t = l.treatment ?? 'Unknown'
      treatmentBreakdown[t] = (treatmentBreakdown[t] ?? 0) + 1
    })

    const surgeries = completedLeads.map((l) => ({
      id: l.id,
      patientName: l.patientName,
      treatment: l.treatment ?? 'Unknown',
      hospitalName: l.hospitalName,
      surgeonName: l.surgeonName ?? null,
      date: resolveIpdDate(l).toISOString(),
      billAmount: l.billAmount ?? 0,
      netProfit: l.netProfit ?? 0,
      circle: l.circle,
    }))

    return successResponse({
      bd: {
        id: bdUser.id,
        name: bdUser.name,
        profilePicture: bdUser.profilePicture ?? null,
        managerName: bdUser.employee?.manager?.user?.name ?? null,
      },
      kpis: {
        totalLeads,
        ipdDone,
        conversionRate,
        netProfit,
        billAmount,
        avgTicketSize,
      },
      surgeries,
      monthWise: allLeadsAllTime.map((r) => ({
        month: r.month,
        leadCount: Number(r.leadCount),
        ipdCount: Number(r.ipdCount),
      })),
      treatmentBreakdown: Object.entries(treatmentBreakdown)
        .map(([treatment, count]) => ({ treatment, count }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (error) {
    console.error('BD detail error:', error)
    return errorResponse('Failed to fetch BD detail', 500)
  }
}
