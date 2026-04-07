import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  DEFAULT_DEPARTMENT_TIMING,
  getDepartmentTiming,
  groupAttendanceByDate,
} from '@/lib/hrms/attendance-utils'

type LeaveDayRow = { date: string; isUnpaid: boolean; isHalfDay?: boolean }

/**
 * GET /api/md/employee-attendance?employeeId=xxx&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 * Fetch attendance for any single employee. MD/ADMIN only.
 */
export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (user.role !== 'MD' && user.role !== 'ADMIN') {
    return errorResponse('Forbidden', 403)
  }

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employeeId')
  const fromDate = searchParams.get('fromDate')
  const toDate = searchParams.get('toDate')

  if (!employeeId) return errorResponse('employeeId is required', 400)

  let rangeStart: Date | null = null
  let rangeEnd: Date | null = null
  const where: { employeeId: string; logDate?: { gte?: Date; lte?: Date } } = { employeeId }

  if (fromDate) {
    const [y, m, d] = fromDate.split('-').map(Number)
    rangeStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
    where.logDate = { ...where.logDate, gte: rangeStart }
  }
  if (toDate) {
    const [y, m, d] = toDate.split('-').map(Number)
    rangeEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    where.logDate = { ...where.logDate, lte: rangeEnd }
  }

  const [logs, emp, normalizations, approvedLeaves, holidaysInRange] = await Promise.all([
    prisma.attendanceLog.findMany({
      where,
      orderBy: { logDate: 'desc' },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            department: true,
          },
        },
      },
    }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.attendanceNormalization.findMany({
      where: {
        employeeId,
        status: { in: ['APPROVED', 'PENDING'] },
        ...(rangeStart && rangeEnd ? { date: { gte: rangeStart, lte: rangeEnd } } : {}),
      },
      select: { employeeId: true, date: true, status: true },
    }),
    rangeStart && rangeEnd
      ? prisma.leaveRequest.findMany({
          where: {
            employeeId,
            status: 'APPROVED',
            startDate: { lte: rangeEnd },
            endDate: { gte: rangeStart },
          },
          select: {
            employeeId: true,
            startDate: true,
            endDate: true,
            isUnpaid: true,
            days: true,
            leaveType: { select: { code: true, name: true } },
          },
        })
      : Promise.resolve([]),
    rangeStart && rangeEnd
      ? prisma.holiday.findMany({
          where: { date: { gte: rangeStart, lte: rangeEnd } },
          select: { date: true, name: true },
        })
      : Promise.resolve([]),
  ])

  if (!emp) return errorResponse('Employee not found', 404)

  const timing = getDepartmentTiming(emp.department) ?? DEFAULT_DEPARTMENT_TIMING

  const approvedDates = new Set<string>()
  const pendingDates = new Set<string>()
  for (const n of normalizations) {
    const key = n.date.toISOString().split('T')[0]
    if (n.status === 'APPROVED') approvedDates.add(key)
    else pendingDates.add(key)
  }

  const grouped = groupAttendanceByDate(logs, timing)
  const attendance = grouped.map((day) => {
    const dateKey = day.date.toISOString().split('T')[0]
    return {
      ...day,
      isNormalized: approvedDates.has(dateKey),
      isPendingNormalization: pendingDates.has(dateKey),
    }
  })

  // Expand leaves to days
  const leaveDays: LeaveDayRow[] = []
  if (rangeStart && rangeEnd) {
    const rsStr = rangeStart.toISOString().split('T')[0]
    const reStr = rangeEnd.toISOString().split('T')[0]
    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCHours(0, 0, 0, 0)
      const sameDay = start.getTime() === end.getTime()
      const isHalf = sameDay && leave.days === 0.5
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dk = d.toISOString().split('T')[0]
        if (dk < rsStr || dk > reStr) continue
        leaveDays.push({ date: dk, isUnpaid: leave.isUnpaid, ...(isHalf ? { isHalfDay: true } : {}) })
      }
    }
  }

  // Aggregate leave by type
  const leaveByTypeMap = new Map<string, number>()
  if (rangeStart && rangeEnd) {
    for (const leave of approvedLeaves) {
      const code = leave.isUnpaid ? 'LOP' : (leave.leaveType.code?.toUpperCase() || 'OTHER')
      const s = new Date(leave.startDate); s.setUTCHours(0,0,0,0)
      const e = new Date(leave.endDate); e.setUTCHours(0,0,0,0)
      let overlap = 0
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        const dk = d.toISOString().split('T')[0]
        if (dk >= rangeStart.toISOString().split('T')[0] && dk <= rangeEnd.toISOString().split('T')[0]) overlap++
      }
      if (overlap > 0) {
        const days = leave.days > 0 ? leave.days : overlap
        leaveByTypeMap.set(code, (leaveByTypeMap.get(code) ?? 0) + days)
      }
    }
  }
  const leaveByType = Array.from(leaveByTypeMap.entries())
    .filter(([, days]) => days > 0)
    .map(([code, days]) => ({ code, days: Math.round(days * 100) / 100 }))

  const holidayDays = holidaysInRange.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    name: h.name,
  }))

  return successResponse({
    entry: {
      employeeId,
      name: emp.user.name,
      email: emp.user.email,
      role: emp.user.role,
      attendance,
      leaveDays,
      leaveByType,
    },
    holidayDays,
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
  })
}
