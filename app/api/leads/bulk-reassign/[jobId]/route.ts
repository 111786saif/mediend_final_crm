import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getBulkLeadReassignRun } from '@/lib/lead-bulk-reassign/server'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { jobId } = await params
    const run = await getBulkLeadReassignRun(jobId)

    if (!run) {
      return errorResponse('Bulk reassignment job not found', 404)
    }

    return successResponse(run)
  } catch (error) {
    console.error('GET /api/leads/bulk-reassign/[jobId]', error)
    return errorResponse('Failed to fetch bulk reassignment job', 500)
  }
}
