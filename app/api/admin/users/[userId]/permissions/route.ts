import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { PermissionLevel, SubjectType } from '@/generated/prisma/client'
import { z } from 'zod'

interface ResourceNodeWithAssignment {
  id: string
  key: string
  label: string
  type: string
  parentId: string | null
  sortOrder: number
  isActive: boolean
  assignment: {
    permissionLevel: string
    canGrant: boolean
  } | null
  roleAssignment: {
    permissionLevel: string
    canGrant: boolean
  } | null
  children: ResourceNodeWithAssignment[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = getSessionFromRequest(request)
    if (!caller) return unauthorizedResponse()

    // Caller must have administrative permissions configuration capability
    if (!hasPermission(caller, 'it:permissions')) {
      return errorResponse('Access denied. Insufficient administrative privileges.', 403)
    }

    const { userId } = await params

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })

    if (!targetUser) {
      return errorResponse('User not found', 404)
    }

    // Fetch all active resources
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Fetch the target user's custom permission assignments
    const userAssignments = await prisma.permissionAssignment.findMany({
      where: { userId },
      select: { resourceId: true, permissionLevel: true, canGrant: true },
    })

    const assignmentsMap = new Map<string, { permissionLevel: string; canGrant: boolean }>()
    for (const assignment of userAssignments) {
      assignmentsMap.set(assignment.resourceId, {
        permissionLevel: assignment.permissionLevel,
        canGrant: assignment.canGrant,
      })
    }

    // Fetch target user's role-level assignments
    const roleAssignments = await prisma.permissionAssignment.findMany({
      where: {
        subjectType: SubjectType.ROLE,
        role: targetUser.role,
      },
      select: { resourceId: true, permissionLevel: true, canGrant: true },
    })

    const allowedResourceIds = new Set<string>()
    const roleAssignmentsMap = new Map<string, { permissionLevel: string; canGrant: boolean }>()
    for (const ra of roleAssignments) {
      if (ra.permissionLevel !== 'NONE') {
        allowedResourceIds.add(ra.resourceId)
      }
      roleAssignmentsMap.set(ra.resourceId, {
        permissionLevel: ra.permissionLevel,
        canGrant: ra.canGrant,
      })
    }

    // MD and ADMIN can configure/see everything. Otherwise, filter active resources by role scope or override presence
    const isMdOrAdmin = targetUser.role === 'MD' || targetUser.role === 'ADMIN'
    const filteredResources = resources.filter(
      (res) => isMdOrAdmin || allowedResourceIds.has(res.id) || assignmentsMap.has(res.id)
    )

    // Build the resource tree with assignments merged in
    const nodesMap = new Map<string, ResourceNodeWithAssignment>()
    const roots: ResourceNodeWithAssignment[] = []

    for (const res of filteredResources) {
      const assignment = assignmentsMap.get(res.id) ?? null
      const roleAssignment = roleAssignmentsMap.get(res.id) ?? null
      nodesMap.set(res.id, {
        id: res.id,
        key: res.key,
        label: res.label,
        type: res.type,
        parentId: res.parentId,
        sortOrder: res.sortOrder,
        isActive: res.isActive,
        assignment,
        roleAssignment,
        children: [],
      })
    }

    for (const node of nodesMap.values()) {
      if (node.parentId) {
        const parentNode = nodesMap.get(node.parentId)
        if (parentNode) {
          parentNode.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    }

    // Sort children
    const sortChildren = (nodes: ResourceNodeWithAssignment[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder)
      for (const n of nodes) {
        if (n.children.length > 0) {
          sortChildren(n.children)
        }
      }
    }
    sortChildren(roots)

    return successResponse({
      user: targetUser,
      resourceTree: roots,
    })
  } catch (error) {
    console.error('Error fetching admin user permissions tree:', error)
    return errorResponse('Failed to fetch user permissions tree', 500)
  }
}

// ────────────────────────────────────────────────
// PATCH  /api/admin/users/[userId]/permissions
// Batch-upsert permission assignments for a user.
// Body: { assignments: [{ resourceId, permissionLevel, canGrant }] }
// ────────────────────────────────────────────────

const batchUpdateSchema = z.object({
  assignments: z.array(
    z.object({
      resourceId: z.string().min(1),
      permissionLevel: z.nativeEnum(PermissionLevel),
      canGrant: z.boolean().default(false),
    })
  ),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const actorUser = getSessionFromRequest(request)
    if (!actorUser) return unauthorizedResponse()

    // Gate access
    if (
      !hasPermission(actorUser, 'it:permissions') &&
      actorUser.role !== 'MD' &&
      actorUser.role !== 'ADMIN'
    ) {
      return errorResponse('Forbidden', 403)
    }

    const { userId } = await params

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!targetUser) {
      return errorResponse('Target user not found', 404)
    }

    const body = await request.json()
    const parsed = batchUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const { assignments } = parsed.data

    if (assignments.length === 0) {
      return successResponse({ count: 0 })
    }

    // Verify all resource IDs exist in one query
    const resourceIds = assignments.map((a) => a.resourceId)
    const existingResources = await prisma.resource.findMany({
      where: { id: { in: resourceIds } },
      select: { id: true },
    })
    const existingResourceIds = new Set(existingResources.map((r) => r.id))

    const invalidIds = resourceIds.filter((id) => !existingResourceIds.has(id))
    if (invalidIds.length > 0) {
      return errorResponse(`Resources not found: ${invalidIds.slice(0, 5).join(', ')}`, 404)
    }

    // Fetch existing assignments for audit log
    const existingAssignments = await prisma.permissionAssignment.findMany({
      where: {
        userId,
        resourceId: { in: resourceIds },
      },
      select: { resourceId: true, permissionLevel: true, canGrant: true },
    })
    const existingMap = new Map(
      existingAssignments.map((a) => [a.resourceId, a])
    )

    // Upsert all permission assignments in a transaction with extended timeout
    await prisma.$transaction(
      async (tx) => {
        for (const item of assignments) {
          await tx.permissionAssignment.upsert({
            where: {
              userId_resourceId: {
                userId,
                resourceId: item.resourceId,
              },
            },
            update: {
              permissionLevel: item.permissionLevel,
              canGrant: item.canGrant,
              grantedById: actorUser.id,
            },
            create: {
              userId,
              resourceId: item.resourceId,
              permissionLevel: item.permissionLevel,
              canGrant: item.canGrant,
              grantedById: actorUser.id,
            },
          })
        }
      },
      { timeout: 30000 } // 30s timeout for large batch
    )

    // Bulk-insert audit logs outside the transaction (non-critical)
    await prisma.permissionAuditLog.createMany({
      data: assignments.map((item) => {
        const existing = existingMap.get(item.resourceId)
        return {
          actorId: actorUser.id,
          targetUserId: userId,
          resourceId: item.resourceId,
          oldLevel: existing?.permissionLevel ?? null,
          newLevel: item.permissionLevel,
          oldCanGrant: existing?.canGrant ?? null,
          newCanGrant: item.canGrant,
        }
      }),
    })

    return successResponse({ count: assignments.length })
  } catch (error) {
    console.error('Error batch updating permissions:', error)
    return errorResponse('Failed to batch update permissions', 500)
  }
}
