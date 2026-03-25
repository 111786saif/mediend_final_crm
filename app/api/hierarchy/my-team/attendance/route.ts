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
      return successResponse({ entries: [], fromDate: null, toDate: null })
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

    const [logs, employeesWithDept, normalizations] = await Promise.all([
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
        include: { department: true },
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

    const entries = Array.from(byEmployee.entries()).map(([empId, empLogs]) => {
      const emp = empLogs[0]?.employee
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
        name: emp?.user.name ?? '',
        email: emp?.user.email ?? '',
        role: emp?.user.role ?? '',
        attendance: attendanceWithNorm,
      }
    })

    return successResponse({
      entries,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    })
  } catch (error) {
    console.error('Error fetching team attendance:', error)
    return errorResponse('Failed to fetch team attendance', 500)
  }
}
