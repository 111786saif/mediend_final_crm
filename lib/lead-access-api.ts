import type { SessionUser } from '@/lib/auth'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'
import { canAccessLead } from '@/lib/rbac'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

/**
 * Whether the user may perform BD-equivalent mutations on this lead.
 * Uses hierarchy-only subordinate resolution (no sales Team model).
 * TL, ACM, and CM get recursive subordinate access.
 */
export async function canMutateLead(
  user: SessionUser,
  leadBdId: string,
): Promise<boolean> {
  const subordinateUserIds = isSubtreeScopedSalesRole(user.role)
    ? await getTeamLeadLeadAccessBdUserIds(user.id)
    : undefined
  return canAccessLead(user, leadBdId, subordinateUserIds)
}

/** Load subordinate user IDs for canAccessLead when role is TL/ACM/CM. */
export async function getLeadAccessSubordinateIds(
  user: SessionUser
): Promise<string[] | undefined> {
  if (!isSubtreeScopedSalesRole(user.role)) return undefined
  return getTeamLeadLeadAccessBdUserIds(user.id)
}
