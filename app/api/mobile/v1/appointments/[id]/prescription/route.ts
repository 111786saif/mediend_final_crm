import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, uploadDoctorAppointmentPrescription } from '@/lib/doctor-app/appointments'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('No file provided', 400)
    }

    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      return errorResponse(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413
      )
    }

    const result = await uploadDoctorAppointmentPrescription(session, id, file)

    return successResponse(result, 'Prescription uploaded')
  } catch (error) {
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/mobile/v1/appointments/[id]/prescription]', error)
    return errorResponse('Internal server error', 500)
  }
}
