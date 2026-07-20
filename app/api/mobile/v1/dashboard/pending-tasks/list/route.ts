import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppDashboardError, getDoctorPendingTasksList } from '@/lib/doctor-app/dashboard'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const result = await getDoctorPendingTasksList(session)
    return successResponse(result, 'Pending tasks list fetched')
  } catch (error) {
    if (error instanceof DoctorAppDashboardError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/dashboard/pending-tasks/list]', error)
    return errorResponse('Internal server error', 500)
  }
}
