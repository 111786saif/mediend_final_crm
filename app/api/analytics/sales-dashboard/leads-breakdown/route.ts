import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getManagerGroups } from '@/lib/hierarchy'
import {
  buildDateRange,
  leadConvertedWhere,
  isLeadConverted,
  normalizeCampaignName,
  normalizeSourceName,
  normalizeCircleName,
} from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'

const LEAD_AGE_BUCKETS = {
  new: { label: 'New', maxDays: 7 },
  oneMonth: { label: '1 month old', minDays: 7, maxDays: 30 },
  twoMonths: { label: '2 months old', minDays: 30, maxDays: 60 },
  old: { label: 'Old', minDays: 60 },
} as const

function getLeadAgeBucket(createdDate: Date, asOf: Date): keyof typeof LEAD_AGE_BUCKETS {
  const days = Math.floor((asOf.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 7) return 'new'
  if (days < 30) return 'oneMonth'
  if (days < 60) return 'twoMonths'
  return 'old'
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (!(await canAccessSalesDashboard(user))) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const circle = searchParams.get('circle')
    const teamId = searchParams.get('teamId')
    const tz = searchParams.get('tz')

    const dateFilter: Prisma.DateTimeFilter = buildDateRange(startDate, endDate, tz)

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

    const completedWhere: Prisma.LeadWhereInput = {
      AND: [
        allLeadsWhere,
        leadConvertedWhere(),
      ],
    }

    const [
      byCircleAll,
      byCircleCompleted,
      byTreatmentAll,
      byTreatmentCompleted,
      byCategoryAll,
      byCategoryCompleted,
      bySourceAll,
      bySourceCompleted,
      byCampaignAll,
      byCampaignCompleted,
      allLeadsForAge,
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ['circle'], where: allLeadsWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['circle'], where: completedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
      prisma.lead.groupBy({ by: ['treatment'], where: { ...allLeadsWhere, treatment: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['treatment'], where: { AND: [allLeadsWhere, leadConvertedWhere(), { treatment: { not: null } }] }, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
      prisma.lead.groupBy({ by: ['category'], where: allLeadsWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['category'], where: completedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
      prisma.lead.groupBy({ by: ['source'], where: allLeadsWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['source'], where: completedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
      prisma.lead.groupBy({ by: ['campaignName'], where: allLeadsWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['campaignName'], where: completedWhere, _count: { id: true }, _sum: { billAmount: true, netProfit: true } }),
      prisma.lead.findMany({
        where: allLeadsWhere,
        select: {
          id: true,
          bdId: true,
          pipelineStage: true,
          caseStage: true,
          surgeryDate: true,
          leadEntryDate: true,
          createdDate: true,
          campaignName: true,
          source: true,
        },
      }),
    ])

    // Normalize and aggregate Circle
    const circleMap = new Map<string, { total: number; converted: number; revenue: number; profit: number }>()
    for (const c of byCircleAll) {
      const name = normalizeCircleName(c.circle)
      const cur = circleMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.total += c._count.id
      circleMap.set(name, cur)
    }
    for (const c of byCircleCompleted) {
      const name = normalizeCircleName(c.circle)
      const cur = circleMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.converted += c._count.id
      cur.revenue += c._sum?.billAmount ?? 0
      cur.profit += c._sum?.netProfit ?? 0
      circleMap.set(name, cur)
    }
    const byCircle = Array.from(circleMap.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([circle, data]) => {
        const conv = Math.min(data.converted, data.total)
        return {
          circle,
          totalLeads: data.total,
          converted: conv,
          conversionRate: data.total > 0 ? (conv / data.total) * 100 : 0,
          revenue: data.revenue,
          profit: data.profit,
        }
      }).sort((a, b) => b.totalLeads - a.totalLeads)

    // Disease / Treatment
    const completedTreatmentMap = new Map(byTreatmentCompleted.map((t) => [t.treatment, { count: t._count.id, revenue: t._sum?.billAmount ?? 0, profit: t._sum?.netProfit ?? 0 }]))
    const byDisease = byTreatmentAll.map((t) => {
      const total = t._count.id
      const convertedData = completedTreatmentMap.get(t.treatment)
      const conv = Math.min(convertedData?.count ?? 0, total)
      return {
        disease: t.treatment ?? 'Unknown',
        totalLeads: total,
        converted: conv,
        conversionRate: total > 0 ? (conv / total) * 100 : 0,
        revenue: convertedData?.revenue ?? 0,
        profit: convertedData?.profit ?? 0,
      }
    }).sort((a, b) => b.totalLeads - a.totalLeads)

    // Category
    const completedCategoryMap = new Map(byCategoryCompleted.map((c) => [c.category ?? 'Uncategorized', { count: c._count.id, revenue: c._sum?.billAmount ?? 0, profit: c._sum?.netProfit ?? 0 }]))
    const byCategory = byCategoryAll.map((c) => {
      const category = c.category?.trim() || 'Uncategorized'
      const total = c._count.id
      const convertedData = completedCategoryMap.get(c.category ?? 'Uncategorized') ?? completedCategoryMap.get(category)
      const conv = Math.min(convertedData?.count ?? 0, total)
      return {
        category,
        totalLeads: total,
        converted: conv,
        conversionRate: total > 0 ? (conv / total) * 100 : 0,
        revenue: convertedData?.revenue ?? 0,
        profit: convertedData?.profit ?? 0,
      }
    }).sort((a, b) => b.totalLeads - a.totalLeads)

    // Normalize and aggregate Source
    const sourceMap = new Map<string, { total: number; converted: number; revenue: number; profit: number }>()
    for (const s of bySourceAll) {
      const name = normalizeSourceName(s.source)
      const cur = sourceMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.total += s._count.id
      sourceMap.set(name, cur)
    }
    for (const s of bySourceCompleted) {
      const name = normalizeSourceName(s.source)
      const cur = sourceMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.converted += s._count.id
      cur.revenue += s._sum?.billAmount ?? 0
      cur.profit += s._sum?.netProfit ?? 0
      sourceMap.set(name, cur)
    }
    const bySource = Array.from(sourceMap.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([source, data]) => {
        const conv = Math.min(data.converted, data.total)
        return {
          source,
          totalLeads: data.total,
          converted: conv,
          conversionRate: data.total > 0 ? (conv / data.total) * 100 : 0,
          revenue: data.revenue,
          profit: data.profit,
        }
      }).sort((a, b) => b.totalLeads - a.totalLeads)

    // Normalize and aggregate Campaign
    const campaignMap = new Map<string, { total: number; converted: number; revenue: number; profit: number }>()
    for (const c of byCampaignAll) {
      const name = normalizeCampaignName(c.campaignName)
      const cur = campaignMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.total += c._count.id
      campaignMap.set(name, cur)
    }
    for (const c of byCampaignCompleted) {
      const name = normalizeCampaignName(c.campaignName)
      const cur = campaignMap.get(name) ?? { total: 0, converted: 0, revenue: 0, profit: 0 }
      cur.converted += c._count.id
      cur.revenue += c._sum?.billAmount ?? 0
      cur.profit += c._sum?.netProfit ?? 0
      campaignMap.set(name, cur)
    }
    const byCampaign = Array.from(campaignMap.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([campaign, data]) => {
        const conv = Math.min(data.converted, data.total)
        return {
          campaign,
          totalLeads: data.total,
          converted: conv,
          conversionRate: data.total > 0 ? (conv / data.total) * 100 : 0,
          revenue: data.revenue,
          profit: data.profit,
        }
      }).sort((a, b) => b.totalLeads - a.totalLeads)

    // By-team breakdown: manager group (manager + direct subordinates) from org chart
    const managerGroups = await getManagerGroups()
    const teamMap = new Map<string, { teamName: string; totalLeads: number; converted: number }>()
    const bdIdToTeamName = new Map<string, string>()

    for (const group of managerGroups) {
      const teamName = `${group.managerName}'s Team`
      bdIdToTeamName.set(group.managerUserId, teamName)
      for (const sub of group.subordinates) {
        bdIdToTeamName.set(sub.userId, teamName)
      }
    }

    for (const group of managerGroups) {
      const groupUserIds = new Set([group.managerUserId, ...group.subordinates.map((s) => s.userId)])
      const key = group.managerId
      let totalLeads = 0
      let converted = 0
      for (const lead of allLeadsForAge) {
        if (groupUserIds.has(lead.bdId)) {
          totalLeads++
          if (isLeadConverted(lead)) converted++
        }
      }
      if (totalLeads > 0) {
        teamMap.set(key, { teamName: `${group.managerName}'s Team`, totalLeads, converted })
      }
    }
    const byTeam = Array.from(teamMap.values()).map((t) => ({
      teamName: t.teamName,
      totalLeads: t.totalLeads,
      converted: t.converted,
      conversionRate: t.totalLeads > 0 ? (t.converted / t.totalLeads) * 100 : 0,
    })).sort((a, b) => b.totalLeads - a.totalLeads)

    const asOf = endDate ? new Date(endDate) : new Date()
    const ageBuckets = { new: { total: 0, converted: 0 }, oneMonth: { total: 0, converted: 0 }, twoMonths: { total: 0, converted: 0 }, old: { total: 0, converted: 0 } }
    allLeadsForAge.forEach((lead) => {
      const effectiveLeadDate = lead.leadEntryDate ?? lead.createdDate
      if (effectiveLeadDate) {
        const bucket = getLeadAgeBucket(effectiveLeadDate, asOf)
        ageBuckets[bucket].total += 1
        if (isLeadConverted(lead)) ageBuckets[bucket].converted += 1
      }
    })
    const leadAgeBreakdown = (['new', 'oneMonth', 'twoMonths', 'old'] as const).map((key) => ({
      bucket: LEAD_AGE_BUCKETS[key].label,
      totalLeads: ageBuckets[key].total,
      converted: ageBuckets[key].converted,
      conversionRate: ageBuckets[key].total > 0 ? (ageBuckets[key].converted / ageBuckets[key].total) * 100 : 0,
    }))

    return successResponse({ byCircle, byDisease, byCategory, bySource, byCampaign, byTeam, leadAgeBreakdown })
  } catch (error) {
    console.error('Leads breakdown error:', error)
    return errorResponse('Failed to fetch leads breakdown', 500)
  }
}
