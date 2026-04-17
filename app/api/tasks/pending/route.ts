import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const isMDOrAdmin = user.role === "MD" || user.role === "ADMIN"
  if (!isMDOrAdmin) {
    return errorResponse("Forbidden", 403)
  }

  const { searchParams } = new URL(request.url)
  const assigneeId = searchParams.get("assigneeId")

  const where: Record<string, unknown> = {
    status: { in: ["PENDING", "IN_PROGRESS"] },
  }

  if (assigneeId) {
    where.assigneeId = assigneeId
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
  })

  return successResponse(tasks)
}
