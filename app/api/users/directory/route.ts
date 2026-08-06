import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { HEADCOUNT_EMPLOYEE_STATUSES } from '@/lib/hrms/headcount'

export type DirectoryUser = {
  id: string
  name: string
  email: string
  role: string
  designation: string | null
  department: { id: string; name: string } | null
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const users = await prisma.user.findMany({
      where: {
        employee: {
          status: { in: [...HEADCOUNT_EMPLOYEE_STATUSES] },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            designation: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const payload: DirectoryUser[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.employee?.designation ?? null,
      department: u.employee?.department ?? null,
    }))

    return successResponse(payload)
  } catch (error) {
    console.error('Error fetching directory:', error)
    return errorResponse('Failed to fetch directory', 500)
  }
}
