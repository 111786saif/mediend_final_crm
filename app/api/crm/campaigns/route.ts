import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getCampaignManagementPageData,
  isSuperAdmin,
  validateCampaignReferences,
} from '@/lib/crm-campaigns'
import { logCrmActivity } from '@/lib/crm-activity'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const campaignSchema = z.object({
  externalCampaignId: z.string().trim().min(1).max(150),
  displayName: z.string().trim().min(1).max(255),
  category: z.string().trim().max(200).optional().nullable(),
  treatmentMasterId: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  sourceId: z.string().min(1),
  leadSourceId: z.string().min(1),
  circleIds: z.array(z.string().trim().min(1)).min(1),
  isActive: z.boolean().default(true),
})

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    const canView =
      isSuperAdmin(currentUser) ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage'))
    if (!canView) return errorResponse('Forbidden', 403)

    const data = await getCampaignManagementPageData()
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
    const canManage =
      isSuperAdmin(currentUser) ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.campaigns.manage'))
    if (!canManage) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = campaignSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const data = parsed.data
    const references = await validateCampaignReferences({
      sourceId: data.sourceId,
      leadSourceId: data.leadSourceId,
      circleIds: data.circleIds,
      category: data.category ?? null,
      treatmentMasterId: data.treatmentMasterId ?? null,
      departmentId: data.departmentId ?? null,
    })
    const normalizedCategory =
      data.category?.trim() || references.treatmentMaster?.category || null

    const normalizedCircleIds = Array.from(new Set(data.circleIds.map((circleId) => circleId.trim())))

    const created = await prisma.crmCampaign.create({
      data: {
        externalCampaignId: data.externalCampaignId.trim(),
        displayName: data.displayName.trim(),
        category: normalizedCategory,
        treatment: references.treatmentMaster?.name ?? null,
        treatmentMasterId: references.treatmentMaster?.id ?? null,
        departmentId: data.departmentId ?? null,
        sourceId: data.sourceId,
        leadSourceId: data.leadSourceId,
        circleId: normalizedCircleIds[0],
        circleSelections: {
          create: normalizedCircleIds.map((circleId) => ({ circleId })),
        },
        cityId: null,
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
        treatmentMaster: true,
        circleSelections: {
          include: {
            circle: true,
          },
        },
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
        treatment: created.treatment,
        treatmentMasterId: created.treatmentMasterId,
        departmentId: created.departmentId,
        departmentName: created.department?.name ?? null,
        sourceId: created.sourceId,
        sourceName: created.source.name,
        leadSourceId: created.leadSourceId,
        leadSourceName: created.leadSource.name,
        circleIds: created.circleSelections.map((selection) => selection.circleId),
        circleNames: created.circleSelections.map((selection) => selection.circle.name),
        primaryCircleId: created.circleId,
        primaryCircleName: created.circle.name,
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
