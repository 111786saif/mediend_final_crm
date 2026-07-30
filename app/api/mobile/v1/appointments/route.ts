import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  optionalEnumField,
  optionalIntField,
  optionalStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, listDoctorAppointments } from '@/lib/doctor-app/appointments'

const listAppointmentsSchema = z.object({
  type: optionalEnumField('Appointment type', ['all', 'opd', 'ipd'], 'all'),
  status: optionalStringField('Status'),
  date: optionalStringField('Date'),
  day: optionalIntField('Day', { min: 1, max: 31 }),
  month: optionalIntField('Month', { min: 1, max: 12 }),
  year: optionalIntField('Year', { min: 2000, max: 2100 }),
  page: optionalIntField('Page', { min: 1, defaultValue: 1 }),
  limit: optionalIntField('Limit', { min: 1, max: 100, defaultValue: 20 }),
})

export async function GET(request: NextRequest) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listAppointmentsSchema.parse(query)
    const result = await listDoctorAppointments(session, input)

    return successResponse(result, 'Appointments fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/mobile/v1/appointments]', error)
    return errorResponse('Internal server error', 500)
  }
}
