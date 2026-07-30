import { Prisma } from '@/generated/prisma/client'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { isSuperAdmin } from '@/lib/crm-campaigns'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const masterCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('source'),
    name: z.string().trim().min(1).max(255),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('leadSource'),
    name: z.string().trim().min(1).max(255),
    sourceId: z.string().min(1),
    cpl: z.number().finite().nonnegative().nullable().optional(),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('circle'),
    name: z.string().trim().min(1).max(255),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('city'),
    name: z.string().trim().min(1).max(255),
    circleId: z.string().min(1),
    isActive: z.boolean().optional().default(true),
  }),
  z.object({
    type: z.literal('subStatus'),
    key: z.number().int().min(1),
    value: z.string().trim().min(1).max(255),
    isActive: z.boolean().optional().default(true),
  }),
])

export async function POST(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()
    if (!isSuperAdmin(currentUser)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = masterCreateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const data = parsed.data

    if (data.type === 'source') {
      const created = await prisma.crmCampaignSource.create({
        data: {
          name: data.name,
          isActive: data.isActive,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_CREATED',
        entityType: 'CRM_MASTER_SOURCE',
        entityId: created.id,
        entityLabel: created.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Created CRM source "${created.name}"`,
        metadata: created,
      })
      return successResponse(created, 'Source created successfully')
    }

    if (data.type === 'leadSource') {
      const source = await prisma.crmCampaignSource.findUnique({
        where: { id: data.sourceId },
        select: { id: true },
      })
      if (!source) {
        return errorResponse('Source not found', 400)
      }

      const created = await prisma.crmCampaignLeadSource.create({
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
        action: 'CRM_MASTER_CREATED',
        entityType: 'CRM_MASTER_LEAD_SOURCE',
        entityId: created.id,
        entityLabel: created.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Created CRM lead source "${created.name}"`,
        metadata: {
          id: created.id,
          name: created.name,
          cpl: created.cpl,
          sourceId: created.sourceId,
          sourceName: created.source.name,
          isActive: created.isActive,
        },
      })
      return successResponse(created, 'Lead source created successfully')
    }

    if (data.type === 'circle') {
      const created = await prisma.crmCampaignCircle.create({
        data: {
          name: data.name,
          isActive: data.isActive,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_CREATED',
        entityType: 'CRM_MASTER_CIRCLE',
        entityId: created.id,
        entityLabel: created.name,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Created CRM circle "${created.name}"`,
        metadata: created,
      })
      return successResponse(created, 'Circle created successfully')
    }

    if (data.type === 'subStatus') {
      const created = await prisma.crmSubStatusMaster.create({
        data: {
          key: data.key,
          value: data.value,
          isActive: data.isActive,
        },
      })
      await logCrmActivity({
        action: 'CRM_MASTER_CREATED',
        entityType: 'CRM_MASTER_SUB_STATUS',
        entityId: created.id,
        entityLabel: `${created.key} · ${created.value}`,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        request,
        summary: `Created CRM sub status "${created.value}"`,
        metadata: created,
      })
      return successResponse(created, 'Sub status created successfully')
    }

    const circle = await prisma.crmCampaignCircle.findUnique({
      where: { id: data.circleId },
      select: { id: true },
    })
    if (!circle) {
      return errorResponse('Circle not found', 400)
    }

    const created = await prisma.crmCampaignCity.create({
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
      action: 'CRM_MASTER_CREATED',
      entityType: 'CRM_MASTER_CITY',
      entityId: created.id,
      entityLabel: created.name,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Created CRM city "${created.name}"`,
      metadata: {
        id: created.id,
        name: created.name,
        circleId: created.circleId,
        circleName: created.circle.name,
        isActive: created.isActive,
      },
    })
    return successResponse(created, 'City created successfully')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('A record with the same name already exists.', 409)
    }
    console.error('Error creating CRM campaign master:', error)
    return errorResponse('Failed to create CRM campaign master', 500)
  }
}
