import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { resolvePermission, levelSatisfies } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { PermissionLevel } from '@/generated/prisma/client'
import { z } from 'zod'

const updatePermissionSchema = z.object({
  permissionLevel: z.nativeEnum(PermissionLevel),
  canGrant: z.boolean().default(false),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; resourceId: string }> }
) {
  try {
    const actorUser = getSessionFromRequest(request)
    if (!actorUser) return unauthorizedResponse()

    // Gate access: only admin-level managers who can configure IT permissions
    if (!hasPermission(actorUser, 'it:permissions') && actorUser.role !== 'MD' && actorUser.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { userId, resourceId } = await params

    const body = await request.json()
    const parsed = updatePermissionSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }
    const { permissionLevel, canGrant } = parsed.data

    // Find the target resource
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { id: true, key: true },
    })
    if (!resource) {
      return errorResponse('Resource not found', 404)
    }

    // Verify target user exists
    const targetUserExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!targetUserExists) {
      return errorResponse('Target user not found', 404)
    }

    // Enforce delegation rules (unless MD or ADMIN)
    const isSuperAdmin = actorUser.role === 'MD' || actorUser.role === 'ADMIN'
    if (!isSuperAdmin) {
      const actorLevelInfo = await resolvePermission(actorUser.id, resource.key)
      if (!actorLevelInfo.canGrant) {
        return errorResponse('Forbidden: You do not have delegation rights (canGrant = false) on this resource', 403)
      }
      if (!levelSatisfies(actorLevelInfo.level, permissionLevel)) {
        return errorResponse(`Forbidden: You cannot delegate a permission level (${permissionLevel}) higher than your own (${actorLevelInfo.level})`, 403)
      }
    }

    // Fetch existing assignment to compare for audit logs
    const existing = await prisma.permissionAssignment.findUnique({
      where: {
        userId_resourceId: {
          userId,
          resourceId,
        },
      },
      select: { permissionLevel: true, canGrant: true },
    })

    // Upsert the permission assignment
    const result = await prisma.permissionAssignment.upsert({
      where: {
        userId_resourceId: {
          userId,
          resourceId,
        },
      },
      update: {
        permissionLevel,
        canGrant,
        grantedById: actorUser.id,
      },
      create: {
        userId,
        resourceId,
        permissionLevel,
        canGrant,
        grantedById: actorUser.id,
      },
    })

    // Write to PermissionAuditLog
    await prisma.permissionAuditLog.create({
      data: {
        actorId: actorUser.id,
        targetUserId: userId,
        resourceId,
        oldLevel: existing?.permissionLevel ?? null,
        newLevel: permissionLevel,
        oldCanGrant: existing?.canGrant ?? null,
        newCanGrant: canGrant,
      },
    })

    return successResponse(result)
  } catch (error) {
    console.error('Error updating permission assignment:', error)
    return errorResponse('Failed to update permission assignment', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; resourceId: string }> }
) {
  try {
    const actorUser = getSessionFromRequest(request)
    if (!actorUser) return unauthorizedResponse()

    // Gate access: only admin-level managers who can configure IT permissions
    if (!hasPermission(actorUser, 'it:permissions') && actorUser.role !== 'MD' && actorUser.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { userId, resourceId } = await params

    // Fetch existing assignment to compare for audit logs
    const existing = await prisma.permissionAssignment.findUnique({
      where: {
        userId_resourceId: {
          userId,
          resourceId,
        },
      },
      select: { permissionLevel: true, canGrant: true },
    })

    if (!existing) {
      return errorResponse('Permission assignment not found', 404)
    }

    // Delete the permission assignment
    await prisma.permissionAssignment.delete({
      where: {
        userId_resourceId: {
          userId,
          resourceId,
        },
      },
    })

    // Write to PermissionAuditLog
    await prisma.permissionAuditLog.create({
      data: {
        actorId: actorUser.id,
        targetUserId: userId,
        resourceId,
        oldLevel: existing.permissionLevel,
        newLevel: PermissionLevel.NONE,
        oldCanGrant: existing.canGrant,
        newCanGrant: false,
      },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('Error deleting permission assignment:', error)
    return errorResponse('Failed to delete permission assignment', 500)
  }
}
