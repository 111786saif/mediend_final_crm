import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppContextError } from '@/lib/doctor-app/context'
import { DoctorAppPatientError, getDoctorPatientHistory } from '@/lib/doctor-app/patients'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data
    const result = await getDoctorPatientHistory(session, id)

    return successResponse(result, 'Patient history fetched')
  } catch (error) {
    if (error instanceof DoctorAppPatientError) {
      return errorResponse(error.message, error.status)
    }
    if (error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/patients/[id]/history]', error)
    return errorResponse('Internal server error', 500)
  }
}
