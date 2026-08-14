import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'

const LEAD_ACTIVITY_ENTITY_TYPES = ['CRM_LEAD', 'CRM_LEAD_REMARK', 'CRM_LEAD_QR'] as const

const querySchema = z.object({
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(200).optional(),
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
      entityType: searchParams.get('entityType') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { entityType, action, search, page = 1, pageSize = 50 } = parsed.data
    const where = {
      entityType: {
        in: [...LEAD_ACTIVITY_ENTITY_TYPES],
      },
      ...(entityType && entityType !== 'all' ? { entityType } : {}),
      ...(action && action !== 'all' ? { action } : {}),
      ...(search
        ? {
            OR: [
              { summary: { contains: search, mode: 'insensitive' as const } },
              { entityLabel: { contains: search, mode: 'insensitive' as const } },
              { action: { contains: search, mode: 'insensitive' as const } },
              { actorUser: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
              { actorUser: { is: { email: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    }
    const skip = (page - 1) * pageSize

    const [total, logs] = await Promise.all([
      prisma.crmActivityLog.count({ where }),
      prisma.crmActivityLog.findMany({
        where,
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
        skip,
        take: pageSize,
      }),
    ])

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
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      filters: {
        entityTypes: entityTypes.map((item) => item.entityType),
        actions: actions.map((item) => item.action),
      },
    })
  } catch (error) {
    console.error('Error fetching CRM activity logs:', error)
    return errorResponse('Failed to fetch CRM activity logs', 500)
  }
}
