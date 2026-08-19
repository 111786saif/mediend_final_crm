import { prisma } from '@/lib/prisma'
import { PermissionLevel, SubjectType } from '@/generated/prisma/client'
import type { SessionUser } from './auth'
import { hasPermission, type Permission } from './rbac'

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
  resourceKey: string,
  sessionRole?: string
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

    const effectiveRole = sessionRole || user?.role

    if (effectiveRole) {
      const roleAssignment = await prisma.permissionAssignment.findFirst({
        where: {
          subjectType: SubjectType.ROLE,
          role: effectiveRole,
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

      // Check parent resource assignment (e.g. 'actions' for 'actions.reset_step')
      const parts = resourceKey.split('.')
      while (parts.length > 1) {
        parts.pop()
        const parentKey = parts.join('.')
        const parentRes = await prisma.resource.findUnique({
          where: { key: parentKey, isActive: true },
          select: { id: true },
        })
        if (parentRes) {
          const parentAssignment = await prisma.permissionAssignment.findFirst({
            where: {
              subjectType: SubjectType.ROLE,
              role: effectiveRole,
              resourceId: parentRes.id,
            },
            select: { permissionLevel: true, canGrant: true },
          })
          if (parentAssignment && parentAssignment.permissionLevel !== PermissionLevel.NONE) {
            return {
              level: parentAssignment.permissionLevel,
              canGrant: parentAssignment.canGrant,
            }
          }
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

export const PERMISSION_TO_RESOURCE_MAP: Partial<Record<Permission, string>> = {
  // Finance
  'finance:read': 'finance',
  'finance:write': 'finance',
  'finance:payroll:read': 'finance.fin_payroll',
  'finance:payroll:write': 'finance.fin_payroll',
  'finance:approve': 'finance.fin_approvals',
  'finance:masters:write': 'finance.master_seating_cost',

  // HRMS / HRM
  'hrms:read': 'hrm',
  'hrms:write': 'hrm',
  'hrms:attendance:read': 'hrm.attendance_normalizations',
  'hrms:attendance:write': 'hrm.attendance_normalizations',
  'hrms:leaves:read': 'hrm.attendance_normalizations',
  'hrms:leaves:write': 'hrm.attendance_normalizations',
  'hrms:employees:read': 'hrm.people_org',
  'hrms:employees:write': 'hrm.people_org',
  'hrms:recruitment:read': 'hrm.recruitment',
  'hrms:recruitment:write': 'hrm.recruitment',

  // P&L
  'pnl:read': 'main.company_pnl',
  'pnl:write': 'main.company_pnl',
  'it:pnl:read': 'main.it_pnl',
  'it:pnl:write': 'main.it_pnl',
  'sales:pnl:read': 'sales.sales_pnl',
  'loan-demat:read': 'main.loan_demat_revenue',
  'loan-demat:write': 'main.loan_demat_revenue',

  // Insurance & PL
  'insurance:read': 'insurance_pl.insurance',
  'insurance:write': 'insurance_pl.insurance',
  'pl:read': 'insurance_pl.pl_ledger',
  'pl:write': 'insurance_pl.pl_ledger',

  // Incentives
  'incentive:read': 'main.incentive',
  'incentive:write': 'main.incentive',
  'incentive:approve': 'main.incentive',
  'incentive:pay': 'main.incentive',

  // IT & Compliance
  'it:permissions': 'main.it_permissions',
  'compliance:read': 'main.compliance',
  'compliance:write': 'main.compliance',

  // Master Data
  'masters:read': 'main.master_data',
  'masters:write': 'main.master_data',

  // Analytics & Sales
  'analytics:read': 'sales.sales_dashboard',
  'sales:read': 'sales',
  'leads:read': 'sales.case_tracker',
  'leads:write': 'sales.case_tracker',
  'targets:read': 'sales.targets',
  'targets:write': 'sales.targets',

  // Actions
  'actions.reset_step': 'actions.reset_step',
  'main.ipd_calendar': 'main.ipd_calendar',
}

/**
 * Dynamic DB-backed permission check:
 * 1. Checks dynamic Resource/PermissionAssignment in DB via resolvePermission()
 * 2. Falls back to static role-based permissions in rolePermissions[user.role]
 */
export async function hasEffectivePermission(
  user: SessionUser | null,
  permission: Permission,
  resourceKey?: string
): Promise<boolean> {
  if (!user) return false

  const keyToCheck = resourceKey ?? PERMISSION_TO_RESOURCE_MAP[permission]
  if (keyToCheck) {
    const res = await resolvePermission(user.id, keyToCheck)
    if (res.level !== PermissionLevel.NONE) {
      const isWriteRequired = permission.includes(':write') || permission.includes(':approve') || permission.includes(':pay')
      const reqLevel = isWriteRequired ? PermissionLevel.READ_WRITE : PermissionLevel.READ
      return levelSatisfies(res.level, reqLevel)
    }
  }

  return hasPermission(user, permission)
}

/** Outstanding / doctor / hospital list: shared by P&L, Insurance, and Finance modules */
export async function hasEffectivePlOrFinanceRead(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (await hasEffectivePermission(user, 'pl:read', 'insurance_pl.pl_ledger')) return true
  if (await hasEffectivePermission(user, 'finance:read', 'finance')) return true
  if (await hasEffectivePermission(user, 'insurance:read', 'insurance_pl.insurance')) return true
  if (await hasEffectivePermission(user, 'pl:read', 'insurance_pl.doctor_list')) return true
  if (await hasEffectivePermission(user, 'pl:read', 'insurance_pl.hospital_list')) return true
  if (await hasEffectivePermission(user, 'pl:read', 'insurance_pl.pl_outstanding')) return true
  if (await hasEffectivePermission(user, 'finance:read', 'finance.fin_doctor_payoff')) return true
  if (await hasEffectivePermission(user, 'finance:read', 'finance.fin_invoice_requests')) return true
  if (await hasEffectivePermission(user, 'pnl:read', 'main.company_pnl')) return true
  return false
}

export async function hasEffectivePlOrFinanceWrite(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (await hasEffectivePermission(user, 'pl:write', 'insurance_pl.pl_ledger')) return true
  if (await hasEffectivePermission(user, 'finance:write', 'finance')) return true
  if (await hasEffectivePermission(user, 'insurance:write', 'insurance_pl.insurance')) return true
  if (await hasEffectivePermission(user, 'pl:write', 'insurance_pl.doctor_list')) return true
  if (await hasEffectivePermission(user, 'pl:write', 'insurance_pl.hospital_list')) return true
  if (await hasEffectivePermission(user, 'pl:write', 'insurance_pl.pl_outstanding')) return true
  if (await hasEffectivePermission(user, 'finance:write', 'finance.fin_doctor_payoff')) return true
  if (await hasEffectivePermission(user, 'finance:write', 'finance.fin_invoice_requests')) return true
  if (await hasEffectivePermission(user, 'pnl:write', 'main.company_pnl')) return true
  return false
}
