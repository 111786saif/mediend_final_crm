import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(_request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return unauthorizedResponse()

    if (user.role !== 'MD' && user.role !== 'ADMIN' && user.role !== 'SALES_HEAD' && user.role !== 'EXECUTIVE_ASSISTANT') {
      return errorResponse(`Forbidden: Only MD, ADMIN, SALES_HEAD, and EXECUTIVE_ASSISTANT can access.`, 403)
    }

    const now = new Date()
    const sevenDaysAgo = startOfDay(subDays(now, 7))
    const thirtyDaysAgo = startOfDay(subDays(now, 30))
    const nowEnd = endOfDay(now)

    const [
      totalLeads,
      byStageRaw,
      byStatusRaw,
      recentLeads7,
      recentLeads30,
      byCircleRaw,
      bySourceRaw,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['pipelineStage'],
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.lead.count({
        where: {
          OR: [
            { leadEntryDate: { gte: sevenDaysAgo, lte: nowEnd } },
            { AND: [{ leadEntryDate: { equals: null } }, { createdDate: { gte: sevenDaysAgo, lte: nowEnd } }] },
          ],
        },
      }),
      prisma.lead.count({
        where: {
          OR: [
            { leadEntryDate: { gte: thirtyDaysAgo, lte: nowEnd } },
            { AND: [{ leadEntryDate: { equals: null } }, { createdDate: { gte: thirtyDaysAgo, lte: nowEnd } }] },
          ],
        },
      }),
      prisma.lead.groupBy({
        by: ['circle'],
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
    ])

    const byStage = byStageRaw.map((s) => ({
      stage: s.pipelineStage,
      count: s._count.id,
    }))

    const byStatus = byStatusRaw
      .map((s) => ({
        status: s.status ?? 'Unknown',
        count: s._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    const topCircles = byCircleRaw
      .map((c) => ({
        circle: c.circle ?? 'Unknown',
        count: c._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topSources = bySourceRaw
      .map((s) => ({
        source: s.source ?? 'Unknown',
        count: s._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return successResponse({
      totalLeads,
      byStage,
      byStatus,
      recentLeads: {
        last7Days: recentLeads7,
        last30Days: recentLeads30,
      },
      topCircles,
      topSources,
    })
  } catch (error) {
    console.error('Pipeline overview error:', error)
    return errorResponse('Failed to fetch pipeline overview', 500)
  }
}
