import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateUserIdsForLeadAccess, getManagerGroups } from '@/lib/hierarchy'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

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

    if (
      user.role !== 'MD' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SALES_HEAD' &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'TEAM_LEAD' &&
      user.role !== 'DIGITAL_MARKETING_HEAD'
    ) {
      return errorResponse('Forbidden', 403)
    }

    let teamScope: Prisma.LeadWhereInput = {}
    if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      teamScope = { bdId: { in: [user.id, ...subIds] } }
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    const leadDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadDate: dateFilter },
              { AND: [{ leadDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}
    const allLeadsWhere: Prisma.LeadWhereInput = { ...leadDateFilter, ...teamScope }

    const completedWhere: Prisma.LeadWhereInput = {
      pipelineStage: 'COMPLETED',
      ...teamScope,
      ...ipdDoneDateFilter(dateFilter),
    }

    const [
      byCircleAll,
      byCircleCompleted,
      byTreatmentAll,
      byTreatmentCompleted,
      bySourceAll,
      bySourceCompleted,
      byCampaignAll,
      byCampaignCompleted,
      allLeadsForAge,
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ['circle'], where: allLeadsWhere, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['circle'], where: { ...completedWhere }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['treatment'], where: { ...allLeadsWhere, treatment: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['treatment'], where: { ...completedWhere, treatment: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['source'], where: { ...allLeadsWhere, source: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['source'], where: { ...completedWhere, source: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['campaignName'], where: { ...allLeadsWhere, campaignName: { not: null } }, _count: { id: true } }),
      prisma.lead.groupBy({ by: ['campaignName'], where: { ...completedWhere, campaignName: { not: null } }, _count: { id: true } }),
      prisma.lead.findMany({
        where: allLeadsWhere,
        select: { id: true, bdId: true, pipelineStage: true, leadDate: true, createdDate: true },
      }),
    ])

    const completedCircleMap = new Map(byCircleCompleted.map((c) => [c.circle, c._count.id]))
    const byCircle = byCircleAll.map((c) => {
      const total = c._count.id
      const converted = completedCircleMap.get(c.circle) ?? 0
      return { circle: c.circle, totalLeads: total, converted, conversionRate: total > 0 ? (converted / total) * 100 : 0 }
    })

    const completedTreatmentMap = new Map(byTreatmentCompleted.map((t) => [t.treatment, t._count.id]))
    const byDisease = byTreatmentAll.map((t) => {
      const total = t._count.id
      const converted = completedTreatmentMap.get(t.treatment) ?? 0
      return { disease: t.treatment ?? 'Unknown', totalLeads: total, converted, conversionRate: total > 0 ? (converted / total) * 100 : 0 }
    }).sort((a, b) => b.totalLeads - a.totalLeads)

    const completedSourceMap = new Map(bySourceCompleted.map((s) => [s.source, s._count.id]))
    const bySource = bySourceAll.map((s) => {
      const total = s._count.id
      const converted = completedSourceMap.get(s.source) ?? 0
      return { source: s.source ?? 'Unknown', totalLeads: total, converted, conversionRate: total > 0 ? (converted / total) * 100 : 0 }
    }).sort((a, b) => b.totalLeads - a.totalLeads)

    const completedCampaignMap = new Map(byCampaignCompleted.map((c) => [c.campaignName, c._count.id]))
    const byCampaign = byCampaignAll.map((c) => {
      const total = c._count.id
      const converted = completedCampaignMap.get(c.campaignName) ?? 0
      return { campaign: c.campaignName ?? 'Unknown', totalLeads: total, converted, conversionRate: total > 0 ? (converted / total) * 100 : 0 }
    }).sort((a, b) => b.totalLeads - a.totalLeads)

    // By-team breakdown: manager group (manager + direct subordinates) from org chart
    const managerGroups = await getManagerGroups()
    const teamMap = new Map<string, { teamName: string; totalLeads: number; converted: number }>()
    for (const group of managerGroups) {
      const groupUserIds = new Set([group.managerUserId, ...group.subordinates.map((s) => s.userId)])
      const key = group.managerId
      let totalLeads = 0
      let converted = 0
      for (const lead of allLeadsForAge) {
        if (groupUserIds.has(lead.bdId)) {
          totalLeads++
          if (lead.pipelineStage === 'COMPLETED') converted++
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
      const effectiveLeadDate = lead.leadDate ?? lead.createdDate
      const bucket = getLeadAgeBucket(effectiveLeadDate, asOf)
      ageBuckets[bucket].total += 1
      if (lead.pipelineStage === 'COMPLETED') ageBuckets[bucket].converted += 1
    })
    const leadAgeBreakdown = (['new', 'oneMonth', 'twoMonths', 'old'] as const).map((key) => ({
      bucket: LEAD_AGE_BUCKETS[key].label,
      totalLeads: ageBuckets[key].total,
      converted: ageBuckets[key].converted,
      conversionRate: ageBuckets[key].total > 0 ? (ageBuckets[key].converted / ageBuckets[key].total) * 100 : 0,
    }))

    return successResponse({ byCircle, byDisease, bySource, byCampaign, byTeam, leadAgeBreakdown })
  } catch (error) {
    console.error('Leads breakdown error:', error)
    return errorResponse('Failed to fetch leads breakdown', 500)
  }
}
