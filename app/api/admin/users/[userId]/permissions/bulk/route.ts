import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { resolvePermission, levelSatisfies } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { PermissionLevel } from '@/generated/prisma/client'
import { z } from 'zod'

const bulkPermissionSchema = z.object({
  resourceId: z.string().min(1),
  permissionLevel: z.nativeEnum(PermissionLevel),
  canGrant: z.boolean().default(false),
})

async function getDescendantResourceIds(resourceId: string): Promise<string[]> {
  const children = await prisma.resource.findMany({
    where: { parentId: resourceId, isActive: true },
    select: { id: true },
  })
  const childIds = children.map((c) => c.id)
  let descendants = [...childIds]
  for (const cid of childIds) {
    const subDescendants = await getDescendantResourceIds(cid)
    descendants = descendants.concat(subDescendants)
  }
  return descendants
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actorUser = getSessionFromRequest(request)
    if (!actorUser) return unauthorizedResponse()

    // Gate access: only admin-level managers who can configure IT permissions
    if (!hasPermission(actorUser, 'it:permissions') && actorUser.role !== 'MD' && actorUser.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { userId } = await params

    const body = await request.json()
    const parsed = bulkPermissionSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }
    const { resourceId, permissionLevel, canGrant } = parsed.data

    // Find root resource
    const rootResource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { id: true, key: true },
    })
    if (!rootResource) {
      return errorResponse('Root resource not found', 404)
    }

    // Verify target user exists
    const targetUserExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!targetUserExists) {
      return errorResponse('Target user not found', 404)
    }

    // Validate delegation rules at the root level of the cascade
    const isSuperAdmin = actorUser.role === 'MD' || actorUser.role === 'ADMIN'
    if (!isSuperAdmin) {
      const actorLevelInfo = await resolvePermission(actorUser.id, rootResource.key)
      if (!actorLevelInfo.canGrant) {
        return errorResponse('Forbidden: You do not have delegation rights on the root resource', 403)
      }
      if (!levelSatisfies(actorLevelInfo.level, permissionLevel)) {
        return errorResponse(`Forbidden: You cannot delegate a permission level (${permissionLevel}) higher than your own (${actorLevelInfo.level})`, 403)
      }
    }

    // Fetch all descendants recursively
    const descendantIds = await getDescendantResourceIds(resourceId)
    const allTargetResourceIds = [resourceId, ...descendantIds]

    // Execute in a transaction for atomicity
    const upserts = allTargetResourceIds.map(async (resId) => {
      const existing = await prisma.permissionAssignment.findUnique({
        where: {
          userId_resourceId: {
            userId,
            resourceId: resId,
          },
        },
        select: { permissionLevel: true, canGrant: true },
      })

      const assignment = await prisma.permissionAssignment.upsert({
        where: {
          userId_resourceId: {
            userId,
            resourceId: resId,
          },
        },
        update: {
          permissionLevel,
          canGrant,
          grantedById: actorUser.id,
        },
        create: {
          userId,
          resourceId: resId,
          permissionLevel,
          canGrant,
          grantedById: actorUser.id,
        },
      })

      await prisma.permissionAuditLog.create({
        data: {
          actorId: actorUser.id,
          targetUserId: userId,
          resourceId: resId,
          oldLevel: existing?.permissionLevel ?? null,
          newLevel: permissionLevel,
          oldCanGrant: existing?.canGrant ?? null,
          newCanGrant: canGrant,
        },
      })

      return assignment
    })

    const results = await Promise.all(upserts)

    return successResponse({
      count: results.length,
      assignments: results,
    })
  } catch (error) {
    console.error('Error fanning out bulk permissions:', error)
    return errorResponse('Failed to execute bulk permission cascading', 500)
  }
}
