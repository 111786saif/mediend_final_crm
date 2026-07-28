import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  zodErrorResponse,
} from '@/lib/api-utils'
import {
  getSalesOpdMonitoring,
  listSalesOpdMonitoringDoctors,
  SalesOpdMonitoringError,
} from '@/lib/opd-monitoring'
import { getSessionFromRequest } from '@/lib/session'

const doctorsSchema = z.object({
  mode: z.literal('doctors'),
})

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
  doctorName: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  status: z.string().trim().optional(),
})

const overdueSchema = z.object({
  mode: z.literal('overdue'),
  doctorName: z.string().trim().optional(),
  daysOverdue: z.coerce.number().int().min(0).optional().default(1),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const mode = String(query.mode || 'summary')

    if (mode === 'doctors') {
      const input = doctorsSchema.parse({ mode })
      const items = await listSalesOpdMonitoringDoctors(user)
      return successResponse({ items, mode: input.mode }, 'OPD doctors fetched')
    }

    if (mode === 'summary') {
      const input = summarySchema.parse({ mode, ...query })
      const result = await getSalesOpdMonitoring(user, input)
      return successResponse(result, 'OPD summary fetched')
    }

    if (mode === 'daily') {
      const input = dailySchema.parse({ mode, ...query })
      const items = await getSalesOpdMonitoring(user, input)
      return successResponse({ items }, 'Daily OPD monitoring fetched')
    }

    if (mode === 'doctor') {
      const input = doctorSchema.parse({ mode, ...query })
      const items = await getSalesOpdMonitoring(user, input)
      return successResponse({ items }, 'Doctor OPD monitoring fetched')
    }

    if (mode === 'overdue') {
      const input = overdueSchema.parse({ mode, ...query })
      const items = await getSalesOpdMonitoring(user, input)
      return successResponse({ items }, 'Overdue OPD monitoring fetched')
    }

    return errorResponse('Unknown OPD monitoring mode', 400)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof SalesOpdMonitoringError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/opd-monitoring]', error)
    return errorResponse('Internal server error', 500)
  }
}
