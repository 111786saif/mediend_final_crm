import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { initializeLeaveBalances } from '@/lib/hrms/leave-balance-utils'
import { parseEmployeeCircleList, serializeEmployeeCircleList } from '@/lib/employee-circles'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'

const createEmployeeSchema = z.object({
  userId: z.string(),
  employeeCode: z.string(),
  circle: z.string().trim().max(100).optional().nullable(),
  circles: z.array(z.string().trim().min(1).max(100)).optional(),
  joinDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().nullable().optional(),
  bdNumber: z.number().int().positive().optional().nullable(),
  dateOfBirth: z.string().transform((str) => new Date(str)).optional().nullable(),
  aadharNumber: z.string().max(12).optional().nullable(),
  panNumber: z.string().max(10).optional().nullable(),
  aadharDocUrl: z.string().url().optional().nullable().or(z.literal('')),
  panDocUrl: z.string().url().optional().nullable().or(z.literal('')),
  designation: z.string().max(200).optional().nullable(),
})

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
    const data = createEmployeeSchema.parse(body)
    const normalizedCircles =
      data.circles !== undefined
        ? parseEmployeeCircleList(data.circles)
        : data.circle !== undefined
          ? parseEmployeeCircleList(data.circle)
          : []

    // Check if employee already exists for this user
    const existing = await prisma.employee.findUnique({
      where: { userId: data.userId },
    })

    if (existing) {
      return errorResponse('Employee record already exists for this user', 400)
    }

    // Check if employee code is unique
    const codeExists = await prisma.employee.findUnique({
      where: { employeeCode: data.employeeCode },
    })

    if (codeExists) {
      return errorResponse('Employee code already exists', 400)
    }

    if (data.bdNumber != null) {
      const bdNumExists = await prisma.employee.findUnique({
        where: { bdNumber: data.bdNumber },
      })
      if (bdNumExists) {
        return errorResponse('CRM Number already assigned to another employee', 400)
      }
    }

    if (normalizedCircles.length > 0) {
      const circles = await prisma.crmCampaignCircle.findMany({
        where: {
          name: {
            in: normalizedCircles,
          },
        },
        select: { name: true },
      })
      const foundNames = new Set(circles.map((circle) => circle.name.trim().toLowerCase()))
      const missingCircles = normalizedCircles.filter(
        (circle) => !foundNames.has(circle.trim().toLowerCase())
      )
      if (missingCircles.length > 0) {
        return errorResponse(
          missingCircles.length === 1
            ? `Selected circle "${missingCircles[0]}" was not found in CRM masters`
            : `Selected circles were not found in CRM masters: ${missingCircles.join(', ')}`,
          400
        )
      }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { role: true },
    })
    const defaultDesignation = data.designation ?? targetUser?.role ?? null

    const { clearBdNumberCache } = await import('@/lib/sync/bd-number-map')
    const employee = await prisma.employee.create({
      data: {
        userId: data.userId,
        employeeCode: data.employeeCode,
        circle: serializeEmployeeCircleList(normalizedCircles),
        joinDate: data.joinDate || null,
        salary: data.salary || null,
        departmentId: data.departmentId || null,
        managerId: data.managerId ?? null,
        dateOfBirth: data.dateOfBirth || null,
        aadharNumber: data.aadharNumber || null,
        panNumber: data.panNumber || null,
        bdNumber: data.bdNumber ?? null,
        aadharDocUrl: data.aadharDocUrl || null,
        panDocUrl: data.panDocUrl || null,
        designation: defaultDesignation,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Initialize leave balances for the new employee
    await initializeLeaveBalances(employee.id)
    clearBdNumberCache()

    return successResponse(employee, 'Employee record created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating employee:', error)
    return errorResponse('Failed to create employee', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const canRead =
      hasPermission(user, 'hrms:employees:read') || hasPermission(user, 'finance:payroll:read')
    if (!canRead) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')?.trim()
    const status = searchParams.get('status')

    const where: Prisma.EmployeeWhereInput = {}
    if (departmentId) {
      where.departmentId = departmentId
    }
    if (status && ['ACTIVE', 'ON_PIP', 'ON_NOTICE', 'TERMINATED', 'ABSCONDED'].includes(status)) {
      where.status = status as 'ACTIVE' | 'ON_PIP' | 'ON_NOTICE' | 'TERMINATED' | 'ABSCONDED'
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    })

    return successResponse(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return errorResponse('Failed to fetch employees', 500)
  }
}

// PATCH is handled in [id]/route.ts
