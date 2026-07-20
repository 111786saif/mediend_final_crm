import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminCabError, listDoctorAdminCabRequests } from '@/lib/doctor-admin/cab-requests'

const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.string().trim().optional(),
  doctorId: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listSchema.parse(query)
    const result = await listDoctorAdminCabRequests(input)

    return successResponse(result, 'Cab requests fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminCabError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/cab-requests]', error)
    return errorResponse('Internal server error', 500)
  }
}
