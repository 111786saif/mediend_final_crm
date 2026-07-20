import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppProfileError, uploadDoctorMyPhoto } from '@/lib/doctor-app/profile'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

export async function POST(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

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

    const result = await uploadDoctorMyPhoto(session, file)
    return successResponse(result, 'Doctor photo uploaded')
  } catch (error) {
    if (error instanceof DoctorAppProfileError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/mobile/v1/doctors/me/photo]', error)
    return errorResponse('Internal server error', 500)
  }
}
