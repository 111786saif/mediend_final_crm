import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import {
  createDoctorLeaveRequest,
  DoctorAppLeaveError,
  listDoctorLeaveRequests,
} from '@/lib/doctor-app/leaves'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const createLeaveSchema = z.object({
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  reason: z.string().trim().nullable().optional(),
})

const listLeavesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional(),
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
