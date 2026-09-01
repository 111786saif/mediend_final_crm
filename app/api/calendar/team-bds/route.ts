import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { getEmployeeByUserId, resolveLeafBdUserIds } from '@/lib/hierarchy'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const TEAM_SCOPE_ROLES = new Set([
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
  'EXECUTIVE_ASSISTANT',
  'MD',
  'ADMIN',
  'SUPER_ADMIN',
])

export type TeamBdOption = {
  id: string
  name: string
  profilePicture: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Use the DB-fresh role, not the JWT's — the JWT role goes stale as
    // soon as an admin changes someone's role without them re-logging in,
    // which caused this route to 401/empty-out out of sync with the
    // frontend's `useAuth()` (which does read the fresh role via /api/auth/me).
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    // TESTER/ADMIN/MD accounts can "view as" another role client-side (see
    // useAuth's activeRole). Honor that simulated role here too — same
    // pattern as /api/me/permissions — otherwise this route always resolves
    // against the real (e.g. TESTER) role and returns an empty team even
    // while the rest of the UI is previewing as a manager role.
    const roleParam = request.nextUrl.searchParams.get('role')
    const hasRoleOverride = !!roleParam && (user.role === 'TESTER' || user.role === 'ADMIN' || user.role === 'MD')
    const effectiveRole = hasRoleOverride ? roleParam : user.role

    if (!TEAM_SCOPE_ROLES.has(effectiveRole)) {
      return successResponse<TeamBdOption[]>([])
    }

    if (['EXECUTIVE_ASSISTANT', 'MD', 'ADMIN', 'SUPER_ADMIN'].includes(effectiveRole)) {
      const allBds = await prisma.user.findMany({
        where: { role: 'BD' },
        select: {
          id: true,
          name: true,
          profilePicture: true,
        },
        orderBy: { name: 'asc' },
      })
      return successResponse(allBds)
    }

    // In simulation mode there's no real Employee/hierarchy record tied to
    // the fake role, so fall back to an arbitrary employee holding that role
    // — good enough for previewing the filter UI. Real (non-simulated) users
    // use their own employee record as before.
    const employee = hasRoleOverride
      ? await prisma.employee.findFirst({
          where: { user: { role: effectiveRole as UserRole } },
          select: { id: true },
        })
      : await getEmployeeByUserId(user.id)
    if (!employee) {
      return successResponse<TeamBdOption[]>([])
    }

    const { bdMembers } = await resolveLeafBdUserIds(employee.id)

    const payload: TeamBdOption[] = bdMembers.map((m) => ({
      id: m.userId,
      name: m.name,
      profilePicture: m.profilePicture,
    }))

    return successResponse(payload)
  } catch (error) {
    console.error('Error fetching team BDs:', error)
    return errorResponse('Failed to fetch team BDs', 500)
  }
}