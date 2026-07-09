import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  loadApprovedIncentiveTotalsByEmployee,
  parseSalesTeamCostPeriod,
} from '@/lib/sales-team-cost/incentives'

/** Approved incentive totals grouped by employee ID for Sales Team Cost. */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    let period
    try {
      period = parseSalesTeamCostPeriod(
        searchParams.get('month'),
        searchParams.get('year'),
      )
    } catch {
      return errorResponse('Invalid month or year', 400)
    }

    const totalsMap = await loadApprovedIncentiveTotalsByEmployee(period)
    const totals: Record<string, number> = {}
    for (const [employeeId, amount] of totalsMap) {
      totals[employeeId] = amount
    }

    return successResponse({ month: period.month, year: period.year, totals })
  } catch (error) {
    console.error('Error fetching sales team cost incentive totals:', error)
    return errorResponse('Failed to fetch incentive totals', 500)
  }
}
