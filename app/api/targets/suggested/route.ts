import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { resolveSuggestedIpdTarget } from '@/lib/targets/ipd-target-rules'

/**
 * GET /api/targets/suggested?userId=<userId>
 *
 * Returns the suggested monthly IPD target for a BD based on tenure / salary slab rules.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) return errorResponse('userId is required', 400)

    const bdUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        employee: {
          select: {
            joinDate: true,
            salary: true,
            salaryStructures: {
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
              select: { monthlyGross: true },
            },
          },
        },
      },
    })

    if (!bdUser) return errorResponse('User not found', 404)

    const result = resolveSuggestedIpdTarget({
      joinDate: bdUser.employee?.joinDate,
      salary: bdUser.employee?.salary,
      monthlyGross: bdUser.employee?.salaryStructures?.[0]?.monthlyGross,
    })

    return successResponse({
      userId: bdUser.id,
      name: bdUser.name,
      ...result,
    })
  } catch (error) {
    console.error('Error fetching suggested target:', error)
    return errorResponse('Failed to fetch suggested target', 500)
  }
}
