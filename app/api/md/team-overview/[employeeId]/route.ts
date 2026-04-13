import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionFromRequest } from "@/lib/session"
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== "MD" && user.role !== "ADMIN") {
      return errorResponse("Forbidden", 403)
    }

    const { employeeId } = await params

    const ownedTeams = await prisma.mDTaskTeam.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    })
    const teamIds = ownedTeams.map((t) => t.id)

    const [removedMembers, removedWatchlist] = await prisma.$transaction([
      prisma.mDTaskTeamMember.deleteMany({
        where: { employeeId, teamId: { in: teamIds } },
      }),
      prisma.mDWatchlistEmployee.deleteMany({
        where: { ownerId: user.id, employeeId },
      }),
    ])

    if (removedMembers.count === 0 && removedWatchlist.count === 0) {
      return errorResponse("Employee not found in your team", 404)
    }

    return successResponse({
      removedMembers: removedMembers.count,
      removedWatchlist: removedWatchlist.count,
    })
  } catch (error) {
    console.error("Error removing team member:", error)
    return errorResponse("Failed to remove team member", 500)
  }
}
