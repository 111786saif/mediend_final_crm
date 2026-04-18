import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { addDays } from 'date-fns'

const statusActionSchema = z.object({
  action: z.enum(['START_PIP', 'START_NOTICE', 'TERMINATE', 'FNF_PROCESS', 'REACTIVATE', 'ABSCOND']),
  days: z.number().int().positive().optional(),
  terminationReason: z.string().max(500).optional(),
  finalWorkingDay: z.string().optional(),
  fnfDeadline: z.string().optional(),
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
    const note = data.note?.trim() ? data.note.trim() : null

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
            statusNote: note,
            fnfDeadline: null,
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
            statusNote: note,
            fnfDeadline: null,
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
        const terminationReason = note ?? data.terminationReason?.trim() ?? null
        await prisma.employee.update({
          where: { id },
          data: {
            status: 'TERMINATED',
            pipStartDate: null,
            pipEndDate: null,
            noticePeriodStartDate: null,
            noticePeriodEndDate: null,
            finalWorkingDay,
            terminationReason,
            statusNote: note ?? terminationReason,
            fnfDeadline: null,
          },
        })
        return successResponse({ ok: true, message: 'Employee terminated' })
      }

      case 'FNF_PROCESS': {
        const finalWorkingDay = data.finalWorkingDay
          ? new Date(data.finalWorkingDay)
          : null
        const fnfDeadline = data.fnfDeadline
          ? new Date(data.fnfDeadline)
          : null
        if (!finalWorkingDay || isNaN(finalWorkingDay.getTime())) {
          return errorResponse('finalWorkingDay is required for FNF_PROCESS', 400)
        }
        if (!fnfDeadline || isNaN(fnfDeadline.getTime())) {
          return errorResponse('fnfDeadline is required for FNF_PROCESS', 400)
        }
        if (fnfDeadline < finalWorkingDay) {
          return errorResponse('fnfDeadline must be on or after finalWorkingDay', 400)
        }
        if (!note) {
          return errorResponse('note is required for FNF_PROCESS', 400)
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
            terminationReason: note,
            statusNote: note,
            fnfDeadline,
          },
        })
        return successResponse({ ok: true, message: 'FnF process started' })
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
            statusNote: null,
            fnfDeadline: null,
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
            terminationReason: note,
            statusNote: note,
            fnfDeadline: null,
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
