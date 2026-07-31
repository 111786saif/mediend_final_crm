import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"
import { getTaskStatsBaseWhere } from "@/lib/tasks/stats-scope"

export async function GET(_request: NextRequest) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()

  const isAdmin = user.role === "ADMIN"
  const isMD = user.role === "MD"
  const baseWhere = await getTaskStatsBaseWhere(user)
  const assigneeWhere =
    "assigneeId" in baseWhere && baseWhere.assigneeId
      ? { assigneeId: baseWhere.assigneeId as { in: string[] } }
      : undefined

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [total, completed, pending, pendingReview, overdue, byProject, byAssignee, employeesWithWarnings] = await Promise.all([
    prisma.task.count({ where: baseWhere }),
    prisma.task.count({ where: { ...baseWhere, status: "COMPLETED" } }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    prisma.task.count({ where: { ...baseWhere, status: "EMPLOYEE_DONE" } }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: startOfToday },
      },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: baseWhere,
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: baseWhere,
      _count: { id: true },
    }),
    isAdmin
      ? prisma.warning.groupBy({ by: ["employeeId"], _count: { id: true } }).then((r) => r.length)
      : assigneeWhere
        ? prisma.warning.groupBy({
            by: ["employeeId"],
            where: { employeeId: { in: assigneeWhere.assigneeId.in } },
            _count: { id: true },
          }).then((r) => r.length)
        : Promise.resolve(0),
  ])

  const projectIds = [...new Set(byProject.map((p) => p.projectId).filter(Boolean))] as string[]
  const projects = projectIds.length
    ? await prisma.taskProject.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : []
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))

  const projectWise = byProject.map((p) => ({
    projectId: p.projectId,
    projectName: p.projectId ? projectMap[p.projectId] ?? "Unknown" : "No project",
    count: p._count.id,
  }))

  const assigneeIds = [...new Set(byAssignee.map((a) => a.assigneeId))]
  const assignees =
    assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : []
  const assigneeMap = Object.fromEntries(assignees.map((a) => [a.id, a.name]))

  const completedByAssignee = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { ...baseWhere, status: "COMPLETED" },
    _count: { id: true },
  })
  const completedMap = Object.fromEntries(completedByAssignee.map((c) => [c.assigneeId, c._count.id]))

  const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1)
  const ratingsThisMonth =
    assigneeIds.length > 0
      ? await prisma.taskRating.groupBy({
          by: ["employeeId"],
          where: { month: currentMonth, employeeId: { in: assigneeIds } },
          _avg: { grade: true },
          _count: { id: true },
        })
      : []
  const avgRatingMap = Object.fromEntries(
    ratingsThisMonth.map((r) => [
      r.employeeId,
      r._count.id > 0 && r._avg.grade != null ? Math.round(r._avg.grade * 10) / 10 : null,
    ])
  )

  const employeeWise = byAssignee.map((a) => ({
    assigneeId: a.assigneeId,
    assigneeName: assigneeMap[a.assigneeId] ?? "Unknown",
    total: a._count.id,
    completed: completedMap[a.assigneeId] ?? 0,
    avgRating: avgRatingMap[a.assigneeId] ?? null,
  }))

  return successResponse({
    total,
    completed,
    pending,
    pendingReview,
    overdue,
    employeesWithWarnings,
    projectWise,
    employeeWise,
  })
}
