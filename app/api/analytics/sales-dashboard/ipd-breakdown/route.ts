import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

import {
  canonicalSalesCompletedWhere,
  resolveIpdDate,
  buildDateRange,
  normalizeCampaignName,
  normalizeSourceName,
  normalizeCircleName,
} from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'

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
    const tz = searchParams.get('tz')

    const dateFilter = buildDateRange(startDate, endDate, tz)

    const bdIdFilter = await getSalesDashboardBdIdFilter(user)
    const teamScope: Prisma.LeadWhereInput = bdIdFilter
      ? { bdId: { in: bdIdFilter } }
      : {}

    const completedWhere: Prisma.LeadWhereInput = {
      ...teamScope,
      ...canonicalSalesCompletedWhere(dateFilter),
    }

    const [
      byCircleRaw,
      byTreatment,
      byCategory,
      byHospital,
      bySourceRaw,
      byCampaignRaw,
      byInsurance,
      byTpa,
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
        by: ['category'],
        where: completedWhere,
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
        where: completedWhere,
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['campaignName'],
        where: completedWhere,
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['insuranceName'],
        where: { ...completedWhere, insuranceName: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['tpa'],
        where: { ...completedWhere, tpa: { not: null } },
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
        select: { surgeryDate: true, billAmount: true, netProfit: true, admissionRecord: { select: { surgeryDate: true } } },
      }),
    ])

    // Normalized Circle Breakdown
    const circleMap = new Map<string, { count: number; revenue: number; profit: number }>()
    for (const c of byCircleRaw) {
      const name = normalizeCircleName(c.circle)
      const cur = circleMap.get(name) ?? { count: 0, revenue: 0, profit: 0 }
      cur.count += c._count.id
      cur.revenue += c._sum.billAmount ?? 0
      cur.profit += c._sum.netProfit ?? 0
      circleMap.set(name, cur)
    }
    const circleBreakdown = Array.from(circleMap.entries())
      .map(([circle, data]) => ({ circle, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    const diseaseBreakdown = byTreatment.map((t) => ({
      disease: t.treatment ?? 'Unknown',
      count: t._count.id,
      revenue: t._sum.billAmount ?? 0,
      profit: t._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    const categoryBreakdown = byCategory.map((c) => ({
      category: c.category?.trim() || 'Uncategorized',
      count: c._count.id,
      revenue: c._sum.billAmount ?? 0,
      profit: c._sum.netProfit ?? 0,
    })).sort((a, b) => b.count - a.count)

    const hospitalBreakdown = byHospital.map((h) => ({
      hospitalName: h.hospitalName,
      circle: h.circle,
      count: h._count.id,
      revenue: h._sum.billAmount ?? 0,
      profit: h._sum.netProfit ?? 0,
    })).sort((a, b) => b.revenue - a.revenue)

    // Normalized Campaign Breakdown
    const campaignMap = new Map<string, { count: number; revenue: number; profit: number }>()
    for (const c of byCampaignRaw) {
      const name = normalizeCampaignName(c.campaignName)
      const cur = campaignMap.get(name) ?? { count: 0, revenue: 0, profit: 0 }
      cur.count += c._count.id
      cur.revenue += c._sum.billAmount ?? 0
      cur.profit += c._sum.netProfit ?? 0
      campaignMap.set(name, cur)
    }
    const campaignBreakdown = Array.from(campaignMap.entries())
      .map(([campaign, data]) => ({ campaign, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    // Normalized Source Breakdown
    const sourceMap = new Map<string, { count: number; revenue: number; profit: number }>()
    for (const s of bySourceRaw) {
      const name = normalizeSourceName(s.source)
      const cur = sourceMap.get(name) ?? { count: 0, revenue: 0, profit: 0 }
      cur.count += s._count.id
      cur.revenue += s._sum.billAmount ?? 0
      cur.profit += s._sum.netProfit ?? 0
      sourceMap.set(name, cur)
    }
    const sourceBreakdown = Array.from(sourceMap.entries())
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    const insuranceBreakdown = byInsurance.map((i) => ({
      insurance: i.insuranceName ?? 'Unknown',
      count: i._count.id,
      revenue: i._sum.billAmount ?? 0,
      profit: i._sum.netProfit ?? 0,
    })).sort((a, b) => b.count - a.count)

    const tpaBreakdown = byTpa.map((t) => ({
      tpa: t.tpa ?? 'Unknown',
      count: t._count.id,
      revenue: t._sum.billAmount ?? 0,
      profit: t._sum.netProfit ?? 0,
    })).sort((a, b) => b.count - a.count)

    const monthMap = new Map<string, { count: number; revenue: number; profit: number }>()
    completedForMonth.forEach((lead) => {
      const d = resolveIpdDate({ surgeryDate: lead.surgeryDate, admissionSurgeryDate: lead.admissionRecord?.surgeryDate })
      if (!d) return
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
      byCategory: categoryBreakdown,
      byHospital: hospitalBreakdown,
      bySource: sourceBreakdown,
      byCampaign: campaignBreakdown,
      byInsurance: insuranceBreakdown,
      byTpa: tpaBreakdown,
      byMonth: monthBreakdown,
      surgeonCrossAnalysis,
    })
  } catch (error) {
    console.error('IPD breakdown error:', error)
    return errorResponse('Failed to fetch IPD breakdown', 500)
  }
}
