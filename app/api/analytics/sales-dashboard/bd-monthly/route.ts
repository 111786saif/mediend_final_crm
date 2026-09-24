import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getManagementChain } from '@/lib/hierarchy'
import { leadConvertedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'

interface LeadRow {
  month: string
  bdId: string
  bdName: string
  bdEmployeeId: string | null
  managerId: string | null
  managerName: string | null
  leadCount: number
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!(await canAccessSalesDashboard(user))) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const currentYear = new Date().getFullYear()
    const defaultStartStr = `${currentYear}-01-01`
    const defaultEndStr = new Date().toISOString().slice(0, 10)

    const dateFilter = buildDateRange(startDateParam || defaultStartStr, endDateParam || defaultEndStr)
    const start = dateFilter.gte as Date
    const end = dateFilter.lte as Date

    const bdIdFilter = await getSalesDashboardBdIdFilter(user)

    const leadDateWhere: Prisma.LeadWhereInput = bdIdFilter
      ? { bdId: { in: bdIdFilter } }
      : {}

    const [leadRows, completedLeads] = await Promise.all([
      // Leads by month by BD with manager info
      prisma.$queryRaw<LeadRow[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate") AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')  AS month,
          u.id                                                           AS "bdId",
          u.name                                                         AS "bdName",
          e.id                                                           AS "bdEmployeeId",
          me.id                                                          AS "managerId",
          mu.name                                                        AS "managerName",
          COUNT(*)::int                                                  AS "leadCount"
        FROM "Lead" l
        JOIN "User" u   ON u.id   = l."bdId"
        LEFT JOIN "Employee" e ON e."userId" = u.id
        LEFT JOIN "Employee" me ON me.id = e."managerId"
        LEFT JOIN "User" mu ON mu.id = me."userId"
        WHERE COALESCE(l."leadEntryDate", l."createdDate") >= ${start}
          AND COALESCE(l."leadEntryDate", l."createdDate") <= ${end}
          ${bdIdFilter ? Prisma.sql`AND u.id = ANY(${bdIdFilter})` : Prisma.sql``}
        GROUP BY u.id, u.name, e.id, me.id, mu.name,
                 TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate") AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
        ORDER BY u.name,
                 TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate") AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
      `,

      // Converted IPD leads from the cohort of leads entered in range
      prisma.lead.findMany({
        where: {
          AND: [
            ...(bdIdFilter ? [{ bdId: { in: bdIdFilter } }] : []),
            leadConvertedWhere(),
            {
              OR: [
                { leadEntryDate: { gte: start, lte: end } },
                { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
              ],
            },
          ],
        },
        select: {
          id: true,
          bdId: true,
          billAmount: true,
          netProfit: true,
          leadEntryDate: true,
          createdDate: true,
          surgeryDate: true,
          admissionRecord: { select: { surgeryDate: true } },
        },
      }),
    ])

    // Bucket converted leads by cohort entry month (leadEntryDate / createdDate)
    const ipdByMonth: { month: string; bdId: string; ipdCount: number }[] = []
    const monthCounts = new Map<string, Map<string, number>>()

    for (const lead of completedLeads) {
      const entryDate = lead.leadEntryDate ?? lead.createdDate
      if (!entryDate) continue
      const month = entryDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
      const bdId = lead.bdId ?? 'unknown'

      if (!monthCounts.has(month)) monthCounts.set(month, new Map())
      const bdMap = monthCounts.get(month)!
      bdMap.set(bdId, (bdMap.get(bdId) ?? 0) + 1)
    }

    for (const [month, bdMap] of monthCounts.entries()) {
      for (const [bdId, count] of bdMap.entries()) {
        ipdByMonth.push({ month, bdId, ipdCount: count })
      }
    }

    // Resolve BD/manager names from the lead rows
    const bdNameMap = new Map<string, { bdName: string; bdEmployeeId: string | null; managerId: string | null; managerName: string | null }>()
    for (const row of leadRows) {
      bdNameMap.set(row.bdId, {
        bdName: row.bdName,
        bdEmployeeId: row.bdEmployeeId,
        managerId: row.managerId,
        managerName: row.managerName,
      })
    }

    const allMonths = [
      ...new Set([...leadRows.map((r) => r.month), ...ipdByMonth.map((r) => r.month)]),
    ].sort()

    type BdEntry = {
      bdId: string
      bdName: string
      bdEmployeeId: string | null
      managerId: string | null
      managerName: string | null
      leads: Record<string, number>
      ipd: Record<string, number>
    }
    const bdMap = new Map<string, BdEntry>()

    const getOrCreate = (bdId: string, bdName: string, bdEmployeeId: string | null, managerId: string | null, managerName: string | null): BdEntry => {
      if (!bdMap.has(bdId)) {
        bdMap.set(bdId, { bdId, bdName, bdEmployeeId, managerId, managerName, leads: {}, ipd: {} })
      }
      return bdMap.get(bdId)!
    }

    for (const row of leadRows) {
      const entry = getOrCreate(row.bdId, row.bdName, row.bdEmployeeId, row.managerId, row.managerName)
      entry.leads[row.month] = (entry.leads[row.month] ?? 0) + Number(row.leadCount)
    }
    for (const row of ipdByMonth) {
      const names = bdNameMap.get(row.bdId) ?? { bdName: row.bdId, bdEmployeeId: null, managerId: null, managerName: null }
      const entry = getOrCreate(row.bdId, names.bdName || row.bdId, names.bdEmployeeId, names.managerId, names.managerName)
      entry.ipd[row.month] = (entry.ipd[row.month] ?? 0) + Number(row.ipdCount)
    }

    // Resolve Category Manager ancestry for each BD (walk management chain)
    const cmByBdEmployeeId = new Map<string, { cmManagerId: string; cmManagerName: string }>()
    const uniqueBdEmployeeIds = [
      ...new Set(
        Array.from(bdMap.values())
          .map((bd) => bd.bdEmployeeId)
          .filter((id): id is string => !!id)
      ),
    ]
    await Promise.all(
      uniqueBdEmployeeIds.map(async (empId) => {
        const chain = await getManagementChain(empId)
        const cm = chain.find((e) => e.user.role === UserRole.CATEGORY_MANAGER)
        if (cm) {
          cmByBdEmployeeId.set(empId, {
            cmManagerId: cm.id,
            cmManagerName: cm.user.name,
          })
        }
      })
    )

    const bds = Array.from(bdMap.values())
      .map((bd) => {
        const cm = bd.bdEmployeeId ? cmByBdEmployeeId.get(bd.bdEmployeeId) : undefined
        return {
          ...bd,
          cmManagerId: cm?.cmManagerId ?? null,
          cmManagerName: cm?.cmManagerName ?? null,
          totalLeads: Object.values(bd.leads).reduce((a, b) => a + b, 0),
          totalIpd: Object.values(bd.ipd).reduce((a, b) => a + b, 0),
        }
      })
      .sort((a, b) => b.totalLeads - a.totalLeads)

    const monthLeadTotals: Record<string, number> = {}
    const monthIpdTotals: Record<string, number> = {}
    for (const bd of bds) {
      for (const [m, v] of Object.entries(bd.leads)) monthLeadTotals[m] = (monthLeadTotals[m] ?? 0) + v
      for (const [m, v] of Object.entries(bd.ipd)) monthIpdTotals[m] = (monthIpdTotals[m] ?? 0) + v
    }

    return successResponse({
      months: allMonths,
      bds,
      totals: {
        leads: monthLeadTotals,
        ipd: monthIpdTotals,
        totalLeads: Object.values(monthLeadTotals).reduce((a, b) => a + b, 0),
        totalIpd: Object.values(monthIpdTotals).reduce((a, b) => a + b, 0),
      },
    })
  } catch (error) {
    console.error('BD monthly error:', error)
    return errorResponse('Failed to fetch BD monthly breakdown', 500)
  }
}
