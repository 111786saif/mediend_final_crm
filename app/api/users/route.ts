import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { UserRole } from '@/generated/prisma/enums'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission, canCreateRole } from '@/lib/rbac'
import { hashPassword } from '@/lib/auth'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { HEADCOUNT_EMPLOYEE_STATUSES } from '@/lib/hrms/headcount'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  departmentId: z.string().optional().nullable(),
  employeeCode: z.string().min(1),
  managerId: z.string().nullable().optional(),
  bdNumber: z.number().int().positive().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'users:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Prisma.UserWhereInput = {}
    if (role && role in UserRole) {
      where.role = role as UserRole
    }
    // Workspace lists hide terminated/absconded; HR admin can pass includeInactive=true
    if (!includeInactive) {
      where.OR = [
        { employee: null },
        { employee: { status: { in: [...HEADCOUNT_EMPLOYEE_STATUSES] } } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            status: true,
            bdNumber: true,
            circle: true,
            joinDate: true,
            salary: true,
            departmentId: true,
            dateOfBirth: true,
            aadharNumber: true,
            panNumber: true,
            aadharDocUrl: true,
            panDocUrl: true,
            department: {
              select: {
                id: true,
                name: true,
                headId: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Remove password hash from response
    const safeUsers = users.map((user) => {
      const safeUser = { ...user }
      delete (safeUser as { passwordHash?: string }).passwordHash
      return safeUser
    })

    return successResponse(safeUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return errorResponse('Failed to fetch users', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'users:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createUserSchema.parse(body)

    // Prevent MD role creation
    if (data.role === 'MD') {
      return errorResponse('MD role cannot be created', 400)
    }

    // Validate creator has permission to create this role
    if (!canCreateRole(user, data.role)) {
      return errorResponse(`You do not have permission to create users with role: ${data.role}`, 403)
    }

    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase().trim()

    const passwordHash = await hashPassword(data.password)

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    // Create employee record with required employeeCode
    const codeExists = await prisma.employee.findUnique({
      where: { employeeCode: data.employeeCode },
    })
    if (codeExists) {
      await prisma.user.delete({ where: { id: newUser.id } })
      return errorResponse('Employee code already exists', 400)
    }

    if (data.bdNumber != null) {
      const bdNumExists = await prisma.employee.findUnique({
        where: { bdNumber: data.bdNumber },
      })
      if (bdNumExists) {
        await prisma.user.delete({ where: { id: newUser.id } })
        return errorResponse('CRM Number already assigned to another employee', 400)
      }
    }

    if (data.managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: data.managerId },
      })
      if (!manager) {
        await prisma.user.delete({ where: { id: newUser.id } })
        return errorResponse('Manager not found', 400)
      }
    }

    const { initializeLeaveBalances } = await import('@/lib/hrms/leave-balance-utils')
    const { clearBdNumberCache } = await import('@/lib/sync/bd-number-map')
    const employee = await prisma.employee.create({
      data: {
        userId: newUser.id,
        employeeCode: data.employeeCode.trim(),
        departmentId: data.departmentId || null,
        managerId: data.managerId ?? null,
        bdNumber: data.bdNumber ?? null,
      },
    })
    await initializeLeaveBalances(employee.id)
    clearBdNumberCache()

    return successResponse(newUser, 'User created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Email already exists', 400)
    }
    console.error('Error creating user:', error)
    return errorResponse('Failed to create user', 500)
  }
}
