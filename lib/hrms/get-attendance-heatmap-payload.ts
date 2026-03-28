import { prisma } from '@/lib/prisma'
import {
  groupAttendanceByDate,
  getDepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import type { Prisma } from '@/generated/prisma/client'

export type AttendanceHeatmapPayload = {
  attendance: Array<
    Record<string, unknown> & {
      date: Date
      isNormalized: boolean
      isPendingNormalization: boolean
    }
  >
  leaveDays: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[]
  holidayDays: { date: string; name: string }[]
}

/**
 * Builds the same `attendance` / `leaveDays` / `holidayDays` payload as GET /api/attendance/my
 * for a given employee and UTC date range (inclusive).
 */
export async function getAttendanceHeatmapPayloadForEmployee(
  employeeId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceHeatmapPayload | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true },
  })

  if (!employee) return null

  const [y, m, d] = fromDate.split('-').map(Number)
  const [y2, m2, d2] = toDate.split('-').map(Number)
  const rangeStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const rangeEnd = new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59, 999))

  const timing = getDepartmentTiming(employee.department)

  const logWhere: Prisma.AttendanceLogWhereInput = {
    employeeId,
    logDate: { gte: rangeStart, lte: rangeEnd },
  }

  const [logs, normalizations, leaves] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: logWhere,
      orderBy: { logDate: 'desc' },
    }),
    prisma.attendanceNormalization.findMany({
      where: {
        employeeId,
        status: { in: ['APPROVED', 'PENDING'] },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        OR: [{ startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } }],
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

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    select: { date: true, name: true },
  })
  const holidayDays = holidays.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    name: h.name,
  }))

  const rangeStartStr = rangeStart.toISOString().split('T')[0]
  const rangeEndStr = rangeEnd.toISOString().split('T')[0]
  const leaveDays: { date: string; isUnpaid: boolean; isHalfDay?: boolean }[] = []

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

    for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
      const dateKey = dt.toISOString().split('T')[0]
      if (dateKey >= rangeStartStr && dateKey <= rangeEndStr) {
        leaveDays.push({
          date: dateKey,
          isUnpaid: leave.isUnpaid,
          ...(isHalfDayLeave ? { isHalfDay: true } : {}),
        })
      }
    }
  }

  return {
    attendance: attendanceWithNormalized,
    leaveDays,
    holidayDays,
  }
}
