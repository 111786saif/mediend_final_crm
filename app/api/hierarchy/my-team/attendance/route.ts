import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import {
  DEFAULT_DEPARTMENT_TIMING,
  getDepartmentTiming,
  groupAttendanceByDate,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'

type LeaveDayRow = { date: string; isUnpaid: boolean; isHalfDay?: boolean }

const LEAVE_TYPE_DISPLAY_ORDER = ['CL', 'SL', 'EL', 'LOP'] as const

/** Prorate `leave.days` onto calendar overlap with [rangeStart, rangeEnd] (UTC dates). */
function attributedLeaveDaysInRange(
  leave: { startDate: Date; endDate: Date; days: number },
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = new Date(leave.startDate)
  const end = new Date(leave.endDate)
  start.setUTCHours(0, 0, 0, 0)
  end.setUTCHours(0, 0, 0, 0)
  const rs = new Date(rangeStart)
  rs.setUTCHours(0, 0, 0, 0)
  const re = new Date(rangeEnd)
  re.setUTCHours(0, 0, 0, 0)
  const effStart = start > rs ? start : rs
  const effEnd = end < re ? end : re
  if (effStart > effEnd) return 0

  let calendarInLeave = 0
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    calendarInLeave += 1
  }
  if (calendarInLeave === 0) return 0

  let overlap = 0
  for (let d = new Date(effStart); d <= effEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    overlap += 1
  }
  return leave.days * (overlap / calendarInLeave)
}

function leaveTypeCodeForAggregation(leave: {
  isUnpaid: boolean
  leaveType: { code: string | null; name: string }
}): string {
  if (leave.isUnpaid) return 'LOP'
  const c = leave.leaveType.code?.trim()
  if (c) return c.toUpperCase()
  const n = leave.leaveType.name?.trim()
  return n ? n.slice(0, 8).toUpperCase() : 'OTHER'
}

function aggregateLeaveDaysByTypeInRange(
  leaves: Array<{
    employeeId: string
    startDate: Date
    endDate: Date
    days: number
    isUnpaid: boolean
    leaveType: { code: string | null; name: string }
  }>,
  rangeStart: Date,
  rangeEnd: Date
): Map<string, Map<string, number>> {
  const byEmp = new Map<string, Map<string, number>>()
  for (const leave of leaves) {
    const attributed = attributedLeaveDaysInRange(leave, rangeStart, rangeEnd)
    if (attributed <= 0) continue
    const code = leaveTypeCodeForAggregation(leave)
    if (!byEmp.has(leave.employeeId)) byEmp.set(leave.employeeId, new Map())
    const m = byEmp.get(leave.employeeId)!
    m.set(code, (m.get(code) ?? 0) + attributed)
  }
  return byEmp
}

function toLeaveByTypeList(m: Map<string, number>): { code: string; days: number }[] {
  const rows = Array.from(m.entries())
    .map(([code, days]) => ({
      code,
      days: Math.round(days * 100) / 100,
    }))
    .filter((r) => r.days > 0)

  const rank = (code: string) => {
    const i = LEAVE_TYPE_DISPLAY_ORDER.indexOf(code as (typeof LEAVE_TYPE_DISPLAY_ORDER)[number])
    return i === -1 ? 100 + code.charCodeAt(0) : i
  }
  rows.sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code))
  return rows
}

