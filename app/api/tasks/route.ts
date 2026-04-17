import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse, fieldErrorResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"
import { getEmployeeByUserId, getSubordinates, isUserInMDManagedCohort, getMDTeamAndWatchlistUserIds } from "@/lib/hierarchy"
import { z } from "zod"

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["GENERAL", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
})

async function getAllowedAssigneeIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (user?.role === "ADMIN") return [] // Admin sees all
  if (user?.role === "MD") {
    // MD sees only their team + watchlist + self
    const ids = await getMDTeamAndWatchlistUserIds(userId)
    return [userId, ...ids.filter((id) => id !== userId)]
  }
  const employee = await getEmployeeByUserId(userId)
  if (!employee) return [userId]
  const subordinates = await getSubordinates(employee.id, true)
  const subordinateUserIds = subordinates.map((s) => s.userId)
  return [userId, ...subordinateUserIds]
}

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const assigneeId = searchParams.get("assigneeId")
  const createdById = searchParams.get("createdById")
  const status = searchParams.get("status")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const isAdmin = user.role === "ADMIN"
  const allowedAssigneeIds = await getAllowedAssigneeIds(user.id)

  const where: Record<string, unknown> = {}

  if (assigneeId) {
    if (isAdmin || allowedAssigneeIds.includes(assigneeId)) {
      where.assigneeId = assigneeId
    } else {
      return errorResponse("Forbidden", 403)
    }
  } else if (!isAdmin && allowedAssigneeIds.length > 0) {
    where.assigneeId = { in: allowedAssigneeIds }
  }

  if (createdById) {
    if (createdById !== user.id) return errorResponse("Forbidden", 403)
    where.createdById = createdById
  }

  if (status) {
    where.status = status
  }

  if (startDate && endDate) {
    where.OR = [
      { dueDate: { gte: new Date(startDate), lte: new Date(endDate) } },
      { startTime: { gte: new Date(startDate), lte: new Date(endDate) } },
    ]
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { approvals: true, comments: true } },
      approvals: {
        where: { status: "PENDING" },
        select: { id: true, createdAt: true },
      },
      comments: { select: { id: true, createdAt: true } },
      userTaskSeen: {
        where: { userId: user.id },
        select: { lastSeenAt: true },
      },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
  })

  const lastSeenByTaskId = new Map<string, Date>()
  for (const t of tasks) {
    const seen = t.userTaskSeen?.[0]
    if (seen?.lastSeenAt) lastSeenByTaskId.set(t.id, seen.lastSeenAt)
  }

  const mapped = tasks.map((t) => {
    const lastSeenAt = lastSeenByTaskId.get(t.id) ?? null
    const cutoff = lastSeenAt ?? new Date(0)

    const unseenComments = (t.comments ?? []).filter((c) => new Date(c.createdAt) > cutoff).length
    const unseenApprovals = (t.approvals ?? []).filter((a) => new Date(a.createdAt) > cutoff).length
    const unseenEmployeeDone =
      t.status === "EMPLOYEE_DONE" && new Date(t.updatedAt) > cutoff ? 1 : 0

    const unseenActivityCount = unseenComments + unseenApprovals + unseenEmployeeDone

    const { userTaskSeen, comments, approvals, ...rest } = t
    return {
      ...rest,
      _count: { ...t._count, approvals: t._count.approvals },
      pendingApprovalCount: (t.approvals ?? []).length,
      unseenActivityCount,
    }
  })

  return successResponse(mapped)
}

export async function POST(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const body = await request.json()
  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.message)
  }

  if (parsed.data.dueDate) {
    const due = new Date(parsed.data.dueDate)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfDue = new Date(due)
    startOfDue.setHours(0, 0, 0, 0)
    if (startOfDue.getTime() < startOfToday.getTime()) {
      return fieldErrorResponse("Due date can't be in the past", "dueDate", 400)
    }
  }

  const assigneeId = parsed.data.assigneeId ?? user.id

  if (assigneeId !== user.id) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { role: true },
    })
    if (assignee?.role === "MD" || assignee?.role === "ADMIN") {
      return errorResponse("Tasks cannot be assigned to MD or Admin accounts", 403)
    }

    const isMDOrAdmin = user.role === "MD" || user.role === "ADMIN"
    let canAssign = isMDOrAdmin
    if (!canAssign) {
      const inCohort = await isUserInMDManagedCohort(user.id)
      if (inCohort) {
        canAssign = true
      } else {
        const employee = await getEmployeeByUserId(user.id)
        if (employee) {
          const subordinates = await getSubordinates(employee.id, false)
          canAssign = subordinates.some((s) => s.userId === assigneeId)
        }
      }
    }
    if (!canAssign) {
      return errorResponse("Only your immediate manager can assign tasks to you", 403)
    }
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: (parsed.data.priority as "GENERAL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT") ?? "MEDIUM",
      assigneeId,
      createdById: user.id,
      projectId: parsed.data.projectId ?? null,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : null,
      allDay: parsed.data.allDay ?? true,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  })

  if (assigneeId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${task.title}`,
        link: "/md/tasks",
        relatedId: task.id,
      },
    })
  }

  return successResponse(task)
}
