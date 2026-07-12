import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateEmployeeIds } from '@/lib/rbac-new'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    // Gate access: allow HR_HEAD, MD, ADMIN, or the employee themselves to view their subordinates
    const { id: employeeId } = await params

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    })

    if (!employee) {
      return errorResponse('Employee not found', 404)
    }

    const isSelf = employee.userId === user.id
    const canAccess =
      isSelf ||
      hasPermission(user, 'hrms:employees:read') ||
      user.role === 'MD' ||
      user.role === 'ADMIN'

    if (!canAccess) {
      return errorResponse('Forbidden', 403)
    }

    const subordinateEmployeeIds = await getSubordinateEmployeeIds(employeeId)

    return successResponse({
      employeeId,
      subordinates: subordinateEmployeeIds,
    })
  } catch (error) {
    console.error('Error fetching employee subordinates:', error)
    return errorResponse('Failed to fetch subordinates', 500)
  }
}
