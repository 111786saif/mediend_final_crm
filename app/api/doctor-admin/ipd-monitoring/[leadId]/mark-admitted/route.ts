import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminMonitoringError, markDoctorAdminIpdAdmitted } from '@/lib/doctor-admin/monitoring'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { leadId } = await params
    const result = await markDoctorAdminIpdAdmitted(leadId, user.id)

    return successResponse(result, 'IPD case marked admitted')
  } catch (error) {
    if (error instanceof DoctorAdminMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/doctor-admin/ipd-monitoring/[leadId]/mark-admitted]', error)
    return errorResponse('Internal server error', 500)
  }
}
