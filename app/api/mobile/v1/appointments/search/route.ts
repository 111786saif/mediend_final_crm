import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, searchDoctorAppointments } from '@/lib/doctor-app/appointments'

const searchAppointmentsSchema = z.object({
  q: z.string().trim().min(2),
  type: z.enum(['all', 'opd', 'ipd']).optional().default('all'),
  status: z.string().trim().optional(),
  date: z.string().trim().optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = searchAppointmentsSchema.parse(query)
    const result = await searchDoctorAppointments(session, input)

    return successResponse(result, 'Search completed')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/appointments/search]', error)
    return errorResponse('Internal server error', 500)
  }
}
