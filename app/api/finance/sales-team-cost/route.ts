import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildSalesTeamCostHierarchy } from '@/lib/sales-team-cost/hierarchy'
import { parseSalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'

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

    const data = await buildSalesTeamCostHierarchy(period)
    return successResponse(data)
  } catch (error) {
    console.error('Error fetching sales team cost hierarchy:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return errorResponse(
      errMsg.includes('otherCost') || errMsg.includes('Unknown field')
        ? 'Sales Team Cost schema out of sync. Restart the dev server after prisma generate.'
        : `Failed to fetch sales team cost data: ${errMsg}`,
      500,
    )
  }
}
