import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'

/**
 * GET /api/md/employees?q=searchTerm
 * Search active employees in the org. MD/ADMIN only.
 */
export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (user.role !== 'MD' && user.role !== 'ADMIN') {
    return errorResponse('Forbidden', 403)
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) {
    return successResponse([])
  }

  const employees = await prisma.employee.findMany({
    where: {
      ...headcountEmployeeWhere,
      OR: [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      userId: true,
      employeeCode: true,
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      team: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
    take: 20,
    orderBy: { user: { name: 'asc' } },
  })

  return successResponse(
    employees.map((e) => ({
      id: e.id,
      userId: e.userId,
      employeeCode: e.employeeCode,
      name: e.user.name,
      email: e.user.email,
      role: e.user.role,
      departmentName: e.team?.department?.name ?? null,
    }))
  )
}
