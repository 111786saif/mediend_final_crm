import type { SessionUser } from '@/lib/auth'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { canAccessLead } from '@/lib/rbac'

/**
 * Whether the user may perform BD-equivalent mutations on this lead (same rules as GET /api/leads/[id]).
 * Use after loading `lead.bdId` and the assigned BD's `teamId` (for legacy team matching).
 */
export async function canMutateLead(
  user: SessionUser,
  leadBdId: string,
  leadBdTeamId: string | null | undefined
): Promise<boolean> {
  const subordinateUserIds =
    user.role === 'TEAM_LEAD' ? await getSubordinateUserIdsForLeadAccess(user.id) : undefined
  return canAccessLead(user, leadBdId, leadBdTeamId ?? undefined, subordinateUserIds)
}
