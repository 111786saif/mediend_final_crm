import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

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
    if (user.role === 'TEAM_LEAD' && !user.teamId) {
      return errorResponse('No team assigned', 403)
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

    const teamScope: Prisma.LeadWhereInput =
      user.role === 'TEAM_LEAD' && user.teamId ? { bd: { teamId: user.teamId } } : {}

    const completedWhere: Prisma.LeadWhereInput = {
      pipelineStage: 'COMPLETED',
      ...teamScope,
      ...(Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { conversionDate: dateFilter },
              {
                AND: [
                  { conversionDate: { equals: null } },
                  { leadDate: dateFilter },
                ],
              },
            ],
          }
        : {}),
    }

    const [
      byCircle,
      byTreatment,
      byHospital,
      bySource,
      byCampaign,
      surgeonHospitalDisease,
      completedForMonth,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ['circle'],
        where: completedWhere,
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['treatment'],
        where: { ...completedWhere, treatment: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['hospitalName', 'circle'],
        where: completedWhere,
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...completedWhere, source: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['campaignName'],
        where: { ...completedWhere, campaignName: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['surgeonName', 'hospitalName', 'treatment'],
        where: {
          ...completedWhere,
          surgeonName: { not: null },
        },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      // Month series uses the same completed + date filter as the rest of the breakdown
      prisma.lead.findMany({
        where: completedWhere,
        select: { conversionDate: true, surgeryDate: true, leadDate: true, createdDate: true, billAmount: true, netProfit: true },
      }),
    ])

    const circleBreakdown = byCircle.map((c) => ({
      circle: c.circle,
      count: c._count.id,
      revenue: c._sum.billAmount ?? 0,
      profit: c._sum.netProfit ?? 0,
    }))

    const diseaseBreakdown = byTreatment.map((t) => ({
      disease: t.treatment ?? 'Unknown',
      count: t._count.id,
      revenue: t._sum.billAmount ?? 0,
      profit: t._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const hospitalBreakdown = byHospital.map((h) => ({
      hospitalName: h.hospitalName,
      circle: h.circle,
      count: h._count.id,
      revenue: h._sum.billAmount ?? 0,
      profit: h._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const campaignBreakdown = byCampaign.map((c) => ({
      campaign: c.campaignName ?? 'Unknown',
      count: c._count.id,
      revenue: c._sum.billAmount ?? 0,
      profit: c._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const sourceBreakdown = bySource.map((s) => ({
      source: s.source ?? 'Unknown',
      count: s._count.id,
      revenue: s._sum.billAmount ?? 0,
      profit: s._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const monthMap = new Map<string, { count: number; revenue: number; profit: number }>()
    completedForMonth.forEach((lead) => {
      const d = lead.conversionDate ?? lead.surgeryDate ?? lead.leadDate ?? lead.createdDate
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = monthMap.get(monthKey) ?? { count: 0, revenue: 0, profit: 0 }
      cur.count += 1
      cur.revenue += lead.billAmount ?? 0
      cur.profit += lead.netProfit ?? 0
      monthMap.set(monthKey, cur)
    })
    const monthBreakdown = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const surgeonCrossAnalysis = surgeonHospitalDisease.map((r) => ({
      surgeonName: r.surgeonName ?? 'Unknown',
      hospitalName: r.hospitalName,
      treatment: r.treatment ?? 'Unknown',
      count: r._count.id,
      revenue: r._sum.billAmount ?? 0,
      profit: r._sum.netProfit ?? 0,
    })).sort((a, b) => b.count - a.count)

    return successResponse({
      byCircle: circleBreakdown,
      byDisease: diseaseBreakdown,
      byHospital: hospitalBreakdown,
      bySource: sourceBreakdown,
      byCampaign: campaignBreakdown,
      byMonth: monthBreakdown,
      surgeonCrossAnalysis,
    })
  } catch (error) {
    console.error('IPD breakdown error:', error)
    return errorResponse('Failed to fetch IPD breakdown', 500)
  }
}
