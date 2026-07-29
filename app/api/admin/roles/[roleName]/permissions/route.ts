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
  children: ResourceNodeWithAssignment[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleName: string }> }
) {
  try {
    const caller = getSessionFromRequest(request)
    if (!caller) return unauthorizedResponse()

    // Caller must have administrative permissions configuration capability
    if (!hasPermission(caller, 'it:permissions')) {
      return errorResponse('Access denied. Insufficient administrative privileges.', 403)
    }

    const { roleName } = await params

    // Fetch all active resources
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Fetch this role's permission assignments
    const roleAssignments = await prisma.permissionAssignment.findMany({
      where: {
        subjectType: SubjectType.ROLE,
        role: roleName,
      },
      select: { resourceId: true, permissionLevel: true, canGrant: true },
    })

    const assignmentsMap = new Map<string, { permissionLevel: string; canGrant: boolean }>()
    for (const assignment of roleAssignments) {
      assignmentsMap.set(assignment.resourceId, {
        permissionLevel: assignment.permissionLevel,
        canGrant: assignment.canGrant,
      })
    }

    // Build the resource tree with assignments merged in
    const nodesMap = new Map<string, ResourceNodeWithAssignment>()
    const roots: ResourceNodeWithAssignment[] = []

    for (const res of resources) {
      const assignment = assignmentsMap.get(res.id) ?? null
      nodesMap.set(res.id, {
        id: res.id,
        key: res.key,
        label: res.label,
        type: res.type,
        parentId: res.parentId,
        sortOrder: res.sortOrder,
        isActive: res.isActive,
        assignment,
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
      role: roleName,
      resourceTree: roots,
    })
  } catch (error) {
    console.error('Error fetching role permissions tree:', error)
    return errorResponse('Failed to fetch role permissions tree', 500)
  }
}

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
  { params }: { params: Promise<{ roleName: string }> }
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

    const { roleName } = await params

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

    // Fetch existing assignments for comparison and audit log
    const existingAssignments = await prisma.permissionAssignment.findMany({
      where: {
        subjectType: SubjectType.ROLE,
        role: roleName,
        resourceId: { in: resourceIds },
      },
      select: { id: true, resourceId: true, permissionLevel: true, canGrant: true },
    })
    const existingMap = new Map(
      existingAssignments.map((a) => [a.resourceId, a])
    )

    const toCreate: any[] = []
    const toUpdate: { id: string; permissionLevel: PermissionLevel; canGrant: boolean }[] = []
    const auditLogs: any[] = []

    for (const item of assignments) {
      const existing = existingMap.get(item.resourceId)

      if (!existing) {
        // Only create if the level is not NONE or if canGrant is enabled
        if (item.permissionLevel !== 'NONE' || item.canGrant) {
          toCreate.push({
            subjectType: SubjectType.ROLE,
            role: roleName,
            resourceId: item.resourceId,
            permissionLevel: item.permissionLevel,
            canGrant: item.canGrant,
            grantedById: actorUser.id,
          })
          auditLogs.push({
            actorId: actorUser.id,
            targetUserId: `ROLE:${roleName}`,
            resourceId: item.resourceId,
            oldLevel: null,
            newLevel: item.permissionLevel,
            oldCanGrant: null,
            newCanGrant: item.canGrant,
          })
        }
      } else {
        // Check if values have actually changed
        if (
          existing.permissionLevel !== item.permissionLevel ||
          existing.canGrant !== item.canGrant
        ) {
          toUpdate.push({
            id: existing.id,
            permissionLevel: item.permissionLevel,
            canGrant: item.canGrant,
          })
          auditLogs.push({
            actorId: actorUser.id,
            targetUserId: `ROLE:${roleName}`,
            resourceId: item.resourceId,
            oldLevel: existing.permissionLevel,
            newLevel: item.permissionLevel,
            oldCanGrant: existing.canGrant,
            newCanGrant: item.canGrant,
          })
        }
      }
    }

    // Execute operations if changes are detected
    if (toCreate.length > 0 || toUpdate.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          if (toCreate.length > 0) {
            await tx.permissionAssignment.createMany({
              data: toCreate,
            })
          }
          for (const updateItem of toUpdate) {
            await tx.permissionAssignment.update({
              where: { id: updateItem.id },
              data: {
                permissionLevel: updateItem.permissionLevel,
                canGrant: updateItem.canGrant,
                grantedById: actorUser.id,
              },
            })
          }
        },
        { timeout: 30000 }
      )

      // Bulk-insert audit logs for modified records only
      if (auditLogs.length > 0) {
        await prisma.permissionAuditLog.createMany({
          data: auditLogs,
        })
      }
    }

    return successResponse({ count: auditLogs.length })
  } catch (error) {
    console.error('Error batch updating role permissions:', error)
    return errorResponse('Failed to batch update role permissions', 500)
  }
}
