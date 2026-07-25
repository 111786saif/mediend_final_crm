import { NextRequest } from 'next/server'
import { UserRole } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSalesTeamUnits } from '@/lib/hierarchy'

/**
 * GET /api/targets/teams
 *
 * Returns TL/ACM team units (and optionally CMs) with BD subordinates.
 * Used by sales head / CM for targets and Case Tracker filters.
 *
 * Query:
 * - includeCm=1 → also returns categoryManagers with recursive scopeUserIds
 *
 * CATEGORY_MANAGER: only TL/ACM units inside their recursive subtree.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    const includeCm = new URL(request.url).searchParams.get('includeCm') === '1'

    const [teams, categoryManagers] = await Promise.all([
      getSalesTeamUnits({ level: 'tl' }),
      getSalesTeamUnits({ level: 'cm' }),
    ])

    let scopedTeams = teams
    if (user.role === UserRole.CATEGORY_MANAGER) {
      const selfCm = categoryManagers.find((c) => c.userId === user.id)
      if (selfCm?.scopeUserIds?.length) {
        const scope = new Set(selfCm.scopeUserIds)
        scopedTeams = teams.filter((t) => scope.has(t.userId))
      } else {
        scopedTeams = []
      }
    }

    const mappedTeams = scopedTeams.map((tl) => ({
      id: tl.id,
      userId: tl.userId,
      name: tl.name,
      profilePicture: tl.profilePicture,
      employeeCode: tl.employeeCode,
      role: tl.role,
      memberCount: tl.memberCount,
      members: tl.members,
      scopeUserIds: tl.scopeUserIds,
    }))

    if (includeCm) {
      return successResponse({
        teams: mappedTeams,
        categoryManagers: categoryManagers.map((cm) => ({
          id: cm.id,
          userId: cm.userId,
          name: cm.name,
          profilePicture: cm.profilePicture,
          employeeCode: cm.employeeCode,
          role: cm.role,
          memberCount: cm.memberCount,
          members: cm.members,
          scopeUserIds: cm.scopeUserIds,
        })),
      })
    }

    // Backward-compatible array response for existing callers
    return successResponse(mappedTeams)
  } catch (error) {
    console.error('Error fetching target teams:', error)
    return errorResponse('Failed to fetch teams', 500)
  }
}
