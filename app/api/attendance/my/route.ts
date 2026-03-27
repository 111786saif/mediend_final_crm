import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  groupAttendanceByDate,
  DEFAULT_DEPARTMENT_TIMING,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import { Prisma } from '@/generated/prisma/client'

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
      },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Prisma.AttendanceLogWhereInput = {
      employeeId: employee.id,
    }

    let rangeStart: Date | null = null
    let rangeEnd: Date | null = null

    if (fromDate || toDate) {
      where.logDate = {}
      if (fromDate) {
        const [y, m, d] = fromDate.split('-').map(Number)
        rangeStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
        where.logDate.gte = rangeStart
      }
      if (toDate) {
        const [y, m, d] = toDate.split('-').map(Number)
        rangeEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
        where.logDate.lte = rangeEnd
      }
    }

    const timing = getDepartmentTiming(employee.department)

    const [logs, normalizations, leaves] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        orderBy: { logDate: 'desc' },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['APPROVED', 'PENDING'] },
          ...(rangeStart && rangeEnd
            ? { date: { gte: rangeStart, lte: rangeEnd } }
            : {}),
        },
        select: { date: true, status: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          ...(rangeStart && rangeEnd
            ? {
                OR: [
                  {
                    startDate: { lte: rangeEnd },
                    endDate: { gte: rangeStart },
                  },
                ],
              }
            : {}),
        },
        select: { startDate: true, endDate: true, isUnpaid: true, days: true },
      }),
    ])

    const grouped = groupAttendanceByDate(logs, timing)

    const approvedDates = new Set(
      normalizations.filter((n) => n.status === 'APPROVED').map((n) => n.date.toISOString().split('T')[0])
    )
    const pendingDates = new Set(
      normalizations.filter((n) => n.status === 'PENDING').map((n) => n.date.toISOString().split('T')[0])
    )

    const attendanceWithNormalized = grouped.map((day) => {
      const dateKey = day.date.toISOString().split('T')[0]
      return {
        ...day,
        isNormalized: approvedDates.has(dateKey),
        isPendingNormalization: pendingDates.has(dateKey),
      }
    })

    const holidayDays: { date: string; name: string }[] = []
    if (rangeStart && rangeEnd) {
      const holidays = await prisma.holiday.findMany({
        where: {
          date: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        select: { date: true, name: true },
      })
      for (const h of holidays) {
        holidayDays.push({
          date: h.date.toISOString().split('T')[0],
          name: h.name,
        })
      }
    }

    const leaveDays: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[] = []
    const rangeStartStr = rangeStart?.toISOString().split('T')[0]
    const rangeEndStr = rangeEnd?.toISOString().split('T')[0]
    for (const leave of leaves) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCHours(0, 0, 0, 0)
      const sameCalendarDay =
        start.getUTCFullYear() === end.getUTCFullYear() &&
        start.getUTCMonth() === end.getUTCMonth() &&
        start.getUTCDate() === end.getUTCDate()
      const isHalfDayLeave = sameCalendarDay && leave.days === 0.5

      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0]
        if (
          (!rangeStartStr || dateKey >= rangeStartStr) &&
          (!rangeEndStr || dateKey <= rangeEndStr)
        ) {
          leaveDays.push({
            date: dateKey,
            isUnpaid: leave.isUnpaid,
            ...(isHalfDayLeave ? { isHalfDay: true } : {}),
          })
        }
      }
    }

    return successResponse({
      attendance: attendanceWithNormalized,
      leaveDays,
      holidayDays,
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return errorResponse('Failed to fetch attendance', 500)
  }
}
