import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  nullableOptionalStringField,
  optionalIntField,
  optionalStringField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import {
  createDoctorLeaveRequest,
  DoctorAppLeaveError,
  listDoctorLeaveRequests,
} from '@/lib/doctor-app/leaves'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const createLeaveSchema = z.object({
  startDate: requiredStringField('Start date'),
  endDate: requiredStringField('End date'),
  reason: nullableOptionalStringField('Reason'),
})

const listLeavesSchema = z.object({
  page: optionalIntField('Page', { min: 1, defaultValue: 1 }),
  limit: optionalIntField('Limit', { min: 1, max: 100, defaultValue: 20 }),
  status: optionalStringField('Status'),
})

export async function POST(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const input = createLeaveSchema.parse(body)
    const result = await createDoctorLeaveRequest(session, input)

    return successResponse(result, 'Leave submitted')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppLeaveError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/mobile/v1/leaves]', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listLeavesSchema.parse(query)
    const result = await listDoctorLeaveRequests(session, input.page, input.limit, input.status)

    return successResponse(result, 'Leaves fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppLeaveError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/leaves]', error)
    return errorResponse('Internal server error', 500)
  }
}
