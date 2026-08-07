import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequest } from "@/lib/session"
import { getEmployeeByUserId, getSubordinates } from "@/lib/hierarchy"
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { isActiveHeadcountEmployee } from "@/lib/hrms/headcount"
import { startOfDay, endOfDay } from "date-fns"

export type TeamMemberSource = "team" | "watchlist" | "subordinate"
export type AttendanceStatus = "in" | "out" | "leave"

export interface MDTeamOverviewMember {
  id: string // userId for assignment
  employeeId: string
  name: string
  email: string
  role: string
  designation: string | null
  department: { id: string; name: string } | null
  taskCount: number
  overdueCount: number
  completedCount: number
  averageRating: number | null
  extensionRequests: number
  unseenActivityCount: number
  attendanceStatus: AttendanceStatus
  inTime: string | null
  lastWorkLogAt: string | null // ISO string of most recent work log createdAt
  worklogEnforced: boolean
  source: TeamMemberSource
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const employee = await getEmployeeByUserId(user.id)
    const hasSubordinates = employee
      ? (await getSubordinates(employee.id, false)).length > 0
      : false
    const isManager = user.role === "MD" || user.role === "ADMIN" || hasSubordinates
    if (!isManager) {
      return errorResponse("Forbidden", 403)
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase() ?? ""

    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)

    // 1. Direct subordinates (only for non-MD managers; MD sees only team + watchlist)
    const isMD = user.role === "MD"
    const mdEmployee = await getEmployeeByUserId(user.id)
    const subordinateEmployees =
      !isMD && mdEmployee ? await getSubordinates(mdEmployee.id, false) : []

