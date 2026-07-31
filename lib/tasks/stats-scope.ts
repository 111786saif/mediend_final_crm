import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getEmployeeByUserId, getMDTeamAndWatchlistUserIds, getSubordinates } from "@/lib/hierarchy"

type TaskStatsUser = { id: string; role: string }

/** Same assignee scope as GET /api/tasks/stats. */
export async function getTaskStatsBaseWhere(
  user: TaskStatsUser
): Promise<Prisma.TaskWhereInput> {
  const isAdmin = user.role === "ADMIN"
  const isMD = user.role === "MD"

  if (isAdmin) return {}

  if (isMD) {
    const ids = await getMDTeamAndWatchlistUserIds(user.id)
    if (ids.length > 0) return { assigneeId: { in: ids } }
    return {}
  }

  const employee = await getEmployeeByUserId(user.id)
  if (!employee) return { assigneeId: { in: [user.id] } }

  const subordinates = await getSubordinates(employee.id, true)
  const subordinateUserIds = subordinates.map((s) => s.userId)
  return { assigneeId: { in: [user.id, ...subordinateUserIds] } }
}

/** Overview tab badge: team approvals + overdue (matches Overview stat cards). */
export async function getTaskOverviewCount(user: TaskStatsUser): Promise<number> {
  const baseWhere = await getTaskStatsBaseWhere(user)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [pendingReview, overdue] = await Promise.all([
    prisma.task.count({ where: { ...baseWhere, status: "EMPLOYEE_DONE" } }),
    prisma.task.count({
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: startOfToday },
      },
    }),
  ])

  return pendingReview + overdue
}
