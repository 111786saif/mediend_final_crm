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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const fallback = getBusinessMonthYear()
    const month = parsed.data.month ?? fallback.month
    const year = parsed.data.year ?? fallback.year
    const page = parsed.data.page
    const pageSize = parsed.data.pageSize
    const { start, end } = getBusinessMonthRange(year, month)

    const where = {
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    // Run summary calculations, campaign grouping, total count, and paginated event fetching concurrently
    const [
      totalEvents,
      actionGroups,
      distinctLeads,
      distinctUsers,
      events,
      campaignRows,
    ] = await Promise.all([
      prisma.leadQrCallAuditLog.count({ where }),
      prisma.leadQrCallAuditLog.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
      }),
      prisma.leadQrCallAuditLog.findMany({
        where,
        select: { leadId: true },
        distinct: ['leadId'],
      }),
      prisma.leadQrCallAuditLog.findMany({
        where,
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.leadQrCallAuditLog.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.leadQrCallAuditLog.findMany({
        where,
        select: {
          lead: {
            select: {
              campaignName: true,
              campaignId: true,
            },
          },
        },
        take: 2000,
      }),
    ])

    let qrViewed = 0
    let qrCallStarted = 0
    let callButtonInitiated = 0

    for (const group of actionGroups) {
      if (group.action === 'QR_VIEWED') qrViewed = group._count._all
      else if (group.action === 'QR_CALL_INITIATED') qrCallStarted = group._count._all
      else if (group.action === 'CALL_BUTTON_INITIATED') callButtonInitiated = group._count._all
    }

    const campaignsByCount = new Map<string, number>()
    for (const row of campaignRows) {
      const campaignKey =
        row.lead?.campaignName?.trim() ||
        row.lead?.campaignId?.trim() ||
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
      page,
      pageSize,
      totalEvents,
      totalPages: Math.max(1, Math.ceil(totalEvents / pageSize)),
      summary: {
        totalEvents,
        qrViewed,
        qrCallStarted,
        callButtonInitiated,
        uniqueLeads: distinctLeads.length,
        uniqueUsers: distinctUsers.length,
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
