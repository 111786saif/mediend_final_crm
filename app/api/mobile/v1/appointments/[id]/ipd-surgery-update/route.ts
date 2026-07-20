import { NextRequest } from 'next/server'
import { z } from 'zod'
import { IpdStatus } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, updateDoctorIpdAppointment } from '@/lib/doctor-app/appointments'

const ipdSurgeryUpdateSchema = z.object({
  ipdAdmissionDate: z.string().trim().nullable().optional(),
  admissionTime: z.string().trim().nullable().optional(),
  ipdHospital: z.string().trim().min(1).optional(),
  ipdDrName: z.string().trim().min(1).optional(),
  ipdContactNo: z.string().trim().min(1).optional(),
  surgeryDate: z.string().trim().nullable().optional(),
  operationTime: z.string().trim().nullable().optional(),
  hospitalAddress: z.string().trim().nullable().optional(),
  googleMapLocation: z.string().trim().nullable().optional(),
  tpa: z.string().trim().nullable().optional(),
  instrument: z.string().trim().nullable().optional(),
  implantConsumables: z.string().trim().nullable().optional(),
  ipdStatus: z.nativeEnum(IpdStatus).nullable().optional(),
  ipdStatusReason: z.string().trim().nullable().optional(),
  newSurgeryDate: z.string().trim().nullable().optional(),
  ipdDischargeDate: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
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
    const input = ipdSurgeryUpdateSchema.parse(body)
    const result = await updateDoctorIpdAppointment(session, id, input)

    return successResponse(result, 'IPD surgery updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/ipd-surgery-update]', error)
    return errorResponse('Internal server error', 500)
  }
}
