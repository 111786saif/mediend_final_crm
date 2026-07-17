import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { isSuperAdmin } from '@/lib/crm-campaigns'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const masterTypeSchema = z.enum(['source', 'leadSource', 'circle', 'city'])

const masterPatchSchema = z.object({
  name: z.string().trim().min(1).max(255),
  isActive: z.boolean().default(true),
  sourceId: z.string().min(1).optional(),
  circleId: z.string().min(1).optional(),
  cpl: z.number().finite().nonnegative().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    if (!isSuperAdmin(currentUser)) return errorResponse('Forbidden', 403)

    const { type, id } = await params
    const parsedType = masterTypeSchema.safeParse(type)
    if (!parsedType.success) {
      return errorResponse('Invalid master type', 400)
    }

    const body = await request.json()
    const parsedBody = masterPatchSchema.safeParse(body)
    if (!parsedBody.success) {
      return errorResponse(parsedBody.error.message, 400)
    }

    const data = parsedBody.data

    if (parsedType.data === 'source') {
      const updated = await prisma.crmCampaignSource.update({
        where: { id },
        data: {
          name: data.name,
          isActive: data.isActive,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_UPDATED',
        entityType: 'CRM_MASTER_SOURCE',
        entityId: updated.id,
        entityLabel: updated.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Updated CRM source "${updated.name}"`,
        metadata: updated,
      })
      return successResponse(updated, 'Source updated successfully')
    }

    if (parsedType.data === 'leadSource') {
      if (!data.sourceId) {
        return errorResponse('sourceId is required for a lead source.', 400)
      }
      const source = await prisma.crmCampaignSource.findUnique({
        where: { id: data.sourceId },
        select: { id: true },
      })
      if (!source) {
        return errorResponse('Source not found', 400)
      }

      const updated = await prisma.crmCampaignLeadSource.update({
        where: { id },
        data: {
          name: data.name,
          sourceId: data.sourceId,
          cpl: data.cpl ?? null,
          isActive: data.isActive,
        },
        include: {
          source: true,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_UPDATED',
        entityType: 'CRM_MASTER_LEAD_SOURCE',
        entityId: updated.id,
        entityLabel: updated.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Updated CRM lead source "${updated.name}"`,
        metadata: {
          id: updated.id,
          name: updated.name,
          cpl: updated.cpl,
          sourceId: updated.sourceId,
          sourceName: updated.source.name,
          isActive: updated.isActive,
        },
      })
      return successResponse(updated, 'Lead source updated successfully')
    }

    if (parsedType.data === 'circle') {
      const updated = await prisma.crmCampaignCircle.update({
        where: { id },
        data: {
          name: data.name,
          isActive: data.isActive,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_UPDATED',
        entityType: 'CRM_MASTER_CIRCLE',
        entityId: updated.id,
        entityLabel: updated.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Updated CRM circle "${updated.name}"`,
        metadata: updated,
      })
      return successResponse(updated, 'Circle updated successfully')
    }

    if (!data.circleId) {
      return errorResponse('circleId is required for a city.', 400)
    }
    const circle = await prisma.crmCampaignCircle.findUnique({
      where: { id: data.circleId },
      select: { id: true },
    })
    if (!circle) {
      return errorResponse('Circle not found', 400)
    }

    const updated = await prisma.crmCampaignCity.update({
      where: { id },
      data: {
        name: data.name,
        circleId: data.circleId,
        isActive: data.isActive,
      },
      include: {
        circle: true,
      },
    })
    await logCrmActivity({
      action: 'CRM_MASTER_UPDATED',
      entityType: 'CRM_MASTER_CITY',
      entityId: updated.id,
      entityLabel: updated.name,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Updated CRM city "${updated.name}"`,
      metadata: {
        id: updated.id,
        name: updated.name,
        circleId: updated.circleId,
        circleName: updated.circle.name,
        isActive: updated.isActive,
      },
    })
    return successResponse(updated, 'City updated successfully')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse('A record with the same name already exists.', 409)
      }
      if (error.code === 'P2025') {
        return errorResponse('Record not found', 404)
      }
    }
    console.error('Error updating CRM campaign master:', error)
    return errorResponse('Failed to update CRM campaign master', 500)
  }
}
