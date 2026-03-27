import { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/session"
import { successResponse, unauthorizedResponse } from "@/lib/api-utils"
import { getMeetInviteableUserIds } from "@/lib/hierarchy"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()

  const idSet = await getMeetInviteableUserIds(user)
  const users = await prisma.user.findMany({
    where: { id: { in: [...idSet] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  })
  return successResponse(users)
}
