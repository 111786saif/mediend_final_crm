import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { PermissionLevel, SubjectType } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    // 1. Fetch all active resources
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      select: { id: true, key: true },
    })

    if (process.env.DISABLE_RBAC_LIMITS === 'true') {
      const permissions: Record<string, { level: string; canGrant: boolean }> = {}
      for (const res of resources) {
        permissions[res.key] = { level: 'FULL_ACCESS', canGrant: true }
      }
      return successResponse({ permissions })
    }

    // 2. Fetch user-level assignments
    const userAssignments = await prisma.permissionAssignment.findMany({
      where: { userId: user.id },
      select: { resourceId: true, permissionLevel: true, canGrant: true },
    })

    const userAssignmentsMap = new Map<string, { permissionLevel: PermissionLevel; canGrant: boolean }>()
    for (const a of userAssignments) {
      userAssignmentsMap.set(a.resourceId, {
        permissionLevel: a.permissionLevel,
        canGrant: a.canGrant,
      })
    }

    // 3. Fetch user's role to resolve defaults
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    })

    // Allow role override query parameter for TESTER role
    const searchParams = request.nextUrl.searchParams
    const roleParam = searchParams.get('role')
    const effectiveRole = (dbUser?.role === 'TESTER' && roleParam) ? roleParam : (dbUser?.role ?? '')

    const roleAssignmentsMap = new Map<string, { permissionLevel: PermissionLevel; canGrant: boolean }>()
    if (effectiveRole) {
      const roleAssignments = await prisma.permissionAssignment.findMany({
        where: {
          subjectType: SubjectType.ROLE,
          role: effectiveRole as any,
        },
        select: { resourceId: true, permissionLevel: true, canGrant: true },
      })
      for (const a of roleAssignments) {
        roleAssignmentsMap.set(a.resourceId, {
          permissionLevel: a.permissionLevel,
          canGrant: a.canGrant,
        })
      }
    }

    // 4. Resolve flat permissions map
    const permissions: Record<string, { level: PermissionLevel; canGrant: boolean }> = {}

    for (const res of resources) {
      // Individual overrides role
      const userAssignment = userAssignmentsMap.get(res.id)
      if (userAssignment) {
        permissions[res.key] = {
          level: userAssignment.permissionLevel,
          canGrant: userAssignment.canGrant,
        }
      } else {
        // 2. Child override check (if a child of this resource has a user override with level > NONE)
        let hasActiveChildOverride = false
        let childCanGrant = false
        
        for (const [assignResId, assignVal] of userAssignmentsMap.entries()) {
          const assignRes = resources.find(r => r.id === assignResId)
          if (assignRes && assignRes.key.startsWith(res.key + '.') && assignVal.permissionLevel !== PermissionLevel.NONE) {
            hasActiveChildOverride = true
            if (assignVal.canGrant) {
              childCanGrant = true
            }
          }
        }
        
        if (hasActiveChildOverride) {
          permissions[res.key] = {
            level: PermissionLevel.FULL_ACCESS,
            canGrant: childCanGrant,
          }
        } else {
          // 3. Fallback to database role assignments
          const roleAssignment = roleAssignmentsMap.get(res.id)
          if (roleAssignment) {
            permissions[res.key] = {
              level: roleAssignment.permissionLevel,
              canGrant: roleAssignment.canGrant,
            }
          } else {
            permissions[res.key] = {
              level: PermissionLevel.NONE,
              canGrant: false,
            }
          }
        }
      }
    }

    return successResponse({ permissions })
  } catch (error) {
    console.error('Error fetching caller permissions map:', error)
    return errorResponse('Failed to fetch permissions map', 500)
  }
}
