import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSyncJob } from '@/lib/sync/sync-job-store'

export async function GET(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()
    if (!hasPermission(sessionUser, 'users:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return errorResponse('jobId is required', 400)

    const job = getSyncJob(jobId)
    if (!job) return errorResponse('Sync job not found', 404)

    return successResponse(job)
  } catch (error) {
    console.error('Error fetching sync status:', error)
    return errorResponse('Failed to fetch sync status', 500)
  }
}
