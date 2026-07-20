import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppLeaveError, getDoctorLeaveRequestById } from '@/lib/doctor-app/leaves'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

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
    const result = await getDoctorLeaveRequestById(session, id)
    return successResponse(result, 'Leave fetched')
  } catch (error) {
    if (error instanceof DoctorAppLeaveError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/leaves/[id]]', error)
    return errorResponse('Internal server error', 500)
  }
}
