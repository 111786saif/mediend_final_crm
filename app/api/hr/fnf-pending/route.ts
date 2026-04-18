import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { addDays, startOfDay } from 'date-fns'

export async function GET(_request: NextRequest) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const today = startOfDay(new Date())

    const employees = await prisma.employee.findMany({
      where: {
        status: 'TERMINATED',
        fnfCompleted: false,
        finalWorkingDay: { lt: today },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { finalWorkingDay: 'asc' },
    })

    const result = employees.map((emp) => {
      const finalWorkingDay = emp.finalWorkingDay!
      const fnfDeadline = emp.fnfDeadline ?? addDays(finalWorkingDay, 45)
      const daysRemaining = Math.ceil((fnfDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))

      return {
        id: emp.id,
        userId: emp.userId,
        employeeCode: emp.employeeCode,
        name: emp.user.name,
        email: emp.user.email,
        finalWorkingDay: finalWorkingDay.toISOString(),
        fnfDeadline: fnfDeadline.toISOString(),
        daysRemaining,
      }
    })

    return successResponse(result)
  } catch (error) {
    console.error('Error fetching FnF pending:', error)
    return errorResponse('Failed to fetch FnF pending', 500)
  }
}
