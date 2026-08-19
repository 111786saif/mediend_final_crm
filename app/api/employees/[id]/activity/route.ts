import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:read') && !hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const logs = await prisma.employeeProfileActivityLog.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actorUser: { select: { name: true } },
      },
    })

    return successResponse(
      logs.map((log) => ({
        id: log.id,
        action: log.action,
        summary: log.summary,
        createdAt: log.createdAt.toISOString(),
        actorName: log.actorUser.name,
      }))
    )
  } catch (error) {
    console.error('Error fetching employee activity log:', error)
    return errorResponse('Failed to fetch activity log', 500)
  }
}
