import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getNormalizationDeadline, isWithinNormalizationWindow } from '@/lib/hrms/normalization-deadline'
import { notifyNormalizationPendingReview } from '@/lib/hrms/normalization-notify'
import { isUserInMDManagedCohort } from '@/lib/hierarchy'
import { z } from 'zod'

const bodySchema = z.object({
  employeeId: z.string(),
  dates: z.array(z.string().transform((s) => new Date(s))).min(1),
  reason: z.string().optional(),
  normalizeAs: z.enum(['FULL_DAY', 'HALF_DAY']).default('FULL_DAY'),
})

function toDayStart(d: Date): Date {
  const [y, m, day] = d.toISOString().split('T')[0].split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0))
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const manager = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!manager) {
      return errorResponse('Employee record not found', 404)
    }

    const body = await request.json()
    const { employeeId, dates, reason, normalizeAs } = bodySchema.parse(body)

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { name: true } } },
    })

    if (!employee) {
      return errorResponse('Employee not found', 404)
    }

    if (employee.managerId !== manager.id) {
      return errorResponse('You can only normalize attendance for your direct reports', 403)
    }

    const dayStarts = [...new Set(dates.map(toDayStart).map((d) => d.getTime()))].map(
      (t) => new Date(t)
    )

    const now = new Date()
    const outOfWindow = dayStarts.filter((d) => !isWithinNormalizationWindow(d, now))
    if (outOfWindow.length > 0) {
      const d = outOfWindow[0]
      const deadline = getNormalizationDeadline(d)
      const dateKey = d.toISOString().split('T')[0]
      const deadlineStr = deadline.toISOString().split('T')[0]
      return errorResponse(
        `Cannot apply for ${dateKey} - deadline has passed (${deadlineStr}). Remove out-of-window dates and try again.`,
        400
      )
    }

    const existingNorm = await prisma.attendanceNormalization.findMany({
      where: {
        employeeId: employee.id,
        date: { in: dayStarts },
      },
      select: { date: true },
    })
    const existingSet = new Set(
      existingNorm.map((n) => n.date.toISOString().split('T')[0])
    )

    const toCreate = dayStarts.filter((d) => {
      const key = d.toISOString().split('T')[0]
      return !existingSet.has(key)
    })

    if (toCreate.length === 0) {
      return successResponse(
        { created: 0, skipped: dayStarts.length, message: 'All selected days already have an application or are normalized' },
        'No new applications created'
      )
    }

    await prisma.attendanceNormalization.createMany({
      data: toCreate.map((date) => ({
        employeeId: employee.id,
        date,
        type: 'MANAGER',
        requestedById: manager.id,
        approvedById: null,
        managerApprovedById: manager.id,
        managerApprovedAt: new Date(),
        status: 'PENDING',
        reason: reason ?? null,
        normalizeAs,
      })),
    })

    const empName = employee.user?.name ?? 'An employee'
    await notifyNormalizationPendingReview({
      subjectUserId: employee.userId,
      message: `${empName} has requested attendance normalization`,
      relatedEmployeeId: employee.id,
    })

    const pendingCopy = (await isUserInMDManagedCohort(employee.userId))
      ? 'Pending MD approval.'
      : 'Pending HR approval.'

    return successResponse(
      { created: toCreate.length, skipped: dayStarts.length - toCreate.length },
      `Applied for normalization of ${toCreate.length} day(s). ${pendingCopy}`
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating manager normalization:', error)
    return errorResponse('Failed to normalize attendance', 500)
  }
}
