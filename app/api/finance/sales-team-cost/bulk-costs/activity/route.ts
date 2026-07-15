import { NextRequest } from 'next/server'
import { z } from 'zod'
import { SalesTeamBulkCostType } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { listBulkCostActivity } from '@/lib/sales-team-cost/bulk-cost-entries'

const querySchema = z.object({
  costType: z.enum(['MISC', 'OTHER']),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      costType: searchParams.get('costType'),
      month: searchParams.get('month') ?? undefined,
      year: searchParams.get('year') ?? undefined,
    })
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid filters', 400)
    }

    const period =
      parsed.data.month != null && parsed.data.year != null
        ? { month: parsed.data.month, year: parsed.data.year }
        : undefined

    const activity = await listBulkCostActivity(
      parsed.data.costType as SalesTeamBulkCostType,
      period,
    )

    return successResponse({ activity })
  } catch (error) {
    console.error('Error loading sales team bulk cost activity:', error)
    return errorResponse('Failed to load activity', 500)
  }
}
