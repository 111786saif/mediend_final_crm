import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  optionalEnumField,
  optionalIntField,
  optionalStringField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  AppointmentMonitoringListFilters,
  DoctorAdminMonitoringError,
  getDoctorAdminAppointmentMonitoring,
  getDoctorAdminAppointmentMonitoringSummary,
} from '@/lib/doctor-admin/monitoring'

const summarySchema = z.object({
  mode: z.literal('summary'),
  range: optionalEnumField('Range', ['all', 'day'], 'all'),
  date: optionalStringField('Date'),
})

const dailySchema = z.object({
  mode: z.literal('daily'),
  date: requiredStringField('Date'),
})

const doctorSchema = z.object({
  mode: z.literal('doctor'),
  doctorId: optionalStringField('Doctor ID'),
  startDate: optionalStringField('Start date'),
  endDate: optionalStringField('End date'),
  status: optionalStringField('Status'),
  type: optionalEnumField('Appointment type', ['all', 'opd', 'ipd'], 'all'),
})

const overdueSchema = z.object({
  mode: z.literal('overdue'),
  doctorId: optionalStringField('Doctor ID'),
  daysOverdue: optionalIntField('Days overdue', { min: 0, defaultValue: 1 }),
})

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const mode = String(query.mode || 'summary')

    if (mode === 'summary') {
      const input = summarySchema.parse({ mode, ...query })
      const result = await getDoctorAdminAppointmentMonitoringSummary(input)
      return successResponse(result, 'Appointment summary fetched')
    }

    let filters: AppointmentMonitoringListFilters
    if (mode === 'daily') {
      filters = dailySchema.parse({ mode, ...query })
    } else if (mode === 'doctor') {
      filters = doctorSchema.parse({ mode, ...query })
    } else if (mode === 'overdue') {
      filters = overdueSchema.parse({ mode, ...query })
    } else {
      return errorResponse('Unknown appointment monitoring mode', 400)
    }

    const items = await getDoctorAdminAppointmentMonitoring(filters)
    return successResponse({ items }, 'Appointment monitoring fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/appointment-monitoring]', error)
    return errorResponse('Internal server error', 500)
  }
}
