import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasFeaturePermission } from '@/lib/permissions'
import { FEATURE_KEYS } from '@/lib/feature-keys'

const CONVERSION_STAGES = ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED', 'PL_PENDING', 'OUTSTANDING']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isLeadConverted(lead: { surgeryDate: Date | null; caseStage: string }) {
  return lead.surgeryDate !== null || CONVERSION_STAGES.includes(lead.caseStage)
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasFeaturePermission(user.id, FEATURE_KEYS.CPL_ACCESS))) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const campaign = searchParams.get('campaign') || undefined
    const source = searchParams.get('source') || undefined
    const excellentMax = parseFloat(searchParams.get('excellentMax') || '500')
    const goodMax = parseFloat(searchParams.get('goodMax') || '1200')

    const now = new Date()
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()

    if (isNaN(month) || month < 1 || month > 12) {
      return errorResponse('Invalid month', 400)
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return errorResponse('Invalid year', 400)
    }

    // Date range boundaries
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    // 1. Fetch available filter values dynamically
    const [allCampaignNames, allSources] = await Promise.all([
      prisma.lead.findMany({
        distinct: ['campaignName'],
        where: { campaignName: { not: null } },
        select: { campaignName: true }
      }),
      prisma.lead.findMany({
        distinct: ['source'],
        where: { source: { not: null } },
        select: { source: true }
      })
    ])

    const campaignFilterList = allCampaignNames.map(c => c.campaignName).filter(Boolean) as string[]
    const sourceFilterList = allSources.map(s => s.source).filter(Boolean) as string[]

    // 2. Fetch daily spends, legacy CPLs, and leads in parallel
    const [dailySpends, legacyCpls, leads] = await Promise.all([
      prisma.dailyCampaignSpend.findMany({
        where: {
          date: { gte: start, lte: end },
          ...(campaign ? { campaignName: campaign } : {}),
        },
        select: { campaignName: true, spend: true, date: true }
      }),
      prisma.campaignCPL.findMany({
        where: {
          month,
          year,
          ...(campaign ? { campaignName: campaign } : {}),
        },
        select: { campaignName: true, cpl: true }
      }),
      prisma.lead.findMany({
        where: {
          OR: [
            { leadEntryDate: { gte: start, lte: end } },
            { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
          ],
          ...(campaign ? { campaignName: campaign } : {}),
          ...(source ? { source: source } : {}),
        },
        select: {
          campaignName: true,
          source: true,
          surgeryDate: true,
          caseStage: true,
          assignedDate: true,
          remarks: true,
        }
      })
    ])

    // 3. Count new/untouched leads
    const untouchedLeads = leads.filter(l => 
      l.caseStage === 'NEW_LEAD' && 
      l.assignedDate === null && 
      (l.remarks === null || l.remarks === '')
    )
    const newLeadsCount = untouchedLeads.length

    // 4. Group and aggregate values
    const campaignStats = new Map<string, { spend: number; leads: number; converted: number; legacyCpl?: number }>()

    // Initialize from daily spend
    for (const s of dailySpends) {
      const name = s.campaignName || 'Unknown'
      const entry = campaignStats.get(name) || { spend: 0, leads: 0, converted: 0 }
      entry.spend += s.spend
      campaignStats.set(name, entry)
    }

    // Initialize from legacy CPL
    for (const c of legacyCpls) {
      const name = c.campaignName || 'Unknown'
      const entry = campaignStats.get(name) || { spend: 0, leads: 0, converted: 0 }
      entry.legacyCpl = c.cpl
      campaignStats.set(name, entry)
    }

    // Group leads
    for (const l of leads) {
      const name = l.campaignName || 'Unknown'
      const entry = campaignStats.get(name) || { spend: 0, leads: 0, converted: 0 }
      entry.leads += 1
      if (isLeadConverted(l)) {
        entry.converted += 1
      }
      campaignStats.set(name, entry)
    }

    // Compile rows
    const campaignRows = Array.from(campaignStats.entries()).map(([name, data]) => {
      let spend = data.spend
      const leadsCount = data.leads
      const converted = data.converted
      let cpl = null

      if (spend === 0 && data.legacyCpl != null && data.legacyCpl > 0) {
        cpl = data.legacyCpl
        spend = cpl * leadsCount
      } else {
        cpl = leadsCount > 0 ? Math.round((spend / leadsCount) * 100) / 100 : null
      }

      let status = 'UNKNOWN'
      if (cpl !== null) {
        if (cpl < excellentMax) {
          status = 'EXCELLENT'
        } else if (cpl <= goodMax) {
          status = 'GOOD'
        } else {
          status = 'NEEDS_IMPROVEMENT'
        }
      }

      return {
        campaignName: name,
        spend,
        leads: leadsCount,
        converted,
        cpl,
        status,
      }
    }).sort((a, b) => b.leads - a.leads)

    const totalSpend = campaignRows.reduce((s, r) => s + r.spend, 0)
    const totalLeads = leads.length
    const totalConverted = campaignRows.reduce((s, r) => s + r.converted, 0)
    const effectiveCpl = totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null

    // 5. Generate Dynamic Insights
    let highestPerformingCampaign = '—'
    let highestCplCampaign = '—'
    let lowestCplCampaign = '—'
    let budgetWarningCampaign = '—'
    let bestRoiCampaign = '—'
    let recommendationText = 'All campaigns performing within normal parameters.'

    let maxConversions = 0
    let maxCpl = -1
    let minCpl = Infinity
    let maxSpendWithLowLeads = 0
    let bestRoiValue = -1

    for (const r of campaignRows) {
      if (r.converted > maxConversions) {
        maxConversions = r.converted
        highestPerformingCampaign = r.campaignName
      }
      if (r.cpl !== null) {
        if (r.cpl > maxCpl) {
          maxCpl = r.cpl
          highestCplCampaign = r.campaignName
        }
        if (r.cpl < minCpl && r.leads > 0) {
          minCpl = r.cpl
          lowestCplCampaign = r.campaignName
        }
      }
      if (r.spend > 5000 && r.leads < 5) {
        if (r.spend > maxSpendWithLowLeads) {
          maxSpendWithLowLeads = r.spend
          budgetWarningCampaign = r.campaignName
        }
      }
      if (r.leads >= 5) {
        const convRate = r.converted / r.leads
        if (convRate > bestRoiValue) {
          bestRoiValue = convRate
          bestRoiCampaign = r.campaignName
        }
      }
    }

    if (highestCplCampaign !== '—') {
      recommendationText = `Consider pausing or adjusting targeting for "${highestCplCampaign}" due to elevated CPL values.`
    }
    if (bestRoiCampaign !== '—') {
      recommendationText = `Recommend allocating additional budget to "${bestRoiCampaign}" as it offers the highest conversion ROI.`
    }

    const marketingInsights = {
      highestPerformingCampaign,
      highestCplCampaign,
      lowestCplCampaign,
      budgetWarningCampaign,
      bestRoiCampaign,
      recommendationText,
      summaryText: `In ${MONTHS[month - 1]} ${year}, a total marketing budget of ${totalSpend.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} was spent across campaigns, generating ${totalLeads} leads and ${totalConverted} conversions at an effective CPL of ${effectiveCpl != null ? `₹${effectiveCpl.toLocaleString('en-IN')}` : '—'}.`
    }

    // 6. Year Overview Compilation
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    const [yearSpends, yearLeads, yearLegacyCpls] = await Promise.all([
      prisma.dailyCampaignSpend.findMany({
        where: {
          date: { gte: yearStart, lte: yearEnd },
          ...(campaign ? { campaignName: campaign } : {}),
        },
        select: { date: true, spend: true, campaignName: true },
      }),
      prisma.lead.findMany({
        where: {
          OR: [
            { leadEntryDate: { gte: yearStart, lte: yearEnd } },
            { AND: [{ leadEntryDate: null }, { createdDate: { gte: yearStart, lte: yearEnd } }] },
          ],
          ...(campaign ? { campaignName: campaign } : {}),
          ...(source ? { source: source } : {}),
        },
        select: { leadEntryDate: true, createdDate: true, campaignName: true, surgeryDate: true, caseStage: true },
      }),
      prisma.campaignCPL.findMany({
        where: {
          year,
          ...(campaign ? { campaignName: campaign } : {}),
        },
        select: { month: true, cpl: true, campaignName: true },
      }),
    ])

    const yearMonthlyRows = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const mSpends = yearSpends.filter(s => new Date(s.date).getUTCMonth() === i)
      const mLeads = yearLeads.filter(l => {
        const d = new Date(l.leadEntryDate || l.createdDate || '')
        return d.getMonth() === i
      })
      const mLegacy = yearLegacyCpls.filter(c => c.month === m)

      const compMap = new Map<string, { spend: number; leads: number; legacyCpl?: number }>()
      for (const s of mSpends) {
        const entry = compMap.get(s.campaignName) || { spend: 0, leads: 0 }
        entry.spend += s.spend
        compMap.set(s.campaignName, entry)
      }
      for (const c of mLegacy) {
        const entry = compMap.get(c.campaignName) || { spend: 0, leads: 0 }
        entry.legacyCpl = c.cpl
        compMap.set(c.campaignName, entry)
      }
      let convertedCount = 0
      for (const l of mLeads) {
        const name = l.campaignName || 'Unknown'
        const entry = compMap.get(name) || { spend: 0, leads: 0 }
        entry.leads += 1
        compMap.set(name, entry)
        if (isLeadConverted(l)) {
          convertedCount += 1
        }
      }

      let mSpend = 0
      for (const [_, data] of compMap.entries()) {
        if (data.spend > 0) {
          mSpend += data.spend
        } else if (data.legacyCpl != null && data.legacyCpl > 0) {
          mSpend += data.legacyCpl * data.leads
        }
      }

      const leadsCount = mLeads.length
      return {
        label: MONTHS[i],
        marketingCost: mSpend,
        leads: leadsCount,
        conversions: convertedCount,
        cpl: leadsCount > 0 ? Math.round((mSpend / leadsCount) * 100) / 100 : 0
      }
    })

    return successResponse({
      month,
      year,
      campaignRows,
      totalSpend,
      totalLeads,
      totalConverted,
      effectiveCpl,
      newLeadsCount,
      marketingInsights,
      yearMonthlyRows,
      campaignFilterList,
      sourceFilterList,
    })
  } catch (error) {
    console.error('Error generating campaign performance analytics:', error)
    return errorResponse('Failed to fetch campaign performance analytics', 500)
  }
}
