import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { addDays } from 'date-fns'

const statusActionSchema = z.object({
  action: z.enum(['START_PIP', 'START_NOTICE', 'TERMINATE', 'REACTIVATE', 'ABSCOND']),
  days: z.number().int().positive().optional(),
  terminationReason: z.string().max(500).optional(),
  finalWorkingDay: z.string().optional(),
  note: z.string().max(1000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const data = statusActionSchema.parse(body)

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!employee) return errorResponse('Employee not found', 404)

    const now = new Date()

    switch (data.action) {
      case 'START_PIP': {
        if (data.days == null) return errorResponse('days is required for START_PIP', 400)
        const pipEndDate = addDays(now, data.days)
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'ON_PIP',
            pipStartDate: now,
            pipEndDate,
            noticePeriodStartDate: null,
            noticePeriodEndDate: null,
            finalWorkingDay: null,
            terminationReason: null,
          },
        })
        return successResponse({ ok: true, message: `PIP started for ${data.days} days` })
      }

      case 'START_NOTICE': {
        if (data.days == null) return errorResponse('days is required for START_NOTICE', 400)
        const noticePeriodEndDate = addDays(now, data.days)
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'ON_NOTICE',
            pipStartDate: null,
            pipEndDate: null,
            noticePeriodStartDate: now,
            noticePeriodEndDate,
            finalWorkingDay: noticePeriodEndDate,
            terminationReason: null,
          },
        })
        return successResponse({ ok: true, message: `Notice period started for ${data.days} days` })
      }

      case 'TERMINATE': {
        const finalWorkingDay = data.finalWorkingDay
          ? new Date(data.finalWorkingDay)
          : null
        if (!finalWorkingDay || isNaN(finalWorkingDay.getTime())) {
          return errorResponse('finalWorkingDay is required for TERMINATE', 400)
        }
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'TERMINATED',
            pipStartDate: null,
            pipEndDate: null,
            noticePeriodStartDate: null,
            noticePeriodEndDate: null,
            finalWorkingDay,
            terminationReason: data.terminationReason ?? null,
          },
        })
        return successResponse({ ok: true, message: 'Employee terminated' })
      }

      case 'REACTIVATE': {
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            pipStartDate: null,
            pipEndDate: null,
            noticePeriodStartDate: null,
            noticePeriodEndDate: null,
            finalWorkingDay: null,
            terminationReason: null,
          },
        })
        return successResponse({ ok: true, message: 'Employee reactivated' })
      }

      case 'ABSCOND': {
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'ABSCONDED',
            pipStartDate: null,
            pipEndDate: null,
            noticePeriodStartDate: null,
            noticePeriodEndDate: null,
            finalWorkingDay: null,
            terminationReason: data.note ?? null,
          },
        })
        return successResponse({ ok: true, message: 'Employee marked as absconded' })
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.message, 400)
    }
    console.error('Error updating employee status:', error)
    return errorResponse('Failed to update employee status', 500)
  }
}
