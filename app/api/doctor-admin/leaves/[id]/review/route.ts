import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { nullableOptionalStringField, requiredStringField } from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminLeaveError, reviewDoctorAdminLeave } from '@/lib/doctor-admin/leaves'

const reviewSchema = z.object({
  status: requiredStringField('Status'),
  reviewNotes: nullableOptionalStringField('Review notes'),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const body = await request.json()
    const input = reviewSchema.parse(body)
    const item = await reviewDoctorAdminLeave(id, user.id, input)

    return successResponse({ item }, 'Leave request reviewed')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminLeaveError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/doctor-admin/leaves/[id]/review]', error)
    return errorResponse('Internal server error', 500)
  }
}
