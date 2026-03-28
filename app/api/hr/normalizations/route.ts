import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  DEFAULT_DEPARTMENT_TIMING,
  getDepartmentTiming,
  groupAttendanceByDate,
  type DepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import { employeeNotInMDManagedCohortWhere } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }
    if (!hasPermission(user, 'hrms:attendance:read') && !hasPermission(user, 'hrms:attendance:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: {
      type: { in: ['MANAGER', 'EMPLOYEE_REQUEST'] }
      status?: 'PENDING' | 'APPROVED' | 'REJECTED'
      date?: { gte?: Date; lte?: Date }
      employee: ReturnType<typeof employeeNotInMDManagedCohortWhere>
    } = {
      type: { in: ['MANAGER', 'EMPLOYEE_REQUEST'] },
      employee: employeeNotInMDManagedCohortWhere(),
    }

    if (status) {
      where.status = status
    }

    if (fromDate || toDate) {
      where.date = {}
      if (fromDate) {
        const [y, m, d] = fromDate.split('-').map(Number)
        where.date.gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
      }
      if (toDate) {
        const [y, m, d] = toDate.split('-').map(Number)
        where.date.lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      }
    }

    const list = await prisma.attendanceNormalization.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { name: true, email: true } },
          },
        },
        requestedBy: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        managerApprovedBy: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        approvedBy: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    const employeeIds = [...new Set(list.map((n) => n.employeeId))]
    let punchByEmployeeDate = new Map<string, { inIso: string | null; outIso: string | null }>()

    if (employeeIds.length > 0) {
      let minD = list[0]!.date
      let maxD = list[0]!.date
      for (const n of list) {
        if (n.date < minD) minD = n.date
        if (n.date > maxD) maxD = n.date
      }
      const logRangeStart = new Date(
        Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), minD.getUTCDate(), 0, 0, 0, 0)
      )
      const logRangeEnd = new Date(
        Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth(), maxD.getUTCDate(), 23, 59, 59, 999)
      )

      const [attendanceLogs, employeesWithDept] = await Promise.all([
        prisma.attendanceLog.findMany({
          where: {
            employeeId: { in: employeeIds },
            logDate: { gte: logRangeStart, lte: logRangeEnd },
          },
          orderBy: { logDate: 'asc' },
        }),
        prisma.employee.findMany({
          where: { id: { in: employeeIds } },
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

      punchByEmployeeDate = new Map()
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
    }

    return successResponse({
      list: list.map((n) => {
        // Employee-initiated requests: after manager approval, HR cares who approved on behalf of the team.
        const useManagerAsRequester =
          n.type === 'EMPLOYEE_REQUEST' && n.managerApprovedBy != null
        const requestedByName = useManagerAsRequester
          ? n.managerApprovedBy!.user.name
          : (n.requestedBy?.user?.name ?? null)
        const requestedByEmail = useManagerAsRequester
          ? n.managerApprovedBy!.user.email
          : (n.requestedBy?.user?.email ?? null)

        const dateKey = n.date.toISOString().split('T')[0]
        const punch = punchByEmployeeDate.get(`${n.employeeId}|${dateKey}`)

        return {
          id: n.id,
          employeeId: n.employeeId,
          employeeName: n.employee.user.name,
          employeeCode: n.employee.employeeCode,
          employeeEmail: n.employee.user.email,
          date: dateKey,
          type: n.type,
          status: n.status,
          reason: n.reason,
          hrRejectionReason: n.hrRejectionReason ?? null,
          normalizeAs: n.normalizeAs ?? null,
          createdAt: n.createdAt.toISOString(),
          attendanceIn: punch?.inIso ?? null,
          attendanceOut: punch?.outIso ?? null,
          requestedBy: requestedByName,
          requestedByEmail,
          /** Employee who submitted (differs from requestedBy after manager approval for EMPLOYEE_REQUEST) */
          submittedByEmployeeName: n.requestedBy?.user?.name ?? null,
          submittedByEmployeeEmail: n.requestedBy?.user?.email ?? null,
          approvedBy: n.approvedBy?.user?.name ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching HR normalizations:', error)
    return errorResponse('Failed to fetch normalizations', 500)
  }
}
