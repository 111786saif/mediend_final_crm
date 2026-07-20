import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminCabError, reviewDoctorAdminCabRequest } from '@/lib/doctor-admin/cab-requests'

const reviewSchema = z.object({
  status: z.string().trim().min(1),
  reviewNotes: z.string().trim().optional().nullable(),
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
    const item = await reviewDoctorAdminCabRequest(id, user.id, input)

    return successResponse({ item }, 'Cab request reviewed')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminCabError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/doctor-admin/cab-requests/[id]/review]', error)
    return errorResponse('Internal server error', 500)
  }
}
