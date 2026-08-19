import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth'
import {
  EMPLOYEE_PROFILE_ACTIONS,
  HR_RESET_PASSWORD,
  logEmployeeProfileActivity,
} from '@/lib/hrms/employee-profile-activity'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true } },
      },
    })

    if (!employee) return errorResponse('Employee not found', 404)
    if (employee.userId === user.id) {
      return errorResponse('You cannot reset your own password from here', 400)
    }

    const passwordHash = await hashPassword(HR_RESET_PASSWORD)
    await prisma.user.update({
      where: { id: employee.userId },
      data: { passwordHash },
    })

    await logEmployeeProfileActivity({
      employeeId: employee.id,
      actorUserId: user.id,
      action: EMPLOYEE_PROFILE_ACTIONS.PASSWORD_RESET,
      summary: 'Password was reset',
      metadata: { resetBy: user.name },
    })

    return successResponse(
      { ok: true },
      `Password reset for ${employee.user.name}. Temporary password is ${HR_RESET_PASSWORD}.`
    )
  } catch (error) {
    console.error('Error resetting employee password:', error)
    return errorResponse('Failed to reset password', 500)
  }
}
