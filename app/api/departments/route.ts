import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission, canCreateRole } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { z } from 'zod'

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  headId: z.string().optional(), // Optional if creating new head
  // New head creation data (when headId is not provided)
  newHead: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD']),
  }).optional(),
}).refine((data) => data.headId || data.newHead, {
  message: 'Either headId or newHead must be provided',
})

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const departments = await prisma.department.findMany({
      include: {
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        employees: {
          where: headcountEmployeeWhere,
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            employees: { where: headcountEmployeeWhere },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Calculate headcount (all employees in department + head if head exists and is not already an employee)
    const departmentsWithHeadcount = await Promise.all(departments.map(async (dept) => {
      let headcount = dept._count.employees
      
      // If department has a head, check if head is already counted as an employee
      if (dept.head?.id) {
        const headEmployee = await prisma.employee.findFirst({
          where: {
            userId: dept.head.id,
            departmentId: dept.id,
            ...headcountEmployeeWhere,
          },
        })
        
        // If head is not an employee in this department, add 1 to headcount
        if (!headEmployee) {
          headcount += 1
        }
      }
      
      return {
        ...dept,
        headcount,
      }
    }))

    return successResponse(departmentsWithHeadcount)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return errorResponse('Failed to fetch departments', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createDepartmentSchema.parse(body)

    // Check if department name already exists
    const existing = await prisma.department.findFirst({
      where: {
        name: data.name,
      },
    })

    if (existing) {
      return errorResponse('Department name already exists', 400)
    }

    let headId: string

    // If creating a new head user
    if (data.newHead) {
      // Only HR_HEAD, MD, and ADMIN can create new department heads
      if (user.role !== 'HR_HEAD' && user.role !== 'MD' && user.role !== 'ADMIN') {
        return errorResponse('Only HR Head, MD, or Admin can create new department heads', 403)
      }

      // Validate creator has permission to create this role
      if (!canCreateRole(user, data.newHead.role)) {
        return errorResponse(`You do not have permission to create users with role: ${data.newHead.role}`, 403)
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.newHead.email.toLowerCase().trim() },
      })

      if (existingUser) {
        return errorResponse('User with this email already exists', 400)
      }

      // Create new user with department head role
      const passwordHash = await hashPassword(data.newHead.password)
      const newHeadUser = await prisma.user.create({
        data: {
          email: data.newHead.email.toLowerCase().trim(),
          passwordHash,
          name: data.newHead.name,
          role: data.newHead.role,
        },
      })

      headId = newHeadUser.id
    } else if (data.headId) {
      // Using existing head
      // Validate head user exists and has department head role
      const headUser = await prisma.user.findUnique({
        where: { id: data.headId },
        select: { id: true, role: true },
      })

      if (!headUser) {
        return errorResponse('Head user not found', 400)
      }

      // Check if user has a department head role
      const deptHeadRoles = ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD']
      if (!deptHeadRoles.includes(headUser.role)) {
        return errorResponse('Selected user must have a department head role', 400)
      }

      // Check if user is already a head of another department
      const existingHeadDept = await prisma.department.findFirst({
        where: {
          headId: data.headId,
        },
      })

      if (existingHeadDept) {
        return errorResponse('User is already a head of another department', 400)
      }

      headId = data.headId
    } else {
      return errorResponse('Either headId or newHead must be provided', 400)
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        headId,
      },
      include: {
        head: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: {
            employees: true,
          },
        },
      },
    })

    return successResponse(department, 'Department created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating department:', error)
    return errorResponse('Failed to create department', 500)
  }
}

// PATCH and DELETE are handled in [id]/route.ts

