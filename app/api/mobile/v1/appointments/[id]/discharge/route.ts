import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { nullableOptionalStringField } from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { dischargeDoctorAppointment, DoctorAppApiError } from '@/lib/doctor-app/appointments'

const dischargeSchema = z.object({
  dischargeDate: nullableOptionalStringField('Discharge date'),
  doctorRemarks: nullableOptionalStringField('Doctor remarks'),
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
    const input = dischargeSchema.parse(body)
    const result = await dischargeDoctorAppointment(session, id, input)

    return successResponse(result, 'IPD discharged')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/discharge]', error)
    return errorResponse('Internal server error', 500)
  }
}
