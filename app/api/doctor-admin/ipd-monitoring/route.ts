import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminMonitoringError, getDoctorAdminIpdMonitoring } from '@/lib/doctor-admin/monitoring'

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const result = await getDoctorAdminIpdMonitoring()
    return successResponse(result, 'IPD monitoring fetched')
  } catch (error) {
    if (error instanceof DoctorAdminMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/ipd-monitoring]', error)
    return errorResponse('Internal server error', 500)
  }
}
