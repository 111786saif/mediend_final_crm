import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  AppointmentMonitoringListFilters,
  DoctorAdminMonitoringError,
  getDoctorAdminAppointmentMonitoring,
  getDoctorAdminAppointmentMonitoringSummary,
} from '@/lib/doctor-admin/monitoring'

const summarySchema = z.object({
  mode: z.literal('summary'),
  range: z.enum(['all', 'day']).optional().default('all'),
  date: z.string().trim().optional(),
})

const dailySchema = z.object({
  mode: z.literal('daily'),
  date: z.string().trim().min(1),
})

const doctorSchema = z.object({
  mode: z.literal('doctor'),
  doctorId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  status: z.string().trim().optional(),
  type: z.enum(['all', 'opd', 'ipd']).optional().default('all'),
})

const overdueSchema = z.object({
  mode: z.literal('overdue'),
  doctorId: z.string().trim().optional(),
  daysOverdue: z.coerce.number().int().min(0).optional().default(1),
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
