import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { optionalIntField, optionalStringField } from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { DoctorAdminCabError, listDoctorAdminCabRequests } from '@/lib/doctor-admin/cab-requests'

const listSchema = z.object({
  page: optionalIntField('Page', { min: 1, defaultValue: 1 }),
  limit: optionalIntField('Limit', { min: 1, max: 200, defaultValue: 50 }),
  status: optionalStringField('Status'),
  doctorId: optionalStringField('Doctor ID'),
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
