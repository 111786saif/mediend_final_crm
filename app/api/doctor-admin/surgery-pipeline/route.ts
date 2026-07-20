import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminMonitoringError, getDoctorAdminSurgeryPipeline } from '@/lib/doctor-admin/monitoring'

const querySchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = querySchema.parse(query)
    const result = await getDoctorAdminSurgeryPipeline(input)

    return successResponse(result, 'Surgery pipeline fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/surgery-pipeline]', error)
    return errorResponse('Internal server error', 500)
  }
}
