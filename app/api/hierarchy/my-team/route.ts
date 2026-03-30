import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hierarchy:team:read')) {
      return errorResponse('Forbidden', 403)
    }

    const employee = await getEmployeeByUserId(user.id)
    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const subordinates = await getSubordinates(employee.id, user.role !== 'MD')

    return successResponse({
      manager: {
        id: employee.id,
        userId: employee.userId,
        employeeCode: employee.employeeCode,
        name: employee.user.name,
        email: employee.user.email,
        role: employee.user.role,
        departmentName: employee.department?.name ?? null,
      },
      subordinates: subordinates.map((s) => ({
        id: s.id,
        userId: s.userId,
        employeeCode: s.employeeCode,
        name: s.user.name,
        email: s.user.email,
        role: s.user.role,
        departmentName: s.department?.name ?? null,
      })),
      count: subordinates.length,
    })
  } catch (error) {
    console.error('Error fetching my team:', error)
    return errorResponse('Failed to fetch team', 500)
  }
}
