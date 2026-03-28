import type { SessionUser } from '@/lib/auth'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'
import { canAccessLead } from '@/lib/rbac'

/**
 * Whether the user may perform BD-equivalent mutations on this lead.
 * Uses hierarchy-only subordinate resolution (no sales Team model).
 */
export async function canMutateLead(
  user: SessionUser,
  leadBdId: string,
): Promise<boolean> {
  const subordinateUserIds =
    user.role === 'TEAM_LEAD' ? await getTeamLeadLeadAccessBdUserIds(user.id) : undefined
  return canAccessLead(user, leadBdId, subordinateUserIds)
}
