import { NextRequest } from 'next/server'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, updateDoctorOpdAppointment } from '@/lib/doctor-app/appointments'

const opdUpdateSchema = z.object({
  opdHospital: z.string().trim().min(1).optional(),
  opdDrName: z.string().trim().min(1).optional(),
  opdContactNo: z.string().trim().min(1).optional(),
  opdCharges: z.coerce.number().int().min(0).optional(),
  opdScheduleDate: z.string().trim().nullable().optional(),
  followUpDate: z.string().trim().nullable().optional(),
  remarks: z.string().trim().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  caseStage: z.nativeEnum(CaseStage).optional(),
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
    const input = opdUpdateSchema.parse(body)
    const result = await updateDoctorOpdAppointment(session, id, input)

    return successResponse(result, 'OPD updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/opd-update]', error)
    return errorResponse('Internal server error', 500)
  }
}
