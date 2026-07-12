import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TargetMetric } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { calculateActual } from '@/lib/analytics/target-progress'
import { startOfMonth, endOfMonth } from 'date-fns'

const SALES_ROLES = ['BD', 'TEAM_LEAD', 'SALES_HEAD']

/**
 * GET /api/levels/my-level?metric=IPD_DONE
 *
 * Resolves the logged-in user's current tier for this calendar month by
 * comparing their actual achievement against the configured TierDefinition
 * ladder. Returns the current tier (if any met), the next tier to aim for,
 * and how much more is needed to reach it. Sales/BD hierarchy only.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)
    if (!SALES_ROLES.includes(user.role)) return successResponse(null)

    const { searchParams } = new URL(request.url)
    const metric = (searchParams.get('metric') as TargetMetric) || 'IPD_DONE'

    const tiers = await prisma.tierDefinition.findMany({
      where: { metric },
      orderBy: { order: 'asc' },
    })

    if (tiers.length === 0) return successResponse(null)

    const now = new Date()
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    const actual = await calculateActual(user.id, metric, start, end)

    // Highest tier whose threshold is met, walking from the top down
    const sortedDesc = [...tiers].sort((a, b) => b.order - a.order)
    const currentTier = sortedDesc.find((t) => actual >= t.thresholdValue) ?? null

    // Next tier above the current one (lowest threshold greater than actual)
    const nextTier =
      [...tiers]
        .filter((t) => t.thresholdValue > actual)
        .sort((a, b) => a.thresholdValue - b.thresholdValue)[0] ?? null

    return successResponse({
      metric,
      actual,
      currentTier,
      nextTier,
      remainingToNext: nextTier ? Math.max(0, nextTier.thresholdValue - actual) : 0,
      ladder: tiers,
    })
  } catch (error) {
    console.error('Error resolving current level:', error)
    return errorResponse('Failed to resolve level', 500)
  }
}