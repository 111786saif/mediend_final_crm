import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasEffectiveCrmPermission } from '@/lib/crm-permissions'

function dayRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999))
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectiveCrmPermission(user.id, 'crm.cpl.view')))
      return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Single date mode
    if (date) {
      const { start, end } = dayRange(date)

      const [spendRecords, leads] = await Promise.all([
        prisma.dailyCampaignSpend.findMany({
          where: { date: start },
        }),
        prisma.lead.findMany({
          where: { leadEntryDate: { gte: start, lte: end } },
          select: { campaignName: true, source: true },
        }),
      ])

      // Count leads per campaign and track source
      const leadsByName = new Map<string, number>()
      const sourceByName = new Map<string, string>()
      for (const l of leads) {
        const name = l.campaignName || 'Unknown'
        leadsByName.set(name, (leadsByName.get(name) || 0) + 1)
        if (l.source && !sourceByName.has(name)) {
          sourceByName.set(name, l.source)
        }
      }

      // Merge: all campaigns that have leads OR spend
      const spendByName = new Map<string, { id: string; spend: number }>()
      for (const s of spendRecords) {
        spendByName.set(s.campaignName, { id: s.id, spend: s.spend })
      }

      const allCampaigns = new Set([...leadsByName.keys(), ...spendByName.keys()])
      const campaigns = Array.from(allCampaigns)
        .map((name) => {
          const leadCount = leadsByName.get(name) || 0
          const rec = spendByName.get(name)
          const spend = rec?.spend ?? 0
          const cpl = leadCount > 0 ? Math.round((spend / leadCount) * 100) / 100 : null
          return { campaignName: name, source: sourceByName.get(name) ?? null, spend, leadCount, cpl, id: rec?.id ?? null }
        })
        .sort((a, b) => b.leadCount - a.leadCount)

      const totalLeads = leads.length
      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
      const effectiveCpl = totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null

      return successResponse({
        date,
        campaigns,
        totalLeads,
        totalSpend,
        effectiveCpl,
      })
    }

    // Range mode
    if (startDate && endDate) {
      const rangeStart = new Date(startDate + 'T00:00:00.000Z')
      const rangeEnd = new Date(endDate + 'T23:59:59.999Z')

      const [spendRecords, leads] = await Promise.all([
        prisma.dailyCampaignSpend.findMany({
          where: { date: { gte: rangeStart, lte: rangeEnd } },
          orderBy: { date: 'asc' },
        }),
        prisma.lead.findMany({
          where: { leadEntryDate: { gte: rangeStart, lte: rangeEnd } },
          select: { campaignName: true, leadEntryDate: true },
        }),
      ])

      // Aggregate by day
      const dayMap = new Map<string, { spend: number; leads: number }>()
      for (const s of spendRecords) {
        const dk = s.date.toISOString().split('T')[0]
        const entry = dayMap.get(dk) || { spend: 0, leads: 0 }
        entry.spend += s.spend
        dayMap.set(dk, entry)
      }
      for (const l of leads) {
        if (!l.leadEntryDate) continue
        const dk = l.leadEntryDate.toISOString().split('T')[0]
        const entry = dayMap.get(dk) || { spend: 0, leads: 0 }
        entry.leads += 1
        dayMap.set(dk, entry)
      }

      const days = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { spend, leads: lc }]) => ({
          date,
          spend,
          leadCount: lc,
          cpl: lc > 0 ? Math.round((spend / lc) * 100) / 100 : null,
        }))

      const totalSpend = days.reduce((s, d) => s + d.spend, 0)
      const totalLeads = days.reduce((s, d) => s + d.leadCount, 0)
      const effectiveCpl = totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null

      return successResponse({
        startDate,
        endDate,
        days,
        totalSpend,
        totalLeads,
        effectiveCpl,
      })
    }

    return errorResponse('Provide date or startDate+endDate', 400)
  } catch (error) {
    console.error('Error fetching daily spend:', error)
    return errorResponse('Failed to fetch daily spend', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectiveCrmPermission(user.id, 'crm.cpl.manage')))
      return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { campaignName, date, spend } = body

    if (!campaignName || typeof campaignName !== 'string' || campaignName.length > 500) {
      return errorResponse('Valid campaignName is required', 400)
    }
    if (!date || typeof date !== 'string') {
      return errorResponse('Valid date is required (YYYY-MM-DD)', 400)
    }
    if (typeof spend !== 'number' || spend < 0) {
      return errorResponse('spend must be a non-negative number', 400)
    }

    const dateObj = new Date(date + 'T00:00:00.000Z')
    if (isNaN(dateObj.getTime())) {
      return errorResponse('Invalid date format', 400)
    }

    const record = await prisma.dailyCampaignSpend.upsert({
      where: {
        campaignName_date: { campaignName, date: dateObj },
      },
      create: {
        campaignName,
        date: dateObj,
        spend,
        createdById: user.id,
      },
      update: {
        spend,
      },
    })

    return successResponse(record)
  } catch (error) {
    console.error('Error saving daily spend:', error)
    return errorResponse('Failed to save daily spend', 500)
  }
}
