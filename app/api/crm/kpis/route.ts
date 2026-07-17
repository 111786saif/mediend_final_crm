import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getBusinessMonthRange, getBusinessMonthYear } from '@/lib/crm-campaigns'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const querySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const canView =
      String(currentUser.role) === 'SUPER_ADMIN' ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage'))

    if (!canView) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const fallback = getBusinessMonthYear()
    const month = parsed.data.month ?? fallback.month
    const year = parsed.data.year ?? fallback.year
    const { start, end } = getBusinessMonthRange(year, month)

    const events = await prisma.leadQrCallAuditLog.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            campaignId: true,
            campaignName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const qrViewed = events.filter((event) => event.action === 'QR_VIEWED').length
    const qrCallStarted = events.filter((event) => event.action === 'QR_CALL_INITIATED').length
    const callButtonInitiated = events.filter(
      (event) => event.action === 'CALL_BUTTON_INITIATED'
    ).length

    const campaignsByCount = new Map<string, number>()
    for (const event of events) {
      const campaignKey =
        event.lead.campaignName?.trim() ||
        event.lead.campaignId?.trim() ||
        'Unmapped Campaign'
      campaignsByCount.set(campaignKey, (campaignsByCount.get(campaignKey) ?? 0) + 1)
    }

    const topCampaigns = [...campaignsByCount.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([campaign, count]) => ({ campaign, count }))

    return successResponse({
      month,
      year,
      summary: {
        totalEvents: events.length,
        qrViewed,
        qrCallStarted,
        callButtonInitiated,
        uniqueLeads: new Set(events.map((event) => event.leadId)).size,
        uniqueUsers: new Set(events.map((event) => event.userId)).size,
      },
      topCampaigns,
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        source: event.source,
        phoneNumber: event.phoneNumber,
        createdAt: event.createdAt,
        lead: event.lead,
        user: event.user,
      })),
    })
  } catch (error) {
    console.error('Error fetching CRM KPI data:', error)
    return errorResponse('Failed to fetch CRM KPI data', 500)
  }
}
