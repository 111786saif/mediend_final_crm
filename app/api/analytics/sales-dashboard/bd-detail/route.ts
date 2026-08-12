import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

import { canonicalSalesCompletedWhere, resolveIpdDate, buildDateRange } from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!(await canAccessSalesDashboard(user))) {
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

    // TL/ACM/CM gate: can only view BDs in their recursive subtree (incl. self)
    if (isSubtreeScopedSalesRole(user.role)) {
      const bdIdFilter = await getSalesDashboardBdIdFilter(user)
      if (!bdIdFilter?.includes(bdId)) {
        return errorResponse('Forbidden', 403)
      }
    }

    const totalLeads = allLeads.length
    // ipdDone, netProfit come from completedLeads (conversionDate-filtered)
    // billAmount is computed as sum of all leads in selected period per user request
    const ipdDone = completedLeads.length
    const conversionRate = totalLeads > 0 ? (ipdDone / totalLeads) * 100 : 0
    const netProfit = completedLeads.reduce((s, l) => s + (l.netProfit ?? 0), 0)
    const billAmount = allLeads.reduce((s, l) => s + (l.billAmount ?? 0), 0)
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
          TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM "Lead" l
        LEFT JOIN "AdmissionRecord" ar ON ar."leadId" = l.id
        WHERE l."bdId" = ${bdId}
          AND (l."caseStage" IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
               OR (l."caseStage" IN ('PL_PENDING','OUTSTANDING') AND COALESCE(l."surgeryDate", ar."surgeryDate") IS NOT NULL))
          AND COALESCE(l."surgeryDate", ar."surgeryDate") >= ${start}
          AND COALESCE(l."surgeryDate", ar."surgeryDate") <= ${end}
        GROUP BY 1
        ORDER BY 1
      `,
    ])
    const allMonthsSet = new Set([...leadsByMonth.map((r) => r.month), ...ipdByMonth.map((r) => r.month)])
    const leadMonthMap = new Map<string, number>(leadsByMonth.map((r) => [r.month, Number(r.count)]))
    const ipdMonthMap = new Map<string, number>(ipdByMonth.map((r) => [r.month, Number(r.count)]))
    const allLeadsAllTime = [...allMonthsSet].sort().map((month) => ({
      month,
      leadCount: leadMonthMap.get(month) ?? 0,
      ipdCount: ipdMonthMap.get(month) ?? 0,
    }))

    const getMonthKey = (date: Date, offsetMonths: number) => {
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offsetMonths, 1))
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      return `${y}-${m}`
    }

    const endDateObj = new Date(end)
    const currentMonthKey = getMonthKey(endDateObj, 0)
    const prevMonthKey = getMonthKey(endDateObj, 1)
    const prev2MonthKey = getMonthKey(endDateObj, 2)
    const prev3MonthKey = getMonthKey(endDateObj, 3)

    let ipdCurrent = 0
    let ipdPrev = 0
    let ipdPrev2 = 0
    let ipdPrev3 = 0
    let ipdOlder = 0

    ipdByMonth.forEach((r) => {
      const c = Number(r.count)
      if (r.month === currentMonthKey) ipdCurrent = c
      else if (r.month === prevMonthKey) ipdPrev = c
      else if (r.month === prev2MonthKey) ipdPrev2 = c
      else if (r.month === prev3MonthKey) ipdPrev3 = c
      else ipdOlder += c
    })

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
      date: l.surgeryDate?.toISOString() ?? null,
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
      ipdCurrent,
      ipdPrev,
      ipdPrev2,
      ipdPrev3,
      ipdOlder,
      monthWise: allLeadsAllTime,
      monthWiseHeaders: {
        current: currentMonthKey,
        prev: prevMonthKey,
        prev2: prev2MonthKey,
        prev3: prev3MonthKey,
      },
      treatmentBreakdown: Object.entries(treatmentBreakdown)
        .map(([treatment, count]) => ({ treatment, count }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (error) {
    console.error('BD detail error:', error)
    return errorResponse('Failed to fetch BD detail', 500)
  }
}
