import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { TargetMetric } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'

/**
 * Performance "levels" (Bronze/Silver/Gold/Platinum...) for the Sales/BD
 * hierarchy only. Anyone with targets:read can view the ladder; only
 * targets:write roles (Sales Head, Team Lead, Admin, EA) can define it.
 */

const createSchema = z.object({
  name: z.string().min(1),
  metric: z.nativeEnum(TargetMetric).default('IPD_DONE'),
  thresholdValue: z.number().min(0),
  order: z.number().int().min(0),
  rewardAmount: z.number().min(0).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const metric = (searchParams.get('metric') as TargetMetric) || 'IPD_DONE'

    const tiers = await prisma.tierDefinition.findMany({
      where: { metric },
      orderBy: { order: 'asc' },
    })

    return successResponse(tiers)
  } catch (error) {
    console.error('Error fetching tier definitions:', error)
    return errorResponse('Failed to fetch levels', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return zodErrorResponse(parsed.error)

    const tier = await prisma.tierDefinition.create({
      data: { ...parsed.data, createdById: user.id },
    })

    return successResponse(tier, 'Level created')
  } catch (error) {
    console.error('Error creating tier definition:', error)
    return errorResponse('Failed to create level', 500)
  }
}