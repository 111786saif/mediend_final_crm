import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, getDoctorAppointmentById } from '@/lib/doctor-app/appointments'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const result = await getDoctorAppointmentById(session, id)

    return successResponse(result, 'Appointment fetched')
  } catch (error) {
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/appointments/[id]]', error)
    return errorResponse('Internal server error', 500)
  }
}
