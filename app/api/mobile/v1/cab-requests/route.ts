import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import {
  createDoctorCabRequest,
  DoctorAppCabError,
  listDoctorCabRequests,
} from '@/lib/doctor-app/cab-requests'
import { DoctorAppContextError } from '@/lib/doctor-app/context'

const createCabRequestSchema = z.object({
  pickup: z.string().trim().min(1),
  drop: z.string().trim().min(1),
  pickupLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  pickupLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  dropLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  dropLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  scheduledFor: z.string().trim().min(1),
})

const listCabRequestsSchema = z.object({
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
    const input = createCabRequestSchema.parse(body)
    const result = await createDoctorCabRequest(session, input)

    return successResponse(result, 'Cab requested')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppCabError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/mobile/v1/cab-requests]', error)
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
    const input = listCabRequestsSchema.parse(query)
    const result = await listDoctorCabRequests(session, input.page, input.limit, input.status)

    return successResponse(result, 'Cab history fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppCabError || error instanceof DoctorAppContextError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/cab-requests]', error)
    return errorResponse('Internal server error', 500)
  }
}
