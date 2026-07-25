import { UserRole } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { getSubtreeScopeUserIdsForRole, isManagerOf } from '@/lib/hierarchy'
import { SALES_DASHBOARD_ROLES, isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
import { prisma } from '@/lib/prisma'

export function canAccessSalesDashboard(user: SessionUser | null): boolean {
  if (!user) return false
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
  if (!viewerEmp) return false

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

  return false
}
