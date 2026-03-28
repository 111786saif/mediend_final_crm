import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinates } from '@/lib/hierarchy'
import {
  DEFAULT_DEPARTMENT_TIMING,
  getDepartmentTiming,
  groupAttendanceByDate,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'

export async function GET(request: NextRequest) {
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

    const subordinates = await getSubordinates(manager.id, false)
    const subordinateIds = subordinates.map((s) => s.id)

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const month = searchParams.get('month')

    let rangeStart: Date
    let rangeEnd: Date
    if (fromDate && toDate) {
      const [sy, sm, sd] = fromDate.split('-').map(Number)
      const [ey, em, ed] = toDate.split('-').map(Number)
      rangeStart = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0))
      rangeEnd = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999))
    } else if (month) {
      const [y, m] = month.split('-').map(Number)
      rangeStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
      rangeEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))
    } else {
      const now = new Date()
      rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
      rangeEnd = new Date()
    }

    const [list, attendanceLogs, employeesWithDept] = await Promise.all([
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: { in: subordinateIds },
          date: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { date: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              user: { select: { name: true, email: true } },
            },
          },
          requestedBy: { select: { id: true, user: { select: { name: true } } } },
          approvedBy: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
      prisma.attendanceLog.findMany({
        where: {
          employeeId: { in: subordinateIds },
          logDate: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: { logDate: 'asc' },
      }),
      prisma.employee.findMany({
        where: { id: { in: subordinateIds } },
        select: { id: true, department: true },
      }),
    ])

    const timingByEmployeeId = new Map<string, DepartmentTiming>()
    for (const e of employeesWithDept) {
      timingByEmployeeId.set(e.id, getDepartmentTiming(e.department))
    }

    const logsByEmployee = new Map<string, typeof attendanceLogs>()
    for (const log of attendanceLogs) {
      const arr = logsByEmployee.get(log.employeeId) ?? []
      arr.push(log)
      logsByEmployee.set(log.employeeId, arr)
    }

    /** `${employeeId}|${yyyy-mm-dd}` → punch times for that calendar day */
    const punchByEmployeeDate = new Map<string, { inIso: string | null; outIso: string | null }>()
    for (const [empId, logs] of logsByEmployee) {
      const timing = timingByEmployeeId.get(empId) ?? DEFAULT_DEPARTMENT_TIMING
      const grouped = groupAttendanceByDate(logs, timing)
      for (const day of grouped) {
        const dateKey = day.date.toISOString().split('T')[0]
        punchByEmployeeDate.set(`${empId}|${dateKey}`, {
          inIso: day.inTime ? day.inTime.toISOString() : null,
          outIso: day.outTime ? day.outTime.toISOString() : null,
        })
      }
    }

    const usedPerEmployee: Record<string, number> = {}
    for (const n of list) {
      if (n.type === 'MANAGER' && n.status === 'APPROVED') {
        const key = n.employeeId
        const monthKey = `${n.date.getUTCFullYear()}-${n.date.getUTCMonth()}`
        const k = `${key}-${monthKey}`
        usedPerEmployee[k] = (usedPerEmployee[k] || 0) + 1
      }
    }

    const listOut = list.map((n) => {
      const dateKey = n.date.toISOString().split('T')[0]
      const punch = punchByEmployeeDate.get(`${n.employeeId}|${dateKey}`)
      return {
        id: n.id,
        employeeId: n.employeeId,
        date: dateKey,
        type: n.type,
        status: n.status,
        reason: n.reason,
        normalizeAs: n.normalizeAs,
        hrRejectionReason: n.hrRejectionReason,
        createdAt: n.createdAt.toISOString(),
        attendanceIn: punch?.inIso ?? null,
        attendanceOut: punch?.outIso ?? null,
        employee: n.employee,
        requestedBy: n.requestedBy,
        approvedBy: n.approvedBy,
      }
    })

    return successResponse({
      list: listOut,
      subordinates: subordinates.map((s) => ({
        id: s.id,
        employeeCode: s.employeeCode,
        name: s.user.name,
        email: s.user.email,
      })),
    })
  } catch (error) {
    console.error('Error fetching team normalizations:', error)
    return errorResponse('Failed to fetch team normalizations', 500)
  }
}
