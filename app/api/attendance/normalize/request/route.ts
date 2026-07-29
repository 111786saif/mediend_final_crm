import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  isWithinNormalizationWindow,
  NORMALIZATION_REASON_MIN_CHARS,
} from '@/lib/hrms/normalization-deadline'
import { notifyNormalizationPendingReview } from '@/lib/hrms/normalization-notify'
import { isUserInMDManagedCohort } from '@/lib/hierarchy'
import { z } from 'zod'

const bodySchema = z.object({
  dates: z.array(z.string().transform((s) => new Date(s))).min(1),
  reason: z
    .string()
    .trim()
    .min(
      NORMALIZATION_REASON_MIN_CHARS,
      `Reason must be at least ${NORMALIZATION_REASON_MIN_CHARS} characters`
    ),
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

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: {
        user: { select: { name: true } },
      },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const body = await request.json()
    const { dates, reason } = bodySchema.parse(body)

    const dayStarts = [...new Set(dates.map(toDayStart).map((d) => d.getTime()))].map(
      (t) => new Date(t)
    )

    const now = new Date()
    const outOfWindow = dayStarts.filter((d) => !isWithinNormalizationWindow(d, now))
    if (outOfWindow.length > 0) {
      const d = outOfWindow[0]
      const dateKey = d.toISOString().split('T')[0]
      return errorResponse(
        `Cannot request normalization for ${dateKey} - deadline has passed. Normalization must be applied within the same week (from April 2026) or by 5th of next month.`,
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
        { created: 0, skipped: dayStarts.length, message: 'All selected days already have a normalization or pending request' },
        'No new requests created'
      )
    }

    await prisma.attendanceNormalization.createMany({
      data: toCreate.map((date) => ({
        employeeId: employee.id,
        date,
        type: 'EMPLOYEE_REQUEST',
        requestedById: employee.id,
        status: 'PENDING',
        reason,
      })),
    })

    const empName = employee.user?.name ?? 'An employee'
    const routeToMd = await isUserInMDManagedCohort(employee.userId)

    // MD cohort: MD is the reviewer immediately (no manager gate).
    // Non-MD: HR only acts after manager approval — notify then (manager-approve route).
    if (routeToMd) {
      await notifyNormalizationPendingReview({
        subjectUserId: employee.userId,
        message: `${empName} has requested attendance normalization for ${toCreate.length} day(s)`,
        relatedEmployeeId: employee.id,
      })
    }

    const pendingCopy = routeToMd ? 'Pending MD approval.' : 'Pending manager approval.'

    return successResponse(
      { created: toCreate.length, skipped: dayStarts.length - toCreate.length },
      `Requested normalization for ${toCreate.length} day(s). ${pendingCopy}`
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message ?? 'Invalid request data', 400)
    }
    console.error('Error creating normalization request:', error)
    return errorResponse('Failed to request normalization', 500)
  }
}
