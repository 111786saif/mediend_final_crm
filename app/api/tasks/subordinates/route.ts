import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()

  const tasks = await prisma.task.findMany({
    where: { createdById: user.id, assigneeId: { not: user.id } },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
  })

  return successResponse(tasks)
}
