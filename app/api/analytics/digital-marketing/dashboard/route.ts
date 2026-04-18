import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { loadCampaignCplMap, cplLookupKey } from '@/lib/pnl/surgery-marketing-cpl'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (
      user.role !== 'DIGITAL_MARKETING_HEAD' &&
      user.role !== 'MD' &&
      user.role !== 'ADMIN'
    ) {
      return errorResponse('Forbidden', 403)
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
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // Lead date filter (for all leads)
    const leadDateFilter: Prisma.LeadWhereInput = hasDateFilter
      ? {
          OR: [
            { leadDate: dateFilter },
            { AND: [{ leadDate: { equals: null } }, { createdDate: dateFilter }] },
          ],
        }
      : {}

    // Completed leads filter (for IPD/conversions)
    const completedWhere: Prisma.LeadWhereInput = {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
      ...(hasDateFilter ? ipdDoneDateFilter(dateFilter) : {}),
    }

    // Prior period calculation for comparison
    let priorLeadDateFilter: Prisma.LeadWhereInput = {}
    let priorCompletedWhere: Prisma.LeadWhereInput = { pipelineStage: { in: ['PL', 'COMPLETED'] } }
    if (startDate && endDate) {
      const s = new Date(startDate)
      const e = new Date(endDate)
      const durationMs = e.getTime() - s.getTime()
      const priorEnd = new Date(s.getTime() - 1)
      const priorStart = new Date(priorEnd.getTime() - durationMs)
      priorStart.setHours(0, 0, 0, 0)
      priorEnd.setHours(23, 59, 59, 999)
      const priorDateFilter: Prisma.DateTimeFilter = { gte: priorStart, lte: priorEnd }
      priorLeadDateFilter = {
        OR: [
          { leadDate: priorDateFilter },
          { AND: [{ leadDate: { equals: null } }, { createdDate: priorDateFilter }] },
        ],
      }
      priorCompletedWhere = {
        pipelineStage: { in: ['PL', 'COMPLETED'] },
        ...ipdDoneDateFilter(priorDateFilter),
      }
    }

    // Gather all months in range for CPL lookup
    const monthsInRange: { month: number; year: number }[] = []
    if (startDate && endDate) {
      const s = new Date(startDate)
      const e = new Date(endDate)
      const cur = new Date(s.getFullYear(), s.getMonth(), 1)
      while (cur <= e) {
        monthsInRange.push({ month: cur.getMonth() + 1, year: cur.getFullYear() })
        cur.setMonth(cur.getMonth() + 1)
      }
    } else {
      const now = new Date()
      monthsInRange.push({ month: now.getMonth() + 1, year: now.getFullYear() })
    }

    const [
      totalLeadsCount,
      totalIpdCount,
      priorLeadsCount,
      priorIpdCount,
      byCampaignAll,
      byCampaignCompleted,
      bySourceAll,
      bySourceCompleted,
      byCircleAll,
      byCircleCompleted,
      allLeadsForCpl,
      completedForMonth,
      cplMap,
    ] = await Promise.all([
      prisma.lead.count({ where: leadDateFilter }),
      prisma.lead.count({ where: completedWhere }),
      startDate && endDate ? prisma.lead.count({ where: priorLeadDateFilter }) : Promise.resolve(0),
      startDate && endDate ? prisma.lead.count({ where: priorCompletedWhere }) : Promise.resolve(0),
      prisma.lead.groupBy({
        by: ['campaignName'],
        where: { ...leadDateFilter, campaignName: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['campaignName'],
        where: { ...completedWhere, campaignName: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true, netProfit: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...leadDateFilter, source: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...completedWhere, source: { not: null } },
        _count: { id: true },
        _sum: { billAmount: true },
      }),
      prisma.lead.groupBy({
        by: ['circle'],
        where: leadDateFilter,
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ['circle'],
        where: completedWhere,
        _count: { id: true },
      }),
      prisma.lead.findMany({
        where: { ...leadDateFilter, campaignName: { not: null } },
        select: { campaignName: true, leadDate: true, createdDate: true },
      }),
      prisma.lead.findMany({
        where: completedWhere,
        select: {
          conversionDate: true, surgeryDate: true, leadDate: true, createdDate: true,
          billAmount: true, netProfit: true, campaignName: true,
        },
      }),
      loadCampaignCplMap(prisma, monthsInRange),
    ])

    // --- Summary ---
    const overallConversionRate = totalLeadsCount > 0 ? (totalIpdCount / totalLeadsCount) * 100 : 0

    // Compute total marketing spend from CPL data
    let totalMarketingSpend = 0
    for (const lead of allLeadsForCpl) {
      const d = lead.leadDate ?? lead.createdDate
      const name = lead.campaignName?.trim()
      if (!name || !d) continue
      const cpl = cplMap.get(cplLookupKey(name, d.getMonth() + 1, d.getFullYear()))
      if (cpl && cpl > 0) totalMarketingSpend += cpl
    }

    const effectiveCpl = totalLeadsCount > 0 ? totalMarketingSpend / totalLeadsCount : 0
    const costPerConversion = totalIpdCount > 0 ? totalMarketingSpend / totalIpdCount : 0
    const leadsVsPriorPeriod = priorLeadsCount > 0 ? ((totalLeadsCount - priorLeadsCount) / priorLeadsCount) * 100 : 0
    const ipdVsPriorPeriod = priorIpdCount > 0 ? ((totalIpdCount - priorIpdCount) / priorIpdCount) * 100 : 0

    const summary = {
      totalLeads: totalLeadsCount,
      totalIpd: totalIpdCount,
      overallConversionRate,
      totalMarketingSpend,
      effectiveCpl,
      costPerConversion,
      leadsVsPriorPeriod,
      ipdVsPriorPeriod,
    }

    // --- Campaigns with CPL ---
    const completedCampaignMap = new Map(
      byCampaignCompleted.map((c) => [c.campaignName, { count: c._count.id, revenue: c._sum.billAmount ?? 0 }])
    )

    // Compute per-campaign CPL spend
    const campaignSpendMap = new Map<string, number>()
    for (const lead of allLeadsForCpl) {
      const d = lead.leadDate ?? lead.createdDate
      const name = lead.campaignName?.trim()
      if (!name || !d) continue
      const cpl = cplMap.get(cplLookupKey(name, d.getMonth() + 1, d.getFullYear()))
      if (cpl && cpl > 0) {
        campaignSpendMap.set(name, (campaignSpendMap.get(name) ?? 0) + cpl)
      }
    }

    const campaignsWithCpl = byCampaignAll.map((c) => {
      const name = c.campaignName ?? 'Unknown'
      const leads = c._count.id
      const completed = completedCampaignMap.get(c.campaignName) ?? { count: 0, revenue: 0 }
      const ipd = completed.count
      const revenue = completed.revenue
      const conversionRate = leads > 0 ? (ipd / leads) * 100 : 0
      const totalCost = campaignSpendMap.get(name) ?? 0
      const hasCpl = totalCost > 0
      const avgCpl = hasCpl && leads > 0 ? totalCost / leads : null
      const cpc = hasCpl && ipd > 0 ? totalCost / ipd : null
      const roi = hasCpl && totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : null

      return {
        campaign: name,
        leads,
        ipd,
        conversionRate,
        revenue,
        cpl: avgCpl,
        totalCost,
        costPerConversion: cpc,
        roi,
      }
    }).sort((a, b) => b.leads - a.leads)

    // --- Monthly Trend ---
    const monthMap = new Map<string, { leads: number; ipd: number; revenue: number; spend: number }>()

    // Count leads per month
    for (const lead of allLeadsForCpl) {
      const d = lead.leadDate ?? lead.createdDate
      if (!d) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = monthMap.get(key) ?? { leads: 0, ipd: 0, revenue: 0, spend: 0 }
      cur.leads += 1
      const name = lead.campaignName?.trim()
      if (name) {
        const cpl = cplMap.get(cplLookupKey(name, d.getMonth() + 1, d.getFullYear()))
        if (cpl && cpl > 0) cur.spend += cpl
      }
      monthMap.set(key, cur)
    }

    // Count conversions per month
    for (const lead of completedForMonth) {
      const d = lead.surgeryDate ?? lead.conversionDate ?? lead.leadDate ?? lead.createdDate
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = monthMap.get(key) ?? { leads: 0, ipd: 0, revenue: 0, spend: 0 }
      cur.ipd += 1
      cur.revenue += lead.billAmount ?? 0
      monthMap.set(key, cur)
    }

    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, d]) => ({
        month,
        leads: d.leads,
        ipd: d.ipd,
        conversionRate: d.leads > 0 ? (d.ipd / d.leads) * 100 : 0,
        marketingSpend: d.spend,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // --- AI Insights ---
    const insights: Array<{ type: 'positive' | 'negative' | 'suggestion'; title: string; description: string }> = []

    const avgConv = overallConversionRate

    // Best campaign by conversion (min 5 leads)
    const qualifiedCampaigns = campaignsWithCpl.filter((c) => c.leads >= 5)
    if (qualifiedCampaigns.length > 0) {
      const best = qualifiedCampaigns.reduce((a, b) => (a.conversionRate > b.conversionRate ? a : b))
      if (best.conversionRate > avgConv * 1.3) {
        insights.push({
          type: 'positive',
          title: `${best.campaign} is a top performer`,
          description: `${best.conversionRate.toFixed(1)}% conversion rate — ${(best.conversionRate / Math.max(avgConv, 0.1)).toFixed(1)}x above average. ${best.ipd} IPDs from ${best.leads} leads.`,
        })
      }

      // Worst campaign by conversion
      const worst = qualifiedCampaigns.reduce((a, b) => (a.conversionRate < b.conversionRate ? a : b))
      if (worst.conversionRate < avgConv * 0.5 && worst.campaign !== best.campaign) {
        insights.push({
          type: 'negative',
          title: `${worst.campaign} underperforming`,
          description: `Only ${worst.conversionRate.toFixed(1)}% conversion (org avg: ${avgConv.toFixed(1)}%). ${worst.leads} leads with just ${worst.ipd} conversions.`,
        })
      }
    }

    // Best ROI campaign
    const campaignsWithRoi = campaignsWithCpl.filter((c) => c.roi !== null && c.roi > 0)
    if (campaignsWithRoi.length > 0) {
      const bestRoi = campaignsWithRoi.reduce((a, b) => ((a.roi ?? 0) > (b.roi ?? 0) ? a : b))
      if ((bestRoi.roi ?? 0) > 100) {
        insights.push({
          type: 'positive',
          title: `${bestRoi.campaign} has ${bestRoi.roi!.toFixed(0)}% ROI`,
          description: `₹${Math.round(bestRoi.revenue).toLocaleString('en-IN')} revenue from ₹${Math.round(bestRoi.totalCost).toLocaleString('en-IN')} spend. Consider scaling this campaign.`,
        })
      }
    }

    // High CPL low conversion
    const highCplLowConv = campaignsWithCpl.filter(
      (c) => c.cpl !== null && c.cpl > effectiveCpl * 1.5 && c.conversionRate < avgConv * 0.7 && c.leads >= 5
    )
    if (highCplLowConv.length > 0) {
      const worst = highCplLowConv[0]
      insights.push({
        type: 'suggestion',
        title: `Review spend on ${worst.campaign}`,
        description: `CPL of ₹${Math.round(worst.cpl!).toLocaleString('en-IN')} (${(worst.cpl! / Math.max(effectiveCpl, 1)).toFixed(1)}x avg) with only ${worst.conversionRate.toFixed(1)}% conversion. Consider reallocating budget.`,
      })
    }

    // Period-over-period lead volume
    if (startDate && endDate && priorLeadsCount > 0) {
      if (leadsVsPriorPeriod < -15) {
        insights.push({
          type: 'negative',
          title: `Lead volume down ${Math.abs(leadsVsPriorPeriod).toFixed(0)}%`,
          description: `${totalLeadsCount} leads vs ${priorLeadsCount} in prior period. Check campaign budgets and ad performance.`,
        })
      } else if (leadsVsPriorPeriod > 15) {
        insights.push({
          type: 'positive',
          title: `Lead volume up ${leadsVsPriorPeriod.toFixed(0)}%`,
          description: `${totalLeadsCount} leads vs ${priorLeadsCount} in prior period. Growth momentum is strong.`,
        })
      }
    }

    // Circle with below-average conversion
    const circleCompletedMap = new Map(byCircleCompleted.map((c) => [c.circle, c._count.id]))
    const circlesWithData = byCircleAll
      .map((c) => ({
        circle: c.circle,
        leads: c._count.id,
        ipd: circleCompletedMap.get(c.circle) ?? 0,
        conv: c._count.id > 0 ? ((circleCompletedMap.get(c.circle) ?? 0) / c._count.id) * 100 : 0,
      }))
      .filter((c) => c.leads >= 10)

    if (circlesWithData.length >= 2) {
      const worstCircle = circlesWithData.reduce((a, b) => (a.conv < b.conv ? a : b))
      if (worstCircle.conv < avgConv * 0.5) {
        insights.push({
          type: 'suggestion',
          title: `${worstCircle.circle} circle needs attention`,
          description: `${worstCircle.conv.toFixed(1)}% conversion from ${worstCircle.leads} leads. Org average is ${avgConv.toFixed(1)}%. Investigate lead quality in this region.`,
        })
      }
    }

    // Source with high volume but low conversion
    const sourceCompletedMap = new Map(bySourceCompleted.map((s) => [s.source, s._count.id]))
    const sourcesWithData = bySourceAll
      .map((s) => ({
        source: s.source ?? 'Unknown',
        leads: s._count.id,
        ipd: sourceCompletedMap.get(s.source) ?? 0,
        conv: s._count.id > 0 ? ((sourceCompletedMap.get(s.source) ?? 0) / s._count.id) * 100 : 0,
      }))
      .filter((s) => s.leads >= 10)
      .sort((a, b) => b.leads - a.leads)

    if (sourcesWithData.length > 0) {
      const topSource = sourcesWithData[0]
      const leadShare = totalLeadsCount > 0 ? (topSource.leads / totalLeadsCount) * 100 : 0
      const ipdShare = totalIpdCount > 0 ? (topSource.ipd / totalIpdCount) * 100 : 0
      if (leadShare > 30 && ipdShare < leadShare * 0.6) {
        insights.push({
          type: 'suggestion',
          title: `${topSource.source} has quality gap`,
          description: `Generates ${leadShare.toFixed(0)}% of leads but only ${ipdShare.toFixed(0)}% of conversions (${topSource.conv.toFixed(1)}% conv rate). Investigate lead quality.`,
        })
      }
    }

    return successResponse({
      summary,
      campaignsWithCpl,
      insights: insights.slice(0, 6),
      monthlyTrend,
    })
  } catch (error) {
    console.error('Digital marketing dashboard error:', error)
    return errorResponse('Failed to fetch digital marketing dashboard', 500)
  }
}
