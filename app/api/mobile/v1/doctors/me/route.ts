import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import {
  DoctorAppProfileError,
  getDoctorMyProfile,
  updateDoctorMyProfile,
} from '@/lib/doctor-app/profile'

const updateDoctorProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    phoneNumber: z.string().trim().max(20).nullable().optional(),
    category: z.string().trim().max(100).nullable().optional(),
    treatment: z.string().trim().max(200).nullable().optional(),
    specialty: z.string().trim().max(200).nullable().optional(),
    age: z.coerce.number().int().min(0).max(120).nullable().optional(),
    sex: z.string().trim().max(50).nullable().optional(),
    gender: z.string().trim().max(50).nullable().optional(),
    aadhaarNumber: z.string().trim().max(20).nullable().optional(),
    panNumber: z.string().trim().max(20).nullable().optional(),
    experienceYears: z.coerce.number().int().min(0).max(80).nullable().optional(),
    experienceNotes: z.string().trim().max(5000).nullable().optional(),
    feeStructure: z.string().trim().max(5000).nullable().optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const result = await getDoctorMyProfile(session)
    return successResponse(result, 'Doctor profile fetched')
  } catch (error) {
    if (error instanceof DoctorAppProfileError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/doctors/me]', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const input = updateDoctorProfileSchema.parse(body)
    const result = await updateDoctorMyProfile(session, input)

    return successResponse(result, 'Doctor profile updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppProfileError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PATCH /api/mobile/v1/doctors/me]', error)
    return errorResponse('Internal server error', 500)
  }
}
