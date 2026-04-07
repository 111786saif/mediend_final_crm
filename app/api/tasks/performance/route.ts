import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"
import { getEmployeeByUserId, getSubordinates } from "@/lib/hierarchy"

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const isAdmin = user.role === "ADMIN"
  let allowedEmployeeIds: string[] | null = null
  if (!isAdmin) {
    const employee = await getEmployeeByUserId(user.id)
    if (!employee) {
      allowedEmployeeIds = [user.id]
    } else {
      // MD sees only direct reports (not recursive), others see recursive subordinates
      const recursive = user.role !== "MD"
      const subordinates = await getSubordinates(employee.id, recursive)
      allowedEmployeeIds = [user.id, ...subordinates.map((s) => s.userId)]
    }
  }

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get("month")
  const now = new Date()
  const month =
    monthParam && /^\d{6}$/.test(monthParam)
      ? parseInt(monthParam, 10)
      : now.getFullYear() * 100 + (now.getMonth() + 1)

  const ratingWhere = {
    month,
    ...(allowedEmployeeIds ? { employeeId: { in: allowedEmployeeIds } } : {}),
  }

  const allRatings = await prisma.taskRating.findMany({
    where: ratingWhere,
    select: {
      employeeId: true,
      grade: true,
      action: true,
      taskId: true,
      comments: true,
      createdAt: true,
      task: { select: { title: true } },
    },
  })

  const employeeIds = [...new Set(allRatings.map((r) => r.employeeId))]
  const users =
    employeeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        })
      : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  const approvedByEmployee = new Map<string, number>()
  const rejectedByEmployee = new Map<string, number>()
  const gradeSumByEmployee = new Map<string, number>()
  const gradeCountByEmployee = new Map<string, number>()
  const distributionByEmployee = new Map<
    string,
    { 1: number; 2: number; 3: number; 4: number; 5: number }
  >()
  const ratingsByEmployee = new Map<
    string,
    { grade: number; action: string; taskTitle: string; comments: string | null; createdAt: Date }[]
  >()

  for (const r of allRatings) {
    const dist = distributionByEmployee.get(r.employeeId) ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    if (r.grade >= 1 && r.grade <= 5) dist[r.grade as 1 | 2 | 3 | 4 | 5]++
    distributionByEmployee.set(r.employeeId, dist)

    gradeSumByEmployee.set(r.employeeId, (gradeSumByEmployee.get(r.employeeId) ?? 0) + r.grade)
    gradeCountByEmployee.set(r.employeeId, (gradeCountByEmployee.get(r.employeeId) ?? 0) + 1)

    if (r.action === "APPROVED") {
      approvedByEmployee.set(r.employeeId, (approvedByEmployee.get(r.employeeId) ?? 0) + 1)
    } else {
      rejectedByEmployee.set(r.employeeId, (rejectedByEmployee.get(r.employeeId) ?? 0) + 1)
    }

    const list = ratingsByEmployee.get(r.employeeId) ?? []
    list.push({
      grade: r.grade,
      action: r.action,
      taskTitle: r.task?.title ?? "",
      comments: r.comments,
      createdAt: r.createdAt,
    })
    ratingsByEmployee.set(r.employeeId, list)
  }

  const employees = employeeIds.map((employeeId) => {
    const count = gradeCountByEmployee.get(employeeId) ?? 0
    const sum = gradeSumByEmployee.get(employeeId) ?? 0
    const avgRating = count > 0 ? Math.round((sum / count) * 10) / 10 : null
    const dist = distributionByEmployee.get(employeeId) ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    return {
      employeeId,
      employeeName: userMap[employeeId] ?? "Unknown",
      avgRating,
      totalRatings: count,
      completedCount: approvedByEmployee.get(employeeId) ?? 0,
      rejectedCount: rejectedByEmployee.get(employeeId) ?? 0,
      ratingDistribution: dist,
      ratings: (ratingsByEmployee.get(employeeId) ?? []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }
  })

  employees.sort((a, b) => {
    const aVal = a.avgRating ?? -1
    const bVal = b.avgRating ?? -1
    return bVal - aVal
  })

  const totalRatings = allRatings.length
  const totalApproved = allRatings.filter((r) => r.action === "APPROVED").length
  const totalRejected = allRatings.filter((r) => r.action === "REJECTED").length
  const teamAvgRating =
    totalRatings > 0
      ? Math.round(
          (allRatings.reduce((s, r) => s + r.grade, 0) / totalRatings) * 10
        ) / 10
      : null

  return successResponse({
    month,
    teamStats: {
      totalRatings,
      avgRating: teamAvgRating,
      completedCount: totalApproved,
      rejectedCount: totalRejected,
    },
    employees,
  })
}
