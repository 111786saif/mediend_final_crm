import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { nullableOptionalStringField } from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { cancelDoctorOpdAppointment, DoctorAppApiError } from '@/lib/doctor-app/appointments'

const opdCancelSchema = z.object({
  remarks: nullableOptionalStringField('Remarks'),
  followUpDate: nullableOptionalStringField('Follow-up date'),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const body = await request.json()
    const input = opdCancelSchema.parse(body)
    const result = await cancelDoctorOpdAppointment(session, id, input)

    return successResponse(result, 'OPD cancelled')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/opd-cancel]', error)
    return errorResponse('Internal server error', 500)
  }
}
