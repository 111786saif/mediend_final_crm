import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils"
import {
  DEFAULT_DEPARTMENT_TIMING,
  getDepartmentTiming,
  groupAttendanceByDate,
} from "@/lib/hrms/attendance-utils"

type LeaveDayRow = { date: string; isUnpaid: boolean; isHalfDay?: boolean }

/**
 * GET /api/md/team-attendance?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *
 * Returns attendance entries for every employee on the caller's MD team
 * (task-team members + watchlist). Mirrors /api/hierarchy/my-team/attendance
 * but scoped via MD's own team (watchlist + task teams), not org hierarchy.
 */
export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (user.role !== "MD" && user.role !== "ADMIN") {
    return errorResponse("Forbidden", 403)
  }

  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")

  let rangeStart: Date | null = null
  let rangeEnd: Date | null = null
  if (fromDate) {
    const [y, m, d] = fromDate.split("-").map(Number)
    rangeStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  }
  if (toDate) {
    const [y, m, d] = toDate.split("-").map(Number)
    rangeEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
  }

  // Collect this MD's team: task-team members + watchlist.
  const [taskTeams, watchlistEntries] = await Promise.all([
    prisma.mDTaskTeam.findMany({
      where: { ownerId: user.id },
      include: { members: { select: { employeeId: true } } },
    }),
    prisma.mDWatchlistEmployee.findMany({
      where: { ownerId: user.id },
      select: { employeeId: true },
    }),
  ])

  const employeeIdSet = new Set<string>()
  for (const team of taskTeams) for (const m of team.members) employeeIdSet.add(m.employeeId)
  for (const w of watchlistEntries) employeeIdSet.add(w.employeeId)
  const employeeIds = Array.from(employeeIdSet)

  if (employeeIds.length === 0) {
    return successResponse({ entries: [], holidayDays: [], fromDate: fromDate ?? null, toDate: toDate ?? null })
  }

  const logWhere: { employeeId: { in: string[] }; logDate?: { gte?: Date; lte?: Date } } = {
    employeeId: { in: employeeIds },
  }
  if (rangeStart) logWhere.logDate = { ...logWhere.logDate, gte: rangeStart }
  if (rangeEnd) logWhere.logDate = { ...logWhere.logDate, lte: rangeEnd }

  const [logs, employees, normalizations, approvedLeaves, holidaysInRange] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: logWhere,
      orderBy: { logDate: "desc" },
    }),
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        department: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.attendanceNormalization.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ["APPROVED", "PENDING"] },
        ...(rangeStart && rangeEnd ? { date: { gte: rangeStart, lte: rangeEnd } } : {}),
      },
      select: { employeeId: true, date: true, status: true },
    }),
    rangeStart && rangeEnd
      ? prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: "APPROVED",
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

  const logsByEmployee = new Map<string, typeof logs>()
  for (const log of logs) {
    const list = logsByEmployee.get(log.employeeId) ?? []
    list.push(log)
    logsByEmployee.set(log.employeeId, list)
  }

  const approvedDatesByEmp = new Map<string, Set<string>>()
  const pendingDatesByEmp = new Map<string, Set<string>>()
  for (const n of normalizations) {
    const key = n.date.toISOString().split("T")[0]
    const bucket = n.status === "APPROVED" ? approvedDatesByEmp : pendingDatesByEmp
    if (!bucket.has(n.employeeId)) bucket.set(n.employeeId, new Set())
    bucket.get(n.employeeId)!.add(key)
  }

  const leaveDaysByEmployee = new Map<string, LeaveDayRow[]>()
  const leaveByTypeByEmployee = new Map<string, Map<string, number>>()
  if (rangeStart && rangeEnd) {
    const rsStr = rangeStart.toISOString().split("T")[0]
    const reStr = rangeEnd.toISOString().split("T")[0]
    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate)
      const end = new Date(leave.endDate)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCHours(0, 0, 0, 0)
      const sameDay = start.getTime() === end.getTime()
      const isHalf = sameDay && leave.days === 0.5
      const list = leaveDaysByEmployee.get(leave.employeeId) ?? []
      let overlap = 0
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const dk = d.toISOString().split("T")[0]
        if (dk < rsStr || dk > reStr) continue
        list.push({ date: dk, isUnpaid: leave.isUnpaid, ...(isHalf ? { isHalfDay: true } : {}) })
        overlap++
      }
      leaveDaysByEmployee.set(leave.employeeId, list)

      if (overlap > 0) {
        const code = leave.isUnpaid ? "LOP" : (leave.leaveType.code?.toUpperCase() || "OTHER")
        const days = leave.days > 0 ? leave.days : overlap
        const m = leaveByTypeByEmployee.get(leave.employeeId) ?? new Map<string, number>()
        m.set(code, (m.get(code) ?? 0) + days)
        leaveByTypeByEmployee.set(leave.employeeId, m)
      }
    }
  }

  const entries = employees.map((emp) => {
    const timing = getDepartmentTiming(emp.department) ?? DEFAULT_DEPARTMENT_TIMING
    const empLogs = logsByEmployee.get(emp.id) ?? []
    const grouped = groupAttendanceByDate(empLogs, timing)
    const approved = approvedDatesByEmp.get(emp.id) ?? new Set<string>()
    const pending = pendingDatesByEmp.get(emp.id) ?? new Set<string>()
    const attendance = grouped.map((day) => {
      const dateKey = day.date.toISOString().split("T")[0]
      return {
        ...day,
        isNormalized: approved.has(dateKey),
        isPendingNormalization: pending.has(dateKey),
      }
    })
    const leaveByTypeMap = leaveByTypeByEmployee.get(emp.id) ?? new Map<string, number>()
    const leaveByType = Array.from(leaveByTypeMap.entries())
      .filter(([, days]) => days > 0)
      .map(([code, days]) => ({ code, days: Math.round(days * 100) / 100 }))

    return {
      employeeId: emp.id,
      name: emp.user.name ?? "",
      email: emp.user.email ?? "",
      role: emp.user.role ?? "",
      departmentName: emp.department?.name ?? null,
      attendance,
      leaveDays: leaveDaysByEmployee.get(emp.id) ?? [],
      leaveByType,
    }
  })

  const holidayDays = holidaysInRange.map((h) => ({
    date: h.date.toISOString().split("T")[0],
    name: h.name,
  }))

  return successResponse({
    entries,
    holidayDays,
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
  })
}
