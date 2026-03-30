import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  groupAttendanceByDate,
  DEFAULT_DEPARTMENT_TIMING,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import { getCalendarDaysInMonth } from '@/lib/hrms/salary-calculation'

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
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:payroll:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    if (!employeeId || !month || !year) {
      return errorResponse('employeeId, month, and year are required', 400)
    }

    const monthNum = parseInt(month, 10)
    const yearNum = parseInt(year, 10)
    if (monthNum < 1 || monthNum > 12 || !yearNum) {
      return errorResponse('Invalid month or year', 400)
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const totalDaysInMonth = getCalendarDaysInMonth(monthNum, yearNum)
    const monthStart = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999))

    const [logs, leaveRequests, normalizations] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId,
          logDate: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { logDate: 'asc' },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        select: { startDate: true, endDate: true, days: true, isUnpaid: true },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { date: true, normalizeAs: true },
      }),
    ])

    const timing = getDepartmentTiming(employee.department)
    const grouped = groupAttendanceByDate(logs, timing)

    const normalizedByDate = new Map<string, string>()
    for (const n of normalizations) {
      const dateKey = n.date.toISOString().split('T')[0]
      const normAs = (n as { normalizeAs?: string | null }).normalizeAs
      normalizedByDate.set(dateKey, normAs === 'HALF_DAY' ? 'HALF_DAY' : 'FULL_DAY')
    }

    // From attendance records only: full days, half days, late fines
    let fullDays = 0
    let halfDays = 0
    let lateFines = 0
    const attendedDates = new Set<string>()
    for (const day of grouped) {
      const dateKey = day.date.toISOString().split('T')[0]
      attendedDates.add(dateKey)
      const normAs = normalizedByDate.get(dateKey)
      if (normAs === 'FULL_DAY') {
        fullDays += 1
      } else if (normAs === 'HALF_DAY') {
        halfDays += 1
      } else if (day.status === 'absent') {
        // Under min half-day hours: no payable credit from punches
      } else if (day.isHalfDay) {
        halfDays += 1
      } else {
        fullDays += 1
      }
      lateFines += day.penalty ?? 0
    }

    // Approved normalizations for days with no punch
    for (const [dateKey, normAs] of normalizedByDate) {
      if (!attendedDates.has(dateKey)) {
        if (normAs === 'HALF_DAY') halfDays += 1
        else fullDays += 1
      }
    }

    // Leave days in this month: paid vs unpaid (only count days not already in attendance)
    const unpaidLeaveDays = new Set<string>()
    const paidLeaveDays = new Set<string>()
    for (const leave of leaveRequests) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCHours(0, 0, 0, 0)
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0]
        const [y, m] = dateKey.split('-').map(Number)
        if (m !== monthNum || y !== yearNum) continue
        if (attendedDates.has(dateKey)) continue // already counted in full/half
        if (leave.isUnpaid) {
          unpaidLeaveDays.add(dateKey)
        } else {
          paidLeaveDays.add(dateKey)
        }
      }
    }
    const unpaidLeaves = unpaidLeaveDays.size
    const paidLeaves = paidLeaveDays.size

    // Payable = full days + (half days × 0.5) + paid leave days (paid leave = full day pay)
    const payableDays = Math.max(
      0,
      Math.round((fullDays + halfDays * 0.5 + paidLeaves) * 100) / 100
    )

    return successResponse({
      totalDaysInMonth,
      fullDays,
      halfDays,
      paidLeaves,
      unpaidLeaves,
      payableDays,
      lateFines,
      normalizedDays: normalizations.length,
    })
  } catch (error) {
    console.error('Error fetching attendance summary:', error)
    return errorResponse('Failed to fetch attendance summary', 500)
  }
}
