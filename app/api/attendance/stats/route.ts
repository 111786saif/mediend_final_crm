import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  groupAttendanceByDate,
  DEFAULT_DEPARTMENT_TIMING,
} from '@/lib/hrms/attendance-utils'

export async function GET(request: NextRequest) {
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

    const timing = employee.department
      ? {
          shiftStartHour: employee.department.shiftStartHour,
          shiftStartMinute: employee.department.shiftStartMinute,
          grace1Minutes: employee.department.grace1Minutes,
          grace2Minutes: employee.department.grace2Minutes,
          penaltyMinutes: employee.department.penaltyMinutes,
          penaltyAmount: employee.department.penaltyAmount,
        }
      : DEFAULT_DEPARTMENT_TIMING

    const monthStart = new Date(Date.UTC(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    ))
    const monthEndForLimit = new Date(Date.UTC(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999
    ))

    const [logs, normalizations, selfNormalizationsThisMonth] = await Promise.all([
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
    let totalPenalty = 0

    for (const day of grouped) {
      const dateKey = day.date.toISOString().split('T')[0]
      if (normDates.has(dateKey)) continue
      if (day.status === 'grace-1') grace1Count++
      else if (day.status === 'grace-2') grace2Count++
      else if (day.status === 'late-penalty') {
        latePenaltyCount++
        totalPenalty += day.penalty ?? 0
      } else if (day.isHalfDay) halfDayCount++
    }

    return successResponse({
      grace1Count,
      grace2Count,
      latePenaltyCount,
      halfDayCount,
      totalPenalty,
      normalizationsUsed: selfNormalizationsThisMonth.length,
      normalizationsLimitDays: 3,
      normalizationsHoursUsed,
      normalizationsLimitHours: 3,
    })
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return errorResponse('Failed to fetch attendance stats', 500)
  }
}