    // 2. MD task team members (all teams owned by this user)
    const taskTeams = await prisma.mDTaskTeam.findMany({
      where: { ownerId: user.id },
      include: {
        members: {
          include: {
            employee: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, role: true },
                },
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })
    const teamEmployeeIds = new Set<string>()
    for (const team of taskTeams) {
      for (const m of team.members) {
        teamEmployeeIds.add(m.employeeId)
      }
    }

    // 3. Watchlist employees
    const watchlistEntries = await prisma.mDWatchlistEmployee.findMany({
      where: { ownerId: user.id },
      include: {
        employee: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    type EmployeeRow = {
      id: string
      userId?: string
      status?: string
      user: { id: string; name: string | null; email: string | null; role: string }
      department: { id: string; name: string } | null
      designation?: string | null
    }

    // Merge and deduplicate by employee id; track source (subordinate > team > watchlist)
    // MD: only team + watchlist. Other managers: subordinates + team + watchlist
    // Skip terminated/absconded — they must not appear in workspace team surfaces
    const byEmployeeId = new Map<string, { employee: EmployeeRow; source: TeamMemberSource }>()
    if (!isMD) {
      for (const emp of subordinateEmployees) {
        if (!isActiveHeadcountEmployee(emp.status)) continue
        byEmployeeId.set(emp.id, { employee: emp as EmployeeRow, source: "subordinate" })
      }
    }
    for (const team of taskTeams) {
      for (const m of team.members) {
        const e = m.employee as EmployeeRow & { status: string }
        if (!isActiveHeadcountEmployee(e.status)) continue
        if (!byEmployeeId.has(e.id)) {
          byEmployeeId.set(e.id, { employee: e, source: "team" })
        }
      }
    }
    for (const entry of watchlistEntries) {
      const e = entry.employee as EmployeeRow & { status: string }
      if (!isActiveHeadcountEmployee(e.status)) continue
      if (!byEmployeeId.has(e.id)) {
        byEmployeeId.set(e.id, { employee: e, source: "watchlist" })
      }
    }

    const employeeIds = Array.from(byEmployeeId.keys())

    if (employeeIds.length === 0) {
      return successResponse({ members: [] })
    }

    // Designations (subordinates don't have it in hierarchy select)
    const employeesWithMeta = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, userId: true, designation: true },
    })
    const designationByEmployeeId = new Map(employeesWithMeta.map((e) => [e.id, e.designation ?? null]))

    // Task counts per assignee (userId)
    const userIds = Array.from(byEmployeeId.values()).map((v) =>
      v.employee.userId ?? v.employee.user.id
    )
    const tasksByAssignee = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      _count: { id: true },
    })
    const overdueByAssignee = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: today },
      },
      _count: { id: true },
    })
    const completedByAssignee = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: "COMPLETED",
      },
      _count: { id: true },
    })
    const taskCountMap = new Map<string, number>()
    const overdueCountMap = new Map<string, number>()
    const completedCountMap = new Map<string, number>()
    for (const r of tasksByAssignee) {
      taskCountMap.set(r.assigneeId, r._count.id)
    }
    for (const r of overdueByAssignee) {
      overdueCountMap.set(r.assigneeId, r._count.id)
    }
    for (const r of completedByAssignee) {
      completedCountMap.set(r.assigneeId, r._count.id)
    }

    // Average rating per assignee — read from TaskRating so this matches the
    // Performance tab exactly. Reset monthly via the `month` field (YYYYMM).
    const now = new Date()
    const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1)
    const monthRatings = await prisma.taskRating.findMany({
      where: {
        employeeId: { in: userIds },
        month: currentMonth,
      },
      select: { employeeId: true, grade: true },
    })
    const ratingMap = new Map<string, { sum: number; count: number }>()
    for (const r of monthRatings) {
      if (r.grade < 1 || r.grade > 5) continue
      const existing = ratingMap.get(r.employeeId) ?? { sum: 0, count: 0 }
      existing.sum += r.grade
      existing.count += 1
      ratingMap.set(r.employeeId, existing)
    }
    const avgRatingMap = new Map<string, number>()
    for (const [uid, { sum, count }] of ratingMap) {
      avgRatingMap.set(uid, Math.round((sum / count) * 10) / 10)
    }

    // Extension requests per assignee
    const extensionRequests = await prisma.taskDueDateApproval.groupBy({
      by: ["requestedById"],
      where: {
        requestedById: { in: userIds },
      },
      _count: { id: true },
    })
    const extensionCountMap = new Map<string, number>()
    for (const r of extensionRequests) {
      extensionCountMap.set(r.requestedById, r._count.id)
    }

    // Unseen activity count per assignee (for MD/manager: comments, pending approvals, EMPLOYEE_DONE after lastSeenAt)
    const tasksForUnseen = await prisma.task.findMany({
      where: { assigneeId: { in: userIds } },
      select: {
        id: true,
        assigneeId: true,
        status: true,
        updatedAt: true,
        comments: { select: { createdAt: true } },
        approvals: {
          where: { status: "PENDING" },
          select: { createdAt: true },
        },
        userTaskSeen: {
          where: { userId: user.id },
          select: { lastSeenAt: true },
        },
      },
    })
    const unseenByAssignee = new Map<string, number>()
    for (const t of tasksForUnseen) {
      const lastSeenAt = t.userTaskSeen?.[0]?.lastSeenAt ?? null
      const cutoff = lastSeenAt ?? new Date(0)
      const unseenComments = t.comments.filter((c) => new Date(c.createdAt) > cutoff).length
      const unseenApprovals = t.approvals.filter((a) => new Date(a.createdAt) > cutoff).length
      const unseenEmployeeDone =
        t.status === "EMPLOYEE_DONE" && new Date(t.updatedAt) > cutoff ? 1 : 0
      const count = unseenComments + unseenApprovals + unseenEmployeeDone
      if (count > 0) {
        unseenByAssignee.set(t.assigneeId, (unseenByAssignee.get(t.assigneeId) ?? 0) + count)
      }
    }

    // Latest work log per user (WorkLog.employeeId = userId)
    const latestWorkLogs = await prisma.workLog.findMany({
      where: { employeeId: { in: userIds } },
      select: { employeeId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    const lastWorkLogByUserId = new Map<string, Date>()
    for (const w of latestWorkLogs) {
      if (!lastWorkLogByUserId.has(w.employeeId)) {
        lastWorkLogByUserId.set(w.employeeId, w.createdAt)
      }
    }

    // Work log enforcement permissions per user
    const worklogPermissions = await prisma.userFeaturePermission.findMany({
      where: {
        userId: { in: userIds },
        featureKey: "worklog_enforcement",
        enabled: true,
      },
      select: { userId: true },
    })
    const worklogEnforcedSet = new Set(worklogPermissions.map((p) => p.userId))

    // Today's attendance — matches attendance route / heatmap logic.
    // inTime = earliest punch, outTime = latest punch (only if 2+ punches AND gap > 5 min).
    // Biometric devices often record duplicate/close-together punches for a single check-in,
    // so we use a minimum gap threshold to distinguish a real check-out from a double-tap.
    const MIN_IN_OUT_GAP_MS = 5 * 60 * 1000 // 5 minutes

    const todayAttendance = await prisma.attendanceLog.findMany({
      where: {
        employeeId: { in: employeeIds },
        logDate: { gte: todayStart, lte: todayEnd },
      },
    })
    const todayLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
    })

    const attendanceByEmployeeId = new Map<string, { status: AttendanceStatus; inTime: string | null }>()
    for (const empId of employeeIds) {
      const onLeave = todayLeaves.some((l) => l.employeeId === empId)
      if (onLeave) {
        attendanceByEmployeeId.set(empId, { status: "leave", inTime: null })
        continue
      }
      const empLogs = todayAttendance.filter((a) => a.employeeId === empId)
      if (empLogs.length === 0) {
        attendanceByEmployeeId.set(empId, { status: "out", inTime: null })
        continue
      }
      const earliest = empLogs.reduce((min, log) => (log.logDate < min.logDate ? log : min))
      const latest = empLogs.reduce((max, log) => (log.logDate > max.logDate ? log : max))
      const inTime = earliest.logDate.toISOString()
      const gapMs = latest.logDate.getTime() - earliest.logDate.getTime()
      // "in" when only 1 punch, or when all punches are within 5 min (biometric double-tap)
      const isIn = empLogs.length === 1 || gapMs < MIN_IN_OUT_GAP_MS
      attendanceByEmployeeId.set(empId, {
        status: isIn ? "in" : "out",
        inTime,
      })
    }

    const members: MDTeamOverviewMember[] = []
    for (const [empId, { employee, source }] of byEmployeeId) {
      const u = employee.user
      const userId = employee.userId ?? u.id
      const name = u.name ?? ""
      const email = u.email ?? ""
      if (search && !name.toLowerCase().includes(search) && !email.toLowerCase().includes(search)) {
        continue
      }
      const att = attendanceByEmployeeId.get(empId) ?? { status: "out" as AttendanceStatus, inTime: null }
      const lastWorkLog = lastWorkLogByUserId.get(userId)
      members.push({
        id: userId,
        employeeId: empId,
        name,
        email,
        role: u.role ?? "",
        designation: designationByEmployeeId.get(empId) ?? null,
        department: employee.department,
        taskCount: taskCountMap.get(userId) ?? 0,
        overdueCount: overdueCountMap.get(userId) ?? 0,
        completedCount: completedCountMap.get(userId) ?? 0,
        averageRating: avgRatingMap.get(userId) ?? null,
        extensionRequests: extensionCountMap.get(userId) ?? 0,
        unseenActivityCount: unseenByAssignee.get(userId) ?? 0,
        attendanceStatus: att.status,
        inTime: att.inTime,
        lastWorkLogAt: lastWorkLog ? lastWorkLog.toISOString() : null,
        worklogEnforced: worklogEnforcedSet.has(userId),
        source,
      })
    }

    // Sort by name
    members.sort((a, b) => a.name.localeCompare(b.name))

    return successResponse({ members })
  } catch (err) {
    console.error("Error fetching MD team overview:", err)
    return errorResponse("Failed to fetch team overview", 500)
  }
}
