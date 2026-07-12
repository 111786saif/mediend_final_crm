import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { UserRole } from '@/generated/prisma/enums'
import { Prisma } from '@/generated/prisma/client'
import { logCrmActivity } from '@/lib/crm-activity'
import {
  canManageCrmPermission,
  getCrmAdminDelegablePermissionKeys,
  getCrmPermissionDefinition,
  getCrmPermissionRegistry,
  getEffectiveCrmPermissionsForUsers,
  hasCrmPermission,
  isCrmPermissionKey,
  resolveCrmPermissionState,
} from '@/lib/crm-permissions'

const updateCrmPermissionSchema = z.object({
  userId: z.string().min(1),
  permissionKey: z.string().min(1),
  enabled: z.boolean(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.access_matrix.view'))) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const search = searchParams.get('search')

    const where: Prisma.UserWhereInput = {}
    if (role && role in UserRole) {
      where.role = role as UserRole
    }
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
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    const permissionStateByUser = await getEffectiveCrmPermissionsForUsers(
      users.map((user) => ({ id: user.id, role: user.role }))
    )
    const delegablePermissionKeys = await getCrmAdminDelegablePermissionKeys()
    const canManage = await hasCrmPermission(currentUser.id, 'crm.access_matrix.manage')
    const canDelegate = await hasCrmPermission(currentUser.id, 'crm.access_matrix.delegate')

    return successResponse({
      permissions: getCrmPermissionRegistry(),
      availableRoles: Object.values(UserRole),
      policy: {
        delegablePermissionKeys,
        canDelegate,
      },
      currentUser: {
        role: currentUser.role,
        canManage,
        canDelegate,
      },
      users: users.map((user) => ({
        ...user,
        permissions: permissionStateByUser.get(user.id),
      })),
    })
  } catch (error) {
    console.error('Error fetching CRM access matrix:', error)
    return errorResponse('Failed to fetch CRM access matrix', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.access_matrix.manage'))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = updateCrmPermissionSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { userId, permissionKey, enabled } = parsed.data
    if (!isCrmPermissionKey(permissionKey)) {
      return errorResponse('Unknown CRM permission key', 400)
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, email: true },
    })
    if (!targetUser) {
      return errorResponse('Target user not found', 404)
    }

    if (!(await canManageCrmPermission(currentUser, targetUser, permissionKey))) {
      return errorResponse('You do not have permission to update this CRM permission', 403)
    }

    const defaultEnabled = resolveCrmPermissionState(targetUser.role, permissionKey, null)
    if (enabled === defaultEnabled) {
      await prisma.userCrmPermission.deleteMany({
        where: {
          userId,
          permissionKey,
        },
      })
    } else {
      await prisma.userCrmPermission.upsert({
        where: {
          userId_permissionKey: {
            userId,
            permissionKey,
          },
        },
        create: {
          userId,
          permissionKey,
          enabled,
          grantedById: currentUser.id,
        },
        update: {
          enabled,
          grantedById: currentUser.id,
        },
      })
    }

    const permissionDefinition = getCrmPermissionDefinition(permissionKey)
    await logCrmActivity({
      action: 'CRM_PERMISSION_UPDATED',
      entityType: 'CRM_PERMISSION',
      entityId: `${userId}:${permissionKey}`,
      entityLabel: `${targetUser.name} · ${permissionDefinition.label}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `${enabled ? 'Enabled' : 'Disabled'} ${permissionDefinition.label} for ${targetUser.name}`,
      metadata: {
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        targetUserRole: targetUser.role,
        permissionKey,
        permissionLabel: permissionDefinition.label,
        enabled,
        resetToDefault: enabled === defaultEnabled,
      },
    })

    return successResponse({
      ok: true,
      permission: {
        userId,
        permissionKey,
        enabled,
        label: permissionDefinition.label,
      },
    })
  } catch (error) {
    console.error('Error updating CRM permission:', error)
    return errorResponse('Failed to update CRM permission', 500)
  }
}
