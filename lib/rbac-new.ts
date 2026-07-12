import { prisma } from '@/lib/prisma'
import { PermissionLevel, SubjectType } from '@/generated/prisma/client'

const PERMISSION_RANKS: Record<PermissionLevel, number> = {
  NONE: 0,
  READ: 1,
  READ_WRITE: 2,
  READ_WRITE_DELETE: 3,
  FULL_ACCESS: 4,
}

/**
 * Checks if a user's permission level is greater than or equal to a required level.
 */
export function levelSatisfies(level: PermissionLevel, required: PermissionLevel): boolean {
  return PERMISSION_RANKS[level] >= PERMISSION_RANKS[required]
}

/**
 * Resolves the effective permission level and grant rights for a user on a given resource key.
 * 
 * Rules of resolution:
 * 1. If explicit user-level override exists (even NONE), that level is returned.
 * 2. If no user-level override exists, check if any sub-resource is allowed to propagate parent access.
 * 3. Fallback to database role-level assignments.
 * 4. Default fallback is NONE.
 */
export async function resolvePermission(
  userId: string,
  resourceKey: string
): Promise<{ level: PermissionLevel; canGrant: boolean }> {
  if (process.env.DISABLE_RBAC_LIMITS === 'true') {
    return { level: PermissionLevel.FULL_ACCESS, canGrant: true }
  }

  try {
    const resource = await prisma.resource.findUnique({
      where: { key: resourceKey, isActive: true },
      select: { id: true },
    })

    if (!resource) {
      return { level: PermissionLevel.NONE, canGrant: false }
    }

    // 1. User-level override check
    const userAssignment = await prisma.permissionAssignment.findUnique({
      where: {
        userId_resourceId: {
          userId,
          resourceId: resource.id,
        },
      },
      select: { permissionLevel: true, canGrant: true },
    })

    if (userAssignment) {
      return {
        level: userAssignment.permissionLevel,
        canGrant: userAssignment.canGrant,
      }
    }

    // 1b. Check if the user has any active user-level overrides for children of this resource
    const childAssignments = await prisma.permissionAssignment.findMany({
      where: {
        userId,
        resource: {
          key: {
            startsWith: resourceKey + '.',
          },
        },
        permissionLevel: {
          not: PermissionLevel.NONE,
        },
      },
      select: { permissionLevel: true, canGrant: true },
    })

    if (childAssignments.length > 0) {
      return {
        level: PermissionLevel.FULL_ACCESS,
        canGrant: childAssignments.some(c => c.canGrant),
      }
    }

    // 2. Role-level assignment check (database fallback)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (user?.role) {
      const roleAssignment = await prisma.permissionAssignment.findFirst({
        where: {
          subjectType: SubjectType.ROLE,
          role: user.role,
          resourceId: resource.id,
        },
        select: { permissionLevel: true, canGrant: true },
      })

      if (roleAssignment) {
        return {
          level: roleAssignment.permissionLevel,
          canGrant: roleAssignment.canGrant,
        }
      }
    }

    return { level: PermissionLevel.NONE, canGrant: false }
  } catch (error) {
    console.error('Error resolving permission:', error)
    return { level: PermissionLevel.NONE, canGrant: false }
  }
}

/**
 * Walks the employee reporting hierarchy using a recursive CTE to find all subordinates.
 * Reuses Employee managerId self-reference relations.
 */
export async function getSubordinateEmployeeIds(managerEmployeeId: string): Promise<string[]> {
  try {
    // Recursive CTE query on PostgreSQL Employee table.
    // Double quotes are required for case-sensitive PostgreSQL table and column names in Prisma.
    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE subordinates AS (
        SELECT id FROM "Employee" WHERE "managerId" = ${managerEmployeeId}
        UNION ALL
        SELECT e.id FROM "Employee" e
        JOIN subordinates s ON e."managerId" = s.id
      )
      SELECT id FROM subordinates;
    `
    return result.map((row) => row.id)
  } catch (error) {
    console.error('Error fetching subordinates CTE:', error)
    return []
  }
}

/**
 * Loads active permission assignments for a user scoped to a specific database table's columns.
 * Example target: 'lead' will only resolve keys starting with 'database.lead.column.'
 */
export async function loadScopedPermissionMap(
  userId: string,
  tableName: string
): Promise<Record<string, PermissionLevel>> {
  const matchPattern = `.table.${tableName}.column.`

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    const assignments = await prisma.permissionAssignment.findMany({
      where: {
        resource: {
          key: { contains: matchPattern },
          isActive: true
        },
        OR: [
          { userId },
          { AND: [{ subjectType: SubjectType.ROLE }, { role: user?.role }] }
        ]
      },
      include: { resource: { select: { key: true } } }
    })

    const map: Record<string, PermissionLevel> = {}
    for (const a of assignments) {
      const parts = a.resource.key.split(matchPattern)
      const columnName = parts[parts.length - 1]
      
      // User-level overrides take precedence over Role-level assignments
      if (!map[columnName] || a.userId === userId) {
        map[columnName] = a.permissionLevel
      }
    }
    return map
  } catch (error) {
    console.error('Error loading scoped permission map:', error)
    return {}
  }
}
