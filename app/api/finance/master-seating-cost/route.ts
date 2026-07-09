import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canAccessMasterSeatingCost,
  type MasterSeatingCostRow,
} from '@/lib/finance/master-seating-cost/types'

const createSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().max(2000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canAccessMasterSeatingCost(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const departmentId = searchParams.get('departmentId')

    const where: Prisma.EmployeeWhereInput = { status: 'ACTIVE' }
    if (departmentId && departmentId !== 'all') {
      where.departmentId = departmentId
    }
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { department: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [employees, departments] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          designation: true,
          departmentId: true,
          user: { select: { name: true } },
          department: { select: { name: true } },
          masterSeatingCost: {
            select: { id: true, amount: true, updatedAt: true },
          },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.department.findMany({
        where: { employees: { some: { status: 'ACTIVE' } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const rows: MasterSeatingCostRow[] = employees.map((e) => ({
      employeeId: e.id,
      employeeName: e.user.name,
      employeeCode: e.employeeCode,
      department: e.department?.name ?? null,
      departmentId: e.departmentId,
      designation: e.designation,
      seatingCostId: e.masterSeatingCost?.id ?? null,
      amount: e.masterSeatingCost?.amount ?? null,
      updatedAt: e.masterSeatingCost?.updatedAt.toISOString() ?? null,
    }))

    return successResponse({ rows, departments })
  } catch (error) {
    console.error('Error fetching master seating costs:', error)
    return errorResponse('Failed to fetch master seating costs', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canAccessMasterSeatingCost(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parsed.data.employeeId },
      select: { id: true, status: true },
    })
    if (!employee || employee.status !== 'ACTIVE') {
      return errorResponse('Active employee not found', 404)
    }

    const existing = await prisma.employeeMasterSeatingCost.findUnique({
      where: { employeeId: parsed.data.employeeId },
    })
    if (existing) {
      return errorResponse('Seating cost already exists for this employee. Use edit instead.', 409)
    }

    const record = await prisma.employeeMasterSeatingCost.create({
      data: {
        employeeId: parsed.data.employeeId,
        amount: parsed.data.amount,
        note: parsed.data.note?.trim() || null,
        createdByUserId: user.id,
      },
    })

    return successResponse({
      id: record.id,
      employeeId: record.employeeId,
      amount: record.amount,
      updatedAt: record.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Seating cost already exists for this employee', 409)
    }
    console.error('Error creating master seating cost:', error)
    return errorResponse('Failed to create seating cost', 500)
  }
}
