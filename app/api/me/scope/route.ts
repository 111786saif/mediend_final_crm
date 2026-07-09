import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSubordinateEmployeeIds } from '@/lib/rbac-new'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    // 1. Fetch caller's Employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!employee) {
      // If user is MD or ADMIN, they have access to all, or if not an employee, they have no subordinates
      return successResponse({
        self: user.id,
        subordinates: [],
        message: 'No employee record found for user.',
      })
    }

    // 2. Fetch subordinate employee IDs recursively via recursive CTE
    const subordinateEmployeeIds = await getSubordinateEmployeeIds(employee.id)

    // 3. Resolve these employee IDs to User IDs
    const subordinateUsers = await prisma.user.findMany({
      where: {
        employee: {
          id: { in: subordinateEmployeeIds },
        },
      },
      select: { id: true },
    })

    const subordinateUserIds = subordinateUsers.map((u) => u.id)

    return successResponse({
      self: user.id,
      subordinates: subordinateUserIds,
    })
  } catch (error) {
    console.error('Error fetching data scope:', error)
    return errorResponse('Failed to fetch data scope', 500)
  }
}
