import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getManagerGroups } from '@/lib/hierarchy'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (!canAccessSalesDashboard(user)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'campaign' | 'source'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const circle = searchParams.get('circle')
    const teamId = searchParams.get('teamId')

    if (!type || (type !== 'campaign' && type !== 'source')) {
      return errorResponse('type parameter must be either campaign or source', 400)
    }

    const dateFilter: Prisma.DateTimeFilter = buildDateRange(startDate, endDate)

    const bdIdFilter = await getSalesDashboardBdIdFilter(user)
    const teamScope: Prisma.LeadWhereInput = bdIdFilter
      ? { bdId: { in: bdIdFilter } }
      : {}

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const allLeadsWhere: Prisma.LeadWhereInput = { ...leadEntryDateFilter, ...teamScope }
    if (circle) {
      allLeadsWhere.circle = circle
    }
    if (teamId) {
      const team = await prisma.departmentTeam.findUnique({
        where: { id: teamId },
        select: { members: { select: { userId: true } } },
      })
      const memberUserIds = team?.members.map((m) => m.userId) ?? []
      allLeadsWhere.bdId = { in: memberUserIds }
    }

    const leads = await prisma.lead.findMany({
      where: allLeadsWhere,
      select: { id: true, bdId: true, surgeryDate: true, campaignName: true, source: true },
    })

    const managerGroups = await getManagerGroups()
    const bdIdToTeamName = new Map<string, string>()

    for (const group of managerGroups) {
      const teamName = `${group.managerName}'s Team`
      bdIdToTeamName.set(group.managerUserId, teamName)
      for (const sub of group.subordinates) {
        bdIdToTeamName.set(sub.userId, teamName)
      }
    }

    if (type === 'campaign') {
      const campaignTeamMap = new Map<string, { campaignName: string; team: string; leads: number; converted: number }>()

      for (const lead of leads) {
        const teamName = bdIdToTeamName.get(lead.bdId) ?? 'Independent'
        const campaign = lead.campaignName || '—'
        const campaignKey = `${campaign}||${teamName}`

        if (!campaignTeamMap.has(campaignKey)) {
          campaignTeamMap.set(campaignKey, { campaignName: campaign, team: teamName, leads: 0, converted: 0 })
        }
        const cRec = campaignTeamMap.get(campaignKey)!
        cRec.leads++
        if (lead.surgeryDate) cRec.converted++
      }

      const campaignTeamMapping = Array.from(campaignTeamMap.values()).map((c) => ({
        campaignName: c.campaignName,
        team: c.team,
        leads: c.leads,
        conversionPercentage: c.leads > 0 ? Math.round((c.converted / c.leads) * 100 * 10) / 10 : 0,
        cpl: null,
        amountSpend: null,
      })).sort((a, b) => b.leads - a.leads)

      return successResponse(campaignTeamMapping)
    } else {
      const sourceTeamMap = new Map<string, { sourceName: string; team: string; leads: number; converted: number }>()

      for (const lead of leads) {
        const teamName = bdIdToTeamName.get(lead.bdId) ?? 'Independent'
        const src = lead.source || '—'
        const sourceKey = `${src}||${teamName}`

        if (!sourceTeamMap.has(sourceKey)) {
          sourceTeamMap.set(sourceKey, { sourceName: src, team: teamName, leads: 0, converted: 0 })
        }
        const sRec = sourceTeamMap.get(sourceKey)!
        sRec.leads++
        if (lead.surgeryDate) sRec.converted++
      }

      const sourceTeamMapping = Array.from(sourceTeamMap.values()).map((s) => ({
        sourceName: s.sourceName,
        team: s.team,
        leads: s.leads,
        conversionPercentage: s.leads > 0 ? Math.round((s.converted / s.leads) * 100 * 10) / 10 : 0,
        cpl: null,
        amountSpend: null,
      })).sort((a, b) => b.leads - a.leads)

      return successResponse(sourceTeamMapping)
    }
  } catch (error) {
    console.error('Team mappings error:', error)
    return errorResponse('Failed to fetch team mappings', 500)
  }
}
