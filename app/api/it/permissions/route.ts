import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { FEATURE_KEYS } from '@/lib/feature-keys'
import { UserRole, type Prisma } from '@/generated/prisma/client'

const toggleSchema = z.object({
  userId: z.string().min(1),
  featureKey: z.enum([
    FEATURE_KEYS.MD_APPROVAL_REQUEST,
    FEATURE_KEYS.CREATE_NOTICE,
    FEATURE_KEYS.WORKLOG_ENFORCEMENT,
    FEATURE_KEYS.CREATE_MEET,
  ]),
  enabled: z.boolean(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'it:permissions')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    const userId = searchParams.get('userId')

    const where: Prisma.UserWhereInput = {}
    if (userId) where.id = userId
    if (role && role in UserRole) where.role = role as (typeof UserRole)[keyof typeof UserRole]
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const permissions = await prisma.userFeaturePermission.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, featureKey: true, enabled: true },
    })

    const permMap = new Map<string, Record<string, boolean>>()
    for (const p of permissions) {
      if (!permMap.has(p.userId)) permMap.set(p.userId, {})
      permMap.get(p.userId)![p.featureKey] = p.enabled
    }

    const result = users.map((u) => ({
      ...u,
      permissions: {
        [FEATURE_KEYS.MD_APPROVAL_REQUEST]: permMap.get(u.id)?.[FEATURE_KEYS.MD_APPROVAL_REQUEST] ?? null,
        [FEATURE_KEYS.CREATE_NOTICE]: permMap.get(u.id)?.[FEATURE_KEYS.CREATE_NOTICE] ?? null,
        [FEATURE_KEYS.WORKLOG_ENFORCEMENT]: permMap.get(u.id)?.[FEATURE_KEYS.WORKLOG_ENFORCEMENT] ?? null,
        [FEATURE_KEYS.CREATE_MEET]: permMap.get(u.id)?.[FEATURE_KEYS.CREATE_MEET] ?? null,
      },
    }))

    return successResponse(result)
  } catch (error) {
    console.error('Error fetching IT permissions:', error)
    return errorResponse('Failed to fetch permissions', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'it:permissions')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = toggleSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { userId, featureKey, enabled } = parsed.data

    await prisma.userFeaturePermission.upsert({
      where: { userId_featureKey: { userId, featureKey } },
      create: {
        userId,
        featureKey,
        enabled,
        grantedById: user.id,
      },
      update: {
        enabled,
        grantedById: user.id,
      },
    })

    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error updating IT permission:', error)
    return errorResponse('Failed to update permission', 500)
  }
}
