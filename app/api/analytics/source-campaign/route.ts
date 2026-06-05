import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { resolveSourceForDisplay } from '@/lib/mysql-code-mappings'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const baseWhere: Prisma.LeadWhereInput = {
      ...leadEntryDateFilter,
    }

    if (user.role === 'BD') {
      baseWhere.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      baseWhere.bdId = { in: [user.id, ...subIds] }
    }

    const completedWhere = canonicalSalesCompletedWhere(dateFilter)

    if (user.role === 'BD') completedWhere.bdId = user.id
    else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      completedWhere.bdId = { in: [user.id, ...subIds] }
    }

    // Lead Source Performance
    const sourceStats = await prisma.lead.groupBy({
      by: ['source', 'campaignName', 'bdeName'],
      where: baseWhere,
      _count: { id: true },
    })

    const sourceCompleted = await prisma.lead.groupBy({
      by: ['source', 'campaignName', 'bdeName'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const sourceMap = new Map<
      string,
      {
        source: string
        campaignName: string | null
        bdeName: string | null
        totalLeads: number
        completed: number
        revenue: number
        profit: number
      }
    >()

    sourceStats.forEach((stat) => {
      const source = resolveSourceForDisplay(stat.source)
      const key = `${source}|${stat.campaignName || ''}|${stat.bdeName || ''}`
      sourceMap.set(key, {
        source,
        campaignName: stat.campaignName,
        bdeName: stat.bdeName,
        totalLeads: stat._count.id,
        completed: 0,
        revenue: 0,
        profit: 0,
      })
    })

    sourceCompleted.forEach((stat) => {
      const source = resolveSourceForDisplay(stat.source)
      const key = `${source}|${stat.campaignName || ''}|${stat.bdeName || ''}`
      const existing = sourceMap.get(key)
      if (existing) {
        existing.completed = stat._count.id
        existing.revenue = stat._sum.billAmount || 0
        existing.profit = stat._sum.netProfit || 0
      }
    })

    const sourcePerformance = Array.from(sourceMap.values())
      .map((data) => {
        const conversionRate = data.totalLeads > 0 ? (data.completed / data.totalLeads) * 100 : 0
        const avgTicketSize = data.completed > 0 ? data.revenue / data.completed : 0
        const qualityScore = conversionRate * 0.6 + (data.profit > 0 ? 40 : 0) // Simple quality score

        return {
          source: data.source,
          campaignName: data.campaignName,
          bdeName: data.bdeName,
          totalLeads: data.totalLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
          revenue: data.revenue,
          profit: data.profit,
          avgTicketSize: Math.round(avgTicketSize * 100) / 100,
          qualityScore: Math.round(qualityScore * 100) / 100,
        }
      })
      .sort((a, b) => b.qualityScore - a.qualityScore)

    // Campaign Analysis
    const campaignStats = await prisma.lead.groupBy({
      by: ['campaignName', 'source'],
      where: baseWhere,
      _count: { id: true },
    })

    const campaignCompleted = await prisma.lead.groupBy({
      by: ['campaignName', 'source'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const campaignMap = new Map<
      string,
      {
        source: string
        totalLeads: number
        completed: number
        revenue: number
        profit: number
      }
    >()

    campaignStats.forEach((stat) => {
      if (stat.campaignName) {
        const source = resolveSourceForDisplay(stat.source)
        campaignMap.set(stat.campaignName, {
          source,
          totalLeads: stat._count.id,
          completed: 0,
          revenue: 0,
          profit: 0,
        })
      }
    })

    campaignCompleted.forEach((stat) => {
      if (stat.campaignName) {
        const existing = campaignMap.get(stat.campaignName)
        if (existing) {
          existing.completed = stat._count.id
          existing.revenue = stat._sum.billAmount || 0
          existing.profit = stat._sum.netProfit || 0
        }
      }
    })

    // Get campaign date ranges and circles
    const campaignLeads = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        campaignName: { not: null },
      },
      select: {
        campaignName: true,
        createdDate: true,
        circle: true,
        treatment: true,
      },
    })

    const campaignAnalysis = Array.from(campaignMap.entries())
      .map(([campaignName, data]) => {
        const conversionRate = data.totalLeads > 0 ? (data.completed / data.totalLeads) * 100 : 0

        // Get campaign metadata
        const campaignLeadsData = campaignLeads.filter((l) => l.campaignName === campaignName)
        const dates = campaignLeadsData.map((l) => l.createdDate).sort((a, b) => a.getTime() - b.getTime())
        const circles = [...new Set(campaignLeadsData.map((l) => l.circle).filter(Boolean))]
        const treatments = [...new Set(campaignLeadsData.map((l) => l.treatment).filter(Boolean))]

        return {
          campaignName,
          source: data.source,
          totalLeads: data.totalLeads,
          conversionRate: Math.round(conversionRate * 100) / 100,
          revenue: data.revenue,
          profit: data.profit,
          startDate: dates[0]?.toISOString(),
          endDate: dates[dates.length - 1]?.toISOString(),
          circles: circles.slice(0, 10), // Top 10 circles
          topTreatments: treatments.slice(0, 10), // Top 10 treatments
        }
      })
      .sort((a, b) => b.revenue - a.revenue)

    return successResponse({
      sourcePerformance,
      campaignAnalysis,
    })
  } catch (error) {
    console.error('Error fetching source-campaign analytics:', error)
    return errorResponse('Failed to fetch source-campaign analytics', 500)
  }
}
