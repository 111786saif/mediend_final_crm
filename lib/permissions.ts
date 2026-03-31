import { prisma } from '@/lib/prisma'
import { getEmployeeByUserId, getMDTeamAndWatchlistUserIds } from '@/lib/hierarchy'
import { FEATURE_KEYS } from '@/lib/feature-keys'

export { FEATURE_KEYS } from '@/lib/feature-keys'
export type { FeatureKey } from '@/lib/feature-keys'

/**
 * Check if user is in MD's task team or watchlist (any MD).
 */
async function isUserInMDTeamOrWatchlist(userId: string): Promise<boolean> {
  const mdUser = await prisma.user.findFirst({
    where: { role: 'MD' },
    select: { id: true },
  })
  if (!mdUser) return false
  const mdTeamIds = await getMDTeamAndWatchlistUserIds(mdUser.id)
  return mdTeamIds.includes(userId)
}

/**
 * Check if a user has a specific feature permission.
 * First checks UserFeaturePermission table for explicit toggle.
 * Falls back to role-based defaults (e.g. MD team members get md_approval_request by default).
 */
export async function hasFeaturePermission(
  userId: string,
  featureKey: string
): Promise<boolean> {
  const explicit = await prisma.userFeaturePermission.findUnique({
    where: { userId_featureKey: { userId, featureKey } },
    select: { enabled: true },
  })
  if (explicit !== null) {
    return explicit.enabled
  }

  // Role-based defaults
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user) return false

  switch (featureKey) {
    case FEATURE_KEYS.MD_APPROVAL_REQUEST:
    case FEATURE_KEYS.CREATE_NOTICE: {
      if (user.role === 'MD' || user.role === 'ADMIN') return true
      return isUserInMDTeamOrWatchlist(userId)
    }
    case FEATURE_KEYS.CREATE_MEET: {
      if (user.role === 'MD' || user.role === 'ADMIN') return true
      const employee = await getEmployeeByUserId(userId)
      return employee?.manager?.user?.role === 'MD'
    }
    case FEATURE_KEYS.CPL_ACCESS: {
      if (user.role === 'ADMIN') return true
      return false
    }
    default:
      return false
  }
}

/**
 * Whether the user may create meets (general module or interview-linked).
 * Explicit IT toggle on `CREATE_MEET` overrides; otherwise MD / Admin or direct report of MD.
 */
export async function canUserCreateMeet(user: { id: string; role: string }): Promise<boolean> {
  return hasFeaturePermission(user.id, FEATURE_KEYS.CREATE_MEET)
}
