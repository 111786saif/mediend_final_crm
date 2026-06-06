import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

interface LeadRow {
  month: string
  bdId: string
  bdName: string
  bdEmployeeId: string | null
  managerId: string | null
  managerName: string | null
  leadCount: number
}

interface IpdRow {
  month: string
  bdId: string
  bdName: string
  bdEmployeeId: string | null
  managerId: string | null
  managerName: string | null
  ipdCount: number
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (
      user.role !== 'MD' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SALES_HEAD' &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'TEAM_LEAD'
    ) {
      return errorResponse('Forbidden', 403)
    }

    // For TEAM_LEAD: restrict to their subordinates
    let bdIdFilter: Prisma.Sql = Prisma.sql``
    if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      const allowedIds = [user.id, ...subIds]
      bdIdFilter = Prisma.sql`AND u.id = ANY(${allowedIds})`
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const start = startDate
      ? new Date(startDate + 'T00:00:00.000Z')
      : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate
      ? new Date(endDate + 'T23:59:59.999Z')
      : new Date()

    const [leadRows, ipdRows] = await Promise.all([
      // Leads by month by BD with manager info
      prisma.$queryRaw<LeadRow[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM')  AS month,
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
          ${bdIdFilter}
        GROUP BY u.id, u.name, e.id, me.id, mu.name,
                 TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM')
        ORDER BY u.name,
                 TO_CHAR(COALESCE(l."leadEntryDate", l."createdDate"), 'YYYY-MM')
      `,

      // IPD by month by BD
      prisma.$queryRaw<IpdRow[]>`
        SELECT
          TO_CHAR(l."surgeryDate", 'YYYY-MM') AS month,
          u.id                              AS "bdId",
          u.name                            AS "bdName",
          e.id                              AS "bdEmployeeId",
          me.id                             AS "managerId",
          mu.name                           AS "managerName",
          COUNT(*)::int                     AS "ipdCount"
        FROM "Lead" l
        JOIN "User" u   ON u.id   = l."bdId"
        LEFT JOIN "Employee" e ON e."userId" = u.id
        LEFT JOIN "Employee" me ON me.id = e."managerId"
        LEFT JOIN "User" mu ON mu.id = me."userId"
        WHERE (l."caseStage" IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED') OR (l."caseStage" IN ('PL_PENDING','OUTSTANDING') AND l."surgeryDate" IS NOT NULL))
          AND l."surgeryDate" >= ${start}
          AND l."surgeryDate" <= ${end}
          ${bdIdFilter}
        GROUP BY u.id, u.name, e.id, me.id, mu.name,
                 TO_CHAR(l."surgeryDate", 'YYYY-MM')
        ORDER BY u.name,
                 TO_CHAR(l."surgeryDate", 'YYYY-MM')
      `,
    ])

    const allMonths = [
      ...new Set([...leadRows.map((r) => r.month), ...ipdRows.map((r) => r.month)]),
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
    for (const row of ipdRows) {
      const entry = getOrCreate(row.bdId, row.bdName, row.bdEmployeeId, row.managerId, row.managerName)
      entry.ipd[row.month] = (entry.ipd[row.month] ?? 0) + Number(row.ipdCount)
    }

    const bds = Array.from(bdMap.values())
      .map((bd) => ({
        ...bd,
        totalLeads: Object.values(bd.leads).reduce((a, b) => a + b, 0),
        totalIpd: Object.values(bd.ipd).reduce((a, b) => a + b, 0),
      }))
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
