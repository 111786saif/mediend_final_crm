import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { groupAttendanceByDate } from '@/lib/hrms/attendance-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { Prisma } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:attendance:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const departmentId = searchParams.get('departmentId')
    const employeeId = searchParams.get('employeeId')
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Prisma.AttendanceLogWhereInput = {}
    const activeEmployeeFilter = includeInactive ? {} : headcountEmployeeWhere

    if (fromDate || toDate) {
      where.logDate = {}
      if (fromDate) {
        // Treat date filters in UTC so they line up with how we store `logDate`
        // (we store the IOTime clock-components as UTC with no conversions).
        const [y, m, d] = fromDate.split('-').map(Number)
        where.logDate.gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
      }
      if (toDate) {
        const [y, m, d] = toDate.split('-').map(Number)
        where.logDate.lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      }
    }

    // Handle search by employee name or code
    if (search) {
      const matchingEmployees = await prisma.employee.findMany({
        where: {
          ...activeEmployeeFilter,
          OR: [
            { employeeCode: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      })
      if (matchingEmployees.length > 0) {
        where.employeeId = { in: matchingEmployees.map((e) => e.id) }
      } else {
        // No matching employees, return empty result
        where.employeeId = { in: [] }
      }
    } else if (employeeId) {
      // Explicit employee lookup (heatmap / detail) — still block inactive unless opted in
      if (!includeInactive) {
        const emp = await prisma.employee.findFirst({
          where: { id: employeeId, ...headcountEmployeeWhere },
          select: { id: true },
        })
        where.employeeId = emp ? employeeId : { in: [] }
      } else {
        where.employeeId = employeeId
      }
    } else if (departmentId) {
      const employees = await prisma.employee.findMany({
        where: { departmentId, ...activeEmployeeFilter },
        select: { id: true },
      })
      where.employeeId = {
        in: employees.map((e) => e.id),
      }
    } else if (!includeInactive) {
      // Default org-wide attendance: active roster only
      where.employee = headcountEmployeeWhere
    }

    // IMPORTANT: Fetch ALL logs first (without pagination) to ensure we have
    // all punches for each employee on each day. Then group, calculate inTime/outTime,
    // and finally paginate the grouped results.
    const allLogs = await prisma.attendanceLog.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        logDate: 'desc',
      },
    })

    // Group by employee and date for better presentation
    interface GroupedRecord {
      employee: typeof allLogs[0]['employee']
      date: string
      logs: typeof allLogs
    }
    const employeeMap = new Map<string, GroupedRecord>()
    
    for (const log of allLogs) {
      const key = `${log.employeeId}_${log.logDate.toISOString().split('T')[0]}`
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          employee: log.employee,
          date: log.logDate.toISOString().split('T')[0],
          logs: [],
        })
      }
      employeeMap.get(key)!.logs.push(log)
    }

    const allGrouped = Array.from(employeeMap.values()).map((item) => {
      const dayLogs = item.logs
      // IMPORTANT:
      // The biometric API can mislabel exit punches as IN.
      // For reporting, we treat:
      // - inTime as the earliest punch of the day
      // - outTime as the latest punch of the day (only if there are at least 2 punches)
      const minLog = dayLogs.length > 0
        ? dayLogs.reduce((earliest, current) =>
            current.logDate < earliest.logDate ? current : earliest
          )
        : null
      const maxLog = dayLogs.length > 0
        ? dayLogs.reduce((latest, current) =>
            current.logDate > latest.logDate ? current : latest
          )
        : null
      const inLog = minLog
      const outLog = dayLogs.length >= 2 ? maxLog : null
      
      let workHours = null
      if (inLog && outLog) {
        const diffMs = outLog.logDate.getTime() - inLog.logDate.getTime()
        workHours = diffMs / (1000 * 60 * 60)
      }

      // Check if late (no timezone conversions):
      // `IOTime` is already the IST wall-clock time, and we store it as UTC with the same clock components.
      // So comparing UTC hour/minute is equivalent to comparing the original IOTime hour/minute.
      // Late threshold is 11:00 AM
      const isLate = inLog ? (() => {
        const utcHours = inLog.logDate.getUTCHours()
        const utcMinutes = inLog.logDate.getUTCMinutes()
        return utcHours > 11 || (utcHours === 11 && utcMinutes > 0)
      })() : false

      return {
        ...item,
        inTime: inLog?.logDate || null,
        outTime: outLog?.logDate || null,
        workHours,
        isLate,
      }
    })

    // Sort grouped results by date (descending) and then by employee name
    allGrouped.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return a.employee.user.name.localeCompare(b.employee.user.name)
    })

    // Apply pagination to grouped results
    const total = allGrouped.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const grouped = allGrouped.slice(startIndex, endIndex)

    return successResponse({
      data: grouped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return errorResponse('Failed to fetch attendance', 500)
  }
}

