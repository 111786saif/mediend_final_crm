import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppCabError, getDoctorCabRequestById } from '@/lib/doctor-app/cab-requests'
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
    const result = await getDoctorCabRequestById(session, id)
    return successResponse(result, 'Cab request fetched')
  } catch (error) {
    if (error instanceof DoctorAppCabError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/cab-requests/[id]]', error)
    return errorResponse('Internal server error', 500)
  }
}
