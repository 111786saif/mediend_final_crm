import { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  /** Required when requesting a due date change (employee flow); ignored when MD/creator updates directly. */
  dueDateChangeReason: z.string().min(1).optional(),
  priority: z.enum(["GENERAL", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "EMPLOYEE_DONE", "COMPLETED", "CANCELLED"]).optional(),
  /** Required when setting status to COMPLETED. Only manager (creator or MD/ADMIN) can approve. */
  grade: z.enum(["1", "2", "3", "4", "5"]).optional(),
  completionComments: z.string().optional().nullable(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()

  const { id } = await params
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      approvals: { include: { requestedBy: { select: { id: true, name: true } } } },
    },
  })

  if (!task) return errorResponse("Task not found", 404)

  const isMDOrAdmin = user.role === "MD" || user.role === "ADMIN"
  const isAssignee = task.assigneeId === user.id
  const isCreator = task.createdById === user.id
  if (!isAssignee && !isCreator && !isMDOrAdmin) {
    return errorResponse("Forbidden", 403)
  }

  return successResponse(task)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return errorResponse("Task not found", 404)

  const isMDOrAdmin = user.role === "MD" || user.role === "ADMIN"
  const isAssignee = task.assigneeId === user.id
  const isCreator = task.createdById === user.id

  if (!isAssignee && !isCreator && !isMDOrAdmin) {
    return errorResponse("Forbidden", 403)
  }

  const canReviewTask = isMDOrAdmin || isCreator

  const body = await request.json()
  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.message)
  }

  // Only assignee can set status to EMPLOYEE_DONE
  if (parsed.data.status === "EMPLOYEE_DONE" && !isAssignee) {
    return errorResponse("Only the assignee can mark a task as done for review", 403)
  }

  // Only manager can set COMPLETED (approve) or reject EMPLOYEE_DONE -> IN_PROGRESS
  if (parsed.data.status === "COMPLETED" && !canReviewTask) {
    return errorResponse("Only the person who assigned the task can approve it as complete", 403)
  }
  const isSelfAssigned = task.assigneeId === task.createdById
  const isAssigneeRatingSelf = isSelfAssigned && isAssignee
  if (parsed.data.status === "COMPLETED") {
    const grade = parsed.data.grade
    if (!grade || !["1", "2", "3", "4", "5"].includes(grade)) {
      return errorResponse("Rating (1-5) is required when approving a task", 400)
    }
    if (isAssigneeRatingSelf) {
      return errorResponse("For self-assigned tasks, ratings must be given by your manager", 403)
    }
  }
  if (parsed.data.status === "IN_PROGRESS" && task.status === "EMPLOYEE_DONE") {
    if (!canReviewTask) {
      return errorResponse("Only the manager can reject a task back to in progress", 403)
    }
    const grade = parsed.data.grade
    if (!grade || !["1", "2", "3", "4", "5"].includes(grade)) {
      return errorResponse("Rating (1-5) is required when rejecting a task", 400)
    }
    if (isAssigneeRatingSelf) {
      return errorResponse("For self-assigned tasks, ratings must be given by your manager", 403)
    }
  }

  // Employees cannot change due date directly; only MD, ADMIN, or task creator can. Others must request with a reason.
  const canChangeDueDateDirectly = isMDOrAdmin || isCreator
  const dueDateChanged =
    parsed.data.dueDate !== undefined && task.dueDate?.toISOString() !== parsed.data.dueDate

  if (dueDateChanged && !canChangeDueDateDirectly) {
    const reason = parsed.data.dueDateChangeReason?.trim()
    if (!reason) {
      return errorResponse("Reason is required when requesting a due date change", 400)
    }
    const newDue = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    const approval = await prisma.taskDueDateApproval.create({
      data: {
        taskId: id,
        requestedById: user.id,
        oldDueDate: task.dueDate,
        newDueDate: newDue,
        reason,
        status: "PENDING",
      },
    })

    const requestingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    })
    const requesterName = requestingUser?.name || "An employee"

    await prisma.notification.create({
      data: {
        userId: task.createdById,
        type: "DUE_DATE_CHANGE_REQUESTED",
        title: "Due Date Change Requested",
        message: `${requesterName} requested to change due date for task: ${task.title}`,
        link: "/md/tasks",
        relatedId: approval.id,
      },
    })

    return successResponse({
      message: "Due date change requires manager approval",
      approvalId: approval.id,
    })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description
  if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority
  if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId
  if (parsed.data.projectId !== undefined) updateData.projectId = parsed.data.projectId
  if (parsed.data.startTime !== undefined) updateData.startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : null
  if (parsed.data.endTime !== undefined) updateData.endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : null
  if (parsed.data.allDay !== undefined) updateData.allDay = parsed.data.allDay

  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status
    if (parsed.data.status === "COMPLETED") {
      updateData.completedById = user.id
      updateData.completedAt = new Date()
      updateData.grade = parsed.data.grade ?? null
      updateData.completionComments = parsed.data.completionComments?.trim() ?? null
    } else if (parsed.data.status === "IN_PROGRESS" && task.status === "EMPLOYEE_DONE") {
      updateData.completedById = null
      updateData.completedAt = null
      updateData.grade = null
      updateData.completionComments = null
      updateData.rejectionCount = (task.rejectionCount ?? 0) + 1
    } else {
      updateData.completedById = null
      updateData.completedAt = null
      updateData.grade = null
      updateData.completionComments = null
    }
  }

  const activityLogs: { action: string; details: string | null }[] = []
  if (parsed.data.title !== undefined && parsed.data.title !== task.title) {
    activityLogs.push({ action: "TITLE_CHANGED", details: `From "${task.title}" to "${parsed.data.title}"` })
  }
  if (parsed.data.dueDate !== undefined && task.dueDate?.toISOString() !== parsed.data.dueDate) {
    const oldStr = task.dueDate ? task.dueDate.toISOString() : "None"
    const newStr = parsed.data.dueDate || "None"
    activityLogs.push({ action: "DUE_DATE_CHANGED", details: `${oldStr} → ${newStr}` })
  }
  if (parsed.data.priority !== undefined && parsed.data.priority !== task.priority) {
    activityLogs.push({ action: "PRIORITY_CHANGED", details: `${task.priority} → ${parsed.data.priority}` })
  }
  if (parsed.data.status !== undefined && parsed.data.status !== task.status) {
    activityLogs.push({ action: "STATUS_CHANGED", details: `${task.status} → ${parsed.data.status}` })
  }
  if (parsed.data.projectId !== undefined && (task.projectId || "") !== (parsed.data.projectId || "")) {
    activityLogs.push({ action: "PROJECT_CHANGED", details: parsed.data.projectId || "Removed" })
  }

  const now = new Date()
  const month = now.getFullYear() * 100 + (now.getMonth() + 1)
  const gradeInt = parsed.data.grade ? parseInt(parsed.data.grade, 10) : null
  const createRating =
    parsed.data.status === "COMPLETED" ||
    (parsed.data.status === "IN_PROGRESS" && task.status === "EMPLOYEE_DONE" && gradeInt != null)

  const txOps: Prisma.PrismaPromise<unknown>[] = [
    prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    ...activityLogs.map((log) =>
      prisma.taskActivityLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: log.action,
          details: log.details,
        },
      })
    ),
  ]
  if (createRating && gradeInt != null) {
    const action = parsed.data.status === "COMPLETED" ? "APPROVED" : "REJECTED"
    txOps.push(
      prisma.taskRating.create({
        data: {
          taskId: id,
          ratedById: user.id,
          employeeId: task.assigneeId,
          grade: gradeInt,
          comments: parsed.data.completionComments?.trim() ?? null,
          action,
          month,
        },
      })
    )
  }
  const results = await prisma.$transaction(txOps)
  const updated = results[0]

  return successResponse(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()

  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return errorResponse("Task not found", 404)

  const isMDOrAdmin = user.role === "MD" || user.role === "ADMIN"
  const isAssignee = task.assigneeId === user.id
  const isCreator = task.createdById === user.id

  if (!isAssignee && !isCreator && !isMDOrAdmin) {
    return errorResponse("Forbidden", 403)
  }

  await prisma.task.delete({ where: { id } })
  return successResponse({ deleted: true })
}
