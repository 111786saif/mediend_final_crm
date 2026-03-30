import { NextRequest } from 'next/server'
import { NotificationType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  groupAttendanceByDate,
  getDepartmentTiming,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'

const GRACE2_MONTHLY_MAX = 10

async function countGrace2InRange(
  employeeId: string,
  rangeStart: Date,
  rangeEnd: Date,
  timing: DepartmentTiming
): Promise<{ grace2: number; normDates: Set<string> }> {
  const [logs, normalizations] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: {
        employeeId,
        logDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { logDate: 'desc' },
    }),
    prisma.attendanceNormalization.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true },
    }),
  ])
  const grouped = groupAttendanceByDate(logs, timing)
  const normDates = new Set(
    normalizations.map((n) => n.date.toISOString().split('T')[0])
  )
  let grace2 = 0
  for (const day of grouped) {
    const dateKey = day.date.toISOString().split('T')[0]
    if (normDates.has(dateKey)) continue
    if (day.status === 'grace-2') grace2++
  }
  return { grace2, normDates }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: {
        department: true,
        user: { select: { name: true } },
        manager: { select: { userId: true, user: { select: { name: true } } } },
      },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    let rangeStart: Date
    let rangeEnd: Date
    if (fromDate && toDate) {
      const [sy, sm, sd] = fromDate.split('-').map(Number)
      const [ey, em, ed] = toDate.split('-').map(Number)
      rangeStart = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0))
      rangeEnd = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999))
    } else {
      const now = new Date()
      rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
      rangeEnd = new Date()
    }

    const timing = getDepartmentTiming(employee.department)

    const timingResponse = {
      shiftStartHour: timing.shiftStartHour,
      shiftStartMinute: timing.shiftStartMinute,
      grace1Minutes: timing.grace1Minutes,
      grace2Minutes: timing.grace2Minutes,
      penaltyMinutes: timing.penaltyMinutes,
      penaltyAmount: timing.penaltyAmount,
      departmentName: employee.department?.name ?? null,
    }

    const monthStart = new Date(
      Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1, 0, 0, 0, 0)
    )
    const monthEndForLimit = new Date(
      Date.UTC(
        rangeStart.getUTCFullYear(),
        rangeStart.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    )

    const nowUtc = new Date()
    const currentMonthStart = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0)
    )
    const currentMonthEnd = new Date(
      Date.UTC(
        nowUtc.getUTCFullYear(),
        nowUtc.getUTCMonth() + 1,
        0,
        23,
        59,
        59,
        999
      )
    )

    const [
      logs,
      normalizations,
      selfNormalizationsThisMonth,
      grace2MonthResult,
    ] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId: employee.id,
          logDate: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { logDate: 'desc' },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { date: true },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: employee.id,
          type: 'SELF',
          status: 'APPROVED',
          date: { gte: monthStart, lte: monthEndForLimit },
        },
        select: { hoursUsed: true },
      }),
      countGrace2InRange(employee.id, currentMonthStart, currentMonthEnd, timing),
    ])

    const grouped = groupAttendanceByDate(logs, timing)
    const normDates = new Set(
      normalizations.map((n) => n.date.toISOString().split('T')[0])
    )

    const normalizationsHoursUsed = selfNormalizationsThisMonth.reduce(
      (sum, n) => sum + (n.hoursUsed ?? 1),
      0
    )

    let grace1Count = 0
    let grace2Count = 0
    let latePenaltyCount = 0
    let halfDayCount = 0
    let absentCount = 0
    let fullDayCount = 0
    let totalPenalty = 0

    for (const day of grouped) {
      const dateKey = day.date.toISOString().split('T')[0]
      if (normDates.has(dateKey)) continue
      const s = day.status
      if (s === 'grace-1') {
        grace1Count++
        fullDayCount++
      } else if (s === 'grace-2') {
        grace2Count++
        fullDayCount++
      } else if (s === 'late-penalty') {
        latePenaltyCount++
        totalPenalty += day.penalty ?? 0
        fullDayCount++
      } else if (s === 'absent') {
        absentCount++
      } else if (day.isHalfDay) {
        halfDayCount++
      } else if (s === 'on-time') {
        fullDayCount++
      }
    }

    const grace2CountThisUtcMonth = grace2MonthResult.grace2

    if (grace2CountThisUtcMonth > GRACE2_MONTHLY_MAX) {
      const y = nowUtc.getUTCFullYear()
      const m = String(nowUtc.getUTCMonth() + 1).padStart(2, '0')
      const monthKey = `${y}-${m}`
      const empName = employee.user?.name ?? 'An employee'

      const hrHeads = await prisma.user.findMany({
        where: { role: 'HR_HEAD' },
        select: { id: true },
      })

      const recipientIds = new Set<string>()
      if (employee.manager?.userId) {
        recipientIds.add(employee.manager.userId)
      }
      hrHeads.forEach((h) => recipientIds.add(h.id))

      for (const recipientUserId of recipientIds) {
        const relatedId = `grace2-limit:${employee.id}:${monthKey}:${recipientUserId}`
        const existing = await prisma.notification.findFirst({
          where: {
            type: NotificationType.GRACE2_MONTHLY_LIMIT_EXCEEDED,
            relatedId,
          },
        })
        if (existing) continue
        await prisma.notification.create({
          data: {
            userId: recipientUserId,
            type: NotificationType.GRACE2_MONTHLY_LIMIT_EXCEEDED,
            title: 'Grace 2 limit exceeded',
            message: `${empName} has ${grace2CountThisUtcMonth} Grace 2 day(s) this month (policy max ${GRACE2_MONTHLY_MAX}/month).`,
            link: employee.manager?.userId === recipientUserId ? '/employee/my-team' : '/hr/attendance-leaves',
            relatedId,
          },
        })
      }
    }

    return successResponse({
      grace1Count,
      grace2Count,
      latePenaltyCount,
      halfDayCount,
      absentCount,
      fullDayCount,
      grace2CountThisUtcMonth,
      totalPenalty,
      normalizationsUsed: selfNormalizationsThisMonth.length,
      normalizationsLimitDays: 3,
      normalizationsHoursUsed,
      normalizationsLimitHours: 3,
      ...timingResponse,
    })
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return errorResponse('Failed to fetch attendance stats', 500)
  }
}
