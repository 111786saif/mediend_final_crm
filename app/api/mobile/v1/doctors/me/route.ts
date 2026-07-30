import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  emailField,
  nullableOptionalStringField,
  optionalIntField,
  phoneField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import {
  DoctorAppProfileError,
  getDoctorMyProfile,
  updateDoctorMyProfile,
} from '@/lib/doctor-app/profile'

const updateDoctorProfileSchema = z
  .object({
    name: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      requiredStringField('Name', { max: 200 }).optional()
    ),
    email: emailField('Email', { optional: true }),
    phoneNumber: phoneField('Phone number', { optional: true }),
    category: nullableOptionalStringField('Category', { max: 100 }),
    treatment: nullableOptionalStringField('Treatment', { max: 200 }),
    specialty: nullableOptionalStringField('Specialty', { max: 200 }),
    age: z.preprocess(
      (value) => (value === null ? null : value),
      optionalIntField('Age', { min: 0, max: 120 }).nullable().optional()
    ),
    sex: nullableOptionalStringField('Sex', { max: 50 }),
    gender: nullableOptionalStringField('Gender', { max: 50 }),
    aadhaarNumber: nullableOptionalStringField('Aadhaar number', { max: 20 }),
    panNumber: nullableOptionalStringField('PAN number', { max: 20 }),
    experienceYears: z.preprocess(
      (value) => (value === null ? null : value),
      optionalIntField('Experience years', { min: 0, max: 80 }).nullable().optional()
    ),
    experienceNotes: nullableOptionalStringField('Experience notes', { max: 5000 }),
    feeStructure: nullableOptionalStringField('Fee structure', { max: 5000 }),
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
