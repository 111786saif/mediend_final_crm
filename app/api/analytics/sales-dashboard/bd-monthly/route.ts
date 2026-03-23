import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSession } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

interface LeadRow {
  month: string
  bdId: string
  bdName: string
  teamId: string | null
  teamName: string | null
  leadCount: number
}

interface IpdRow {
  month: string
  bdId: string
  bdName: string
  teamId: string | null
  teamName: string | null
  ipdCount: number
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
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
    if (user.role === 'TEAM_LEAD' && !user.teamId) {
      return errorResponse('No team assigned', 403)
    }

    const teamSql =
      user.role === 'TEAM_LEAD' && user.teamId
        ? Prisma.sql`AND t.id = ${user.teamId}`
        : Prisma.sql``

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Default: current calendar year
    const start = startDate
      ? new Date(startDate + 'T00:00:00.000Z')
      : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate
      ? new Date(endDate + 'T23:59:59.999Z')
      : new Date()

    const [leadRows, ipdRows] = await Promise.all([
      // Leads by month by BD — using leadDate (canonical lead-received date) with fallback
      prisma.$queryRaw<LeadRow[]>`
        SELECT
          TO_CHAR(COALESCE(l."leadDate", l."createdDate"), 'YYYY-MM') AS month,
          u.id                                                          AS "bdId",
          u.name                                                        AS "bdName",
          t.id                                                          AS "teamId",
          t.name                                                        AS "teamName",
          COUNT(*)::int                                                 AS "leadCount"
        FROM "Lead" l
        JOIN "User" u  ON u.id  = l."bdId"
        LEFT JOIN "Team" t ON t.id = u."teamId"
        WHERE COALESCE(l."leadDate", l."createdDate") >= ${start}
          AND COALESCE(l."leadDate", l."createdDate") <= ${end}
          ${teamSql}
        GROUP BY u.id, u.name, t.id, t.name,
                 TO_CHAR(COALESCE(l."leadDate", l."createdDate"), 'YYYY-MM')
        ORDER BY u.name,
                 TO_CHAR(COALESCE(l."leadDate", l."createdDate"), 'YYYY-MM')
      `,

      // IPD (pipelineStage = COMPLETED) by month by BD — using conversionDate with fallback
      prisma.$queryRaw<IpdRow[]>`
        SELECT
          TO_CHAR(COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate"), 'YYYY-MM') AS month,
          u.id                                                                                              AS "bdId",
          u.name                                                                                            AS "bdName",
          t.id                                                                                              AS "teamId",
          t.name                                                                                            AS "teamName",
          COUNT(*)::int                                                                                     AS "ipdCount"
        FROM "Lead" l
        JOIN "User" u  ON u.id  = l."bdId"
        LEFT JOIN "Team" t ON t.id = u."teamId"
        WHERE l."pipelineStage" = 'COMPLETED'
          AND COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate") >= ${start}
          AND COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate") <= ${end}
          ${teamSql}
        GROUP BY u.id, u.name, t.id, t.name,
                 TO_CHAR(COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate"), 'YYYY-MM')
        ORDER BY u.name,
                 TO_CHAR(COALESCE(l."conversionDate", l."surgeryDate", l."leadDate", l."createdDate"), 'YYYY-MM')
      `,
    ])

    // Collect all months across both datasets (sorted)
    const allMonths = [
      ...new Set([...leadRows.map((r) => r.month), ...ipdRows.map((r) => r.month)]),
    ].sort()

    // Build BD map
    type BdEntry = {
      bdId: string
      bdName: string
      teamId: string | null
      teamName: string | null
      leads: Record<string, number>
      ipd: Record<string, number>
    }
    const bdMap = new Map<string, BdEntry>()

    const getOrCreate = (bdId: string, bdName: string, teamId: string | null, teamName: string | null): BdEntry => {
      if (!bdMap.has(bdId)) {
        bdMap.set(bdId, { bdId, bdName, teamId, teamName, leads: {}, ipd: {} })
      }
      return bdMap.get(bdId)!
    }

    for (const row of leadRows) {
      const entry = getOrCreate(row.bdId, row.bdName, row.teamId, row.teamName)
      entry.leads[row.month] = (entry.leads[row.month] ?? 0) + Number(row.leadCount)
    }
    for (const row of ipdRows) {
      const entry = getOrCreate(row.bdId, row.bdName, row.teamId, row.teamName)
      entry.ipd[row.month] = (entry.ipd[row.month] ?? 0) + Number(row.ipdCount)
    }

    const bds = Array.from(bdMap.values())
      .map((bd) => ({
        ...bd,
        totalLeads: Object.values(bd.leads).reduce((a, b) => a + b, 0),
        totalIpd: Object.values(bd.ipd).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.totalLeads - a.totalLeads)

    // Monthly totals row
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
