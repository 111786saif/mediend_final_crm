import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { isSuperAdmin, validateCampaignReferences } from '@/lib/crm-campaigns'
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const existing = await prisma.crmCampaign.findUnique({
      where: { id },
      select: { id: true, externalCampaignId: true, displayName: true },
    })
    if (!existing) {
      return errorResponse('Campaign not found', 404)
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

    const updated = await prisma.crmCampaign.update({
      where: { id },
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
          deleteMany: {},
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
      action: 'CRM_CAMPAIGN_UPDATED',
      entityType: 'CRM_CAMPAIGN',
      entityId: updated.id,
      entityLabel: `${updated.externalCampaignId} · ${updated.displayName}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Updated CRM campaign ${updated.externalCampaignId}`,
      metadata: {
        previousExternalCampaignId: existing.externalCampaignId,
        previousDisplayName: existing.displayName,
        externalCampaignId: updated.externalCampaignId,
        displayName: updated.displayName,
        category: updated.category,
        treatment: updated.treatment,
        treatmentMasterId: updated.treatmentMasterId,
        departmentId: updated.departmentId,
        departmentName: updated.department?.name ?? null,
        sourceId: updated.sourceId,
        sourceName: updated.source.name,
        leadSourceId: updated.leadSourceId,
        leadSourceName: updated.leadSource.name,
        circleIds: updated.circleSelections.map((selection) => selection.circleId),
        circleNames: updated.circleSelections.map((selection) => selection.circle.name),
        primaryCircleId: updated.circleId,
        primaryCircleName: updated.circle.name,
        isActive: updated.isActive,
      },
    })

    return successResponse(updated, 'Campaign updated successfully')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('A campaign with this campaign ID already exists.', 409)
    }
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    console.error('Error updating CRM campaign:', error)
    return errorResponse('Failed to update CRM campaign', 500)
  }
}
