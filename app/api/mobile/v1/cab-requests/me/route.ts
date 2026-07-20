import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppCabError, listDoctorCabRequests } from '@/lib/doctor-app/cab-requests'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const listCabRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listCabRequestsSchema.parse(query)
    const result = await listDoctorCabRequests(session, input.page, input.limit, input.status)

    return successResponse(result, 'Cab history fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppCabError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/cab-requests/me]', error)
    return errorResponse('Internal server error', 500)
  }
}
