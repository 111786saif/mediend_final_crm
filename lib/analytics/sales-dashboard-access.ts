import { UserRole, PermissionLevel } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { getSubtreeScopeUserIdsForRole, isManagerOf } from '@/lib/hierarchy'
import { SALES_DASHBOARD_ROLES, isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
import { prisma } from '@/lib/prisma'
import { resolvePermission, levelSatisfies } from '@/lib/rbac-new'

export async function canAccessSalesDashboard(user: SessionUser | null): Promise<boolean> {
  if (!user) return false

  // 1. Dynamic individual/role assignment check from DB
  const salesDashboardPerm = await resolvePermission(user.id, 'sales.sales_dashboard')
  if (levelSatisfies(salesDashboardPerm.level, PermissionLevel.READ)) {
    return true
  }

  const mdSalesPerm = await resolvePermission(user.id, 'sales.md_sales_dashboard')
  if (levelSatisfies(mdSalesPerm.level, PermissionLevel.READ)) {
    return true
  }

  const parentSalesPerm = await resolvePermission(user.id, 'sales')
  if (levelSatisfies(parentSalesPerm.level, PermissionLevel.READ)) {
    return true
  }

  // 2. Built-in Role Fallback
  return (SALES_DASHBOARD_ROLES as string[]).includes(user.role)
}

/**
 * For TL/ACM/CM: return bdId filter (self + recursive subordinates).
 * For org-wide roles: return undefined (no filter).
 */
export async function getSalesDashboardBdIdFilter(
  user: SessionUser
): Promise<string[] | undefined> {
  if (!isSubtreeScopedSalesRole(user.role)) return undefined
  const scope = await getSubtreeScopeUserIdsForRole(user.id, user.role)
  return scope ?? [user.id]
}

/**
 * Gate team-detail / manager drill-down:
 * - Org roles: any manager
 * - TL/ACM: only their own employee id
 * - CM: own id OR a manager in their subtree
 */
export async function canViewManagerTeamDetail(
  user: SessionUser,
  managerEmployeeId: string
): Promise<boolean> {
  if (
    user.role === UserRole.MD ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.SALES_HEAD ||
    user.role === UserRole.EXECUTIVE_ASSISTANT ||
    user.role === UserRole.DIGITAL_MARKETING_HEAD
  ) {
    return true
  }

  const viewerEmp = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })

  // If the user has explicit DB permission on sales_dashboard and is not in sales hierarchy, allow viewing
  if (!viewerEmp) {
    const perm = await resolvePermission(user.id, 'sales.sales_dashboard')
    if (levelSatisfies(perm.level, PermissionLevel.READ)) return true
    const parentPerm = await resolvePermission(user.id, 'sales')
    if (levelSatisfies(parentPerm.level, PermissionLevel.READ)) return true
    return false
  }

  if (
    user.role === UserRole.TEAM_LEAD ||
    user.role === UserRole.ASSISTANT_CATEGORY_MANAGER
  ) {
    return viewerEmp.id === managerEmployeeId
  }

  if (user.role === UserRole.CATEGORY_MANAGER) {
    if (viewerEmp.id === managerEmployeeId) return true
    return isManagerOf(viewerEmp.id, managerEmployeeId)
  }

  // If user has explicit DB permission, grant view
  const explicitPerm = await resolvePermission(user.id, 'sales.sales_dashboard')
  if (levelSatisfies(explicitPerm.level, PermissionLevel.READ)) return true

  return false
}
