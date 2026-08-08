import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'

export interface OrgChartNode {
  id: string
  userId: string
  employeeCode: string
  name: string
  email: string
  role: string
  departmentName: string | null
  managerId: string | null
  managerName: string | null
  subordinateCount: number
  subordinates: OrgChartNode[]
}

function buildTree(
  employees: Array<{
    id: string
    userId: string
    employeeCode: string
    managerId: string | null
    user: { name: string; email: string; role: string }
    department: { name: string } | null
  }>,
  managerId: string | null
): OrgChartNode[] {
  const nodes = employees.filter((e) => e.managerId === managerId)
  return nodes.map((emp) => {
    const manager = emp.managerId ? employees.find((e) => e.id === emp.managerId) : null
    const children = buildTree(employees, emp.id)
    return {
      id: emp.id,
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      name: emp.user.name,
      email: emp.user.email,
      role: emp.user.role,
      departmentName: emp.department?.name ?? null,
      managerId: emp.managerId,
      managerName: manager?.user.name ?? null,
      subordinateCount: children.length,
      subordinates: children,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const allowedRoles = ['ADMIN', 'HR_HEAD']
    if (!allowedRoles.includes(user.role)) {
      return errorResponse('Org chart is available only to Admin and HR Head', 403)
    }

    const employees = await prisma.employee.findMany({
      where: headcountEmployeeWhere,
      select: {
        id: true,
        userId: true,
        employeeCode: true,
        managerId: true,
        user: { select: { name: true, email: true, role: true } },
        department: { select: { name: true } },
      },
    })

    const tree = buildTree(employees, null)
    return successResponse({ roots: tree })
  } catch (error) {
    console.error('Error fetching org chart:', error)
    return errorResponse('Failed to fetch org chart', 500)
  }
}
