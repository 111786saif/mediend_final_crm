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

    // 2. Fetch user's role and check for simulation overrides first
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    })

    const searchParams = request.nextUrl.searchParams
    const roleParam = searchParams.get('role')
    const hasRoleOverride = !!roleParam && (dbUser?.role === 'TESTER' || dbUser?.role === 'ADMIN' || dbUser?.role === 'MD')
    const effectiveRole = hasRoleOverride ? roleParam : (dbUser?.role ?? '')

    const resourcesMap = new Map(resources.map((r) => [r.id, r]))

    // 3. Fetch user overrides (bypassed in simulation mode to avoid corrupting role preview)
    const userAssignments = hasRoleOverride
      ? []
      : await prisma.permissionAssignment.findMany({
          where: { userId: user.id, subjectType: SubjectType.USER },
          select: { resourceId: true, permissionLevel: true, canGrant: true },
        })

    const userOverridesByKey = new Map<string, { permissionLevel: PermissionLevel; canGrant: boolean }>()
    for (const a of userAssignments) {
      const res = resourcesMap.get(a.resourceId)
      if (res) {
        userOverridesByKey.set(res.key, {
          permissionLevel: a.permissionLevel,
          canGrant: a.canGrant,
        })
      }
    }

    // 4. Fetch role assignments
    const roleAssignmentsByKey = new Map<string, { permissionLevel: PermissionLevel; canGrant: boolean }>()
    if (effectiveRole) {
      const roleAssignments = await prisma.permissionAssignment.findMany({
        where: {
          subjectType: SubjectType.ROLE,
          role: effectiveRole as any,
        },
        select: { resourceId: true, permissionLevel: true, canGrant: true },
      })
      for (const a of roleAssignments) {
        const res = resourcesMap.get(a.resourceId)
        if (res) {
          roleAssignmentsByKey.set(res.key, {
            permissionLevel: a.permissionLevel,
            canGrant: a.canGrant,
          })
        }
      }
    }

    // Helper to walk prefix path and resolve permissions hierarchically
    const resolveLevel = (
      key: string,
      assignmentsByKey: Map<string, { permissionLevel: PermissionLevel; canGrant: boolean }>,
      isFallback = false
    ): { level: PermissionLevel; canGrant: boolean } | null => {
      const parts = key.split('.')
      let resolvedLevel: PermissionLevel | null = null
      let resolvedCanGrant = false

      for (let len = 1; len <= parts.length; len++) {
        const prefix = parts.slice(0, len).join('.')
        const assignment = assignmentsByKey.get(prefix)

        if (assignment) {
          if (assignment.permissionLevel === PermissionLevel.NONE) {
            return { level: PermissionLevel.NONE, canGrant: false }
          }
          resolvedLevel = assignment.permissionLevel
          resolvedCanGrant = assignment.canGrant
        } else if (isFallback) {
          // In role fallback, if a prefix node is completely missing from database,
          // it means the role has no permission to it (or its parent).
          return { level: PermissionLevel.NONE, canGrant: false }
        }
      }

      if (resolvedLevel === null) return null
      return { level: resolvedLevel, canGrant: resolvedCanGrant }
    }

    // Pass 1: Resolve baseline resource permission mapping
    const basePermissions = new Map<string, { level: PermissionLevel; canGrant: boolean }>()

    const LEVEL_VALUES: Record<PermissionLevel, number> = {
      [PermissionLevel.NONE]: 0,
      [PermissionLevel.READ]: 1,
      [PermissionLevel.READ_WRITE]: 2,
      [PermissionLevel.READ_WRITE_DELETE]: 3,
      [PermissionLevel.FULL_ACCESS]: 4,
    }

    const VALUE_TO_LEVEL: Record<number, PermissionLevel> = {
      0: PermissionLevel.NONE,
      1: PermissionLevel.READ,
      2: PermissionLevel.READ_WRITE,
      3: PermissionLevel.READ_WRITE_DELETE,
      4: PermissionLevel.FULL_ACCESS,
    }

    for (const res of resources) {
      // First, resolve the role baseline level
      const roleRes = resolveLevel(res.key, roleAssignmentsByKey, true)
      const roleLevel = roleRes ? roleRes.level : PermissionLevel.NONE
      const roleCanGrant = roleRes ? roleRes.canGrant : false

      // If the role doesn't grant access, they cannot have access
      if (roleLevel === PermissionLevel.NONE) {
        continue
      }

      // Check if there is a user-level override
      const userRes = resolveLevel(res.key, userOverridesByKey, false)

      if (userRes) {
        // Enforce restriction: user override can only demote/turn off permissions, never elevate
        const resolvedLevelVal = Math.min(LEVEL_VALUES[roleLevel], LEVEL_VALUES[userRes.level])
        const resolvedLevel = VALUE_TO_LEVEL[resolvedLevelVal]
        const resolvedCanGrant = roleCanGrant && userRes.canGrant

        if (resolvedLevel !== PermissionLevel.NONE) {
          basePermissions.set(res.key, {
            level: resolvedLevel,
            canGrant: resolvedCanGrant,
          })
        }
      } else {
        // No override, use clean role baseline
        basePermissions.set(res.key, {
          level: roleLevel,
          canGrant: roleCanGrant,
        })
      }
    }

    // Pass 2: Resolve parent menu visibility (if any child node is allowed, show the parent group)
    const permissions: Record<string, { level: PermissionLevel; canGrant: boolean }> = {}

    for (const res of resources) {
      const basePerm = basePermissions.get(res.key)
      if (basePerm) {
        permissions[res.key] = basePerm
      } else {
        // Check if any descendant resource is active/allowed
        let descendantAllowed = false
        let descendantCanGrant = false

        for (const [key, val] of basePermissions.entries()) {
          if (key.startsWith(res.key + '.')) {
            descendantAllowed = true
            if (val.canGrant) {
              descendantCanGrant = true
            }
          }
        }

        if (descendantAllowed) {
          permissions[res.key] = {
            level: PermissionLevel.FULL_ACCESS,
            canGrant: descendantCanGrant,
          }
        }
      }
    }

    if (effectiveRole === 'SUPER_ADMIN') {
      for (const res of resources) {
        if (
          res.key === 'sales' ||
          res.key === 'sales.ea_pipeline' ||
          res.key.startsWith('sales.ea_pipeline.')
        ) {
          permissions[res.key] = {
            level: PermissionLevel.FULL_ACCESS,
            canGrant: true,
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