function expandApprovedLeavesToLeaveDays(
  leaves: Array<{ employeeId: string; startDate: Date; endDate: Date; isUnpaid: boolean; days: number }>,
  rangeStart: Date,
  rangeEnd: Date
): Map<string, LeaveDayRow[]> {
  const rangeStartStr = rangeStart.toISOString().split('T')[0]
  const rangeEndStr = rangeEnd.toISOString().split('T')[0]
  const map = new Map<string, LeaveDayRow[]>()

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
      if (dateKey < rangeStartStr || dateKey > rangeEndStr) continue
      const row: LeaveDayRow = {
        date: dateKey,
        isUnpaid: leave.isUnpaid,
        ...(isHalfDayLeave ? { isHalfDay: true as const } : {}),
      }
      const list = map.get(leave.employeeId) ?? []
      list.push(row)
      map.set(leave.employeeId, list)
    }
  }
  return map
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hierarchy:team:read')) {
      return errorResponse('Forbidden', 403)
    }

    const employee = await getEmployeeByUserId(user.id)
    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const { searchParams } = new URL(request.url)
    const managerEmployeeIdParam = searchParams.get('managerEmployeeId')

    let rootEmployeeId = employee.id
    if (managerEmployeeIdParam && managerEmployeeIdParam !== employee.id) {
      const { isManagerOf } = await import('@/lib/hierarchy')
      const inChain = await isManagerOf(employee.id, managerEmployeeIdParam)
      if (!inChain) {
        return errorResponse('You can only view attendance of your direct or indirect reports', 403)
      }
      rootEmployeeId = managerEmployeeIdParam
    }

    const subordinates = await getSubordinates(rootEmployeeId, true)
    let subordinateIds = subordinates.map((s) => s.id)
    if (managerEmployeeIdParam && managerEmployeeIdParam !== employee.id) {
      subordinateIds = [managerEmployeeIdParam, ...subordinateIds]
    }
    if (subordinateIds.length === 0) {
      return successResponse({ entries: [], holidayDays: [], fromDate: null, toDate: null })
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    let rangeStart: Date | null = null
    let rangeEnd: Date | null = null
    const where: { employeeId: { in: string[] }; logDate?: { gte?: Date; lte?: Date } } = {
      employeeId: { in: subordinateIds },
    }
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

    const [logs, employeesWithDept, normalizations, approvedLeaves, holidaysInRange] = await Promise.all([
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
      prisma.employee.findMany({
        where: { id: { in: subordinateIds } },
        include: {
          department: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: { in: subordinateIds },
          status: { in: ['APPROVED', 'PENDING'] },
          ...(rangeStart && rangeEnd
            ? { date: { gte: rangeStart, lte: rangeEnd } }
            : {}),
        },
        select: { employeeId: true, date: true, status: true },
      }),
      rangeStart && rangeEnd
        ? prisma.leaveRequest.findMany({
            where: {
              employeeId: { in: subordinateIds },
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

    const timingByEmployeeId = new Map<string, DepartmentTiming>()
    employeesWithDept.forEach((emp) => {
      timingByEmployeeId.set(emp.id, getDepartmentTiming(emp.department))
    })

    const approvedByEmployee = new Map<string, Set<string>>()
    const pendingByEmployee = new Map<string, Set<string>>()
    normalizations.forEach((n) => {
      const key = n.date.toISOString().split('T')[0]
      if (n.status === 'APPROVED') {
        if (!approvedByEmployee.has(n.employeeId)) approvedByEmployee.set(n.employeeId, new Set())
        approvedByEmployee.get(n.employeeId)!.add(key)
      } else {
        if (!pendingByEmployee.has(n.employeeId)) pendingByEmployee.set(n.employeeId, new Set())
        pendingByEmployee.get(n.employeeId)!.add(key)
      }
    })

    const byEmployee = new Map<string, typeof logs>()
    for (const log of logs) {
      const list = byEmployee.get(log.employeeId) ?? []
      list.push(log)
      byEmployee.set(log.employeeId, list)
    }

    const holidayDays =
      rangeStart && rangeEnd
        ? holidaysInRange.map((h) => ({
            date: h.date.toISOString().split('T')[0],
            name: h.name,
          }))
        : []

    const leaveDaysByEmployee =
      rangeStart && rangeEnd
        ? expandApprovedLeavesToLeaveDays(approvedLeaves, rangeStart, rangeEnd)
        : new Map<string, LeaveDayRow[]>()

    const leaveByTypeByEmployee =
      rangeStart && rangeEnd
        ? aggregateLeaveDaysByTypeInRange(approvedLeaves, rangeStart, rangeEnd)
        : new Map<string, Map<string, number>>()

    const idsWithData = new Set<string>()
    for (const id of byEmployee.keys()) idsWithData.add(id)
    for (const id of leaveDaysByEmployee.keys()) idsWithData.add(id)

    const entries = Array.from(idsWithData)
      .map((empId) => {
        const empRow = employeesWithDept.find((e) => e.id === empId)
        if (!empRow) return null

        const empLogs = byEmployee.get(empId) ?? []
        const empFromLogs = empLogs[0]?.employee
        const timing = timingByEmployeeId.get(empId) ?? DEFAULT_DEPARTMENT_TIMING
        const grouped = groupAttendanceByDate(empLogs, timing)
        const approvedDates = approvedByEmployee.get(empId) ?? new Set<string>()
        const pendingDates = pendingByEmployee.get(empId) ?? new Set<string>()
        const attendanceWithNorm = grouped.map((day) => {
          const dateKey = day.date.toISOString().split('T')[0]
          return {
            ...day,
            isNormalized: approvedDates.has(dateKey),
            isPendingNormalization: pendingDates.has(dateKey),
          }
        })

        return {
          employeeId: empId,
          name: empFromLogs?.user.name ?? empRow.user.name,
          email: empFromLogs?.user.email ?? empRow.user.email,
          role: empFromLogs?.user.role ?? empRow.user.role,
          attendance: attendanceWithNorm,
          leaveDays: leaveDaysByEmployee.get(empId) ?? [],
          leaveByType: toLeaveByTypeList(leaveByTypeByEmployee.get(empId) ?? new Map()),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e != null)

    return successResponse({
      entries,
      holidayDays,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    })
  } catch (error) {
    console.error('Error fetching team attendance:', error)
    return errorResponse('Failed to fetch team attendance', 500)
  }
}
