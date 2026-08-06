import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates, isManagerOf } from '@/lib/hierarchy'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hierarchy:team:read')) {
      return errorResponse('Forbidden', 403)
    }

    const employee = await getEmployeeByUserId(user.id)
    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const { searchParams } = new URL(request.url)
    const managerEmployeeId = searchParams.get('managerEmployeeId')

    let rootId = employee.id
    if (managerEmployeeId) {
      if (managerEmployeeId === employee.id) {
        rootId = employee.id
      } else {
        const inChain = await isManagerOf(employee.id, managerEmployeeId)
        if (!inChain) {
          return errorResponse('You can only view teams of your direct or indirect reports', 403)
        }
        rootId = managerEmployeeId
      }
    }

    const directReports = await prisma.employee.findMany({
      where: { managerId: rootId, ...headcountEmployeeWhere },
      select: {
        id: true,
        userId: true,
        employeeCode: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    })

    const subordinateCounts = await Promise.all(
      directReports.map(async (emp) => {
        const subs = await getSubordinates(emp.id, true)
        return { employeeId: emp.id, count: subs.length }
      })
    )
    const countByEmployeeId = new Map(subordinateCounts.map((s) => [s.employeeId, s.count]))

    const tree = directReports.map((emp) => ({
      id: emp.id,
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      name: emp.user.name,
      email: emp.user.email,
      role: emp.user.role,
      departmentName: emp.department?.name ?? null,
      subordinateCount: countByEmployeeId.get(emp.id) ?? 0,
      hasSubordinates: (countByEmployeeId.get(emp.id) ?? 0) > 0,
    }))

    return successResponse({
      managerEmployeeId: rootId,
      members: tree,
    })
  } catch (error) {
    console.error('Error fetching team tree:', error)
    return errorResponse('Failed to fetch team tree', 500)
  }
}
