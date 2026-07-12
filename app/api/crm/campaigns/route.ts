import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getBusinessMonthYear,
  getCampaignManagementPageData,
  isSuperAdmin,
  validateCampaignReferences,
} from '@/lib/crm-campaigns'
import { logCrmActivity } from '@/lib/crm-activity'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const monthYearSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const campaignSchema = z.object({
  externalCampaignId: z.string().trim().min(1).max(150),
  displayName: z.string().trim().min(1).max(255),
  category: z.string().trim().max(255).optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  sourceId: z.string().min(1),
  leadSourceId: z.string().min(1),
  circleId: z.string().min(1),
  cityId: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
})

export async function GET(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    if (!isSuperAdmin(currentUser)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const parsed = monthYearSchema.safeParse({
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
    })
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const fallback = getBusinessMonthYear()
    const month = parsed.data.month ?? fallback.month
    const year = parsed.data.year ?? fallback.year

    const data = await getCampaignManagementPageData(month, year)
    return successResponse(data)
  } catch (error) {
    console.error('Error fetching CRM campaigns:', error)
    return errorResponse('Failed to fetch CRM campaign data', 500)
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    if (!isSuperAdmin(currentUser)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = campaignSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const data = parsed.data
    await validateCampaignReferences({
      sourceId: data.sourceId,
      leadSourceId: data.leadSourceId,
      circleId: data.circleId,
      cityId: data.cityId ?? null,
      departmentId: data.departmentId ?? null,
    })

    const created = await prisma.crmCampaign.create({
      data: {
        externalCampaignId: data.externalCampaignId.trim(),
        displayName: data.displayName.trim(),
        category: data.category?.trim() || null,
        departmentId: data.departmentId ?? null,
        sourceId: data.sourceId,
        leadSourceId: data.leadSourceId,
        circleId: data.circleId,
        cityId: data.cityId ?? null,
        isActive: data.isActive,
      },
      include: {
        source: true,
        leadSource: {
          include: {
            source: true,
          },
        },
        circle: true,
        city: true,
        department: true,
        assignments: true,
      },
    })

    await logCrmActivity({
      action: 'CRM_CAMPAIGN_CREATED',
      entityType: 'CRM_CAMPAIGN',
      entityId: created.id,
      entityLabel: `${created.externalCampaignId} · ${created.displayName}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Created CRM campaign ${created.externalCampaignId}`,
      metadata: {
        externalCampaignId: created.externalCampaignId,
        displayName: created.displayName,
        category: created.category,
        departmentId: created.departmentId,
        departmentName: created.department?.name ?? null,
        sourceId: created.sourceId,
        sourceName: created.source.name,
        leadSourceId: created.leadSourceId,
        leadSourceName: created.leadSource.name,
        circleId: created.circleId,
        circleName: created.circle.name,
        cityId: created.cityId,
        cityName: created.city?.name ?? null,
        isActive: created.isActive,
      },
    })

    return successResponse(created, 'Campaign created successfully')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('A campaign with this campaign ID already exists.', 409)
    }
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    console.error('Error creating CRM campaign:', error)
    return errorResponse('Failed to create CRM campaign', 500)
  }
}
