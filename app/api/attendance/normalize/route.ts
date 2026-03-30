import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  groupAttendanceByDate,
  DEFAULT_DEPARTMENT_TIMING,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import { z } from 'zod'

const SELF_NORMALIZATION_LIMIT_HOURS_PER_MONTH = 3
const SELF_NORMALIZATION_LIMIT_DAYS_PER_MONTH = 3
/** Punch-in by 11:00 AM (UTC) = 11 * 60 minutes from midnight */
const ELIGIBILITY_PUNCH_BY_MINUTES = 11 * 60
const ELIGIBILITY_MIN_WORK_HOURS = 7

/** Same outcomes as payroll “full day” from punches — self-normalization must not apply. */
const FULL_DAY_CLASSIFICATION_STATUSES = new Set([
  'on-time',
  'grace-1',
  'grace-2',
  'late-penalty',
])

const bodySchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  hours: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Optional; self-normalization does not require a reason */
  reason: z.string().trim().optional(),
})

function getDepartmentTiming(department: {
  shiftStartHour: number
  shiftStartMinute: number
  grace1Minutes: number
  grace2Minutes: number
  penaltyMinutes: number
  penaltyAmount: number
} | null): DepartmentTiming {
  if (!department) return DEFAULT_DEPARTMENT_TIMING
  return {
    shiftStartHour: department.shiftStartHour,
    shiftStartMinute: department.shiftStartMinute,
    grace1Minutes: department.grace1Minutes,
    grace2Minutes: department.grace2Minutes,
    penaltyMinutes: department.penaltyMinutes,
    penaltyAmount: department.penaltyAmount,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { department: true },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const body = await request.json()
    const { date, hours, reason: reasonRaw } = bodySchema.parse(body)
    const reason = reasonRaw?.length ? reasonRaw : null

    const dateKey = date.toISOString().split('T')[0]
    const [y, m, d] = dateKey.split('-').map(Number)
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
    const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))

    const existing = await prisma.attendanceNormalization.findUnique({
      where: {
        employeeId_date: { employeeId: employee.id, date: dayStart },
      },
    })

    if (existing) {
      return errorResponse('This day is already normalized', 400)
    }

    const [logsThisDay, normalizationsThisMonth, approvedLeaves] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId: employee.id,
          logDate: { gte: dayStart, lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)) },
        },
        orderBy: { logDate: 'asc' },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: employee.id,
          type: 'SELF',
          status: 'APPROVED',
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { date: true, hoursUsed: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          startDate: { lte: dayStart },
          endDate: { gte: dayStart },
        },
        select: { id: true },
      }),
    ])

    if (approvedLeaves.length > 0) {
      return errorResponse('Cannot normalize a day that is on approved leave', 400)
    }

    const timing = getDepartmentTiming(employee.department)
    const grouped = groupAttendanceByDate(logsThisDay, timing)
    const dayRecord = grouped.find(
      (row) => row.date.toISOString().split('T')[0] === dateKey
    )

    if (!dayRecord || !dayRecord.inTime) {
      return errorResponse('Cannot normalize: no attendance (absent) for this date', 400)
    }

    const status = dayRecord.status
    if (status && FULL_DAY_CLASSIFICATION_STATUSES.has(status)) {
      return errorResponse(
        'This day is already a full day; normalization is not required',
        400
      )
    }

    const punchMinutes =
      dayRecord.inTime.getUTCHours() * 60 + dayRecord.inTime.getUTCMinutes()
    const workHours = dayRecord.workHours ?? 0
    const inBy11 = punchMinutes <= ELIGIBILITY_PUNCH_BY_MINUTES
    const workedEnough = workHours >= ELIGIBILITY_MIN_WORK_HOURS

    if (!inBy11 && !workedEnough) {
      return errorResponse(
        'Cannot normalize: you must have been in by 11 AM or worked at least 7 hours on this day',
        400
      )
    }

    const hoursUsedThisMonth =
      normalizationsThisMonth.reduce((sum, n) => sum + (n.hoursUsed ?? 1), 0)
    const daysCountThisMonth = normalizationsThisMonth.length

    if (hoursUsedThisMonth + hours > SELF_NORMALIZATION_LIMIT_HOURS_PER_MONTH) {
      return errorResponse(
        `Self-normalization limit reached: you have ${SELF_NORMALIZATION_LIMIT_HOURS_PER_MONTH - hoursUsedThisMonth} hour(s) left this month`,
        400
      )
    }

    if (daysCountThisMonth >= SELF_NORMALIZATION_LIMIT_DAYS_PER_MONTH) {
      return errorResponse(
        `Self-normalization limit reached: maximum ${SELF_NORMALIZATION_LIMIT_DAYS_PER_MONTH} days per month`,
        400
      )
    }

    const normalization = await prisma.attendanceNormalization.create({
      data: {
        employeeId: employee.id,
        date: dayStart,
        type: 'SELF',
        requestedById: employee.id,
        status: 'APPROVED',
        hoursUsed: hours,
        reason,
      },
      include: {
        employee: { select: { id: true, employeeCode: true } },
      },
    })

    return successResponse(normalization, 'Attendance normalized successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message ?? 'Invalid request data', 400)
    }
    console.error('Error creating self-normalization:', error)
    return errorResponse('Failed to normalize attendance', 500)
  }
}
