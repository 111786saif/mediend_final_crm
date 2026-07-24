import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(_request: NextRequest) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()

    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const day = today.getDate()

    const employees = await prisma.employee.findMany({
      where: {
        joinDate: { not: null },
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
    })

    const joinedToday = employees.filter((emp) => {
      const join = new Date(emp.joinDate!)
      return (
        join.getFullYear() === year &&
        join.getMonth() === month &&
        join.getDate() === day
      )
    })

    const result = joinedToday.map((emp) => ({
      id: emp.id,
      userId: emp.userId,
      name: emp.user.name,
      joinDate: emp.joinDate!.toISOString(),
      designation: emp.designation,
      department: emp.department?.name ?? null,
    }))

    return successResponse(result)
  } catch (error) {
    console.error('Error fetching new joiners:', error)
    return errorResponse('Failed to fetch new joiners', 500)
  }
}
