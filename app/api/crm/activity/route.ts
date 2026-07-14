import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'

const LEAD_ACTIVITY_ENTITY_TYPES = ['CRM_LEAD', 'CRM_LEAD_REMARK', 'CRM_LEAD_QR'] as const

const querySchema = z.object({
  status: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    const canView =
      String(currentUser.role) === 'SUPER_ADMIN' ||
      String(currentUser.role) === 'CRM_ADMIN' ||
      (await hasCrmPermission(currentUser.id, 'crm.access_matrix.view'))

    if (!canView) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      entityType: searchParams.get('entityType') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { status, entityType, action, search, limit } = parsed.data

    const logs = await prisma.crmActivityLog.findMany({
      where: {
        entityType: {
          in: [...LEAD_ACTIVITY_ENTITY_TYPES],
        },
        ...(status && status !== 'all' ? { status } : {}),
        ...(entityType && entityType !== 'all' ? { entityType } : {}),
        ...(action && action !== 'all' ? { action } : {}),
        ...(search
          ? {
              OR: [
                { summary: { contains: search, mode: 'insensitive' } },
                { entityLabel: { contains: search, mode: 'insensitive' } },
                { action: { contains: search, mode: 'insensitive' } },
                { actorUser: { is: { name: { contains: search, mode: 'insensitive' } } } },
                { actorUser: { is: { email: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 100,
    })

    const [entityTypes, actions] = await Promise.all([
      prisma.crmActivityLog.findMany({
        where: {
          entityType: {
            in: [...LEAD_ACTIVITY_ENTITY_TYPES],
          },
        },
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
      prisma.crmActivityLog.findMany({
        where: {
          entityType: {
            in: [...LEAD_ACTIVITY_ENTITY_TYPES],
          },
        },
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
    ])

    return successResponse({
      logs,
      filters: {
        entityTypes: entityTypes.map((item) => item.entityType),
        actions: actions.map((item) => item.action),
        statuses: ['SUCCESS', 'FAILED'],
      },
    })
  } catch (error) {
    console.error('Error fetching CRM activity logs:', error)
    return errorResponse('Failed to fetch CRM activity logs', 500)
  }
}
