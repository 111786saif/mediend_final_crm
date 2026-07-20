import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppDashboardError, getDoctorDashboardDrilldown } from '@/lib/doctor-app/dashboard'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const drilldownSchema = z.object({
  metric: z.string().trim().min(1),
  day: z.coerce.number().int().min(1).max(31).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = drilldownSchema.parse(query)
    const result = await getDoctorDashboardDrilldown(session, input.metric, input)

    return successResponse(result, 'Dashboard drilldown fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppDashboardError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/dashboard/drilldown]', error)
    return errorResponse('Internal server error', 500)
  }
}
