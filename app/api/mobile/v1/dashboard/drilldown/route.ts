import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { optionalIntField, requiredStringField } from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppDashboardError, getDoctorDashboardDrilldown } from '@/lib/doctor-app/dashboard'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const drilldownSchema = z.object({
  metric: requiredStringField('Metric'),
  day: optionalIntField('Day', { min: 1, max: 31 }),
  month: optionalIntField('Month', { min: 1, max: 12 }),
  year: optionalIntField('Year', { min: 2000, max: 2100 }),
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
