import { UserRole } from '@/generated/prisma/enums'

/** Team-unit managers: Team Lead and ACM (ACM is functionally identical to TL). */
export const TEAM_UNIT_ROLES: UserRole[] = [
  UserRole.TEAM_LEAD,
  UserRole.ASSISTANT_CATEGORY_MANAGER,
]

/** Category Manager mid-layer between Sales Head and TL/ACM. */
export const CATEGORY_MANAGER_ROLES: UserRole[] = [UserRole.CATEGORY_MANAGER]

/** Roles that auto-scope analytics to their recursive subtree (self + descendants). */
export const SUBTREE_SCOPED_SALES_ROLES: UserRole[] = [
  UserRole.TEAM_LEAD,
  UserRole.ASSISTANT_CATEGORY_MANAGER,
  UserRole.CATEGORY_MANAGER,
]

/** Roles allowed to view org/subtree sales dashboards and IPD analytics. */
export const SALES_DASHBOARD_ROLES: UserRole[] = [
  UserRole.MD,
  UserRole.ADMIN,
  UserRole.SALES_HEAD,
  UserRole.EXECUTIVE_ASSISTANT,
  UserRole.TEAM_LEAD,
  UserRole.ASSISTANT_CATEGORY_MANAGER,
  UserRole.CATEGORY_MANAGER,
  UserRole.DIGITAL_MARKETING_HEAD,
]

export function isTeamUnitRole(role: UserRole | string): boolean {
  return role === UserRole.TEAM_LEAD || role === UserRole.ASSISTANT_CATEGORY_MANAGER
}

export function isCategoryManagerRole(role: UserRole | string): boolean {
  return role === UserRole.CATEGORY_MANAGER
}

export function isSubtreeScopedSalesRole(role: UserRole | string): boolean {
  return (
    role === UserRole.TEAM_LEAD ||
    role === UserRole.ASSISTANT_CATEGORY_MANAGER ||
    role === UserRole.CATEGORY_MANAGER
  )
}

/** True when role behaves like Team Lead for product surfaces (ACM === TL). */
export function isTeamLeadEquivalent(role: UserRole | string): boolean {
  return isTeamUnitRole(role)
}

/**
 * Roles that can perform BD/TL case-ops actions on leads they can access
 * (raise preauth, initiate, mark IPD, edit KYP, etc.).
 * Includes CM (mid-layer) and ACM (TL-equivalent). ADMIN always included by callers separately if needed.
 */
export function isSalesLeadWorkerRole(role: UserRole | string): boolean {
  return (
    role === UserRole.BD ||
    role === UserRole.TEAM_LEAD ||
    role === UserRole.ASSISTANT_CATEGORY_MANAGER ||
    role === UserRole.CATEGORY_MANAGER
  )
}
