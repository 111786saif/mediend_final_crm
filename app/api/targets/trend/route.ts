import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TargetMetric } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { calculateActual } from '@/lib/analytics/target-progress'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
} from 'date-fns'

/**
 * GET /api/targets/trend
 *
 * Returns the logged-in user's own (BD-type) target vs actual achievement
 * for the last `count` periods (months or weeks), for charting on the home page.
 * Unlike /api/targets/progress, this does not require a Target row to exist
 * for every period — periods with no assigned target simply show actual
 * achievement with targetValue: 0.
 *
 * Query params:
 *   - periodType: MONTH | WEEK (default MONTH)
 *   - count: number of trailing periods to return (default 6, max 12)
 *   - metric: optional explicit metric (e.g. LEADS_GENERATED) to force actual-value
 *     calculation for every period, regardless of what metric the user's assigned
 *     Target rows use. If omitted, falls back to the user's own target metric.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const periodType = (searchParams.get('periodType') === 'WEEK' ? 'WEEK' : 'MONTH') as 'WEEK' | 'MONTH'
    const count = Math.min(Math.max(Number(searchParams.get('count')) || 6, 1), 12)
    const metricOverride = searchParams.get('metric') || undefined

    const now = new Date()

    // Build the list of trailing period windows, oldest first
    const windows: { start: Date; end: Date; label: string }[] = []
    for (let i = count - 1; i >= 0; i--) {
      if (periodType === 'MONTH') {
        const anchor = subMonths(now, i)
        windows.push({
          start: startOfMonth(anchor),
          end: endOfMonth(anchor),
          label: format(anchor, 'MMM'),
        })
      } else {
        const anchor = subWeeks(now, i)
        const start = startOfWeek(anchor, { weekStartsOn: 1 })
        windows.push({
          start,
          end: endOfWeek(anchor, { weekStartsOn: 1 }),
          label: format(start, 'd MMM'),
        })
      }
    }

    // Fetch this user's personal (BD-type) targets that could overlap any of these windows
    const rangeStart = windows[0].start
    const rangeEnd = windows[windows.length - 1].end

    const targets = await prisma.target.findMany({
      where: {
        targetType: 'BD',
        targetForId: user.id,
        periodType,
        periodStartDate: { lte: rangeEnd },
        periodEndDate: { gte: rangeStart },
        ...(metricOverride ? { metric: metricOverride as TargetMetric } : {}),
      },
      orderBy: { periodStartDate: 'asc' },
    })

    // Fallback metric (for periods with no Target row yet) is either the explicit
    // override, or whichever metric this user's targets use, defaulting to IPD_DONE.
    const fallbackMetric = metricOverride ?? targets[0]?.metric ?? 'IPD_DONE'

    const points = await Promise.all(
      windows.map(async (w) => {
        // Pick the target row that overlaps this window most (usually exact match)
        const match = targets.find(
          (t) => t.periodStartDate.getTime() <= w.end.getTime() && t.periodEndDate.getTime() >= w.start.getTime()
        )
        const metric = metricOverride ?? match?.metric ?? fallbackMetric
        const actual = await calculateActual(user.id, metric, w.start, w.end)
        const targetValue = match?.targetValue ?? 0
        const percentage = targetValue > 0 ? Math.round((actual / targetValue) * 100) : 0

        return {
          label: w.label,
          periodStartDate: w.start.toISOString(),
          periodEndDate: w.end.toISOString(),
          metric,
          actual,
          targetValue,
          percentage,
          hasTarget: !!match,
        }
      })
    )

    return successResponse({ periodType, metric: fallbackMetric, points })
  } catch (error) {
    console.error('Error fetching target trend:', error)
    return errorResponse('Failed to fetch target trend', 500)
  }
}