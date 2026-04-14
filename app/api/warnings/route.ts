import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from "@/lib/api-utils"
import { prisma } from "@/lib/prisma"
import { getMDTeamAndWatchlistUserIds } from "@/lib/hierarchy"
import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"

const createWarningSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  taskId: z.string().min(1).optional().nullable(),
  type: z.enum(["REPEATED_DEADLINE_MISS", "LOW_QUALITY_WORK", "UNRESPONSIVE", "TASK_ABANDONMENT", "OTHER"], {
    errorMap: () => ({ message: "Pick a warning type" }),
  }),
  note: z.string().min(1, "Add a short note explaining the warning"),
})

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const isAdmin = user.role === "ADMIN"
  const isMD = user.role === "MD"
  let warningWhere: Prisma.WarningWhereInput = {}
  if (!isAdmin && !isMD) {
    warningWhere = { employeeId: user.id }
  } else if (isMD) {
    const ids = await getMDTeamAndWatchlistUserIds(user.id)
    if (ids.length > 0) {
      warningWhere = { employee: { id: { in: ids } } }
    }
  }

  const warnings = await prisma.warning.findMany({
    where: warningWhere,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true } },
      issuedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return successResponse(warnings)
}

export async function POST(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  if (user.role !== "MD" && user.role !== "ADMIN") {
    return errorResponse("Only managers can issue warnings", 403)
  }

  const body = await request.json()
  const parsed = createWarningSchema.safeParse(body)
  if (!parsed.success) {
    return zodErrorResponse(parsed.error)
  }

  const warning = await prisma.warning.create({
    data: {
      employeeId: parsed.data.employeeId,
      taskId: parsed.data.taskId ?? null,
      type: parsed.data.type,
      note: parsed.data.note.trim(),
      issuedById: user.id,
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true } },
      issuedBy: { select: { id: true, name: true } },
    },
  })

  return successResponse(warning)
}
