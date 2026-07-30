import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  nullableOptionalStringField,
  optionalIntField,
  optionalStringField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  createDoctorAdminLeave,
  DoctorAdminLeaveError,
  listDoctorAdminLeaves,
} from '@/lib/doctor-admin/leaves'

const listSchema = z.object({
  page: optionalIntField('Page', { min: 1, defaultValue: 1 }),
  limit: optionalIntField('Limit', { min: 1, max: 200, defaultValue: 50 }),
  status: optionalStringField('Status'),
  doctorId: optionalStringField('Doctor ID'),
})

const createSchema = z.object({
  doctorId: requiredStringField('Doctor ID'),
  startDate: requiredStringField('Start date'),
  endDate: requiredStringField('End date'),
  reason: nullableOptionalStringField('Reason'),
})

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listSchema.parse(query)
    const result = await listDoctorAdminLeaves(input)

    return successResponse(result, 'Leave requests fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminLeaveError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/leaves]', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const input = createSchema.parse(body)
    const item = await createDoctorAdminLeave(input)

    return successResponse({ item }, 'Leave request created')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminLeaveError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/doctor-admin/leaves]', error)
    return errorResponse('Internal server error', 500)
  }
}
