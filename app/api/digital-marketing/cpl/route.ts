import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasEffectiveCrmPermission } from '@/lib/crm-permissions'
import { z } from 'zod'

function monthDateRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

async function assertCplAccess(userId: string) {
  const ok = await hasEffectiveCrmPermission(userId, 'crm.cpl.view')
  if (!ok) return false
  return true
}

async function assertCplManageAccess(userId: string) {
  const ok = await hasEffectiveCrmPermission(userId, 'crm.cpl.manage')
  if (!ok) return false
  return true
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await assertCplAccess(user.id))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const yearStr = searchParams.get('year')
    const summary = searchParams.get('summary') === '1'

    const year = yearStr ? parseInt(yearStr, 10) : NaN
    if (!year || year < 2000 || year > 2100) {
      return errorResponse('Valid year is required', 400)
    }

    if (summary) {
      const monthlyBreakdown: { month: number; totalLeads: number; totalMarketingCost: number }[] = []
      const cplRows = await prisma.campaignCPL.findMany({
        where: { year },
        select: { campaignName: true, month: true, cpl: true },
      })
      const cplKey = (name: string, m: number) => `${name}\0${m}`
      const cplMap = new Map(cplRows.map((r) => [cplKey(r.campaignName, r.month), r.cpl]))

      for (let month = 1; month <= 12; month++) {
        const { start, end } = monthDateRange(year, month)
        const groups = await prisma.lead.groupBy({
          by: ['campaignName'],
          where: {
            leadEntryDate: { gte: start, lte: end },
            campaignName: { not: null },
          },
          _count: { _all: true },
        })
        let totalLeads = 0
        let totalMarketingCost = 0
        for (const g of groups) {
          const name = g.campaignName
          if (!name || name.trim() === '') continue
          const cnt = g._count._all
          totalLeads += cnt
          const cpl = cplMap.get(cplKey(name, month))
          if (cpl != null && cpl > 0) totalMarketingCost += cpl * cnt
        }
        monthlyBreakdown.push({ month, totalLeads, totalMarketingCost })
      }

      return successResponse({ year, monthlyBreakdown })
    }

    const monthStr = searchParams.get('month')
    const month = monthStr ? parseInt(monthStr, 10) : NaN
    if (!month || month < 1 || month > 12) {
      return errorResponse('month (1–12) is required unless summary=1', 400)
    }

    const { start, end } = monthDateRange(year, month)
    const groups = await prisma.lead.groupBy({
      by: ['campaignName'],
      where: {
        leadEntryDate: { gte: start, lte: end },
        campaignName: { not: null },
      },
      _count: { _all: true },
    })

    const cplRows = await prisma.campaignCPL.findMany({
      where: { year, month },
    })
    const cplByName = new Map(cplRows.map((r) => [r.campaignName, r]))

    const campaigns = groups
      .filter((g) => g.campaignName && g.campaignName.trim() !== '')
      .map((g) => {
        const campaignName = g.campaignName as string
        const leadCount = g._count._all
        const row = cplByName.get(campaignName)
        const cpl = row != null ? row.cpl : null
        const totalCost = cpl != null && cpl > 0 ? cpl * leadCount : 0
        return {
          campaignName,
          month,
          year,
          leadCount,
          cpl,
          totalCost,
          cplId: row?.id ?? null,
        }
      })
      .sort((a, b) => a.campaignName.localeCompare(b.campaignName))

    const totalLeads = campaigns.reduce((s, c) => s + c.leadCount, 0)
    const totalCost = campaigns.reduce((s, c) => s + c.totalCost, 0)
    const avgCpl =
      totalLeads > 0 && totalCost > 0 ? Math.round((totalCost / totalLeads) * 100) / 100 : 0

    return successResponse({
      year,
      month,
      campaigns,
      summary: {
        totalLeads,
        totalCost,
        avgCpl,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/digital-marketing/cpl:', error)
    return errorResponse('Failed to load CPL data', 500)
  }
}

const postSchema = z.object({
  campaignName: z.string().min(1).max(500),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  cpl: z.number().min(0),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await assertCplManageAccess(user.id))) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.message, 400)

    const { campaignName, month, year, cpl } = parsed.data

    const existing = await prisma.campaignCPL.findUnique({
      where: {
        campaignName_month_year: { campaignName, month, year },
      },
    })

    let row
    if (existing) {
      row = await prisma.campaignCPL.update({
        where: { id: existing.id },
        data: { cpl },
      })
    } else {
      row = await prisma.campaignCPL.create({
        data: {
          campaignName,
          month,
          year,
          cpl,
          createdById: user.id,
        },
      })
    }

    return successResponse(row)
  } catch (error) {
    console.error('Error in POST /api/digital-marketing/cpl:', error)
    return errorResponse('Failed to save CPL', 500)
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  cpl: z.number().min(0),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await assertCplManageAccess(user.id))) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.message, 400)

    const { id, cpl } = parsed.data
    const existing = await prisma.campaignCPL.findUnique({ where: { id } })
    if (!existing) return errorResponse('Not found', 404)

    const row = await prisma.campaignCPL.update({
      where: { id },
      data: { cpl },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error in PATCH /api/digital-marketing/cpl:', error)
    return errorResponse('Failed to update CPL', 500)
  }
}
