import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  zodErrorResponse,
} from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError } from '@/lib/doctor-app/appointments'
import {
  DoctorAdminMasterError,
  isDoctorAdminMasterType,
  listDoctorAdminMasters,
} from '@/lib/doctor-admin/masters'

const listSchema = z.object({
  search: z.string().optional().default(''),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { type } = await params
    if (!isDoctorAdminMasterType(type)) {
      throw new DoctorAppApiError('Unknown master type', 404)
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listSchema.parse(query)
    const items = await listDoctorAdminMasters(type, input.search, input.includeInactive)

    return successResponse(
      {
        doctor: {
          id: session.doctorId,
          email: session.email,
          name: session.name,
        },
        type,
        items,
      },
      'Master records fetched'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }
    if (error instanceof DoctorAdminMasterError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/masters/[type]]', error)
    return errorResponse('Internal server error', 500)
  }
}
