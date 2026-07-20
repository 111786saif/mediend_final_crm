import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { cancelDoctorAdminIpdCase, DoctorAdminMonitoringError } from '@/lib/doctor-admin/monitoring'

const bodySchema = z.object({
  reason: z.string().trim().optional().nullable(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { leadId } = await params
    const body = await request.json()
    const input = bodySchema.parse(body)
    const result = await cancelDoctorAdminIpdCase(leadId, user.id, input)

    return successResponse(result, 'IPD case cancelled')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/doctor-admin/ipd-monitoring/[leadId]/cancel]', error)
    return errorResponse('Internal server error', 500)
  }
}
