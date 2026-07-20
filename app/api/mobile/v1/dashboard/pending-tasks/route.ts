import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppDashboardError, getDoctorPendingTasksSummary } from '@/lib/doctor-app/dashboard'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const result = await getDoctorPendingTasksSummary(session)
    return successResponse(result, 'Pending tasks summary fetched')
  } catch (error) {
    if (error instanceof DoctorAppDashboardError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/dashboard/pending-tasks]', error)
    return errorResponse('Internal server error', 500)
  }
}
