import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapSeatingMiscHistoryEntry } from '@/lib/finance/seating-misc-cost/mapper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const history = await prisma.employeeMonthlySeatingMiscCostHistory.findMany({
      where: { recordId: id },
      orderBy: { changedAt: 'desc' },
      include: { changedBy: { select: { name: true } } },
    })

    return successResponse({ history: history.map(mapSeatingMiscHistoryEntry) })
  } catch (error) {
    console.error('Error fetching seating & misc cost history:', error)
    return errorResponse('Failed to fetch history', 500)
  }
}
